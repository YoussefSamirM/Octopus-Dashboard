import { useState } from "react";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { ArrowRight, Clock, Moon, CalendarDays } from "lucide-react";
interface ICMultiDayViewProps {
  onSelectLob: (lobId: string) => void;
}
const LOBs = [
  { id: "Combined", title: "Combined", color: "#f59e0b" },
  { id: "TPro", title: "T-Pro", color: "#10b981" },
  { id: "GHC", title: "GHC", color: "#8b5cf6" },
  { id: "TMart-FU", title: "T-Mart Follow Up", color: "#ec4899" },
];
export default function ICMultiDayView({ onSelectLob }: ICMultiDayViewProps) {
  const { globalProcessedData, sortedDates, currentShiftMode, setShiftMode } =
    useInvoiceStore();
  const formatTimeSecs = (totalSeconds: number) => {
    if (
      totalSeconds === undefined ||
      totalSeconds === null ||
      totalSeconds <= 0
    )
      return "0:00:00";
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = Math.round(totalSeconds % 60);
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };
  const formatPerc = (val: number) => (val || 0).toFixed(2) + "%";

  const availableMonths = Array.from(new Set(sortedDates.map(d => d.slice(0, 7)))).sort((a, b) => b.localeCompare(a));
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const filteredDates = selectedMonth === "all" ? sortedDates : sortedDates.filter(d => d.startsWith(selectedMonth));

  const formatMonthLabel = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };
  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in duration-300">
      {" "}
      <div className="flex justify-between items-center mb-[24px]">
        {" "}
        <h2 className="text-[24px] font-[900] text-surface-900 ">
          Portfolio Overview
        </h2>{" "}
        <div className="flex items-center gap-[12px]">
          <div className="flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-[8px] px-3 h-[40px]">
            <CalendarDays size={16} className="text-surface-500" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-[13px] font-[700] text-surface-700 outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>{" "}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[24px]">
        {" "}
        {LOBs.map((lob) => {
          let lReq = 0,
            lAct = 0,
            lBill = 0;
          filteredDates.forEach((dIso) => {
            const d = globalProcessedData[dIso]?.[currentShiftMode]?.[lob.id];
            if (d) {
              lReq += d.req;
              lAct += d.act;
              lBill += d.bill;
            }
          });
          const ic = lReq === 0 ? 100 : (lBill / lReq) * 100;
          return (
            <div
              key={lob.id}
              onClick={() => onSelectLob(lob.id)}
              className="bg-surface-0 border border-surface-200 rounded-[16px] p-[24px] cursor-pointer transition-all relative overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:-translate-y-[4px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] hover:border-brand-600 group"
            >
              {" "}
              <div
                className="absolute top-0 left-0 w-full h-[4px]"
                style={{ backgroundColor: lob.color }}
              />{" "}
              <h3 className="text-[20px] font-[900] mb-[20px] text-brand-900 dark:text-brand-100 flex justify-between items-center">
                {" "}
                {lob.title}{" "}
                <ArrowRight
                  size={16}
                  className="text-surface-400 group-hover:text-brand-600 transition-colors"
                />{" "}
              </h3>{" "}
              <div className="flex justify-between items-center py-[12px] border-b border-surface-200 ">
                {" "}
                <span className="text-[12px] font-[700] text-surface-500">
                  REQ
                </span>{" "}
                <span className="text-[15px] font-[800] text-surface-900 ">
                  {formatTimeSecs(lReq)}
                </span>{" "}
              </div>{" "}
              <div className="flex justify-between items-center py-[12px] border-b border-surface-200 ">
                {" "}
                <span className="text-[12px] font-[700] text-surface-500">
                  Actual
                </span>{" "}
                <span className="text-[15px] font-[800] text-surface-900 ">
                  {formatTimeSecs(lAct)}
                </span>{" "}
              </div>{" "}
              <div className="flex justify-between items-center py-[12px] border-b border-surface-200 ">
                {" "}
                <span className="text-[12px] font-[700] text-surface-500">
                  Billable
                </span>{" "}
                <span className="text-[15px] font-[800] text-brand-600 dark:text-brand-400">
                  {formatTimeSecs(lBill)}
                </span>{" "}
              </div>{" "}
              <div className="flex justify-between items-center pt-[12px]">
                {" "}
                <span className="text-[12px] font-[700] text-surface-500">
                  IC %
                </span>{" "}
                <span
                  className={`text-[15px] font-[800] ${ic >= 100 ? "text-success-600" : "text-danger-600"}`}
                >
                  {formatPerc(ic)}
                </span>{" "}
              </div>{" "}
            </div>
          );
        })}{" "}
      </div>{" "}
    </div>
  );
}
