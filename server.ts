import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2mb" }));

interface DiagnosticPayload {
  periodLabel: string;
  totalCases: number;
  closedCases: number;
  onProcessCases: number;
  pendingCases: number;
  closingRate: number;
  upsellAttemptRate: number;
  upsellWinRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  unpricedClosedCount: number;
  detectedProblems: Array<{
    title: string;
    category: string;
    affectedCount: number;
    estimatedImpactThb: number;
    evidenceSamples: string[];
  }>;
  topPlatforms: Array<{
    platform: string;
    total: number;
    closed: number;
    closingRate: number;
  }>;
  topStaffHighlights: Array<{
    owner: string;
    total: number;
    closed: number;
    closingRate: number;
    upsellRate: number;
    revenue: number;
  }>;
}

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

    const prompt = `คุณเป็นหัวหน้าฝ่ายวิเคราะห์ประสิทธิภาพการดำเนินงานและกลยุทธ์การขาย (Head of Operations & Revenue Analytics)
วิเคราะห์ข้อมูลการติดตามเคสลูกค้า (Call & Chat Tracking) จริงต่อไปนี้ และสร้างรายงานวินิจฉัยปัญหา แนวทางแก้ไข และแผนการปรับปรุงที่ปฏิบัติได้จริงเป็นภาษาไทยทั้งหมด:

ข้อมูลสรุประบบอัตโนมัติ:
- ช่วงเวลา: ${payload.periodLabel}
- เคสทั้งหมด: ${payload.totalCases} เคส (ปิดการขายแล้ว ${payload.closedCases} เคส, On Process ${payload.onProcessCases} เคส, Pending ${payload.pendingCases} เคส)
- อัตราปิดการขาย (Closing Rate): ${payload.closingRate.toFixed(1)}%
- อัตราการเสนอ Upsell (เทียบกับเคสที่ปิด): ${payload.upsellAttemptRate.toFixed(1)}% | อัตราสำเร็จเมื่อเสนอ: ${payload.upsellWinRate.toFixed(1)}%
- ยอดขายรวมที่บันทึก: ${payload.totalRevenue.toLocaleString()} บาท (ค่าเฉลี่ยต่อออเดอร์ ${payload.avgOrderValue.toFixed(0)} บาท)
- เคสที่ปิดแล้วแต่ไม่พบราคาขาย: ${payload.unpricedClosedCount} เคส

ปัญหาที่ระบบประมวลผลอัตโนมัติตรวจพบ:
${payload.detectedProblems
  .map(
    (p, idx) =>
      `${idx + 1}. ${p.title} (${p.category}) - พบ ${p.affectedCount} เคส, มูลค่าโอกาส/ผลกระทบ ~${p.estimatedImpactThb.toLocaleString()} บาท | ตัวอย่าง Remark: ${p.evidenceSamples.slice(0, 4).join(" / ")}`
  )
  .join("\n")}

ประสิทธิภาพตามแพลตฟอร์ม:
${payload.topPlatforms
  .map((pl) => `- ${pl.platform}: ${pl.total} เคส, ปิด ${pl.closed} เคส (${pl.closingRate.toFixed(1)}%)`)
  .join("\n")}

ประสิทธิภาพทีมงานเด่น/จุดควรพัฒนา:
${payload.topStaffHighlights
  .slice(0, 8)
  .map(
    (st) =>
      `- ${st.owner}: ${st.total} เคส, ปิด ${st.closed} (${st.closingRate.toFixed(1)}%), Upsell ${st.upsellRate.toFixed(1)}%, ยอดขาย ${st.revenue.toLocaleString()} บาท`
  )
  .join("\n")}

กรุณาวิเคราะห์อย่างตรงประเด็น อ้างอิงตัวเลขจริงจากข้อมูลข้างต้น ไม่แต่งตัวเลขขึ้นเอง และออกแบบขั้นตอนปรับปรุงที่ทำได้จริงในทีมขายแชท/แอดมิน`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        systemInstruction:
          "ตอบกลับเป็น JSON ตาม schema ที่กำหนดเท่านั้น ใช้ภาษาไทยที่ชัดเจน กระชับ เชิงปฏิบัติการ (Actionable) และอ้างอิงเฉพาะตัวเลขจริงจากข้อมูลที่ได้รับ",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: "บทสรุปผู้บริหาร 2-3 ประโยค วิเคราะห์จุดแข็งและคอขวดหลักจากตัวเลขจริง",
            },
            criticalBottlenecks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  problemTitle: { type: Type.STRING },
                  rootCause: { type: Type.STRING },
                  quantifiedImpact: { type: Type.STRING },
                  solutionStrategy: { type: Type.STRING },
                  immediateSteps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  kpiTarget: { type: Type.STRING },
                },
                required: [
                  "problemTitle",
                  "rootCause",
                  "quantifiedImpact",
                  "solutionStrategy",
                  "immediateSteps",
                  "kpiTarget",
                ],
              },
            },
            thirtyDayRoadmap: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phase: { type: Type.STRING },
                  focus: { type: Type.STRING },
                  actions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  expectedOutcome: { type: Type.STRING },
                },
                required: ["phase", "focus", "actions", "expectedOutcome"],
              },
            },
          },
          required: ["executiveSummary", "criticalBottlenecks", "thirtyDayRoadmap"],
        },
      },
    });

    const text = (response.text ?? "{}").trim();
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini API";
    const status =
      typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: number }).status === "number"
        ? (err as { status: number }).status
        : 500;
    res.status(status).json({ error: message });
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
