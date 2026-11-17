// Cloudflare Worker entrypoint for PerformIQ.
// Serves the built SPA from ASSETS and handles the Gemini diagnostics endpoint
// that server.ts exposes for local development. Prompt/schema/model live in
// shared/geminiDiagnostics.ts so both backends stay in sync.
import {
  GEMINI_MODEL,
  SYSTEM_INSTRUCTION,
  RESPONSE_SCHEMA,
  buildPrompt,
} from "../shared/geminiDiagnostics";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleAnalyze(request, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(
      { error: "ไม่พบ GEMINI_API_KEY ในระบบ กรุณาตรวจสอบการตั้งค่าใน Settings > Secrets" },
      500
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "ข้อมูลสถิติสำหรับวิเคราะห์ไม่ถูกต้อง" }, 400);
  }

  if (!payload || typeof payload.totalCases !== "number") {
    return json({ error: "ข้อมูลสถิติสำหรับวิเคราะห์ไม่ถูกต้อง" }, 400);
  }

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: buildPrompt(payload) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );

  const body = await upstream.text();
  if (!upstream.ok) {
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error?.message || body;
    } catch {
      /* keep raw body */
    }
    return json({ error: message || `Gemini API error (${upstream.status})` }, upstream.status);
  }

  let text = "";
  try {
    const parsed = JSON.parse(body);
    text = parsed?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  } catch {
    return json({ error: "ไม่สามารถอ่านผลลัพธ์จาก Gemini API ได้" }, 502);
  }

  try {
    return json(JSON.parse(text.trim() || "{}"));
  } catch {
    return json({ error: "รูปแบบผลลัพธ์จาก Gemini API ไม่ถูกต้อง" }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/analyze-diagnostics") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
      }
      try {
        return await handleAnalyze(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini API";
        return json({ error: message }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
