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
    mode: "direct",
    directIdea: "",
    grokIdea: "",
    grokCount: "10",
  },
};

const referencePayloads = new Map();
let activeTopicId = "button-icon";

const els = {
  topicList: document.querySelector("#topicList"),
  builderCategory: document.querySelector("#builderCategory"),
  builderTitle: document.querySelector("#builderTitle"),
  promptForm: document.querySelector("#promptForm"),
  resultTitle: document.querySelector("#resultTitle"),
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
    <fieldset class="field">
      <legend>Опция</legend>
      <div class="mode-grid">
        <label class="mode-option">
          <input
            type="radio"
            name="seedreamMode"
            value="direct"
            ${state.mode === "direct" ? "checked" : ""}
          />
          <span>Добавить мою идею</span>
        </label>
        <label class="mode-option">
          <input
            type="radio"
            name="seedreamMode"
            value="grok"
            ${state.mode === "grok" ? "checked" : ""}
          />
          <span>Развить через Grok</span>
        </label>
      </div>
    </fieldset>

    <div class="mode-panel" data-mode-panel="direct" ${state.mode === "direct" ? "" : "hidden"}>
      <label class="field">
        <span>Моя идея</span>
        <textarea
          id="seedreamDirectIdeaInput"
          name="directIdea"
          rows="6"
          placeholder="например, девушка смеется в лифте, кадр будто снят случайно"
        >${escapeHTML(state.directIdea)}</textarea>
      </label>
    </div>

    <section class="ai-helper mode-panel" data-mode-panel="grok" aria-labelledby="aiHelperTitle" ${state.mode === "grok" ? "" : "hidden"}>
      <div class="ai-helper-heading">
        <h3 id="aiHelperTitle">Grok</h3>
      </div>
      <label class="field">
        <span>Мое желание</span>
        <textarea
          id="seedreamGrokIdeaInput"
          name="grokIdea"
          rows="6"
          placeholder="например, хочу 10 разных сцен про девушку после свидания, снято как случайный селфи-кадр"
        >${escapeHTML(state.grokIdea)}</textarea>
      </label>
      <label class="field small-field">
        <span>Сколько промптов</span>
        <input
          id="seedreamGrokCountInput"
          name="grokCount"
          type="number"
          min="1"
          max="30"
          value="${escapeHTML(state.grokCount)}"
        />
      </label>
      <div class="ai-actions">
        <button class="primary-button" type="button" id="grokGenerateButton">Сгенерировать через Grok</button>
        <button class="ghost-button" type="button" id="aiRequestButton">Скопировать запрос</button>
      </div>
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
  const idea = fieldValue("seedreamDirectIdeaInput") || "*моя идея изображения*";

  return `${SEEDREAM_PREFIX} ${idea}`;
}

function makePrompt() {
  if (activeTopicId === "seedream-realism") {
    const mode = document.querySelector('input[name="seedreamMode"]:checked')?.value || "direct";
    if (mode === "grok") return makeGrokRequest();
    return makeSeedreamPrompt();
  }

  return makeButtonIconPrompt();
}

function makeGrokRequest() {
  const idea = fieldValue("seedreamGrokIdeaInput") || "*мое желание для серии изображений*";
  const count = Math.min(Math.max(Number(fieldValue("seedreamGrokCountInput")) || 10, 1), 30);

  return [
    `Сделай ${count} разных промптов для реалистичных изображений в Seedream.`,
    "Каждый промпт должен начинаться строго с этой фразы, без изменений:",
    SEEDREAM_PREFIX,
    "",
    "После этой фразы развей мою идею в разные конкретные сцены. Пиши по-английски. Каждый вариант должен быть отдельной строкой и полностью готовым промптом для генерации.",
    "Сохрани вайб candid iPhone / phone quality / imperfect real-life shot. Не добавляй объяснения, заголовки и нумерацию.",
    "",
    `Мое желание: ${idea}`,
  ].join("\n");
}

function getGenerateEndpoint() {
  const savedEndpoint = localStorage.getItem("prompt-library.generateEndpoint") || "";
  if (savedEndpoint) return savedEndpoint;

  if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname.endsWith(".vercel.app")) {
    return "/api/generate";
  }

  return "";
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
      mode: document.querySelector('input[name="seedreamMode"]:checked')?.value || "direct",
      directIdea: fieldValue("seedreamDirectIdeaInput"),
      grokIdea: fieldValue("seedreamGrokIdeaInput"),
      grokCount: fieldValue("seedreamGrokCountInput") || "10",
    };
  }
}

function updatePrompt() {
  syncStateFromForm();
  els.resultTitle.textContent =
    activeTopicId === "seedream-realism" && formState["seedream-realism"].mode === "grok"
      ? "Запрос для Grok"
      : "Готовый промпт";
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

async function generateWithGrok() {
  syncStateFromForm();

  const endpoint = getGenerateEndpoint();
  if (!endpoint) {
    setStatus("Backend еще не подключен");
    return;
  }

  const button = document.querySelector("#grokGenerateButton");
  const previousText = button?.textContent;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Генерирую...";
    }
    setStatus("Генерирую...");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request: makeGrokRequest(),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Generation failed");
    }

    els.resultTitle.textContent = "Ответ Grok";
    els.promptOutput.value = data.text;
    setStatus("Готово");
  } catch {
    setStatus("Не удалось сгенерировать");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText;
    }
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
      mode: "direct",
      directIdea: "",
      grokIdea: "",
      grokCount: "10",
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
  els.promptForm.querySelectorAll('input[name="seedreamMode"]').forEach((input) => {
    input.addEventListener("change", () => {
      const mode = input.value;
      els.promptForm.querySelectorAll("[data-mode-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.modePanel !== mode;
      });
      updatePrompt();
    });
  });

  document.querySelector("#grokGenerateButton").addEventListener("click", generateWithGrok);
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
