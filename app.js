const STORAGE_KEY = "movie-shelf-items";
const STORAGE_BEATS_KEY = "reverse-beats";
const STORAGE_TAB_KEY = "current-tab";

const sampleMovies = [
  {
    id: crypto.randomUUID(),
    title: "PERFECT DAYS",
    director: "Wim Wenders",
    releaseDate: "2023-12-22",
    releaseEndDate: "",
    genre: "ドラマ",
    cast: "Koji Yakusho",
    sourceUrl: "",
    posterUrl: "",
    tmdbId: "",
    runtime: "",
    watchProviders: "",
    description: "東京・渋谷の公共トイレ清掃員の日々を描く、静かな余韻のあるドラマ。",
    note: "静かな日にゆっくり見たい。",
    status: "",
    createdAt: Date.now() - 3000,
  },
  {
    id: crypto.randomUUID(),
    title: "DUNE: Part Two",
    director: "Denis Villeneuve",
    releaseDate: "2024-03-15",
    releaseEndDate: "",
    genre: "SF",
    cast: "Timothée Chalamet, Zendaya",
    sourceUrl: "",
    posterUrl: "",
    tmdbId: "",
    runtime: "",
    watchProviders: "",
    description: "砂の惑星アラキスを舞台に、運命と復讐が交差する壮大なSF続編。",
    note: "大きいスクリーン向き。",
    status: "",
    createdAt: Date.now() - 2000,
  },
];

const analyzeBeatDefinitions = [
  { id: "opening_image", label: "オープニング・イメージ", page: "1", ratio: 0.01, placeholder: "物語のトーンと変化前の主人公を示す" },
  { id: "theme_stated", label: "テーマの提示", page: "5", ratio: 0.05, placeholder: "何についての話かセリフ等で語られる" },
  { id: "setup", label: "セットアップ", page: "1-10", ratio: 0.1, placeholder: "登場人物紹介と欠けている人生を描く" },
  { id: "catalyst", label: "きっかけ", page: "12", ratio: 0.12, placeholder: "日常を壊す大きな事件が起きる" },
  { id: "debate", label: "悩み", page: "12-25", ratio: 0.2, placeholder: "新しい世界へ行くべきか葛藤する" },
  { id: "break_into_two", label: "第1ターニングポイント", page: "25", ratio: 0.25, placeholder: "決断し、新しい世界へ旅立つ" },
  { id: "b_story", label: "サブプロット（Bストーリー）", page: "30", ratio: 0.3, placeholder: "恋愛や相棒など別の軸が走り出す" },
  { id: "fun_and_games", label: "お楽しみ（遊び）", page: "30-55", ratio: 0.4, placeholder: "その映画の「売り」となるシーンの連続" },
  { id: "midpoint", label: "ミッドポイント", page: "55", ratio: 0.5, placeholder: "物語の転換点。時間制限やリスクの増大" },
  { id: "bad_guys_close_in", label: "迫り来る悪", page: "55-75", ratio: 0.65, placeholder: "敵の反撃と内面・外面からの追い込み" },
  { id: "all_is_lost", label: "すべてを失って", page: "75", ratio: 0.75, placeholder: "最も低いどん底。希望が完全に消える" },
  { id: "dark_night_of_the_soul", label: "心の暗闇", page: "75-85", ratio: 0.8, placeholder: "敗北を噛み締め、教訓を得る" },
  { id: "break_into_three", label: "第2ターニングポイント", page: "85", ratio: 0.85, placeholder: "解決策を思いつき、最終決戦へ向かう" },
  { id: "finale", label: "フィナーレ", page: "85-110", ratio: 0.95, placeholder: "新しい自分に生まれ変わり、敵を倒す" },
  { id: "final_image", label: "ファイナル・イメージ", page: "110", ratio: 1, placeholder: "変化した後の世界。1との対比" },
];

let movies = loadMovies();
let reverseBeats = loadReverseBeats();
let editingId = null;
let pendingConfirmAction = null;
let detailMovieId = null;
let currentStatusFilter = "all";
let formStatus = "";
let analyzeSourceType = "manual";
let scriptMode = "script_db";
let editingAnalyzeId = null;
let detailAnalyzeId = null;
let currentAnalyzeFilter = "all";
let candidateDialogSelectHandler = null;
let candidateDialogCancelHandler = null;
let analyzeCandidateOnCancel = null;
let analyzeScriptSearchGeneration = 0;
let scriptDbPrefetch = null;
let analyzeElapsedTimer = null;

const form = document.querySelector("#movieForm");
const openFormButton = document.querySelector("#openFormButton");
const closeFormButton = document.querySelector("#closeFormButton");
const formBackdrop = document.querySelector("#formBackdrop");
const confirmBackdrop = document.querySelector("#confirmBackdrop");
const candidateBackdrop = document.querySelector("#candidateBackdrop");
const detailBackdrop = document.querySelector("#detailBackdrop");
const analyzeBackdrop = document.querySelector("#analyzeBackdrop");
const analyzeDetailBackdrop = document.querySelector("#analyzeDetailBackdrop");
const confirmDialog = document.querySelector("#confirmDialog");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmMessage = document.querySelector("#confirmMessage");
const confirmCancelButton = document.querySelector("#confirmCancelButton");
const confirmOkButton = document.querySelector("#confirmOkButton");
const candidateDialog = document.querySelector("#candidateDialog");
const candidateList = document.querySelector("#candidateList");
const candidateCloseButton = document.querySelector("#candidateCloseButton");
const analyzeCandidateBackdrop = document.querySelector("#analyzeCandidateBackdrop");
const analyzeCandidateDialog = document.querySelector("#analyzeCandidateDialog");
const analyzeCandidateList = document.querySelector("#analyzeCandidateList");
const analyzeCandidateCloseButton = document.querySelector("#analyzeCandidateCloseButton");
const analyzeDialog = document.querySelector("#analyzeDialog");
const closeAnalyzeButton = document.querySelector("#closeAnalyzeButton");
const analyzeDialogTitle = document.querySelector("#analyzeDialogTitle");
const analyzeDialogSubtitle = document.querySelector("#analyzeDialogSubtitle");
const analyzeDetailDialog = document.querySelector("#analyzeDetailDialog");
const closeAnalyzeDetailButton = document.querySelector("#closeAnalyzeDetailButton");
const analyzeDetailTitle = document.querySelector("#analyzeDetailTitle");
const analyzeDetailMeta = document.querySelector("#analyzeDetailMeta");
const analyzeDetailLogline = document.querySelector("#analyzeDetailLogline");
const analyzeDetailBeats = document.querySelector("#analyzeDetailBeats");
const analyzeDetailEditButton = document.querySelector("#analyzeDetailEditButton");
const analyzeDetailDeleteButton = document.querySelector("#analyzeDetailDeleteButton");
const movieDetailDialog = document.querySelector("#movieDetailDialog");
const closeDetailButton = document.querySelector("#closeDetailButton");
const detailTitle = document.querySelector("#detailTitle");
const detailMeta = document.querySelector("#detailMeta");
const detailPoster = document.querySelector("#detailPoster");
const detailPosterImage = document.querySelector("#detailPosterImage");
const detailPosterFallback = document.querySelector("#detailPosterFallback");
const detailFields = document.querySelector("#detailFields");
const detailDescription = document.querySelector("#detailDescription");
const detailNote = document.querySelector("#detailNote");
const detailEditButton = document.querySelector("#detailEditButton");
const detailDeleteButton = document.querySelector("#detailDeleteButton");
const formTitle = document.querySelector("#formTitle");
const submitButton = document.querySelector("#submitButton");
const movieList = document.querySelector("#movieList");
const emptyState = document.querySelector("#emptyState");
const emptyStateActions = document.querySelector("#emptyStateActions");
const clearMovieFiltersButton = document.querySelector("#clearMovieFiltersButton");
const emptyAddMovieButton = document.querySelector("#emptyAddMovieButton");
const allMovieCount = document.querySelector("#allMovieCount");
const unwatchedMovieCount = document.querySelector("#unwatchedMovieCount");
const watchedMovieCount = document.querySelector("#watchedMovieCount");
const template = document.querySelector("#movieTemplate");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const statusFilterButtons = document.querySelectorAll("[data-status-filter]");
const formStatusButtons = document.querySelectorAll("[data-form-status]");
const detailStatusToggle = document.querySelector("#detailStatusToggle");
const detailStatusText = document.querySelector("#detailStatusText");
const fetchInfoButton = document.querySelector("#fetchInfoButton");
const fetchTitleInfoButton = document.querySelector("#fetchTitleInfoButton");
const headerPanels = document.querySelectorAll("[data-header]");
const reverseList = document.querySelector("#reverseList");
const reverseForm = document.querySelector("#reverseForm");
const analyzeTitleField = document.querySelector("#analyzeTitleField");
const analyzeTitleLabel = document.querySelector("#analyzeTitleLabel");
const analyzeRuntimeField = document.querySelector("#analyzeRuntimeField");
const analyzeRuntimeInput = document.querySelector("#analyzeRuntimeInput");
const extractAnalyzeButton = document.querySelector("#extractAnalyzeButton");
const deleteAnalyzeButton = document.querySelector("#deleteAnalyzeButton");
const analyzeFormActions = document.querySelector("#analyzeFormActions");
const analyzeStatus = document.querySelector("#analyzeStatus");
const analyzeSourceButtons = document.querySelectorAll("[data-analyze-source]");
const manualAnalyzeFields = document.querySelector("#manualAnalyzeFields");
const scriptAnalyzeFields = document.querySelector("#scriptAnalyzeFields");
const manualBeatFields = document.querySelector("#manualBeatFields");
const analyzeLoglineField = document.querySelector("#analyzeLoglineField");
const analyzeLoglineInput = document.querySelector("#analyzeLoglineInput");
const generateLoglineButton = document.querySelector("#generateLoglineButton");
const analyzeScriptFileInput = document.querySelector("#analyzeScriptFileInput");
const scriptDropZone = document.querySelector("#scriptDropZone");
const scriptFileName = document.querySelector("#scriptFileName");
const scriptModeToggle = document.querySelector("#scriptModeToggle");
const scriptUploadHelp = document.querySelector("#scriptUploadHelp");
const analyzeDialogBusyOverlay = document.querySelector("#analyzeDialogBusyOverlay");
const analyzeDialogBusyLabel = document.querySelector("#analyzeDialogBusyLabel");
const analyzeDialogBusyHint = document.querySelector("#analyzeDialogBusyHint");
const analyzeDialogBusyElapsed = document.querySelector("#analyzeDialogBusyElapsed");
const analyzeElapsedSeconds = document.querySelector("#analyzeElapsedSeconds");
const analyzeCompletePanel = document.querySelector("#analyzeCompletePanel");
const analyzeCompleteOkButton = document.querySelector("#analyzeCompleteOkButton");
const geminiUsageBar = document.querySelector("#geminiUsageBar");
const geminiUsageText = document.querySelector("#geminiUsageText");
const geminiUsageReset = document.querySelector("#geminiUsageReset");
const analyzeScriptDbActions = document.querySelector("#analyzeScriptDbActions");
const analyzeScriptDbSearchButton = document.querySelector("#analyzeScriptDbSearchButton");
const scriptDbConfirmPanel = document.querySelector("#scriptDbConfirmPanel");
const scriptDbConfirmTitleText = document.querySelector("#scriptDbConfirmTitleText");
const scriptDbConfirmStartButton = document.querySelector("#scriptDbConfirmStartButton");
const scriptDbConfirmCancelButton = document.querySelector("#scriptDbConfirmCancelButton");
const analyzeScriptUploadButton = document.querySelector("#analyzeScriptUploadButton");
const scriptModeButtons = document.querySelectorAll("[data-script-mode]");
const analyzeSearchInput = document.querySelector("#analyzeSearchInput");
const analyzeSortSelect = document.querySelector("#analyzeSortSelect");
const analyzeFilterButtons = document.querySelectorAll("[data-analyze-filter]");
const manualBeatTemplate = document.querySelector("#manualBeatTemplate");
const analyzeCardTemplate = document.querySelector("#analyzeCardTemplate");
const analyzeDetailBeatTemplate = document.querySelector("#analyzeDetailBeatTemplate");
const analyzeCounts = {
  all: document.querySelector("#allAnalyzeCount"),
  manual: document.querySelector("#manualAnalyzeCount"),
  script: document.querySelector("#scriptAnalyzeCount"),
};
const tabButtons = document.querySelectorAll(".tab-button[data-tab]");
const tabPanels = document.querySelectorAll(".tab-panel");

const inputs = {
  title: document.querySelector("#titleInput"),
  director: document.querySelector("#directorInput"),
  releaseDate: document.querySelector("#releaseDateInput"),
  releaseEndDate: document.querySelector("#releaseEndDateInput"),
  genre: document.querySelector("#genreInput"),
  cast: document.querySelector("#castInput"),
  sourceUrl: document.querySelector("#sourceUrlInput"),
  posterUrl: document.querySelector("#posterUrlInput"),
  tmdbId: document.querySelector("#tmdbIdInput"),
  runtime: document.querySelector("#runtimeInput"),
  watchProviders: document.querySelector("#watchProvidersInput"),
  description: document.querySelector("#descriptionInput"),
  note: document.querySelector("#noteInput"),
};

const reverseInputs = {
  title: document.querySelector("#reverseTitleInput"),
  runtime: analyzeRuntimeInput,
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = {
    ...Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()])),
    status: formStatus,
  };

  if (editingId) {
    movies = movies.map((movie) => (movie.id === editingId ? { ...movie, ...payload } : movie));
    stopEditing();
  } else {
    saveMovie(payload);
    form.reset();
    inputs.posterUrl.value = "";
    inputs.tmdbId.value = "";
    inputs.runtime.value = "";
    inputs.watchProviders.value = "";
    setFormStatus("");
  }

  closeForm();
  saveAndRender();
});

openFormButton.addEventListener("click", () => {
  stopEditing();
  openForm();
});
closeFormButton.addEventListener("click", closeForm);
formBackdrop.addEventListener("click", closeForm);
searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
statusFilterButtons.forEach((button) => button.addEventListener("click", () => setStatusFilter(button.dataset.statusFilter)));
clearMovieFiltersButton?.addEventListener("click", resetMovieFilters);
emptyAddMovieButton?.addEventListener("click", () => {
  openForm();
});
formStatusButtons.forEach((button) => button.addEventListener("click", () => setFormStatus(button.dataset.formStatus)));
detailStatusToggle.addEventListener("click", toggleDetailWatchedStatus);
fetchInfoButton.addEventListener("click", fetchMovieInfo);
fetchTitleInfoButton.addEventListener("click", fetchMovieInfoByTitle);
extractAnalyzeButton.addEventListener("click", extractAnalyzeBeats);
deleteAnalyzeButton.addEventListener("click", deleteCurrentAnalyze);
generateLoglineButton.addEventListener("click", generateAnalyzeLogline);
analyzeSourceButtons.forEach((button) => button.addEventListener("click", () => openAnalyzeSetup(button.dataset.analyzeSource)));
closeAnalyzeButton.addEventListener("click", closeAnalyzeSetup);
analyzeBackdrop.addEventListener("click", closeAnalyzeSetup);
closeAnalyzeDetailButton.addEventListener("click", closeAnalyzeDetail);
analyzeDetailBackdrop.addEventListener("click", closeAnalyzeDetail);
analyzeDetailEditButton.addEventListener("click", () => openAnalyzeEdit(detailAnalyzeId));
analyzeDetailDeleteButton.addEventListener("click", () => deleteAnalyzeById(detailAnalyzeId));
analyzeSearchInput.addEventListener("input", renderAnalyzeBeats);
analyzeSortSelect.addEventListener("change", renderAnalyzeBeats);
analyzeFilterButtons.forEach((button) => button.addEventListener("click", () => setAnalyzeFilter(button.dataset.analyzeFilter)));
analyzeScriptFileInput.addEventListener("change", updateScriptFileName);
scriptDropZone.addEventListener("dragover", handleScriptDragOver);
scriptDropZone.addEventListener("dragleave", handleScriptDragLeave);
scriptDropZone.addEventListener("drop", handleScriptDrop);
analyzeScriptDbSearchButton?.addEventListener("click", () => runScriptDbSearch());
scriptDbConfirmStartButton?.addEventListener("click", () => runScriptDbConfirmedPipeline());
scriptDbConfirmCancelButton?.addEventListener("click", () => {
  hideScriptDbConfirmPanel();
  setAnalyzeStatus("", false);
  reverseInputs.title.focus();
});
analyzeCompleteOkButton?.addEventListener("click", () => {
  analyzeCompletePanel?.classList.add("hidden");
  closeAnalyzeSetup();
});
reverseInputs.title.addEventListener("input", () => {
  hideScriptDbConfirmPanel();
  clearScriptDbPrefetch();
});
analyzeScriptUploadButton?.addEventListener("click", () => runScriptUploadAnalyze());
scriptModeButtons.forEach((button) => button.addEventListener("click", () => setScriptMode(button.dataset.scriptMode)));
tabButtons.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
renderManualBeatFields();

function loadMovies() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return sampleMovies;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeMovie) : sampleMovies;
  } catch {
    return sampleMovies;
  }
}

function normalizeMovie(movie) {
  return {
    id: movie.id || crypto.randomUUID(),
    title: movie.title || "無題",
    director: movie.director || "",
    releaseDate: movie.releaseDate || normalizeDateInput(movie.year),
    releaseEndDate: movie.releaseEndDate || "",
    genre: movie.genre || "",
    cast: movie.cast || "",
    sourceUrl: movie.sourceUrl || "",
    posterUrl: movie.posterUrl || "",
    tmdbId: normalizeTmdbId(movie.tmdbId || movie.tmdb_id),
    runtime: normalizeRuntime(movie.runtime),
    watchProviders: normalizeWatchProviders(movie.watchProviders || movie.watch_providers),
    description: movie.description || "",
    note: movie.note || "",
    status: normalizeMovieStatus(movie.status),
    createdAt: movie.createdAt || Date.now(),
  };
}

function normalizeMovieStatus(status) {
  return status === "watched" ? "watched" : "";
}

function normalizeTmdbId(value) {
  return String(value || "").trim();
}

function normalizeRuntime(value) {
  const runtime = Number.parseInt(value, 10);
  return Number.isFinite(runtime) && runtime > 0 ? String(runtime) : "";
}

function normalizeWatchProviders(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  if (value && typeof value === "object") return Object.values(value).flat().map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  return String(value || "").trim();
}

function saveMovie(payload) {
  const normalizedPayload = {
    ...payload,
    tmdbId: normalizeTmdbId(payload.tmdbId),
    runtime: normalizeRuntime(payload.runtime),
    watchProviders: normalizeWatchProviders(payload.watchProviders),
  };
  const existingIndex = normalizedPayload.tmdbId
    ? movies.findIndex((movie) => normalizeTmdbId(movie.tmdbId) === normalizedPayload.tmdbId)
    : -1;
  if (existingIndex >= 0) {
    const existing = movies[existingIndex];
    const updated = { ...existing, ...normalizedPayload, id: existing.id, createdAt: existing.createdAt, updatedAt: Date.now() };
    movies = [updated, ...movies.filter((_, index) => index !== existingIndex)];
    return;
  }
  movies.unshift({ id: crypto.randomUUID(), ...normalizedPayload, createdAt: Date.now() });
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
  render();
}

function loadReverseBeats() {
  const saved = localStorage.getItem(STORAGE_BEATS_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeReverseBeat) : [];
  } catch {
    return [];
  }
}

function normalizeReverseBeat(item) {
  const runtime = normalizeRuntime(item.runtime);
  const sourceType = item.sourceType || item.source_type || "manual";
  return {
    id: item.id || crypto.randomUUID(),
    sourceType,
    referenceUrl: item.referenceUrl || "",
    referenceFileName: item.referenceFileName || "",
    title: item.title || "無題",
    runtime,
    beats: normalizeStoredAnalyzeBeats(item.beats, runtime),
    logline: item.logline || "",
    sourceMeta: normalizeAnalyzeSourceMeta(item.sourceMeta, { sourceType, scriptSource: item.scriptSource, referenceUrl: item.referenceUrl, referenceFileName: item.referenceFileName }),
    note: item.note || "",
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || "",
  };
}

function normalizeAnalyzeSourceMeta(sourceMeta = {}, fallback = {}) {
  const sourceType = fallback.sourceType || "manual";
  return {
    method: sourceMeta.method || fallback.method || getDefaultAnalyzeMethod(sourceType, fallback),
    sourceUrl: sourceMeta.sourceUrl || fallback.scriptSource || fallback.referenceUrl || "",
    fileName: sourceMeta.fileName || fallback.referenceFileName || "",
    model: sourceMeta.model || "",
  };
}

function getDefaultAnalyzeMethod(sourceType, fallback = {}) {
  if (sourceType === "manual") return "manual";
  if (sourceType === "script") return fallback.referenceFileName ? "file_upload" : fallback.scriptSource ? "script_db" : "script";
  if (sourceType === "video") return "video";
  return sourceType;
}

function normalizeStoredAnalyzeBeats(beats, runtime) {
  if (!Array.isArray(beats)) return beats || "";
  const theoryById = Object.fromEntries(buildClientTheoryBeats(runtime).map((beat) => [beat.id, beat.theory]));
  return beats.map((beat) => ({
    ...beat,
    theory: theoryById[beat.id] || beat.theory || {},
  }));
}

function buildClientTheoryBeats(runtime) {
  const runtimeMinutes = Number.parseInt(runtime, 10);
  const totalSeconds = Number.isFinite(runtimeMinutes) && runtimeMinutes > 0 ? runtimeMinutes * 60 : null;
  return analyzeBeatDefinitions.map((beat) => {
    const targetSeconds = totalSeconds === null ? null : Math.round(totalSeconds * beat.ratio);
    return {
      id: beat.id,
      theory: {
        ratio: beat.ratio,
        targetPercent: Math.round(beat.ratio * 10000) / 100,
        targetSeconds,
        targetTime: formatBeatTimestamp(targetSeconds),
      },
    };
  });
}

function saveReverseBeats() {
  localStorage.setItem(STORAGE_BEATS_KEY, JSON.stringify(reverseBeats));
  renderReverseBeats();
}

function switchTab(tabName) {
  const nextTab = [...tabPanels].some((panel) => panel.dataset.tab === tabName) ? tabName : "movies";
  headerPanels.forEach((panel) => toggleAnimatedPanel(panel, panel.dataset.header === nextTab));
  tabButtons.forEach((button) => {
    const selected = button.dataset.tab === nextTab;
    button.classList.toggle("tab-active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  tabPanels.forEach((panel) => toggleAnimatedPanel(panel, panel.dataset.tab === nextTab));
  localStorage.setItem(STORAGE_TAB_KEY, nextTab);
  if (nextTab === "reverse") renderReverseBeats();
}

function toggleAnimatedPanel(panel, shouldShow) {
  panel.classList.remove("panel-entering");
  panel.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;
  requestAnimationFrame(() => panel.classList.add("panel-entering"));
}

function setAnalyzeFilter(filter) {
  currentAnalyzeFilter = ["all", "manual", "script"].includes(filter) ? filter : "all";
  analyzeFilterButtons.forEach((button) => {
    const selected = button.dataset.analyzeFilter === currentAnalyzeFilter;
    button.classList.toggle("filter-pill-active", selected);
  });
  renderAnalyzeBeats();
}

function render() {
  const visibleMovies = getVisibleMovies();
  movieList.innerHTML = "";
  emptyState.classList.toggle("hidden", visibleMovies.length > 0);
  emptyStateActions?.classList.toggle("hidden", visibleMovies.length > 0);
  updateMovieStatusCounts();

  visibleMovies.forEach((movie) => {
    const item = template.content.firstElementChild.cloneNode(true);
    const poster = item.querySelector(".movie-poster");
    const posterImage = poster.querySelector("img");
    const posterFallback = poster.querySelector("span");
    const heading = item.querySelector("h3");
    const cardMeta = item.querySelector(".movie-card-meta");
    const statusBadge = item.querySelector(".movie-status-badge");
    const statusButton = item.querySelector(".status-button");
    const menuButton = item.querySelector(".movie-menu-button");
    const menu = item.querySelector(".movie-card-menu");

    item.tabIndex = 0;
    item.classList.toggle("movie-watched", movie.status === "watched");
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `${movie.title} の詳細を開く`);
    setPoster(poster, posterImage, posterFallback, movie);
    renderSplitTitle(heading, movie.title, "movie-card-title");
    const releaseYear = normalizeDateInput(movie.releaseDate).split("-")[0] || "";
    const runtimeLabel = movie.runtime ? `${movie.runtime}分` : "";
    cardMeta.textContent = [releaseYear, runtimeLabel].filter(Boolean).join(" ・ ") || "公開年・上映時間 未設定";
    statusBadge.classList.toggle("hidden", movie.status !== "watched");
    renderStatusButton(statusButton, movie);
    statusButton.addEventListener("click", (event) => toggleWatchedStatus(event, movie));
    menuButton.addEventListener("click", (event) => toggleMovieMenu(event, menuButton, menu));
    menu.querySelectorAll("[data-menu-action]").forEach((button) => {
      button.addEventListener("click", (event) => handleMovieMenuAction(event, movie));
    });
    item.addEventListener("click", () => openMovieDetail(movie.id));
    item.addEventListener("keydown", (event) => {
      if (event.target !== item) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openMovieDetail(movie.id);
    });
    movieList.append(item);
  });
}

function updateMovieStatusCounts() {
  const watchedCount = movies.filter((movie) => movie.status === "watched").length;
  allMovieCount.textContent = movies.length;
  watchedMovieCount.textContent = watchedCount;
  unwatchedMovieCount.textContent = movies.length - watchedCount;
}

function getVisibleMovies() {
  const query = searchInput.value.trim().toLowerCase();
  return movies
    .filter((movie) => {
      const haystack = [movie.title, movie.director, movie.cast, movie.genre, movie.releaseDate, movie.releaseEndDate, movie.runtime, movie.watchProviders, movie.sourceUrl, movie.description, movie.note]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = currentStatusFilter === "all" || (currentStatusFilter === "watched" ? movie.status === "watched" : movie.status !== "watched");
      return matchesQuery && matchesStatus;
    })
    .sort((a, b) => {
      if (sortSelect.value === "titleAsc") return a.title.localeCompare(b.title, "ja");
      return b.createdAt - a.createdAt;
    });
}

function setStatusFilter(filter) {
  currentStatusFilter = filter || "all";
  statusFilterButtons.forEach((button) => {
    button.classList.toggle("filter-pill-active", button.dataset.statusFilter === currentStatusFilter);
  });
  render();
}

function resetMovieFilters() {
  currentStatusFilter = "all";
  searchInput.value = "";
  sortSelect.value = "createdDesc";
  statusFilterButtons.forEach((button) => {
    button.classList.toggle("filter-pill-active", button.dataset.statusFilter === "all");
  });
  render();
}

function renderStatusButton(button, movie) {
  const watched = movie.status === "watched";
  button.className = `status-button ${watched ? "status-watched" : "status-unwatched"}`;
  button.title = watched ? "未視聴に戻す" : "視聴済みにする";
  button.setAttribute("aria-label", button.title);
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5.2 12.4 4.2 4.1 9.4-10" />
    </svg>
  `;
}

function setFormStatus(status) {
  formStatus = normalizeMovieStatus(status);
  formStatusButtons.forEach((button) => {
    button.classList.toggle("status-choice-active", button.dataset.formStatus === formStatus);
  });
}

function setDetailStatus(status) {
  if (!detailMovieId) return;
  const normalized = normalizeMovieStatus(status);
  updateMovieStatus(detailMovieId, normalized);
  renderDetailStatus(normalized);
}

function renderDetailStatus(status) {
  const normalized = normalizeMovieStatus(status);
  renderStatusButton(detailStatusToggle, { status: normalized });
  detailStatusText.textContent = normalized === "watched" ? "視聴済み" : "未視聴";
}

function toggleDetailWatchedStatus() {
  if (!detailMovieId) return;
  const movie = movies.find((item) => item.id === detailMovieId);
  if (!movie) return;
  setDetailStatus(movie.status === "watched" ? "" : "watched");
}

function toggleWatchedStatus(event, movie) {
  event.stopPropagation();
  updateMovieStatus(movie.id, movie.status === "watched" ? "" : "watched");
}

function toggleMovieMenu(event, button, menu) {
  event.stopPropagation();
  const willOpen = menu.classList.contains("hidden");
  closeMovieMenus();
  menu.classList.toggle("hidden", !willOpen);
  button.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

function closeMovieMenus() {
  document.querySelectorAll(".movie-card-menu").forEach((menu) => menu.classList.add("hidden"));
  document.querySelectorAll(".movie-menu-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
}

function handleMovieMenuAction(event, movie) {
  event.stopPropagation();
  closeMovieMenus();
  const action = event.currentTarget.dataset.menuAction;
  if (action === "watched") return updateMovieStatus(movie.id, "watched");
  if (action === "unwatched") return updateMovieStatus(movie.id, "");
  if (action === "delete") return deleteMovie(movie.id);
}

function updateMovieStatus(id, status) {
  movies = movies.map((movie) => (movie.id === id ? { ...movie, status } : movie));
  saveAndRender();
}

function setPoster(container, image, fallback, movie) {
  if (movie.posterUrl) {
    image.src = movie.posterUrl;
    image.alt = `${movie.title} のサムネイル`;
    image.onerror = () => {
      container.classList.add("poster-empty");
      fallback.hidden = false;
    };
    container.classList.remove("poster-empty");
    fallback.hidden = true;
  } else {
    image.removeAttribute("src");
    image.alt = "";
    image.onerror = null;
    container.classList.add("poster-empty");
    fallback.hidden = false;
  }
}

function startEditing(id) {
  const movie = movies.find((item) => item.id === id);
  if (!movie) return;
  editingId = id;
  Object.entries(inputs).forEach(([key, input]) => {
    input.value = movie[key] || "";
  });
  setFormStatus(movie.status);
  formTitle.textContent = "映画を編集";
  submitButton.textContent = "更新する";
  openForm();
}

function stopEditing() {
  editingId = null;
  form.reset();
  inputs.posterUrl.value = "";
  inputs.tmdbId.value = "";
  inputs.runtime.value = "";
  inputs.watchProviders.value = "";
  setFormStatus("");
  formTitle.textContent = "映画を追加";
  submitButton.textContent = "追加する";
}

function openForm() {
  form.classList.add("is-open");
  formBackdrop.classList.remove("hidden");
  document.body.classList.add("form-open");
  setTimeout(() => inputs.title.focus(), 0);
}

function closeForm() {
  form.classList.remove("is-open");
  formBackdrop.classList.add("hidden");
  document.body.classList.remove("form-open");
}

function openMovieDetail(id) {
  const movie = movies.find((item) => item.id === id);
  if (!movie) return;
  detailMovieId = id;
  renderDetailTitle(movie.title);
  detailMeta.textContent = buildDetailMeta(movie);
  renderDetailStatus(movie.status);
  detailDescription.textContent = movie.description || "概要なし";
  detailDescription.classList.toggle("muted-empty", !movie.description);
  detailNote.textContent = movie.note || "メモなし";
  detailNote.classList.toggle("muted-empty", !movie.note);
  renderDetailFields(movie);
  setPoster(detailPoster, detailPosterImage, detailPosterFallback, movie);
  movieDetailDialog.classList.remove("detail-entering");
  movieDetailDialog.classList.remove("hidden");
  detailBackdrop.classList.remove("hidden");
  document.body.classList.add("dialog-open");
  requestAnimationFrame(() => {
    movieDetailDialog.classList.add("detail-entering");
  });
  setTimeout(() => closeDetailButton.focus(), 0);
}

function renderDetailTitle(title) {
  renderSplitTitle(detailTitle, title, "detail-title");
}

function renderSplitTitle(container, title, classPrefix) {
  const parts = splitDisplayTitle(title);
  container.innerHTML = "";
  const main = document.createElement("span");
  main.className = `${classPrefix}-main`;
  main.textContent = parts.main;
  container.append(main);
  if (!parts.sub) return;
  const sub = document.createElement("span");
  sub.className = `${classPrefix}-sub`;
  sub.textContent = parts.sub;
  container.append(sub);
}

function splitDisplayTitle(title) {
  const value = String(title || "無題").trim();
  const match = value.match(/^([A-Za-z0-9][A-Za-z0-9\s:;'"!?.,&+\-–—/()]+?)\s+([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々ー・].*)$/u);
  if (!match) return { main: value, sub: "" };
  return { main: match[1].trim(), sub: match[2].trim() };
}

function buildDetailMeta(movie) {
  const year = normalizeDateInput(movie.releaseDate).split("-")[0] || "";
  return [year, movie.genre, movie.director].filter(Boolean).join(" ・ ") || "登録情報なし";
}

function renderDetailFields(movie) {
  detailFields.innerHTML = "";
  [
    ["公開日", formatDisplayDate(movie.releaseDate)],
    ["公開終了日", formatDisplayDate(movie.releaseEndDate)],
    ["監督", movie.director],
    ["キャスト", movie.cast],
    ["ジャンル", movie.genre],
    ["上映時間", movie.runtime ? `${movie.runtime}分` : ""],
    ["配信", movie.watchProviders],
    ["TMDb ID", movie.tmdbId],
    ["作品ページ", movie.sourceUrl],
  ].forEach(([label, value]) => detailFields.append(createDetailField(label, value)));
}

function createDetailField(label, value) {
  const group = document.createElement("div");
  const labelElement = document.createElement("dt");
  const valueElement = document.createElement("dd");
  const displayValue = String(value || "").trim();
  labelElement.textContent = label;
  if (label === "作品ページ" && displayValue) {
    const link = document.createElement("a");
    link.href = displayValue;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = displayValue;
    valueElement.append(link);
  } else {
    valueElement.textContent = displayValue || "未登録";
    valueElement.classList.toggle("muted-empty", !displayValue);
  }
  group.append(labelElement, valueElement);
  return group;
}

function closeMovieDetail() {
  detailMovieId = null;
  movieDetailDialog.classList.remove("detail-entering");
  movieDetailDialog.classList.add("hidden");
  detailBackdrop.classList.add("hidden");
  document.body.classList.remove("dialog-open");
}

closeDetailButton.addEventListener("click", closeMovieDetail);
detailBackdrop.addEventListener("click", closeMovieDetail);
detailEditButton.addEventListener("click", () => {
  const id = detailMovieId;
  closeMovieDetail();
  if (id) startEditing(id);
});
detailDeleteButton.addEventListener("click", () => {
  const id = detailMovieId;
  closeMovieDetail();
  if (id) deleteMovie(id);
});

function deleteMovie(id) {
  const movie = movies.find((item) => item.id === id);
  if (!movie) return;
  openConfirmDialog({
    title: "映画を削除しますか？",
    message: `「${movie.title}」を映画リストから削除します。この操作は元に戻せません。`,
    okText: "削除する",
    onConfirm: () => {
      movies = movies.filter((item) => item.id !== id);
      if (editingId === id) stopEditing();
      saveAndRender();
    },
  });
}

function openConfirmDialog({ title, message, okText, onConfirm }) {
  pendingConfirmAction = onConfirm;
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOkButton.textContent = okText;
  confirmDialog.classList.remove("hidden");
  confirmBackdrop.classList.remove("hidden");
  document.body.classList.add("dialog-open");
}

function closeConfirmDialog() {
  pendingConfirmAction = null;
  confirmDialog.classList.add("hidden");
  confirmBackdrop.classList.add("hidden");
  document.body.classList.remove("dialog-open");
}

confirmCancelButton.addEventListener("click", closeConfirmDialog);
confirmBackdrop.addEventListener("click", closeConfirmDialog);
document.addEventListener("click", closeMovieMenus);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMovieMenus();
});
confirmOkButton.addEventListener("click", () => {
  const action = pendingConfirmAction;
  closeConfirmDialog();
  action?.();
});

async function fetchMovieInfo() {
  const sourceUrl = inputs.sourceUrl.value.trim();
  if (!sourceUrl) {
    alert("作品ページURLを入力してください。");
    return;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    alert("URLの形式を確認してください。");
    return;
  }
  await fetchAndApply(`/api/extract?url=${encodeURIComponent(parsedUrl.href)}`, fetchInfoButton, "URLから取得", "取得中");
}

async function fetchMovieInfoByTitle() {
  const title = inputs.title.value.trim();
  if (!title) {
    alert("タイトルを入力してください。");
    return;
  }
  await fetchAndApply(`/api/search?title=${encodeURIComponent(title)}`, fetchTitleInfoButton, "タイトルから取得", "検索中");
}

async function fetchAndApply(url, button, defaultLabel, loadingLabel) {
  button.disabled = true;
  button.textContent = loadingLabel;
  try {
    const response = await fetch(url);
    const data = await readResponseJson(response);
    if (!response.ok) throw new Error(data.error || "映画情報を取得できませんでした。");
    if (Array.isArray(data.candidates)) {
      openCandidateDialog(data.candidates);
      return;
    }
    applyFetchedInfo(data);
  } catch (error) {
    alert(buildFetchErrorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = defaultLabel;
  }
}

function openCandidateDialog(candidates, options = {}) {
  const discoverSelectHandler = async (candidate) => {
    closeCandidateDialog({ triggerCancel: false });
    await fetchAndApply(`/api/search?tmdbId=${encodeURIComponent(candidate.tmdbId)}`, fetchTitleInfoButton, "タイトルから取得", "取得中");
  };
  const selectHandler = typeof options.onSelect === "function" ? options.onSelect : discoverSelectHandler;
  candidateDialogSelectHandler = selectHandler;
  candidateDialogCancelHandler = typeof options.onCancel === "function" ? options.onCancel : null;
  const overlayTop = options.overlayTop === true;
  candidateDialog.classList.toggle("candidate-dialog-on-top", overlayTop);
  candidateBackdrop.classList.toggle("candidate-backdrop-on-top", overlayTop);
  candidateList.innerHTML = "";
  candidates.forEach((candidate) => {
    const button = document.createElement("button");
    button.className = "candidate-item";
    button.type = "button";
    const meta = [candidate.originalTitle, candidate.releaseDate || candidate.year, candidate.language, `TMDb ${candidate.tmdbId}`].filter(Boolean).join(" ・ ");
    const description = candidate.overview || "概要未登録。ポスター、公開日、原題、TMDb IDで確認してください。";
    button.innerHTML = `
      <span class="candidate-poster">${candidate.posterUrl ? `<img src="${escapeAttribute(candidate.posterUrl)}" alt="" />` : "NO IMAGE"}</span>
      <span class="candidate-body">
        <strong>${escapeHtml(candidate.title || "無題")}</strong>
        <small>${escapeHtml(meta || "詳細情報なし")}</small>
        <span class="${candidate.overview ? "" : "candidate-empty-overview"}">${escapeHtml(description)}</span>
      </span>
    `;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      queueMicrotask(() => {
        void selectHandler(candidate);
      });
    });
    candidateList.append(button);
  });
  candidateDialog.classList.remove("hidden");
  candidateBackdrop.classList.remove("hidden");
  document.body.classList.add("dialog-open");
  candidateCloseButton.focus();
}

function closeCandidateDialog(options = {}) {
  const triggerCancel = options.triggerCancel ?? true;
  const cancelHandler = candidateDialogCancelHandler;
  candidateDialogSelectHandler = null;
  candidateDialogCancelHandler = null;
  candidateDialog.classList.remove("candidate-dialog-on-top");
  candidateBackdrop.classList.remove("candidate-backdrop-on-top");
  candidateDialog.classList.add("hidden");
  candidateBackdrop.classList.add("hidden");
  document.body.classList.remove("dialog-open");
  if (triggerCancel && cancelHandler) cancelHandler();
}

function openAnalyzeCandidateDialog(candidates, onPick, onCancel) {
  if (!analyzeCandidateList || !analyzeCandidateDialog || !analyzeCandidateBackdrop) {
    setAnalyzeStatus("候補UIを読み込めませんでした。ページを再読み込みしてください。", true);
    return;
  }
  analyzeCandidateOnCancel = typeof onCancel === "function" ? onCancel : null;
  analyzeCandidateList.innerHTML = "";
  candidates.forEach((candidate) => {
    const button = document.createElement("button");
    button.className = "candidate-item";
    button.type = "button";
    const meta = [candidate.originalTitle, candidate.releaseDate || candidate.year, candidate.language, `TMDb ${candidate.tmdbId}`].filter(Boolean).join(" ・ ");
    const description = candidate.overview || "概要未登録。ポスター、公開日、原題、TMDb IDで確認してください。";
    button.innerHTML = `
      <span class="candidate-poster">${candidate.posterUrl ? `<img src="${escapeAttribute(candidate.posterUrl)}" alt="" />` : "NO IMAGE"}</span>
      <span class="candidate-body">
        <strong>${escapeHtml(candidate.title || "無題")}</strong>
        <small>${escapeHtml(meta || "詳細情報なし")}</small>
        <span class="${candidate.overview ? "" : "candidate-empty-overview"}">${escapeHtml(description)}</span>
      </span>
    `;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      queueMicrotask(() => {
        closeAnalyzeCandidateDialog({ triggerCancel: false });
        Promise.resolve(onPick(candidate)).catch((error) => {
          setAnalyzeStatus(error.message || "処理に失敗しました。", true);
        });
      });
    });
    analyzeCandidateList.append(button);
  });
  analyzeCandidateBackdrop.classList.remove("hidden");
  analyzeCandidateDialog.classList.remove("hidden");
  document.body.classList.add("dialog-open");
  analyzeCandidateCloseButton?.focus();
}

function closeAnalyzeCandidateDialog(options = {}) {
  if (!analyzeCandidateDialog || !analyzeCandidateBackdrop) return;
  const triggerCancel = options.triggerCancel ?? true;
  const done = analyzeCandidateOnCancel;
  analyzeCandidateOnCancel = null;
  analyzeCandidateDialog.classList.add("hidden");
  analyzeCandidateBackdrop.classList.add("hidden");
  if (!analyzeDialog.classList.contains("hidden")) {
    document.body.classList.add("dialog-open");
  } else {
    document.body.classList.remove("dialog-open");
  }
  if (triggerCancel && done) done();
}

candidateCloseButton.addEventListener("click", closeCandidateDialog);
candidateBackdrop.addEventListener("click", closeCandidateDialog);
analyzeCandidateCloseButton?.addEventListener("click", closeAnalyzeCandidateDialog);
analyzeCandidateBackdrop?.addEventListener("click", closeAnalyzeCandidateDialog);

function buildFetchErrorMessage(error) {
  const message = error.message || "情報を取得できませんでした。";
  if (message.includes("HTTP 403")) return `${message}\n\nこのサイトは自動取得をブロックしています。URL自体は保存できます。`;
  return message;
}

function applyFetchedInfo(data) {
  setFetchedInput(inputs.title, data.title);
  setFetchedInput(inputs.director, data.director);
  setFetchedInput(inputs.releaseDate, data.releaseDate || normalizeDateInput(data.year));
  setFetchedInput(inputs.releaseEndDate, data.releaseEndDate);
  setFetchedInput(inputs.genre, data.genre);
  setFetchedInput(inputs.cast, data.cast);
  setFetchedInput(inputs.description, data.description);
  setFetchedInput(inputs.posterUrl, data.posterUrl, { allowEmpty: true });
  setFetchedInput(inputs.sourceUrl, data.sourceUrl);
  setFetchedInput(inputs.tmdbId, data.tmdbId, { allowEmpty: true });
  setFetchedInput(inputs.runtime, data.runtime, { allowEmpty: true });
  setFetchedInput(inputs.watchProviders, data.watchProviders, { allowEmpty: true });
}

function setFetchedInput(input, value, options = {}) {
  if (!value && !options.allowEmpty) return;
  input.value = String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
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

function cleanText(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

async function readResponseJson(response) {
  const text = await response.text();
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: 応答が空です。node server.js が起動しているか確認してください。`);
    }
    return {};
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 200);
    const hint =
      trimmed === "Not found" || trimmed.startsWith("Not found")
        ? " API が静的404になっています。movietool フォルダで `node server.js` を起動し、http://localhost:5173/index.html から開いてください。"
        : "";
    throw new Error(`${preview} (HTTP ${response.status})${hint}`);
  }
}

function renderReverseBeats() {
  renderAnalyzeBeats();
}

function setAnalyzeBusy(isBusy, message = "処理中・・・") {
  if (!analyzeDialogBusyOverlay || !analyzeDialogBusyLabel) return;
  if (isBusy) {
    const isAnalyzing = message.includes("解析");
    analyzeDialogBusyLabel.textContent = message;
    analyzeDialogBusyOverlay.classList.remove("hidden");
    analyzeDialogBusyOverlay.setAttribute("aria-busy", "true");
    if (closeAnalyzeButton) closeAnalyzeButton.disabled = true;
    analyzeDialogBusyHint?.classList.toggle("hidden", !isAnalyzing);
    analyzeDialogBusyElapsed?.classList.toggle("hidden", !isAnalyzing);
    if (analyzeElapsedTimer) clearInterval(analyzeElapsedTimer);
    if (isAnalyzing) {
      let secs = 0;
      if (analyzeElapsedSeconds) analyzeElapsedSeconds.textContent = "0";
      analyzeElapsedTimer = setInterval(() => {
        secs += 1;
        if (analyzeElapsedSeconds) analyzeElapsedSeconds.textContent = String(secs);
      }, 1000);
    }
  } else {
    analyzeDialogBusyOverlay.classList.add("hidden");
    analyzeDialogBusyOverlay.removeAttribute("aria-busy");
    if (closeAnalyzeButton) closeAnalyzeButton.disabled = false;
    analyzeDialogBusyHint?.classList.add("hidden");
    analyzeDialogBusyElapsed?.classList.add("hidden");
    if (analyzeElapsedTimer) { clearInterval(analyzeElapsedTimer); analyzeElapsedTimer = null; }
  }
}

function hideScriptDbConfirmPanel() {
  scriptDbConfirmPanel?.classList.add("hidden");
  if (analyzeSourceType === "script" && scriptMode === "script_db") {
    analyzeTitleField?.classList.remove("hidden");
    analyzeScriptDbActions?.classList.remove("hidden");
  }
}

function showScriptDbConfirmPanel(displayTitle) {
  const t = String(displayTitle || "").trim() || "（タイトルなし）";
  if (scriptDbConfirmTitleText) scriptDbConfirmTitleText.textContent = t;
  analyzeTitleField?.classList.add("hidden");
  analyzeScriptDbActions?.classList.add("hidden");
  scriptDbConfirmPanel?.classList.remove("hidden");
  setAnalyzeStatus("", false);
}

function openAnalyzeSetup(sourceType) {
  analyzeSourceType = ["manual", "script"].includes(sourceType) ? sourceType : "manual";
  scriptMode = "script_db";
  editingAnalyzeId = null;
  reverseForm.reset();
  clearScriptDbPrefetch();
  updateScriptFileName();
  clearManualBeatFields();
  renderManualBeatFields();
  manualAnalyzeFields.classList.toggle("hidden", analyzeSourceType !== "manual");
  scriptAnalyzeFields.classList.toggle("hidden", analyzeSourceType !== "script");
  updateAnalyzeFormMode();
  const copy = {
    manual: ["Manual", "映画を観ながら15ビートを自分で埋めていく修行モード。"],
    script: ["Script", "脚本DB、または脚本ファイルからデータを取得・解析し、15ビートで逆箱します。"],
  };
  updateManualBeatGuides();
  analyzeDialogTitle.textContent = copy[analyzeSourceType][0];
  const subtitle = copy[analyzeSourceType][1];
  analyzeDialogSubtitle.textContent = subtitle;
  analyzeDialogSubtitle.classList.toggle("hidden", !String(subtitle || "").trim());
  extractAnalyzeButton.textContent = analyzeSourceType === "manual" ? "保存する" : "次の実装で接続";
  extractAnalyzeButton.disabled = analyzeSourceType !== "manual";
  deleteAnalyzeButton.classList.add("hidden");
  setAnalyzeStatus("", false);
  analyzeBackdrop.classList.remove("hidden");
  analyzeDialog.classList.remove("hidden");
  hideScriptDbConfirmPanel();
  reverseInputs.title.focus();
  refreshGeminiUsage();
}

async function refreshGeminiUsage() {
  if (!geminiUsageBar) return;
  try {
    const res = await fetch("/api/gemini-usage");
    if (!res.ok) return;
    const data = await res.json();
    const count = Number(data.count) || 0;
    const limit = Number(data.limit) || 20;
    if (geminiUsageText) geminiUsageText.textContent = `Gemini ${count} / ${limit} today`;
    if (geminiUsageReset) geminiUsageReset.textContent = resetLabel();
    geminiUsageBar.classList.remove("hidden");
  } catch { /* ignore */ }
}

function resetLabel() {
  const now = new Date();
  const jstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const jstMinutes = (utcMinutes + jstOffset) % (24 * 60);
  const remaining = (24 * 60 - jstMinutes);
  const h = Math.floor(remaining / 60);
  const m = remaining % 60;
  return `Reset in ${h}h ${m}m`;
}

function updateAnalyzeFormMode() {
  const isManual = analyzeSourceType === "manual";
  const isScript = analyzeSourceType === "script";
  reverseForm.classList.toggle("script-mode", isScript);
  analyzeTitleField.classList.toggle("hidden", isScript && scriptMode === "file_upload");
  analyzeRuntimeField.classList.toggle("hidden", !isManual);
  analyzeLoglineField.classList.toggle("hidden", !isManual);
  generateLoglineButton.classList.toggle("hidden", !isManual);
  analyzeTitleLabel.textContent = isScript ? "タイトル" : "映画タイトル";
  reverseInputs.title.placeholder = isScript ? "例: 花束みたいな恋をした" : "例: TALK TO ME";
  scriptModeToggle?.classList.toggle("hidden", !isScript);
  analyzeScriptDbActions?.classList.toggle("hidden", !isScript || scriptMode !== "script_db");
  scriptModeButtons.forEach((button) => {
    button.classList.toggle("filter-pill-active", button.dataset.scriptMode === scriptMode);
  });
  scriptDropZone?.classList.toggle("hidden", !isScript || scriptMode !== "file_upload");
  scriptUploadHelp?.classList.toggle("hidden", !isScript || scriptMode !== "file_upload");
  analyzeScriptUploadButton?.classList.toggle("hidden", !isScript || scriptMode !== "file_upload");
  analyzeFormActions?.classList.toggle("hidden", !isManual);
  if (!isScript || scriptMode !== "script_db") {
    scriptDbConfirmPanel?.classList.add("hidden");
  }
}

function setScriptMode(mode) {
  scriptMode = mode === "file_upload" ? "file_upload" : "script_db";
  if (scriptMode === "file_upload") {
    clearScriptDbPrefetch();
    hideScriptDbConfirmPanel();
  }
  updateAnalyzeFormMode();
  setAnalyzeStatus("", false);
  if (scriptMode === "file_upload") {
    analyzeScriptFileInput?.focus?.();
  } else {
    reverseInputs.title.focus();
  }
}

function clearScriptDbPrefetch() {
  scriptDbPrefetch = null;
}

async function runScriptDbSearch() {
  analyzeSourceType = "script";
  scriptMode = "script_db";
  updateAnalyzeFormMode();
  const title = reverseInputs.title.value.trim();
  if (!title) {
    setAnalyzeStatus("タイトルを入力してください。", true);
    return;
  }
  hideScriptDbConfirmPanel();
  clearScriptDbPrefetch();
  analyzeScriptSearchGeneration += 1;
  const generation = analyzeScriptSearchGeneration;
  setAnalyzeBusy(true, "検索中・・・");
  setAnalyzeStatus("", false);
  try {
    const response = await fetch(`/api/search?title=${encodeURIComponent(title)}`);
    const data = await readResponseJson(response);
    if (generation !== analyzeScriptSearchGeneration) return;
    if (!response.ok) throw new Error(data.error || "タイトル検索に失敗しました。");

    if (Array.isArray(data.candidates) && data.candidates.length > 1) {
      setAnalyzeBusy(false);
      openAnalyzeCandidateDialog(
        data.candidates,
        async (candidate) => {
          const displayTitle = pickCandidateDisplayTitle(candidate, title);
          const originalTitle = cleanText(candidate?.originalTitle || "");
          const searchTitle = originalTitle || displayTitle;
          const year = String(candidate?.year || "");
          reverseInputs.title.value = displayTitle;
          await fetchScriptThenConfirm(displayTitle, searchTitle, { originalTitle, year });
        },
        () => setAnalyzeStatus("候補選択をキャンセルしました。", true),
      );
      return;
    }

    let displayTitle, searchTitle, originalTitle, year;
    if (Array.isArray(data.candidates) && data.candidates.length === 1) {
      displayTitle = pickCandidateDisplayTitle(data.candidates[0], title);
      originalTitle = cleanText(data.candidates[0]?.originalTitle || "");
      searchTitle = originalTitle || displayTitle;
      year = String(data.candidates[0]?.year || "");
    } else {
      displayTitle = cleanText(data.title || title);
      searchTitle = displayTitle;
      originalTitle = "";
      year = "";
    }
    reverseInputs.title.value = displayTitle;
  } catch (error) {
    if (generation !== analyzeScriptSearchGeneration) return;
    setAnalyzeStatus(error.message || "タイトル候補の取得に失敗しました。", true);
    setAnalyzeBusy(false);
    return;
  }
  if (generation !== analyzeScriptSearchGeneration) return;
  setAnalyzeBusy(false);
  await fetchScriptThenConfirm(
    reverseInputs.title.value.trim(),
    reverseInputs.title.value.trim(),
    { originalTitle: "", year: "" },
  );
}

async function fetchScriptThenConfirm(displayTitle, searchTitle, { originalTitle = "", year = "" } = {}) {
  clearScriptDbPrefetch();
  analyzeScriptSearchGeneration += 1;
  const generation = analyzeScriptSearchGeneration;
  setAnalyzeBusy(true, "脚本を取得中・・・");
  setAnalyzeStatus("", false);
  try {
    const response = await fetch("/api/analyze/script-db/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: searchTitle || displayTitle, originalTitle, year }),
    });
    const data = await readResponseJson(response);
    if (generation !== analyzeScriptSearchGeneration) return;
    if (!response.ok) throw new Error(data.error || "脚本の取得に失敗しました。");
    const scriptSessionId = data.scriptSessionId;
    if (!scriptSessionId) throw new Error("脚本セッションの取得に失敗しました。");
    scriptDbPrefetch = {
      scriptSessionId,
      sourceUrl: data.sourceUrl || "",
      textLength: Number(data.textLength) || 0,
      title: displayTitle || cleanText(data.title || searchTitle),
    };
    showScriptDbConfirmPanel(scriptDbPrefetch.title);
  } catch (error) {
    if (generation !== analyzeScriptSearchGeneration) return;
    setAnalyzeStatus(error.message || "脚本の取得に失敗しました。", true);
  } finally {
    setAnalyzeBusy(false);
  }
}

async function runScriptDbConfirmedPipeline() {
  if (!scriptDbPrefetch?.scriptSessionId) {
    setAnalyzeStatus("脚本データが見つかりません。もう一度DB検索してください。", true);
    return;
  }
  analyzeScriptSearchGeneration += 1;
  const generation = analyzeScriptSearchGeneration;
  setAnalyzeBusy(true, "解析中・・・");
  setAnalyzeStatus("", false);
  try {
    await extractAnalyzeBeats({ scriptMode: "script_db", scriptSessionId: scriptDbPrefetch.scriptSessionId });
  } catch (error) {
    if (generation !== analyzeScriptSearchGeneration) return;
    setAnalyzeStatus(error.message || "解析に失敗しました。", true);
  } finally {
    setAnalyzeBusy(false);
  }
}

async function runScriptUploadAnalyze() {
  analyzeSourceType = "script";
  scriptMode = "file_upload";
  updateAnalyzeFormMode();
  setAnalyzeBusy(true, "解析中・・・");
  setAnalyzeStatus("", false);
  try {
    await extractAnalyzeBeats({ scriptMode: "file_upload" });
  } finally {
    setAnalyzeBusy(false);
  }
}

function pickCandidateDisplayTitle(candidate, fallbackTitle) {
  const preferred = cleanText(candidate?.title || "");
  const original = cleanText(candidate?.originalTitle || "");
  return preferred || original || fallbackTitle;
}

function closeAnalyzeSetup() {
  if (analyzeDialogBusyOverlay && !analyzeDialogBusyOverlay.classList.contains("hidden")) return;
  analyzeCompletePanel?.classList.add("hidden");
  setAnalyzeBusy(false);
  closeAnalyzeCandidateDialog({ triggerCancel: false });
  hideScriptDbConfirmPanel();
  clearScriptDbPrefetch();
  analyzeBackdrop.classList.add("hidden");
  analyzeDialog.classList.add("hidden");
}

function clearManualBeatFields() {
  manualBeatFields.querySelectorAll("[data-manual-beat]").forEach((input) => {
    input.value = "";
  });
  manualBeatFields.querySelectorAll("[data-manual-time]").forEach((picker) => {
    picker.dataset.touched = "";
    setTimePickerSeconds(picker, 0);
  });
}

function renderManualBeatFields() {
  if (!manualBeatFields || manualBeatFields.children.length) return;
  analyzeBeatDefinitions.forEach((beat, index) => {
    const field = manualBeatTemplate.content.firstElementChild.cloneNode(true);
    field.querySelector(".manual-beat-head span").textContent = `${String(index + 1).padStart(2, "0")} ${beat.label}`;
    field.querySelector(".manual-beat-head small").dataset.manualGuide = beat.id;
    field.querySelector(".manual-beat-head small").textContent = getManualBeatGuide(beat);
    field.querySelector("[data-manual-drift]").dataset.manualDrift = beat.id;
    const picker = field.querySelector(".time-picker");
    picker.dataset.manualTime = beat.id;
    const [hourSelect, minuteSelect, secondSelect] = picker.querySelectorAll("select");
    hourSelect.setAttribute("aria-label", `${beat.label} 時`);
    minuteSelect.setAttribute("aria-label", `${beat.label} 分`);
    secondSelect.setAttribute("aria-label", `${beat.label} 秒`);
    hourSelect.innerHTML = buildTimeOptions(0, 5);
    minuteSelect.innerHTML = buildTimeOptions(0, 59);
    secondSelect.innerHTML = buildTimeOptions(0, 59);
    const textarea = field.querySelector("textarea");
    textarea.dataset.manualBeat = beat.id;
    textarea.placeholder = beat.placeholder;
    manualBeatFields.append(field);
  });
  manualBeatFields.querySelectorAll(".time-picker select").forEach((select) => {
    select.addEventListener("change", () => {
      select.closest(".time-picker").dataset.touched = "true";
      updateManualBeatDrifts();
    });
  });
  reverseInputs.runtime.oninput = () => {
    updateManualBeatGuides();
    updateManualBeatDrifts();
  };
  updateManualBeatDrifts();
}

function getManualBeatGuide(beat) {
  const runtime = Number.parseInt(reverseInputs.runtime.value, 10);
  const timeGuide = Number.isFinite(runtime) && runtime > 0 ? formatBeatTimestamp(runtime * 60 * beat.ratio) : "--:--";
  return `目安 ${timeGuide} / p.${beat.page}`;
}

function updateManualBeatGuides() {
  analyzeBeatDefinitions.forEach((beat) => {
    const guide = manualBeatFields.querySelector(`[data-manual-guide="${beat.id}"]`);
    if (guide) guide.textContent = getManualBeatGuide(beat);
    const picker = manualBeatFields.querySelector(`[data-manual-time="${beat.id}"]`);
    if (picker && picker.dataset.touched !== "true") {
      setTimePickerSeconds(picker, getManualBeatGuideSeconds(beat));
    }
  });
  updateManualBeatDrifts();
}

function getManualBeatGuideSeconds(beat) {
  const runtime = Number.parseInt(reverseInputs.runtime.value, 10);
  return Number.isFinite(runtime) && runtime > 0 ? Math.round(runtime * 60 * beat.ratio) : 0;
}

function updateManualBeatDrifts() {
  analyzeBeatDefinitions.forEach((beat) => {
    const drift = manualBeatFields.querySelector(`[data-manual-drift="${beat.id}"]`);
    const picker = manualBeatFields.querySelector(`[data-manual-time="${beat.id}"]`);
    if (!drift || !picker) return;
    const actualSeconds = getTimePickerSeconds(picker);
    const theorySeconds = getManualBeatGuideSeconds(beat);
    const diffSeconds = actualSeconds - theorySeconds;
    drift.textContent = `差分 ${formatDrift(diffSeconds)}`;
    drift.classList.remove("beat-drift-neutral", "beat-drift-early", "beat-drift-late");
    drift.classList.add(getDriftClass(diffSeconds));
  });
}

function setTimePickerSeconds(picker, seconds) {
  const value = Math.max(0, Math.round(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = value % 60;
  const [hourSelect, minuteSelect, secondSelect] = picker.querySelectorAll("select");
  hourSelect.value = String(Math.min(hours, 5));
  minuteSelect.value = String(minutes);
  secondSelect.value = String(rest);
}

function getTimePickerSeconds(picker) {
  const [hours, minutes, seconds] = [...picker.querySelectorAll("select")].map((select) => Number(select.value) || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function buildTimeOptions(min, max) {
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index;
    const label = String(value).padStart(2, "0");
    return `<option value="${value}">${label}</option>`;
  }).join("");
}

async function extractAnalyzeBeats(options = {}) {
  const title = reverseInputs.title.value.trim();
  const runtime = reverseInputs.runtime.value.trim();
  const effectiveScriptMode = options.scriptMode || scriptMode;
  if (analyzeSourceType === "manual" && (!title || !runtime)) {
    setAnalyzeStatus("映画タイトルとruntimeを入力してください。", true);
    return;
  }
  if (analyzeSourceType === "script" && effectiveScriptMode === "script_db" && !title) {
    setAnalyzeStatus("タイトルを入力してください。", true);
    return;
  }
  const scriptSessionId = options.scriptSessionId || scriptDbPrefetch?.scriptSessionId || "";
  if (analyzeSourceType === "script" && effectiveScriptMode === "script_db" && !cleanText(scriptSessionId)) {
    setAnalyzeStatus("先に「脚本DBから取得」を完了してください。", true);
    return;
  }
  if (analyzeSourceType === "script" && effectiveScriptMode === "file_upload" && !analyzeScriptFileInput.files?.[0]) {
    setAnalyzeStatus("脚本ファイルを指定してください。", true);
    return;
  }

  extractAnalyzeButton.disabled = true;
  analyzeScriptDbSearchButton?.setAttribute("disabled", "true");
  analyzeScriptUploadButton?.setAttribute("disabled", "true");
  setAnalyzeStatus(
    analyzeSourceType === "script" && effectiveScriptMode === "script_db"
      ? "Gemini で15ビートを抽出しています。"
      : analyzeSourceType === "script"
        ? "脚本を解析しています。"
        : "理論値を生成しています。",
    false,
  );
  try {
    const requestBody = { title, runtime, source_type: analyzeSourceType };
    let sourceMeta = { method: "manual", sourceUrl: "", fileName: "", model: "" };
    if (analyzeSourceType === "script") {
      const scriptFile = analyzeScriptFileInput.files?.[0];
      if (effectiveScriptMode === "file_upload") {
        const uploaded = await uploadScriptFile(scriptFile);
        requestBody.sourceText = uploaded.text;
        requestBody.title = uploaded.title || requestBody.title || "";
        sourceMeta = { method: "file_upload", sourceUrl: "", fileName: scriptFile?.name || "", model: "" };
      } else {
        requestBody.scriptSessionId = cleanText(scriptSessionId);
        sourceMeta = { method: "script_db", sourceUrl: "", fileName: "", model: "" };
      }
    }
    const response = await fetch("/api/analyze/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const data = await readResponseJson(response);
    if (!response.ok) throw new Error(data.error || "開始に失敗しました。");
    const beats = analyzeSourceType === "manual" ? buildManualAnalyzeBeats(data.beats || []) : normalizeAnalyzeBeats(data.beats || []);
    const payload = {
      sourceType: analyzeSourceType,
      title: data.title || requestBody.title || title || "無題",
      runtime: data.runtimeMinutes || runtime || "",
      beats,
      logline: analyzeSourceType === "manual"
        ? (analyzeLoglineInput.value.trim() || data.logline || "")
        : (data.logline || analyzeLoglineInput.value.trim() || ""),
      storyCore: data.storyCore || null,
      sourceMeta: normalizeAnalyzeSourceMeta(data.sourceMeta, { sourceType: analyzeSourceType, ...sourceMeta }),
    };
    if (editingAnalyzeId) {
      reverseBeats = reverseBeats.map((item) => item.id === editingAnalyzeId ? { ...item, ...payload, updatedAt: Date.now() } : item);
    } else {
      reverseBeats.unshift({ id: crypto.randomUUID(), ...payload, createdAt: Date.now(), updatedAt: "" });
    }
    saveReverseBeats();
    renderAnalyzeBeats();
    analyzeCompletePanel?.classList.remove("hidden");
    refreshGeminiUsage();
  } catch (error) {
    setAnalyzeStatus(error.message || "保存に失敗しました。", true);
  } finally {
    extractAnalyzeButton.disabled = false;
    analyzeScriptDbSearchButton?.removeAttribute("disabled");
    analyzeScriptUploadButton?.removeAttribute("disabled");
  }
}

function getManualBeatNotes() {
  return Object.fromEntries([...manualBeatFields.querySelectorAll("[data-manual-beat]")]
    .map((input) => [input.dataset.manualBeat, input.value.trim()]));
}

function buildManualAnalyzeBeats(beats) {
  const manualNotes = getManualBeatNotes();
  const manualTimes = getManualBeatTimes();
  return normalizeAnalyzeBeats(beats).map((beat) => ({
    ...beat,
    actual: {
      ...beat.actual,
      startSeconds: manualTimes[beat.id],
      startTime: formatBeatTimestamp(manualTimes[beat.id]),
      summary: manualNotes[beat.id] || "",
    },
  }));
}

function getManualBeatTimes() {
  return Object.fromEntries([...manualBeatFields.querySelectorAll("[data-manual-time]")]
    .map((picker) => {
      const [hours, minutes, seconds] = [...picker.querySelectorAll("select")].map((select) => Number(select.value) || 0);
      return [picker.dataset.manualTime, hours * 3600 + minutes * 60 + seconds];
    }));
}

async function uploadScriptFile(file) {
  if (!file) throw new Error("脚本ファイルを指定してください。");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", reverseInputs.title.value.trim());
  const response = await fetch("/api/analyze/upload", { method: "POST", body: formData });
  const data = await readResponseJson(response);
  if (!response.ok) throw new Error(data.error || "脚本ファイルのアップロードに失敗しました。");
  const text = String(data.text || "");
  if (!text.trim()) throw new Error("脚本からテキストを抽出できませんでした。テキスト脚本（.txt/.md）またはテキストPDF/DOCX/PPTXを試してください。");
  return { text, title: String(data.title || "") };
}

function updateScriptFileName() {
  const file = analyzeScriptFileInput.files?.[0];
  if (scriptFileName) scriptFileName.textContent = file ? file.name : "ファイルを選択、またはここにドラッグ&ドロップ";
}

function handleScriptDragOver(event) {
  event.preventDefault();
  scriptDropZone.classList.add("drag-over");
}

function handleScriptDragLeave() {
  scriptDropZone.classList.remove("drag-over");
}

function handleScriptDrop(event) {
  event.preventDefault();
  scriptDropZone.classList.remove("drag-over");
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  analyzeScriptFileInput.files = transfer.files;
  updateScriptFileName();
}

async function generateAnalyzeLogline() {
  const title = reverseInputs.title.value.trim();
  const notes = getManualBeatNotes();
  const beats = analyzeBeatDefinitions.map((beat) => ({
    id: beat.id,
    label: beat.label,
    summary: notes[beat.id] || "",
  })).filter((beat) => beat.summary);
  if (!beats.length) {
    setAnalyzeStatus("ログライン生成には、先に15ビートの内容メモを入力してください。", true);
    return;
  }
  generateLoglineButton.disabled = true;
  setAnalyzeStatus("ログラインを生成しています。", false);
  try {
    const response = await fetch("/api/analyze/logline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, beats }),
    });
    const data = await readResponseJson(response);
    if (!response.ok) throw new Error(data.error || "ログライン生成に失敗しました。");
    analyzeLoglineInput.value = data.logline || "";
    setAnalyzeStatus("ログラインを反映しました。", false);
  } catch (error) {
    setAnalyzeStatus(error.message || "ログライン生成に失敗しました。", true);
  } finally {
    generateLoglineButton.disabled = false;
  }
}

function deleteCurrentAnalyze() {
  deleteAnalyzeById(editingAnalyzeId);
}

function deleteAnalyzeById(id) {
  const item = reverseBeats.find((entry) => entry.id === id);
  if (!item) return;
  openConfirmDialog({
    title: "Analyzeデータを削除しますか？",
    message: `「${item.title}」のAnalyzeデータを削除します。この操作は元に戻せません。`,
    okText: "削除する",
    onConfirm: () => {
      reverseBeats = reverseBeats.filter((entry) => entry.id !== id);
      editingAnalyzeId = null;
      detailAnalyzeId = null;
      saveReverseBeats();
      closeAnalyzeSetup();
      closeAnalyzeDetail();
    },
  });
}

function normalizeAnalyzeBeats(beats) {
  return beats.map((beat) => {
    const theory = beat.theory || {};
    const actual = beat.actual || {};
    const diff = beat.diff || {};
    const actualSeconds = Number.isFinite(actual.startSeconds) ? actual.startSeconds : null;
    return {
      id: beat.id || crypto.randomUUID(),
      name: beat.name || "",
      label: beat.label || beat.name || "",
      theory,
      actual: {
        ...actual,
        startSeconds: actualSeconds,
        startTime: actualSeconds !== null ? formatBeatTimestamp(actualSeconds) : (actual.startTime || null),
        summary: actual.summary || "",
        structuralReason: actual.structuralReason || "",
        scriptPositionPercent: actual.scriptPositionPercent ?? null,
        pageEstimate: actual.pageEstimate ?? null,
      },
      diff,
    };
  });
}

function renderAnalyzeBeats() {
  reverseList.innerHTML = "";
  const visibleItems = getVisibleAnalyzeItems();
  updateAnalyzeCounts();
  document.querySelector("#reverseEmptyState").classList.toggle("hidden", visibleItems.length > 0);
  visibleItems.forEach((item) => {
    const card = analyzeCardTemplate.content.firstElementChild.cloneNode(true);
    const beats = Array.isArray(item.beats) ? item.beats : [];
    card.querySelector(".analyze-beat-index").textContent = getAnalyzeSourceLabel(item.sourceType);
    card.querySelector("h3").textContent = item.title;
    card.querySelector(".analyze-card-meta").textContent = `${item.runtime ? `${item.runtime}分` : "runtime未登録"} · ${beats.length || 0} beats`;
    card.querySelector(".analyze-summary").textContent = item.logline || "ログライン未登録";
    card.querySelector(".analyze-card-footer span").textContent = formatAnalyzeCreatedAt(item.createdAt);
    card.setAttribute("aria-label", `${item.title} のAnalyze詳細を開く`);
    card.addEventListener("click", () => openAnalyzeDetail(item.id));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openAnalyzeDetail(item.id);
    });
    reverseList.append(card);
  });
}

function getVisibleAnalyzeItems() {
  const query = analyzeSearchInput.value.trim().toLowerCase();
  return reverseBeats
    .filter((item) => currentAnalyzeFilter === "all" || (item.sourceType || "manual") === currentAnalyzeFilter)
    .filter((item) => {
      if (!query) return true;
      const haystack = [
        item.title,
        item.runtime,
        item.logline,
        item.sourceType,
        ...(Array.isArray(item.beats) ? item.beats.map((beat) => `${beat.label || ""} ${beat.actual?.summary || ""}`) : []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (analyzeSortSelect.value === "titleAsc") return String(a.title || "").localeCompare(String(b.title || ""), "ja");
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function updateAnalyzeCounts() {
  const counts = {
    all: reverseBeats.length,
    manual: reverseBeats.filter((item) => (item.sourceType || "manual") === "manual").length,
    script: reverseBeats.filter((item) => item.sourceType === "script").length,
  };
  Object.entries(counts).forEach(([key, value]) => {
    if (analyzeCounts[key]) analyzeCounts[key].textContent = value;
  });
}

function openAnalyzeEdit(id) {
  const item = reverseBeats.find((entry) => entry.id === id);
  if (!item) return;
  closeAnalyzeDetail();
  editingAnalyzeId = id;
  analyzeSourceType = item.sourceType || "manual";
  reverseForm.reset();
  clearManualBeatFields();
  manualAnalyzeFields.classList.toggle("hidden", analyzeSourceType !== "manual");
  scriptAnalyzeFields.classList.toggle("hidden", analyzeSourceType !== "script");
  updateAnalyzeFormMode();
  reverseInputs.title.value = item.title || "";
  reverseInputs.runtime.value = item.runtime || "";
  analyzeLoglineInput.value = item.logline || "";
  populateManualBeatFields(Array.isArray(item.beats) ? item.beats : []);
  updateManualBeatGuides();
  analyzeDialogTitle.textContent = getAnalyzeSourceLabel(analyzeSourceType);
  analyzeDialogSubtitle.textContent = "保存済みのAnalyzeデータを編集します。";
  extractAnalyzeButton.textContent = analyzeSourceType === "script" ? "Scriptを再解析" : "保存する";
  extractAnalyzeButton.disabled = false;
  deleteAnalyzeButton.classList.remove("hidden");
  setAnalyzeStatus("", false);
  analyzeBackdrop.classList.remove("hidden");
  analyzeDialog.classList.remove("hidden");
}

function openAnalyzeDetail(id) {
  const item = reverseBeats.find((entry) => entry.id === id);
  if (!item) return;
  detailAnalyzeId = id;
  const beats = Array.isArray(item.beats) ? normalizeAnalyzeBeats(item.beats) : [];
  analyzeDetailTitle.textContent = item.title || "無題";
  analyzeDetailMeta.textContent = [getAnalyzeSourceLabel(item.sourceType), item.runtime ? `${item.runtime}分` : "", `${beats.length} beats`].filter(Boolean).join(" ・ ");
  analyzeDetailLogline.textContent = item.logline || "ログライン未登録";
  analyzeDetailBeats.innerHTML = "";
  beats.forEach((beat, index) => {
    const row = analyzeDetailBeatTemplate.content.firstElementChild.cloneNode(true);
    const actualSeconds = Number.isFinite(beat.actual.startSeconds) ? beat.actual.startSeconds : 0;
    const theorySeconds = Number.isFinite(beat.theory.targetSeconds) ? beat.theory.targetSeconds : 0;
    const diffSeconds = actualSeconds - theorySeconds;
    row.querySelector("span").textContent = String(index + 1).padStart(2, "0");
    row.querySelector("strong").textContent = beat.label;
    row.querySelector("small").textContent = `実測 ${formatBeatTimestamp(actualSeconds)} / 理論 ${formatBeatTimestamp(theorySeconds)} / 差分 ${formatDrift(diffSeconds)}`;
    row.classList.add(getDriftClass(diffSeconds));
    row.querySelector("p").textContent = beat.actual.summary || "未入力";
    analyzeDetailBeats.append(row);
  });
  analyzeDetailBackdrop.classList.remove("hidden");
  analyzeDetailDialog.classList.remove("hidden");
  analyzeDetailDialog.classList.remove("detail-entering");
  requestAnimationFrame(() => analyzeDetailDialog.classList.add("detail-entering"));
  document.body.classList.add("dialog-open");
}

function closeAnalyzeDetail() {
  analyzeDetailBackdrop.classList.add("hidden");
  analyzeDetailDialog.classList.add("hidden");
  analyzeDetailDialog.classList.remove("detail-entering");
  document.body.classList.remove("dialog-open");
}

function populateManualBeatFields(beats) {
  const normalized = normalizeAnalyzeBeats(beats);
  normalized.forEach((beat) => {
    const textarea = manualBeatFields.querySelector(`[data-manual-beat="${beat.id}"]`);
    if (textarea) textarea.value = beat.actual.summary || "";
    const picker = manualBeatFields.querySelector(`[data-manual-time="${beat.id}"]`);
    if (picker) {
      picker.dataset.touched = "true";
      setTimePickerSeconds(picker, beat.actual.startSeconds || 0);
    }
  });
}

function getAnalyzeSourceLabel(sourceType) {
  const labels = { manual: "Manual", script: "Script", video: "Video" };
  return labels[sourceType] || "Manual";
}

function formatAnalyzeCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatBeatTimestamp(seconds) {
  if (!Number.isFinite(Number(seconds))) return "--:--:--";
  const value = Math.max(0, Math.round(Number(seconds)));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = value % 60;
  const two = (number) => String(number).padStart(2, "0");
  return `${two(hours)}:${two(minutes)}:${two(rest)}`;
}

function formatDrift(seconds) {
  const value = Math.round(Number(seconds) || 0);
  if (Math.abs(value) < 1) return "±0秒";
  const sign = value > 0 ? "+" : "-";
  const absolute = Math.abs(value);
  const minutes = Math.floor(absolute / 60);
  const rest = absolute % 60;
  if (minutes > 0 && rest > 0) return `${sign}${minutes}分${rest}秒`;
  if (minutes > 0) return `${sign}${minutes}分`;
  return `${sign}${rest}秒`;
}

function getDriftClass(seconds) {
  const value = Math.round(Number(seconds) || 0);
  if (Math.abs(value) < 30) return "beat-drift-neutral";
  return value < 0 ? "beat-drift-early" : "beat-drift-late";
}

function setAnalyzeStatus(message, isError) {
  analyzeStatus.textContent = message;
  analyzeStatus.classList.toggle("status-error", Boolean(isError));
}

function formatDisplayDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(?:19|20)\d{2}$/.test(raw)) return `${raw}年`;
  const normalized = normalizeDateInput(raw);
  if (!normalized) return raw;
  const [year, month, day] = normalized.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function normalizeDateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const isoDate = raw.match(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const japaneseDate = raw.match(/((?:19|20)\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (japaneseDate) return `${japaneseDate[1]}-${japaneseDate[2].padStart(2, "0")}-${japaneseDate[3].padStart(2, "0")}`;
  return "";
}

const savedTab = localStorage.getItem(STORAGE_TAB_KEY) || "movies";
switchTab(savedTab);
saveAndRender();
renderReverseBeats();
