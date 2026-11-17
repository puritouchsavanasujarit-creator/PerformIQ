import React, { useMemo, useRef, useState } from "react";
import {
  Download,
  FileUp,
  RotateCcw,
  Search,
} from "lucide-react";
import { hasRecordAnomaly, isUpsellAccepted } from "../utils/analyticsEngine";
import { exportRecordsToCsv, parseCsvOrTsv, parseTrackingPdf } from "../utils/fileParser";
import type { TrackingRecord } from "../types/tracking";

interface DataExplorerTabProps {
  records: TrackingRecord[];
  isCustomDataset: boolean;
  highlightKeyword?: string | null;
  onReplaceRecords: (newRows: TrackingRecord[], sourceLabel: string) => void;
  onAppendRecords: (extraRows: TrackingRecord[], sourceLabel: string) => void;
  onResetDefault: () => void;
}

function formatThb(v: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(v));
}

export const DataExplorerTab: React.FC<DataExplorerTabProps> = ({
  records,
  isCustomDataset,
  highlightKeyword,
  onReplaceRecords,
  onAppendRecords,
  onResetDefault,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>(highlightKeyword ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importing, setImporting] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [page, setPage] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pageSize = 25;

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (onlyAnomalies && !hasRecordAnomaly(r)) return false;
      if (!q) return true;
      return (
        r.customer.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.platform.toLowerCase().includes(q) ||
        r.remark.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q) ||
        r.date.includes(q)
      );
    });
  }, [records, searchQuery, statusFilter, onlyAnomalies]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const startId = importMode === "append" ? records.length + 1 : 1;
      const lower = file.name.toLowerCase();
      let parsed: TrackingRecord[];
      if (lower.endsWith(".pdf")) {
        parsed = await parseTrackingPdf(file, startId);
      } else if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
        parsed = await parseCsvOrTsv(file, startId);
      } else {
        throw new Error("รองรับเฉพาะไฟล์ .csv, .tsv หรือ .pdf จาก DailyTracking");
      }

      if (importMode === "replace") {
        onReplaceRecords(parsed, file.name);
      } else {
        onAppendRecords(parsed, file.name);
      }
      setPage(1);
      setImportMessage({
        type: "ok",
        text: `ประมวลผลไฟล์ "${file.name}" สำเร็จ (${parsed.length.toLocaleString()} รายการ) และอัปเดตกราฟทั้งหมดแล้ว`,
      });
    } catch (err: unknown) {
      setImportMessage({
        type: "err",
        text: err instanceof Error ? err.message : "นำเข้าไฟล์ไม่สำเร็จ",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* Automated CSV/PDF Importer */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              นำเข้าและประมวลผลไฟล์ข้อมูลอัตโนมัติ (CSV / TSV / PDF)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              อัปโหลดไฟล์ DailyTracking ใหม่เพื่อให้ระบบสกัดตาราง วิเคราะห์คอขวด และสร้างกราฟทันทีบนเบราว์เซอร์
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setImportMode("replace")}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  importMode === "replace" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                แทนที่ชุดข้อมูล
              </button>
              <button
                type="button"
                onClick={() => setImportMode("append")}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  importMode === "append" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                เพิ่มต่อท้าย
              </button>
            </div>

            {isCustomDataset && (
              <button
                type="button"
                onClick={() => {
                  onResetDefault();
                  setImportMessage({
                    type: "ok",
                    text: "คืนค่าเป็นชุดข้อมูล PDF ต้นฉบับ (1,654 รายการ) เรียบร้อย",
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                คืนค่าข้อมูล PDF ต้นฉบับ
              </button>
            )}
          </div>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
          className="mt-4 border border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-800">
                {importing ? "กำลังสกัดข้อมูลและประมวลผลอัตโนมัติ..." : "ลากไฟล์ .csv, .tsv หรือ .pdf มาวางที่นี่"}
              </div>
              <div className="text-xs text-slate-500">
                รองรับรูปแบบ DailyTracking PDF ที่มี Vector Checkboxes และไฟล์ CSV ภาษาไทย/อังกฤษ
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.pdf"
            onChange={(e) => void handleFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            เลือกไฟล์จากเครื่อง
          </button>
        </div>

        {importMessage && (
          <div
            className={`mt-3 text-xs font-medium ${
              importMessage.type === "ok" ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {importMessage.text}
          </div>
        )}
      </section>

      {/* High-Density Data Grid */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="ค้นหาชื่อลูกค้า, พนักงาน, หมายเหตุ..."
                className="h-8 pl-8 pr-3 w-64 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="Closed">Closed</option>
              <option value="On Process">On Process</option>
              <option value="Pending">Pending</option>
              <option value="Unspecified">ไม่ระบุ</option>
            </select>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer ml-1 select-none">
              <input
                type="checkbox"
                checked={onlyAnomalies}
                onChange={(e) => {
                  setOnlyAnomalies(e.target.checked);
                  setPage(1);
                }}
                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              แสดงเฉพาะเคสที่พบจุดปรับปรุง/ผิดปกติ
            </label>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3 text-xs">
            <span className="text-slate-500 font-mono tabular-nums">
              แสดง {filteredRows.length.toLocaleString()} รายการ
            </span>
            <button
              type="button"
              onClick={() => exportRecordsToCsv(filteredRows)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              ส่งออกรายการนี้ (.csv)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="py-2.5 px-3 font-medium">วันที่</th>
                <th className="py-2.5 px-3 font-medium">ผู้รับผิดชอบ</th>
                <th className="py-2.5 px-3 font-medium">กะ / เวลาปิด</th>
                <th className="py-2.5 px-3 font-medium">แพลตฟอร์ม</th>
                <th className="py-2.5 px-3 font-medium">ลูกค้า</th>
                <th className="py-2.5 px-3 font-medium">สถานะ</th>
                <th className="py-2.5 px-3 font-medium">Upsell</th>
                <th className="py-2.5 px-3 font-medium text-right">ราคา (บาท)</th>
                <th className="py-2.5 px-4 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    ไม่พบแถวข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id} className="h-10 hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {r.owner}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {r.shift || "-"} {r.closeTime ? `· ${r.closeTime}` : ""}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {r.platform || "-"}
                    </td>
                    <td className="py-2 px-3 text-slate-800 max-w-[160px] truncate" title={r.customer}>
                      {r.customer}
                    </td>
                    <td
                      className={`py-2 px-3 font-medium whitespace-nowrap ${
                        r.status === "Closed"
                          ? "text-emerald-700"
                          : r.status === "On Process"
                          ? "text-amber-700"
                          : r.status === "Pending"
                          ? "text-rose-700"
                          : "text-slate-500"
                      }`}
                    >
                      {r.status}
                    </td>
                    <td
                      className={`py-2 px-3 whitespace-nowrap ${
                        isUpsellAccepted(r)
                          ? "text-emerald-700 font-medium"
                          : r.upsellChecked
                          ? "text-slate-600"
                          : "text-slate-400"
                      }`}
                    >
                      {r.upsellResponse || (r.upsellChecked ? "เสนอแล้ว" : "ไม่ได้เสนอ")}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {r.price > 0 ? `฿${formatThb(r.price)}` : "-"}
                    </td>
                    <td className="py-2 px-4 text-slate-600 max-w-[260px] truncate" title={r.remark}>
                      {r.remark || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            หน้า {currentPage} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
