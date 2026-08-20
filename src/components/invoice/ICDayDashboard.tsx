import { useState } from "react";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { Users, Calendar, Target, Clock, CheckCircle, XCircle, TrendingDown, TrendingUp, ChevronRight } from "lucide-react";
interface ICDayDashboardProps {
  iso: string;
  lobId: string;
  onViewAgentDetails: (sk: number) => void;
}
const LOBs = [
  { id: "Combined", title: "Combined" },
  { id: "TPro", title: "T-Pro" },
  { id: "GHC", title: "GHC" },
  { id: "TMart-FU", title: "T-Mart Follow Up" },
];
export default function ICDayDashboard({
  iso,
  lobId,
  onViewAgentDetails,
}: ICDayDashboardProps) {
  const { globalProcessedData, currentShiftMode } = useInvoiceStore();
  const dayData = globalProcessedData[iso]?.[currentShiftMode];
  const lobData = dayData?.[lobId];
  if (!lobData) return null;
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
  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-[32px] gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-50 rounded-lg border border-brand-100">
              <Calendar className="text-brand-600" size={20} />
            </div>
            <h2 className="text-[28px] font-[900] text-surface-900 tracking-tight">
              Interval Breakdown
            </h2>
          </div>
          <div className="flex items-center gap-2 text-surface-500 font-medium text-[14px]">
            <span className="flex items-center gap-1.5 bg-surface-100 px-2.5 py-1 rounded-md text-surface-700">
              <Target size={14} />
              {LOBs.find((l) => l.id === lobId)?.title}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-1 rounded-md font-bold">
              <Clock size={14} />
              {iso}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface-0 border border-surface-200 rounded-[16px] overflow-hidden shadow-sm overflow-x-auto mb-[40px]">
        <table className="w-full border-collapse text-left whitespace-nowrap">
          <thead>
            <tr>
              <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 uppercase tracking-[0.5px] px-[24px] py-[16px] border-b border-surface-200">
                Time Interval
              </th>
              <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 uppercase tracking-[0.5px] px-[24px] py-[16px] border-b border-surface-200">
                Required
              </th>
              <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 uppercase tracking-[0.5px] px-[24px] py-[16px] border-b border-surface-200">
                Actual
              </th>
              <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 uppercase tracking-[0.5px] px-[24px] py-[16px] border-b border-surface-200">
                Billable
              </th>
              <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 uppercase tracking-[0.5px] px-[24px] py-[16px] border-b border-surface-200 text-center">
                IC %
              </th>
              <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 uppercase tracking-[0.5px] px-[24px] py-[16px] border-b border-surface-200">
                Variance
              </th>
              <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 uppercase tracking-[0.5px] px-[24px] py-[16px] border-b border-surface-200">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {lobData.intervals.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-surface-500">
                  <Calendar className="mx-auto h-12 w-12 text-surface-300 mb-4" />
                  <p className="text-[15px] font-medium text-surface-600">No interval data available</p>
                </td>
              </tr>
            ) : (
              lobData.intervals.map((intObj, i) => {
                if (intObj.req > 0 || intObj.act > 0) {
                  let ic = intObj.req === 0 ? 100 : (intObj.act / intObj.req) * 100;
                  let isPass = intObj.act >= intObj.req;
                  return (
                    <tr
                      key={i}
                      className="hover:bg-brand-50/30 transition-colors group"
                    >
                      <td className="px-[24px] py-[16px]">
                        <span className="font-[700] text-[14px] text-surface-900">
                          {intObj.label}
                        </span>
                      </td>
                      <td className="px-[24px] py-[16px] font-[600] text-[13px] font-mono text-surface-600">
                        {formatTimeSecs(intObj.req)}
                      </td>
                      <td className="px-[24px] py-[16px] font-[600] text-[13px] font-mono text-surface-900">
                        {formatTimeSecs(intObj.act)}
                      </td>
                      <td className="px-[24px] py-[16px]">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-[700] font-mono bg-brand-50 text-brand-700 border border-brand-100">
                          {formatTimeSecs(intObj.bill)}
                        </span>
                      </td>
                      <td className="px-[24px] py-[16px] text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-[700] font-mono ${isPass ? 'bg-success-50 text-success-700 border border-success-100' : 'bg-danger-50 text-danger-700 border border-danger-100'}`}>
                          {isPass ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          {formatPerc(ic)}
                        </span>
                      </td>
                      <td className="px-[24px] py-[16px]">
                        <div className="flex flex-col gap-1">
                          {intObj.lost > 0 && (
                            <span className="flex items-center gap-1.5 text-[12px] font-[600] text-danger-600 font-mono">
                              <TrendingDown size={14} />
                              -{formatTimeSecs(intObj.lost)} (Short)
                            </span>
                          )}
                          {intObj.over > 0 && (
                            <span className="flex items-center gap-1.5 text-[12px] font-[600] text-success-600 font-mono">
                              <TrendingUp size={14} />
                              +{formatTimeSecs(intObj.over)} (Over)
                            </span>
                          )}
                          {intObj.lost === 0 && intObj.over === 0 && (
                            <span className="text-[12px] font-[600] text-surface-400 font-mono">Perfect Match</span>
                          )}
                        </div>
                      </td>
                      <td className="px-[24px] py-[16px] text-right">
                        <button
                          onClick={() => onViewAgentDetails(intObj.sk)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="View Agent Details"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  );
                }
                return null;
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
