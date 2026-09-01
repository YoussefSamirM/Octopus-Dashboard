import { useInvoiceStore } from "../../stores/invoiceStore";
import { ArrowRight, Activity, Clock, CheckCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ICLobDaysViewProps {
  lobId: string;
  onSelectDate: (date: string) => void;
}
const LOBs = [
  { id: "Combined", title: "Combined", color: "#f59e0b" },
  { id: "TPro", title: "T-Pro", color: "#10b981" },
  { id: "GHC", title: "GHC", color: "#8b5cf6" },
  { id: "TMart-FU", title: "T-Mart Follow Up", color: "#ec4899" },
];
export default function ICLobDaysView({
  lobId,
  onSelectDate,
}: ICLobDaysViewProps) {
  const { globalProcessedData, sortedDates, currentShiftMode, referenceData } =
    useInvoiceStore();
  const lobConf = LOBs.find((l) => l.id === lobId);
  if (!lobConf) return null;
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
  let tReq = 0,
    tAct = 0,
    tBill = 0,
    tOver = 0,
    tLost = 0,
    tHc = 0,
    tAbs = 0,
    tGranted = 0,
    tGrantedBill = 0;

  const chartData = sortedDates.map(dIso => {
    const baseD = globalProcessedData[dIso]?.[currentShiftMode]?.[lobId];
    const ref = referenceData?.[lobId]?.[dIso];
    if (!baseD && !ref) return null;
    
    const dReq = ref ? (ref.reqSecs || 0) : (baseD?.req || 0);
    const dAct = ref ? (ref.actualSecs || 0) : (baseD?.act || 0);

    return {
      date: dIso.slice(5),
      req: dReq,
      act: dAct
    };
  }).filter(Boolean);

  // We need to recount tReq, tAct etc for the Details view loop, so we should reset them
  // Actually, wait, let's just use the totals we just calculated for the Details view summary row as well.
  // The Details view does its own loop, so we should reset them if we want the Details view to calculate it again,
  // OR we just remove the calculation from the Details view loop. Let's just reset them for safety.
  tReq = 0; tAct = 0; tBill = 0; tOver = 0; tLost = 0; tHc = 0; tAbs = 0; tGranted = 0; tGrantedBill = 0;

  // Let's recalculate for Overview since the chartData loop resets them below anyway
  chartData.forEach((d: any) => {
    const orig = globalProcessedData[`2024-${d.date}`] || globalProcessedData[`2023-${d.date}`]; // just a hack
  });
  
  // A cleaner approach: calculate totals once.
  let overviewReq = 0, overviewAct = 0, overviewBill = 0, overviewGranted = 0, overviewGrantedBill = 0;
  sortedDates.forEach(dIso => {
    const d = globalProcessedData[dIso]?.[currentShiftMode]?.[lobId];
    if (d && (d.req > 0 || d.act > 0 || d.sch > 0)) {
      overviewReq += d.req;
      overviewAct += d.act;
      overviewBill += d.bill;
      overviewGranted += (d.granted || 0);
      overviewGrantedBill += (d.grantedBill || 0);
    }
  });

  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <div className="page-header mb-5">
        <h1 className="page-title text-2xl font-semibold text-surface-900">
          {lobConf.title} Breakdown
        </h1>
        <p className="page-description text-surface-500 text-xs sm:text-sm mt-0.5">
          Daily performance and interval compliance history.
        </p>
      </div>
      <div className="card mb-6 shadow-xs">
        <div className="w-full overflow-x-auto">
          <table className="min-w-full border-collapse text-left whitespace-nowrap">
            <thead className="bg-surface-50 sticky top-0 z-10">
            <tr>
              {" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                Date
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                REQ
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                Actual
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                ABS %
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                ABS Hrs
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                SCH %
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                Billable
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                IC %
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                Shortage
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                Overage
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                Overage %
              </th>{" "}
              <th className="font-semibold text-[11px] text-surface-500 px-2 py-3 border-b border-surface-200">
                Action
              </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody>
            {" "}
            {sortedDates.map((dIso) => {
              const baseD = globalProcessedData[dIso]?.[currentShiftMode]?.[lobId];
              const ref = referenceData?.[lobId]?.[dIso];
              if (!baseD && !ref) return null;

              const dReq = ref && ref.reqSecs !== undefined ? ref.reqSecs : (baseD?.req || 0);
              const dAct = ref && ref.actualSecs !== undefined ? ref.actualSecs : (baseD?.act || 0);
              const dBill = ref && ref.billSecs !== undefined ? ref.billSecs : (baseD?.bill || 0);
              const dSch = baseD?.sch || 0;
              const dOver = dAct > dReq ? dAct - dReq : 0;
              const dLost = dReq > dAct ? dReq - dAct : 0;
              const dAbs = baseD?.abs || 0;
              let dAbsPerc = dSch > 0 ? (dAbs / dSch) * 100 : 0;

              if (dReq > 0 || dAct > 0 || dSch > 0) {
                tReq += dReq;
                tAct += dAct;
                tBill += dBill;
                tOver += dOver;
                tLost += dLost;
                tHc += dSch;
                tAbs += dAbs;
                tGranted += (baseD?.granted || 0);
                tGrantedBill += (baseD?.grantedBill || 0);
                let schHrs = dSch * 0.89;
                let schPerc = dReq > 0 ? (schHrs / dReq) * 100 : 0;
                
                let ic = 100;
                if (ref && ref.icPerc !== undefined) {
                  ic = ref.icPerc;
                } else if (baseD && baseD.intervals) {
                  let passedIntervals = baseD.intervals.filter((i: any) => (i.req > 0 || i.act > 0) && (i.act >= i.req || i.bill >= i.req)).length;
                  let activeIntervals = baseD.intervals.filter((i: any) => i.req > 0 || i.act > 0).length;
                  if (activeIntervals > 0) ic = (passedIntervals / activeIntervals) * 100;
                }

                let ovPerc = dReq > 0 ? (dOver / dReq) * 100 : 0;
                let absPerc = dSch > 0 ? (dAbs / dSch) * 100 : 0;
                return (
                  <tr
                    key={dIso}
                    className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    {" "}
                    <td className="px-2 py-3 font-semibold text-[13px] border-b border-surface-200 text-surface-900 whitespace-nowrap">
                      {dIso}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] bg-surface-50 border-b border-surface-200 tabular-nums text-surface-900">
                      {formatTimeSecs(dReq)}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] border-b border-surface-200 tabular-nums text-surface-900">
                      {formatTimeSecs(dAct)}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] text-danger-600 dark:text-danger-400 border-b border-surface-200 tabular-nums">
                      {formatPerc(dAbsPerc)}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] text-danger-600 dark:text-danger-400 border-b border-surface-200 tabular-nums">
                      {formatTimeSecs(dAbs)}
                    </td>{" "}
                    <td className={`px-2 py-3 font-semibold text-[13px] border-b border-surface-200 tabular-nums ${schPerc >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {schPerc >= 0 ? '+' : ''}{formatPerc(schPerc)}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] text-surface-900 dark:text-surface-100 border-b border-surface-200 tabular-nums">
                      {formatTimeSecs(dBill)}
                    </td>{" "}
                    <td
                      className={`px-2 py-3 font-semibold text-[13px] ${ic >= 100 ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400"} border-b border-surface-200 tabular-nums`}
                    >
                      {formatPerc(ic)}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] text-danger-600 dark:text-danger-400 border-b border-surface-200 tabular-nums">
                      {formatTimeSecs(dLost)}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] text-success-600 dark:text-success-400 border-b border-surface-200 tabular-nums">
                      {formatTimeSecs(dOver)}
                    </td>{" "}
                    <td className="px-2 py-3 font-semibold text-[13px] text-success-600 dark:text-success-400 border-b border-surface-200 tabular-nums">
                      {formatPerc(ovPerc)}
                    </td>{" "}
                    <td className="px-2 py-3 border-b border-surface-200">
                      {" "}
                      <button
                        onClick={() => onSelectDate(dIso)}
                        className="inline-flex items-center gap-1 text-brand-600 font-semibold bg-[#eff6ff] dark:bg-brand-900/30 border border-[#bfdbfe] dark:border-brand-700/50 px-2 py-1 rounded-md transition-all hover:bg-brand-600 hover:text-white hover:border-brand-600 text-[11px] uppercase tracking-wide"
                        title="View Intervals"
                      >
                        {" "}
                        <ArrowRight size={14} />{" "}
                      </button>{" "}
                    </td>{" "}
                  </tr>
                );
              }
              return null;
            })}
            {/* Total Row */}{" "}
            {(() => {
              let netOver = tOver,
                netLost = tLost;
              let tPassedIntervals = 0;
              let tTotalIntervals = 0;
              let refDaysCount = 0;
              let refIcSum = 0;
              
              sortedDates.forEach((dIso) => {
                const baseD = globalProcessedData[dIso]?.[currentShiftMode]?.[lobId];
                const ref = referenceData?.[lobId]?.[dIso];
                if (ref && ref.icPerc !== undefined) {
                  refIcSum += ref.icPerc;
                  refDaysCount++;
                } else if (baseD && baseD.intervals) {
                  tPassedIntervals += baseD.intervals.filter((i: any) => (i.req > 0 || i.act > 0) && (i.act >= i.req || i.bill >= i.req)).length;
                  tTotalIntervals += baseD.intervals.filter((i: any) => i.req > 0 || i.act > 0).length;
                }
              });
              let tOvPerc = tReq > 0 ? (netOver / tReq) * 100 : 0;
              let tSchHrs = tHc * 0.89;
              let tSchPerc = tReq > 0 ? (tSchHrs / tReq) * 100 : 0;
              let avgAbsPerc = tHc > 0 ? (tAbs / tHc) * 100 : 0;

              let mIc = refDaysCount > 0 ? (refIcSum / refDaysCount) : (tTotalIntervals > 0 ? (tPassedIntervals / tTotalIntervals) * 100 : 100);
              const refTotal = referenceData?.[lobId]?.['total'];
              if (refTotal && refTotal.icPerc !== undefined) {
                 mIc = refTotal.icPerc;
              }
              return (
                <tr className="bg-surface-100 font-semibold border-t-2 border-surface-300">
                  {" "}
                  <td className="px-2 py-3 text-[13px] text-surface-900">
                    Total
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] bg-surface-50 tabular-nums text-surface-900">
                    {formatTimeSecs(tReq)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] tabular-nums text-surface-900">
                    {formatTimeSecs(tAct)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] text-danger-600 dark:text-danger-400 tabular-nums">
                    {formatPerc(avgAbsPerc)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] text-danger-600 dark:text-danger-400 tabular-nums">
                    {formatTimeSecs(tAbs)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] text-surface-500 tabular-nums">
                    {formatPerc(tSchPerc)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] text-surface-900 tabular-nums">
                    {formatTimeSecs(tBill)}
                  </td>{" "}
                  <td
                    className={`px-2 py-3 text-[13px] ${mIc >= 100 ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400"} tabular-nums`}
                  >
                    {formatPerc(mIc)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] text-danger-600 dark:text-danger-400 tabular-nums">
                    {formatTimeSecs(netLost)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] text-success-600 dark:text-success-400 tabular-nums">
                    {formatTimeSecs(netOver)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px] text-success-600 dark:text-success-400 tabular-nums">
                    {formatPerc(tOvPerc)}
                  </td>{" "}
                  <td className="px-2 py-3 text-[13px]">-</td>{" "}
                </tr>
              );
            })()}{" "}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
