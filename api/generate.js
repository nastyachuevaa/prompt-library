const allowedOrigins = new Set([
  "https://nastyachuevaa.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.has(origin) || origin?.endsWith(".vercel.app") ? origin : "https://nastyachuevaa.github.io";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

  const requestText = typeof req.body?.request === "string" ? req.body.request.trim() : "";
  if (!requestText) {
    res.status(400).json({ error: "Request text is required" });
    return;
  }

  try {
    const model = process.env.OPENROUTER_MODEL || "x-ai/grok-4.3";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nastyachuevaa.github.io/prompt-library/",
        "X-Title": "Prompt Library",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: requestText,
          },
        ],
        temperature: 0.9,
        max_tokens: 4000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({
        error: data?.error?.message || "OpenRouter request failed",
      });
      return;
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      res.status(502).json({ error: "OpenRouter returned an empty response" });
      return;
    }

    res.status(200).json({ text, model: data.model || model });
  } catch {
    res.status(500).json({ error: "Could not generate prompts" });
  }
}
