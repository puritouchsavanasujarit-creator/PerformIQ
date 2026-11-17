import React, { useMemo, useState } from "react";
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
import { AlertCircle, ArrowRight, FileSearch, Wrench } from "lucide-react";
import type { AnalyticsSummary, DiagnosticProblem } from "../types/tracking";

interface ProblemsTabProps {
  summary: AnalyticsSummary;
  initialSelectedProblemId?: string | null;
  onInspectEvidenceRows: (problem: DiagnosticProblem) => void;
  onGoToSolutions: () => void;
}

function formatThb(v: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(v));
}

export const ProblemsTab: React.FC<ProblemsTabProps> = ({
  summary,
  initialSelectedProblemId,
  onInspectEvidenceRows,
  onGoToSolutions,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedProblemId || summary.problems[0]?.id || ""
  );

  const paretoData = useMemo(() => {
    const totalImpact = Math.max(
      1,
      summary.problems.reduce((s, p) => s + p.estimatedImpactThb, 0)
    );
    let cumulative = 0;
    return summary.problems.map((p, idx) => {
      cumulative += p.estimatedImpactThb;
      return {
        shortLabel: `#${idx + 1} ${p.category}`,
        title: p.title,
        impactThb: p.estimatedImpactThb,
        affectedCount: p.affectedCount,
        cumulativePct: Math.round((cumulative / totalImpact) * 100),
      };
    });
  }, [summary.problems]);

  const activeProblem =
    summary.problems.find((p) => p.id === selectedId) ?? summary.problems[0] ?? null;

  if (summary.problems.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <AlertCircle className="w-9 h-9 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900">
          ไม่พบคอขวดหรือความผิดปกติสำคัญในชุดข้อมูลที่กรอง
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          การดำเนินงานในช่วงข้อมูลที่เลือกอยู่ในเกณฑ์ปกติ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Charts Grid: Pareto Impact + Daily Anomaly & Shift Bottleneck */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              กราฟจัดลำดับความรุนแรงของปัญหา (Pareto Impact Analysis)
            </h2>
            <p className="text-xs text-slate-500">
              แสดงมูลค่าโอกาสที่สูญเสีย (บาท) เทียบ % สะสม เพื่อจัดลำดับการแก้ไขปัญหาที่คุ้มค่าที่สุดก่อน
            </p>
          </div>
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paretoData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={{ stroke: "#CBD5E1" }}
                />
                <YAxis
                  yAxisId="thb"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  width={46}
                />
                <YAxis
                  yAxisId="cum"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={40}
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
                    if (name === "ผลกระทบทางการเงิน") return [`฿${formatThb(num)}`, name];
                    return [`${num}%`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  yAxisId="thb"
                  dataKey="impactThb"
                  name="ผลกระทบทางการเงิน"
                  fill="#DC2626"
                  fillOpacity={0.82}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                />
                <Line
                  yAxisId="cum"
                  type="monotone"
                  dataKey="cumulativePct"
                  name="% ผลกระทบสะสม"
                  stroke="#0F172A"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              อัตราปิดการขายและเคสล่วงเวลากะงาน
            </h2>
            <p className="text-xs text-slate-500">
              เปรียบเทียบ Closing Rate (%) และเคสล่าช้า/ข้ามกะในแต่ละช่วงเวลา
            </p>
          </div>
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.shiftMetrics}
                margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="shift"
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={{ stroke: "#CBD5E1" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
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
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="onProcess" name="เคสค้าง (On Process)" fill="#D97706" barSize={20} />
                <Bar dataKey="overrunCount" name="สัญญาณช้า/ข้ามกะ" fill="#DC2626" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Interactive Problem List & Root Cause Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
            <h3 className="text-sm font-semibold text-slate-900">
              รายการปัญหาที่ตรวจพบ ({summary.problems.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-200">
            {summary.problems.map((p, idx) => {
              const isSelected = activeProblem?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-5 py-4 transition-colors ${
                    isSelected ? "bg-emerald-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-slate-500">
                      #{idx + 1} · {p.category}
                    </span>
                    <span
                      className={`font-semibold ${
                        p.severity === "critical"
                          ? "text-rose-700"
                          : p.severity === "high"
                          ? "text-amber-700"
                          : "text-slate-600"
                      }`}
                    >
                      {p.severity === "critical"
                        ? "ความรุนแรง: วิกฤต"
                        : p.severity === "high"
                        ? "ความรุนแรง: สูง"
                        : "ความรุนแรง: ปานกลาง"}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{p.title}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                    <span>
                      พบ {p.affectedCount.toLocaleString()} เคส ({p.affectedPct.toFixed(1)}%)
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      +฿{formatThb(p.estimatedImpactThb)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {activeProblem && (
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500">
                  {activeProblem.category} · เป้าหมาย KPI: {activeProblem.kpiTargetLabel}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">
                  {activeProblem.title}
                </h3>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <div className="text-xs text-slate-500">ผลกระทบทางการเงินโดยประมาณ</div>
                <div className="text-xl font-semibold font-mono tabular-nums text-emerald-700">
                  +฿{formatThb(activeProblem.estimatedImpactThb)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                การวิเคราะห์สาเหตุรากเหง้า (Root Cause)
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {activeProblem.rootCauseSummary}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                หลักฐานจากหมายเหตุจริงในข้อมูล (Remark Evidence)
              </h4>
              {activeProblem.evidenceSnippets.length > 0 ? (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/50">
                  {activeProblem.evidenceSnippets.map((snippet, i) => (
                    <li key={i} className="px-3.5 py-2 text-xs text-slate-700 font-mono">
                      {snippet}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">
                  ตรวจพบจากความผิดปกติของสถานะและตัวเลขสถิติ ({activeProblem.affectedCount} รายการ)
                </p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                แนวทางแก้ไขที่แนะนำ
              </h4>
              <p className="text-sm font-medium text-slate-900">{activeProblem.solutionTitle}</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {activeProblem.solutionDescription}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onInspectEvidenceRows(activeProblem)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
              >
                <FileSearch className="w-4 h-4 text-slate-500" />
                ดูแถวข้อมูลที่เกี่ยวข้อง ({activeProblem.evidenceRows.length} ตัวอย่าง)
              </button>

              <button
                type="button"
                onClick={onGoToSolutions}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <Wrench className="w-4 h-4" />
                ไปยังแผนดำเนินการ & จำลองผล <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
