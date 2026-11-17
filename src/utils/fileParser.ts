import Papa from "papaparse";
import * as pdfjsLib from "pdfjs-dist";
import type { CaseStatus, TrackingRecord } from "../types/tracking";

// Configure worker for Vite bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export function normalizeThaiPdfText(raw: string): string {
  return raw
    .replace(/\u0e4d\u0e32/g, "\u0e33") // decomposed ำ -> ำ
    .replace(/˛/g, "\u0e31") // ั
    .replace(/ˮ/g, "\u0e34") // ิ
    .replace(/ˠ/g, "\u0e49") // ้
    .replace(/˷/g, "\u0e49") // ้
    .replace(/ˡ/g, "\u0e49") // ้
    .replace(/˝/g, "\u0e48") // ่
    .replace(/˨/g, "\u0e4c") // ์
    .replace(/˫/g, "\u0e47") // ็
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatus(val: string): CaseStatus | string {
  const clean = val.trim().toLowerCase();
  if (clean === "closed" || clean === "ปิดการขาย" || clean === "ปิด") return "Closed";
  if (clean === "on process" || clean === "กำลังดำเนินการ") return "On Process";
  if (clean === "pending" || clean === "รอดำเนินการ") return "Pending";
  if (!clean) return "Unspecified";
  return val.trim();
}

function parseBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  const s = String(val ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "ใช่" || s === "✓" || s === "checked";
}

function parseNumber(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? "").replace(/[,฿บาท\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function parseCsvOrTsv(file: File, startingId = 1): Promise<TrackingRecord[]> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: TrackingRecord[] = [];
        let nextId = startingId;

        for (const raw of results.data) {
          const getField = (keys: string[]): string => {
            for (const k of keys) {
              if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== "") {
                return String(raw[k]).trim();
              }
            }
            // Fuzzy fallback matching header substrings
            const entry = Object.entries(raw).find(([col]) =>
              keys.some((k) => col.toLowerCase().includes(k.toLowerCase()))
            );
            return entry && entry[1] !== undefined && entry[1] !== null
              ? String(entry[1]).trim()
              : "";
          };

          const date = getField(["date", "วันที่"]);
          const owner = getField(["owner", "ผู้รับผิดชอบ", "พนักงาน", "staff", "แอดมิน"]);
          const customer = getField(["customer", "ลูกค้า"]);
          const status = normalizeStatus(getField(["status", "สถานะ"]));
          const price = parseNumber(getField(["price", "ราคา", "ยอดขาย", "amount"]));

          if (!date && !owner && !customer && price === 0) continue;

          const upsellResponse = getField(["upsellResponse", "การตอบรับ", "upsell_response"]);
          const saleClosedRaw = getField(["saleClosed", "ปิดการขายลง", "sale_closed"]);
          const upsellCheckedRaw = getField(["upsellChecked", "เช็คอัพเซล", "upsell_checked"]);

          rows.push({
            id: nextId++,
            date: date || new Date().toLocaleDateString("en-GB"),
            owner: owner || "ไม่ระบุผู้รับผิดชอบ",
            shift: getField(["shift", "กะ", "ช่วงเวลา"]),
            platform: getField(["platform", "แพลตฟอร์ม", "ช่องทาง"]),
            closeTime: getField(["closeTime", "เวลาปิด", "time"]),
            customer: customer || "-",
            status,
            remark: getField(["remark", "หมายเหตุ", "โน้ต"]),
            dataEntryDone: parseBool(getField(["dataEntryDone", "ลงข้อมูล", "data_entry"])),
            saleClosed: saleClosedRaw ? parseBool(saleClosedRaw) : status === "Closed",
            upsellChecked: upsellCheckedRaw
              ? parseBool(upsellCheckedRaw)
              : upsellResponse === "ลูกค้ารับสินค้าเพิ่ม" || upsellResponse === "ลูกค้าไม่รับสินค้าเพิ่ม",
            upsellResponse,
            product: getField(["product", "สินค้าที่เสนอ", "สินค้า"]),
            price,
          });
        }

        if (rows.length === 0) {
          reject(new Error("ไม่พบแถวข้อมูลที่อ่านได้ในไฟล์ CSV/TSV กรุณาตรวจสอบหัวตาราง"));
          return;
        }
        resolve(rows);
      },
      error: (err: Error) => {
        reject(new Error(`อ่านไฟล์ CSV ไม่สำเร็จ: ${err.message}`));
      },
    });
  });
}

interface PdfCheckbox {
  x: number;
  y: number;
  checked: boolean;
}

interface PdfTextSpan {
  x: number;
  y: number;
  text: string;
}

export async function parseTrackingPdf(file: File, startingId = 1): Promise<TrackingRecord[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const records: TrackingRecord[] = [];
  let nextId = startingId;
  let lastSeenDate = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    const textContent = await page.getTextContent();
    const spans: PdfTextSpan[] = [];
    for (const item of textContent.items) {
      if ("str" in item && item.str.trim()) {
        const tx = item.transform[4];
        const ty = pageHeight - item.transform[5];
        spans.push({ x: tx, y: ty, text: normalizeThaiPdfText(item.str) });
      }
    }

    // Extract vector checkboxes from PDF operator list (Google Sheets landscape export format)
    const opList = await page.getOperatorList();
    const checkboxes: PdfCheckbox[] = [];
    let currentTransform: number[] = [1, 0, 0, 1, 0, 0];
    const transformStack: number[][] = [];
    let strokeHex = "";

    const multiplyMatrix = (m1: number[], m2: number[]): number[] => [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === pdfjsLib.OPS.save) {
        transformStack.push([...currentTransform]);
      } else if (fn === pdfjsLib.OPS.restore) {
        currentTransform = transformStack.pop() ?? [1, 0, 0, 1, 0, 0];
      } else if (fn === pdfjsLib.OPS.transform && Array.isArray(args) && args.length >= 6) {
        currentTransform = multiplyMatrix(currentTransform, args as number[]);
      } else if (fn === pdfjsLib.OPS.setFillRGBColor && Array.isArray(args)) {
        strokeHex = String(args[0] ?? "");
      } else if (fn === pdfjsLib.OPS.constructPath && Array.isArray(args)) {
        const coords = args[2] as number[] | Float32Array | undefined;
        if (coords && coords.length >= 4 && (strokeHex === "#808080" || currentTransform[0] < 0.5)) {
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          for (let k = 0; k + 1 < coords.length; k += 2) {
            const x = coords[k];
            const y = coords[k + 1];
            if (Number.isFinite(x) && Number.isFinite(y)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
          const w = maxX - minX;
          const h = maxY - minY;
          if (w >= 10 && w <= 22 && h >= 10 && h <= 22) {
            const cxLocal = (minX + maxX) / 2;
            const cyLocal = (minY + maxY) / 2;
            const pdfX = currentTransform[0] * cxLocal + currentTransform[4];
            const pdfY = pageHeight - (currentTransform[3] * cyLocal + currentTransform[5]);
            if (pdfX > 1050 && pdfX < 1400) {
              checkboxes.push({
                x: pdfX,
                y: pdfY,
                checked: coords.length > 64,
              });
            }
          }
        }
      }
    }

    // Group row anchors from checkboxes (first checkbox column around x ~ 1100..1180)
    const rowAnchors = checkboxes
      .filter((c) => c.x >= 1080 && c.x < 1185)
      .sort((a, b) => a.y - b.y);

    if (rowAnchors.length > 0) {
      for (let rIdx = 0; rIdx < rowAnchors.length; rIdx++) {
        const yTop = rIdx === 0 ? rowAnchors[rIdx].y - 12 : (rowAnchors[rIdx - 1].y + rowAnchors[rIdx].y) / 2;
        const yBottom =
          rIdx === rowAnchors.length - 1
            ? rowAnchors[rIdx].y + 18
            : (rowAnchors[rIdx].y + rowAnchors[rIdx + 1].y) / 2;

        const rowSpans = spans
          .filter((s) => s.y >= yTop && s.y < yBottom)
          .sort((a, b) => a.x - b.x || a.y - b.y);

        const colText = (xMin: number, xMax: number) =>
          rowSpans
            .filter((s) => s.x >= xMin && s.x < xMax)
            .map((s) => s.text)
            .join(" ")
            .trim();

        const dateOwnerRaw = colText(40, 145);
        const dateMatch = dateOwnerRaw.match(/^(\d{2}\/\d{2}\/\d{4})\s*(.*)$/);
        const date = dateMatch ? dateMatch[1] : lastSeenDate;
        if (date) lastSeenDate = date;

        const ownerExtra = dateMatch ? dateMatch[2].trim() : dateOwnerRaw;
        const ownerMain = colText(145, 240);
        const owner = [ownerExtra, ownerMain].filter(Boolean).join(" ").trim();
        const shift = colText(240, 325);
        const platform = colText(325, 425);
        const closeTime = colText(425, 480);
        const customer = colText(480, 620);
        const status = normalizeStatus(colText(620, 710));
        const remark = colText(710, 1080);

        const rowChecks = checkboxes.filter((c) => c.y >= yTop && c.y < yBottom);
        const dataEntryDone = rowChecks.find((c) => c.x >= 1080 && c.x < 1185)?.checked ?? false;
        const saleClosed = rowChecks.find((c) => c.x >= 1185 && c.x < 1295)?.checked ?? false;
        const upsellChecked = rowChecks.find((c) => c.x >= 1295 && c.x < 1390)?.checked ?? false;

        const upsellResponse = colText(1390, 1525);
        const product = colText(1525, 1665);
        const price = parseNumber(colText(1665, 1800));

        if (!owner && !customer && !remark && price === 0) continue;

        records.push({
          id: nextId++,
          date: date || "01/10/2026",
          owner: owner || "ไม่ระบุผู้รับผิดชอบ",
          shift,
          platform,
          closeTime,
          customer: customer || "-",
          status,
          remark,
          dataEntryDone,
          saleClosed: saleClosed || status === "Closed",
          upsellChecked:
            upsellChecked ||
            upsellResponse === "ลูกค้ารับสินค้าเพิ่ม" ||
            upsellResponse === "ลูกค้าไม่รับสินค้าเพิ่ม",
          upsellResponse,
          product,
          price,
        });
      }
    }
  }

  if (records.length === 0) {
    throw new Error(
      "ไม่พบโครงสร้างตาราง DailyTracking ในไฟล์ PDF นี้ กรุณาใช้ไฟล์ส่งออกตาราง DailyTracking หรือนำเข้าเป็น CSV/TSV"
    );
  }
  return records;
}

export function exportRecordsToCsv(records: TrackingRecord[], filename = "performiq-export.csv"): void {
  const csv = Papa.unparse(
    records.map((r) => ({
      ID: r.id,
      Date: r.date,
      Owner: r.owner,
      Shift: r.shift,
      Platform: r.platform,
      CloseTime: r.closeTime,
      Customer: r.customer,
      Status: r.status,
      Remark: r.remark,
      DataEntryDone: r.dataEntryDone ? "TRUE" : "FALSE",
      SaleClosed: r.saleClosed ? "TRUE" : "FALSE",
      UpsellChecked: r.upsellChecked ? "TRUE" : "FALSE",
      UpsellResponse: r.upsellResponse,
      Product: r.product,
      Price: r.price,
    }))
  );

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
