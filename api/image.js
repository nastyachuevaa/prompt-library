const allowedOrigins = new Set([
  "https://nastyachuevaa.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const ATLAS_BASE_URL = "https://api.atlascloud.ai/api/v1/model";

const atlasModels = {
  "nano-banana-pro": {
    label: "Nano Banana Pro",
    textModel: "google/nano-banana-pro/text-to-image",
    editModel: "google/nano-banana-pro/edit",
    kind: "nano",
  },
  "seedream-4.5": {
    label: "SeeDream 4.5",
    textModel: "bytedance/seedream-v4.5",
    editModel: "bytedance/seedream-v4.5/edit",
    kind: "seedream",
  },
  "gpt-image-2": {
    label: "GPT Image 2",
    textModel: "openai/gpt-image-2/text-to-image",
    editModel: "openai/gpt-image-2/edit",
    kind: "gpt",
  },
};

const allowedAspectRatios = new Set(["auto", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "5:4", "4:5", "21:9"]);
const allowedResolutions = new Set(["1K", "2K", "4K"]);
const completedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const failedStatuses = new Set(["failed", "error", "timeout", "canceled", "cancelled"]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.has(origin) || origin?.endsWith(".vercel.app") ? origin : "https://nastyachuevaa.github.io";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function getModelConfig(modelKey) {
  return atlasModels[modelKey] || atlasModels["nano-banana-pro"];
}

function getAspectRatio(value) {
  return allowedAspectRatios.has(value) ? value : "1:1";
}

function getResolution(value) {
  return allowedResolutions.has(value) ? value : "1K";
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

async function uploadReference(apiKey, dataUrl, index) {
  if (typeof dataUrl === "string" && /^https?:\/\//.test(dataUrl)) {
    return dataUrl;
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return "";

  const extension = parsed.mimeType.includes("jpeg") ? "jpg" : parsed.mimeType.split("/")[1] || "png";
  const form = new FormData();
  form.append("file", new Blob([parsed.bytes], { type: parsed.mimeType }), `reference-${index + 1}.${extension}`);

  const response = await fetch(`${ATLAS_BASE_URL}/uploadMedia`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: form,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Atlas Cloud upload failed");
  }

  return data?.url || data?.data?.url || data?.data?.download_url || "";
}

function makeGptSize(aspectRatio, resolution) {
  const tier = resolution.toLowerCase();
  const sizes = {
    "1K": {
      "1:1": "1024x1024",
      "3:4": "768x1024",
      "4:3": "1024x768",
      "2:3": "768x1152",
      "3:2": "1152x768",
      "4:5": "1024x1536",
      "9:16": "1024x1536",
      "16:9": "1536x1024",
      "5:4": "1280x1024",
      "21:9": "1536x658",
    },
    "2K": {
      "1:1": "2048x2048",
      "3:4": "2160x2880",
      "4:3": "2880x2160",
      "2:3": "1920x2880",
      "3:2": "2880x1920",
      "4:5": "2160x2880",
      "9:16": "1152x2048",
      "16:9": "2048x1152",
      "5:4": "2560x2048",
      "21:9": "2560x1097",
    },
    "4K": {
      "1:1": "2048x2048",
      "3:4": "2160x2880",
      "4:3": "2880x2160",
      "2:3": "2880x4320",
      "3:2": "4320x2880",
      "4:5": "2160x2880",
      "9:16": "2160x3840",
      "16:9": "3840x2160",
      "5:4": "3840x3072",
      "21:9": "4096x1755",
    },
  };

  return sizes[resolution]?.[aspectRatio] || (tier === "1k" ? "1024x1024" : "2048x2048");
}

function makeSeedreamSize(aspectRatio, resolution) {
  const normalizedResolution = resolution === "1K" ? "2K" : resolution;
  const sizes = {
    "2K": {
      "1:1": "2048*2048",
      "3:4": "1728*2304",
      "4:3": "2304*1728",
      "2:3": "1536*2304",
      "3:2": "2304*1536",
      "4:5": "1664*2496",
      "9:16": "1600*2848",
      "16:9": "2848*1600",
      "5:4": "2304*1840",
      "21:9": "3008*1288",
    },
    "4K": {
      "1:1": "4096*4096",
      "3:4": "3520*4704",
      "4:3": "4704*3520",
      "2:3": "3136*4704",
      "3:2": "4704*3136",
      "4:5": "3328*4992",
      "9:16": "3040*5504",
      "16:9": "5504*3040",
      "5:4": "4608*3688",
      "21:9": "4096*1755",
    },
  };

  return sizes[normalizedResolution]?.[aspectRatio] || "2048*2048";
}

function buildAtlasPayload({ modelConfig, prompt, aspectRatio, resolution, uploadedReferences }) {
  const hasReferences = uploadedReferences.length > 0 && modelConfig.editModel;
  const model = hasReferences ? modelConfig.editModel : modelConfig.textModel;
  const payload = {
    model,
    prompt,
    enable_base64_output: false,
    enable_sync_mode: false,
  };

  if (hasReferences) {
    payload.images = uploadedReferences;
  }

  if (modelConfig.kind === "gpt") {
    payload.size = makeGptSize(aspectRatio === "auto" ? "1:1" : aspectRatio, resolution);
    payload.quality = "medium";
    payload.output_format = "jpeg";
    payload.moderation = "low";
    return payload;
  }

  if (modelConfig.kind === "seedream") {
    payload.size = makeSeedreamSize(aspectRatio === "auto" ? "1:1" : aspectRatio, resolution);
    return payload;
  }

  if (aspectRatio !== "auto") payload.aspect_ratio = aspectRatio;
  payload.resolution = resolution.toLowerCase();
  payload.output_format = "png";
  payload.media_resolution = "default";
  payload.enable_web_search = false;
  return payload;
}

async function submitAtlasGeneration(apiKey, payload) {
  const response = await fetch(`${ATLAS_BASE_URL}/generateImage`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || data?.message || data?.data?.error || "Atlas Cloud generation failed");
  }

  const prediction = data?.data || data;
  return prediction;
}

async function getAtlasPrediction(apiKey, predictionId) {
  const response = await fetch(`${ATLAS_BASE_URL}/prediction/${predictionId}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Atlas Cloud polling failed");
  }

  return data?.data || data;
}

function getOutputUrls(prediction) {
  const outputs = [];
  if (Array.isArray(prediction?.outputs)) outputs.push(...prediction.outputs);
  if (Array.isArray(prediction?.output)) outputs.push(...prediction.output);
  if (Array.isArray(prediction?.images)) outputs.push(...prediction.images);
  if (prediction?.output?.image) outputs.push(prediction.output.image);

  return outputs
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.url || item?.download_url || item?.image || item?.image_url || item?.output_url || "";
    })
    .filter((item) => typeof item === "string")
    .filter(Boolean);
}

function getPredictionId(prediction) {
  return prediction?.id || prediction?.prediction_id || prediction?.predictionId || prediction?.request_id || "";
}

function isPredictionComplete(prediction) {
  return completedStatuses.has(prediction?.status) && getOutputUrls(prediction).length > 0;
}

function getMediaType(url) {
  const cleanUrl = String(url).split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return "image/jpeg";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  return "image/png";
}

function encodeImageSource(url) {
  return Buffer.from(url, "utf8").toString("base64url");
}

function decodeImageSource(value) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function isPrivateHostname(hostname) {
  const value = hostname.toLowerCase();
  if (["localhost", "0.0.0.0", "127.0.0.1", "::1"].includes(value)) return true;
  if (/^10\./.test(value)) return true;
  if (/^127\./.test(value)) return true;
  if (/^169\.254\./.test(value)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true;
  if (/^192\.168\./.test(value)) return true;
  return false;
}

function isSafeRemoteImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function makeImageUrl(url) {
  if (url.startsWith("data:image/")) return url;
  if (!isSafeRemoteImageUrl(url)) return "";
  return `/api/image?file=${encodeImageSource(url)}`;
}

function detectMediaType(bytes, fallback = "image/png") {
  const view = new Uint8Array(bytes);
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg";
  if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) return "image/png";
  if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) return "image/webp";
  return fallback;
}

async function proxyImage(req, res, apiKey) {
  const requestUrl = new URL(req.url, "http://localhost");
  const sourceUrl = decodeImageSource(requestUrl.searchParams.get("file") || "");

  if (!isSafeRemoteImageUrl(sourceUrl)) {
    res.status(400).json({ error: "Image URL is not allowed" });
    return;
  }

  const sourceHost = new URL(sourceUrl).hostname;
  const headers = sourceHost.endsWith("atlascloud.ai")
    ? { "Authorization": `Bearer ${apiKey}` }
    : {};
  const response = await fetch(sourceUrl, { headers });

  if (!response.ok) {
    res.status(502).json({ error: "Image file is unavailable" });
    return;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const headerMediaType = response.headers.get("content-type") || "";
  const mediaType = headerMediaType.startsWith("image/")
    ? headerMediaType.split(";")[0]
    : detectMediaType(bytes);

  res.setHeader("Content-Type", mediaType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.status(200).send(bytes);
}

function formatImages(outputs) {
  return outputs
    .map((sourceUrl) => ({
      url: makeImageUrl(sourceUrl),
      sourceUrl,
      mediaType: getMediaType(sourceUrl),
    }))
    .filter((image) => image.url);
}

function formatPrediction(prediction) {
  const outputs = getOutputUrls(prediction);
  return {
    id: getPredictionId(prediction),
    status: prediction?.status || "processing",
    error: prediction?.error || "",
    images: formatImages(outputs),
  };
}

async function startAtlasJobs({ apiKey, modelConfig, prompt, count, aspectRatio, resolution, inputReferences }) {
  const uploadedReferences = (
    await Promise.all(inputReferences.map((reference, index) => uploadReference(apiKey, reference, index)))
  ).filter(Boolean);

  return Promise.all(
    Array.from({ length: count }, async () => {
      const payload = buildAtlasPayload({
        modelConfig,
        prompt,
        aspectRatio,
        resolution,
        uploadedReferences,
      });
      const submitted = await submitAtlasGeneration(apiKey, payload);
      const predictionId = getPredictionId(submitted);
      if (!predictionId && !isPredictionComplete(submitted)) {
        throw new Error("Atlas Cloud did not return a prediction id");
      }

      return formatPrediction(submitted);
    }),
  );
}

async function pollAtlasJobs({ apiKey, predictionIds }) {
  return Promise.all(
    predictionIds.map(async (predictionId) => {
      const prediction = await getAtlasPrediction(apiKey, predictionId);
      return formatPrediction(prediction);
    }),
  );
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const apiKey = process.env.ATLASCLOUD_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Atlas Cloud key is not configured" });
    return;
  }

  if (req.method === "GET") {
    try {
      await proxyImage(req, res, apiKey);
    } catch (error) {
      res.status(500).json({ error: error.message || "Could not load image" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const action = req.body?.action === "poll" ? "poll" : "start";
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (action === "start" && !prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  const modelConfig = getModelConfig(req.body?.modelKey);
  const count = clampInt(req.body?.count, 1, 4, 1);
  const aspectRatio = getAspectRatio(req.body?.aspectRatio);
  const resolution = getResolution(req.body?.resolution);
  const inputReferences = Array.isArray(req.body?.inputReferences) ? req.body.inputReferences.slice(0, 10) : [];
  const predictionIds = Array.isArray(req.body?.predictionIds)
    ? req.body.predictionIds.filter((item) => typeof item === "string" && item).slice(0, 4)
    : [];

  try {
    if (action === "poll") {
      if (!predictionIds.length) {
        res.status(400).json({ error: "Prediction ids are required" });
        return;
      }

      const predictions = await pollAtlasJobs({ apiKey, predictionIds });
      res.status(200).json({
        predictions,
        images: predictions.flatMap((prediction) => prediction.images),
        model: modelConfig.label,
        provider: "atlas-cloud",
      });
      return;
    }

    const predictions = await startAtlasJobs({
      apiKey,
      modelConfig,
      prompt,
      count,
      aspectRatio,
      resolution,
      inputReferences,
    });

    res.status(200).json({
      predictions,
      images: predictions.flatMap((prediction) => prediction.images),
      model: modelConfig.label,
      provider: "atlas-cloud",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Could not generate image",
    });
  }
}
