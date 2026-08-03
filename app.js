const topics = [
  {
    id: "button-icon",
    title: "3D иконка кнопки",
    category: "Изображения",
    meta: "Предмет, цвет, рефы, стеклянный стиль",
    enabled: true,
  },
  {
    id: "people",
    title: "Люди и портреты",
    category: "Изображения",
    meta: "Описание человека, селфи-метка, ракурс",
    enabled: false,
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

const references = [
  {
    title: "Реф 1",
    src: "assets/ref-camera.png",
  },
];

const referencePayloads = new Map();

const els = {
  topicList: document.querySelector("#topicList"),
  builderCategory: document.querySelector("#builderCategory"),
  builderTitle: document.querySelector("#builderTitle"),
  subjectInput: document.querySelector("#subjectInput"),
  paletteOptions: document.querySelector("#paletteOptions"),
  customColorOption: document.querySelector("#customColorOption"),
  customColorRadio: document.querySelector("#customColorRadio"),
  customColorInput: document.querySelector("#customColorInput"),
  detailsInput: document.querySelector("#detailsInput"),
  promptOutput: document.querySelector("#promptOutput"),
  copyButton: document.querySelector("#copyButton"),
  saveButton: document.querySelector("#saveButton"),
  resetButton: document.querySelector("#resetButton"),
  clearSavedButton: document.querySelector("#clearSavedButton"),
  refsGrid: document.querySelector("#refsGrid"),
  savedList: document.querySelector("#savedList"),
  statusText: document.querySelector("#statusText"),
};

const storageKey = "prompt-library.saved.button-icon.v2";

function renderTopics() {
  els.topicList.innerHTML = topics
    .map(
      (topic) => `
        <button
          class="topic-button"
          type="button"
          data-topic="${topic.id}"
          ${topic.enabled ? 'aria-current="true"' : "disabled"}
        >
          <span class="topic-title">${topic.title}</span>
          <span class="topic-meta">${topic.meta}</span>
        </button>
      `,
    )
    .join("");
}

function renderPalettes() {
  els.paletteOptions.innerHTML = palettes
    .map(
      (palette, index) => `
        <label class="swatch-option">
          <input
            type="radio"
            name="palette"
            value="${palette.id}"
            ${index === 0 ? "checked" : ""}
          />
          <span class="swatch" style="background: ${palette.gradient}"></span>
          <span class="swatch-name">${palette.label}</span>
        </label>
      `,
    )
    .join("");
}

function renderReferences() {
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
  references.forEach((reference) => loadReferencePayload(reference.src));
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
  const customColor = els.customColorInput.value.trim();
  if (!isCustomColorSelected()) return getSelectedPalette().prompt;
  if (!customColor) return "*цвет*";

  return customColor.toLowerCase().includes("цвет") ? customColor : `${customColor} цвет`;
}

function makePrompt() {
  const subject = els.subjectInput.value.trim() || "*предмет который я хочу изобразить на кнопке*";
  const color = getColorPrompt();
  const details = els.detailsInput.value.trim();

  return `3d иконка ${subject} глассморфизм ${color} вот как примеры. скопируй стиль рефов. полупрозрачно, глассморфизм${details ? ` ${details}` : ""}`;
}

function updateAccentColor() {
  const palette = getSelectedPalette();
  document.documentElement.style.setProperty("--accent", palette.gradient.match(/#([0-9a-f]{6})/i)?.[0] || "#7c3aed");
  document.documentElement.style.setProperty("--accent-2", palette.gradient.match(/#[0-9a-f]{6}/gi)?.[1] || "#ec4899");
}

function updatePrompt() {
  els.promptOutput.value = makePrompt();
  updateAccentColor();
}

async function copyPrompt(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Скопировано");
  } catch {
    els.promptOutput.select();
    document.execCommand("copy");
    setStatus("Скопировано");
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
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function setSaved(items) {
  localStorage.setItem(storageKey, JSON.stringify(items));
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
          <p>${item.prompt}</p>
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
  els.subjectInput.value = "";
  els.customColorInput.value = "";
  els.detailsInput.value = "";
  document.querySelector('input[name="palette"][value="purple-pink"]').checked = true;
  updatePrompt();
}

function bindEvents() {
  document.querySelector("#promptForm").addEventListener("input", updatePrompt);
  document.querySelector("#promptForm").addEventListener("change", updatePrompt);
  els.customColorInput.addEventListener("focus", () => {
    els.customColorRadio.checked = true;
    updatePrompt();
  });
  els.customColorInput.addEventListener("input", () => {
    els.customColorRadio.checked = true;
  });
  els.customColorOption.addEventListener("click", () => {
    els.customColorRadio.checked = true;
    updatePrompt();
  });
  els.copyButton.addEventListener("click", () => copyPrompt(els.promptOutput.value));
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
    if (item) copyPrompt(item.prompt);
  });
}

renderTopics();
renderPalettes();
renderReferences();
preloadReferences();
bindEvents();
updatePrompt();
renderSaved();
