const allowedOrigins = new Set([
  "https://nastyachuevaa.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const ATLAS_BASE_URL = "https://api.atlascloud.ai/api/v1/model";

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

function formatResult(data) {
  const response = data?.data || data;
  const outputUrl = getOutputUrl(data);
  const imageUrl = outputUrl && (outputUrl.startsWith("data:image/") || outputUrl.startsWith("https://"))
    ? makeProxyImageUrl(outputUrl)
    : "";
  return {
    predictionId: getPredictionId(data),
    status: response?.status || (outputUrl ? "completed" : "processing"),
    error: response?.error || "",
    image: imageUrl
      ? {
          url: imageUrl,
          sourceUrl: outputUrl,
          mediaType: "image/png",
        }
      : null,
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
      return res.status(200).json(formatResult(data));
    } catch (error) {
      return res.status(500).json({ error: error.message || "Could not check the cutout" });
    }
  }

  const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
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

    return res.status(200).json(formatResult(data));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not remove the background" });
  }
};
