const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Busboy = require("busboy");

const PORT = Number(process.env.PORT) || 5173;
const HOST = "0.0.0.0";
const ROOT = __dirname;
loadEnvFile(path.join(ROOT, ".env"));

const MAX_HTML_BYTES = 2_000_000;
const TMDB_API_KEY = process.env.TMDB_API_KEY || "319d2750f37dd5ce55ad5a38afff96ff";
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500/";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const geminiClients = initializeGeminiClients({
  apiKey: GEMINI_API_KEY,
  defaultModel: process.env.GEMINI_MODEL || "gemini-1.5-pro-latest",
  models: {
    analyze: process.env.GEMINI_ANALYZE_MODEL,
    mentor: process.env.GEMINI_MENTOR_MODEL,
  },
});
const MAX_JSON_BYTES = 1_000_000;

const ANALYZE_BEAT_TEMPLATE = [
  { id: "opening_image", name: "Opening Image", label: "オープニング・イメージ", ratio: 0.01, range: [0, 0.01] },
  { id: "theme_stated", name: "Theme Stated", label: "テーマの提示", ratio: 0.05, range: [0.04, 0.06] },
  { id: "setup", name: "Set-Up", label: "セットアップ", ratio: 0.1, range: [0.01, 0.1] },
  { id: "catalyst", name: "Catalyst", label: "きっかけ", ratio: 0.12, range: [0.11, 0.13] },
  { id: "debate", name: "Debate", label: "悩み", ratio: 0.2, range: [0.12, 0.25] },
  { id: "break_into_two", name: "Break into Two", label: "第1ターニングポイント", ratio: 0.25, range: [0.24, 0.26] },
  { id: "b_story", name: "B Story", label: "Bストーリー", ratio: 0.3, range: [0.29, 0.31] },
  { id: "fun_and_games", name: "Fun and Games", label: "お楽しみ", ratio: 0.4, range: [0.25, 0.5] },
  { id: "midpoint", name: "Midpoint", label: "ミッドポイント", ratio: 0.5, range: [0.49, 0.51] },
  { id: "bad_guys_close_in", name: "Bad Guys Close In", label: "迫り来る悪", ratio: 0.65, range: [0.5, 0.75] },
  { id: "all_is_lost", name: "All Is Lost", label: "すべてを失って", ratio: 0.75, range: [0.74, 0.76] },
  { id: "dark_night_of_the_soul", name: "Dark Night of the Soul", label: "心の暗闇", ratio: 0.8, range: [0.75, 0.8] },
  { id: "break_into_three", name: "Break into Three", label: "第2ターニングポイント", ratio: 0.85, range: [0.84, 0.86] },
  { id: "finale", name: "Finale", label: "フィナーレ", ratio: 0.95, range: [0.85, 0.99] },
  { id: "final_image", name: "Final Image", label: "ファイナル・イメージ", ratio: 1, range: [0.99, 1] },
];

const ANALYZE_EXTRACT_SYSTEM_INSTRUCTION = [
  "あなたは映画・脚本解析用の精密なデータ抽出エンジンです。",
  "人格、感情、主観的評価、助言、批評、前置き、結論文を一切出力しません。",
  "入力された脚本テキスト、プロット、字幕、動画解析データから、15ビートに該当する箇所だけを抽出します。",
  "各ビートについて、実測の開始時間、実測の終了時間、その箇所で起きている具体的内容の短い要約のみを返します。",
  "タイムスタンプは入力内に根拠がある場合だけ抽出します。根拠がない場合は推測せず null にします。",
  "理論タイムはユーザー入力ではなく、バックエンドが渡す theory をそのまま保持します。変更、補正、再計算をしません。",
  "出力は有効なJSONのみです。Markdown、コードフェンス、説明文を含めません。",
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
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === "/api/extract") return handleExtract(requestUrl, response);
  if (requestUrl.pathname === "/api/search") return handleSearch(requestUrl, response);
  if (requestUrl.pathname === "/api/analyze/start") return handleAnalyzeStart(request, response);
  if (requestUrl.pathname === "/api/analyze/upload") return handleAnalyzeUpload(request, response);
  if (requestUrl.pathname === "/api/analyze/extract") return handleAnalyzeExtract(request, response);
  if (requestUrl.pathname === "/api/analyze/logline") return handleAnalyzeLogline(request, response);
  if (requestUrl.pathname === "/api/gemini/analyze") return handleGeminiAnalyze(request, response);
  if (requestUrl.pathname === "/api/gemini/mentor") return handleGeminiMentor(request, response);
  serveStatic(requestUrl, response);
});

server.listen(PORT, HOST, () => {
  console.log(`NReel is running at http://localhost:${PORT}/index.html`);
});

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
    if (sourceType === "script" && !sourceText) {
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
      prompt: buildAnalyzeExtractPrompt({ title, runtimeMinutes, sourceType, sourceText, videoData: sourceType === "video" ? videoData || sourceText : "", theoryBeats }),
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

async function fetchScriptFromDatabase(title) {
  const normalizedTitle = cleanText(title);
  if (!normalizedTitle) {
    const error = new Error("Script解析には映画タイトル、または脚本ファイルが必要です。");
    error.statusCode = 400;
    throw error;
  }
  const candidates = buildImsdbScriptUrls(normalizedTitle);
  for (const sourceUrl of candidates) {
    try {
      const html = await fetchText(sourceUrl, { maxBytes: MAX_HTML_BYTES });
      const scriptText = extractImsdbScriptText(html);
      if (scriptText) return { text: scriptText, sourceUrl };
    } catch {
      // Try the next likely IMSDb URL pattern.
    }
  }
  const error = new Error("脚本DBから脚本を取得できませんでした。脚本ファイルをアップロードしてください。");
  error.statusCode = 404;
  throw error;
}

async function fetchText(url) {
  const response = await fetchHtmlPage(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return readLimitedText(response);
}

function buildImsdbScriptUrls(title) {
  const baseTitle = title
    .replace(/[：:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const variants = [
    baseTitle,
    toTitleCase(baseTitle),
    baseTitle.replace(/\bpart\b/ig, "Part"),
    baseTitle.replace(/\bthe\b/ig, "The"),
  ];
  return [...new Set(variants.filter(Boolean))]
    .map((value) => `https://imsdb.com/scripts/${encodeURIComponent(value).replace(/%20/g, "-")}.html`);
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

function normalizeInput(value) {
  const raw = cleanText(value);
  const tmdbId = raw.match(/themoviedb\.org\/movie\/(\d+)/i)?.[1];
  return tmdbId ? { type: "tmdb_id", value: tmdbId } : { type: "query", value: raw };
}

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
  const response = await fetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
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
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini APIの取得に失敗しました。HTTP ${response.status}`);
  }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
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

function buildAnalyzeExtractPrompt({ title, runtimeMinutes, sourceType, sourceText, videoData, theoryBeats }) {
  return [
    title ? `作品名: ${title}` : "",
    `入力種別: ${sourceType}`,
    runtimeMinutes ? `上映時間: ${runtimeMinutes}分` : "上映時間: 未指定",
    "理論タイム:",
    JSON.stringify(theoryBeats.map(({ id, name, label, theory }) => ({ beatId: id, beatName: name, beatLabel: label, theory })), null, 2),
    "返却JSONスキーマ:",
    JSON.stringify({
      title: "string|null",
      runtimeMinutes: "number|null",
      beats: ANALYZE_BEAT_TEMPLATE.map((beat) => ({
        beatId: beat.id,
        beatName: beat.name,
        beatLabel: beat.label,
        theory: {
          startTime: "string|null",
          targetTime: "string|null",
          endTime: "string|null",
          ratio: "number",
          startPercent: "number",
          targetPercent: "number",
          endPercent: "number",
        },
        actual: {
          startTime: "string|null",
          endTime: "string|null",
          summary: "string|null",
        },
      })),
    }, null, 2),
    "制約:",
    "- beats は必ず上記15件、同じ順番で返す。",
    "- beatId / beatName / beatLabel / theory は理論タイムの値をそのまま入れる。",
    "- actual.startTime / actual.endTime / actual.summary だけを解析対象から抽出する。",
    "- 実測タイムの根拠がないビートは actual.startTime, actual.endTime, actual.summary を null にする。",
    "- summary は日本語で、具体的に何が起きたかだけを書く。",
    sourceType === "script" && sourceText ? ["脚本・テキスト:", sourceText].join("\n") : "",
    sourceType === "video" && videoData ? ["動画解析データ:", videoData].join("\n") : "",
  ].filter(Boolean).join("\n\n");
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
      actual: {
        ...emptyActualBeat(),
        startSeconds: beat.theory.targetSeconds,
        endSeconds: beat.theory.endSeconds,
        startTime: beat.theory.targetTime,
        endTime: beat.theory.endTime,
      },
    })),
  };
}

function buildAnalyzeExtractionResponse({ title, runtimeMinutes, sourceType, theoryBeats, result, sourceMeta }) {
  const extractedBeats = Array.isArray(result.json?.beats) ? result.json.beats : [];
  const beats = theoryBeats.map((theoryBeat, index) => {
    const extracted = findExtractedBeat(extractedBeats, theoryBeat, index);
    return {
      id: theoryBeat.id,
      name: theoryBeat.name,
      label: theoryBeat.label,
      theory: theoryBeat.theory,
      actual: normalizeActualBeat(extracted?.actual || extracted),
    };
  });
  return {
    title: cleanText(result.json?.title || title) || null,
    runtimeMinutes: runtimeMinutes || null,
    sourceType,
    sourceMeta: buildAnalyzeSourceMeta(sourceType, sourceMeta),
    beats,
    rawExtraction: result.json || null,
    model: result.model,
    usage: result.usage,
  };
}

function findExtractedBeat(extractedBeats, theoryBeat, index) {
  return extractedBeats.find((beat) => cleanText(beat.beatId || beat.id) === theoryBeat.id)
    || extractedBeats.find((beat) => normalizeComparableTitle(beat.beatName || beat.name) === normalizeComparableTitle(theoryBeat.name))
    || extractedBeats[index]
    || null;
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
  const startTime = normalizeTimestampValue(value.startTime || value.start || value.startTimestamp);
  const endTime = normalizeTimestampValue(value.endTime || value.end || value.endTimestamp);
  return {
    startTime,
    endTime,
    startSeconds: parseTimestampSeconds(startTime),
    endSeconds: parseTimestampSeconds(endTime),
    summary: cleanText(value.summary || value.content || value.description) || null,
  };
}

function emptyActualBeat() {
  return {
    startTime: null,
    endTime: null,
    startSeconds: null,
    endSeconds: null,
    summary: null,
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
