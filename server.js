const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 5173;
const HOST = "0.0.0.0";
const ROOT = __dirname;
const MAX_HTML_BYTES = 2_000_000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === "/api/extract") return handleExtract(requestUrl, response);
  if (requestUrl.pathname === "/api/search") return handleSearch(requestUrl, response);
  serveStatic(requestUrl, response);
});

server.listen(PORT, HOST, () => {
  console.log(`NReel is running at http://localhost:${PORT}/index.html`);
});

async function handleExtract(requestUrl, response) {
  const sourceUrl = requestUrl.searchParams.get("url");
  if (!sourceUrl) return sendJson(response, 400, { error: "URLが指定されていません。" });
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return sendJson(response, 400, { error: "URLの形式が正しくありません。" });
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return sendJson(response, 400, { error: "httpまたはhttpsのURLを指定してください。" });
  }
  try {
    const fetched = await fetchHtmlPage(parsedUrl.href);
    if (!fetched.ok) {
      const hint = fetched.status === 403 ? "ページ側が自動取得を拒否しました。" : "ページ取得に失敗しました。";
      return sendJson(response, 502, { error: `${hint} HTTP ${fetched.status}` });
    }
    const contentType = fetched.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return sendJson(response, 415, { error: "HTMLページではないため解析できません。" });
    }
    const html = await readLimitedText(fetched);
    sendJson(response, 200, extractMovieInfo(html, parsedUrl.href));
  } catch (error) {
    sendJson(response, 502, { error: `ページを取得できませんでした: ${error.message}` });
  }
}

async function handleSearch(requestUrl, response) {
  const title = cleanText(requestUrl.searchParams.get("title") || "");
  if (!title) return sendJson(response, 400, { error: "タイトルが指定されていません。" });
  try {
    const result = await searchEigaCom(title);
    if (!result) return sendJson(response, 404, { error: "映画.comで該当作品を見つけられませんでした。" });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 502, { error: `タイトル検索に失敗しました: ${error.message}` });
  }
}

function fetchHtmlPage(url) {
  return fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    redirect: "follow",
  });
}

async function searchEigaCom(title) {
  const searchUrl = `https://eiga.com/search/${encodeURIComponent(title)}/`;
  const searchResponse = await fetchHtmlPage(searchUrl);
  if (!searchResponse.ok) throw new Error(`映画.com検索ページの取得に失敗しました。HTTP ${searchResponse.status}`);
  const searchHtml = await readLimitedText(searchResponse);
  const redirectedUrl = searchResponse.url || searchUrl;
  const movieUrl = isMoviePageUrl(redirectedUrl) ? redirectedUrl : findBestMovieUrlFromSearch(searchHtml, redirectedUrl, title);
  if (!movieUrl) return null;
  const movieResponse = isSameUrl(movieUrl, redirectedUrl) ? null : await fetchHtmlPage(movieUrl);
  if (movieResponse && !movieResponse.ok) throw new Error(`作品ページの取得に失敗しました。HTTP ${movieResponse.status}`);
  const html = movieResponse ? await readLimitedText(movieResponse) : searchHtml;
  return extractMovieInfo(html, movieResponse?.url || movieUrl);
}

function findBestMovieUrlFromSearch(html, baseUrl, title) {
  const candidates = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/movie\/\d+\/?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const href = decodeEntities(match[1]);
    const label = cleanText(match[2]);
    const url = normalizeHref(href, baseUrl);
    if (!url || !isMoviePageUrl(url)) continue;
    candidates.push({ url, score: titleMatchScore(title, label) });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url || "";
}

async function readLimitedText(fetched) {
  const reader = fetched.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractMovieInfo(html, sourceUrl) {
  const metadata = getMetadata(html);
  const jsonLdItems = getJsonLdItems(html);
  const movieData = findMovieData(jsonLdItems);
  const rawTitle = movieData.name || metadata["og:title"] || metadata["twitter:title"] || getTitle(html);
  const description = cleanText(movieData.description || metadata["og:description"] || metadata.description || metadata["twitter:description"]);
  const releaseSource = movieData.datePublished || movieData.releaseDate || metadata["article:published_time"] || extractReleaseDateFromHtml(html);
  return {
    title: cleanTitle(rawTitle),
    director: normalizePeople(movieData.director),
    cast: normalizePeople(movieData.actor).split(", ").slice(0, 5).join(", "),
    releaseDate: normalizeDateValue(releaseSource),
    releaseEndDate: normalizeDateValue(extractReleaseEndDateFromHtml(html)),
    year: extractYear(releaseSource || rawTitle),
    genre: normalizeList(movieData.genre) || extractGenreFromHtml(html) || inferGenre(description),
    description,
    posterUrl: normalizeImageUrl(movieData.image || metadata["og:image"] || metadata["twitter:image"], sourceUrl),
    sourceUrl,
  };
}

function getMetadata(html) {
  const metadata = {};
  const matches = html.match(/<meta\b[^>]*>/gi) || [];
  matches.forEach((tag) => {
    const name = getAttribute(tag, "property") || getAttribute(tag, "name");
    const content = getAttribute(tag, "content");
    if (name && content) metadata[name.toLowerCase()] = decodeEntities(content);
  });
  return metadata;
}

function getJsonLdItems(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return scripts.flatMap(([, jsonText]) => {
    try {
      return flattenJsonLd(JSON.parse(decodeEntities(jsonText.trim())));
    } catch {
      return [];
    }
  });
}

function flattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const graph = Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJsonLd) : [];
  return [value, ...graph];
}

function findMovieData(items) {
  return items.find((item) => hasType(item, "Movie")) || items.find((item) => hasType(item, "CreativeWork") || hasType(item, "TVSeries")) || {};
}

function hasType(item, type) {
  const itemType = item["@type"];
  return Array.isArray(itemType) ? itemType.includes(type) : itemType === type;
}

function extractReleaseDateFromHtml(html) {
  return extractDateNearLabels(html, ["劇場公開日", "公開日", "公開"]);
}

function extractReleaseEndDateFromHtml(html) {
  return extractDateNearLabels(html, ["公開終了日", "上映終了日", "上映終了", "終映日", "終映"]);
}

function extractDateNearLabels(html, labels) {
  const text = cleanText(html);
  for (const label of labels) {
    const index = text.indexOf(label);
    if (index < 0) continue;
    const nearby = text.slice(index, index + 90);
    const date = nearby.match(/((?:19|20)\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (date) return date[0];
    const iso = nearby.match(/\b((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (iso) return iso[0];
  }
  return "";
}

function extractGenreFromHtml(html) {
  const compact = html.replace(/\s+/g, " ");
  const patterns = [
    /ジャンル<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i,
    /<dt[^>]*>\s*ジャンル\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
    /<th[^>]*>\s*ジャンル\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i,
  ];
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    const genre = normalizeGenreText(match?.[1]);
    if (genre) return genre;
  }
  return "";
}

function inferGenre(text) {
  const value = cleanText(text);
  const rules = [
    ["SF", /SF|宇宙|惑星|未来|タイムトラベル|ロボット|AI|人工知能|エイリアン|ディストピア/i],
    ["ホラー", /ホラー|恐怖|怪奇|幽霊|悪霊|ゾンビ|殺人鬼|惨劇/i],
    ["サスペンス", /サスペンス|ミステリー|謎|事件|殺人|捜査|失踪|陰謀|スリラー/i],
    ["アクション", /アクション|格闘|銃撃|戦闘|爆破|復讐|スパイ|追跡/i],
    ["恋愛", /恋愛|ラブストーリー|恋人|初恋|ロマンス|結婚|愛を描/i],
    ["コメディ", /コメディ|笑い|ユーモア|騒動|ドタバタ/i],
    ["ドキュメンタリー", /ドキュメンタリー|記録映画|密着|実録/i],
    ["アニメ", /アニメ|アニメーション/i],
    ["ファンタジー", /ファンタジー|魔法|冒険|神話|異世界/i],
    ["ドラマ", /ドラマ|人生|家族|成長|葛藤|人間模様|奮闘/i],
  ];
  return rules.filter(([, pattern]) => pattern.test(value)).map(([genre]) => genre).slice(0, 2).join(" / ");
}

function normalizeGenreText(value) {
  return cleanText(value).replace(/ジャンル/g, "").split(/[,、/／｜|]/).map((item) => cleanText(item)).filter(Boolean).slice(0, 3).join(" / ");
}

function normalizePeople(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(normalizePeople).filter(Boolean).join(", ");
  if (typeof value === "object") return cleanText(value.name || "");
  return cleanText(value);
}

function normalizeList(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.map((item) => cleanText(item.name || item)).filter(Boolean).join(" / ");
  return cleanText(value);
}

function normalizeImageUrl(value, sourceUrl) {
  const raw = firstImageValue(value);
  if (!raw) return "";
  try {
    return new URL(cleanText(raw), sourceUrl).href;
  } catch {
    return "";
  }
}

function firstImageValue(value) {
  if (!value) return "";
  if (Array.isArray(value)) return firstImageValue(value[0]);
  if (typeof value === "object") return value.url || value.contentUrl || "";
  return value;
}

function normalizeDateValue(value) {
  const raw = cleanText(value);
  if (!raw) return "";
  const isoDate = raw.match(/\b((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoDate) return [isoDate[1], isoDate[2].padStart(2, "0"), isoDate[3].padStart(2, "0")].join("-");
  const japaneseDate = raw.match(/((?:19|20)\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (japaneseDate) return [japaneseDate[1], japaneseDate[2].padStart(2, "0"), japaneseDate[3].padStart(2, "0")].join("-");
  return "";
}

function extractYear(value) {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function getTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]) : "";
}

function getAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = tag.match(pattern);
  return match ? match[1] : "";
}

function cleanTitle(value) {
  return cleanText(value)
    .replace(/[|｜].*$/u, "")
    .replace(/\s*[-–—]\s*(映画|Movie|Filmarks|IMDb|Rotten Tomatoes|Netflix|Amazon|20世紀スタジオ|公式).*$/iu, "")
    .replace(/[（(]\s*(大ヒット上映中|絶賛上映中|上映中|公開中|近日公開)\s*[）)]/gu, "")
    .trim();
}

function titleMatchScore(query, label) {
  const normalizedQuery = normalizeComparableTitle(query);
  const normalizedLabel = normalizeComparableTitle(label);
  if (!normalizedLabel) return 0;
  if (normalizedLabel === normalizedQuery) return 100;
  if (normalizedLabel.includes(normalizedQuery)) return 80;
  if (normalizedQuery.includes(normalizedLabel)) return 60;
  return 10;
}

function normalizeComparableTitle(value) {
  return cleanTitle(value).replace(/[\s　:：・.。!！?？'"“”‘’「」『』()[\]（）【】]/g, "").toLowerCase();
}

function normalizeHref(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return "";
  }
}

function isMoviePageUrl(url) {
  return /^https?:\/\/(?:www\.)?(?:eiga\.com|cinema\.eiga\.com)\/movie\/\d+\/?/i.test(url);
}

function isSameUrl(first, second) {
  try {
    return new URL(first).href === new URL(second).href;
  } catch {
    return first === second;
  }
}

function cleanText(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function serveStatic(requestUrl, response) {
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.resolve(ROOT, `.${decodeURIComponent(pathname)}`);
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(content);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}
