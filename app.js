const SEEDREAM_PREFIX =
  "dynamic angled iphone shot, warm storytelling composition, dynamic tilted iphone shot, slight motion blur for realism, candid cinematic everyday moment, shot on iphone, phone quality, phone grain, iphone colors, dynamic angle, storytelling composition, dramatic composition, flirty vibe, low contrast, no studio lighting, slight hand shake, imperfect crop, iPhone front-camera,";

const CHARACTER_SUFFIX = "Plain gray studio wall background, natural indoor phone lighting, raw realistic iPhone photo";

const MODELS = {
  auto: { label: "Auto", provider: "auto" },
  "nano-banana-2": { label: "Nano Banana 2", provider: "nano-banana" },
  "nano-banana": { label: "Nano Banana", provider: "nano-banana" },
  seedream: { label: "SeeDream 4.5", provider: "seedream" },
};

const TASKS = [
  {
    id: "appearance",
    title: "NB Appearance Options",
    modelLabel: "Nano Banana",
    defaultModel: "nano-banana-2",
    defaultAspect: "3:4",
    defaultResolution: "1K",
    defaultCount: 2,
  },
  {
    id: "seedream",
    title: "OF style SeeDream",
    modelLabel: "SeeDream",
    defaultModel: "seedream",
    defaultAspect: "9:16",
    defaultResolution: "1K",
    defaultCount: 2,
  },
  {
    id: "liveops",
    title: "LiveOps button",
    modelLabel: "Nano Banana",
    defaultModel: "nano-banana-2",
    defaultAspect: "1:1",
    defaultResolution: "1K",
    defaultCount: 4,
  },
  {
    id: "avatars",
    title: "Avatars",
    modelLabel: "Nano Banana",
    defaultModel: "nano-banana-2",
    defaultAspect: "3:4",
    defaultResolution: "1K",
    defaultCount: 2,
  },
];

const ASPECTS = ["1:1", "3:4", "4:5", "9:16", "16:9"];
const RESOLUTIONS = ["1K", "2K", "4K"];

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

const state = {
  activeTask: "appearance",
  values: structuredClone(initialValues),
  settings: Object.fromEntries(
    TASKS.map((task) => [
      task.id,
      {
        model: "auto",
        aspect: task.defaultAspect,
        resolution: task.defaultResolution,
        count: task.defaultCount,
      },
    ]),
  ),
  references: Object.fromEntries(TASKS.map((task) => [task.id, []])),
  results: [],
  isGenerating: false,
  status: "",
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
  aspectOptions: document.querySelector("#aspectOptions"),
  resolutionOptions: document.querySelector("#resolutionOptions"),
  countInput: document.querySelector("#countInput"),
  referenceInput: document.querySelector("#referenceInput"),
  referenceList: document.querySelector("#referenceList"),
  clearRefsButton: document.querySelector("#clearRefsButton"),
  generateButton: document.querySelector("#generateButton"),
  statusText: document.querySelector("#statusText"),
  resultsGrid: document.querySelector("#resultsGrid"),
  clearResultsButton: document.querySelector("#clearResultsButton"),
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
  return selected === "auto" ? task.defaultModel : selected;
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
    <fieldset class="field">
      <legend>Пол</legend>
      <div class="choice-row" data-field="gender">
        <button class="choice-button" type="button" data-value="adult man" ${values.gender === "adult man" ? 'aria-pressed="true"' : ""}>Мужчина</button>
        <button class="choice-button" type="button" data-value="adult woman" ${values.gender === "adult woman" ? 'aria-pressed="true"' : ""}>Женщина</button>
      </div>
    </fieldset>

    <div class="field-grid">
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
      <textarea data-input="description" rows="7" placeholder="раса/этничность, внешность, волосы, глаза, тело, вайб, одежда">${escapeHTML(values.description)}</textarea>
    </label>
  `;
}

function renderSeedreamForm() {
  const values = state.values.seedream;
  return `
    <label class="field">
      <span>Идея сцены</span>
      <textarea data-input="idea" rows="8" placeholder="например, девушка смеется в лифте, кадр будто снят случайно">${escapeHTML(values.idea)}</textarea>
    </label>
    <label class="field">
      <span>Дополнительно</span>
      <input data-input="extra" type="text" value="${escapeHTML(values.extra)}" placeholder="одежда, место, эмоция, запреты" autocomplete="off" />
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

    <fieldset class="field">
      <legend>Цвет</legend>
      <div class="palette-grid">
        ${PALETTES.map(
          (palette) => `
            <button class="palette-button" type="button" data-palette="${palette.id}" ${values.palette === palette.id ? 'aria-pressed="true"' : ""}>
              <span class="palette-dot" style="background: ${palette.swatch}"></span>
              <span>${palette.label}</span>
            </button>
          `,
        ).join("")}
      </div>
    </fieldset>

    <div class="field-grid">
      <label class="field">
        <span>Свой цвет</span>
        <input data-input="customColor" type="text" value="${escapeHTML(values.customColor)}" placeholder="например, серебряный / лавандовый" autocomplete="off" />
      </label>
      <label class="field">
        <span>Детали</span>
        <input data-input="details" type="text" value="${escapeHTML(values.details)}" placeholder="без фона, мягкий контур" autocomplete="off" />
      </label>
    </div>
  `;
}

function renderAvatarForm() {
  const values = state.values.avatars;
  return `
    <fieldset class="field">
      <legend>Пол</legend>
      <div class="choice-row" data-field="gender">
        <button class="choice-button" type="button" data-value="man" ${values.gender === "man" ? 'aria-pressed="true"' : ""}>Мужчина</button>
        <button class="choice-button" type="button" data-value="woman" ${values.gender === "woman" ? 'aria-pressed="true"' : ""}>Женщина</button>
      </div>
    </fieldset>

    <div class="field-grid">
      <label class="field">
        <span>Выражение лица</span>
        <textarea data-input="expression" rows="5" placeholder="например, спокойный уверенный взгляд, легкая улыбка">${escapeHTML(values.expression)}</textarea>
      </label>
      <label class="field">
        <span>Одежда</span>
        <textarea data-input="clothing" rows="5" placeholder="например, черная водолазка, свободный серый пиджак">${escapeHTML(values.clothing)}</textarea>
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

  els.modelSelect.innerHTML = Object.entries(MODELS)
    .map(([id, model]) => {
      const label = id === "auto" ? `Auto (${MODELS[task.defaultModel].label})` : model.label;
      return `<option value="${id}" ${settings.model === id ? "selected" : ""}>${label}</option>`;
    })
    .join("");

  els.aspectOptions.innerHTML = ASPECTS.map(
    (aspect) => `
      <button class="segment-button" type="button" data-setting="aspect" data-value="${aspect}" ${settings.aspect === aspect ? 'aria-pressed="true"' : ""}>${aspect}</button>
    `,
  ).join("");

  els.resolutionOptions.innerHTML = RESOLUTIONS.map(
    (resolution) => `
      <button class="segment-button" type="button" data-setting="resolution" data-value="${resolution}" ${settings.resolution === resolution ? 'aria-pressed="true"' : ""}>${resolution}</button>
    `,
  ).join("");

  els.countInput.value = settings.count;
}

function renderReferences() {
  const refs = state.references[state.activeTask];
  if (state.activeTask === "liveops" && !refs.length) {
    els.referenceList.innerHTML = `
      <article class="reference-item fixed-reference">
        <img src="assets/ref-camera.png" alt="LiveOps reference" />
      </article>
    `;
    return;
  }

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
    : '<p class="empty-note">Нет референсов</p>';
}

function renderPromptPreview() {
  els.promptPreview.value = makePrompt();
}

function renderResults() {
  if (state.isGenerating) {
    els.resultsGrid.innerHTML = Array.from({ length: getSettings().count }, () => '<div class="result-card loading-card"></div>').join("");
    return;
  }

  if (!state.results.length) {
    els.resultsGrid.innerHTML = `
      <div class="empty-results">
        <span>Ready</span>
      </div>
    `;
    return;
  }

  els.resultsGrid.innerHTML = state.results
    .map(
      (image, index) => `
        <article class="result-card">
          <img src="${image.url}" alt="Generated image ${index + 1}" />
          <div class="result-actions">
            <span>${escapeHTML(image.modelLabel || "Image")}</span>
            <div>
              <button class="ghost-button compact" type="button" data-copy-image="${index}">Copy</button>
              <a class="ghost-button compact" href="${image.url}" download="prompt-studio-${index + 1}.png">Download</a>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
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
  const extra = values.extra.trim() ? ` ${values.extra.trim()}` : "";
  return `${SEEDREAM_PREFIX} ${idea}${extra}`;
}

function makeLiveopsPrompt() {
  const values = state.values.liveops;
  const subject = values.subject.trim() || "button object";
  const details = values.details.trim() ? ` ${values.details.trim()}` : "";
  return `3d иконка ${subject} глассморфизм ${getColorPrompt()} вот как примеры. скопируй стиль рефов. полупрозрачно, глассморфизм${details}`;
}

function makeAvatarPrompt() {
  const values = state.values.avatars;
  const subject = values.gender === "woman" ? "adult woman" : "adult man";
  const pronoun = values.gender === "woman" ? "she" : "he";
  const possessive = values.gender === "woman" ? "her" : "his";
  const expression = values.expression.trim() || "neutral confident expression, direct eye contact";
  const clothing = values.clothing.trim() || "simple clean contemporary clothing";

  return [
    "Preserve from Image 1: identity STRUCTURE only — facial bone structure, eye shape and color, eyebrow shape, nose shape, mouth shape at rest, ear shape, jawline, hairline, hair length and texture, facial hair if present, skin tone, neck, build, and overall likeness. The person must read as the same individual actively living the moment described, not as a face transplanted from the reference.",
    `Subject: ${subject}.`,
    `Change: ${pronoun} is in a relaxed leaning attitude with weight off one hip, shifting ${possessive} weight in a relaxed manner, making direct eye contact with the camera.`,
    `Expression: ${expression}.`,
    `Clothing: ${clothing}.`,
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
  state.isGenerating = true;
  state.results = [];
  setStatus("Generating...", true);
  renderResults();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    state.results = (data.images || []).map((image) => ({ ...image, modelLabel }));
    setStatus(state.results.length ? `Ready: ${state.results.length}` : "No image returned");
  } catch {
    state.results = [];
    setStatus("Не удалось сгенерировать", true);
  } finally {
    state.isGenerating = false;
    renderResults();
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
  const image = state.results[index];
  if (!image) return;

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("image clipboard unavailable");
    }

    await navigator.clipboard.write([new ClipboardItem({ [image.mediaType || "image/png"]: dataUrlToBlob(image.url) })]);
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
  state.results = [];
  setStatus("");
  renderAll();
}

function resetTask() {
  const task = getTask();
  state.values[task.id] = structuredClone(initialValues[task.id]);
  state.settings[task.id] = {
    model: "auto",
    aspect: task.defaultAspect,
    resolution: task.defaultResolution,
    count: task.defaultCount,
  };
  state.references[task.id] = [];
  state.results = [];
  setStatus("");
  renderAll();
}

function handleFormInput(event) {
  const input = event.target.closest("[data-input]");
  if (!input) return;

  state.values[state.activeTask][input.dataset.input] = input.value;
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

  const palette = event.target.closest("[data-palette]");
  if (palette) {
    state.values.liveops.palette = palette.dataset.palette;
    state.values.liveops.customColor = "";
    renderForm();
    renderPromptPreview();
  }
}

function bindEvents() {
  els.taskTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-task]");
    if (tab) switchTask(tab.dataset.task);
  });

  els.briefForm.addEventListener("input", handleFormInput);
  els.briefForm.addEventListener("click", handleFormClick);
  els.resetButton.addEventListener("click", resetTask);
  els.copyPromptButton.addEventListener("click", (event) => {
    event.preventDefault();
    copyPrompt();
  });

  els.modelSelect.addEventListener("change", () => {
    getSettings().model = els.modelSelect.value;
    renderSettings();
  });

  els.aspectOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-setting]");
    if (!button) return;
    getSettings()[button.dataset.setting] = button.dataset.value;
    renderSettings();
  });

  els.resolutionOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-setting]");
    if (!button) return;
    getSettings()[button.dataset.setting] = button.dataset.value;
    renderSettings();
  });

  els.countInput.addEventListener("input", () => {
    getSettings().count = Math.min(Math.max(Number(els.countInput.value) || 1, 1), 4);
  });

  els.referenceInput.addEventListener("change", () => addReferences(els.referenceInput.files));
  els.clearRefsButton.addEventListener("click", () => {
    state.references[state.activeTask] = [];
    renderReferences();
  });
  els.generateButton.addEventListener("click", generateImages);
  els.clearResultsButton.addEventListener("click", () => {
    state.results = [];
    renderResults();
  });
  els.referenceList.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-ref]");
    if (!removeButton) return;
    state.references[state.activeTask].splice(Number(removeButton.dataset.removeRef), 1);
    renderReferences();
  });
  els.resultsGrid.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-image]");
    if (copyButton) copyImage(Number(copyButton.dataset.copyImage));
  });
}

bindEvents();
renderAll();
