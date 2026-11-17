import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardPlus,
  FileSpreadsheet,
  TrendingUp,
} from "lucide-react";
import type { AnalyticsSummary, CaseStatus, TrackingRecord } from "../types/tracking";

interface OverviewTabProps {
  summary: AnalyticsSummary;
  availableOwners: string[];
  availablePlatforms: string[];
  availableShifts: string[];
  onAddRecord: (record: Omit<TrackingRecord, "id">) => void;
  onNavigateTab: (tab: "problems" | "solutions" | "team" | "explorer", problemFilterId?: string) => void;
  onOpenImportModal: () => void;
}

function formatThb(value: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function toDdMmYyyy(iso: string): string {
  if (!iso || !iso.includes("-")) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  summary,
  availableOwners,
  availablePlatforms,
  availableShifts,
  onAddRecord,
  onNavigateTab,
  onOpenImportModal,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [dateIso, setDateIso] = useState<string>("2026-11-17");
  const [owner, setOwner] = useState<string>(availableOwners[0] ?? "กฤษชฎา ธณิจปัญญกุณ");
  const [shift, setShift] = useState<string>(availableShifts[0] ?? "08:00-13:00");
  const [platform, setPlatform] = useState<string>(availablePlatforms[0] ?? "Line OA UB");
  const [closeTime, setCloseTime] = useState<string>("12:15");
  const [customer, setCustomer] = useState<string>("");
  const [status, setStatus] = useState<CaseStatus>("Closed");
  const [price, setPrice] = useState<string>("1890");
  const [product, setProduct] = useState<string>("ผลไม้ตัดแต่งพร้อมทาน");
  const [upsellResponse, setUpsellResponse] = useState<string>("ลูกค้ารับสินค้าเพิ่ม");
  const [dataEntryDone, setDataEntryDone] = useState<boolean>(true);
  const [remark, setRemark] = useState<string>("");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [upsellChartMode, setUpsellChartMode] = useState<"count" | "rate" | "revenue">("count");
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);

  const totalOpportunityThb = summary.problems.reduce((acc, p) => acc + p.estimatedImpactThb, 0);
  const criticalCount = summary.problems.filter((p) => p.severity === "critical").length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCustomer = customer.trim() || "ลูกค้าทั่วไป";
    const parsedPrice = status === "Closed" ? Math.max(0, Number(price) || 0) : Math.max(0, Number(price) || 0);
    const upsellChecked =
      upsellResponse === "ลูกค้ารับสินค้าเพิ่ม" || upsellResponse === "ลูกค้าไม่รับสินค้าเพิ่ม";

    onAddRecord({
      date: toDdMmYyyy(dateIso || todayIso),
      owner: owner.trim() || "ไม่ระบุผู้รับผิดชอบ",
      shift: shift.trim(),
      platform: platform.trim(),
      closeTime: closeTime.trim(),
      customer: cleanCustomer,
      status,
      remark: remark.trim(),
      dataEntryDone,
      saleClosed: status === "Closed",
      upsellChecked,
      upsellResponse: upsellChecked ? upsellResponse : "",
      product: product.trim(),
      price: parsedPrice,
    });

    setJustAdded(`บันทึกเคส "${cleanCustomer}" แล้ว · ระบบคำนวณกราฟและตัวชี้วัดใหม่เรียบร้อย`);
    setCustomer("");
    setRemark("");
    window.setTimeout(() => setJustAdded(null), 4000);
  };

  if (summary.totalCases === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <BarChart3 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900">ไม่พบข้อมูลตามตัวกรองที่เลือก</h3>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          กรุณาล้างตัวกรอง เพิ่มข้อมูลการทำงานใหม่ หรืออัปโหลดไฟล์ CSV/PDF เพื่อเริ่มการวิเคราะห์อัตโนมัติ
        </p>
        <button
          type="button"
          onClick={onOpenImportModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          นำเข้าข้อมูลการทำงาน
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards Section */}
      <section aria-label="ส่วนแสดงสรุปประสิทธิภาพ">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>เคสทั้งหมดที่ประมวลผล</span>
              <span className="font-mono tabular-nums text-slate-400">
                {summary.periodStart} – {summary.periodEnd}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {summary.totalCases.toLocaleString()}
              </span>
              <span className="text-xs text-slate-600 tabular-nums">
                ปิด {summary.closedCases.toLocaleString()} · ค้าง{" "}
                {(summary.onProcessCases + summary.pendingCases).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
              <span>บันทึกข้อมูลครบ</span>
              <span className="font-mono tabular-nums font-medium text-emerald-700">
                {summary.dataEntryRate.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>อัตราปิดการขาย (Closing Rate)</span>
              <span
                className={`text-xs font-medium ${
                  summary.closingRate >= 50
                    ? "text-emerald-700"
                    : summary.closingRate >= 38
                    ? "text-amber-700"
                    : "text-rose-700"
                }`}
              >
                {summary.closingRate >= 50 ? "ตามเกณฑ์" : "ต่ำกว่าเป้า 55%"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {summary.closingRate.toFixed(1)}%
              </span>
              <span className="text-xs text-amber-700 tabular-nums font-medium">
                On Process {((summary.onProcessCases / summary.totalCases) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
              <span>Pending รอติดตาม</span>
              <span className="font-mono tabular-nums font-medium text-slate-800">
                {summary.pendingCases.toLocaleString()} เคส
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>ยอดขายรวมที่บันทึก</span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {summary.pricedOrdersCount.toLocaleString()} บิลมีราคา
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                ฿{formatThb(summary.totalRevenue)}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
              <span>เฉลี่ยต่อออเดอร์ (AOV)</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                ฿{formatThb(summary.avgOrderValue)}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>อัตราเสนอ Upsell</span>
              <span
                className={`text-xs font-medium ${
                  summary.upsellAttemptRate >= 60
                    ? "text-emerald-700"
                    : summary.upsellAttemptRate >= 40
                    ? "text-amber-700"
                    : "text-rose-700"
                }`}
              >
                {summary.upsellAttemptRate >= 60 ? "ดี" : "มีช่องว่างเสนอเพิ่ม"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {summary.upsellAttemptRate.toFixed(1)}%
              </span>
              <span className="text-xs text-emerald-700 tabular-nums font-medium">
                รับเพิ่ม {summary.upsellAcceptedCount.toLocaleString()} บิล
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
              <span>Win Rate เมื่อเสนอ</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {summary.upsellWinRate.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>ปัญหาและโอกาสที่ตรวจพบ</span>
              <span className="text-xs font-medium text-rose-700 tabular-nums">
                วิกฤต {criticalCount} จุด
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-emerald-700 font-mono tabular-nums">
                +฿{formatThb(totalOpportunityThb)}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between">
              <span className="text-slate-600">
                {summary.problems.length} ประเด็นอัตโนมัติ
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab("problems")}
                className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                ดูสาเหตุ <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Work Data Input Form Section */}
      <section
        aria-label="ช่องใส่ข้อมูลการทำงาน"
        className="bg-white border border-slate-200 rounded-xl p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardPlus className="w-4 h-4 text-emerald-600" />
              บันทึกข้อมูลการทำงานใหม่ (Input Form)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              กรอกเคสหรือรายการทำงานเพิ่มเติม ระบบจะประมวลผลสถิติ ตรวจจับปัญหา และอัปเดตกราฟวิเคราะห์ให้อัตโนมัติทันที
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              อัปโหลด CSV / PDF เป็นชุด
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">วันที่</label>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                required
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ผู้รับผิดชอบ (Staff)
              </label>
              <input
                type="text"
                list="performiq-owners-list"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="ชื่อพนักงาน..."
                required
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <datalist id="performiq-owners-list">
                {availableOwners.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">กะการทำงาน</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                {Array.from(
                  new Set(["08:00-13:00", "09:00-14:00", "13:00-18:00", "14:00-19:00", "17:00-22:00", ...availableShifts])
                )
                  .filter((s) => s && s !== "ไม่ระบุกะ")
                  .map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">แพลตฟอร์ม</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                {Array.from(
                  new Set(["Line OA UB", "Line OA PMF", "Line OA PMF IG", "Facebook UB", "Facebook PMF", ...availablePlatforms])
                )
                  .filter((p) => p && p !== "ไม่ระบุแพลตฟอร์ม")
                  .map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อลูกค้า</label>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="เช่น คุณสมชาย"
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">สถานะเคส</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CaseStatus)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="Closed">Closed (ปิดการขาย)</option>
                <option value="On Process">On Process (กำลังติดตาม)</option>
                <option value="Pending">Pending (รอดำเนินการ)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ยอดขาย (บาท)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 font-mono tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                เวลาปิดเคส
              </label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                การตอบรับ Upsell
              </label>
              <select
                value={upsellResponse}
                onChange={(e) => setUpsellResponse(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="ลูกค้ารับสินค้าเพิ่ม">ลูกค้ารับสินค้าเพิ่ม</option>
                <option value="ลูกค้าไม่รับสินค้าเพิ่ม">ลูกค้าไม่รับสินค้าเพิ่ม</option>
                <option value="">ไม่ได้เสนอ Upsell</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                สินค้า / Upsell SKU
              </label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="เช่น กระเช้า / ผลไม้ตัดแต่ง"
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                หมายเหตุ (ใช้ตรวจปัญหาอัตโนมัติ)
              </label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="เช่น ตอบช้า / รอโอน / ลืมเสนอ"
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="lg:col-span-2 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={dataEntryDone}
                  onChange={(e) => setDataEntryDone(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                ลงข้อมูลครบ
              </label>

              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
              >
                + บันทึกและประมวลผล
              </button>
            </div>
          </div>

          {justAdded && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 pt-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{justAdded}</span>
            </div>
          )}
        </form>
      </section>

      {/* 3. Visualization Area Section */}
      <section aria-label="พื้นที่สำหรับแสดงกราฟวิเคราะห์" className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Primary Time-Series Chart */}
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  แนวโน้มรายได้รายวันเทียบอัตราปิดการขายและ Upsell
                </h3>
                <p className="text-xs text-slate-500">
                  ประมวลผลรายวัน {summary.dailyMetrics.length} วัน · เปรียบเทียบยอดขาย (บาท) กับ % ประสิทธิภาพ
                </p>
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                เฉลี่ย ฿{formatThb(summary.totalRevenue / Math.max(1, summary.dailyMetrics.length))}/วัน
              </div>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={summary.dailyMetrics}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="shortDate"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={{ stroke: "#CBD5E1" }}
                    minTickGap={16}
                  />
                  <YAxis
                    yAxisId="rev"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    width={46}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E2E8F0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => {
                      const num = Number(value ?? 0);
                      if (name === "ยอดขายรายวัน") return [`฿${formatThb(num)}`, name];
                      return [`${num.toFixed(1)}%`, name];
                    }}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as { date?: string; totalCases?: number } | undefined;
                      return row?.date
                        ? `วันที่ ${row.date} (${row.totalCases ?? 0} เคส)`
                        : String(label);
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar
                    yAxisId="rev"
                    dataKey="revenue"
                    name="ยอดขายรายวัน"
                    fill="#059669"
                    fillOpacity={0.82}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  />
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="closingRate"
                    name="อัตราปิดการขาย (%)"
                    stroke="#0F172A"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="upsellAttemptRate"
                    name="อัตราเสนอ Upsell (%)"
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Platform Funnel Stacked Chart */}
          <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                สัดส่วนสถานะเคสแยกตามแพลตฟอร์ม
              </h3>
              <p className="text-xs text-slate-500">
                ชี้จุดรั่วไหลระหว่างเคส Closed vs On Process ในแต่ละช่องทาง
              </p>
            </div>

            <div className="h-[320px] w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.platformMetrics}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={{ stroke: "#CBD5E1" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="platform"
                    width={106}
                    tick={{ fontSize: 11, fill: "#334155" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E2E8F0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar dataKey="closed" name="Closed" stackId="a" fill="#16A34A" barSize={18} />
                  <Bar
                    dataKey="onProcess"
                    name="On Process"
                    stackId="a"
                    fill="#D97706"
                    barSize={18}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    stackId="a"
                    fill="#DC2626"
                    radius={[0, 3, 3, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Secondary Row: Product Upsell Performance & Automated Bottleneck Action Strip */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-5 min-w-0 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  ประสิทธิผลสินค้าเสนอเพิ่ม (Upsell Top Products)
                </h3>
                <p className="text-xs text-slate-500">
                  เปรียบเทียบสินค้าที่เสนอเพิ่มแยกตามผลตอบรับและมูลค่า
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] shrink-0">
                {[
                  { id: "count", label: "จำนวน" },
                  { id: "rate", label: "สำเร็จ %" },
                  { id: "revenue", label: "ยอดขาย" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setUpsellChartMode(m.id as "count" | "rate" | "revenue")}
                    className={`px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                      upsellChartMode === m.id
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {summary.productMetrics.length > 0 ? (
              <div className="w-full min-w-0 h-[270px]">
                <ResponsiveContainer width="100%" height={270} minWidth={0}>
                  <BarChart
                    data={summary.productMetrics.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 18, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={upsellChartMode === "rate" ? [0, 100] : [0, "auto"]}
                      tick={{ fontSize: 11, fill: "#64748B" }}
                      tickLine={false}
                      axisLine={{ stroke: "#CBD5E1" }}
                      tickFormatter={(v) =>
                        upsellChartMode === "rate"
                          ? `${v}%`
                          : upsellChartMode === "revenue" && Number(v) >= 1000
                          ? `${Math.round(Number(v) / 1000)}k`
                          : String(v)
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="product"
                      width={112}
                      tick={{ fontSize: 11, fill: "#334155" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E2E8F0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value, name) => {
                        const num = Number(value ?? 0);
                        if (name === "อัตราสำเร็จ (%)") return [`${num.toFixed(1)}%`, name];
                        if (name === "ยอดขายรวม") return [`฿${formatThb(num)}`, name];
                        return [`${num.toLocaleString()} ครั้ง`, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    {upsellChartMode === "count" && (
                      <>
                        <Bar
                          dataKey="accepted"
                          name="ลูกค้ารับเพิ่ม"
                          stackId="p"
                          fill="#059669"
                          barSize={16}
                        />
                        <Bar
                          dataKey="declined"
                          name="ไม่รับเพิ่ม"
                          stackId="p"
                          fill="#94A3B8"
                          radius={[0, 3, 3, 0]}
                          barSize={16}
                        />
                      </>
                    )}
                    {upsellChartMode === "rate" && (
                      <Bar
                        dataKey="acceptRate"
                        name="อัตราสำเร็จ (%)"
                        fill="#059669"
                        radius={[0, 3, 3, 0]}
                        barSize={16}
                      />
                    )}
                    {upsellChartMode === "revenue" && (
                      <Bar
                        dataKey="revenue"
                        name="ยอดขายรวม"
                        fill="#0F172A"
                        radius={[0, 3, 3, 0]}
                        barSize={16}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[270px] flex items-center justify-center text-xs text-slate-500">
                ยังไม่มีข้อมูลสินค้า Upsell ในช่วงตัวกรองนี้
              </div>
            )}
          </div>

          <div className="xl:col-span-7 min-w-0 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ปัญหาและคอขวดสำคัญที่ระบบตรวจพบอัตโนมัติ
                  </h3>
                  <p className="text-xs text-slate-500">
                    คลิกที่รายการเพื่อดูสาเหตุและวิธีแก้ทันที หรือกดเจาะลึกเพื่อดูเคสจริงทั้งหมด
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab("solutions")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  จำลองผลลัพธ์ & แผนปรับปรุง
                </button>
              </div>

              {summary.problems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  ไม่พบปัญหาหรือความผิดปกติสำคัญในช่วงข้อมูลที่กรอง
                </div>
              ) : (
                <div className="divide-y divide-slate-200 mt-1">
                  {summary.problems.map((prob) => {
                    const isExpanded = expandedProblemId === prob.id;
                    return (
                      <div key={prob.id} className="py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProblemId((prev) => (prev === prob.id ? null : prob.id))
                            }
                            className="min-w-0 flex-1 text-left group"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              <span
                                className={`font-semibold ${
                                  prob.severity === "critical"
                                    ? "text-rose-700"
                                    : prob.severity === "high"
                                    ? "text-amber-700"
                                    : "text-slate-600"
                                }`}
                              >
                                {prob.severity === "critical"
                                  ? "วิกฤต"
                                  : prob.severity === "high"
                                  ? "สูง"
                                  : "ปานกลาง"}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-500">{prob.category}</span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono tabular-nums text-slate-600">
                                {prob.affectedCount.toLocaleString()} เคส ({prob.affectedPct.toFixed(1)}%)
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 group-hover:text-emerald-700 transition-colors mt-0.5 truncate">
                              {prob.title}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              แนวทาง: {prob.solutionTitle}
                            </p>
                          </button>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-left sm:text-right">
                              <div className="text-[11px] text-slate-500">โอกาสฟื้นฟู</div>
                              <div className="text-sm font-semibold font-mono tabular-nums text-emerald-700">
                                +฿{formatThb(prob.estimatedImpactThb)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onNavigateTab("problems", prob.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
                            >
                              เจาะลึก
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs space-y-1.5 text-slate-700">
                            <p className="leading-relaxed">
                              <span className="font-semibold text-slate-900">สาเหตุ: </span>
                              {prob.rootCauseSummary}
                            </p>
                            {prob.actionSteps[0] && (
                              <p className="text-emerald-800">
                                <span className="font-semibold">ขั้นตอนเร่งด่วน: </span>
                                {prob.actionSteps[0].step} ({prob.actionSteps[0].timeframe})
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
