import type {
  AnalyticsSummary,
  DailyMetric,
  DiagnosticProblem,
  ImprovementLevers,
  PlatformMetric,
  ProductMetric,
  ShiftMetric,
  SimulationOutput,
  StaffMetric,
  TrackingRecord,
} from "../types/tracking";

function toIsoDate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.trim().split("/");
  if (parts.length !== 3) return ddmmyyyy;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function toShortDate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.trim().split("/");
  if (parts.length < 2) return ddmmyyyy;
  return `${parts[0]}/${parts[1]}`;
}

export function normalizeText(val: string | undefined | null): string {
  return (val ?? "").replace(/\s+/g, " ").trim();
}

export function normalizePlatform(val: string): string {
  const clean = normalizeText(val);
  return clean === "" ? "ไม่ระบุแพลตฟอร์ม" : clean;
}

export function normalizeShift(val: string): string {
  const clean = normalizeText(val).replace(/\s*-\s*/g, "-");
  return clean === "" ? "ไม่ระบุกะ" : clean;
}

export function isUpsellAccepted(r: TrackingRecord): boolean {
  return normalizeText(r.upsellResponse) === "ลูกค้ารับสินค้าเพิ่ม";
}

export function isUpsellDeclined(r: TrackingRecord): boolean {
  return normalizeText(r.upsellResponse) === "ลูกค้าไม่รับสินค้าเพิ่ม";
}

export function isUpsellAttempted(r: TrackingRecord): boolean {
  return r.upsellChecked || isUpsellAccepted(r) || isUpsellDeclined(r);
}

function parseMinutes(timeStr: string): number | null {
  const m = timeStr.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

function parseShiftRange(shiftStr: string): { start: number; end: number } | null {
  const m = shiftStr.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return { start, end };
}

export function isShiftOverrunOrDelay(r: TrackingRecord): boolean {
  const remark = normalizeText(r.remark);
  if (/(ช้า|รอนาน|ส่งต่อ|กะดึก|เลิกงาน|ข้ามกะ|สั่งที่อื่น|ไม่ทัน)/i.test(remark)) {
    return true;
  }
  const range = parseShiftRange(r.shift);
  const closeMin = parseMinutes(r.closeTime);
  if (!range || closeMin === null) return false;
  // Closed > 25 minutes past end of shift (same day comparison, ignoring midnight wrap edge cases)
  if (range.end > range.start && closeMin > range.end + 25 && closeMin < 23 * 60 + 59) {
    return true;
  }
  return false;
}

export function hasRecordAnomaly(r: TrackingRecord): boolean {
  const remark = normalizeText(r.remark);
  const unpricedClosed = r.status === "Closed" && r.price <= 0;
  const missingEntryOnClosed = r.status === "Closed" && !r.dataEntryDone;
  const closedNoUpsell = r.status === "Closed" && !isUpsellAttempted(r);
  const operationalRemark =
    /(ช้า|ลืม|ผิด|หมด|สต๊อก|สต็อค|ส่งต่อ|เลิกงาน|ไม่กล้า|ไม่แน่ใจ|ช่องทาง|สั่งที่อื่น|เงียบ)/i.test(
      remark
    );
  return (
    unpricedClosed ||
    missingEntryOnClosed ||
    closedNoUpsell ||
    operationalRemark ||
    isShiftOverrunOrDelay(r)
  );
}

export function computeAnalytics(records: TrackingRecord[]): AnalyticsSummary {
  const totalCases = records.length;
  let closedCases = 0;
  let onProcessCases = 0;
  let pendingCases = 0;
  let unspecifiedCases = 0;
  let dataEntryCount = 0;
  let upsellAttemptCount = 0;
  let upsellAcceptedCount = 0;
  let upsellDeclinedCount = 0;
  let totalRevenue = 0;
  let pricedOrdersCount = 0;
  let unpricedClosedCount = 0;
  let shiftOverrunCount = 0;

  let upsellPriceSum = 0;
  let upsellPriceCount = 0;
  let nonUpsellPriceSum = 0;
  let nonUpsellPriceCount = 0;

  const dailyMap = new Map<
    string,
    {
      date: string;
      isoDate: string;
      shortDate: string;
      totalCases: number;
      closedCases: number;
      onProcessCases: number;
      pendingCases: number;
      upsellAttempts: number;
      upsellAccepted: number;
      revenue: number;
      pricedCount: number;
      anomalyCount: number;
    }
  >();

  const platformMap = new Map<
    string,
    {
      platform: string;
      total: number;
      closed: number;
      onProcess: number;
      pending: number;
      upsellAttempts: number;
      upsellAccepted: number;
      revenue: number;
      pricedCount: number;
    }
  >();

  const staffMap = new Map<
    string,
    {
      owner: string;
      total: number;
      closed: number;
      onProcess: number;
      pending: number;
      dataEntryDone: number;
      upsellAttempts: number;
      upsellAccepted: number;
      revenue: number;
      pricedCount: number;
      anomalyCount: number;
      unpricedClosed: number;
      overrunCount: number;
    }
  >();

  const shiftMap = new Map<
    string,
    {
      shift: string;
      total: number;
      closed: number;
      onProcess: number;
      upsellAttempts: number;
      revenue: number;
      overrunCount: number;
    }
  >();

  const productMap = new Map<
    string,
    {
      product: string;
      count: number;
      accepted: number;
      declined: number;
      revenue: number;
    }
  >();

  for (const r of records) {
    const isClosed = r.status === "Closed";
    const isOnProcess = r.status === "On Process";
    const isPending = r.status === "Pending";
    const accepted = isUpsellAccepted(r);
    const declined = isUpsellDeclined(r);
    const attempted = isUpsellAttempted(r);
    const overrun = isShiftOverrunOrDelay(r);
    const anomaly = hasRecordAnomaly(r);

    if (isClosed) closedCases += 1;
    else if (isOnProcess) onProcessCases += 1;
    else if (isPending) pendingCases += 1;
    else unspecifiedCases += 1;

    if (r.dataEntryDone) dataEntryCount += 1;
    if (attempted) upsellAttemptCount += 1;
    if (accepted) upsellAcceptedCount += 1;
    if (declined) upsellDeclinedCount += 1;
    if (overrun) shiftOverrunCount += 1;

    if (r.price > 0) {
      totalRevenue += r.price;
      pricedOrdersCount += 1;
      if (accepted) {
        upsellPriceSum += r.price;
        upsellPriceCount += 1;
      } else if (isClosed) {
        nonUpsellPriceSum += r.price;
        nonUpsellPriceCount += 1;
      }
    } else if (isClosed) {
      unpricedClosedCount += 1;
    }

    // Daily aggregation
    const iso = toIsoDate(r.date);
    const dEntry = dailyMap.get(r.date) ?? {
      date: r.date,
      isoDate: iso,
      shortDate: toShortDate(r.date),
      totalCases: 0,
      closedCases: 0,
      onProcessCases: 0,
      pendingCases: 0,
      upsellAttempts: 0,
      upsellAccepted: 0,
      revenue: 0,
      pricedCount: 0,
      anomalyCount: 0,
    };
    dEntry.totalCases += 1;
    if (isClosed) dEntry.closedCases += 1;
    if (isOnProcess) dEntry.onProcessCases += 1;
    if (isPending) dEntry.pendingCases += 1;
    if (attempted) dEntry.upsellAttempts += 1;
    if (accepted) dEntry.upsellAccepted += 1;
    if (r.price > 0) {
      dEntry.revenue += r.price;
      dEntry.pricedCount += 1;
    }
    if (anomaly) dEntry.anomalyCount += 1;
    dailyMap.set(r.date, dEntry);

    // Platform aggregation
    const pName = normalizePlatform(r.platform);
    const pEntry = platformMap.get(pName) ?? {
      platform: pName,
      total: 0,
      closed: 0,
      onProcess: 0,
      pending: 0,
      upsellAttempts: 0,
      upsellAccepted: 0,
      revenue: 0,
      pricedCount: 0,
    };
    pEntry.total += 1;
    if (isClosed) pEntry.closed += 1;
    if (isOnProcess) pEntry.onProcess += 1;
    if (isPending) pEntry.pending += 1;
    if (attempted) pEntry.upsellAttempts += 1;
    if (accepted) pEntry.upsellAccepted += 1;
    if (r.price > 0) {
      pEntry.revenue += r.price;
      pEntry.pricedCount += 1;
    }
    platformMap.set(pName, pEntry);

    // Staff aggregation
    const ownerName = normalizeText(r.owner) || "ไม่ระบุผู้รับผิดชอบ";
    const sEntry = staffMap.get(ownerName) ?? {
      owner: ownerName,
      total: 0,
      closed: 0,
      onProcess: 0,
      pending: 0,
      dataEntryDone: 0,
      upsellAttempts: 0,
      upsellAccepted: 0,
      revenue: 0,
      pricedCount: 0,
      anomalyCount: 0,
      unpricedClosed: 0,
      overrunCount: 0,
    };
    sEntry.total += 1;
    if (isClosed) sEntry.closed += 1;
    if (isOnProcess) sEntry.onProcess += 1;
    if (isPending) sEntry.pending += 1;
    if (r.dataEntryDone) sEntry.dataEntryDone += 1;
    if (attempted) sEntry.upsellAttempts += 1;
    if (accepted) sEntry.upsellAccepted += 1;
    if (r.price > 0) {
      sEntry.revenue += r.price;
      sEntry.pricedCount += 1;
    } else if (isClosed) {
      sEntry.unpricedClosed += 1;
    }
    if (anomaly) sEntry.anomalyCount += 1;
    if (overrun) sEntry.overrunCount += 1;
    staffMap.set(ownerName, sEntry);

    // Shift aggregation
    const shName = normalizeShift(r.shift);
    const shEntry = shiftMap.get(shName) ?? {
      shift: shName,
      total: 0,
      closed: 0,
      onProcess: 0,
      upsellAttempts: 0,
      revenue: 0,
      overrunCount: 0,
    };
    shEntry.total += 1;
    if (isClosed) shEntry.closed += 1;
    if (isOnProcess) shEntry.onProcess += 1;
    if (attempted) shEntry.upsellAttempts += 1;
    if (r.price > 0) shEntry.revenue += r.price;
    if (overrun) shEntry.overrunCount += 1;
    shiftMap.set(shName, shEntry);

    // Product upsell aggregation
    const prodName = normalizeText(r.product);
    if (prodName) {
      const prEntry = productMap.get(prodName) ?? {
        product: prodName,
        count: 0,
        accepted: 0,
        declined: 0,
        revenue: 0,
      };
      prEntry.count += 1;
      if (accepted) prEntry.accepted += 1;
      if (declined) prEntry.declined += 1;
      if (r.price > 0) prEntry.revenue += r.price;
      productMap.set(prodName, prEntry);
    }
  }

  const dailyMetrics: DailyMetric[] = Array.from(dailyMap.values())
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .map((d) => ({
      date: d.date,
      isoDate: d.isoDate,
      shortDate: d.shortDate,
      totalCases: d.totalCases,
      closedCases: d.closedCases,
      onProcessCases: d.onProcessCases,
      pendingCases: d.pendingCases,
      closingRate: d.totalCases > 0 ? (d.closedCases / d.totalCases) * 100 : 0,
      upsellAttempts: d.upsellAttempts,
      upsellAccepted: d.upsellAccepted,
      upsellAttemptRate: d.closedCases > 0 ? (d.upsellAttempts / d.closedCases) * 100 : 0,
      revenue: d.revenue,
      aov: d.pricedCount > 0 ? d.revenue / d.pricedCount : 0,
      anomalyCount: d.anomalyCount,
    }));

  const platformMetrics: PlatformMetric[] = Array.from(platformMap.values())
    .sort((a, b) => b.total - a.total)
    .map((p) => ({
      platform: p.platform,
      total: p.total,
      closed: p.closed,
      onProcess: p.onProcess,
      pending: p.pending,
      closingRate: p.total > 0 ? (p.closed / p.total) * 100 : 0,
      upsellAttempts: p.upsellAttempts,
      upsellAccepted: p.upsellAccepted,
      upsellAttemptRate: p.closed > 0 ? (p.upsellAttempts / p.closed) * 100 : 0,
      revenue: p.revenue,
      aov: p.pricedCount > 0 ? p.revenue / p.pricedCount : 0,
    }));

  const staffMetrics: StaffMetric[] = Array.from(staffMap.values())
    .map((s) => {
      const closingRate = s.total > 0 ? (s.closed / s.total) * 100 : 0;
      const dataEntryRate = s.total > 0 ? (s.dataEntryDone / s.total) * 100 : 0;
      const upsellAttemptRate = s.closed > 0 ? Math.min(100, (s.upsellAttempts / s.closed) * 100) : 0;
      const upsellWinRate =
        s.upsellAttempts > 0 ? (s.upsellAccepted / s.upsellAttempts) * 100 : 0;
      const aov = s.pricedCount > 0 ? s.revenue / s.pricedCount : 0;
      const anomalyRatio = s.total > 0 ? s.anomalyCount / s.total : 0;

      // Composite efficiency index (0-100) calculated directly from 4 operational dimensions
      const efficiencyScore = Math.round(
        Math.min(100, closingRate * 0.42 + upsellAttemptRate * 0.25 + dataEntryRate * 0.2 + (1 - anomalyRatio) * 100 * 0.13)
      );

      let primaryBottleneck = "สมดุลและสม่ำเสมอ";
      if (s.total >= 5) {
        if (s.unpricedClosed > Math.max(3, s.closed * 0.2)) {
          primaryBottleneck = "ไม่ลงราคาขายหลังปิดเคส";
        } else if (s.onProcess / s.total > 0.6) {
          primaryBottleneck = "เคส On Process ค้างสูง";
        } else if (upsellAttemptRate < 28 && s.closed >= 5) {
          primaryBottleneck = "อัตราเสนอ Upsell ต่ำ";
        } else if (s.overrunCount > Math.max(2, s.total * 0.15)) {
          primaryBottleneck = "ปิดเคสนอกเวลา/ส่งต่อกะ";
        } else if (dataEntryRate < 85) {
          primaryBottleneck = "บันทึกข้อมูลท้ายเคสไม่ครบ";
        }
      }

      return {
        owner: s.owner,
        total: s.total,
        closed: s.closed,
        onProcess: s.onProcess,
        pending: s.pending,
        closingRate,
        dataEntryRate,
        upsellAttempts: s.upsellAttempts,
        upsellAccepted: s.upsellAccepted,
        upsellAttemptRate,
        upsellWinRate,
        revenue: s.revenue,
        aov,
        anomalyCount: s.anomalyCount,
        efficiencyScore,
        primaryBottleneck,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.closed - a.closed);

  const shiftMetrics: ShiftMetric[] = Array.from(shiftMap.values())
    .map((sh) => ({
      shift: sh.shift,
      total: sh.total,
      closed: sh.closed,
      onProcess: sh.onProcess,
      closingRate: sh.total > 0 ? (sh.closed / sh.total) * 100 : 0,
      upsellAttemptRate: sh.closed > 0 ? (sh.upsellAttempts / sh.closed) * 100 : 0,
      revenue: sh.revenue,
      overrunCount: sh.overrunCount,
    }))
    .sort((a, b) => b.total - a.total);

  const productMetrics: ProductMetric[] = Array.from(productMap.values())
    .filter((p) => p.count >= 1)
    .map((p) => ({
      product: p.product,
      count: p.count,
      accepted: p.accepted,
      declined: p.declined,
      acceptRate: p.count > 0 ? (p.accepted / p.count) * 100 : 0,
      revenue: p.revenue,
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .slice(0, 12);

  const closingRate = totalCases > 0 ? (closedCases / totalCases) * 100 : 0;
  const dataEntryRate = totalCases > 0 ? (dataEntryCount / totalCases) * 100 : 0;
  const upsellAttemptRate = closedCases > 0 ? (upsellAttemptCount / closedCases) * 100 : 0;
  const upsellWinRate =
    upsellAttemptCount > 0 ? (upsellAcceptedCount / upsellAttemptCount) * 100 : 0;
  const avgOrderValue = pricedOrdersCount > 0 ? totalRevenue / pricedOrdersCount : 0;
  const upsellAvgOrderValue =
    upsellPriceCount > 0 ? upsellPriceSum / upsellPriceCount : avgOrderValue * 1.15;
  const nonUpsellAvgOrderValue =
    nonUpsellPriceCount > 0 ? nonUpsellPriceSum / nonUpsellPriceCount : avgOrderValue;

  const periodStart = dailyMetrics[0]?.date ?? "-";
  const periodEnd = dailyMetrics[dailyMetrics.length - 1]?.date ?? "-";

  const baseSummary: AnalyticsSummary = {
    totalCases,
    closedCases,
    onProcessCases,
    pendingCases,
    unspecifiedCases,
    closingRate,
    dataEntryRate,
    upsellAttemptCount,
    upsellAttemptRate,
    upsellAcceptedCount,
    upsellDeclinedCount,
    upsellWinRate,
    totalRevenue,
    pricedOrdersCount,
    avgOrderValue,
    upsellAvgOrderValue,
    nonUpsellAvgOrderValue,
    unpricedClosedCount,
    shiftOverrunCount,
    periodStart,
    periodEnd,
    dailyMetrics,
    platformMetrics,
    staffMetrics,
    shiftMetrics,
    productMetrics,
    problems: [],
  };

  baseSummary.problems = detectDiagnosticProblems(records, baseSummary);
  return baseSummary;
}

function collectRemarks(rows: TrackingRecord[], limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const txt = normalizeText(r.remark);
    if (txt && txt.length >= 4 && !seen.has(txt)) {
      seen.add(txt);
      out.push(`${r.date} · ${r.owner.split(" ")[0]}: "${txt}"`);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function detectDiagnosticProblems(
  records: TrackingRecord[],
  summary: AnalyticsSummary
): DiagnosticProblem[] {
  const problems: DiagnosticProblem[] = [];
  const total = Math.max(1, records.length);
  const effectiveAov = summary.avgOrderValue > 0 ? summary.avgOrderValue : 1850;

  // 1. Stalled On Process / Pending Funnel Leakage
  const stalledRows = records.filter(
    (r) => r.status === "On Process" || r.status === "Pending"
  );
  if (stalledRows.length > 0) {
    const stalledPct = (stalledRows.length / total) * 100;
    const fbUb = summary.platformMetrics.find((p) => p.platform === "Facebook UB");
    const worstPlatform = [...summary.platformMetrics]
      .filter((p) => p.total >= 10)
      .sort((a, b) => a.closingRate - b.closingRate)[0];

    const recoverableShare = 0.22; // conservative 22% recovery via structured follow-up
    const impactThb = Math.round(stalledRows.length * recoverableShare * effectiveAov);

    const stalledWithRemarks = stalledRows.filter((r) => normalizeText(r.remark).length > 3);
    const platformHint = worstPlatform
      ? `แพลตฟอร์มที่มีอัตราปิดต่ำสุดคือ ${worstPlatform.platform} (${worstPlatform.closingRate.toFixed(1)}% จาก ${worstPlatform.total} เคส)`
      : fbUb
      ? `Facebook UB มีเคสค้างสูง`
      : "";

    problems.push({
      id: "stalled-on-process",
      title: "เคสค้างสถานะ On Process & Pending สูง (ปิดการขายไม่ได้)",
      category: "Funnel Bottleneck",
      severity: stalledPct >= 45 ? "critical" : stalledPct >= 30 ? "high" : "medium",
      affectedCount: stalledRows.length,
      affectedPct: stalledPct,
      estimatedImpactThb: impactThb,
      rootCauseSummary: `พบเคสที่ยังไม่ปิดการขาย ${stalledRows.length.toLocaleString()} เคส (${stalledPct.toFixed(
        1
      )}% ของเคสทั้งหมด) ส่วนใหญ่ลูกค้าหยุดตอบหลังรับราคา รอโอน หรือยังไม่มีระบบทักซ้ำอัตโนมัติใน 24 ชม. ${platformHint}`,
      solutionTitle: "ติดตั้งระบบ Follow-up 3 จังหวะ & แยกท่อปิดการขายตามช่องทาง",
      solutionDescription:
        "จัดตั้งคิวติดตามเคส On Process แบบแบ่งระดับความเร่งด่วน (Hot/Warm/Cold) พร้อมชุดข้อความทักซ้ำที่ส่งคุณค่าใหม่ เช่น ภาพกระเช้าจริงหรือตัวเลือกขนาดย่อม",
      actionSteps: [
        {
          step: "สร้าง Tag ติดตามอัตโนมัติใน 2 ชม., 12 ชม. และ 24 ชม. สำหรับเคส On Process ทุกราย",
          ownerRole: "หัวหน้าทีมแชท / Admin",
          timeframe: "สัปดาห์ที่ 1",
          expectedEffect: "ลดเคสหลุดกลางทางและกู้คืนยอดขายได้ 18–25%",
        },
        {
          step: "ปรับสคริปต์ส่งใบเสนอราคาบน Facebook ให้จบด้วยคำถามปิดและตัวเลือก 2 ราคา (Standard / Budget)",
          ownerRole: "Sales Team Lead",
          timeframe: "สัปดาห์ที่ 1–2",
          expectedEffect: "เพิ่ม Closing Rate ช่องทาง Facebook ขึ้น +8–12%",
        },
        {
          step: "บังคับทบทวนเคส Pending เกิน 48 ชม. ใน Daily Standup ก่อนเริ่มกะบ่าย",
          ownerRole: "Shift Supervisor",
          timeframe: "ทุกวัน",
          expectedEffect: "ลดเคสค้างสะสมลงต่ำกว่า 35%",
        },
      ],
      kpiTargetLabel: "ลดสัดส่วน On Process จากปัจจุบันลง 15–20%",
      evidenceRows: stalledRows.slice(0, 60),
      evidenceSnippets: collectRemarks(
        stalledWithRemarks.length > 0 ? stalledWithRemarks : stalledRows,
        5
      ),
    });
  }

  // 2. Missed Upsell Gap on Closed Deals
  const closedNoUpsellRows = records.filter(
    (r) => r.status === "Closed" && !isUpsellAttempted(r)
  );
  const upsellHesitationRows = records.filter((r) =>
    /(ลืม|ไม่กล้า|ไม่แน่ใจ|ไม่ได้อัพ|ไม่ได้เสนอ|รีบ)/i.test(normalizeText(r.remark))
  );
  const upsellAffected = Array.from(
    new Map([...closedNoUpsellRows, ...upsellHesitationRows].map((r) => [r.id, r])).values()
  );

  if (upsellAffected.length > 0) {
    const aovLiftPerUpsell = Math.max(
      280,
      summary.upsellAvgOrderValue > summary.nonUpsellAvgOrderValue
        ? Math.round(summary.upsellAvgOrderValue - summary.nonUpsellAvgOrderValue)
        : Math.round(effectiveAov * 0.22)
    );
    const potentialWins = Math.round(
      closedNoUpsellRows.length * Math.max(0.2, summary.upsellWinRate / 100) * 0.65
    );
    const impactThb = Math.max(aovLiftPerUpsell * potentialWins, closedNoUpsellRows.length * 95);

    problems.push({
      id: "missed-upsell-gap",
      title: "ช่องว่างการเสนอ Upsell ในออเดอร์ที่ปิดการขายแล้ว",
      category: "Revenue Expansion",
      severity: summary.upsellAttemptRate < 45 ? "critical" : "high",
      affectedCount: upsellAffected.length,
      affectedPct:
        summary.closedCases > 0
          ? (closedNoUpsellRows.length / summary.closedCases) * 100
          : (upsellAffected.length / total) * 100,
      estimatedImpactThb: impactThb,
      rootCauseSummary: `จากเคสที่ปิดการขายแล้ว ${summary.closedCases.toLocaleString()} เคส มีเคสที่ไม่ได้รับการเสนอหรือบันทึก Upsell ถึง ${closedNoUpsellRows.length.toLocaleString()} เคส (อัตราเสนออยู่ที่ ${summary.upsellAttemptRate.toFixed(
        1
      )}%) โดยพบหมายเหตุระบุว่าทีมงาน "ลืมเสนอ", "ไม่กล้าอัพ" หรือ "ไม่แน่ใจความคุ้มค่า"`,
      solutionTitle: "ระบบ Mandatory Upsell Prompt & คู่สินค้าแนะนำแบบ 1-Click",
      solutionDescription:
        "กำหนดชุดสินค้าจับคู่ (Add-on Bundle) ตามระดับราคา และใส่เงื่อนไขตรวจสอบ Upsell ก่อนเปลี่ยนสถานะเป็น Closed เสมอ",
      actionSteps: [
        {
          step: "สร้าง Quick-Reply ชุดเสนอเพิ่ม 3 ระดับ (ผลไม้ตัดแต่ง 250–390 บ. / น้ำสกัดเย็น / การ์ด-ริบบิ้นพรีเมียม)",
          ownerRole: "Product & Merchandising",
          timeframe: "สัปดาห์ที่ 1",
          expectedEffect: "เพิ่มความมั่นใจให้แอดมินและลดการ 'ไม่กล้าอัพ'",
        },
        {
          step: "ตั้ง Checklist บังคับติ๊กผล Upsell (รับ/ไม่รับ + เหตุผล) ก่อนส่งบิลโอนเงิน",
          ownerRole: "Operations Manager",
          timeframe: "ทันที",
          expectedEffect: "ยกระดับอัตราเสนอ Upsell จากปัจจุบันสู่เป้าหมาย 75%+",
        },
        {
          step: "เทรนนิ่ง Role-play เคสที่ลูกค้าสั่งซ้ำหรือสั่งด่วนเพื่อเสนอขนาดอัปเกรดภายใน 15 วินาที",
          ownerRole: "Team Lead",
          timeframe: "สัปดาห์ที่ 2",
          expectedEffect: `เพิ่มมูลค่าเฉลี่ยต่อบิล (AOV) ขึ้น ~${aovLiftPerUpsell.toLocaleString()} บาท/ออเดอร์ที่รับเพิ่ม`,
        },
      ],
      kpiTargetLabel: "ดันอัตราเสนอ Upsell ≥ 75% ของออเดอร์ที่ปิด",
      evidenceRows: upsellAffected.slice(0, 60),
      evidenceSnippets: collectRemarks(
        upsellHesitationRows.length > 0 ? upsellHesitationRows : closedNoUpsellRows,
        5
      ),
    });
  }

  // 3. Shift Handover & Slow Response SLA
  const slaRows = records.filter((r) => isShiftOverrunOrDelay(r));
  if (slaRows.length > 0) {
    const slaPct = (slaRows.length / total) * 100;
    const lostDelayRows = slaRows.filter((r) => r.status !== "Closed");
    const impactThb = Math.round(
      Math.max(lostDelayRows.length * effectiveAov * 0.45, slaRows.length * effectiveAov * 0.25)
    );

    problems.push({
      id: "shift-handover-sla",
      title: "ความล่าช้าในการตอบแชทและการส่งต่อช่วงรอยต่อกะ (SLA & Handover)",
      category: "Operations & SLA",
      severity: slaRows.length >= 40 ? "high" : "medium",
      affectedCount: slaRows.length,
      affectedPct: slaPct,
      estimatedImpactThb: impactThb,
      rootCauseSummary: `ตรวจพบเคสที่มีสัญญาณตอบช้า ปิดเคสล่วงเลยเวลากะ หรือมีปัญหาการส่งต่อช่วงเปลี่ยนกะ (เช่น กะเช้าต่อกะบ่าย หรือช่วงใกล้เลิกงาน 22:00 น.) จำนวน ${slaRows.length.toLocaleString()} เคส ส่งผลให้ลูกค้าบางรายเปลี่ยนไปสั่งร้านอื่น`,
      solutionTitle: "มาตรฐาน Handover Protocol 15 นาทีก่อนเปลี่ยนกะ & กฎ First-Response SLA",
      solutionDescription:
        "กำหนดระบบแจ้งเตือนแชทค้างตอบเกิน 5 นาที และใช้แบบฟอร์มสรุปเคสค้างส่งต่อกะถัดไปอย่างเป็นระบบ",
      actionSteps: [
        {
          step: "กำหนดเวลา 15 นาทีสุดท้ายของทุกกะ (เช่น 12:45, 17:45, 21:45) เป็นช่วงส่งมอบเคส Active เท่านั้น",
          ownerRole: "Shift Supervisors",
          timeframe: "ทันที",
          expectedEffect: "ลดความตกหล่นช่วงรอยต่อกะลงมากกว่า 70%",
        },
        {
          step: "เปิดระบบ SLA Alert เมื่อแชทลูกค้ายังไม่ได้รับการตอบเกิน 5 นาที (First Response < 5 นาที)",
          ownerRole: "Admin Coordinator",
          timeframe: "สัปดาห์ที่ 1",
          expectedEffect: "ลดเคสลูกค้ายกเลิกเพราะตอบช้า",
        },
      ],
      kpiTargetLabel: "First Response < 5 นาที และส่งต่อกะครบ 100%",
      evidenceRows: slaRows.slice(0, 60),
      evidenceSnippets: collectRemarks(slaRows, 5),
    });
  }

  // 4. Data Hygiene, Missing Pricing & Stock Sync Errors
  const hygieneRows = records.filter((r) => {
    const remark = normalizeText(r.remark);
    const unpricedClosed = r.status === "Closed" && r.price <= 0;
    const missingDataEntry = r.status === "Closed" && !r.dataEntryDone;
    const errorOrStockRemark = /(ผิด|หมด|สต๊อก|สต็อค|ลืมลง|ช่องทาง|ซ้ำ|ขาด)/i.test(remark);
    return unpricedClosed || missingDataEntry || errorOrStockRemark;
  });

  if (hygieneRows.length > 0) {
    const hygienePct = (hygieneRows.length / total) * 100;
    const unpricedCount = summary.unpricedClosedCount;
    const stockLostCount = hygieneRows.filter(
      (r) => r.status !== "Closed" && /(หมด|สต๊อก|สต็อค|ขาด)/i.test(r.remark)
    ).length;
    const impactThb = Math.round(
      stockLostCount * effectiveAov * 0.5 + unpricedCount * 120 + hygieneRows.length * 40
    );

    problems.push({
      id: "data-hygiene-stock-errors",
      title: "ความคลาดเคลื่อนการบันทึกราคา/ข้อมูล และปัญหาสต็อกสินค้าขาดช่วง",
      category: "Data Quality & Inventory",
      severity: unpricedCount > 30 ? "high" : "medium",
      affectedCount: hygieneRows.length,
      affectedPct: hygienePct,
      estimatedImpactThb: impactThb,
      rootCauseSummary: `พบเคสที่ปิดการขายแล้วแต่ไม่บันทึกราคาจำนวน ${unpricedCount.toLocaleString()} เคส รวมถึงเคสที่บันทึกข้อมูลท้ายเคสไม่ครบ หรือพบปัญหาแจ้งสต็อกสินค้า/กระเช้าหมดล่าช้า รวม ${hygieneRows.length.toLocaleString()} เคส ทำให้คำนวณยอดขายจริงคลาดเคลื่อนและเสียโอกาสขายสินค้าทดแทน`,
      solutionTitle: "ระบบ Validation ก่อนบันทึกข้อมูล & บอร์ดอัปเดตสต็อก Real-Time",
      solutionDescription:
        "บังคับตรวจสอบช่องราคา ช่องทางติดต่อ และสต็อกคงเหลือประจำวันก่อนเปิดกะขายทุกเช้า-บ่าย",
      actionSteps: [
        {
          step: "กำหนดกฎ Data Validation: ห้ามตั้งสถานะ Closed หากยังไม่ระบุราคาขาย (> 0 บาท) และช่องทางที่ถูกต้อง",
          ownerRole: "Data & Ops Lead",
          timeframe: "ทันที",
          expectedEffect: "ความครบถ้วนของข้อมูลรายได้ 100% วิเคราะห์กำไรได้แม่นยำ",
        },
        {
          step: "ประกาศรายการ 'สินค้าใกล้หมด / สินค้าทดแทนแนะนำ' ประจำวันเวลา 08:30 และ 13:30 น. ในกลุ่มแอดมิน",
          ownerRole: "Inventory & Fulfill Team",
          timeframe: "สัปดาห์ที่ 1",
          expectedEffect: "ลดเคสเสียโอกาสจากสต็อกขาดและเพิ่มการแนะนำสินค้าทดแทน",
        },
      ],
      kpiTargetLabel: "Data Entry & Pricing Accuracy ≥ 99%",
      evidenceRows: hygieneRows.slice(0, 60),
      evidenceSnippets: collectRemarks(
        hygieneRows.filter((r) => normalizeText(r.remark).length > 3),
        5
      ),
    });
  }

  // 5. Price / Budget / Delivery Distance Objections
  const objectionRows = records.filter((r) =>
    /(แพง|งบ|ค่าส่ง|ไกล|นอกเขต|ราคาสูง|ส่วนลด|ประหยัด)/i.test(normalizeText(r.remark))
  );
  if (objectionRows.length > 0) {
    const objPct = (objectionRows.length / total) * 100;
    const unclosedObj = objectionRows.filter((r) => r.status !== "Closed").length;
    const impactThb = Math.round(Math.max(unclosedObj * effectiveAov * 0.35, objectionRows.length * 450));

    problems.push({
      id: "budget-distance-objections",
      title: "ข้อโต้แย้งด้านงบประมาณ ค่าจัดส่ง และระยะทางนอกเขต",
      category: "Pricing & Logistics",
      severity: objectionRows.length >= 25 ? "medium" : "medium",
      affectedCount: objectionRows.length,
      affectedPct: objPct,
      estimatedImpactThb: impactThb,
      rootCauseSummary: `พบข้อโต้แย้งจากลูกค้าเกี่ยวกับราคาสินค้า ค่าขนส่ง หรือระยะทางจัดส่งใน ${objectionRows.length.toLocaleString()} เคส (ยังไม่ปิด ${unclosedObj} เคส) โดยยังขาดทางเลือกแพ็กเกจราคาเริ่มต้นและตารางค่าส่งมาตรฐานที่ตอบได้ทันที`,
      solutionTitle: "จัดแพ็กเกจ Entry-Tier & โครงสร้างค่าส่งแบบขั้นบันได",
      solutionDescription:
        "เตรียมชุดกระเช้า/กล่องผลไม้ทางเลือกในช่วงงบ 790–1,190 บาท พร้อมโปรโมชันร่วมค่าส่งเมื่อสั่งครบเกณฑ์",
      actionSteps: [
        {
          step: "ออก SKU ทางเลือกช่วงราคาประหยัด (Entry Gift Box) เพื่อให้แอดมินเสนอ Down-sell ได้ทันทีเมื่อลูกค้าติดงบ",
          ownerRole: "Product Manager",
          timeframe: "สัปดาห์ที่ 2",
          expectedEffect: "รักษาฐานลูกค้ากลุ่มงบจำกัดได้เพิ่มขึ้น 25–30%",
        },
        {
          step: "ทำแผนผังโซนค่าส่งและเกณฑ์ส่งฟรี (Free-shipping threshold) เพื่อกระตุ้นให้ลูกค้าเพิ่มยอดแทนการปฏิเสธ",
          ownerRole: "Logistics & Marketing",
          timeframe: "สัปดาห์ที่ 2",
          expectedEffect: "เปลี่ยนข้อโต้แย้งค่าส่งเป็นยอดขายเพิ่มต่อบิล",
        },
      ],
      kpiTargetLabel: "กู้คืนเคสติดข้อโต้แย้งงบ/ค่าส่ง ≥ 30%",
      evidenceRows: objectionRows.slice(0, 60),
      evidenceSnippets: collectRemarks(objectionRows, 5),
    });
  }

  return problems.sort((a, b) => b.estimatedImpactThb - a.estimatedImpactThb);
}

export function simulateImprovement(
  summary: AnalyticsSummary,
  levers: ImprovementLevers
): SimulationOutput {
  const effectiveAov = summary.avgOrderValue > 0 ? summary.avgOrderValue : 1850;
  const upsellBonus =
    summary.upsellAvgOrderValue > summary.nonUpsellAvgOrderValue
      ? Math.max(250, summary.upsellAvgOrderValue - summary.nonUpsellAvgOrderValue)
      : Math.round(effectiveAov * 0.22);

  // Additional closed cases from closing rate lift + SLA recovery on OnProcess/Pending
  const baseTotal = summary.totalCases;
  const targetClosingPct = Math.min(95, summary.closingRate + levers.targetClosingRateLiftPct);
  const liftedClosedByRate = Math.max(
    0,
    Math.round((targetClosingPct / 100) * baseTotal - summary.closedCases)
  );
  const slaRecoverablePool = Math.min(summary.onProcessCases + summary.pendingCases, Math.round(baseTotal * 0.12));
  const recoveredFromSla = Math.round((levers.slaRecoveryPct / 100) * slaRecoverablePool);
  const additionalClosedCases = Math.max(
    0,
    Math.min(summary.onProcessCases + summary.pendingCases, liftedClosedByRate + recoveredFromSla)
  );

  const projectedClosed = summary.closedCases + additionalClosedCases;

  // Additional upsell wins from raising attempt rate and win rate
  const targetAttempts = Math.round(projectedClosed * (levers.targetUpsellAttemptPct / 100));
  const projectedUpsellWins = Math.round(targetAttempts * (levers.targetUpsellWinRatePct / 100));
  const additionalUpsellOrders = Math.max(0, projectedUpsellWins - summary.upsellAcceptedCount);

  const revenueFromNewClosed = additionalClosedCases * effectiveAov;
  const revenueFromExtraUpsell = additionalUpsellOrders * upsellBonus;
  const revenueLiftThb = Math.round(revenueFromNewClosed + revenueFromExtraUpsell);
  const baselineRevenue = Math.round(summary.totalRevenue);
  const projectedRevenue = baselineRevenue + revenueLiftThb;
  const revenueLiftPct = baselineRevenue > 0 ? (revenueLiftThb / baselineRevenue) * 100 : 0;

  const multiplier = baselineRevenue > 0 ? projectedRevenue / baselineRevenue : 1;
  const closedMultiplier = summary.closedCases > 0 ? projectedClosed / summary.closedCases : 1;

  const dailyComparison = summary.dailyMetrics.map((d) => ({
    shortDate: d.shortDate,
    date: d.date,
    baselineRevenue: Math.round(d.revenue),
    projectedRevenue: Math.round(
      d.revenue > 0
        ? d.revenue * multiplier
        : d.totalCases * (targetClosingPct / 100) * effectiveAov * 0.65
    ),
    baselineClosed: d.closedCases,
    projectedClosed: Math.min(d.totalCases, Math.round(d.closedCases * closedMultiplier)),
  }));

  return {
    baselineRevenue,
    projectedRevenue,
    revenueLiftThb,
    revenueLiftPct,
    baselineClosed: summary.closedCases,
    projectedClosed,
    additionalClosedCases,
    additionalUpsellOrders,
    dailyComparison,
  };
}
