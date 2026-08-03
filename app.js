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
    grokResults: [],
    grokRawText: "",
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
  promptCards: document.querySelector("#promptCards"),
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
    <fieldset class="field seedream-mode-field">
      <legend>Опция</legend>
      <div class="mode-grid seedream-mode-grid">
        <label class="mode-option direct-mode">
          <input
            type="radio"
            name="seedreamMode"
            value="direct"
            ${state.mode === "direct" ? "checked" : ""}
          />
          <span class="mode-copy">
            <span class="mode-title">Добавить мою идею</span>
            <span class="mode-meta">Один готовый промпт</span>
          </span>
        </label>
        <label class="mode-option ai-mode">
          <input
            type="radio"
            name="seedreamMode"
            value="grok"
            ${state.mode === "grok" ? "checked" : ""}
          />
          <span class="mode-copy">
            <span class="mode-title">Развить через Grok</span>
            <span class="mode-meta">Подборка отдельных вариантов</span>
          </span>
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
      <div class="ai-helper-grid">
        <label class="field">
          <span>Мое желание</span>
          <textarea
            id="seedreamGrokIdeaInput"
            name="grokIdea"
            rows="7"
            placeholder="например, хочу 10 разных сцен про девушку после свидания, снято как случайный селфи-кадр"
          >${escapeHTML(state.grokIdea)}</textarea>
        </label>
        <label class="field small-field">
          <span>Сколько</span>
          <input
            id="seedreamGrokCountInput"
            name="grokCount"
            type="number"
            min="1"
            max="30"
            value="${escapeHTML(state.grokCount)}"
          />
        </label>
      </div>
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

function getSeedreamMode() {
  return document.querySelector('input[name="seedreamMode"]:checked')?.value || "direct";
}

function isSeedreamGrokMode() {
  return activeTopicId === "seedream-realism" && formState["seedream-realism"].mode === "grok";
}

function makePrompt() {
  if (activeTopicId === "seedream-realism") {
    if (getSeedreamMode() === "grok") return makeGrokRequest();
    return makeSeedreamPrompt();
  }

  return makeButtonIconPrompt();
}

function makeGrokRequest() {
  const idea = fieldValue("seedreamGrokIdeaInput") || "*мое желание для серии изображений*";
  const count = Math.min(Math.max(Number(fieldValue("seedreamGrokCountInput")) || 10, 1), 30);
  const countPhrase = count === 1 ? "1 готовый промпт" : `${count} разных готовых промптов`;

  return [
    `Сделай ${countPhrase} для реалистичных изображений в Seedream.`,
    "Каждый промпт должен начинаться строго с этой фразы, без изменений:",
    SEEDREAM_PREFIX,
    "",
    "После этой фразы развей мою идею в разные конкретные сцены. Пиши по-английски. Каждый вариант должен быть отдельной строкой и полностью готовым промптом для генерации.",
    "Сохрани вайб candid iPhone / phone quality / imperfect real-life shot. Верни только сами промпты: без объяснений, заголовков, нумерации, кавычек и пояснений.",
    "",
    `Мое желание: ${idea}`,
  ].join("\n");
}

function normalizePromptLine(line) {
  return line
    .replace(/^\s*(?:\d+[\).:\-]\s*|[-*•]\s*)/, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
}

function ensureSeedreamPrefix(prompt) {
  const trimmed = normalizePromptLine(prompt);
  if (!trimmed) return "";

  if (trimmed.toLowerCase().startsWith(SEEDREAM_PREFIX.toLowerCase())) {
    return trimmed;
  }

  return `${SEEDREAM_PREFIX} ${trimmed}`;
}

function parseJSONPromptList(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map((item) => String(item));
  } catch {
    // Grok is asked for plain lines, so JSON is only a defensive fallback.
  }

  return [];
}

function isIntroLine(line) {
  return /^(sure|here|below|these are|prompts?:|конечно|вот|держи)\b/i.test(line);
}

function parseGrokPrompts(text) {
  const jsonPrompts = parseJSONPromptList(text);
  if (jsonPrompts.length) return jsonPrompts.map(ensureSeedreamPrefix).filter(Boolean);

  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const prompts = [];
  let current = "";
  const prefixStart = SEEDREAM_PREFIX.slice(0, 42).toLowerCase();
  const hasStructuredLines = lines.some((line) => {
    const cleaned = normalizePromptLine(line);
    return cleaned.toLowerCase().startsWith(prefixStart) || /^\s*(?:\d+[\).:\-]|[-*•])\s*/.test(line);
  });

  if (!hasStructuredLines) {
    return lines.filter((line) => !isIntroLine(line)).map(ensureSeedreamPrefix).filter(Boolean);
  }

  lines.forEach((line) => {
    const cleaned = normalizePromptLine(line);
    if (!cleaned || (!current && isIntroLine(cleaned))) return;

    const startsLikePrompt = cleaned.toLowerCase().startsWith(prefixStart);
    const startsLikeListItem = /^\s*(?:\d+[\).:\-]|[-*•])\s*/.test(line);

    if ((startsLikePrompt || startsLikeListItem) && current) {
      prompts.push(current);
      current = cleaned;
      return;
    }

    current = current ? `${current} ${cleaned}` : cleaned;
  });

  if (current) prompts.push(current);

  return prompts.map(ensureSeedreamPrefix).filter(Boolean);
}

function getGrokResults() {
  return formState["seedream-realism"].grokResults || [];
}

function clearGrokResults() {
  formState["seedream-realism"].grokResults = [];
  formState["seedream-realism"].grokRawText = "";
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
    const previousState = formState["seedream-realism"];
    formState["seedream-realism"] = {
      mode: getSeedreamMode(),
      directIdea: fieldValue("seedreamDirectIdeaInput"),
      grokIdea: fieldValue("seedreamGrokIdeaInput"),
      grokCount: fieldValue("seedreamGrokCountInput") || "10",
      grokResults: previousState.grokResults || [],
      grokRawText: previousState.grokRawText || "",
    };
  }
}

function renderPromptCards(prompts) {
  if (!prompts.length) {
    els.promptCards.innerHTML = '<div class="results-empty">Пока нет вариантов</div>';
    return;
  }

  els.promptCards.innerHTML = prompts
    .map(
      (prompt, index) => `
        <article class="prompt-card">
          <header class="prompt-card-header">
            <span class="prompt-number">${String(index + 1).padStart(2, "0")}</span>
            <div class="prompt-card-actions">
              <button class="ghost-button compact" type="button" data-copy-result="${index}">Копировать</button>
              <button class="ghost-button compact" type="button" data-save-result="${index}">Сохранить</button>
            </div>
          </header>
          <p>${escapeHTML(prompt)}</p>
        </article>
      `,
    )
    .join("");
}

function renderStandardOutput(title, prompt) {
  els.resultTitle.textContent = title;
  els.promptOutput.hidden = false;
  els.promptCards.hidden = true;
  els.copyButton.hidden = false;
  els.saveButton.hidden = false;
  els.copyButton.textContent = "Копировать";
  els.saveButton.textContent = "Сохранить";
  els.promptOutput.value = prompt;
}

function renderGrokOutput() {
  const prompts = getGrokResults();

  els.resultTitle.textContent = prompts.length ? "Варианты Grok" : "Grok";
  els.promptOutput.hidden = true;
  els.promptCards.hidden = false;
  els.copyButton.hidden = prompts.length === 0;
  els.saveButton.hidden = prompts.length === 0;
  els.copyButton.textContent = "Копировать все";
  els.saveButton.textContent = "Сохранить все";
  els.promptOutput.value = prompts.length ? prompts.join("\n\n") : makeGrokRequest();
  renderPromptCards(prompts);
}

function updatePrompt() {
  syncStateFromForm();

  if (isSeedreamGrokMode()) {
    renderGrokOutput();
  } else {
    renderStandardOutput("Готовый промпт", makePrompt());
  }

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
    clearGrokResults();
    renderGrokOutput();
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

    const prompts = parseGrokPrompts(data.text);
    formState["seedream-realism"].grokRawText = data.text;
    formState["seedream-realism"].grokResults = prompts.length ? prompts : [data.text.trim()].filter(Boolean);
    renderGrokOutput();
    setStatus(`Готово: ${formState["seedream-realism"].grokResults.length}`);
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

function getCurrentOutputText() {
  if (isSeedreamGrokMode() && getGrokResults().length) {
    return getGrokResults().join("\n\n");
  }

  return els.promptOutput.value;
}

function getPromptsToSave() {
  if (isSeedreamGrokMode() && getGrokResults().length) return getGrokResults();

  const prompt = els.promptOutput.value.trim();
  return prompt ? [prompt] : [];
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
  const prompts = getPromptsToSave();
  if (!prompts.length) return;

  const saved = getSaved();
  const uniquePrompts = [...new Set(prompts.map((prompt) => prompt.trim()).filter(Boolean))];
  const withoutDuplicate = saved.filter((item) => !uniquePrompts.includes(item.prompt));
  const newItems = uniquePrompts.map((prompt) => ({ prompt, createdAt: new Date().toISOString() }));

  setSaved([...newItems, ...withoutDuplicate].slice(0, 24));
  renderSaved();
  setStatus(uniquePrompts.length > 1 ? "Сохранено все" : "Сохранено");
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
      grokResults: [],
      grokRawText: "",
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

function handleFormInput(event) {
  if (
    activeTopicId === "seedream-realism" &&
    event.target.matches("#seedreamGrokIdeaInput, #seedreamGrokCountInput")
  ) {
    clearGrokResults();
  }

  updatePrompt();
}

function bindEvents() {
  els.topicList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-topic]");
    if (button) switchTopic(button.dataset.topic);
  });

  els.promptForm.addEventListener("input", handleFormInput);
  els.promptForm.addEventListener("change", updatePrompt);
  els.copyButton.addEventListener("click", () => copyText(getCurrentOutputText()));
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
  els.promptCards.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-result]");
    const saveButton = event.target.closest("[data-save-result]");
    const index = Number(copyButton?.dataset.copyResult ?? saveButton?.dataset.saveResult);
    const prompt = getGrokResults()[index];
    if (!prompt) return;

    if (copyButton) {
      copyText(prompt);
      return;
    }

    const saved = getSaved();
    const withoutDuplicate = saved.filter((item) => item.prompt !== prompt);
    setSaved([{ prompt, createdAt: new Date().toISOString() }, ...withoutDuplicate].slice(0, 24));
    renderSaved();
    setStatus("Сохранено");
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
