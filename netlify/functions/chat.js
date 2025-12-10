// netlify/functions/chat.js
// UrbanEye chat via Cloudflare Workers AI (free, no billing).
// Requires Netlify env vars: CF_ACCOUNT_ID, CF_API_TOKEN
// Optional: CF_MODEL (default: @cf/meta/llama-3.1-8b-instruct)

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

    // Add a short system prompt so the bot stays on-topic for UrbanEye.
    const sys = {
      role: "system",
      content:
        "You are UrbanEye’s assistant. Be concise and helpful about Health (AQI, health score), Energy (usage, peak, CO2), Water (usage, WQI, leaks), and Waste (bins, recycling). Keep answers short."
    };

    // Cloudflare Workers AI supports OpenAI-style chat messages.
    const chat = [sys, ...messages];

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`; // ← no encode
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
      // Surface CF error body to the UI for faster debugging.
      return { statusCode: 500, headers: cors, body: `CF AI error: ${raw}` };
    }

    const data = JSON.parse(raw || "{}");

    // Workers AI may return different shapes; handle common ones.
    const reply =
      data?.result?.response ||                           // many chat models
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
