const allowedOrigins = new Set([
  "https://nastyachuevaa.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const imageModels = {
  "nano-banana": process.env.NANO_BANANA_IMAGE_MODEL || "google/gemini-3.1-flash-image",
  seedream: process.env.SEEDREAM_IMAGE_MODEL || "bytedance-seed/seedream-4.5",
};

const allowedAspectRatios = new Set(["1:1", "4:5", "3:4", "9:16", "16:9"]);
const allowedResolutions = new Set(["1K", "2K", "4K"]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.has(origin) || origin?.endsWith(".vercel.app") ? origin : "https://nastyachuevaa.github.io";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function getRequestProvider(value) {
  return value === "seedream" ? "seedream" : "nano-banana";
}

function getRequestAspectRatio(value) {
  return allowedAspectRatios.has(value) ? value : "1:1";
}

function getRequestResolution(value) {
  return allowedResolutions.has(value) ? value : "1K";
}

function makeImageUrl(image) {
  if (image?.url) return image.url;
  if (!image?.b64_json) return "";

  const mediaType = image.media_type || image.mime_type || "image/png";
  return `data:${mediaType};base64,${image.b64_json}`;
}

async function requestOpenRouterImage(apiKey, payload) {
  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://prompt-library-six-theta.vercel.app/",
      "X-Title": "Prompt Library",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || "OpenRouter image request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OpenRouter key is not configured" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  const provider = getRequestProvider(req.body?.provider);
  const model = imageModels[provider];
  const count = clampInt(req.body?.count ?? req.body?.n, 1, 4, 1);
  const aspectRatio = getRequestAspectRatio(req.body?.aspectRatio);
  const resolution = getRequestResolution(req.body?.resolution);

  try {
    const basePayload = {
      model,
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
    };
    const requests =
      provider === "seedream"
        ? [requestOpenRouterImage(apiKey, { ...basePayload, n: count })]
        : Array.from({ length: count }, () => requestOpenRouterImage(apiKey, { ...basePayload, n: 1 }));
    const responses = await Promise.all(requests);
    const imageItems = responses.flatMap((data) => data?.data || []);
    const images = imageItems
      .map((image) => ({
        url: makeImageUrl(image),
        mediaType: image?.media_type || image?.mime_type || "image/png",
      }))
      .filter((image) => image.url);

    res.status(200).json({
      images,
      model: responses[0]?.model || model,
      provider,
      usage: responses.map((data) => data?.usage).filter(Boolean),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Could not generate image",
    });
  }
}
