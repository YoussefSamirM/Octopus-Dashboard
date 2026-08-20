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
          <h2 className="text-[24px] font-[900] text-surface-900 mb-2">
            Interval Breakdown
          </h2>
          <div className="flex items-center gap-2 text-surface-500 font-medium text-[14px]">
            <span>{LOBs.find((l) => l.id === lobId)?.title}</span>
            <span>•</span>
            <span className="font-bold">{iso}</span>
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
                O/U
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
                      <td className="px-[24px] py-[16px] font-[600] text-[13px] text-surface-600">
                        {formatTimeSecs(intObj.req)}
                      </td>
                      <td className="px-[24px] py-[16px] font-[600] text-[13px] text-surface-900">
                        {formatTimeSecs(intObj.act)}
                      </td>
                      <td className="px-[24px] py-[16px] font-[600] text-[13px] text-surface-900">
                        {formatTimeSecs(intObj.bill)}
                      </td>
                      <td className="px-[24px] py-[16px] text-center">
                        <span className={`text-[13px] font-[700] ${isPass ? 'text-success-600' : 'text-danger-600'}`}>
                          {formatPerc(ic)}
                        </span>
                      </td>
                      <td className="px-[24px] py-[16px]">
                        <div className="flex flex-col gap-1">
                          {intObj.lost > 0 && (
                            <span className="text-[12px] font-[600] text-danger-600">
                              -{formatTimeSecs(intObj.lost)}
                            </span>
                          )}
                          {intObj.over > 0 && (
                            <span className="text-[12px] font-[600] text-success-600">
                              +{formatTimeSecs(intObj.over)}
                            </span>
                          )}
                          {intObj.lost === 0 && intObj.over === 0 && (
                            <span className="text-[12px] font-[600] text-surface-400">-</span>
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
