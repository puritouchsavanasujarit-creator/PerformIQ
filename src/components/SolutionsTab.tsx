import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckSquare, Loader2, Sparkles, SlidersHorizontal } from "lucide-react";
import { simulateImprovement } from "../utils/analyticsEngine";
import type { AIDiagnosticReport, AnalyticsSummary, ImprovementLevers } from "../types/tracking";

interface SolutionsTabProps {
  summary: AnalyticsSummary;
}

function formatThb(v: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(v));
}

export const SolutionsTab: React.FC<SolutionsTabProps> = ({ summary }) => {
  const [levers, setLevers] = useState<ImprovementLevers>({
    targetClosingRateLiftPct: 10,
    targetUpsellAttemptPct: 75,
    targetUpsellWinRatePct: 28,
    slaRecoveryPct: 40,
  });

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<AIDiagnosticReport | null>(null);

  const simulation = useMemo(() => simulateImprovement(summary, levers), [summary, levers]);

  const toggleStep = (key: string) => {
    setCompletedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const runGeminiDiagnostics = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const payload = {
        periodLabel: `${summary.periodStart} - ${summary.periodEnd}`,
        totalCases: summary.totalCases,
        closedCases: summary.closedCases,
        onProcessCases: summary.onProcessCases,
        pendingCases: summary.pendingCases,
        closingRate: summary.closingRate,
        upsellAttemptRate: summary.upsellAttemptRate,
        upsellWinRate: summary.upsellWinRate,
        totalRevenue: summary.totalRevenue,
        avgOrderValue: summary.avgOrderValue,
        unpricedClosedCount: summary.unpricedClosedCount,
        detectedProblems: summary.problems.map((p) => ({
          title: p.title,
          category: p.category,
          affectedCount: p.affectedCount,
          estimatedImpactThb: p.estimatedImpactThb,
          evidenceSamples: p.evidenceSnippets,
        })),
        topPlatforms: summary.platformMetrics.map((pl) => ({
          platform: pl.platform,
          total: pl.total,
          closed: pl.closed,
          closingRate: pl.closingRate,
        })),
        topStaffHighlights: summary.staffMetrics.slice(0, 8).map((st) => ({
          owner: st.owner,
          total: st.total,
          closed: st.closed,
          closingRate: st.closingRate,
          upsellRate: st.upsellAttemptRate,
          revenue: st.revenue,
        })),
      };

      const res = await fetch("/api/analyze-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || `การเชื่อมต่อ API ล้มเหลว (${res.status})`);
      }
      setAiReport(body as AIDiagnosticReport);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างบทวิเคราะห์ AI");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Before vs After Simulator */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              เครื่องมือจำลองผลลัพธ์ก่อน–หลังการปรับปรุง (Before vs After Simulator)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ปรับค่าเป้าหมายการปรับปรุงเพื่อคาดการณ์รายได้และจำนวนออเดอร์ที่เพิ่มขึ้นเทียบกับข้อมูลจริงปัจจุบัน
            </p>
          </div>
          <div className="flex items-center gap-5 shrink-0 font-mono tabular-nums">
            <div className="text-right">
              <div className="text-xs text-slate-500">รายได้ฐานเดิม (Before)</div>
              <div className="text-sm font-semibold text-slate-700">
                ฿{formatThb(simulation.baselineRevenue)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">รายได้คาดการณ์ (After)</div>
              <div className="text-base font-semibold text-emerald-700">
                ฿{formatThb(simulation.projectedRevenue)} (+{simulation.revenueLiftPct.toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
          {/* Control Sliders */}
          <div className="lg:col-span-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">เพิ่ม Closing Rate (+%)</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  +{levers.targetClosingRateLiftPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={levers.targetClosingRateLiftPct}
                onChange={(e) =>
                  setLevers((prev) => ({ ...prev, targetClosingRateLiftPct: Number(e.target.value) }))
                }
                className="w-full accent-emerald-600"
              />
              <div className="text-[11px] text-slate-500 flex justify-between font-mono tabular-nums">
                <span>ฐานเดิม {summary.closingRate.toFixed(1)}%</span>
                <span>
                  เป้า {Math.min(95, summary.closingRate + levers.targetClosingRateLiftPct).toFixed(1)}%
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">เป้าหมายอัตราเสนอ Upsell</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  {levers.targetUpsellAttemptPct}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={levers.targetUpsellAttemptPct}
                onChange={(e) =>
                  setLevers((prev) => ({ ...prev, targetUpsellAttemptPct: Number(e.target.value) }))
                }
                className="w-full accent-emerald-600"
              />
              <div className="text-[11px] text-slate-500 flex justify-between font-mono tabular-nums">
                <span>ฐานเดิม {summary.upsellAttemptRate.toFixed(1)}%</span>
                <span>เป้า {levers.targetUpsellAttemptPct}%</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">เป้าหมาย Win Rate เมื่อเสนอ Upsell</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  {levers.targetUpsellWinRatePct}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                step={1}
                value={levers.targetUpsellWinRatePct}
                onChange={(e) =>
                  setLevers((prev) => ({ ...prev, targetUpsellWinRatePct: Number(e.target.value) }))
                }
                className="w-full accent-emerald-600"
              />
              <div className="text-[11px] text-slate-500 flex justify-between font-mono tabular-nums">
                <span>ฐานเดิม {summary.upsellWinRate.toFixed(1)}%</span>
                <span>เพิ่ม +{simulation.additionalUpsellOrders.toLocaleString()} บิล Upsell</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">กู้คืนเคสตอบช้า / รอยต่อกะ (SLA)</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  {levers.slaRecoveryPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={levers.slaRecoveryPct}
                onChange={(e) =>
                  setLevers((prev) => ({ ...prev, slaRecoveryPct: Number(e.target.value) }))
                }
                className="w-full accent-emerald-600"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500">รายได้ส่วนเพิ่มคาดการณ์</div>
                <div className="text-base font-semibold font-mono tabular-nums text-emerald-700">
                  +฿{formatThb(simulation.revenueLiftThb)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">เคสปิดเพิ่มได้</div>
                <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                  +{simulation.additionalClosedCases.toLocaleString()} เคส
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Area Chart */}
          <div className="lg:col-span-8 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={simulation.dailyComparison}
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
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  width={46}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [`฿${formatThb(Number(value ?? 0))}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area
                  type="monotone"
                  dataKey="projectedRevenue"
                  name="รายได้คาดการณ์หลังปรับปรุง (After)"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="baselineRevenue"
                  name="รายได้จริงปัจจุบัน (Before)"
                  stroke="#64748B"
                  fill="#94A3B8"
                  fillOpacity={0.14}
                  strokeWidth={1.75}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Action Plan Checklist Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              แผนปฏิบัติการปรับปรุงประสิทธิภาพ (Action Plan Matrix)
            </h2>
            <p className="text-xs text-slate-500">
              ติ๊กติดตามความคืบหน้าของแต่ละขั้นตอนพร้อมผู้รับผิดชอบและกรอบเวลา
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {summary.problems.map((problem) => (
            <div key={problem.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-medium text-emerald-700">{problem.category}</span>
                  <h3 className="text-sm font-semibold text-slate-900">{problem.solutionTitle}</h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  KPI: {problem.kpiTargetLabel}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-medium w-8">ทำแล้ว</th>
                      <th className="py-2 pr-4 font-medium">วิธีดำเนินการปรับปรุง</th>
                      <th className="py-2 pr-4 font-medium whitespace-nowrap">ผู้รับผิดชอบ</th>
                      <th className="py-2 pr-4 font-medium whitespace-nowrap">กรอบเวลา</th>
                      <th className="py-2 font-medium">ผลลัพธ์ที่คาดหวัง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {problem.actionSteps.map((act, idx) => {
                      const key = `${problem.id}-${idx}`;
                      const checked = Boolean(completedSteps[key]);
                      return (
                        <tr key={key} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-3 align-top">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStep(key)}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td
                            className={`py-2.5 pr-4 ${
                              checked ? "line-through text-slate-400" : "text-slate-800 font-medium"
                            }`}
                          >
                            {act.step}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                            {act.ownerRole}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap font-mono">
                            {act.timeframe}
                          </td>
                          <td className="py-2.5 text-emerald-700">{act.expectedEffect}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Server-side Gemini Deep Diagnostic Report */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              วิเคราะห์เชิงลึกและวาง Roadmap 30 วันด้วย Gemini AI
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ส่งข้อมูลสรุปจริงและตัวอย่าง Remark จากชุดข้อมูลปัจจุบันไปสังเคราะห์กลยุทธ์เฉพาะทางฝั่ง Server
            </p>
          </div>
          <button
            type="button"
            disabled={aiLoading || summary.totalCases === 0}
            onClick={runGeminiDiagnostics}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {aiLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังสังเคราะห์ข้อมูลจริง...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                วิเคราะห์เชิงลึกด้วย AI (Gemini)
              </>
            )}
          </button>
        </div>

        {aiError && (
          <div className="mt-4 p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-700">
            ไม่สามารถสร้างบทวิเคราะห์ AI ได้: {aiError}
          </div>
        )}

        {aiReport && (
          <div className="mt-5 pt-5 border-t border-slate-200 space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                บทสรุปผู้บริหาร (Executive Summary)
              </h3>
              <p className="text-sm text-slate-800 leading-relaxed">{aiReport.executiveSummary}</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                ประเด็นคอขวดและกลยุทธ์แก้ไขเชิงลึก
              </h3>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {aiReport.criticalBottlenecks.map((item, i) => (
                  <div key={i} className="p-4 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {i + 1}. {item.problemTitle}
                      </span>
                      <span className="text-xs font-mono text-emerald-700 font-medium">
                        {item.quantifiedImpact} · เป้าหมาย {item.kpiTarget}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      <strong className="text-slate-700">สาเหตุ:</strong> {item.rootCause}
                    </p>
                    <p className="text-xs text-slate-700">
                      <strong className="text-slate-800">กลยุทธ์:</strong> {item.solutionStrategy}
                    </p>
                    <ul className="list-disc pl-5 text-xs text-slate-600 space-y-0.5 pt-1">
                      {item.immediateSteps.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                แผนปฏิบัติการ 30 วัน (30-Day Roadmap)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {aiReport.thirtyDayRoadmap.map((phase, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-2">
                    <div className="text-xs font-mono font-semibold text-emerald-700">
                      {phase.phase}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{phase.focus}</div>
                    <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                      {phase.actions.map((a, k) => (
                        <li key={k}>{a}</li>
                      ))}
                    </ul>
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-700">
                      ผลลัพธ์: {phase.expectedOutcome}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
