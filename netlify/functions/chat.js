// netlify/functions/chat.js
export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: "Missing GEMINI_API_KEY" };
    }

    const { messages = [] } = JSON.parse(event.body || "{}");

    // Convert simple {role, content}[] into Gemini REST "contents"
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }]
    }));

    // Add a short system prompt to keep replies focused on UrbanEye
    contents.unshift({
      role: "user",
      parts: [{ text: "You are UrbanEye assistant. Be concise and helpful about Health, Energy, Water, and Waste panels." }]
    });

    const model = "gemini-1.5-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 500, headers, body: `Gemini error: ${t}` };
    }

    const data = await resp.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "Sorry, I couldn't generate a response.";

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ reply: text })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: `Server error: ${err}` };
  }
}
