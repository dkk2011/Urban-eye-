// Minimal Netlify Function proxy to Gemini (text-only, no streaming).
export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",            // for testing; lock to your domain later
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: cors, body: "Missing GEMINI_API_KEY" };
    }

    const body = JSON.parse(event.body || "{}");
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // Convert simple chat history to Gemini "contents"
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }]
    }));

    // Short system nudge (as a leading user turn)
    contents.unshift({
      role: "user",
      parts: [{ text: "You are UrbanEye’s assistant. Be concise and helpful about Health, Energy, Water, and Waste panels." }]
    });

    // Fast & cheap model
    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: 500, headers: cors, body: `Gemini error: ${text}` };
    }

    const data = await resp.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "Sorry, I couldn't generate a response.";

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: `Server error: ${err}` };
  }
}

