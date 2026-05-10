const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const Busboy = require("busboy");

const PORT = Number(process.env.PORT) || 5173;
const HOST = "0.0.0.0";
const ROOT = __dirname;
loadEnvFile(path.join(ROOT, ".env"));
const BASIC_AUTH_USER = cleanText(process.env.BASIC_AUTH_USER || "");
const BASIC_AUTH_PASS = cleanText(process.env.BASIC_AUTH_PASS || "");

const MAX_HTML_BYTES = 2_000_000;
const TMDB_API_KEY = process.env.TMDB_API_KEY || "319d2750f37dd5ce55ad5a38afff96ff";
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500/";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const geminiClients = initializeGeminiClients({
  apiKey: GEMINI_API_KEY,
  defaultModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  models: {
    analyze: process.env.GEMINI_ANALYZE_MODEL,
    mentor: process.env.GEMINI_MENTOR_MODEL,
  },
});
const MAX_JSON_BYTES = 1_000_000;
const scriptDbFetchSessions = new Map();
const SCRIPT_DB_SESSION_TTL_MS = 30 * 60 * 1000;

const ANALYZE_BEAT_TEMPLATE = [
  { id: "opening_image",          name: "Opening Image",          label: "オープニング・イメージ", ratio: 0.01, range: [0, 0.01] },
  { id: "theme_stated",           name: "Theme Stated",           label: "テーマの提示",           ratio: 0.05, range: [0.04, 0.06] },
  { id: "setup",                  name: "Set-Up",                 label: "セットアップ",           ratio: 0.1,  range: [0.01, 0.1] },
  { id: "catalyst",               name: "Catalyst",               label: "カタリスト",             ratio: 0.12, range: [0.11, 0.13] },
  { id: "debate",                 name: "Debate",                 label: "ディベート",             ratio: 0.2,  range: [0.12, 0.25] },
  { id: "break_into_two",         name: "Break into Two",         label: "第二幕への突入",         ratio: 0.25, range: [0.24, 0.26] },
  { id: "b_story",                name: "B Story",                label: "Bストーリー",            ratio: 0.3,  range: [0.29, 0.31] },
  { id: "fun_and_games",          name: "Fun and Games",          label: "お楽しみ",               ratio: 0.4,  range: [0.25, 0.5] },
  { id: "midpoint",               name: "Midpoint",               label: "ミッドポイント",         ratio: 0.5,  range: [0.49, 0.51] },
  { id: "bad_guys_close_in",      name: "Bad Guys Close In",      label: "迫り来る悪化",           ratio: 0.65, range: [0.5, 0.75] },
  { id: "all_is_lost",            name: "All Is Lost",            label: "全てを失って",           ratio: 0.75, range: [0.74, 0.76] },
  { id: "dark_night_of_the_soul", name: "Dark Night of the Soul", label: "心の暗闇",               ratio: 0.8,  range: [0.75, 0.8] },
  { id: "break_into_three",       name: "Break into Three",       label: "第三幕への突入",         ratio: 0.85, range: [0.84, 0.86] },
  { id: "finale",                 name: "Finale",                 label: "フィナーレ",             ratio: 0.95, range: [0.85, 0.99] },
  { id: "final_image",            name: "Final Image",            label: "ファイナル・イメージ",   ratio: 1,    range: [0.99, 1] },
];

const ANALYZE_EXTRACT_SYSTEM_INSTRUCTION = [
  "あなたはSAVE THE CAT / Blake Snyder Beat Sheet 理論に基づく脚本構造解析エンジンです。",
  "入力された脚本テキストから、物語の核を理解したうえで、ログライン・15ビート構造・各ビートの脚本内位置を分析します。",
  "各ビートは単なる時系列要約ではなく、物語構造上の役割として判定します。",
  "出力は有効なJSONのみです。Markdown、コードフェンス、説明文、前置き、結論文を含めません。",
  "",
  "Step 1: 物語コア（storyCore）を抽出。protagonist, goal, mainConflict, stakes, theme, ironyOrHook を含める。",
  "Step 2: storyCoreを基盤に SAVE THE CAT 的 high concept のログライン（日本語・50〜120文字）を生成。",
  "  - あらすじ禁止。主人公・目的・最大の障害を含める。結末ネタバレ禁止。",
  "Step 3: 15ビートを物語構造上の役割として判定し、各ビートについて以下を出力。",
  "  actualTime: 脚本本文の物理的位置から推測した時刻（hh:mm:ss）。",
  "    ページ番号がある場合は 1ページ≒1分 を基準に算出。",
  "    ページ番号がない場合は 脚本全体に対する位置割合 × runtimeMinutes で算出。",
  "    runtimeMinutes が不明な場合は総ページ数・総文字数から推定して算出。",
  "    理論値（theoreticalTime）を actualTime にコピーしてはいけない。",
  "    全ビートの actualTime が完全一致または均等間隔の場合は解析失敗とみなす。",
  "  scriptPositionPercent: 脚本内の位置割合（0〜100の数値）。",
  "  pageEstimate: 推定ページ数（整数）。",
  "  summary: そのビートで何が起きているかを日本語で具体的に説明。",
  "  structuralReason: なぜそのシーンがそのビートなのか、物語構造上の理由を日本語で説明。",
].join("\n");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) return;
    process.env[match[1]] = parseEnvValue(match[2]);
  });
}

function parseEnvValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const server = http.createServer(async (request, response) => {
  if (!authorizeRequest(request, response)) return;
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === "/api/extract") return handleExtract(requestUrl, response);
  if (requestUrl.pathname === "/api/search") return handleSearch(requestUrl, response);
  if (requestUrl.pathname === "/api/analyze/start") return handleAnalyzeStart(request, response);
  if (requestUrl.pathname === "/api/analyze/script-db/fetch") return handleScriptDbFetch(request, response);
  if (requestUrl.pathname === "/api/analyze/upload") return handleAnalyzeUpload(request, response);
  if (requestUrl.pathname === "/api/analyze/extract") return handleAnalyzeExtract(request, response);
  if (requestUrl.pathname === "/api/analyze/logline") return handleAnalyzeLogline(request, response);
  if (requestUrl.pathname === "/api/gemini/analyze") return handleGeminiAnalyze(request, response);
  if (requestUrl.pathname === "/api/gemini/mentor") return handleGeminiMentor(request, response);
  if (requestUrl.pathname === "/api/mentor/analyze") return handleMentorAnalyze(request, response);
  if (requestUrl.pathname === "/api/gemini-usage") return handleGeminiUsage(request, response);
  serveStatic(requestUrl, response);
});

server.listen(PORT, HOST, () => {
  console.log(`N Script is running at http://localhost:${PORT}/index.html`);
  console.log(`Using Gemini model: ${process.env.GEMINI_MODEL || "gemini-2.5-flash"} (analyze: ${process.env.GEMINI_ANALYZE_MODEL || "gemini-2.5-flash"}, mentor: ${process.env.GEMINI_MENTOR_MODEL || "gemini-2.5-flash"})`);
});

function authorizeRequest(request, response) {
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASS) return true;
  const authHeader = String(request.headers.authorization || "");
  if (!authHeader.startsWith("Basic ")) {
    sendUnauthorized(response);
    return false;
  }
  const encoded = authHeader.slice("Basic ".length).trim();
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    sendUnauthorized(response);
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) {
    sendUnauthorized(response);
    return false;
  }
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  if (username !== BASIC_AUTH_USER || password !== BASIC_AUTH_PASS) {
    sendUnauthorized(response);
    return false;
  }
  return true;
}

function sendUnauthorized(response) {
  response.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="N Script Private", charset="UTF-8"',
    "content-type": "text/plain; charset=utf-8",
  });
  response.end("Authentication required.");
}

async function handleExtract(requestUrl, response) {
  const sourceUrl = requestUrl.searchParams.get("url");
  if (!sourceUrl) return sendJson(response, 400, { error: "URLが指定されていません。" });
  const normalized = normalizeInput(sourceUrl);
  try {
    const tmdbResult = await fetchFromTmdb(normalized);
    if (tmdbResult) return sendJson(response, 200, tmdbResult);
  } catch (error) {
    console.warn(`TMDb取得に失敗しました: ${error.message}`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return sendJson(response, 404, { error: "TMDbで該当作品を見つけられませんでした。" });
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
  const tmdbId = cleanText(requestUrl.searchParams.get("tmdbId") || "");
  if (tmdbId) {
    try {
      const result = await fetchFromTmdb({ type: "tmdb_id", value: tmdbId });
      if (!result) return sendJson(response, 404, { error: "TMDbで該当作品を見つけられませんでした。" });
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 502, { error: `TMDb詳細取得に失敗しました: ${error.message}` });
    }
  }

  const title = cleanText(requestUrl.searchParams.get("title") || "");
  if (!title) return sendJson(response, 400, { error: "タイトルが指定されていません。" });
  try {
    let tmdbResult = null;
    try {
      const candidates = await searchTmdbMovieCandidates(title);
      if (candidates.length > 1) return sendJson(response, 200, { candidates });
      if (candidates.length === 1) tmdbResult = await fetchFromTmdb({ type: "tmdb_id", value: candidates[0].tmdbId });
    } catch (error) {
      console.warn(`TMDb検索に失敗しました: ${error.message}`);
    }
    const result = tmdbResult || await searchFallbackMovie(title);
    if (!result) return sendJson(response, 404, { error: "TMDbまたは映画.comで該当作品を見つけられませんでした。" });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 502, { error: `タイトル検索に失敗しました: ${error.message}` });
  }
}

function purgeScriptDbSessions() {
  const now = Date.now();
  for (const [id, row] of scriptDbFetchSessions) {
    if (now - row.createdAt > SCRIPT_DB_SESSION_TTL_MS) scriptDbFetchSessions.delete(id);
  }
}

function storeScriptDbSession({ text, sourceUrl, title }) {
  purgeScriptDbSessions();
  const id = randomUUID();
  scriptDbFetchSessions.set(id, {
    text: String(text || ""),
    sourceUrl: cleanText(sourceUrl || ""),
    title: cleanText(title || ""),
    createdAt: Date.now(),
  });
  return id;
}

function takeScriptDbSession(id) {
  purgeScriptDbSessions();
  const key = cleanText(id);
  if (!key) return null;
  const row = scriptDbFetchSessions.get(key);
  if (!row) return null;
  scriptDbFetchSessions.delete(key);
  return row;
}

async function handleScriptDbFetch(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "POSTでリクエストしてください。" });
  try {
    const payload = await readJsonBody(request);
    const title = cleanText(payload.title || "");
    if (!title) return sendJson(response, 400, { error: "タイトルを指定してください。" });
    const originalTitle = cleanText(payload.originalTitle || "");
    const year = String(payload.year || "").replace(/\D/g, "").slice(0, 4);
    const fetched = await fetchScriptFromDatabase(title, { originalTitle, year });
    const scriptSessionId = storeScriptDbSession({
      text: fetched.text,
      sourceUrl: fetched.sourceUrl,
      title,
    });
    sendJson(response, 200, {
      scriptSessionId,
      sourceUrl: fetched.sourceUrl,
      textLength: fetched.text.length,
      title,
    });
  } catch (error) {
    sendJson(response, error.statusCode || 502, { error: error.message || "脚本DBからの取得に失敗しました。" });
  }
}

async function handleAnalyzeExtract(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "POSTでリクエストしてください。" });
  return handleAnalyzeStart(request, response);
}

async function handleAnalyzeStart(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "POSTでリクエストしてください。" });
  let theoryBeats = [];
  try {
    const payload = await readJsonBody(request);
    let sourceText = cleanText(payload.sourceText || payload.text || payload.script || "");
    const scriptSessionId = cleanText(payload.scriptSessionId || "");
    const videoData = normalizeVideoAnalysisPayload(payload.videoData || payload.videoAnalysis || payload.timeline);
    const sourceType = normalizeAnalyzeSourceType(payload.source_type || payload.sourceType || (videoData ? "video" : sourceText ? "script" : "manual"));
    let title = cleanText(payload.title || "");
    let runtimeMinutes = normalizeRuntimeMinutes(payload.runtimeMinutes || payload.runtime || payload.durationMinutes);
    if (sourceType === "script" && title && !runtimeMinutes) {
      const tmdbInfo = await fetchFromTmdb(normalizeInput(title)).catch(() => null);
      runtimeMinutes = normalizeRuntimeMinutes(tmdbInfo?.runtime);
      title = title || tmdbInfo?.title || "";
    }
    theoryBeats = calculateBeatTheory(runtimeMinutes);
    if (sourceType === "manual") {
      return sendJson(response, 200, buildManualAnalyzeResponse({ title, runtimeMinutes, theoryBeats, sourceType }));
    }
    let sourceMeta = buildAnalyzeSourceMeta(sourceType);
    if (sourceType === "script" && scriptSessionId) {
      const session = takeScriptDbSession(scriptSessionId);
      if (!session) {
        const error = new Error("脚本の取得セッションが無効または期限切れです。もう一度「脚本DBから取得」を実行してください。");
        error.statusCode = 400;
        throw error;
      }
      sourceText = session.text;
      if (!title) title = session.title;
      sourceMeta = buildAnalyzeSourceMeta(sourceType, { method: "script_db", sourceUrl: session.sourceUrl });
    } else if (sourceType === "script" && !sourceText) {
      const fetchedScript = await fetchScriptFromDatabase(title);
      sourceText = fetchedScript.text;
      sourceMeta = buildAnalyzeSourceMeta(sourceType, { method: "script_db", sourceUrl: fetchedScript.sourceUrl });
    } else if (sourceType === "script") {
      sourceMeta = buildAnalyzeSourceMeta(sourceType, { method: "file_upload" });
    }
    if (sourceType === "video" && !videoData && !sourceText) {
      return sendJson(response, 400, { error: "videoでは動画解析データまたは文字起こしを指定してください。" });
    }
    const result = await geminiClients.analyze.generate({
      systemInstruction: ANALYZE_EXTRACT_SYSTEM_INSTRUCTION,
      prompt: buildAnalyzeExtractPrompt({ title, runtimeMinutes, sourceText }),
      temperature: 0,
      responseMimeType: "application/json",
    });
    sendJson(response, 200, buildAnalyzeExtractionResponse({ title, runtimeMinutes, sourceType, theoryBeats, result, sourceMeta }));
  } catch (error) {
    sendJson(response, error.statusCode || 502, {
      error: error.message || "Gemini解析に失敗しました。",
      beats: theoryBeats.map((beat) => ({ ...beat, actual: emptyActualBeat() })),
    });
  }
}

async function handleAnalyzeUpload(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "POSTでリクエストしてください。" });
  const contentType = String(request.headers["content-type"] || "");
  if (!contentType.includes("multipart/form-data")) {
    return sendJson(response, 415, { error: "multipart/form-data でアップロードしてください。" });
  }

  try {
    const { fileBuffer, fileName, mimeType, fields } = await readMultipartFile(request, {
      maxBytes: 15_000_000,
      fieldName: "file",
    });
    if (!fileBuffer?.length) return sendJson(response, 400, { error: "ファイルが指定されていません。" });

    const text = await extractTextFromUpload({ fileBuffer, fileName, mimeType });
    const title = cleanText(fields.title || "") || cleanText(stripExtension(fileName)) || "";
    return sendJson(response, 200, { text: cleanText(text), title, fileName });
  } catch (error) {
    return sendJson(response, error.statusCode || 502, { error: error.message || "ファイルの解析に失敗しました。" });
  }
}

async function handleGeminiAnalyze(request, response) {
  return handleAnalyzeStart(request, response);
}

async function handleAnalyzeLogline(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "POSTでリクエストしてください。" });
  try {
    const payload = await readJsonBody(request);
    const title = cleanText(payload.title || "");
    const beats = Array.isArray(payload.beats) ? payload.beats : [];
    const sourceText = beats
      .map((beat, index) => {
        const label = cleanText(beat.label || beat.name || `Beat ${index + 1}`);
        const summary = cleanText(beat.summary || beat.actual?.summary || beat.content || "");
        return summary ? `${index + 1}. ${label}: ${summary}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (!sourceText) return sendJson(response, 400, { error: "ログライン生成に使う15ビートメモを入力してください。" });
    const result = await geminiClients.analyze.generate({
      systemInstruction: [
        "あなたは映画分析メモからログラインだけを生成するデータ整形エンジンです。",
        "主観的な批評、助言、前置き、Markdownを出力しません。",
        "主人公、目的、障害が分かる100文字前後の日本語ログラインを1つだけ返します。",
        "出力はJSONのみです。",
      ].join("\n"),
      prompt: [
        title ? `作品名: ${title}` : "",
        "以下の15ビートメモからログラインを生成してください。",
        "返却JSONスキーマ: {\"logline\":\"string\"}",
        sourceText,
      ].filter(Boolean).join("\n\n"),
      temperature: 0.25,
      responseMimeType: "application/json",
    });
    const logline = cleanText(result.json?.logline || result.text);
    sendJson(response, 200, { logline, model: result.model, usage: result.usage });
  } catch (error) {
    sendJson(response, error.statusCode || 502, { error: error.message || "ログライン生成に失敗しました。" });
  }
}

async function fetchScriptFromDatabase(title, { originalTitle = "", year = "" } = {}) {
  const normalizedTitle = cleanText(title);
  if (!normalizedTitle) {
    const error = new Error("Script解析には映画タイトル、または脚本ファイルが必要です。");
    error.statusCode = 400;
    throw error;
  }
  const titleInfo = { title: normalizedTitle, originalTitle, year };
  const triedUrls = [];
  const providers = [
    { key: "scriptslug", fetch: fetchScriptFromScriptSlug },
    { key: "imsdb", fetch: fetchScriptFromImsdb },
    { key: "dailyscript", fetch: fetchScriptFromDailyScript },
  ];
  for (const provider of providers) {
    try {
      const found = await provider.fetch(titleInfo, triedUrls);
      if (found?.text) {
        console.log(`[script-db] ✓ ${provider.key}: ${found.sourceUrl}`);
        return { text: found.text, sourceUrl: found.sourceUrl };
      }
      console.log(`[script-db] ✗ ${provider.key}: 脚本テキストなし`);
    } catch (err) {
      console.log(`[script-db] ✗ ${provider.key}: ${err.message}`);
    }
  }
  console.log(
    `[script-db] 全プロバイダー失敗 | title="${normalizedTitle}" originalTitle="${originalTitle}" year="${year}" | 試したURL(${triedUrls.length}件): ${triedUrls.join(", ")}`,
  );
  const error = new Error("脚本DBから脚本を取得できませんでした。脚本ファイルをアップロードしてください。");
  error.statusCode = 404;
  throw error;
}

async function fetchScriptFromScriptSlug(titleInfo, triedUrls) {
  const candidates = buildScriptSlugUrls(titleInfo);
  for (const sourceUrl of candidates) {
    triedUrls?.push(sourceUrl);
    try {
      const html = await fetchText(sourceUrl);
      const textFromPage = extractGenericScriptText(html);
      if (textFromPage) return { text: textFromPage, sourceUrl };
      const pdfUrl = extractScriptSlugPdfUrl(html, sourceUrl);
      if (!pdfUrl) continue;
      const textFromPdf = await extractTextFromPdfUrl(pdfUrl);
      if (textFromPdf) return { text: textFromPdf, sourceUrl: pdfUrl };
    } catch {
      // Continue to next candidate.
    }
  }
  return null;
}

async function fetchScriptFromImsdb(titleInfo, triedUrls) {
  const candidates = buildImsdbScriptUrls(titleInfo);
  for (const sourceUrl of candidates) {
    triedUrls?.push(sourceUrl);
    try {
      const html = await fetchText(sourceUrl);
      const scriptText = extractImsdbScriptText(html);
      if (scriptText) return { text: scriptText, sourceUrl };
    } catch {
      // Continue to next candidate.
    }
  }
  return null;
}

async function fetchScriptFromDailyScript(titleInfo, triedUrls) {
  const candidates = buildDailyScriptUrls(titleInfo);
  for (const sourceUrl of candidates) {
    triedUrls?.push(sourceUrl);
    try {
      if (sourceUrl.endsWith(".pdf")) {
        const textFromPdf = await extractTextFromPdfUrl(sourceUrl);
        if (textFromPdf) return { text: textFromPdf, sourceUrl };
        continue;
      }
      const text = await fetchText(sourceUrl);
      const normalizedText = sourceUrl.endsWith(".txt")
        ? cleanText(text)
        : extractGenericScriptText(text) || cleanText(text);
      if (normalizedText && normalizedText.length > 1000) return { text: normalizedText, sourceUrl };
    } catch {
      // Continue to next candidate.
    }
  }
  return null;
}

async function fetchText(url) {
  const response = await fetchHtmlPage(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return readLimitedText(response);
}

async function fetchBuffer(url) {
  const response = await fetchHtmlPage(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
}

function buildScriptTitleVariants({ title, originalTitle = "", year = "" }) {
  const candidates = new Set();
  function addVariants(raw) {
    const base = cleanText(raw).replace(/[：:]/g, " ").replace(/\s+/g, " ").trim();
    if (!base) return;
    candidates.add(base);
    candidates.add(toTitleCase(base));
    candidates.add(base.replace(/\bpart\b/ig, "Part"));
    candidates.add(base.replace(/\bthe\b/ig, "The"));
    candidates.add(base.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim());
    if (year) {
      candidates.add(`${base} ${year}`);
      candidates.add(`${toTitleCase(base)} ${year}`);
    }
  }
  addVariants(title);
  if (originalTitle && normalizeComparableTitle(originalTitle) !== normalizeComparableTitle(title)) {
    addVariants(originalTitle);
  }
  return [...candidates].filter(Boolean);
}

function buildScriptSlugUrls(titleInfo) {
  const variants = buildScriptTitleVariants(titleInfo);
  const slugs = new Set();
  for (const v of variants) {
    const slug = v.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (slug) slugs.add(slug);
  }
  return [...slugs].map((slug) => `https://www.scriptslug.com/script/${slug}`);
}

function buildImsdbScriptUrls(titleInfo) {
  const variants = buildScriptTitleVariants(titleInfo);
  return [...new Set(variants.filter(Boolean))]
    .map((value) => `https://imsdb.com/scripts/${encodeURIComponent(value).replace(/%20/g, "-")}.html`);
}

function buildDailyScriptUrls(titleInfo) {
  const variants = buildScriptTitleVariants(titleInfo);
  const extensions = [".html", ".txt", ".pdf"];
  return [...new Set(variants.filter(Boolean))]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .flatMap((value) => {
      const encoded = encodeURIComponent(value).replace(/%20/g, "%20");
      const dashed = encodeURIComponent(value.replace(/\s+/g, "-"));
      const underscored = encodeURIComponent(value.replace(/\s+/g, "_"));
      return extensions.flatMap((ext) => [
        `https://www.dailyscript.com/scripts/${encoded}${ext}`,
        `https://www.dailyscript.com/scripts/${dashed}${ext}`,
        `https://www.dailyscript.com/scripts/${underscored}${ext}`,
      ]);
    });
}

function toTitleCase(value) {
  return value.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function extractImsdbScriptText(html) {
  const bodyMatch = html.match(/<td[^>]*class=["']scrtext["'][^>]*>([\s\S]*?)<\/td>/i)
    || html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
    || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return "";
  const text = decodeEntities(stripHtml(bodyMatch[1]))
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 1000 ? text : "";
}

function extractGenericScriptText(html) {
  const bodyMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
    || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return "";
  const text = decodeEntities(stripHtml(bodyMatch[1]))
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 1000 ? text : "";
}

function extractScriptSlugPdfUrl(html, baseUrl) {
  const directMatch = html.match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i);
  if (!directMatch) return "";
  return normalizeHref(directMatch[1], baseUrl);
}

async function extractTextFromPdfUrl(url) {
  if (!url) return "";
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ url });
  const result = await parser.getText();
  return cleanText(result?.text || "");
}

async function extractTextFromPdfBuffer(buffer) {
  if (!buffer?.length) return "";
  const tmpPath = path.join(os.tmpdir(), `nscript-${randomUUID()}.pdf`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    return await extractTextFromPdfUrl(`file://${tmpPath}`);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function stripExtension(fileName) {
  return String(fileName || "").replace(/\.[^.]+$/, "");
}

function readMultipartFile(request, { maxBytes = 10_000_000, fieldName = "file" } = {}) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fileSize: maxBytes,
        files: 1,
      },
    });

    const fields = {};
    let fileBuffer = Buffer.alloc(0);
    let fileName = "";
    let mimeType = "";
    let fileReceived = false;

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, stream, info) => {
      if (name !== fieldName) {
        stream.resume();
        return;
      }
      fileReceived = true;
      fileName = info?.filename || "";
      mimeType = info?.mimeType || "";
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => {
        const error = new Error(`ファイルサイズが大きすぎます（最大 ${Math.round(maxBytes / 1_000_000)}MB）。`);
        error.statusCode = 413;
        reject(error);
      });
      stream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("error", (error) => {
      const wrapped = new Error(error.message || "アップロードの読み取りに失敗しました。");
      wrapped.statusCode = 400;
      reject(wrapped);
    });

    busboy.on("finish", () => {
      if (!fileReceived) return resolve({ fields, fileBuffer: Buffer.alloc(0), fileName: "", mimeType: "" });
      resolve({ fields, fileBuffer, fileName, mimeType });
    });

    request.pipe(busboy);
  });
}

async function extractTextFromUpload({ fileBuffer, fileName, mimeType }) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  const normalizedMime = String(mimeType || "").toLowerCase();

  if ([".txt", ".md", ".fountain", ".fdx"].includes(ext) || normalizedMime.startsWith("text/")) {
    return fileBuffer.toString("utf8");
  }

  if (ext === ".rtf" || normalizedMime.includes("rtf")) {
    return fileBuffer.toString("utf8");
  }

  if (ext === ".pdf" || normalizedMime === "application/pdf") {
    const module = await import("pdf-parse");
    const parser = module.default || module;
    const result = await parser(fileBuffer);
    return result?.text || "";
  }

  if (ext === ".docx" || normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result?.value || "";
  }

  if (ext === ".pptx" || normalizedMime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    const tempPath = path.join(os.tmpdir(), `nreel-upload-${Date.now()}-${Math.random().toString(16).slice(2)}.pptx`);
    fs.writeFileSync(tempPath, fileBuffer);
    try {
      const PptxParser = require("node-pptx-parser").default;
      const parser = new PptxParser(tempPath);
      const slides = await parser.extractText();
      const lines = (slides || []).flatMap((slide) => slide.text || []);
      return lines.join("\n");
    } finally {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }

  const error = new Error("未対応のファイル形式です。txt / md / pdf / docx / pptx を指定してください。");
  error.statusCode = 415;
  throw error;
}

async function handleGeminiMentor(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "POSTでリクエストしてください。" });
  try {
    const payload = await readJsonBody(request);
    const sourceText = cleanText(payload.sourceText || payload.text || payload.script || "");
    const title = cleanText(payload.title || "");
    if (!sourceText) return sendJson(response, 400, { error: "査定する脚本・企画本文が指定されていません。" });
    const result = await geminiClients.mentor.generate({
      systemInstruction: [
        "あなたは世界市場で勝てる映像企画を査定するプロデューサー兼脚本メンターです。",
        "作品を商品として厳しく評価し、GO / REWRITE / PASS のいずれかで判定してください。",
        "人格攻撃はせず、改善可能な打ち手を具体的に示してください。",
      ].join("\n"),
      prompt: [
        title ? `企画名: ${title}` : "",
        "以下の企画・脚本を査定してください。",
        "返却JSONのキー: verdict, score, marketPotential, coreProblem, strengths, rewritePriorities, pitchQuestions",
        sourceText,
      ].filter(Boolean).join("\n\n"),
      temperature: 0.45,
      responseMimeType: "application/json",
    });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 502, { error: error.message || "Gemini査定に失敗しました。" });
  }
}

// ── Mentor analysis ───────────────────────────────────────────────────────

const MENTOR_SYSTEM_INSTRUCTION = `あなたは映像企画の市場性・構造・感情設計を検閲する実戦型エグゼクティブ・プロデューサーです。
Jホラーを世界市場へ押し上げてきた経験則、国際共同制作、ライターズルームでの峻烈な合評知見を内部論理として持ちます。

あなたは「厳しいが、企画を通すために考えるプロデューサー」として振る舞います。
ダメ出し装置でも、褒め装置でもない。企画の弱点を発見し、「次に何を直すべきか」の方向を示す。

## 分析対象
完成脚本ではなく、企画・プロット開発段階のテキスト。
（ログライン、プロット、treatment、箱書き、企画書、アイデアメモなど）
短い素材からでも鋭く分析する。情報不足の項目は「情報不足」と明記し、その不足が企画として何を意味するかを指摘する。

## 出力フォーマット
以下のJSONのみ返してください（コードブロック不要）：
{
  "criticalIssues": [
    { "issue": "企画が最初に止まる理由（1〜2行、blunt）", "direction": "どこを掘れば改善できるか（1〜2行。正解は書かない。方向のみ）" }
  ],
  "scores": {
    "marketability": 0から100の整数,
    "emotionalEngineering": 0から100の整数,
    "firstTenPages": 0から100の整数,
    "realityCheck": 0から100の整数,
    "structure": 0から100の整数
  },
  "analyses": {
    "marketability": "①市場性の検閲（100〜200字、短文・実務的）",
    "emotionalEngineering": "②感情設計の検閲（100〜200字、短文・実務的）",
    "firstTenPages": "③冒頭フックの検閲（100〜200字、短文・実務的）",
    "realityCheck": "④リアリティ検閲（100〜200字、短文・実務的）",
    "structure": "⑤構造検閲（100〜200字、短文・実務的）"
  },
  "highConceptAnalysis": {
    "loglineStrength": "ログライン強度（50〜100字、短文）",
    "hook": "フック検閲（50〜100字、短文）",
    "marketFit": "市場フィット（50〜100字、短文）"
  },
  "boxOffice": {
    "targetAudience": "想定ターゲット層（短く）",
    "ageGender": "年齢層・性別分布（短く）",
    "domesticMarket": "国内市場性（1〜2行）",
    "globalPotential": "世界展開可能性（1〜2行）",
    "estimatedScale": "想定興行規模（例：単館系、10億〜50億円クラス等）"
  },
  "verdict": "GO" または "REWRITE" または "PASS",
  "verdictReason": "判定理由（100〜150字、短文・実務的）",
  "rewritePriorities": ["改善可能な事項1（短く）", "改善可能な事項2", "改善可能な事項3"],
  "firstFix": "REWRITE判定の場合のみ記入。最初に直すべき一点のみ（2〜4行、blunt、実務的）。GO/PASSは空文字",
  "interrogations": [
    {
      "type": "PRODUCER または SCREENWRITER または STREAMING EXEC または INTERNATIONAL SALES または MARKETING のいずれか",
      "question": "この企画の弱点に直結した具体的な質問（一般論禁止）",
      "reason": "なぜこの質問が飛んでくるか（1行、市場論・構造論で）"
    }
  ]
}

## 文体ルール（全フィールド共通）
- 短文。1文1意。
- blunt。遠回しにしない。
- 実務的。感情論なし。
- 禁止：「可能性を秘めている」「魅力的」「期待できる」「ポテンシャルがある」「素晴らしい」
- 問題を指摘した後、「どこを掘れば改善できるか」の方向を必ず示す（正解・代筆は不要）
- 悪い例：「主人公の欲求が弱い」で終わる
- 良い例：「主人公の欲求が弱い。"何を失いたくないのか"を具体化すると観客導線が強くなる」

## criticalIssues のルール
- 最大2件のみ。最も危険な問題だけ。
- 企画会議で最初に止まるポイント。
- issue：1〜2行、blunt。
- direction：正解を書かない。次に考える方向のみ。

## スコアリング基準（厳格に）
- marketability: ハイコンセプト強度、差別化、世界市場射程。類似作品と区別できない企画は50以下。
- emotionalEngineering: 感情設計（恐怖・緊張・笑い）、カタルシス、emotional hook精度。曖昧なら40以下。
- firstTenPages: 冒頭異常事態の強度、初動拘束力、reader retention。掴みが弱ければ40以下。
- realityCheck: 設定矛盾・Motivation整合性・世界ルール維持。ご都合主義が目立てば40以下。
- structure: 15ビート精度、Midpoint強度、第2幕密度。構造が見えない企画は35以下。

## 判定基準
- GO: 平均70以上かつ致命的欠陥なし。市場で今すぐ戦える水準。
- REWRITE: 欠陥あるが市場性の核がある。標準判定。
- PASS: 複数の致命的欠陥あり、改稿で解決できない構造的問題。

REWRITE が標準。GO は強い企画のみ。PASS も必要なら出す。

## 想定詰問（interrogations）のルール
5〜8個生成。

- typeは必ず以下のいずれか：PRODUCER / SCREENWRITER / STREAMING EXEC / INTERNATIONAL SALES / MARKETING
- 入力された企画の弱点に直結させる。一般論禁止。
- 口調はプロデューサー/ライターズルーム視点。人格攻撃なし。
- reason：1行、市場論・構造論で。

例：
{ "type": "PRODUCER", "question": "主人公が受動的すぎる。なぜ彼がこの事件に関わらなければならないか説明してください", "reason": "Motivation不足の企画は開発段階で止まる" }
{ "type": "STREAMING EXEC", "question": "1話ラストで次話再生されますか？そのフックはどこですか", "reason": "配信では継続視聴率が投資判断の最重要指標" }
{ "type": "INTERNATIONAL SALES", "question": "海外ポスターで何を見せますか。なぜ日本発である必要があるのか", "reason": "海外説明コストが高い企画は国際共同制作の対象から外れる" }

## 最終目標
これはAIによる肯定体験ではない。企画会議に近い圧力を再現し、ライターが会議前に弱点を発見・修正できる実戦訓練ツールとして機能すること。
厳しいが、企画を通すために考えるプロデューサーとして振る舞う。`;

function buildMentorPrompt({ title, sourceText }) {
  const lines = [];
  if (title) lines.push(`企画名・タイトル: ${title}`);
  lines.push("【企画テキスト】");
  lines.push(sourceText.slice(0, 60000));
  return lines.join("\n\n");
}

function normalizeMentorResponse(raw) {
  const scores = raw.scores || {};
  return {
    scores: {
      marketability: clampScore(scores.marketability),
      emotionalEngineering: clampScore(scores.emotionalEngineering),
      firstTenPages: clampScore(scores.firstTenPages),
      realityCheck: clampScore(scores.realityCheck),
      structure: clampScore(scores.structure),
    },
    analyses: {
      marketability: cleanText(raw.analyses?.marketability || ""),
      emotionalEngineering: cleanText(raw.analyses?.emotionalEngineering || ""),
      firstTenPages: cleanText(raw.analyses?.firstTenPages || ""),
      realityCheck: cleanText(raw.analyses?.realityCheck || ""),
      structure: cleanText(raw.analyses?.structure || ""),
    },
    highConceptAnalysis: {
      loglineStrength: cleanText(raw.highConceptAnalysis?.loglineStrength || ""),
      hook: cleanText(raw.highConceptAnalysis?.hook || ""),
      marketFit: cleanText(raw.highConceptAnalysis?.marketFit || ""),
    },
    boxOffice: {
      targetAudience: cleanText(raw.boxOffice?.targetAudience || ""),
      ageGender: cleanText(raw.boxOffice?.ageGender || ""),
      domesticMarket: cleanText(raw.boxOffice?.domesticMarket || ""),
      globalPotential: cleanText(raw.boxOffice?.globalPotential || ""),
      estimatedScale: cleanText(raw.boxOffice?.estimatedScale || ""),
    },
    criticalIssues: (Array.isArray(raw.criticalIssues) ? raw.criticalIssues : [])
      .map((item) => ({
        issue: cleanText(item?.issue || ""),
        direction: cleanText(item?.direction || ""),
      }))
      .filter((item) => item.issue)
      .slice(0, 2),
    verdict: ["GO", "REWRITE", "PASS"].includes(raw.verdict) ? raw.verdict : "REWRITE",
    verdictReason: cleanText(raw.verdictReason || ""),
    rewritePriorities: (Array.isArray(raw.rewritePriorities) ? raw.rewritePriorities : []).map(cleanText).filter(Boolean).slice(0, 6),
    firstFix: cleanText(raw.firstFix || ""),
    interrogations: (Array.isArray(raw.interrogations) ? raw.interrogations : [])
      .map((item) => ({
        type: cleanText(item?.type || ""),
        question: cleanText(item?.question || ""),
        reason: cleanText(item?.reason || ""),
      }))
      .filter((item) => item.question)
      .slice(0, 8),
  };
}

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

async function handleMentorAnalyze(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "POSTでリクエストしてください。" });
  try {
    let sourceText = "";
    let title = "";

    const contentType = request.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      const { fileBuffer, fileName, mimeType, fields } = await readMultipartFile(request, { maxBytes: 15_000_000, fieldName: "file" });
      title = cleanText(fields.title || "");
      sourceText = await extractTextFromUpload({ fileBuffer, fileName, mimeType });
    } else {
      const payload = await readJsonBody(request);
      title = cleanText(payload.title || "");
      sourceText = cleanText(payload.text || payload.sourceText || "");
    }

    if (!sourceText) return sendJson(response, 400, { error: "企画テキストまたはファイルを指定してください。" });

    const result = await geminiClients.mentor.generate({
      systemInstruction: MENTOR_SYSTEM_INSTRUCTION,
      prompt: buildMentorPrompt({ title, sourceText }),
      temperature: 0.4,
      responseMimeType: "application/json",
    });

    if (!result.json) {
      console.error("[Mentor] JSON parse failed. Raw text:", result.text?.slice(0, 500));
      const error = new Error("Geminiから有効なJSONが返されませんでした。");
      error.statusCode = 502;
      throw error;
    }

    sendJson(response, 200, normalizeMentorResponse(result.json));
  } catch (error) {
    sendJson(response, error.statusCode || 502, { error: error.message || "Mentor解析に失敗しました。" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function normalizeInput(value) {
  const raw = cleanText(value);
  const tmdbId = raw.match(/themoviedb\.org\/movie\/(\d+)/i)?.[1];
  return tmdbId ? { type: "tmdb_id", value: tmdbId } : { type: "query", value: raw };
}

// ── Gemini usage tracking ──────────────────────────────────────────────────
const USAGE_FILE = path.join(ROOT, ".gemini-usage.json");
const GEMINI_DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT) || 20;

function todayJst() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function loadGeminiUsage() {
  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf8");
    const data = JSON.parse(raw);
    if (data.date === todayJst()) return data;
  } catch { /* file missing or parse error */ }
  return { date: todayJst(), model: "", count: 0 };
}

function saveGeminiUsage(usage) {
  try { fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), "utf8"); } catch { /* ignore */ }
}

let geminiUsage = loadGeminiUsage();

function incrementGeminiUsage(model) {
  const today = todayJst();
  if (geminiUsage.date !== today) {
    geminiUsage = { date: today, model, count: 0 };
  }
  geminiUsage.model = model;
  geminiUsage.count += 1;
  saveGeminiUsage(geminiUsage);
}

function handleGeminiUsage(_request, response) {
  const today = todayJst();
  if (geminiUsage.date !== today) geminiUsage = { date: today, model: geminiUsage.model, count: 0 };
  sendJson(response, 200, {
    date: geminiUsage.date,
    model: geminiUsage.model,
    count: geminiUsage.count,
    limit: GEMINI_DAILY_LIMIT,
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function initializeGeminiClients({ apiKey, defaultModel, models = {} }) {
  return {
    analyze: createGeminiClient({ apiKey, model: models.analyze || defaultModel, purpose: "analyze" }),
    mentor: createGeminiClient({ apiKey, model: models.mentor || defaultModel, purpose: "mentor" }),
  };
}

function createGeminiClient({ apiKey, model, purpose }) {
  return {
    model,
    purpose,
    generate: (options) => callGemini({ ...options, apiKey, model }),
  };
}

async function callGemini({ apiKey, model, systemInstruction, prompt, temperature = 0.35, responseMimeType = "application/json" }) {
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY が設定されていません。環境変数にGemini APIキーを設定してください。");
    error.statusCode = 500;
    throw error;
  }
  const isThinkingModel = /gemini-2\.5|gemini-3/i.test(model);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  let response;
  try {
    response = await fetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          responseMimeType,
          ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini APIの取得に失敗しました。HTTP ${response.status}`);
  }
  const text = (payload.candidates?.[0]?.content?.parts || [])
    .filter((part) => !part.thought)
    .map((part) => part.text || "")
    .join("\n")
    .trim();
  incrementGeminiUsage(model);
  return {
    model,
    text,
    json: parseJsonText(text),
    usage: payload.usageMetadata || null,
  };
}

function parseJsonText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}

function buildAnalyzeExtractPrompt({ title, runtimeMinutes, sourceText }) {
  const beatList = ANALYZE_BEAT_TEMPLATE.map((b, i) =>
    `${i + 1}. ${b.name} / ${b.label}`
  ).join("\n");
  const schema = {
    logline: "string",
    storyCore: {
      protagonist: "string",
      goal: "string",
      mainConflict: "string",
      stakes: "string",
      theme: "string",
      ironyOrHook: "string",
    },
    beats: ANALYZE_BEAT_TEMPLATE.map((b, i) => ({
      number: i + 1,
      key: b.id,
      displayNameJa: b.label,
      displayNameEn: b.name,
      actualTime: "hh:mm:ss（脚本位置から推測）",
      scriptPositionPercent: "number (0-100)",
      pageEstimate: "integer",
      summary: "string（日本語）",
      structuralReason: "string（日本語）",
    })),
  };
  return [
    title ? `作品名: ${title}` : "",
    runtimeMinutes ? `上映時間: ${runtimeMinutes}分` : "上映時間: 不明（脚本のページ数・分量から推定すること）",
    "",
    "使用するビートリスト（必ずこの15件・この順番で出力すること）:",
    beatList,
    "",
    "返却JSONスキーマ:",
    JSON.stringify(schema, null, 2),
    "",
    "制約:",
    "- beats は必ず上記15件、同じ順番で返す。",
    "- actualTime は脚本本文の内容・位置・ページ相当から推測した現実的な時刻を入れる。絶対に理論値をコピーしない。",
    "- 全ビートの actualTime が完全一致または均等間隔の場合は解析失敗。",
    "- summary は具体的な内容（何が起きたか）を日本語で記述。",
    "- structuralReason はそのシーンが物語構造上その役割を担う理由を日本語で記述。",
    "- logline は storyCore と整合する内容にする。",
    "",
    "脚本テキスト:",
    sourceText || "",
  ].join("\n");
}

function buildManualAnalyzeResponse({ title, runtimeMinutes, theoryBeats, sourceType }) {
  return {
    title: title || null,
    runtimeMinutes: runtimeMinutes || null,
    sourceType,
    beats: theoryBeats.map((beat) => ({
      id: beat.id,
      name: beat.name,
      label: beat.label,
      theory: beat.theory,
      actual: emptyActualBeat(),
      diff: formatBeatDiff(null),
    })),
  };
}

function buildAnalyzeExtractionResponse({ title, runtimeMinutes, sourceType, theoryBeats, result, sourceMeta }) {
  const extractedBeats = Array.isArray(result.json?.beats) ? result.json.beats : [];
  const beats = theoryBeats.map((theoryBeat, index) => {
    const extracted = findExtractedBeat(extractedBeats, theoryBeat, index);
    const actual = normalizeActualBeat(extracted);
    const diffSeconds = computeBeatDiffSeconds(actual.startSeconds, theoryBeat.theory.targetSeconds);
    return {
      id: theoryBeat.id,
      name: theoryBeat.name,
      label: theoryBeat.label,
      theory: theoryBeat.theory,
      actual,
      diff: formatBeatDiff(diffSeconds),
    };
  });
  return {
    logline: cleanText(result.json?.logline || "") || null,
    storyCore: result.json?.storyCore || null,
    title: cleanText(result.json?.title || title) || null,
    runtimeMinutes: runtimeMinutes || null,
    sourceType,
    sourceMeta: buildAnalyzeSourceMeta(sourceType, sourceMeta),
    beats,
    model: result.model,
    usage: result.usage,
  };
}

function findExtractedBeat(extractedBeats, theoryBeat, index) {
  return extractedBeats.find((beat) => cleanText(beat.key || beat.beatId || beat.id) === theoryBeat.id)
    || extractedBeats.find((beat) => normalizeComparableTitle(beat.displayNameEn || beat.beatName || beat.name) === normalizeComparableTitle(theoryBeat.name))
    || extractedBeats[index]
    || null;
}

function computeBeatDiffSeconds(actualSeconds, theorySeconds) {
  if (!Number.isFinite(actualSeconds) || !Number.isFinite(theorySeconds)) return null;
  return Math.round(actualSeconds - theorySeconds);
}

function formatBeatDiff(diffSeconds) {
  if (!Number.isFinite(diffSeconds)) return { seconds: null, formatted: null };
  if (diffSeconds === 0) return { seconds: 0, formatted: "±0秒" };
  const abs = Math.abs(diffSeconds);
  const sign = diffSeconds > 0 ? "+" : "-";
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const formatted = h > 0
    ? `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${sign}${m}:${String(s).padStart(2, "0")}`;
  return { seconds: diffSeconds, formatted };
}

function calculateBeatTheory(runtimeMinutes) {
  const totalSeconds = Number.isFinite(runtimeMinutes) && runtimeMinutes > 0 ? Math.round(runtimeMinutes * 60) : null;
  return ANALYZE_BEAT_TEMPLATE.map((beat) => {
    const ratio = normalizeBeatRatio(beat.ratio);
    const startRatio = normalizeBeatRatio(beat.range?.[0] ?? ratio);
    const endRatio = normalizeBeatRatio(beat.range?.[1] ?? ratio);
    const startSeconds = totalSeconds === null ? null : Math.round(totalSeconds * startRatio);
    const targetSeconds = totalSeconds === null ? null : Math.round(totalSeconds * ratio);
    const endSeconds = totalSeconds === null ? null : Math.round(totalSeconds * endRatio);
    return {
      id: beat.id,
      name: beat.name,
      label: beat.label,
      theory: {
        ratio,
        startPercent: Math.round(startRatio * 10000) / 100,
        targetPercent: Math.round(ratio * 10000) / 100,
        endPercent: Math.round(endRatio * 10000) / 100,
        startSeconds,
        targetSeconds,
        endSeconds,
        startTime: formatTimestamp(startSeconds),
        targetTime: formatTimestamp(targetSeconds),
        endTime: formatTimestamp(endSeconds),
      },
    };
  });
}

function normalizeAnalyzeSourceType(value) {
  return ["manual", "script", "video"].includes(value) ? value : "manual";
}

function buildAnalyzeSourceMeta(sourceType, overrides = {}) {
  const normalizedType = normalizeAnalyzeSourceType(sourceType);
  const defaultMethod = normalizedType === "script" ? "script_db" : normalizedType;
  return {
    sourceType: normalizedType,
    method: cleanText(overrides.method || "") || defaultMethod,
    sourceUrl: cleanText(overrides.sourceUrl || "") || "",
    fileName: cleanText(overrides.fileName || "") || "",
  };
}

function normalizeBeatRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number > 1) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function normalizeActualBeat(value) {
  if (!value || typeof value !== "object") return emptyActualBeat();
  const startTime = normalizeTimestampValue(
    value.actualTime || value.startTime || value.start || value.startTimestamp
  );
  const endTime = normalizeTimestampValue(value.endTime || value.end || value.endTimestamp);
  const posPercent = Number(value.scriptPositionPercent);
  const pageEst = Number(value.pageEstimate);
  return {
    startTime,
    endTime,
    startSeconds: parseTimestampSeconds(startTime),
    endSeconds: parseTimestampSeconds(endTime),
    summary: cleanText(value.summary || value.content || value.description) || null,
    structuralReason: cleanText(value.structuralReason || "") || null,
    scriptPositionPercent: Number.isFinite(posPercent) ? posPercent : null,
    pageEstimate: Number.isFinite(pageEst) ? Math.round(pageEst) : null,
  };
}

function emptyActualBeat() {
  return {
    startTime: null,
    endTime: null,
    startSeconds: null,
    endSeconds: null,
    summary: null,
    structuralReason: null,
    scriptPositionPercent: null,
    pageEstimate: null,
  };
}

function normalizeRuntimeMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const match = cleanText(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeVideoAnalysisPayload(value) {
  if (!value) return "";
  if (typeof value === "string") return cleanText(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return cleanText(value);
  }
}

function normalizeTimestampValue(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const numeric = raw.match(/^\d+(?:\.\d+)?$/);
  if (numeric) return formatTimestamp(Number(numeric[0]));
  const clock = raw.match(/\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.\d+)?\b/);
  if (clock) return clock[0].split(".")[0];
  const minuteSecond = raw.match(/(\d{1,3})\s*分\s*(\d{1,2})?\s*秒?/);
  if (minuteSecond) return formatTimestamp(Number(minuteSecond[1]) * 60 + Number(minuteSecond[2] || 0));
  return raw;
}

function parseTimestampSeconds(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const rest = rounded % 60;
  const two = (number) => String(number).padStart(2, "0");
  return `${two(hours)}:${two(minutes)}:${two(rest)}`;
}

async function fetchFromTmdb(input) {
  if (!input.value) return null;
  const movieId = input.type === "tmdb_id" ? input.value : await searchTmdbMovie(input.value);
  if (!movieId) return null;
  const [details, providers, releaseDates] = await Promise.all([
    fetchTmdbJson(`/movie/${movieId}`, { language: "ja-JP", append_to_response: "credits" }),
    fetchTmdbJson(`/movie/${movieId}/watch/providers`),
    fetchTmdbJson(`/movie/${movieId}/release_dates`),
  ]);
  return mapTmdbMovie(details, providers, releaseDates, movieId);
}

async function searchTmdbMovie(query) {
  return (await searchTmdbMovieCandidates(query))[0]?.tmdbId || "";
}

async function searchTmdbMovieCandidates(query) {
  const seen = new Set();
  const candidates = [];
  for (const searchQuery of buildTmdbSearchQueries(query)) {
    for (const language of ["ja-JP", "en-US"]) {
      const data = await fetchTmdbJson("/search/movie", {
        language,
        query: searchQuery,
        include_adult: "false",
        page: "1",
      });
      for (const result of data.results || []) {
        const candidate = mapTmdbCandidate(result, language);
        if (!candidate.tmdbId || seen.has(candidate.tmdbId)) continue;
        seen.add(candidate.tmdbId);
        candidates.push({ ...candidate, score: titleMatchScore(query, `${candidate.title} ${candidate.originalTitle}`) });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 8).map(({ score, ...candidate }) => candidate);
}

function buildTmdbSearchQueries(query) {
  const raw = cleanText(query);
  const normalized = raw.normalize("NFKC");
  const compact = normalized.replace(/[「」『』【】（）()[\]・:：!！?？,，.。'"]/g, " ").replace(/\s+/g, " ").trim();
  return [...new Set([raw, normalized, compact].filter(Boolean))];
}

function mapTmdbCandidate(result, language = "") {
  const title = cleanTitle(result.title || result.original_title || "");
  const originalTitle = cleanTitle(result.original_title || "");
  return {
    tmdbId: String(result.id || ""),
    title,
    originalTitle: normalizeComparableTitle(originalTitle) === normalizeComparableTitle(title) ? "" : originalTitle,
    releaseDate: normalizeDateValue(result.release_date),
    year: extractYear(result.release_date),
    language: normalizeLanguageLabel(result.original_language),
    searchLanguage: language,
    overview: cleanText(result.overview),
    posterUrl: result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path.replace(/^\//, "")}` : "",
  };
}

function normalizeLanguageLabel(value) {
  const labels = { en: "英語", ja: "日本語", ko: "韓国語", zh: "中国語", fr: "フランス語", es: "スペイン語", it: "イタリア語", de: "ドイツ語" };
  const key = cleanText(value).toLowerCase();
  return labels[key] || key.toUpperCase();
}

async function fetchTmdbJson(pathname, params = {}) {
  const url = new URL(`${TMDB_API_BASE}${pathname}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`TMDb APIの取得に失敗しました。HTTP ${response.status}`);
  return response.json();
}

function mapTmdbMovie(details, providers, releaseDates, fallbackId) {
  if (!details) return null;
  const providerNames = providers?.results?.JP?.flatrate?.map((provider) => provider.provider_name).filter(Boolean) || [];
  const director = details.credits?.crew?.find((person) => person.job === "Director")?.name || "";
  const cast = details.credits?.cast?.slice(0, 5).map((person) => person.name).filter(Boolean).join(", ");
  const title = buildTmdbDisplayTitle(details);
  const sourceUrl = `https://www.themoviedb.org/movie/${details.id || fallbackId}`;
  return {
    tmdbId: String(details.id || fallbackId),
    title,
    overview: cleanText(details.overview),
    description: cleanText(details.overview),
    posterPath: details.poster_path || "",
    posterUrl: details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path.replace(/^\//, "")}` : "",
    runtime: Number.isInteger(details.runtime) ? details.runtime : "",
    releaseDate: getJapanReleaseDate(releaseDates) || normalizeDateValue(details.release_date),
    watchProviders: providerNames.join(", "),
    director,
    cast,
    genre: normalizeList(details.genres),
    sourceUrl,
    dataSource: "tmdb",
  };
}

function getJapanReleaseDate(releaseDates) {
  const releases = releaseDates?.results?.find((item) => item.iso_3166_1 === "JP")?.release_dates || [];
  const preferred = [3, 2, 1, 4, 5, 6]
    .map((type) => releases.find((release) => release.type === type && release.release_date))
    .find(Boolean);
  return normalizeDateValue(preferred?.release_date || releases.find((release) => release.release_date)?.release_date);
}

function buildTmdbDisplayTitle(details) {
  return cleanTitle(details.title || details.original_title || "");
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

async function searchFallbackMovie(title) {
  try {
    return await searchEigaCom(title);
  } catch (error) {
    console.warn(`映画.comバックアップ検索に失敗しました: ${error.message}`);
    return null;
  }
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

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.byteLength;
    if (total > MAX_JSON_BYTES) {
      const error = new Error("リクエスト本文が大きすぎます。");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("JSONの形式が正しくありません。");
    error.statusCode = 400;
    throw error;
  }
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
  const isoDate = raw.match(/\b((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})(?=\b|T)/);
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
  if (requestUrl.pathname.startsWith("/api/")) {
    return sendJson(response, 404, {
      error: "この API パスはサーバーにありません。`node server.js` を最新のコードで再起動しているか確認してください。",
    });
  }
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
