// netlify/functions/chat.js (CommonJS)
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

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // ← default to 1.5-flash
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
      // Friendly fallback on quota errors so UI still works
      if (resp.status === 429 || /quota/i.test(raw)) {
        return {
          statusCode: 200,
          headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify({
            reply:
`(Dev note) The AI quota is exhausted for model "${model}".
Options:
• Enable billing on Google Cloud for Gemini, or
• Set GEMINI_MODEL=gemini-1.5-flash (if it has free quota).

Meanwhile, I can still answer basic UrbanEye questions. What do you want to know?`
          })
        };
      }
      return { statusCode: 500, headers: cors, body: `Gemini error: ${raw}` };
    }

    const data = JSON.parse(raw || "{}");
    const reply =
      (data?.candidates?.[0]?.content?.parts || []).map(p => p.text).join("") ||
      "Sorry, I couldn't generate a response.";
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ reply }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: `Server error: ${err}` };
  }
};
