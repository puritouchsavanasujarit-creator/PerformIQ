import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Users } from "lucide-react";
import type { AnalyticsSummary } from "../types/tracking";

interface TeamShiftTabProps {
  summary: AnalyticsSummary;
  onSelectOwnerFilter: (owner: string) => void;
}

function formatThb(v: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(v));
}

export const TeamShiftTab: React.FC<TeamShiftTabProps> = ({ summary, onSelectOwnerFilter }) => {
  const [sortBy, setSortBy] = useState<"revenue" | "closingRate" | "upsellAttemptRate" | "efficiencyScore">("revenue");

  const sortedStaff = useMemo(() => {
    return [...summary.staffMetrics].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [summary.staffMetrics, sortBy]);

  const scatterData = useMemo(() => {
    return summary.staffMetrics
      .filter((s) => s.total >= 5)
      .map((s) => ({
        owner: s.owner.split(" ")[0],
        fullName: s.owner,
        closingRate: Number(s.closingRate.toFixed(1)),
        upsellAttemptRate: Number(s.upsellAttemptRate.toFixed(1)),
        revenue: Math.round(s.revenue),
        total: s.total,
      }));
  }, [summary.staffMetrics]);

  return (
    <div className="space-y-6">
      {/* Staff Scatter & Shift Bar Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              เมทริกซ์ประสิทธิภาพรายบุคคล (Closing Rate vs Upsell Rate)
            </h2>
            <p className="text-xs text-slate-500">
              แกน X = อัตราปิดการขาย (%), แกน Y = อัตราเสนอ Upsell (%), ขนาดจุด = ปริมาณเคสรวม
            </p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  dataKey="closingRate"
                  name="Closing Rate"
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis
                  type="number"
                  dataKey="upsellAttemptRate"
                  name="Upsell Attempt"
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <ZAxis type="number" dataKey="total" range={[70, 380]} name="เคสรวม" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => {
                    if (name === "เคสรวม") return [`${value} เคส`, name];
                    return [`${value}%`, name];
                  }}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { fullName?: string; revenue?: number } | undefined;
                    return p?.fullName ? `${p.fullName} (฿${formatThb(p.revenue ?? 0)})` : "";
                  }}
                />
                <Scatter name="พนักงาน" data={scatterData} fill="#059669" fillOpacity={0.78} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              เปรียบเทียบประสิทธิภาพตามกะการทำงาน (Shift Benchmark)
            </h2>
            <p className="text-xs text-slate-500">
              จำนวนเคสปิดสำเร็จ vs เคสค้าง On Process ในแต่ละช่วงเวลา
            </p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.shiftMetrics} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="shift"
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={{ stroke: "#CBD5E1" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="closed" name="Closed" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="onProcess" name="On Process" fill="#D97706" radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Staff Leaderboard Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              ตารางเปรียบเทียบประสิทธิภาพรายบุคคล ({sortedStaff.length} คน)
            </h3>
            <p className="text-xs text-slate-500">
              คลิกชื่อพนักงานเพื่อกรองดูข้อมูลเฉพาะรายบุคคลในทุกแท็บ
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 mr-1">เรียงตาม:</span>
            {[
              { id: "revenue", label: "ยอดขาย" },
              { id: "closingRate", label: "Closing %" },
              { id: "upsellAttemptRate", label: "Upsell %" },
              { id: "efficiencyScore", label: "คะแนนรวม" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortBy(opt.id as typeof sortBy)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sortBy === opt.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="py-2.5 px-4 font-medium">พนักงาน</th>
                <th className="py-2.5 px-3 font-medium text-right">เคสรวม</th>
                <th className="py-2.5 px-3 font-medium text-right">ปิดได้</th>
                <th className="py-2.5 px-3 font-medium text-right">Closing %</th>
                <th className="py-2.5 px-3 font-medium text-right">Upsell เสนอ %</th>
                <th className="py-2.5 px-3 font-medium text-right">ลงข้อมูล %</th>
                <th className="py-2.5 px-3 font-medium text-right">ยอดขาย (บาท)</th>
                <th className="py-2.5 px-3 font-medium text-right">คะแนนประสิทธิภาพ</th>
                <th className="py-2.5 px-4 font-medium">จุดควรพัฒนาหลัก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedStaff.map((s) => (
                <tr key={s.owner} className="h-10 hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-4 font-medium text-slate-900 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectOwnerFilter(s.owner)}
                      className="text-left hover:text-emerald-700 hover:underline"
                    >
                      {s.owner}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {s.total.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {s.closed.toLocaleString()}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-mono tabular-nums font-medium ${
                      s.closingRate >= 50
                        ? "text-emerald-700"
                        : s.closingRate >= 35
                        ? "text-amber-700"
                        : "text-rose-700"
                    }`}
                  >
                    {s.closingRate.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {s.upsellAttemptRate.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {s.dataEntryRate.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    ฿{formatThb(s.revenue)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                        <div
                          className={`h-full ${
                            s.efficiencyScore >= 65
                              ? "bg-emerald-600"
                              : s.efficiencyScore >= 45
                              ? "bg-amber-500"
                              : "bg-rose-600"
                          }`}
                          style={{ width: `${s.efficiencyScore}%` }}
                        />
                      </div>
                      <span className="w-7 text-right font-semibold text-slate-800">
                        {s.efficiencyScore}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`py-2 px-4 whitespace-nowrap ${
                      s.primaryBottleneck === "สมดุลและสม่ำเสมอ"
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {s.primaryBottleneck}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
