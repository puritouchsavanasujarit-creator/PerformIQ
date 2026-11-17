/**
 * สัญญาการเรียก Gemini สำหรับหน้าวิเคราะห์เชิงลึก (ใช้ร่วมกัน 2 ที่)
 * - server.ts        : Express dev/preview server (รันด้วย tsx)
 * - worker/index.js  : Cloudflare Worker ที่ deploy ขึ้น Sites
 *
 * ไฟล์นี้ต้องไม่ import อะไรเลย เพื่อให้ bundle เข้า Worker ได้แบบไม่มี dependency
 */

export const GEMINI_MODEL = "gemini-4-hydrogen";

export const SYSTEM_INSTRUCTION =
  "ตอบกลับเป็น JSON ตาม schema ที่กำหนดเท่านั้น ใช้ภาษาไทยที่ชัดเจน กระชับ เชิงปฏิบัติการ (Actionable) และอ้างอิงเฉพาะตัวเลขจริงจากข้อมูลที่ได้รับ";

export interface DiagnosticPayload {
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

/** JSON schema (รูปแบบเดียวกับที่ Gemini API รับ) ของรายงานวินิจฉัย */
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    executiveSummary: {
      type: "STRING",
      description: "บทสรุปผู้บริหาร 2-3 ประโยค วิเคราะห์จุดแข็งและคอขวดหลักจากตัวเลขจริง",
    },
    criticalBottlenecks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          problemTitle: { type: "STRING" },
          rootCause: { type: "STRING" },
          quantifiedImpact: { type: "STRING" },
          solutionStrategy: { type: "STRING" },
          immediateSteps: { type: "ARRAY", items: { type: "STRING" } },
          kpiTarget: { type: "STRING" },
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
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          phase: { type: "STRING" },
          focus: { type: "STRING" },
          actions: { type: "ARRAY", items: { type: "STRING" } },
          expectedOutcome: { type: "STRING" },
        },
        required: ["phase", "focus", "actions", "expectedOutcome"],
      },
    },
  },
  required: ["executiveSummary", "criticalBottlenecks", "thirtyDayRoadmap"],
};

/** สร้าง prompt วิเคราะห์จากตัวเลขสรุปจริงของชุดข้อมูลปัจจุบัน */
export function buildPrompt(payload: DiagnosticPayload): string {
  return `คุณเป็นหัวหน้าฝ่ายวิเคราะห์ประสิทธิภาพการดำเนินงานและกลยุทธ์การขาย (Head of Operations & Revenue Analytics)
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
      `${idx + 1}. ${p.title} (${p.category}) - พบ ${p.affectedCount} เคส, มูลค่าโอกาส/ผลกระทบ ~${p.estimatedImpactThb.toLocaleString()} บาท | ตัวอย่าง Remark: ${p.evidenceSamples
        .slice(0, 4)
        .join(" / ")}`
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
}
