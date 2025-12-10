// netlify/functions/chat.js
exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, headers: cors, body: "Missing GEMINI_API_KEY" };

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash-8b";
    const { messages = [] } = JSON.parse(event.body || "{}");

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }]
    }));
    contents.unshift({
      role: "user",
      parts: [{ text: "You are UrbanEye’s assistant. Be concise and helpful about Health, Energy, Water, and Waste panels." }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    });

    const raw = await resp.text();

    if (!resp.ok) {
      // If quota error, return a friendly reply so UI still works
      if (resp.status === 429 || /quota/i.test(raw)) {
        return {
          statusCode: 200,
          headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify({
            reply:
"(Dev note) Gemini quota is exhausted for the current model. Enable billing or try another model in GEMINI_MODEL (e.g., gemini-1.5-flash-8b)."
          })
        };
      }
      // If model not found, tell the user
      if (resp.status === 404 || /not found|not supported/i.test(raw)) {
        return {
          statusCode: 200,
          headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify({
            reply:
`(Dev note) Model "${model}" is not available on your key. Set GEMINI_MODEL to a model you have (e.g., gemini-1.5-flash-8b).`
          })
        };
      }
      return { statusCode: 500, headers: cors, body: `Gemini error: ${raw}` };
    }

    const data = JSON.parse(raw || "{}");
    const reply = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text).join("") || "Sorry, I couldn't generate a response.";
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ reply }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: `Server error: ${err}` };
  }
};

