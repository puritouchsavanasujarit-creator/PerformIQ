import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import type { Schema } from "@google/genai";
import {
  GEMINI_MODEL,
  SYSTEM_INSTRUCTION,
  RESPONSE_SCHEMA,
  buildPrompt,
  type DiagnosticPayload,
} from "./shared/geminiDiagnostics";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2mb" }));

app.post("/api/analyze-diagnostics", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: "ไม่พบ GEMINI_API_KEY ในระบบ กรุณาตรวจสอบการตั้งค่าใน Settings > Secrets",
      });
      return;
    }

    const payload = req.body as DiagnosticPayload;
    if (!payload || typeof payload.totalCases !== "number") {
      res.status(400).json({ error: "ข้อมูลสถิติสำหรับวิเคราะห์ไม่ถูกต้อง" });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(payload),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // schema กลางเป็น plain JSON เพื่อให้ Worker bundle ไม่ต้องพึ่ง dependency
        responseSchema: RESPONSE_SCHEMA as Schema,
      },
    });

    const text = (response.text ?? "{}").trim();
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini API";
    const rawStatus = (err as { status?: unknown })?.status;
    res.status(typeof rawStatus === "number" ? rawStatus : 500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
