// netlify/functions/chat.js
// Uses Cloudflare Workers AI. Free on Cloudflare's free plan for light usage.
exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  const accountId = process.env.CF_ACCOUNT_ID;
  const token     = process.env.CF_API_TOKEN;
  const model     = process.env.CF_MODEL || "@cf/meta/llama-3.1-8b-instruct";

  if (!accountId || !token) {
    return { statusCode: 500, headers: cors, body: "Missing CF_ACCOUNT_ID or CF_API_TOKEN" };
  }

  try {
    const { messages = [] } = JSON.parse(event.body || "{}");

    // Build chat messages (system + user history)
    const sys = { role: "system", content: "You are UrbanEye’s assistant. Be concise and helpful about Health, Energy, Water, and Waste panels." };
    const chat = [sys, ...messages];

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodeURIComponent(model)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages: chat })
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return { statusCode: 500, headers: cors, body: `CF AI error: ${raw}` };
    }

    const data = JSON.parse(raw || "{}");
    // Workers AI returns different shapes depending on model family; handle two common cases:
    const reply =
      data?.result?.response ||                           // some models
      data?.result?.output_text ||                        // some meta models
      data?.result?.choices?.[0]?.message?.content ||     // OpenAI-style
      "No reply";

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };

  } catch (e) {
    return { statusCode: 500, headers: cors, body: `Server error: ${e}` };
  }
};
