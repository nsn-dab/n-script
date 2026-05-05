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
    description: "東京・渋谷の公共トイレ清掃員の日々を描く、静かな余韻のあるドラマ。",
    note: "静かな日にゆっくり見たい。",
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
    description: "砂の惑星アラキスを舞台に、運命と復讐が交差する壮大なSF続編。",
    note: "大きいスクリーン向き。",
    createdAt: Date.now() - 2000,
  },
];

let movies = loadMovies();
let reverseBeats = loadReverseBeats();
let editingId = null;
let editingReverseBeatId = null;
let selectedReferenceFileName = "";
let pendingConfirmAction = null;
let detailMovieId = null;

const form = document.querySelector("#movieForm");
const openFormButton = document.querySelector("#openFormButton");
const closeFormButton = document.querySelector("#closeFormButton");
const formBackdrop = document.querySelector("#formBackdrop");
const confirmBackdrop = document.querySelector("#confirmBackdrop");
const detailBackdrop = document.querySelector("#detailBackdrop");
const confirmDialog = document.querySelector("#confirmDialog");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmMessage = document.querySelector("#confirmMessage");
const confirmCancelButton = document.querySelector("#confirmCancelButton");
const confirmOkButton = document.querySelector("#confirmOkButton");
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
const cancelEditButton = document.querySelector("#cancelEditButton");
const movieList = document.querySelector("#movieList");
const emptyState = document.querySelector("#emptyState");
const movieCount = document.querySelector("#movieCount");
const allMovieCount = document.querySelector("#allMovieCount");
const template = document.querySelector("#movieTemplate");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const fetchInfoButton = document.querySelector("#fetchInfoButton");
const fetchTitleInfoButton = document.querySelector("#fetchTitleInfoButton");
const pageTitle = document.querySelector("#pageTitle");
const pageSubtitle = document.querySelector("#pageSubtitle");
const reverseList = document.querySelector("#reverseList");
const reverseCount = document.querySelector("#reverseCount");
const reverseTemplate = document.querySelector("#reverseBeatTemplate");
const reverseForm = document.querySelector("#reverseForm");
const referenceFileNameDisplay = document.querySelector("#referenceFileName");
const saveReverseBeatButton = document.querySelector("#saveReverseBeatButton");
const cancelReverseEditButton = document.querySelector("#cancelReverseEditButton");
const tabButtons = document.querySelectorAll(".tab-button[data-tab]");
const tabPanels = document.querySelectorAll(".tab-panel");

const tabCopy = {
  movies: {
    title: "Watch",
    subtitle: "心がときめく映画を一緒に見つけよう。",
  },
  reverse: {
    title: "Box",
    subtitle: "物語の構造をほどいて、次の創作に残しておこう。",
  },
};

const inputs = {
  title: document.querySelector("#titleInput"),
  director: document.querySelector("#directorInput"),
  releaseDate: document.querySelector("#releaseDateInput"),
  releaseEndDate: document.querySelector("#releaseEndDateInput"),
  genre: document.querySelector("#genreInput"),
  cast: document.querySelector("#castInput"),
  sourceUrl: document.querySelector("#sourceUrlInput"),
  posterUrl: document.querySelector("#posterUrlInput"),
  description: document.querySelector("#descriptionInput"),
  note: document.querySelector("#noteInput"),
};

const reverseInputs = {
  referenceUrl: document.querySelector("#referenceUrlInput"),
  referenceFile: document.querySelector("#referenceFileInput"),
  title: document.querySelector("#reverseTitleInput"),
  beats: document.querySelector("#reverseBeatsInput"),
  note: document.querySelector("#reverseNoteInput"),
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()]));

  if (editingId) {
    movies = movies.map((movie) => (movie.id === editingId ? { ...movie, ...payload } : movie));
    stopEditing();
  } else {
    movies.unshift({ id: crypto.randomUUID(), ...payload, createdAt: Date.now() });
    form.reset();
    inputs.posterUrl.value = "";
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
cancelEditButton.addEventListener("click", () => {
  stopEditing();
  closeForm();
});
searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
fetchInfoButton.addEventListener("click", fetchMovieInfo);
fetchTitleInfoButton.addEventListener("click", fetchMovieInfoByTitle);
saveReverseBeatButton.addEventListener("click", saveReverseBeat);
cancelReverseEditButton.addEventListener("click", stopEditingReverseBeat);
document.querySelector("#referenceFileInput").addEventListener("change", handleReferenceFileChange);
tabButtons.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));

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
    description: movie.description || "",
    note: movie.note || "",
    createdAt: movie.createdAt || Date.now(),
  };
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
  return {
    id: item.id || crypto.randomUUID(),
    referenceUrl: item.referenceUrl || "",
    referenceFileName: item.referenceFileName || "",
    title: item.title || "無題",
    beats: item.beats || "",
    note: item.note || "",
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || "",
  };
}

function saveReverseBeats() {
  localStorage.setItem(STORAGE_BEATS_KEY, JSON.stringify(reverseBeats));
  renderReverseBeats();
}

function switchTab(tabName) {
  const copy = tabCopy[tabName] || tabCopy.movies;
  pageTitle.textContent = copy.title;
  pageSubtitle.textContent = copy.subtitle;
  tabButtons.forEach((button) => {
    const selected = button.dataset.tab === tabName;
    button.classList.toggle("tab-active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  tabPanels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.tab !== tabName));
  localStorage.setItem(STORAGE_TAB_KEY, tabName);
  if (tabName === "reverse") renderReverseBeats();
}

function render() {
  const visibleMovies = getVisibleMovies();
  movieList.innerHTML = "";
  emptyState.classList.toggle("hidden", visibleMovies.length > 0);
  movieCount.textContent = `${visibleMovies.length} movies`;
  allMovieCount.textContent = movies.length;

  visibleMovies.forEach((movie) => {
    const item = template.content.firstElementChild.cloneNode(true);
    const poster = item.querySelector(".movie-poster");
    const posterImage = poster.querySelector("img");
    const posterFallback = poster.querySelector("span");
    const heading = item.querySelector("h3");
    const description = item.querySelector(".description-line");
    const note = item.querySelector(".note-line");

    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `${movie.title} の詳細を開く`);
    setPoster(poster, posterImage, posterFallback, movie);
    heading.textContent = movie.title;
    description.textContent = movie.description || "概要なし";
    description.classList.toggle("muted-empty", !movie.description);
    note.textContent = movie.note ? `メモ: ${movie.note}` : "";
    note.classList.toggle("hidden", !movie.note);
    item.addEventListener("click", () => openMovieDetail(movie.id));
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openMovieDetail(movie.id);
    });
    movieList.append(item);
  });
}

function getVisibleMovies() {
  const query = searchInput.value.trim().toLowerCase();
  return movies
    .filter((movie) => {
      const haystack = [movie.title, movie.director, movie.cast, movie.genre, movie.releaseDate, movie.releaseEndDate, movie.sourceUrl, movie.description, movie.note]
        .join(" ")
        .toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => {
      if (sortSelect.value === "titleAsc") return a.title.localeCompare(b.title, "ja");
      return b.createdAt - a.createdAt;
    });
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
  formTitle.textContent = "映画を編集";
  submitButton.textContent = "更新する";
  cancelEditButton.classList.remove("hidden");
  openForm();
}

function stopEditing() {
  editingId = null;
  form.reset();
  inputs.posterUrl.value = "";
  formTitle.textContent = "映画を追加";
  submitButton.textContent = "追加する";
  cancelEditButton.classList.add("hidden");
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
  detailTitle.textContent = movie.title;
  detailMeta.textContent = buildDetailMeta(movie);
  detailDescription.textContent = movie.description || "概要なし";
  detailDescription.classList.toggle("muted-empty", !movie.description);
  detailNote.textContent = movie.note || "メモなし";
  detailNote.classList.toggle("muted-empty", !movie.note);
  renderDetailFields(movie);
  setPoster(detailPoster, detailPosterImage, detailPosterFallback, movie);
  movieDetailDialog.classList.remove("hidden");
  detailBackdrop.classList.remove("hidden");
  document.body.classList.add("dialog-open");
  setTimeout(() => closeDetailButton.focus(), 0);
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
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "映画情報を取得できませんでした。");
    applyFetchedInfo(data);
  } catch (error) {
    alert(buildFetchErrorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = defaultLabel;
  }
}

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
}

function setFetchedInput(input, value, options = {}) {
  if (!value && !options.allowEmpty) return;
  input.value = String(value || "").trim();
}

function handleReferenceFileChange(event) {
  const file = event.target.files?.[0];
  selectedReferenceFileName = file ? file.name : "";
  referenceFileNameDisplay.textContent = selectedReferenceFileName;
}

function saveReverseBeat() {
  const url = reverseInputs.referenceUrl.value.trim();
  const title = reverseInputs.title.value.trim();
  const beats = reverseInputs.beats.value.trim();
  const note = reverseInputs.note.value.trim();
  if (!title || !beats || (!url && !selectedReferenceFileName)) {
    alert("対象映画タイトル、参照URLまたはファイル、15ビートの逆箱を入力してください。");
    return;
  }

  const payload = { referenceUrl: url, referenceFileName: selectedReferenceFileName, title, beats, note };
  if (editingReverseBeatId) {
    reverseBeats = reverseBeats.map((item) => (item.id === editingReverseBeatId ? { ...item, ...payload, updatedAt: Date.now() } : item));
    saveReverseBeats();
    stopEditingReverseBeat();
    return;
  }

  reverseBeats.unshift({ id: crypto.randomUUID(), ...payload, createdAt: Date.now(), updatedAt: "" });
  saveReverseBeats();
  resetReverseForm();
}

function startEditingReverseBeat(id) {
  const item = reverseBeats.find((entry) => entry.id === id);
  if (!item) return;
  editingReverseBeatId = id;
  reverseInputs.referenceUrl.value = item.referenceUrl || "";
  reverseInputs.title.value = item.title || "";
  reverseInputs.beats.value = item.beats || "";
  reverseInputs.note.value = item.note || "";
  selectedReferenceFileName = item.referenceFileName || "";
  referenceFileNameDisplay.textContent = selectedReferenceFileName;
  saveReverseBeatButton.textContent = "更新する";
  cancelReverseEditButton.classList.remove("hidden");
  reverseInputs.title.focus();
}

function stopEditingReverseBeat() {
  editingReverseBeatId = null;
  resetReverseForm();
  saveReverseBeatButton.textContent = "保存する";
  cancelReverseEditButton.classList.add("hidden");
}

function resetReverseForm() {
  reverseForm.reset();
  selectedReferenceFileName = "";
  referenceFileNameDisplay.textContent = "";
}

function renderReverseBeats() {
  reverseList.innerHTML = "";
  reverseCount.textContent = reverseBeats.length;
  document.querySelector("#reverseEmptyState").classList.toggle("hidden", reverseBeats.length > 0);
  reverseBeats.forEach((item) => {
    const card = reverseTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector("h3").textContent = item.title;
    card.querySelector(".beat-meta").textContent = item.referenceFileName || item.referenceUrl || "参照なし";
    card.querySelector(".reverse-beats").textContent = item.beats;
    card.querySelector(".reverse-note").textContent = item.note || "メモなし";
    card.querySelector(".edit-button").addEventListener("click", () => startEditingReverseBeat(item.id));
    card.querySelector(".delete-button").addEventListener("click", () => {
      reverseBeats = reverseBeats.filter((entry) => entry.id !== item.id);
      if (editingReverseBeatId === item.id) stopEditingReverseBeat();
      saveReverseBeats();
    });
    reverseList.append(card);
  });
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
