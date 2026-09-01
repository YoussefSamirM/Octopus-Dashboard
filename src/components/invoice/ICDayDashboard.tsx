import React, { useState, useMemo } from "react";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { Users, Calendar, Target, Clock, CheckCircle, XCircle, TrendingDown, TrendingUp, ChevronRight, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, LineChart, Line, Cell, ComposedChart } from "recharts";
import ICAnalysisModal from "./ICAnalysisModal";

interface ICDayDashboardProps {
  iso: string;
  lobId: string;
  onViewAgentDetails: (sk: number) => void;
  onViewAnalysis?: (sk: number) => void;
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
  onViewAnalysis,
  viewMode = 'overview'
}: ICDayDashboardProps) {
  const { globalProcessedData, currentShiftMode, agentInfo } = useInvoiceStore();
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

  const avgReq = lobData.intervals.length > 0 ? (lobData.req / lobData.intervals.length) : 0;
  const avgAct = lobData.intervals.length > 0 ? (lobData.act / lobData.intervals.length) : 0;

  const enrichedIntervals = useMemo(() => {
    let cumReq = 0;
    let cumAct = 0;
    return lobData.intervals.map((int: any) => {
      cumReq += int.req;
      cumAct += int.act;
      let isP = int.act >= int.req || int.bill >= int.req;
      let icVal = int.req > 0 ? Math.min(100, ((isP ? int.req : int.bill) / int.req) * 100) : 100;
      return {
        ...int,
        variance: int.act - int.req,
        icPerc: icVal,
        cumReq,
        cumAct
      };
    });
  }, [lobData.intervals]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const intObj = payload[0].payload;
      const req = intObj.req;
      const act = intObj.act;
      const variance = intObj.variance;
      const isOver = variance > 0;
      const isShort = variance < 0;
      const icPerc = intObj.icPerc;
      
      return (
        <div className="bg-surface-0 p-3 rounded-lg border border-surface-200 shadow-xs">
          <p className="text-xs font-semibold text-surface-900 mb-2 border-b border-surface-100 pb-1.5">{label}</p>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center gap-5">
              <span className="text-surface-500 font-medium flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#94a3b8]"></div>Required
              </span>
              <span className="font-semibold text-surface-900">{formatTimeSecs(req)}</span>
            </div>
            <div className="flex justify-between items-center gap-5">
              <span className="text-surface-500 font-medium flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div>Actual
              </span>
              <span className="font-semibold text-surface-900">{formatTimeSecs(act)}</span>
            </div>
            
            <div className="h-px bg-surface-100 my-1"></div>
            
            <div className="flex justify-between items-center gap-5">
              <span className="text-surface-500 font-medium">
                {isOver ? 'Overage' : isShort ? 'Shortage' : 'Variance'}
              </span>
              <span className={`font-semibold ${isOver ? 'text-success-600' : isShort ? 'text-danger-600' : 'text-surface-500'}`}>
                {isOver ? '+' : isShort ? '-' : ''} {formatTimeSecs(Math.abs(variance))}
              </span>
            </div>
            <div className="flex justify-between items-center gap-5">
              <span className="text-surface-500 font-medium">IC %</span>
              <span className={`font-semibold ${icPerc >= 100 ? 'text-success-600' : 'text-danger-600'}`}>
                {icPerc.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-surface-900 mb-1">
            Interval Breakdown
          </h2>
          <div className="flex items-center gap-2 text-surface-500 font-medium text-xs">
            <span>{LOBs.find((l) => l.id === lobId)?.title}</span>
            <span>•</span>
            <span className="font-semibold">{iso}</span>
          </div>
        </div>
      </div>

      {viewMode === 'overview' ? (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="card p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="text-surface-400" size={16} />
              <h3 className="text-xs font-semibold text-surface-500">Total Required</h3>
            </div>
            <p className="text-2xl font-semibold text-surface-900">{formatTimeSecs(lobData.req)}</p>
          </div>
          <div className="card p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Activity className="text-surface-400" size={16} />
              <h3 className="text-xs font-semibold text-surface-500">Total Actual</h3>
            </div>
            <p className="text-2xl font-semibold text-surface-900">{formatTimeSecs(lobData.act)}</p>
          </div>
          <div className="card p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle className="text-brand-500" size={16} />
              <h3 className="text-xs font-semibold text-surface-500">Day IC%</h3>
            </div>
            {(() => {
              const activeInts = lobData.intervals.filter((i: any) => i.req > 0 || i.act > 0);
              const passedInts = activeInts.filter((i: any) => i.act >= i.req || i.bill >= i.req).length;
              const dIc = activeInts.length > 0 ? (passedInts / activeInts.length) * 100 : 100;
              return (
                <p className={`text-2xl font-semibold ${dIc >= 95 ? 'text-success-600' : 'text-danger-600'}`}>
                  {formatPerc(dIc)}
                </p>
              );
            })()}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Main Intervals View */}
          <div className="card p-4 sm:p-6 h-[280px] sm:h-[400px] xl:col-span-2">
            <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2 sm:mb-6">Intervals View</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enrichedIntervals} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReqIntraday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorActIntraday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#64748b" strokeOpacity={0.15} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} interval="preserveStartEnd" minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={80} 
                       tickFormatter={(val) => Math.round(val / 3600) + 'h'} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'transparent', border: 'none' }} />
                
                <ReferenceLine y={avgReq} stroke="#94a3b8" strokeDasharray="3 3" strokeOpacity={0.6} />
                <ReferenceLine y={avgAct} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.6} />
                
                <Area 
                  type="monotone" 
                  dataKey="req" 
                  name="Required" 
                  stroke="#94a3b8" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorReqIntraday)" 
                  dot={false} 
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} 
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                />
                <Area 
                  type="monotone" 
                  dataKey="act" 
                  name="Actual" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorActIntraday)" 
                  dot={false} 
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} 
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* Hourly Shortage/Overage */}
          <div className="card p-4 sm:p-6 h-[280px] sm:h-[350px]">
             <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2 sm:mb-6 flex items-center gap-2"><Activity size={18} className="text-brand-500" /> Hourly Shortage/Overage</h3>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrichedIntervals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#64748b" strokeOpacity={0.15} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => Math.round(val / 3600) + 'h'} width={60} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ backgroundColor: 'transparent', border: 'none' }} />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
                    {enrichedIntervals.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.variance >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>

          {/* Interval Compliance Trend */}
          <div className="card p-4 sm:p-6 h-[280px] sm:h-[350px]">
             <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2 sm:mb-6 flex items-center gap-2"><Target size={18} className="text-brand-500" /> Interval Compliance %</h3>
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={enrichedIntervals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#64748b" strokeOpacity={0.15} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} contentStyle={{ backgroundColor: 'transparent', border: 'none' }} />
                  <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="icPerc" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
             </ResponsiveContainer>
          </div>
          
          {/* Cumulative Flow */}
          <div className="card p-4 sm:p-6 h-[280px] sm:h-[350px] xl:col-span-2">
             <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2 sm:mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-brand-500" /> Cumulative Flow</h3>
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrichedIntervals} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCumReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCumAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#64748b" strokeOpacity={0.15} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => Math.round(val / 3600) + 'h'} width={60} />
                  <Tooltip content={<CustomTooltip />} contentStyle={{ backgroundColor: 'transparent', border: 'none' }} />
                  <Area type="monotone" dataKey="cumReq" name="Cum. Req" stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorCumReq)" dot={false} />
                  <Area type="monotone" dataKey="cumAct" name="Cum. Act" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorCumAct)" dot={false} />
                </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
      ) : (
      <div className="card overflow-hidden shadow-sm mb-10 w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full text-left whitespace-nowrap">
          <thead className="bg-surface-50 sticky top-0 z-10">
            <tr>
              <th className="font-semibold text-xs text-surface-500 dark:text-surface-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
                Time
              </th>
              <th className="font-semibold text-xs text-surface-500 dark:text-surface-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
                REQ
              </th>
              <th className="font-semibold text-xs text-surface-500 dark:text-surface-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
                Actual
              </th>
              <th className="font-semibold text-xs text-brand-600 dark:text-brand-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
                Gr. Req
              </th>
              <th className="font-semibold text-xs text-brand-600 dark:text-brand-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
                Gr. Bill
              </th>
              <th className="font-semibold text-xs text-surface-500 dark:text-surface-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
                Billable
              </th>
              <th className="font-semibold text-xs text-surface-500 dark:text-surface-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10 text-center">
                IC %
              </th>
              <th className="font-semibold text-xs text-surface-500 dark:text-surface-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
                O/U
              </th>
              <th className="font-semibold text-xs text-surface-500 dark:text-surface-400 px-4 py-3.5 border-b border-surface-200 dark:border-white/10">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-white/5">
            {lobData.intervals.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-surface-500">
                  <Calendar className="mx-auto h-12 w-12 text-surface-300 mb-4" />
                  <p className="text-sm font-medium text-surface-600">No interval data available</p>
                </td>
              </tr>
            ) : (
              lobData.intervals.map((intObj: any, i: number) => {
                if (intObj.req > 0 || intObj.act > 0) {
                  let isPass = intObj.act >= intObj.req || intObj.bill >= intObj.req;
                  let rawIc = intObj.req === 0 ? 100 : ((isPass ? intObj.req : intObj.bill) / intObj.req) * 100;
                  let ic = Math.min(100, rawIc);
                  return (
                    <tr
                      key={i}
                      className="hover:bg-brand-50/50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-sm text-surface-900 dark:text-white">
                          {intObj.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm text-surface-600 dark:text-surface-400">
                        {formatTimeSecs(intObj.req)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm text-surface-900 dark:text-white">
                        {formatTimeSecs(intObj.act)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm text-brand-600 dark:text-brand-400">
                        {intObj.granted > 0 ? formatTimeSecs(intObj.granted) : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm text-brand-600 dark:text-brand-400">
                        {intObj.grantedBill > 0 ? formatTimeSecs(intObj.grantedBill) : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm text-surface-900 dark:text-white">
                        {formatTimeSecs(isPass ? intObj.req : intObj.bill)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${isPass ? 'text-success-600' : 'text-danger-600'}`}>
                          {formatPerc(ic)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {intObj.lost > 0 && !isPass && (
                            <span className="text-xs font-semibold text-danger-600">
                              -{formatTimeSecs(intObj.lost)}
                            </span>
                          )}
                          {intObj.over > 0 && (
                            <span className="text-xs font-semibold text-success-600">
                              +{formatTimeSecs(intObj.over)}
                            </span>
                          )}
                          {((intObj.lost === 0 || isPass) && intObj.over === 0) && (
                            <span className="text-xs font-semibold text-surface-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isPass && onViewAnalysis && (
                            <button
                              onClick={() => onViewAnalysis(intObj.sk)}
                              className={`text-[10px] uppercase font-bold transition-colors px-2 py-1.5 rounded border bg-surface-50 text-surface-600 border-surface-200 hover:bg-surface-100 hover:text-surface-900 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-700`}
                            >
                              Analyze
                            </button>
                          )}
                          <button
                            onClick={() => onViewAgentDetails(intObj.sk)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="View Agent Details"
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
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
