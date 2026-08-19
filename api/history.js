const allowedOrigins = new Set([
  "https://nastyachuevaa.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const BLOB_API_URL = "https://vercel.com/api/blob";
const HISTORY_ROOT = "prompt-studio-history";
const MAX_IMAGES_PER_REQUEST = 12;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.has(origin) || origin?.endsWith(".vercel.app") ? origin : "https://nastyachuevaa.github.io";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

function getTaskId(value) {
  return ["appearance", "seedream", "liveops", "avatars"].includes(value) ? value : "appearance";
}

function safeFileExtension(mediaType) {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/webp") return "webp";
  return "png";
}

function createEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function blobRequest(pathname, init = {}) {
  const token = getToken();
  if (!token) throw new Error("Image archive is not configured");
  const response = await fetch(`${BLOB_API_URL}${pathname}`, {
    ...init,
    headers: {
      "x-api-version": "12",
      "Authorization": `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Image archive request failed");
  }
  return response.json();
}

async function putBlob(pathname, body, contentType) {
  const params = new URLSearchParams({ pathname });
  return blobRequest(`/?${params.toString()}`, {
    method: "PUT",
    body,
    headers: {
      "x-vercel-blob-access": "public",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-content-type": contentType,
    },
  });
}

async function listMetadata(taskId) {
  const params = new URLSearchParams({ prefix: `${HISTORY_ROOT}/${taskId}/entries/`, limit: "1000" });
  const listed = await blobRequest(`?${params.toString()}`, { method: "GET" });
  const metadataBlobs = (listed.blobs || []).filter((blob) => blob.pathname?.endsWith(".json"));
  const entries = await Promise.all(metadataBlobs.map(async (blob) => {
    try {
      const response = await fetch(blob.url);
      if (!response.ok) return null;
      return { ...(await response.json()), metadataUrl: blob.url };
    } catch {
      return null;
    }
  }));
  return entries
    .filter(Boolean)
    .filter((entry) => entry.taskId === taskId && entry.url)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 120);
}

function isRemoteImageUrl(value) {
  return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/api/image?file="));
}

function parseImageDataUrl(value) {
  const match = typeof value === "string" && value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], bytes: Buffer.from(match[2], "base64") };
}

function makeAbsoluteUrl(req, value) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${req.headers.host}${value}`;
}

async function archiveImage(req, taskId, image) {
  const sourceUrl = typeof image.sourceUrl === "string" && image.sourceUrl ? image.sourceUrl : image.url;
  const embeddedImage = parseImageDataUrl(sourceUrl);
  let bytes;
  let mediaType;

  if (embeddedImage) {
    bytes = embeddedImage.bytes;
    mediaType = embeddedImage.mediaType;
  } else {
    if (!isRemoteImageUrl(sourceUrl)) throw new Error("Unsupported image URL");
    const imageResponse = await fetch(makeAbsoluteUrl(req, sourceUrl));
    if (!imageResponse.ok) throw new Error("Could not archive generated image");
    mediaType = imageResponse.headers.get("content-type")?.split(";")[0] || image.mediaType || "image/png";
    if (!mediaType.startsWith("image/")) throw new Error("Generated file is not an image");
    bytes = Buffer.from(await imageResponse.arrayBuffer());
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
    sourceUrl: embeddedImage ? imageBlob.url : sourceUrl,
    mediaType,
    modelLabel: typeof image.modelLabel === "string" ? image.modelLabel : "Image",
    createdAt: typeof image.createdAt === "string" && image.createdAt ? image.createdAt : new Date().toISOString(),
  };
  const metadataBlob = await putBlob(`${HISTORY_ROOT}/${taskId}/entries/${id}.json`, JSON.stringify(entry), "application/json");
  return { ...entry, clientSourceUrl: sourceUrl, metadataUrl: metadataBlob.url };
}

async function deleteEntries(taskId, ids) {
  const entries = await listMetadata(taskId);
  const toDelete = entries.filter((entry) => ids.includes(entry.id));
  if (!toDelete.length) return;
  await blobRequest("/delete", {
    method: "POST",
    body: JSON.stringify({ urls: toDelete.flatMap((entry) => [entry.url, entry.metadataUrl]).filter(Boolean) }),
    headers: { "Content-Type": "application/json" },
  });
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!getToken()) return res.status(503).json({ enabled: false, error: "Image archive is not configured" });

  const taskId = getTaskId(req.method === "GET" ? req.query?.taskId : req.body?.taskId);
  try {
    if (req.method === "GET") return res.status(200).json({ enabled: true, images: await listMetadata(taskId) });
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (req.body?.action === "save") {
      const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, MAX_IMAGES_PER_REQUEST) : [];
      const saved = [];
      const errors = [];
      for (const image of images) {
        try {
          saved.push(await archiveImage(req, taskId, image));
        } catch (error) {
          errors.push(error.message || "Could not archive generated image");
        }
      }
      return res.status(200).json({ enabled: true, images: saved, errors });
    }

    if (req.body?.action === "delete") {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === "string").slice(0, 120) : [];
      await deleteEntries(taskId, ids);
      return res.status(200).json({ enabled: true });
    }

    return res.status(400).json({ error: "Unknown history action" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not update image archive" });
  }
};
