const SEEDREAM_PREFIX =
  "dynamic angled iphone shot, warm storytelling composition, dynamic tilted iphone shot, slight motion blur for realism, candid cinematic everyday moment, shot on iphone, phone quality, phone grain, iphone colors, dynamic angle, storytelling composition, dramatic composition, flirty vibe, low contrast, no studio lighting, slight hand shake, imperfect crop, iPhone front-camera,";

const CHARACTER_SUFFIX = "Plain gray studio wall background, natural indoor phone lighting, raw realistic iPhone photo";
const BACKGROUND_REMOVAL_ENABLED = false;

const MODELS = {
  "nano-banana-pro": { label: "Nano Banana Pro", resolutions: ["1K", "2K", "4K"] },
  "seedream-4.5": { label: "SeeDream 4.5", resolutions: ["2K", "4K"] },
  "gpt-image-2": { label: "GPT Image 2", resolutions: ["1K", "2K", "4K"] },
};

const TASKS = [
  {
    id: "appearance",
    title: "NB Appearance Options",
    modelLabel: "Nano Banana Pro",
    defaultModel: "nano-banana-pro",
    modelOptions: ["nano-banana-pro"],
    defaultAspect: "3:4",
    defaultResolution: "1K",
    defaultCount: 2,
  },
  {
    id: "seedream",
    title: "OF style SeeDream",
    modelLabel: "SeeDream / Nano / GPT",
    defaultModel: "seedream-4.5",
    modelOptions: ["seedream-4.5", "nano-banana-pro", "gpt-image-2"],
    defaultAspect: "9:16",
    defaultResolution: "2K",
    defaultCount: 2,
  },
  {
    id: "liveops",
    title: "LiveOps button",
    modelLabel: "Nano Banana Pro",
    defaultModel: "nano-banana-pro",
    modelOptions: ["nano-banana-pro"],
    defaultAspect: "1:1",
    defaultResolution: "1K",
    defaultCount: 4,
  },
  {
    id: "avatars",
    title: "Avatars",
    modelLabel: "Nano / GPT",
    defaultModel: "nano-banana-pro",
    modelOptions: ["nano-banana-pro", "gpt-image-2"],
    defaultAspect: "3:4",
    defaultResolution: "1K",
    defaultCount: 2,
  },
];

const ASPECTS = ["auto", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "5:4", "4:5", "21:9"];
const RESOLUTIONS = ["1K", "2K", "4K"];
const POLL_INTERVAL_MS = 3000;
const GENERATION_TIMEOUT_MS = 300000;
const COMPLETED_STATUSES = new Set(["completed", "succeeded", "success", "done"]);
const FAILED_STATUSES = new Set(["failed", "error", "timeout", "canceled", "cancelled"]);
const HISTORY_STORAGE_KEY = "prompt-studio-image-history-v1";
const GALLERY_SIZE_STORAGE_KEY = "prompt-studio-gallery-size-v1";
const MAX_HISTORY_ITEMS = 80;

const PALETTES = [
  { id: "purple-pink", label: "Фиолетовый / розовый", prompt: "фиолетовый / розовый цвет", swatch: "linear-gradient(135deg, #7c3aed, #ec4899)" },
  { id: "ice-blue", label: "Ледяной голубой", prompt: "ледяной голубой цвет", swatch: "linear-gradient(135deg, #38bdf8, #818cf8)" },
  { id: "mint-lime", label: "Мятный / лайм", prompt: "мятный / лаймовый цвет", swatch: "linear-gradient(135deg, #34d399, #a3e635)" },
  { id: "coral-peach", label: "Коралловый / персик", prompt: "коралловый / персиковый цвет", swatch: "linear-gradient(135deg, #fb7185, #fdba74)" },
];

const BUILT_IN_REFERENCES = {
  liveops: ["assets/ref-camera.png"],
};

const initialValues = {
  appearance: {
    gender: "adult man",
    age: "",
    description: "",
    avoid: "",
  },
  seedream: {
    idea: "",
    extra: "",
  },
  liveops: {
    subject: "",
    palette: "purple-pink",
    customColor: "",
    details: "",
  },
  avatars: {
    gender: "man",
    expression: "",
    clothing: "",
  },
};

function createEmptyHistories() {
  return Object.fromEntries(TASKS.map((task) => [task.id, []]));
}

function normalizeSavedImage(image) {
  if (!image || typeof image.url !== "string" || !isUsableImageUrl(image.url)) return null;

  return {
    id: typeof image.id === "string" ? image.id : "",
    url: image.url,
    sourceUrl: typeof image.sourceUrl === "string" ? image.sourceUrl : image.url,
    mediaType: typeof image.mediaType === "string" ? image.mediaType : "image/png",
    modelLabel: typeof image.modelLabel === "string" ? image.modelLabel : "Image",
    taskId: typeof image.taskId === "string" ? image.taskId : "",
    createdAt: typeof image.createdAt === "string" ? image.createdAt : "",
  };
}

function isUsableImageUrl(url) {
  if (typeof url !== "string" || !url) return false;
  if (url.startsWith("data:image/")) return true;
  if (url.startsWith("/api/image?file=")) return true;

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.hostname === "api.atlascloud.ai") return false;
    if (parsed.pathname.includes("/prediction/")) return false;
    return true;
  } catch {
    return false;
  }
}

function loadSavedHistories() {
  const histories = createEmptyHistories();

  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "{}");
    TASKS.forEach((task) => {
      histories[task.id] = Array.isArray(saved[task.id])
        ? saved[task.id].map(normalizeSavedImage).filter(Boolean).slice(0, MAX_HISTORY_ITEMS)
        : [];
    });
  } catch {
    return histories;
  }

  return histories;
}

function saveHistories(histories) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(histories));
  } catch {
    // History is a convenience layer; generation should keep working even if storage is full.
  }
}

const savedHistories = loadSavedHistories();

function loadGallerySize() {
  const saved = Number(localStorage.getItem(GALLERY_SIZE_STORAGE_KEY));
  return Number.isFinite(saved) ? Math.min(Math.max(saved, 160), 420) : 260;
}

const state = {
  activeTask: "appearance",
  values: structuredClone(initialValues),
  settings: Object.fromEntries(
    TASKS.map((task) => [
      task.id,
      {
        model: task.defaultModel,
        aspect: task.defaultAspect,
        resolution: task.defaultResolution,
        count: task.defaultCount,
      },
    ]),
  ),
  references: Object.fromEntries(TASKS.map((task) => [task.id, []])),
  histories: savedHistories,
  results: savedHistories.appearance || [],
  isGenerating: false,
  generatingTaskId: "",
  pendingCount: 0,
  status: "",
  gallerySize: loadGallerySize(),
  selectedUrls: new Set(),
  remoteHistoryLoaded: new Set(),
  removingUrls: new Set(),
};

const referenceCache = new Map();

const els = {
  taskTabs: document.querySelector("#taskTabs"),
  taskModelLabel: document.querySelector("#taskModelLabel"),
  taskTitle: document.querySelector("#taskTitle"),
  briefForm: document.querySelector("#briefForm"),
  resetButton: document.querySelector("#resetButton"),
  promptPreview: document.querySelector("#promptPreview"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  modelSelect: document.querySelector("#modelSelect"),
  aspectSelect: document.querySelector("#aspectSelect"),
  resolutionSelect: document.querySelector("#resolutionSelect"),
  countInput: document.querySelector("#countInput"),
  referenceInput: document.querySelector("#referenceInput"),
  referenceList: document.querySelector("#referenceList"),
  clearRefsButton: document.querySelector("#clearRefsButton"),
  generateButton: document.querySelector("#generateButton"),
  statusText: document.querySelector("#statusText"),
  resultsGrid: document.querySelector("#resultsGrid"),
  gallerySize: document.querySelector("#gallerySize"),
  selectionToolbar: document.querySelector("#selectionToolbar"),
  selectionCount: document.querySelector("#selectionCount"),
  deleteSelectedButton: document.querySelector("#deleteSelectedButton"),
};

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getTask(taskId = state.activeTask) {
  return TASKS.find((task) => task.id === taskId) || TASKS[0];
}

function getSettings() {
  return state.settings[state.activeTask];
}

function getEffectiveModel() {
  const task = getTask();
  const selected = getSettings().model;
  return task.modelOptions.includes(selected) ? selected : task.defaultModel;
}

function setStatus(message, persist = false) {
  state.status = message;
  els.statusText.textContent = message;
  window.clearTimeout(setStatus.timer);
  if (!persist) {
    setStatus.timer = window.setTimeout(() => {
      state.status = "";
      els.statusText.textContent = "";
    }, 2400);
  }
}

function renderTabs() {
  els.taskTabs.innerHTML = TASKS.map(
    (task) => `
      <button
        class="task-tab"
        type="button"
        data-task="${task.id}"
        ${task.id === state.activeTask ? 'aria-current="true"' : ""}
      >
        ${task.title}
      </button>
    `,
  ).join("");
}

function renderAppearanceForm() {
  const values = state.values.appearance;
  return `
    <div class="appearance-quick-fields">
      <label class="field compact-select-field">
        <span>Пол</span>
        <select data-input="gender" aria-label="Пол">
          <option value="adult man" ${values.gender === "adult man" ? "selected" : ""}>Мужчина</option>
          <option value="adult woman" ${values.gender === "adult woman" ? "selected" : ""}>Женщина</option>
        </select>
      </label>
      <label class="field">
        <span>Возраст</span>
        <input data-input="age" type="text" value="${escapeHTML(values.age)}" placeholder="например, 28-30" autocomplete="off" />
      </label>
      <label class="field">
        <span>Запреты</span>
        <input data-input="avoid" type="text" value="${escapeHTML(values.avoid)}" placeholder="борода, татуировки, яркий макияж" autocomplete="off" />
      </label>
    </div>

    <label class="field">
      <span>Описание</span>
      <textarea class="compact-description" data-input="description" rows="3" placeholder="раса/этничность, внешность, волосы, глаза, тело, вайб, одежда">${escapeHTML(values.description)}</textarea>
    </label>
  `;
}

function renderSeedreamForm() {
  const values = state.values.seedream;
  return `
    <label class="field">
      <span>Описание сцены</span>
      <textarea class="compact-description" data-input="idea" rows="3" placeholder="сцена, человек, одежда, место, эмоция, детали и запреты">${escapeHTML(values.idea)}</textarea>
    </label>
  `;
}

function renderLiveopsForm() {
  const values = state.values.liveops;
  return `
    <label class="field">
      <span>Предмет</span>
      <input data-input="subject" type="text" value="${escapeHTML(values.subject)}" placeholder="например, камера, подарок, молния" autocomplete="off" />
    </label>

    <div class="liveops-options">
      <label class="field">
        <span>Цвет</span>
        <select data-input="palette" aria-label="Цвет">
          ${PALETTES.map(
            (palette) => `<option value="${palette.id}" ${values.palette === palette.id ? "selected" : ""}>${palette.label}</option>`,
          ).join("")}
        </select>
      </label>
      <label class="field">
        <span>Свой цвет</span>
        <input data-input="customColor" type="text" value="${escapeHTML(values.customColor)}" placeholder="например, серебряный / лавандовый" autocomplete="off" />
      </label>
    </div>
  `;
}

function renderAvatarForm() {
  const values = state.values.avatars;
  return `
    <div class="avatar-form-fields">
      <label class="field compact-select-field">
        <span>Пол</span>
        <select data-input="gender" aria-label="Пол">
          <option value="man" ${values.gender === "man" ? "selected" : ""}>Мужчина</option>
          <option value="woman" ${values.gender === "woman" ? "selected" : ""}>Женщина</option>
        </select>
      </label>
      <label class="field">
        <span>Выражение лица</span>
        <textarea class="avatar-description" data-input="expression" rows="3" placeholder="например, спокойный уверенный взгляд, легкая улыбка, чёрная водолазка и свободный серый пиджак">${escapeHTML(values.expression)}</textarea>
      </label>
    </div>
  `;
}

function renderForm() {
  if (state.activeTask === "appearance") els.briefForm.innerHTML = renderAppearanceForm();
  if (state.activeTask === "seedream") els.briefForm.innerHTML = renderSeedreamForm();
  if (state.activeTask === "liveops") els.briefForm.innerHTML = renderLiveopsForm();
  if (state.activeTask === "avatars") els.briefForm.innerHTML = renderAvatarForm();
}

function renderSettings() {
  const task = getTask();
  const settings = getSettings();
  const modelKey = getEffectiveModel();
  const resolutionOptions = MODELS[modelKey]?.resolutions || RESOLUTIONS;

  if (!resolutionOptions.includes(settings.resolution)) {
    settings.resolution = resolutionOptions[0];
  }

  els.modelSelect.innerHTML = Object.entries(MODELS)
    .filter(([id]) => task.modelOptions.includes(id))
    .map(([id, model]) => {
      return `<option value="${id}" ${getEffectiveModel() === id ? "selected" : ""}>${model.label}</option>`;
    })
    .join("");
  els.modelSelect.disabled = task.modelOptions.length === 1;

  els.aspectSelect.innerHTML = ASPECTS.map(
    (aspect) => `<option value="${aspect}" ${settings.aspect === aspect ? "selected" : ""}>${aspect === "auto" ? "Авто" : aspect}</option>`,
  ).join("");

  els.resolutionSelect.innerHTML = resolutionOptions.map(
    (resolution) => `<option value="${resolution}" ${settings.resolution === resolution ? "selected" : ""}>${resolution}</option>`,
  ).join("");

  els.countInput.value = settings.count;
}

function renderReferences() {
  const refs = state.references[state.activeTask];
  els.referenceList.innerHTML = refs.length
    ? refs
        .map(
          (ref, index) => `
            <article class="reference-item">
              <img src="${ref.dataUrl}" alt="${escapeHTML(ref.name)}" />
              <button class="icon-button" type="button" data-remove-ref="${index}" aria-label="Удалить референс">×</button>
            </article>
          `,
        )
        .join("")
    : "";
}

function renderPromptPreview() {
  if (els.promptPreview) els.promptPreview.value = makePrompt();
}

function renderResults() {
  els.resultsGrid.style.setProperty("--gallery-tile", `${state.gallerySize}px`);
  els.gallerySize.value = state.gallerySize;
  const results = getActiveResults();
  const resultUrls = new Set(results.map((image) => image.url));
  state.selectedUrls = new Set([...state.selectedUrls].filter((url) => resultUrls.has(url)));
  els.selectionToolbar.hidden = state.selectedUrls.size === 0;
  els.selectionCount.textContent = `Выбрано: ${state.selectedUrls.size}`;
  const isActiveTaskGenerating = state.isGenerating && state.generatingTaskId === state.activeTask;

  if (isActiveTaskGenerating) {
    const loadingCards = Array.from(
      { length: Math.max(state.pendingCount, 1) },
      () => '<div class="result-card loading-card"></div>',
    ).join("");
    els.resultsGrid.innerHTML = `${renderResultCards(results)}${loadingCards}`;
    return;
  }

  if (!results.length) {
    els.resultsGrid.innerHTML = `
      <div class="empty-results">
        <span>Ready</span>
      </div>
    `;
    return;
  }

  els.resultsGrid.innerHTML = renderResultCards(results);
}

function renderResultCards(results = getActiveResults()) {
  return results
    .map(
      (image, index) => {
        const isSelected = state.selectedUrls.has(image.url);
        const canRemoveBackground = BACKGROUND_REMOVAL_ENABLED && ["liveops", "avatars"].includes(state.activeTask);
        const isRemoving = state.removingUrls.has(image.url);
        return `
        <article class="result-card ${isSelected ? "is-selected" : ""}">
          <button class="select-image-button" type="button" data-select-image="${index}" aria-label="${isSelected ? "Снять выделение" : "Выделить изображение"}" aria-pressed="${isSelected}" title="${isSelected ? "Снять выделение" : "Выделить изображение"}">${isSelected ? "✓" : ""}</button>
          <img src="${escapeHTML(image.url)}" alt="Generated image ${index + 1}" data-result-index="${index}" />
          <div class="result-actions">
            <span>${escapeHTML(image.modelLabel || "Image")}</span>
            <div>
              ${canRemoveBackground ? `<button class="ghost-button compact" type="button" data-remove-background="${index}" ${isRemoving ? "disabled" : ""}>${isRemoving ? "Вырезаем..." : "Убрать фон"}</button>` : ""}
              <button class="ghost-button compact" type="button" data-copy-image="${index}">Copy</button>
              <a class="ghost-button compact" href="${escapeHTML(image.url)}" download="prompt-studio-${index + 1}.png">Download</a>
            </div>
          </div>
        </article>
      `;
      },
    )
    .join("");
}

function getActiveResults() {
  return state.histories[state.activeTask] || [];
}

function renderAll() {
  const task = getTask();
  els.taskTitle.textContent = task.title;
  els.taskModelLabel.textContent = task.modelLabel;
  renderTabs();
  renderForm();
  renderSettings();
  renderReferences();
  renderPromptPreview();
  renderResults();
}

function getColorPrompt() {
  const values = state.values.liveops;
  const customColor = values.customColor.trim();
  if (customColor) return customColor.toLowerCase().includes("цвет") ? customColor : `${customColor} цвет`;

  const palette = PALETTES.find((item) => item.id === values.palette) || PALETTES[0];
  return palette.prompt;
}

function makeAppearancePrompt() {
  const values = state.values.appearance;
  const subject =
    values.gender === "adult woman"
      ? "an attractive adult woman"
      : values.gender === "adult man"
        ? "an attractive adult man"
        : "an attractive adult person";
  const age = values.age.trim() ? ` around ${values.age.trim()} years old` : "";
  const description = values.description.trim() || "with realistic natural facial features, expressive eyes, detailed hair, balanced body proportions, and a strong memorable visual type";
  const avoid = values.avoid.trim() ? ` Avoid: ${values.avoid.trim()}.` : "";

  return `A realistic front-facing iPhone photo of ${subject}${age}, ${description}. ${CHARACTER_SUFFIX}.${avoid}`;
}

function makeSeedreamPrompt() {
  const values = state.values.seedream;
  const idea = values.idea.trim() || "a candid everyday moment with a person caught mid-emotion";
  return `${SEEDREAM_PREFIX} ${idea}`;
}

function makeLiveopsPrompt() {
  const values = state.values.liveops;
  const subject = values.subject.trim() || "button object";
  return `3d иконка ${subject} глассморфизм ${getColorPrompt()} вот как примеры. скопируй стиль рефов. полупрозрачно, глассморфизм`;
}

function makeAvatarPrompt() {
  const values = state.values.avatars;
  const subject = values.gender === "woman" ? "adult woman" : "adult man";
  const pronoun = values.gender === "woman" ? "she" : "he";
  const possessive = values.gender === "woman" ? "her" : "his";
  const look = values.expression.trim() || "neutral confident expression, direct eye contact, simple clean contemporary clothing";

  return [
    "Preserve from Image 1: identity STRUCTURE only — facial bone structure, eye shape and color, eyebrow shape, nose shape, mouth shape at rest, ear shape, jawline, hairline, hair length and texture, facial hair if present, skin tone, neck, build, and overall likeness. The person must read as the same individual actively living the moment described, not as a face transplanted from the reference.",
    `Subject: ${subject}.`,
    `Change: ${pronoun} is in a relaxed leaning attitude with weight off one hip, shifting ${possessive} weight in a relaxed manner, making direct eye contact with the camera.`,
    `Expression and clothing: ${look}.`,
    "Camera: 85mm portrait lens, f/2.0, eye-level, mid-thigh crop, subject centered, head, hair, hands, and arms fully in frame.",
    "Lighting: soft natural daylight-balanced key from camera-front-left at ~45°, gentle white bounce fill from camera-front-right, balanced and even with a soft realistic falloff, neutral white balance, gentle catchlights in both eyes — should read as beautiful natural light, not a commercial studio. No backlight, rim light, edge light, hair light, colored gels, or cinematic grading.",
    "Background: solid dark warm grey seamless backdrop, evenly lit, no gradient, no vignette, soft natural contact shadow where the subject meets the floor.",
    "Realism: visible skin pores, natural skin texture with subtle asymmetry and a hint of real-skin imperfection, peach fuzz, individual hair strands and a few natural flyaways, fabric weave, natural folds and drape, contact shadows, subtle film grain consistent with a high-end digital camera — not retouched, not airbrushed.",
  ].join("\n\n");
}

function makePrompt() {
  if (state.activeTask === "appearance") return makeAppearancePrompt();
  if (state.activeTask === "seedream") return makeSeedreamPrompt();
  if (state.activeTask === "liveops") return makeLiveopsPrompt();
  return makeAvatarPrompt();
}

function getImageEndpoint() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname.endsWith(".vercel.app")) {
    return "/api/image";
  }

  return "";
}

function getHistoryEndpoint() {
  return getImageEndpoint() ? "/api/history" : "";
}

function getRemoveBackgroundEndpoint() {
  return getImageEndpoint() ? "/api/remove-background" : "";
}

function validateBeforeGenerate() {
  const values = state.values[state.activeTask];
  if (state.activeTask === "liveops" && !values.subject.trim()) return "Введите предмет";
  if (state.activeTask === "seedream" && !values.idea.trim()) return "Введите идею сцены";
  if (state.activeTask === "appearance" && !values.description.trim()) return "Введите описание";
  if (state.activeTask === "avatars" && !state.references.avatars.length) return "Добавьте Image 1";
  return "";
}

async function generateImages() {
  const endpoint = getImageEndpoint();
  if (!endpoint) {
    setStatus("Откройте preview на Vercel", true);
    return;
  }

  const validationError = validateBeforeGenerate();
  if (validationError) {
    setStatus(validationError);
    return;
  }

  const settings = getSettings();
  const modelKey = getEffectiveModel();
  let inputReferences = state.references[state.activeTask].map((ref) => ref.dataUrl);
  if (state.activeTask === "liveops" && !inputReferences.length) {
    inputReferences = await Promise.all(BUILT_IN_REFERENCES.liveops.map((src) => loadReferenceDataUrl(src)));
  }
  const taskId = state.activeTask;
  state.isGenerating = true;
  state.generatingTaskId = taskId;
  state.pendingCount = settings.count;
  setStatus("Generating...", true);
  renderResults();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        modelKey,
        prompt: makePrompt(),
        aspectRatio: settings.aspect,
        resolution: settings.resolution,
        count: settings.count,
        inputReferences,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Generation failed");
    }

    const modelLabel = MODELS[modelKey]?.label || "Image";
    addGeneratedImages(data.images, modelLabel, taskId);
    renderResults();

    const pendingIds = (data.predictions || [])
      .filter((prediction) => !COMPLETED_STATUSES.has(prediction.status) && !FAILED_STATUSES.has(prediction.status))
      .map((prediction) => prediction.id)
      .filter(Boolean);

    if (pendingIds.length) {
      state.pendingCount = pendingIds.length;
      await pollImageJobs({ endpoint, modelKey, modelLabel, pendingIds, taskId });
    } else {
      state.pendingCount = 0;
      setStatus(state.histories[taskId].length ? `Ready: ${state.histories[taskId].length}` : "No image returned");
    }
  } catch (error) {
    const message = error.message?.includes("Atlas Cloud key")
      ? "Добавьте Atlas Cloud API key в Vercel"
      : error.message || "Не удалось сгенерировать";
    setStatus(message, true);
  } finally {
    state.isGenerating = false;
    state.generatingTaskId = "";
    state.pendingCount = 0;
    renderResults();
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function addGeneratedImages(images, modelLabel, taskId = state.activeTask) {
  const results = state.histories[taskId] || [];
  const existingUrls = new Set(results.map((image) => image.url));
  const nextImages = (images || [])
    .filter((image) => image?.url && isUsableImageUrl(image.url) && !existingUrls.has(image.url))
    .map((image) => ({
      ...image,
      sourceUrl: image.sourceUrl || image.url,
      modelLabel,
      taskId,
      createdAt: new Date().toISOString(),
    }));

  if (!nextImages.length) return { addedCount: 0, savedCount: 0 };

  state.histories[taskId] = [...nextImages, ...results].slice(0, MAX_HISTORY_ITEMS);
  if (taskId === state.activeTask) {
    state.results = state.histories[taskId];
  }
  saveHistories(state.histories);
  const imagesToPersist = nextImages.filter((image) => !image.id);
  const archive = imagesToPersist.length
    ? await persistImages(taskId, imagesToPersist)
    : { savedCount: nextImages.length };

  if (taskId === state.activeTask) {
    window.requestAnimationFrame(() => {
      els.resultsGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return { addedCount: nextImages.length, ...archive };
}

function removeResultByUrl(url, taskId = state.activeTask) {
  const results = state.histories[taskId] || [];
  const nextResults = results.filter((image) => image.url !== url);
  if (nextResults.length === results.length) return;

  state.histories[taskId] = nextResults;
  state.selectedUrls.delete(url);
  if (taskId === state.activeTask) {
    state.results = nextResults;
  }
  saveHistories(state.histories);
  deletePersistedImages(taskId, results.filter((image) => image.url === url));
  renderResults();
}

function mergeHistoryImages(taskId, images) {
  const existing = state.histories[taskId] || [];
  const merged = [...images.map(normalizeSavedImage).filter(Boolean), ...existing];
  const seen = new Set();
  state.histories[taskId] = merged.filter((image) => {
    const key = image.id || image.sourceUrl || image.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_HISTORY_ITEMS);
  if (taskId === state.activeTask) state.results = state.histories[taskId];
  saveHistories(state.histories);
}

async function persistImages(taskId, images) {
  const endpoint = getHistoryEndpoint();
  if (!endpoint || !images.length) return { savedCount: 0 };

  const imagesToArchive = images.map((image) => ({
    sourceUrl: image.sourceUrl || image.url,
    mediaType: image.mediaType,
    modelLabel: image.modelLabel,
    createdAt: image.createdAt,
  }));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", taskId, images: imagesToArchive }),
    });
    if (!response.ok) return { savedCount: 0 };
    const data = await response.json();
    if (!data.images?.length) return { savedCount: 0 };
    const savedBySource = new Map(data.images.map((image) => [image.clientSourceUrl || image.sourceUrl, normalizeSavedImage(image)]));
    state.histories[taskId] = (state.histories[taskId] || []).map((image) => savedBySource.get(image.sourceUrl || image.url) || image);
    if (taskId === state.activeTask) state.results = state.histories[taskId];
    saveHistories(state.histories);
    if (taskId === state.activeTask) renderResults();
    return { savedCount: data.images.length };
  } catch {
    return { savedCount: 0 };
  }
}

async function deletePersistedImages(taskId, images) {
  const endpoint = getHistoryEndpoint();
  const ids = images.map((image) => image.id).filter(Boolean);
  if (!endpoint || !ids.length) return;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", taskId, ids }),
    });
  } catch {
    // The visible deletion is already complete.
  }
}

async function removeBackground(index) {
  const image = getActiveResults()[index];
  const endpoint = getRemoveBackgroundEndpoint();
  if (!BACKGROUND_REMOVAL_ENABLED || !image || !endpoint || !["liveops", "avatars"].includes(state.activeTask)) return;
  if (!window.confirm("Вырезание фона использует Atlas Cloud и стоит примерно $0.086 за изображение. Продолжить?")) return;

  state.removingUrls.add(image.url);
  setStatus("Убираем фон...", true);
  renderResults();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: image.url, taskId: state.activeTask, modelLabel: image.modelLabel || "Image" }),
    });
    let data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Не удалось убрать фон");

    const startedAt = Date.now();
    while (!data.image && data.predictionId && Date.now() - startedAt < 90000) {
      await wait(2000);
      const pollResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "poll", predictionId: data.predictionId, taskId: state.activeTask, modelLabel: image.modelLabel || "Image" }),
      });
      data = await pollResponse.json();
      if (!pollResponse.ok) throw new Error(data?.error || "Не удалось получить результат вырезания");
      if (["failed", "error", "canceled", "cancelled"].includes(String(data.status).toLowerCase())) {
        throw new Error(data.error || "Atlas Cloud не смог убрать фон");
      }
    }

    if (!data.image) throw new Error("Atlas Cloud пока не вернул версию без фона. Попробуйте еще раз.");
    const result = await addGeneratedImages([data.image], `${image.modelLabel || "Image"} - без фона`, state.activeTask);
    if (result.savedCount < result.addedCount) {
      throw new Error("Версия без фона создана, но не сохранилась в галерее. Списание можно проверить в Atlas Cloud.");
    }
    setStatus("Готово: версия без фона сохранена в галерее", true);
  } catch (error) {
    const message = error.message?.includes("Atlas Cloud key")
      ? "Добавьте ключ Atlas Cloud в Vercel"
      : error.message || "Не удалось убрать фон";
    setStatus(message, true);
  } finally {
    state.removingUrls.delete(image.url);
    renderResults();
  }
}

async function loadRemoteHistory(taskId) {
  const endpoint = getHistoryEndpoint();
  if (!endpoint || state.remoteHistoryLoaded.has(taskId)) return;
  state.remoteHistoryLoaded.add(taskId);

  try {
    const response = await fetch(`${endpoint}?taskId=${encodeURIComponent(taskId)}`);
    if (!response.ok) return;
    const data = await response.json();
    const localOnly = (state.histories[taskId] || []).filter((image) => !image.id);
    mergeHistoryImages(taskId, data.images || []);
    if (localOnly.length) persistImages(taskId, localOnly);
    if (taskId === state.activeTask) renderResults();
  } catch {
    // The local gallery is a fallback until the persistent archive is reachable.
  }
}

async function pollImageJobs({ endpoint, modelKey, modelLabel, pendingIds, taskId }) {
  const startedAt = Date.now();
  let remainingIds = pendingIds;

  setStatus(`Atlas Cloud: ждем ${remainingIds.length}`, true);

  while (remainingIds.length && Date.now() - startedAt < GENERATION_TIMEOUT_MS) {
    await wait(POLL_INTERVAL_MS);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "poll",
        modelKey,
        predictionIds: remainingIds,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Generation failed");
    }

    const predictions = data.predictions || [];
    const failed = predictions.find((prediction) => FAILED_STATUSES.has(prediction.status));
    if (failed) {
      throw new Error(failed.error || "Atlas Cloud generation failed");
    }

    addGeneratedImages(data.images, modelLabel, taskId);
    remainingIds = predictions
      .filter((prediction) => !COMPLETED_STATUSES.has(prediction.status))
      .map((prediction) => prediction.id)
      .filter(Boolean);
    state.pendingCount = remainingIds.length;

    setStatus(
      remainingIds.length
        ? `Atlas Cloud: готово ${state.histories[taskId].length}, ждем ${remainingIds.length}`
        : `Ready: ${state.histories[taskId].length}`,
      true,
    );
    renderResults();
  }

  if (remainingIds.length) {
    throw new Error("Atlas Cloud пока не вернул картинку. Попробуйте 1 изображение или меньший размер.");
  }
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyPrompt() {
  const prompt = makePrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    setStatus("Prompt copied");
  } catch {
    setStatus(copyTextFallback(prompt) ? "Prompt copied" : "Copy failed");
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

async function copyImage(index) {
  const image = getActiveResults()[index];
  if (!image) return;

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("image clipboard unavailable");
    }

    const blob = image.url.startsWith("data:")
      ? dataUrlToBlob(image.url)
      : await fetch(image.url).then((response) => response.blob());
    const mediaType = blob.type || image.mediaType || "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [mediaType]: blob })]);
    setStatus("Image copied");
  } catch {
    setStatus("Copy unavailable");
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

async function addReferences(files) {
  const refs = state.references[state.activeTask];
  const slots = Math.max(0, 6 - refs.length);
  const selectedFiles = Array.from(files).slice(0, slots);

  const nextRefs = await Promise.all(
    selectedFiles.map(async (file) => ({
      name: file.name,
      dataUrl: await fileToDataUrl(file),
    })),
  );

  refs.push(...nextRefs);
  els.referenceInput.value = "";
  renderReferences();
}

async function loadReferenceDataUrl(src) {
  if (!referenceCache.has(src)) {
    referenceCache.set(
      src,
      fetch(src)
        .then((response) => {
          if (!response.ok) throw new Error("Reference unavailable");
          return response.blob();
        })
        .then((blob) => fileToDataUrl(blob)),
    );
  }

  return referenceCache.get(src);
}

function switchTask(taskId) {
  if (!TASKS.some((task) => task.id === taskId)) return;
  state.activeTask = taskId;
  state.results = state.histories[taskId] || [];
  state.selectedUrls.clear();
  setStatus("");
  renderAll();
  loadRemoteHistory(taskId);
}

function resetTask() {
  const task = getTask();
  state.values[task.id] = structuredClone(initialValues[task.id]);
  state.settings[task.id] = {
    model: task.defaultModel,
    aspect: task.defaultAspect,
    resolution: task.defaultResolution,
    count: task.defaultCount,
  };
  state.references[task.id] = [];
  setStatus("");
  renderAll();
}

function handleFormInput(event) {
  const input = event.target.closest("[data-input]");
  if (!input) return;

  state.values[state.activeTask][input.dataset.input] = input.value;
  if (state.activeTask === "liveops" && input.dataset.input === "palette") {
    state.values.liveops.customColor = "";
    renderForm();
  }
  renderPromptPreview();
}

function handleFormClick(event) {
  const choice = event.target.closest(".choice-button");
  if (choice) {
    const row = choice.closest("[data-field]");
    state.values[state.activeTask][row.dataset.field] = choice.dataset.value;
    renderForm();
    renderPromptPreview();
    return;
  }

}

function bindEvents() {
  els.taskTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-task]");
    if (tab) switchTask(tab.dataset.task);
  });

  els.briefForm.addEventListener("input", handleFormInput);
  els.briefForm.addEventListener("change", handleFormInput);
  els.resetButton.addEventListener("click", resetTask);
  els.briefForm.addEventListener("click", handleFormClick);
  if (els.copyPromptButton) {
    els.copyPromptButton.addEventListener("click", (event) => {
      event.preventDefault();
      copyPrompt();
    });
  }

  els.modelSelect.addEventListener("change", () => {
    getSettings().model = els.modelSelect.value;
    renderSettings();
  });

  els.aspectSelect.addEventListener("change", () => {
    getSettings().aspect = els.aspectSelect.value;
    renderSettings();
  });

  els.resolutionSelect.addEventListener("change", () => {
    getSettings().resolution = els.resolutionSelect.value;
    renderSettings();
  });

  els.countInput.addEventListener("input", () => {
    getSettings().count = Math.min(Math.max(Number(els.countInput.value) || 1, 1), 4);
  });

  els.referenceInput.addEventListener("change", () => addReferences(els.referenceInput.files));
  if (els.clearRefsButton) {
    els.clearRefsButton.addEventListener("click", () => {
      state.references[state.activeTask] = [];
      renderReferences();
    });
  }
  els.generateButton.addEventListener("click", generateImages);
  els.gallerySize.addEventListener("input", () => {
    state.gallerySize = Math.min(Math.max(Number(els.gallerySize.value) || 260, 160), 420);
    localStorage.setItem(GALLERY_SIZE_STORAGE_KEY, String(state.gallerySize));
    renderResults();
  });
  els.deleteSelectedButton.addEventListener("click", () => {
    const selected = state.selectedUrls;
    const deleted = getActiveResults().filter((image) => selected.has(image.url));
    state.histories[state.activeTask] = getActiveResults().filter((image) => !selected.has(image.url));
    state.results = state.histories[state.activeTask];
    state.selectedUrls.clear();
    saveHistories(state.histories);
    deletePersistedImages(state.activeTask, deleted);
    renderResults();
  });
  els.referenceList.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-ref]");
    if (!removeButton) return;
    state.references[state.activeTask].splice(Number(removeButton.dataset.removeRef), 1);
    renderReferences();
  });
  els.resultsGrid.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-select-image]");
    if (selectButton) {
      const image = getActiveResults()[Number(selectButton.dataset.selectImage)];
      if (!image) return;
      if (state.selectedUrls.has(image.url)) state.selectedUrls.delete(image.url);
      else state.selectedUrls.add(image.url);
      renderResults();
      return;
    }

    const removeBackgroundButton = event.target.closest("[data-remove-background]");
    if (removeBackgroundButton) {
      removeBackground(Number(removeBackgroundButton.dataset.removeBackground));
      return;
    }

    const copyButton = event.target.closest("[data-copy-image]");
    if (copyButton) copyImage(Number(copyButton.dataset.copyImage));
  });
  els.resultsGrid.addEventListener(
    "error",
    (event) => {
      const image = event.target.closest("img[data-result-index]");
      if (!image) return;
      removeResultByUrl(image.getAttribute("src"));
    },
    true,
  );
}

bindEvents();
renderAll();
loadRemoteHistory(state.activeTask);
