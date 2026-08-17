const allowedOrigins = new Set([
  "https://nastyachuevaa.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const BLOB_API_URL = "https://vercel.com/api/blob";

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

async function saveResult(bytes) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Image archive is not configured");

  const pathname = `prompt-studio-cutouts/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
  const response = await fetch(`${BLOB_API_URL}/?${new URLSearchParams({ pathname })}`, {
    method: "PUT",
    body: bytes,
    headers: {
      "Authorization": `Bearer ${token}`,
      "x-api-version": "12",
      "x-vercel-blob-access": "public",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-content-type": "image/png",
    },
  });

  if (!response.ok) throw new Error("Could not save the cutout");
  return response.json();
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Remove.bg key is not configured" });

  const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
  if (!imageUrl || !(/^(https?:\/\/)/.test(imageUrl) || imageUrl.startsWith("/api/image?file="))) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  try {
    const source = await fetch(makeAbsoluteUrl(req, imageUrl));
    if (!source.ok) throw new Error("Could not load the image");
    const sourceType = source.headers.get("content-type")?.split(";")[0] || "image/png";
    const sourceBytes = Buffer.from(await source.arrayBuffer());
    const form = new FormData();
    form.append("size", "auto");
    form.append("format", "png");
    form.append("image_file", new Blob([sourceBytes], { type: sourceType }), "generated-image.png");

    const removed = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });
    if (!removed.ok) {
      const detail = await removed.text();
      throw new Error(detail || "Remove.bg could not remove the background");
    }

    const blob = await saveResult(Buffer.from(await removed.arrayBuffer()));
    return res.status(200).json({
      image: {
        url: blob.url,
        sourceUrl: blob.url,
        mediaType: "image/png",
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not remove the background" });
  }
};
