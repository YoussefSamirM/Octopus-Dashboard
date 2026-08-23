import { useState } from "react";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { Users, Calendar, Target, Clock, CheckCircle, XCircle, TrendingDown, TrendingUp, ChevronRight, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ICDayDashboardProps {
  iso: string;
  lobId: string;
  onViewAgentDetails: (sk: number) => void;
  viewMode?: 'overview' | 'details';
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
  viewMode = 'overview'
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
          <h2 className="text-2xl font-semibold text-surface-900 mb-2">
            Interval Breakdown
          </h2>
          <div className="flex items-center gap-2 text-surface-500 font-medium text-sm">
            <span>{LOBs.find((l) => l.id === lobId)?.title}</span>
            <span>•</span>
            <span className="font-semibold">{iso}</span>
          </div>
        </div>
      </div>

      {viewMode === 'overview' ? (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 border-l-4 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300" style={{ borderLeftColor: '#64748b' }}>
            <div className="flex items-center gap-3 mb-2">
              <Clock className="text-surface-400" size={20} />
              <h3 className="text-sm font-semibold text-surface-500">Total Required</h3>
            </div>
            <p className="text-3xl font-bold text-surface-900">{formatTimeSecs(lobData.req)}</p>
          </div>
          <div className="card p-6 border-l-4 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="flex items-center gap-3 mb-2">
              <Activity className="text-surface-400" size={20} />
              <h3 className="text-sm font-semibold text-surface-500">Total Actual</h3>
            </div>
            <p className="text-3xl font-bold text-surface-900">{formatTimeSecs(lobData.act)}</p>
          </div>
          <div className="card p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="text-brand-500" size={20} />
              <h3 className="text-sm font-semibold text-surface-500">Day IC%</h3>
            </div>
            <p className={`text-3xl font-bold ${lobData.req === 0 || (lobData.bill / lobData.req) * 100 >= 100 ? 'text-success-600' : 'text-danger-600'}`}>
              {formatPerc(lobData.req === 0 ? 100 : (lobData.bill / lobData.req) * 100)}
            </p>
          </div>
        </div>
        
        <div className="card p-4 sm:p-6 h-[280px] sm:h-[400px]">
          <h3 className="text-base font-semibold text-surface-900 mb-2 sm:mb-6">Intraday Curve (Required vs Actual)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={lobData.intervals} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReqIntraday" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorActIntraday" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} interval="preserveStartEnd" minTickGap={30} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={80} 
                     tickFormatter={(val) => Math.round(val / 3600) + 'h'} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(4px)' }}
                formatter={(value: number) => formatTimeSecs(value)}
                labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}
              />
              <Area type="monotone" dataKey="req" name="Required" stroke="#94a3b8" strokeWidth={3} fillOpacity={1} fill="url(#colorReqIntraday)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="act" name="Actual" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorActIntraday)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      ) : (
      <div className="card overflow-hidden shadow-sm mb-10 w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full border-collapse text-left whitespace-nowrap">
          <thead className="glass-header">
            <tr>
              <th className="font-semibold text-xs text-surface-500 px-3 py-3 border-b border-surface-200">
                Time
              </th>
              <th className="font-semibold text-xs text-surface-500 px-3 py-3 border-b border-surface-200">
                REQ
              </th>
              <th className="font-semibold text-xs text-surface-500 px-3 py-3 border-b border-surface-200">
                Actual
              </th>
              <th className="font-semibold text-xs text-surface-500 px-3 py-3 border-b border-surface-200">
                Billable
              </th>
              <th className="font-semibold text-xs text-surface-500 px-3 py-3 border-b border-surface-200 text-center">
                IC %
              </th>
              <th className="font-semibold text-xs text-surface-500 px-3 py-3 border-b border-surface-200">
                O/U
              </th>
              <th className="font-semibold text-xs text-surface-500 px-3 py-3 border-b border-surface-200">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {lobData.intervals.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-surface-500">
                  <Calendar className="mx-auto h-12 w-12 text-surface-300 mb-4" />
                  <p className="text-sm font-medium text-surface-600">No interval data available</p>
                </td>
              </tr>
            ) : (
              lobData.intervals.map((intObj: any, i: number) => {
                if (intObj.req > 0 || intObj.act > 0) {
                  let ic = intObj.req === 0 ? 100 : (intObj.act / intObj.req) * 100;
                  let isPass = intObj.act >= intObj.req;
                  return (
                    <tr
                      key={i}
                      className="hover:bg-brand-50/30 transition-colors group"
                    >
                      <td className="px-3 py-3">
                        <span className="font-semibold text-sm text-surface-900">
                          {intObj.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-sm text-surface-600">
                        {formatTimeSecs(intObj.req)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-sm text-surface-900">
                        {formatTimeSecs(intObj.act)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-sm text-surface-900">
                        {formatTimeSecs(intObj.bill)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-semibold ${isPass ? 'text-success-600' : 'text-danger-600'}`}>
                          {formatPerc(ic)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {intObj.lost > 0 && (
                            <span className="text-xs font-semibold text-danger-600">
                              -{formatTimeSecs(intObj.lost)}
                            </span>
                          )}
                          {intObj.over > 0 && (
                            <span className="text-xs font-semibold text-success-600">
                              +{formatTimeSecs(intObj.over)}
                            </span>
                          )}
                          {intObj.lost === 0 && intObj.over === 0 && (
                            <span className="text-xs font-semibold text-surface-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => onViewAgentDetails(intObj.sk)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
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
      )}
    </div>
  );
}
