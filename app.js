const SEEDREAM_PREFIX =
  "dynamic angled iphone shot, warm storytelling composition, dynamic tilted iphone shot, slight motion blur for realism, candid cinematic everyday moment, shot on iphone, phone quality, phone grain, iphone colors, dynamic angle, storytelling composition, dramatic composition, flirty vibe, low contrast, no studio lighting, slight hand shake, imperfect crop, iPhone front-camera,";

const topics = [
  {
    id: "button-icon",
    title: "3D иконка кнопки",
    category: "Изображения",
    meta: "Предмет, цвет, рефы, стеклянный стиль",
    enabled: true,
  },
  {
    id: "seedream-realism",
    title: "Seedream реализм",
    category: "Изображения",
    meta: "Айфон-кадр, сцена, люди, вайб",
    enabled: true,
  },
  {
    id: "copy",
    title: "Тексты",
    category: "Формулировки",
    meta: "Тон, структура, длина, аудитория",
    enabled: false,
  },
];

const palettes = [
  {
    id: "purple-pink",
    label: "Фиолетовый / розовый",
    prompt: "фиолетовый / розовый цвет",
    gradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
  },
  {
    id: "ice-blue",
    label: "Ледяной голубой",
    prompt: "ледяной голубой цвет",
    gradient: "linear-gradient(135deg, #38bdf8, #818cf8)",
  },
  {
    id: "mint-lime",
    label: "Мятный / лайм",
    prompt: "мятный / лаймовый цвет",
    gradient: "linear-gradient(135deg, #34d399, #a3e635)",
  },
  {
    id: "coral-peach",
    label: "Коралловый / персик",
    prompt: "коралловый / персиковый цвет",
    gradient: "linear-gradient(135deg, #fb7185, #fdba74)",
  },
];

const referencesByTopic = {
  "button-icon": [
    {
      title: "Реф 1",
      src: "assets/ref-camera.png",
    },
  ],
  "seedream-realism": [],
};

const storageKeys = {
  "button-icon": "prompt-library.saved.button-icon.v2",
  "seedream-realism": "prompt-library.saved.seedream-realism.v1",
};

const formState = {
  "button-icon": {
    subject: "",
    palette: "purple-pink",
    customColor: "",
    details: "",
  },
  "seedream-realism": {
    scene: "",
    people: "",
    place: "",
    mood: "",
    details: "",
    aiIdea: "",
  },
};

const referencePayloads = new Map();
let activeTopicId = "button-icon";

const els = {
  topicList: document.querySelector("#topicList"),
  builderCategory: document.querySelector("#builderCategory"),
  builderTitle: document.querySelector("#builderTitle"),
  promptForm: document.querySelector("#promptForm"),
  promptOutput: document.querySelector("#promptOutput"),
  copyButton: document.querySelector("#copyButton"),
  saveButton: document.querySelector("#saveButton"),
  resetButton: document.querySelector("#resetButton"),
  clearSavedButton: document.querySelector("#clearSavedButton"),
  refsSection: document.querySelector("#refsSection"),
  refsGrid: document.querySelector("#refsGrid"),
  savedList: document.querySelector("#savedList"),
  statusText: document.querySelector("#statusText"),
};

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getTopic(topicId = activeTopicId) {
  return topics.find((topic) => topic.id === topicId) || topics[0];
}

function getStorageKey() {
  return storageKeys[activeTopicId] || `prompt-library.saved.${activeTopicId}`;
}

function fieldValue(id) {
  return document.querySelector(`#${id}`)?.value.trim() || "";
}

function renderTopics() {
  els.topicList.innerHTML = topics
    .map(
      (topic) => `
        <button
          class="topic-button"
          type="button"
          data-topic="${topic.id}"
          ${topic.enabled ? "" : "disabled"}
          ${topic.id === activeTopicId ? 'aria-current="true"' : ""}
        >
          <span class="topic-title">${topic.title}</span>
          <span class="topic-meta">${topic.meta}</span>
        </button>
      `,
    )
    .join("");
}

function renderButtonIconForm() {
  const state = formState["button-icon"];

  els.promptForm.innerHTML = `
    <label class="field">
      <span>Предмет на кнопке</span>
      <input
        id="subjectInput"
        name="subject"
        type="text"
        value="${escapeHTML(state.subject)}"
        placeholder="например, календарь, ключ, корзина"
        autocomplete="off"
      />
    </label>

    <fieldset class="field color-field">
      <legend>Цвет</legend>
      <div class="swatch-grid" id="paletteOptions"></div>
      <div class="custom-color-option" id="customColorOption">
        <input
          class="custom-color-radio"
          id="customColorRadio"
          type="radio"
          name="palette"
          value="custom"
          ${state.palette === "custom" ? "checked" : ""}
        />
        <label class="custom-color-body" for="customColorInput">
          <span>Свой цвет</span>
          <input
            id="customColorInput"
            name="customColor"
            type="text"
            value="${escapeHTML(state.customColor)}"
            placeholder="например, серебряный / лавандовый"
            autocomplete="off"
          />
        </label>
      </div>
    </fieldset>

    <label class="field">
      <span>Дополнительные детали</span>
      <textarea
        id="detailsInput"
        name="details"
        rows="4"
        placeholder="например, без фона, мягкий контур"
      >${escapeHTML(state.details)}</textarea>
    </label>
  `;

  renderPalettes();
  bindButtonIconControls();
}

function renderSeedreamForm() {
  const state = formState["seedream-realism"];

  els.promptForm.innerHTML = `
    <label class="field">
      <span>Сцена / момент</span>
      <textarea
        id="seedreamSceneInput"
        name="scene"
        rows="3"
        placeholder="например, девушка смеется в лифте, кадр будто снят случайно"
      >${escapeHTML(state.scene)}</textarea>
    </label>

    <label class="field">
      <span>Люди в кадре</span>
      <input
        id="seedreamPeopleInput"
        name="people"
        type="text"
        value="${escapeHTML(state.people)}"
        placeholder="например, две подруги, пара, один человек"
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span>Место</span>
      <input
        id="seedreamPlaceInput"
        name="place"
        type="text"
        value="${escapeHTML(state.place)}"
        placeholder="например, вечерняя улица, кафе, ванная, машина"
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span>Вайб</span>
      <input
        id="seedreamMoodInput"
        name="mood"
        type="text"
        value="${escapeHTML(state.mood)}"
        placeholder="например, флирт, неловкость, теплый хаос"
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span>Дополнительные детали</span>
      <textarea
        id="seedreamDetailsInput"
        name="details"
        rows="4"
        placeholder="например, imperfect crop, wet hair, flash reflection"
      >${escapeHTML(state.details)}</textarea>
    </label>

    <section class="ai-helper" aria-labelledby="aiHelperTitle">
      <div class="ai-helper-heading">
        <h3 id="aiHelperTitle">ИИ-помощник</h3>
        <button class="ghost-button compact" type="button" id="aiRequestButton">Запрос для Grok</button>
      </div>
      <label class="field">
        <span>Черновик идеи</span>
        <textarea
          id="aiIdeaInput"
          name="aiIdea"
          rows="4"
          placeholder="например, хочу сцену про девушку после свидания, снято как случайный селфи-кадр"
        >${escapeHTML(state.aiIdea)}</textarea>
      </label>
    </section>
  `;

  bindSeedreamControls();
}

function renderPalettes() {
  const state = formState["button-icon"];
  const paletteOptions = document.querySelector("#paletteOptions");
  if (!paletteOptions) return;

  paletteOptions.innerHTML = palettes
    .map(
      (palette) => `
        <label class="swatch-option">
          <input
            type="radio"
            name="palette"
            value="${palette.id}"
            ${state.palette === palette.id ? "checked" : ""}
          />
          <span class="swatch" style="background: ${palette.gradient}"></span>
          <span class="swatch-name">${palette.label}</span>
        </label>
      `,
    )
    .join("");
}

function renderReferences() {
  const references = referencesByTopic[activeTopicId] || [];
  els.refsSection.hidden = references.length === 0;

  els.refsGrid.innerHTML = references
    .map(
      (reference, index) => `
        <article class="ref-card">
          <button class="ref-image-button" type="button" data-open-ref="${index}" aria-label="Открыть ${reference.title}">
            <img src="${reference.src}" alt="${reference.title}" />
          </button>
          <div class="ref-actions">
            <span>${reference.title}</span>
            <button class="ghost-button compact" type="button" data-copy-ref="${index}">Копировать</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function preloadReferences() {
  Object.values(referencesByTopic)
    .flat()
    .forEach((reference) => loadReferencePayload(reference.src));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(blob);
  });
}

function loadReferencePayload(src) {
  if (!referencePayloads.has(src)) {
    referencePayloads.set(
      src,
      fetch(src).then(async (response) => {
        if (!response.ok) throw new Error("reference image unavailable");

        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        return { blob, dataUrl };
      }),
    );
  }

  return referencePayloads.get(src);
}

function copyImageFallback(dataUrl) {
  const holder = document.createElement("div");
  const image = document.createElement("img");
  const selection = window.getSelection();
  const range = document.createRange();

  holder.contentEditable = "true";
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  image.src = dataUrl;
  holder.appendChild(image);
  document.body.appendChild(holder);

  range.selectNode(image);
  selection.removeAllRanges();
  selection.addRange(range);

  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  holder.remove();
  return copied;
}

function getSelectedPalette() {
  const selected = document.querySelector('input[name="palette"]:checked')?.value;
  return palettes.find((palette) => palette.id === selected) || palettes[0];
}

function isCustomColorSelected() {
  return document.querySelector('input[name="palette"]:checked')?.value === "custom";
}

function getColorPrompt() {
  const customColor = fieldValue("customColorInput");
  if (!isCustomColorSelected()) return getSelectedPalette().prompt;
  if (!customColor) return "*цвет*";

  return customColor.toLowerCase().includes("цвет") ? customColor : `${customColor} цвет`;
}

function makeButtonIconPrompt() {
  const subject = fieldValue("subjectInput") || "*предмет который я хочу изобразить на кнопке*";
  const color = getColorPrompt();
  const details = fieldValue("detailsInput");

  return `3d иконка ${subject} глассморфизм ${color} вот как примеры. скопируй стиль рефов. полупрозрачно, глассморфизм${details ? ` ${details}` : ""}`;
}

function makeSeedreamPrompt() {
  const scene = fieldValue("seedreamSceneInput") || "*что происходит в кадре*";
  const people = fieldValue("seedreamPeopleInput");
  const place = fieldValue("seedreamPlaceInput");
  const mood = fieldValue("seedreamMoodInput");
  const details = fieldValue("seedreamDetailsInput");
  const additions = [scene, people, place, mood, details].filter(Boolean).join(", ");

  return `${SEEDREAM_PREFIX} ${additions}`;
}

function makePrompt() {
  if (activeTopicId === "seedream-realism") return makeSeedreamPrompt();
  return makeButtonIconPrompt();
}

function makeGrokRequest() {
  const idea = fieldValue("aiIdeaInput") || [
    fieldValue("seedreamSceneInput"),
    fieldValue("seedreamPeopleInput"),
    fieldValue("seedreamPlaceInput"),
    fieldValue("seedreamMoodInput"),
    fieldValue("seedreamDetailsInput"),
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "Помоги собрать промпт для реалистичного изображения в Seedream.",
    "Верни только один готовый промпт, без объяснений.",
    "Начало промпта нельзя менять, оно должно идти первым:",
    SEEDREAM_PREFIX,
    "",
    "Дальше дополни сцену по идее ниже. Пиши по-английски, сохрани вайб candid iPhone / phone quality / imperfect real-life shot.",
    `Идея: ${idea || "*моя идея сцены*"}`,
  ].join("\n");
}

function updateAccentColor() {
  const palette = getSelectedPalette();
  document.documentElement.style.setProperty("--accent", palette.gradient.match(/#([0-9a-f]{6})/i)?.[0] || "#7c3aed");
  document.documentElement.style.setProperty("--accent-2", palette.gradient.match(/#[0-9a-f]{6}/gi)?.[1] || "#ec4899");
}

function syncStateFromForm() {
  if (activeTopicId === "button-icon") {
    formState["button-icon"] = {
      subject: fieldValue("subjectInput"),
      palette: document.querySelector('input[name="palette"]:checked')?.value || "purple-pink",
      customColor: fieldValue("customColorInput"),
      details: fieldValue("detailsInput"),
    };
    return;
  }

  if (activeTopicId === "seedream-realism") {
    formState["seedream-realism"] = {
      scene: fieldValue("seedreamSceneInput"),
      people: fieldValue("seedreamPeopleInput"),
      place: fieldValue("seedreamPlaceInput"),
      mood: fieldValue("seedreamMoodInput"),
      details: fieldValue("seedreamDetailsInput"),
      aiIdea: fieldValue("aiIdeaInput"),
    };
  }
}

function updatePrompt() {
  syncStateFromForm();
  els.promptOutput.value = makePrompt();
  updateAccentColor();
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyText(text, successMessage = "Скопировано") {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage);
  } catch {
    if (copyTextFallback(text)) {
      setStatus(successMessage);
    } else {
      setStatus("Не удалось скопировать");
    }
  }
}

async function copyReference(src) {
  const payload = loadReferencePayload(src);

  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": payload.then((item) => item.blob) })]);
      setStatus("Реф скопирован в буфер");
      return;
    }
  } catch {
    // The legacy path below covers browsers that block image clipboard writes.
  }

  try {
    const { dataUrl } = await payload;
    if (!copyImageFallback(dataUrl)) throw new Error("legacy image copy failed");
    setStatus("Реф скопирован в буфер");
  } catch {
    setStatus("Не удалось скопировать реф");
  }
}

function setStatus(message) {
  els.statusText.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    els.statusText.textContent = "";
  }, 1800);
}

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey())) || [];
  } catch {
    return [];
  }
}

function setSaved(items) {
  localStorage.setItem(getStorageKey(), JSON.stringify(items));
}

function renderSaved() {
  const saved = getSaved();

  if (!saved.length) {
    els.savedList.innerHTML = '<p class="saved-empty">Пока пусто. Сохрани удачный промпт, и он появится здесь.</p>';
    return;
  }

  els.savedList.innerHTML = saved
    .map(
      (item, index) => `
        <article class="saved-item">
          <p>${escapeHTML(item.prompt)}</p>
          <button class="ghost-button compact" type="button" data-copy-saved="${index}">Скопировать</button>
        </article>
      `,
    )
    .join("");
}

function saveCurrentPrompt() {
  const prompt = els.promptOutput.value.trim();
  if (!prompt) return;

  const saved = getSaved();
  const withoutDuplicate = saved.filter((item) => item.prompt !== prompt);
  setSaved([{ prompt, createdAt: new Date().toISOString() }, ...withoutDuplicate].slice(0, 12));
  renderSaved();
  setStatus("Сохранено");
}

function resetForm() {
  if (activeTopicId === "button-icon") {
    formState["button-icon"] = {
      subject: "",
      palette: "purple-pink",
      customColor: "",
      details: "",
    };
  }

  if (activeTopicId === "seedream-realism") {
    formState["seedream-realism"] = {
      scene: "",
      people: "",
      place: "",
      mood: "",
      details: "",
      aiIdea: "",
    };
  }

  renderActiveTopic();
}

function switchTopic(topicId) {
  const topic = getTopic(topicId);
  if (!topic.enabled || topic.id === activeTopicId) return;

  syncStateFromForm();
  activeTopicId = topic.id;
  renderActiveTopic();
}

function renderActiveTopic() {
  const topic = getTopic();
  els.builderCategory.textContent = topic.category;
  els.builderTitle.textContent = topic.title;

  renderTopics();
  if (activeTopicId === "seedream-realism") {
    renderSeedreamForm();
  } else {
    renderButtonIconForm();
  }

  renderReferences();
  updatePrompt();
  renderSaved();
}

function bindButtonIconControls() {
  const customColorInput = document.querySelector("#customColorInput");
  const customColorRadio = document.querySelector("#customColorRadio");
  const customColorOption = document.querySelector("#customColorOption");

  customColorInput.addEventListener("focus", () => {
    customColorRadio.checked = true;
    updatePrompt();
  });
  customColorInput.addEventListener("input", () => {
    customColorRadio.checked = true;
  });
  customColorOption.addEventListener("click", () => {
    customColorRadio.checked = true;
    updatePrompt();
  });
}

function bindSeedreamControls() {
  document.querySelector("#aiRequestButton").addEventListener("click", () => {
    syncStateFromForm();
    copyText(makeGrokRequest(), "Запрос для Grok скопирован");
  });
}

function bindEvents() {
  els.topicList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-topic]");
    if (button) switchTopic(button.dataset.topic);
  });

  els.promptForm.addEventListener("input", updatePrompt);
  els.promptForm.addEventListener("change", updatePrompt);
  els.copyButton.addEventListener("click", () => copyText(els.promptOutput.value));
  els.saveButton.addEventListener("click", saveCurrentPrompt);
  els.resetButton.addEventListener("click", resetForm);
  els.clearSavedButton.addEventListener("click", () => {
    setSaved([]);
    renderSaved();
    setStatus("Очищено");
  });
  els.refsGrid.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-ref]");
    const openButton = event.target.closest("[data-open-ref]");
    const references = referencesByTopic[activeTopicId] || [];
    const index = Number(copyButton?.dataset.copyRef ?? openButton?.dataset.openRef);
    const reference = references[index];
    if (!reference) return;

    if (copyButton) {
      copyReference(reference.src);
      return;
    }

    window.open(reference.src, "_blank");
  });
  els.savedList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-saved]");
    if (!button) return;

    const saved = getSaved();
    const item = saved[Number(button.dataset.copySaved)];
    if (item) copyText(item.prompt);
  });
}

preloadReferences();
bindEvents();
renderActiveTopic();
