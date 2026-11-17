import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  Download,
  Filter,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Sliders,
  Upload,
  Users,
  X,
} from "lucide-react";
import defaultTrackingJson from "./data/defaultTrackingData.json";
import { computeAnalytics, normalizePlatform, normalizeShift } from "./utils/analyticsEngine";
import { exportRecordsToCsv } from "./utils/fileParser";
import { OverviewTab } from "./components/OverviewTab";
import { ProblemsTab } from "./components/ProblemsTab";
import { SolutionsTab } from "./components/SolutionsTab";
import { TeamShiftTab } from "./components/TeamShiftTab";
import { DataExplorerTab } from "./components/DataExplorerTab";
import type { DiagnosticProblem, TrackingRecord } from "./types/tracking";

type ActiveTab = "overview" | "problems" | "solutions" | "team" | "explorer";

function toIsoDate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

export default function App() {
  const initialRecords = defaultTrackingJson as TrackingRecord[];

  const [records, setRecords] = useState<TrackingRecord[]>(initialRecords);
  const [datasetName, setDatasetName] = useState<string>(
    "DailyTracking Call & Chat — Premium Fruit Delivery 2026"
  );
  const [isCustomDataset, setIsCustomDataset] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [explorerSearchKeyword, setExplorerSearchKeyword] = useState<string | null>(null);

  // Global Filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");

  const filterOptions = useMemo(() => {
    const owners = new Set<string>();
    const platforms = new Set<string>();
    const shifts = new Set<string>();
    for (const r of records) {
      if (r.owner.trim()) owners.add(r.owner.trim());
      platforms.add(normalizePlatform(r.platform));
      shifts.add(normalizeShift(r.shift));
    }
    return {
      owners: Array.from(owners).sort((a, b) => a.localeCompare(b, "th")),
      platforms: Array.from(platforms).sort(),
      shifts: Array.from(shifts).sort(),
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (platformFilter !== "ALL" && normalizePlatform(r.platform) !== platformFilter) {
        return false;
      }
      if (shiftFilter !== "ALL" && normalizeShift(r.shift) !== shiftFilter) {
        return false;
      }
      if (ownerFilter !== "ALL" && r.owner.trim() !== ownerFilter) {
        return false;
      }
      if (dateFrom || dateTo) {
        const iso = toIsoDate(r.date);
        if (dateFrom && iso < dateFrom) return false;
        if (dateTo && iso > dateTo) return false;
      }
      return true;
    });
  }, [records, platformFilter, shiftFilter, ownerFilter, dateFrom, dateTo]);

  const summary = useMemo(() => computeAnalytics(filteredRecords), [filteredRecords]);

  const hasActiveFilters =
    dateFrom !== "" ||
    dateTo !== "" ||
    platformFilter !== "ALL" ||
    shiftFilter !== "ALL" ||
    ownerFilter !== "ALL";

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setPlatformFilter("ALL");
    setShiftFilter("ALL");
    setOwnerFilter("ALL");
  };

  const handleAddRecord = (newRow: Omit<TrackingRecord, "id">) => {
    setRecords((prev) => {
      const nextId = prev.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      return [{ ...newRow, id: nextId }, ...prev];
    });
    setIsCustomDataset(true);
  };

  const handleReplaceRecords = (newRows: TrackingRecord[], sourceLabel: string) => {
    setRecords(newRows);
    setDatasetName(sourceLabel);
    setIsCustomDataset(true);
    resetFilters();
  };

  const handleAppendRecords = (extraRows: TrackingRecord[], sourceLabel: string) => {
    setRecords((prev) => [...extraRows, ...prev]);
    setDatasetName((prevName) => `${prevName} + ${sourceLabel}`);
    setIsCustomDataset(true);
  };

  const handleResetDefault = () => {
    setRecords(initialRecords);
    setDatasetName("DailyTracking Call & Chat — Premium Fruit Delivery 2026");
    setIsCustomDataset(false);
    resetFilters();
  };

  const handleInspectEvidence = (problem: DiagnosticProblem) => {
    const firstCustomer = problem.evidenceRows[0]?.customer;
    setExplorerSearchKeyword(
      problem.id === "stalled-on-process"
        ? ""
        : firstCustomer && firstCustomer !== "-"
        ? firstCustomer
        : ""
    );
    setActiveTab("explorer");
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: "overview", label: "ภาพรวม Dashboard", icon: LayoutDashboard },
    {
      id: "problems",
      label: "วิเคราะห์ปัญหาและคอขวด",
      icon: AlertTriangle,
      badge: summary.problems.length > 0 ? String(summary.problems.length) : undefined,
    },
    { id: "solutions", label: "แนวทางแก้ไข & จำลองผล", icon: Sliders },
    { id: "team", label: "ประสิทธิภาพทีมและกะงาน", icon: Users },
    {
      id: "explorer",
      label: "ข้อมูล & นำเข้าไฟล์",
      icon: Database,
      badge: filteredRecords.length.toLocaleString(),
    },
  ];

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Sidebar (256px desktop) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900 font-display leading-none">
                PerformIQ
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Performance Diagnostics
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1 rounded-md text-slate-500 hover:bg-slate-100"
            aria-label="ปิดเมนู"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            พื้นที่วิเคราะห์
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      isActive ? "text-emerald-700 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Reactive Sidebar Filters */}
          <div className="pt-5 mt-4 border-t border-slate-200 px-1 space-y-3">
            <div className="flex items-center justify-between px-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3 h-3" />
                ตัวกรองข้อมูลอัตโนมัติ
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  ล้าง
                </button>
              )}
            </div>

            <div className="space-y-2.5 px-1.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  แพลตฟอร์ม
                </label>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                >
                  <option value="ALL">ทุกแพลตฟอร์ม</option>
                  {filterOptions.platforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  กะการทำงาน
                </label>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 font-mono"
                >
                  <option value="ALL">ทุกกะเวลา</option>
                  {filterOptions.shifts.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  พนักงานผู้รับผิดชอบ
                </label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                >
                  <option value="ALL">ทุกคน ({filterOptions.owners.length})</option>
                  {filterOptions.owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    ตั้งแต่วันที่
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-mono tabular-nums text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    ถึงวันที่
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-mono tabular-nums text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 text-[11px] text-slate-500">
          <div className="font-medium text-slate-700 truncate" title={datasetName}>
            {datasetName}
          </div>
          <div className="font-mono tabular-nums mt-0.5">
            {filteredRecords.length.toLocaleString()} / {records.length.toLocaleString()} รายการ
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, max 2 Primary Actions on Right */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 truncate flex items-center gap-1.5">
              <span className="hidden sm:inline">PerformIQ</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="hidden md:inline truncate max-w-[220px]">
                Premium Fruit Delivery 2026
              </span>
              <span className="hidden md:inline text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("explorer")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              นำเข้า CSV/PDF
            </button>
            <button
              type="button"
              onClick={() => exportRecordsToCsv(filteredRecords)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              ส่งออก CSV
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === "overview" && (
            <OverviewTab
              summary={summary}
              availableOwners={filterOptions.owners}
              availablePlatforms={filterOptions.platforms}
              availableShifts={filterOptions.shifts}
              onAddRecord={handleAddRecord}
              onNavigateTab={(tab, problemId) => {
                if (problemId) setSelectedProblemId(problemId);
                setActiveTab(tab);
              }}
              onOpenImportModal={() => setActiveTab("explorer")}
            />
          )}

          {activeTab === "problems" && (
            <ProblemsTab
              summary={summary}
              initialSelectedProblemId={selectedProblemId}
              onInspectEvidenceRows={handleInspectEvidence}
              onGoToSolutions={() => setActiveTab("solutions")}
            />
          )}

          {activeTab === "solutions" && <SolutionsTab summary={summary} />}

          {activeTab === "team" && (
            <TeamShiftTab
              summary={summary}
              onSelectOwnerFilter={(owner) => {
                setOwnerFilter((prev) => (prev === owner ? "ALL" : owner));
              }}
            />
          )}

          {activeTab === "explorer" && (
            <DataExplorerTab
              records={filteredRecords}
              isCustomDataset={isCustomDataset}
              highlightKeyword={explorerSearchKeyword}
              onReplaceRecords={handleReplaceRecords}
              onAppendRecords={handleAppendRecords}
              onResetDefault={handleResetDefault}
            />
          )}
        </main>
      </div>
    </div>
  );
}
