// netlify/functions/chat.js
exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 204, headers: cors };

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey)
    return { statusCode: 500, headers: cors, body: "Missing DEEPSEEK_API_KEY" };

  try {
    const { messages = [] } = JSON.parse(event.body || "{}");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: 500, headers: cors, body: JSON.stringify(data) };
    }

    const reply = data.choices?.[0]?.message?.content || "No reply";
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: `Server error: ${err}`
    };
  }
};
