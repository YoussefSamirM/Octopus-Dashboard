import { useInvoiceStore } from "../../stores/invoiceStore";
import { ArrowRight } from "lucide-react";
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
  const { globalProcessedData, sortedDates, currentShiftMode } =
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
    tAbs = 0;
  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in duration-300">
      {" "}
      <h2 className="text-[24px] font-[900] text-surface-900 mb-[24px]">
        {lobConf.title} Daily Breakdown
      </h2>{" "}
      <div className="bg-surface-0 border border-surface-200 rounded-[12px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-x-auto mb-[32px]">
        {" "}
        <table className="w-full border-collapse text-left whitespace-nowrap">
          {" "}
          <thead>
            {" "}
            <tr>
              {" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                Date
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                REQ
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                Actual
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                ABS %
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                ABS Hours
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                SCH %
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                Billable
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                IC %
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                Shortage
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                Overage
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                Overage %
              </th>{" "}
              <th className="bg-surface-50 font-[800] text-[11px] text-surface-500 uppercase tracking-[0.5px] px-[16px] py-[14px] border-b border-surface-200 ">
                Action
              </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody>
            {" "}
            {sortedDates.map((dIso) => {
              const d = globalProcessedData[dIso]?.[currentShiftMode]?.[lobId];
              if (d && (d.req > 0 || d.act > 0 || d.sch > 0)) {
                tReq += d.req;
                tAct += d.act;
                tBill += d.bill;
                tOver += d.over;
                tLost += d.lost;
                tHc += d.sch;
                tAbs += d.abs;
                let schHrs = d.sch * 0.89;
                /* Prod SCH */ let schPerc =
                  d.req > 0 ? (schHrs / d.req) * 100 : 0;
                let ic = d.req === 0 ? 100 : (d.bill / d.req) * 100;
                let ovPerc = d.req > 0 ? (d.over / d.req) * 100 : 0;
                let absPerc = d.sch > 0 ? (d.abs / d.sch) * 100 : 0;
                return (
                  <tr
                    key={dIso}
                    className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    {" "}
                    <td className="px-[16px] py-[14px] font-[700] text-[13px] border-b border-surface-200 text-surface-900 ">
                      {dIso}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[700] text-[13px] bg-surface-50 border-b border-surface-200 font-mono text-surface-900 ">
                      {formatTimeSecs(d.req)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[700] text-[13px] border-b border-surface-200 font-mono text-surface-900 ">
                      {formatTimeSecs(d.act)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[800] text-[13px] text-danger-600 dark:text-danger-400 border-b border-surface-200 font-mono">
                      {formatPerc(absPerc)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[800] text-[13px] text-danger-600 dark:text-danger-400 border-b border-surface-200 font-mono">
                      {formatTimeSecs(d.abs)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[700] text-[13px] text-surface-500 border-b border-surface-200 font-mono">
                      {formatPerc(schPerc)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[800] text-[13px] text-brand-600 dark:text-brand-400 border-b border-surface-200 font-mono">
                      {formatTimeSecs(d.bill)}
                    </td>{" "}
                    <td
                      className={`px-[16px] py-[14px] font-[800] text-[13px] ${ic >= 100 ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400"} border-b border-surface-200 font-mono`}
                    >
                      {formatPerc(ic)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[800] text-[13px] text-danger-600 dark:text-danger-400 border-b border-surface-200 font-mono">
                      {formatTimeSecs(d.lost)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[800] text-[13px] text-success-600 dark:text-success-400 border-b border-surface-200 font-mono">
                      {formatTimeSecs(d.over)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] font-[800] text-[13px] text-success-600 dark:text-success-400 border-b border-surface-200 font-mono">
                      {formatPerc(ovPerc)}
                    </td>{" "}
                    <td className="px-[16px] py-[14px] border-b border-surface-200 ">
                      {" "}
                      <button
                        onClick={() => onSelectDate(dIso)}
                        className="inline-flex items-center gap-[8px] text-brand-600 font-[700] bg-[#eff6ff] dark:bg-brand-900/30 border border-[#bfdbfe] dark:border-brand-700/50 px-[16px] py-[8px] rounded-[6px] transition-all hover:bg-brand-600 hover:text-white hover:border-brand-600 text-[13px]"
                      >
                        {" "}
                        Intervals <ArrowRight size={14} />{" "}
                      </button>{" "}
                    </td>{" "}
                  </tr>
                );
              }
              return null;
            })}{" "}
            {/* Total Row */}{" "}
            {(() => {
              let netOver = 0,
                netLost = 0;
              if (tAct > tReq) {
                netOver = tAct - tReq;
                netLost = 0;
              } else {
                netLost = tReq - tAct;
                netOver = 0;
              }
              let tSchHrs = tHc * 0.89;
              let tAbsPerc = tHc > 0 ? (tAbs / tHc) * 100 : 0;
              let tSchPerc = tReq > 0 ? (tSchHrs / tReq) * 100 : 0;
              let tOvPerc = tReq > 0 ? (netOver / tReq) * 100 : 0;
              let mIc = tReq === 0 ? 100 : (tBill / tReq) * 100;
              return (
                <tr className="bg-surface-100 font-[800] border-t-2 border-surface-300 ">
                  {" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-surface-900 ">
                    Total
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] bg-surface-50 font-mono text-surface-900 ">
                    {formatTimeSecs(tReq)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] font-mono text-surface-900 ">
                    {formatTimeSecs(tAct)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-danger-600 dark:text-danger-400 font-mono">
                    {formatPerc(tAbsPerc)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-danger-600 dark:text-danger-400 font-mono">
                    {formatTimeSecs(tAbs)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-surface-500 font-mono">
                    {formatPerc(tSchPerc)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-brand-600 dark:text-brand-400 font-mono">
                    {formatTimeSecs(tBill)}
                  </td>{" "}
                  <td
                    className={`px-[16px] py-[14px] text-[13px] ${mIc >= 100 ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400"} font-mono`}
                  >
                    {formatPerc(mIc)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-danger-600 dark:text-danger-400 font-mono">
                    {formatTimeSecs(netLost)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-success-600 dark:text-success-400 font-mono">
                    {formatTimeSecs(netOver)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px] text-success-600 dark:text-success-400 font-mono">
                    {formatPerc(tOvPerc)}
                  </td>{" "}
                  <td className="px-[16px] py-[14px] text-[13px]">-</td>{" "}
                </tr>
              );
            })()}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
    </div>
  );
}
