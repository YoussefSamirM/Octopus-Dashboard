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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        {" "}
        <h2 className="text-2xl font-semibold text-surface-900">
          Overview
        </h2>{" "}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-md px-3 h-10 shadow-sm">
            <CalendarDays size={16} className="text-surface-500" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-surface-700 outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>{" "}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {" "}
          {LOBs.map((lob) => {
            let lReq = 0,
              lAct = 0,
              lBill = 0,
              lGranted = 0,
              lGrantedBill = 0,
              passedIntervals = 0,
              totalIntervals = 0;
            filteredDates.forEach((dIso) => {
              const d = globalProcessedData[dIso]?.[currentShiftMode]?.[lob.id];
              if (d) {
                lReq += d.req;
                lAct += d.act;
                lBill += d.bill;
                lGranted += (d.granted || 0);
                lGrantedBill += (d.grantedBill || 0);
                if (d.intervals) {
                  passedIntervals += d.intervals.filter((i: any) => (i.req > 0 || i.act > 0) && (i.act >= i.req || i.bill >= i.req)).length;
                  totalIntervals += d.intervals.filter((i: any) => i.req > 0 || i.act > 0).length;
                }
              }
            });
            const ic = totalIntervals === 0 ? 100 : (passedIntervals / totalIntervals) * 100;
            return (
              <div
                key={lob.id}
                onClick={() => onSelectLob(lob.id)}
                className="card p-5 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50/30 dark:hover:bg-surface-100/20 shadow-xs group"
              >
                {" "}
                <h3 className="text-xl font-semibold mb-5 text-surface-900 flex justify-between items-center">
                  {" "}
                  {lob.title}{" "}
                  <ArrowRight
                    size={16}
                    className="text-surface-400 group-hover:text-brand-600"
                  />{" "}
                </h3>{" "}
                <div className="flex justify-between items-center py-3 border-b border-surface-200">
                  {" "}
                  <span className="text-xs font-semibold text-surface-500">
                    REQ
                  </span>{" "}
                  <span className="text-base font-semibold text-surface-900">
                    {formatTimeSecs(lReq)}
                  </span>{" "}
                </div>{" "}
                <div className="flex justify-between items-center py-3 border-b border-surface-200">
                  {" "}
                  <span className="text-xs font-semibold text-surface-500">
                    Actual
                  </span>{" "}
                  <span className="text-base font-semibold text-surface-900">
                    {formatTimeSecs(lAct)}
                  </span>{" "}
                </div>{" "}
                <div className="flex justify-between items-center py-3 border-b border-surface-200">
                  {" "}
                  <span className="text-xs font-semibold text-surface-500">
                    Billable
                  </span>{" "}
                  <span className="text-base font-semibold text-brand-600 dark:text-brand-400">
                    {formatTimeSecs(lBill)}
                  </span>{" "}
                </div>{" "}
                <div className="flex justify-between items-center pt-3">
                  {" "}
                  <span className="text-xs font-semibold text-surface-500">
                    IC %
                  </span>{" "}
                  <span
                    className={`text-base font-semibold ${ic >= 100 ? "text-success-600" : "text-danger-600"}`}
                  >
                    {formatPerc(ic)}
                  </span>{" "}
                </div>{" "}
              </div>
            );
          })}{" "}
        </div>
    </div>
  );
}
