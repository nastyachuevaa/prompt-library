const allowedOrigins = new Set([
  "https://nastyachuevaa.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const ATLAS_BASE_URL = "https://api.atlascloud.ai/api/v1/model";
const BLOB_API_URL = "https://vercel.com/api/blob";
const HISTORY_ROOT = "prompt-studio-history";

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.has(origin) || origin?.endsWith(".vercel.app") ? origin : "https://nastyachuevaa.github.io";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function makeAbsoluteUrl(req, value) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${req.headers.host}${value}`;
}

function makeProxyImageUrl(sourceUrl) {
  if (sourceUrl.startsWith("data:image/")) return sourceUrl;
  return `/api/image?file=${Buffer.from(sourceUrl).toString("base64url")}`;
}

function getTaskId(value) {
  return ["liveops", "avatars"].includes(value) ? value : "liveops";
}

function parseImageDataUrl(value) {
  const match = typeof value === "string" && value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], bytes: Buffer.from(match[2], "base64") };
}

function safeFileExtension(mediaType) {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/webp") return "webp";
  return "png";
}

function createEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function putBlob(pathname, body, contentType) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Image archive is not configured");
  const params = new URLSearchParams({ pathname });
  const response = await fetch(`${BLOB_API_URL}/?${params.toString()}`, {
    method: "PUT",
    headers: {
      "x-api-version": "12",
      "Authorization": `Bearer ${token}`,
      "x-vercel-blob-access": "public",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-content-type": contentType,
    },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(getAtlasError(data, "Could not save the image archive"));
  return data;
}

async function archiveResult(apiKey, outputUrl, taskId, modelLabel) {
  const embeddedImage = parseImageDataUrl(outputUrl);
  let bytes;
  let mediaType;

  if (embeddedImage) {
    bytes = embeddedImage.bytes;
    mediaType = embeddedImage.mediaType;
  } else {
    const headers = new URL(outputUrl).hostname.endsWith("atlascloud.ai")
      ? { "Authorization": `Bearer ${apiKey}` }
      : {};
    const response = await fetch(outputUrl, { headers });
    if (!response.ok) throw new Error("Could not load the cutout from Atlas Cloud");
    bytes = Buffer.from(await response.arrayBuffer());
    mediaType = response.headers.get("content-type")?.split(";")[0] || "image/png";
  }

  const id = createEntryId();
  const imageBlob = await putBlob(
    `${HISTORY_ROOT}/${taskId}/images/${id}.${safeFileExtension(mediaType)}`,
    bytes,
    mediaType,
  );
  const entry = {
    id,
    taskId,
    url: imageBlob.url,
    sourceUrl: imageBlob.url,
    mediaType,
    modelLabel: `${modelLabel} - без фона`,
    createdAt: new Date().toISOString(),
  };
  await putBlob(`${HISTORY_ROOT}/${taskId}/entries/${id}.json`, JSON.stringify(entry), "application/json");
  return entry;
}

function getOutputUrl(data) {
  const response = data?.data || data;
  const urls = response?.urls && typeof response.urls === "object"
    ? Object.values(response.urls).flatMap((value) => Array.isArray(value) ? value : [value])
    : [];
  const candidates = [
    ...(Array.isArray(response?.outputs) ? response.outputs : []),
    ...(Array.isArray(response?.output) ? response.output : []),
    ...(Array.isArray(response?.images) ? response.images : []),
    ...urls,
    response?.output?.image,
  ];
  return candidates
    .map((item) => (typeof item === "string" ? item : item?.url || item?.image || item?.download_url || item?.output_url || ""))
    .find(Boolean) || "";
}

function getPredictionId(data) {
  const response = data?.data || data;
  return response?.id || response?.prediction_id || response?.predictionId || response?.request_id || "";
}

async function formatResult(apiKey, data, taskId, modelLabel) {
  const response = data?.data || data;
  const outputUrl = getOutputUrl(data);
  const imageUrl = outputUrl && (outputUrl.startsWith("data:image/") || outputUrl.startsWith("https://"))
    ? makeProxyImageUrl(outputUrl)
    : "";
  const image = imageUrl ? await archiveResult(apiKey, outputUrl, taskId, modelLabel) : null;
  return {
    predictionId: getPredictionId(data),
    status: response?.status || (outputUrl ? "completed" : "processing"),
    error: response?.error || "",
    image,
  };
}

function getAtlasError(data, fallback) {
  const detail = data?.error || data?.message || data?.data?.error || data?.data?.message || data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  if (data && typeof data === "object") return JSON.stringify(data);
  return fallback;
}

async function uploadSourceImage(apiKey, req, imageUrl) {
  const source = await fetch(makeAbsoluteUrl(req, imageUrl));
  if (!source.ok) throw new Error("Could not load the image");

  const sourceType = source.headers.get("content-type")?.split(";")[0] || "image/png";
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(await source.arrayBuffer())], { type: sourceType }), "generated-image.png");

  const upload = await fetch(`${ATLAS_BASE_URL}/uploadMedia`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: form,
  });
  const data = await upload.json();
  if (!upload.ok) throw new Error(getAtlasError(data, "Could not upload the image to Atlas Cloud"));

  return data?.url || data?.data?.url || data?.data?.download_url || "";
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ATLASCLOUD_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Atlas Cloud key is not configured" });

  if (req.body?.action === "poll") {
    const predictionId = typeof req.body?.predictionId === "string" ? req.body.predictionId : "";
    if (!predictionId) return res.status(400).json({ error: "Prediction id is required" });
    try {
      const polled = await fetch(`${ATLAS_BASE_URL}/prediction/${encodeURIComponent(predictionId)}`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      const data = await polled.json();
      if (!polled.ok) throw new Error(getAtlasError(data, "Atlas Cloud polling failed"));
      return res.status(200).json(await formatResult(apiKey, data, getTaskId(req.body?.taskId), req.body?.modelLabel || "Image"));
    } catch (error) {
      return res.status(500).json({ error: error.message || "Could not check the cutout" });
    }
  }

  const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
  const taskId = getTaskId(req.body?.taskId);
  const modelLabel = typeof req.body?.modelLabel === "string" ? req.body.modelLabel : "Image";
  if (!imageUrl || !(/^(https?:\/\/)/.test(imageUrl) || imageUrl.startsWith("/api/image?file="))) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  try {
    const uploadedImageUrl = await uploadSourceImage(apiKey, req, imageUrl);
    if (!uploadedImageUrl) throw new Error("Atlas Cloud did not return an upload URL");

    const removed = await fetch(`${ATLAS_BASE_URL}/generateImage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "youchuan/v8.1/remove-background",
        image: uploadedImageUrl,
        enable_base64_output: false,
      }),
    });
    const data = await removed.json();
    if (!removed.ok) throw new Error(getAtlasError(data, "Atlas Cloud could not remove the background"));

    return res.status(200).json(await formatResult(apiKey, data, taskId, modelLabel));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not remove the background" });
  }
};
