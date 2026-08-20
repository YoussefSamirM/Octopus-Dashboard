import { useState } from "react";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { Search, Clock, Users, Calendar, Target, CheckCircle, UserCircle, ShieldAlert } from "lucide-react";
interface ICAgentDetailsViewProps {
  iso: string;
  lobId: string;
  sk: number;
}
const LOBs = [
  { id: "Combined", title: "Combined" },
  { id: "TPro", title: "T-Pro" },
  { id: "GHC", title: "GHC" },
  { id: "TMart-FU", title: "T-Mart Follow Up" },
];
export default function ICAgentDetailsView({
  iso,
  lobId,
  sk,
}: ICAgentDetailsViewProps) {
  const { globalProcessedData, currentShiftMode, rawStatusParsed, agentInfo } =
    useInvoiceStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [tlFilter, setTlFilter] = useState("");
  const [osvFilter, setOsvFilter] = useState("");
  const dayData = globalProcessedData[iso]?.[currentShiftMode];
  const lobData = dayData?.[lobId];
  if (!lobData) return null;
  const intObj = lobData.intervals.find((x: any) => x.sk === sk);
  if (!intObj) return null;
  let hR = Math.floor(sk / 60),
    mR = sk % 60;
  let lbl = `${hR}:${mR === 0 ? "00" : "30"}`;
  const intStartMs = new Date(iso + "T00:00:00").getTime() + sk * 60000;
  const intEndMs = intStartMs + 30 * 60000;
  const agentsOnline: Record<string, any> = {};
  rawStatusParsed.forEach((log) => {
    if (log.end <= intStartMs || log.start >= intEndMs) return;
    let info = agentInfo[log.email] || {
      hr: "-",
      name: log.email,
      tl: "-",
      osv: "-",
      lobs: {},
    };
    let effLob = info.lobs[iso] || "Unknown LOB";
    if (effLob === lobId) {
      let overlapStart = Math.max(log.start, intStartMs);
      let overlapEnd = Math.min(log.end, intEndMs);
      let durMs = overlapEnd - overlapStart;
      if (durMs > 0) {
        if (agentsOnline[log.email]) {
          agentsOnline[log.email].durMs += durMs;
        } else {
          agentsOnline[log.email] = {
            email: log.email,
            hr: info.hr,
            name: info.name,
            tl: info.tl,
            osv: info.osv,
            durMs,
          };
        }
      }
    }
  });
  const agentList = Object.values(agentsOnline).sort(
    (a, b) => b.durMs - a.durMs,
  );
  const tls = Array.from(
    new Set(agentList.filter(a => osvFilter === "" || a.osv === osvFilter).map((a) => a.tl).filter((x) => x && x !== "-")),
  ).sort();
  const osvs = Array.from(
    new Set(agentList.filter(a => tlFilter === "" || a.tl === tlFilter).map((a) => a.osv).filter((x) => x && x !== "-")),
  ).sort();
  const filteredAgents = agentList.filter((a) => {
    const matchQ = (a.name + " " + a.email + " " + a.hr)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchTl = tlFilter === "" || a.tl === tlFilter;
    const matchOsv = osvFilter === "" || a.osv === osvFilter;
    return matchQ && matchTl && matchOsv;
  });
  const formatTimeSecs = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return "0:00:00";
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = Math.round(totalSeconds % 60);
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };
  const formatTimeFromMs = (ms: number) => {
    if (ms <= 0) return "00:00";
    let totalSeconds = Math.round(ms / 1000);
    let m = Math.floor(totalSeconds / 60);
    let s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };
  const formatPerc = (val: number) => (val || 0).toFixed(2) + "%";
  const ic = intObj.req === 0 ? 100 : (intObj.act / intObj.req) * 100;
  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-[32px] gap-4">
        <div>
          <h2 className="text-[24px] font-[900] text-surface-900 mb-2">
            Interval Details
          </h2>
          <div className="flex items-center gap-2 text-surface-500 font-medium text-[14px]">
            <span>{LOBs.find((l) => l.id === lobId)?.title}</span>
            <span>•</span>
            <span>{iso}</span>
            <span>•</span>
            <span className="font-bold">{lbl}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px] mb-[32px]">
        <div className="bg-surface-0 border border-surface-200 rounded-[16px] p-[24px] flex flex-col gap-[12px] shadow-sm">
          <div className="flex justify-between items-center text-[12px] font-[700] text-surface-500 uppercase">
            <span>Interval REQ</span>
          </div>
          <div className="text-[28px] font-[900] text-surface-900">
            {formatTimeSecs(intObj.req)}
          </div>
        </div>

        <div className="bg-surface-0 border border-surface-200 rounded-[16px] p-[24px] flex flex-col gap-[12px] shadow-sm">
          <div className="flex justify-between items-center text-[12px] font-[700] text-surface-500 uppercase">
            <span>Interval Actual</span>
          </div>
          <div className="text-[28px] font-[900] text-surface-900">
            {formatTimeSecs(intObj.act)}
          </div>
        </div>

        <div className="bg-surface-0 border border-surface-200 rounded-[16px] p-[24px] flex flex-col gap-[12px] shadow-sm">
          <div className="flex justify-between items-center text-[12px] font-[700] text-surface-500 uppercase">
            <span>Agents Online</span>
          </div>
          <div className="text-[28px] font-[900] text-surface-900">
            {agentList.length}
          </div>
        </div>

        <div className="bg-surface-0 border border-surface-200 rounded-[16px] p-[24px] flex flex-col gap-[12px] shadow-sm">
          <div className="flex justify-between items-center text-[12px] font-[700] text-surface-500 uppercase">
            <span>Actual IC%</span>
          </div>
          <div
            className={`text-[28px] font-[900] ${ic >= 100 ? "text-success-600" : "text-danger-600"}`}
          >
            {formatPerc(ic)}
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-end gap-[16px] bg-surface-0 p-[20px] rounded-[16px] border border-surface-200 mb-[24px] shadow-sm">
        <div className="flex-[2] relative flex flex-col gap-[8px] w-full">
          <label className="text-[12px] font-[700] text-surface-500">
            Search Agent
          </label>
          <div className="relative">
            <Search className="absolute left-[16px] top-1/2 -translate-y-1/2 text-surface-400" size={16} />
            <input
              type="text"
              placeholder="Name, Email, or HR ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[48px] pl-[44px] pr-[16px] bg-surface-50/50 border border-surface-200 rounded-[10px] text-[14px] font-[500] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all placeholder:text-surface-400"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-[8px] w-full">
          <label className="text-[12px] font-[700] text-surface-500">
            Team Leader
          </label>
          <div className="relative">
            <UserCircle className="absolute left-[16px] top-1/2 -translate-y-1/2 text-surface-400" size={16} />
            <select
              value={tlFilter}
              onChange={(e) => setTlFilter(e.target.value)}
              className="w-full h-[48px] pl-[44px] pr-[16px] bg-surface-50/50 border border-surface-200 rounded-[10px] text-[14px] font-[500] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">All Team Leaders</option>
              {tls.map((t) => (
                <option key={t as string} value={t as string}>
                  {t as string}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-[8px] w-full">
          <label className="text-[12px] font-[700] text-surface-500">
            Supervisor (OSV)
          </label>
          <div className="relative">
            <ShieldAlert className="absolute left-[16px] top-1/2 -translate-y-1/2 text-surface-400" size={16} />
            <select
              value={osvFilter}
              onChange={(e) => setOsvFilter(e.target.value)}
              className="w-full h-[48px] pl-[44px] pr-[16px] bg-surface-50/50 border border-surface-200 rounded-[10px] text-[14px] font-[500] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">All Supervisors</option>
              {osvs.map((o) => (
                <option key={o as string} value={o as string}>
                  {o as string}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface-0 border border-surface-200 rounded-[16px] shadow-sm overflow-hidden mb-[40px]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead>
              <tr>
                <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 px-[24px] py-[16px] border-b border-surface-200">
                  HR ID
                </th>
                <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 px-[24px] py-[16px] border-b border-surface-200">
                  Name
                </th>
                <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 px-[24px] py-[16px] border-b border-surface-200">
                  Email
                </th>
                <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 px-[24px] py-[16px] border-b border-surface-200">
                  TL
                </th>
                <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 px-[24px] py-[16px] border-b border-surface-200">
                  SV
                </th>
                <th className="bg-surface-50/80 font-[700] text-[12px] text-surface-500 px-[24px] py-[16px] border-b border-surface-200 text-right">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-surface-500">
                    <Users className="mx-auto h-12 w-12 text-surface-300 mb-4" />
                    <p className="text-[15px] font-medium text-surface-600">No Agents found</p>
                    <p className="text-[13px] mt-1">Try adjusting your search filters.</p>
                  </td>
                </tr>
              ) : (
                filteredAgents.map((a) => (
                  <tr
                    key={a.email}
                    className="hover:bg-brand-50/30 transition-colors group"
                  >
                    <td className="px-[24px] py-[16px] text-[13px] text-surface-600 font-medium">
                      {a.hr}
                    </td>
                    <td className="px-[24px] py-[16px] text-[14px] text-surface-900 font-[600] group-hover:text-brand-700 transition-colors">
                      {a.name}
                    </td>
                    <td className="px-[24px] py-[16px] text-[13px] text-surface-600 font-medium">
                      {a.email}
                    </td>
                    <td className="px-[24px] py-[16px] text-[13px] text-surface-700 font-medium">
                      {a.tl}
                    </td>
                    <td className="px-[24px] py-[16px] text-[13px] text-surface-700 font-medium">
                      {a.osv}
                    </td>
                    <td className="px-[24px] py-[16px] text-right font-[700] text-[13px] text-surface-900">
                      {formatTimeFromMs(a.durMs)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
