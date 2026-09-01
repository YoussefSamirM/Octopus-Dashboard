import React, { useState, useMemo } from "react";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { 
  ArrowLeft, Search, X, CheckCircle2
} from "lucide-react";

interface ICAnalysisViewProps {
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

export default function ICAnalysisView({
  iso,
  lobId,
  sk,
}: ICAnalysisViewProps) {
  const { globalProcessedData, currentShiftMode, rawStatusParsed, agentInfo, setNavState } = useInvoiceStore();
  const [activeTab, setActiveTab] = useState<'all' | 'ooq' | 'unbreaks' | 'latebreaks' | 'unavail'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tlFilter, setTlFilter] = useState('');

  const dayData = globalProcessedData[iso]?.[currentShiftMode];
  const lobData = dayData?.[lobId];
  const intObj = lobData?.intervals?.find((x: any) => x.sk === sk);

  let hR = Math.floor(sk / 60);
  let mR = sk % 60;
  let lbl = `${hR}:${mR === 0 ? "00" : "30"}`;

  // Build exact interval local timestamps
  const [y, m, d] = iso.split('-').map(Number);
  const intStartMs = new Date(y, m - 1, d, hR, mR, 0).getTime();
  const intEndMs = intStartMs + 30 * 60 * 1000;

  // Extract and categorize all non-online activities overlapping this interval
  const { ooqList, unBreaksList, lateBreaksList, unavailList } = useMemo(() => {
    const ooq: any[] = [];
    const unbreaks: any[] = [];
    const latebreaks: any[] = [];
    const unavail: any[] = [];
    const seenKeys = new Set<string>();

    // 1. Process from rawStatusParsed
    if (rawStatusParsed && rawStatusParsed.length > 0) {
      rawStatusParsed.forEach((log: any) => {
        const statusUpper = String(log.status || '').toUpperCase().trim();
        
        // Skip pure online logs
        if (statusUpper === 'ONLINE' || (statusUpper.includes('ONLINE') && !statusUpper.includes('NON') && !statusUpper.includes('OFF'))) {
          return;
        }

        // Must overlap interval
        if (log.end <= intStartMs || log.start >= intEndMs) return;

        const cleanEmail = String(log.email || '').toLowerCase().trim();
        const info = agentInfo[cleanEmail] || { hr: "-", name: cleanEmail, tl: "-", osv: "-", lobs: {} };
        const effLob = info.lobs?.[iso] || "Unknown LOB";

        let isMatch = false;
        if (lobId === "ICView") {
          isMatch = effLob === "Combined" || effLob === "TPro";
        } else if (lobId === "Total") {
          isMatch = effLob !== "Unknown LOB";
        } else {
          isMatch = effLob === lobId;
        }

        if (isMatch) {
          const overlapStart = Math.max(log.start, intStartMs);
          const overlapEnd = Math.min(log.end, intEndMs);
          const durSecs = Math.round((overlapEnd - overlapStart) / 1000);

          if (durSecs > 0) {
            const key = `${cleanEmail}_${statusUpper}_${overlapStart}_${overlapEnd}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);

              const item = {
                email: cleanEmail,
                name: info.name || cleanEmail,
                hr: info.hr || "-",
                tl: info.tl || "-",
                osv: info.osv || "-",
                lob: effLob !== "Unknown LOB" ? effLob : lobId,
                type: log.status || statusUpper,
                startMs: log.start,
                endMs: log.end,
                overlapStart,
                overlapEnd,
                durSecs,
              };

              // Categorize
              const isUnavail = statusUpper.includes("UNAVAIL") || statusUpper.includes("OFFLINE") || statusUpper.includes("AWAY") || statusUpper.includes("LOGGED") || statusUpper.includes("LOG OFF");
              const isBrk = statusUpper.includes("BREAK") || statusUpper.includes("LUNCH");

              if (isUnavail) {
                unavail.push(item);
              } else if (isBrk) {
                if (log.start < intStartMs || statusUpper.includes("LATE")) {
                  latebreaks.push(item);
                } else {
                  unbreaks.push(item);
                }
              } else {
                ooq.push(item);
              }
            }
          }
        }
      });
    }

    // 2. Also merge any items from intObj.unactivities (from Breaks file or server pre-calc)
    if (intObj?.unactivities && intObj.unactivities.length > 0) {
      intObj.unactivities.forEach((u: any) => {
        const cleanEmail = String(u.email || '').toLowerCase().trim();
        const typeUpper = String(u.type || '').toUpperCase().trim();
        const start = u.startMs || intStartMs;
        const end = u.endMs || intEndMs;
        const key = `${cleanEmail}_${typeUpper}_${start}_${end}`;

        const info = agentInfo[cleanEmail] || agentInfo[u.email] || { hr: "-", name: u.name || cleanEmail, tl: "-", osv: "-", lobs: {} };
        const effLob = info.lobs?.[iso] || "Unknown LOB";

        let isMatch = false;
        if (lobId === "ICView") {
          isMatch = effLob === "Combined" || effLob === "TPro";
        } else if (lobId === "Total") {
          isMatch = effLob !== "Unknown LOB";
        } else {
          isMatch = effLob === lobId;
        }

        if (isMatch && !seenKeys.has(key)) {
          seenKeys.add(key);
          const item = {
            email: cleanEmail,
            name: info.name || u.name || cleanEmail,
            hr: info.hr || "-",
            tl: info.tl || "-",
            osv: info.osv || "-",
            lob: effLob !== "Unknown LOB" ? effLob : lobId,
            type: u.type,
            startMs: u.startMs,
            endMs: u.endMs,
            durSecs: u.durSecs || 0,
          };

          const isUnavail = typeUpper.includes("UNAVAIL") || typeUpper.includes("OFFLINE") || typeUpper.includes("AWAY") || typeUpper.includes("LOGGED");
          const isBrk = typeUpper.includes("BREAK") || typeUpper.includes("LUNCH");

          if (isUnavail) {
            unavail.push(item);
          } else if (isBrk) {
            if ((u.startMs && u.startMs < intStartMs) || typeUpper.includes("LATE")) {
              latebreaks.push(item);
            } else {
              unbreaks.push(item);
            }
          } else {
            ooq.push(item);
          }
        }
      });
    }

    return {
      ooqList: ooq,
      unBreaksList: unbreaks,
      lateBreaksList: latebreaks,
      unavailList: unavail,
    };
  }, [rawStatusParsed, intObj, intStartMs, intEndMs, iso, lobId, agentInfo]);

  const allActivities = useMemo(() => {
    return [...ooqList, ...unBreaksList, ...lateBreaksList, ...unavailList];
  }, [ooqList, unBreaksList, lateBreaksList, unavailList]);

  // Extract all unique Team Leaders
  const allTLs = useMemo(() => {
    const set = new Set<string>();
    allActivities.forEach((u: any) => {
      if (u.tl && u.tl !== '-') set.add(u.tl);
    });
    return Array.from(set).sort();
  }, [allActivities]);

  // Filter helper
  const filterList = (list: any[]) => {
    return list.filter((u: any) => {
      const matchesTL = !tlFilter || u.tl === tlFilter;
      if (!matchesTL) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.type || '').toLowerCase().includes(q) ||
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.hr || '').toLowerCase().includes(q) ||
        String(u.tl || '').toLowerCase().includes(q) ||
        String(u.osv || '').toLowerCase().includes(q)
      );
    });
  };

  const filteredOOQ = useMemo(() => filterList(ooqList), [ooqList, searchQuery, tlFilter]);
  const filteredUNBreaks = useMemo(() => filterList(unBreaksList), [unBreaksList, searchQuery, tlFilter]);
  const filteredLateBreaks = useMemo(() => filterList(lateBreaksList), [lateBreaksList, searchQuery, tlFilter]);
  const filteredUnavail = useMemo(() => filterList(unavailList), [unavailList, searchQuery, tlFilter]);

  const formatDur = (secs: number) => {
    if (!secs || secs <= 0) return "0:00:00";
    let h = Math.floor(secs / 3600);
    let m = Math.floor((secs % 3600) / 60);
    let s = Math.floor(secs % 60);
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatTimestamp = (ms: number | undefined, fallbackIso: string, fallbackSk: number) => {
    if (!ms || isNaN(ms)) {
      return `${fallbackIso}, ${Math.floor(fallbackSk / 60)}:${(fallbackSk % 60 === 0 ? '00' : '30')}`;
    }
    const d = new Date(ms);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${day} ${month}, ${year}, ${h}:${m}:${s}`;
  };

  // TOTALS COMPUTED STRICTLY FOR FILTERED USERS
  const filteredTotalOOQSecs = useMemo(() => filteredOOQ.reduce((sum, u) => sum + (u.durSecs || 0), 0), [filteredOOQ]);
  const filteredTotalUNBreaksSecs = useMemo(() => filteredUNBreaks.reduce((sum, u) => sum + (u.durSecs || 0), 0), [filteredUNBreaks]);
  const filteredTotalLateBreaksSecs = useMemo(() => filteredLateBreaks.reduce((sum, u) => sum + (u.durSecs || 0), 0), [filteredLateBreaks]);
  const filteredTotalUnavailSecs = useMemo(() => filteredUnavail.reduce((sum, u) => sum + (u.durSecs || 0), 0), [filteredUnavail]);

  const lobTitle = LOBs.find((l) => l.id === lobId)?.title || lobId;

  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <button
              onClick={() => setNavState({ view: "interval", lobId, date: iso })}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
              title="Back to Intervals"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-2xl font-semibold text-surface-900">
              Down Interval
            </h2>
          </div>
          <div className="flex items-center gap-2 text-surface-500 font-medium text-xs pl-9">
            <span>{lobTitle}</span>
            <span>•</span>
            <span>{iso}</span>
            <span>•</span>
            <span className="font-semibold text-surface-800 dark:text-surface-300">{lbl} (Down)</span>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        
        {/* Card 1: UN-OOQ */}
        <div 
          onClick={() => setActiveTab('ooq')}
          className={`card p-4 sm:p-5 flex flex-col gap-2 shadow-xs cursor-pointer transition-all ${
            activeTab === 'ooq' 
              ? 'ring-2 ring-surface-900 dark:ring-surface-100' 
              : 'hover:border-surface-300 dark:hover:border-surface-500'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-medium text-surface-500">
            <span>UN-OOQ Total</span>
            <span className="px-2 py-0.5 rounded bg-surface-100 text-surface-700 font-semibold text-xs">
              {filteredOOQ.length}
            </span>
          </div>
        </div>

        {/* Card 2: UN-Breaks */}
        <div 
          onClick={() => setActiveTab('unbreaks')}
          className={`card p-4 sm:p-5 flex flex-col gap-2 shadow-xs cursor-pointer transition-all ${
            activeTab === 'unbreaks' 
              ? 'ring-2 ring-surface-900 dark:ring-surface-100' 
              : 'hover:border-surface-300 dark:hover:border-surface-500'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-medium text-surface-500">
            <span>UN-Breaks Total</span>
            <span className="px-2 py-0.5 rounded bg-surface-100 text-surface-700 font-semibold text-xs">
              {filteredUNBreaks.length}
            </span>
          </div>
        </div>

        {/* Card 3: Late breaks */}
        <div 
          onClick={() => setActiveTab('latebreaks')}
          className={`card p-4 sm:p-5 flex flex-col gap-2 shadow-xs cursor-pointer transition-all ${
            activeTab === 'latebreaks' 
              ? 'ring-2 ring-surface-900 dark:ring-surface-100' 
              : 'hover:border-surface-300 dark:hover:border-surface-500'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-medium text-surface-500">
            <span>Late breaks Total</span>
            <span className="px-2 py-0.5 rounded bg-surface-100 text-surface-700 font-semibold text-xs">
              {filteredLateBreaks.length}
            </span>
          </div>
        </div>

        {/* Card 4: Unavailable */}
        <div 
          onClick={() => setActiveTab('unavail')}
          className={`card p-4 sm:p-5 flex flex-col gap-2 shadow-xs cursor-pointer transition-all ${
            activeTab === 'unavail' 
              ? 'ring-2 ring-surface-900 dark:ring-surface-100' 
              : 'hover:border-surface-300 dark:hover:border-surface-500'
          }`}
        >
          <div className="flex justify-between items-center text-xs font-medium text-surface-500">
            <span>Unavailable Total</span>
            <span className="px-2 py-0.5 rounded bg-surface-100 text-surface-700 font-semibold text-xs">
              {filteredUnavail.length}
            </span>
          </div>
        </div>

      </div>

      {/* Filter and Tab Hub */}
      <div className="card p-4 mb-5 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
        
        {/* Tab Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-surface-900 text-surface-0 shadow-xs'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            All Activities ({allActivities.length})
          </button>
          <button
            onClick={() => setActiveTab('ooq')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'ooq'
                ? 'bg-[#4d4d8a] text-white shadow-xs'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            UN-OOQ ({filteredOOQ.length})
          </button>
          <button
            onClick={() => setActiveTab('unbreaks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'unbreaks'
                ? 'bg-[#4d4d8a] text-white shadow-xs'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            UN-Breaks ({filteredUNBreaks.length})
          </button>
          <button
            onClick={() => setActiveTab('latebreaks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'latebreaks'
                ? 'bg-[#4d4d8a] text-white shadow-xs'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            Late breaks ({filteredLateBreaks.length})
          </button>
          <button
            onClick={() => setActiveTab('unavail')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'unavail'
                ? 'bg-[#4d4d8a] text-white shadow-xs'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            Unavailable ({filteredUnavail.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          {allTLs.length > 1 && (
            <select
              value={tlFilter}
              onChange={(e) => setTlFilter(e.target.value)}
              className="select text-xs w-full sm:w-44 py-1.5"
            >
              <option value="">All Team Leaders</option>
              {allTLs.map((tl, i) => (
                <option key={i} value={tl}>{tl}</option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" size={14} />
            <input
              type="text"
              placeholder="Search agent, HR, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-8 pr-7 text-xs w-full py-1.5"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="space-y-6">
        
        {/* Table 1: UN-OOQ */}
        {(activeTab === 'all' || activeTab === 'ooq') && (
          <div className="card overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-surface-800"></div>
                <h3 className="text-xs font-semibold text-surface-900 uppercase tracking-wider">
                  UN-OOQ
                </h3>
                <span className="text-2xs text-surface-500 font-medium">({filteredOOQ.length})</span>
              </div>
              <span className="text-xs font-medium text-surface-700">
                Total Aux: <span className="font-semibold text-surface-800 dark:text-[#a594fd]">{formatDur(filteredTotalOOQSecs)}</span>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#4d4d8a] text-white">
                    <th className="font-semibold p-3">HR ID</th>
                    <th className="font-semibold p-3">Email</th>
                    <th className="font-semibold p-3">Team leader</th>
                    <th className="font-semibold p-3">SPV</th>
                    <th className="font-semibold p-3">LOB</th>
                    <th className="font-semibold p-3">Status</th>
                    <th className="font-semibold p-3">Start</th>
                    <th className="font-semibold p-3">End</th>
                    <th className="font-semibold p-3 text-right">Aux Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 bg-surface-0">
                  {filteredOOQ.length > 0 ? (
                    filteredOOQ.map((u: any, idx: number) => {
                      return (
                        <tr key={idx} className="hover:bg-surface-50/50 transition-colors">
                          <td className="p-3 font-semibold text-surface-600">
                            {u.hr}
                          </td>
                          <td className="p-3 font-semibold text-brand-600 dark:text-brand-400">
                            {u.email}
                          </td>
                          <td className="p-3 text-surface-700">
                            {u.tl}
                          </td>
                          <td className="p-3 text-surface-700">
                            {u.osv}
                          </td>
                          <td className="p-3 text-surface-700">
                            {u.lob}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-surface-800/10 text-surface-800 dark:text-[#cbbefd]">
                              {String(u.type).toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-surface-700">
                            {formatTimestamp(u.startMs, iso, sk)}
                          </td>
                          <td className="p-3 text-surface-700">
                            {u.endMs ? formatTimestamp(u.endMs, iso, sk) : '—'}
                          </td>
                          <td className="p-3 text-right font-semibold text-surface-900">
                            {formatDur(u.durSecs)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-surface-400">
                        No unauthorized OOQ activities matching your filters.
                      </td>
                    </tr>
                  )}
                  {filteredOOQ.length > 0 && (
                    <tr className="bg-surface-50 font-bold border-t-2 border-surface-200">
                      <td colSpan={8} className="p-3 text-right text-surface-700">
                        Total Aux:
                      </td>
                      <td className="p-3 text-right text-surface-900">
                        {formatDur(filteredTotalOOQSecs)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Table 2: UN-Breaks */}
        {(activeTab === 'all' || activeTab === 'unbreaks') && (
          <div className="card overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-surface-800"></div>
                <h3 className="text-xs font-semibold text-surface-900 uppercase tracking-wider">
                  UN-Breaks
                </h3>
                <span className="text-2xs text-surface-500 font-medium">({filteredUNBreaks.length})</span>
              </div>
              <span className="text-xs font-medium text-surface-700">
                Total Lost: <span className="font-semibold text-surface-800 dark:text-surface-300">{formatDur(filteredTotalUNBreaksSecs)}</span>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#4d4d8a] text-white">
                    <th className="font-semibold p-3">Agent Email</th>
                    <th className="font-semibold p-3 text-center">Status</th>
                    <th className="font-semibold p-3">Start</th>
                    <th className="font-semibold p-3">End</th>
                    <th className="font-semibold p-3 text-right">Total Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 bg-surface-0">
                  {filteredUNBreaks.length > 0 ? (
                    filteredUNBreaks.map((u: any, idx: number) => {
                      return (
                        <React.Fragment key={idx}>
                          <tr className="hover:bg-surface-50/50">
                            <td className="p-3 font-semibold text-surface-900">
                              {u.email}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-surface-800/10 text-surface-800 dark:text-[#7dd3fc]">
                                {String(u.type).toUpperCase().replace(/\s+/g, "_")}
                              </span>
                            </td>
                            <td className="p-3 text-surface-700">
                              {formatTimestamp(u.startMs, iso, sk)}
                            </td>
                            <td className="p-3 text-surface-700">
                              {u.endMs ? formatTimestamp(u.endMs, iso, sk) : '—'}
                            </td>
                            <td className="p-3 text-right font-semibold text-surface-900 align-middle border-l border-surface-200">
                              {formatDur(u.durSecs)}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-surface-400">
                        No unauthorized breaks matching your filters.
                      </td>
                    </tr>
                  )}
                  {filteredUNBreaks.length > 0 && (
                    <tr className="bg-surface-50 font-bold border-t-2 border-surface-200">
                      <td colSpan={4} className="p-3 text-right text-surface-700">
                        Total Lost Hours:
                      </td>
                      <td className="p-3 text-right text-surface-900">
                        {formatDur(filteredTotalUNBreaksSecs)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Table 3: Late breaks */}
        {(activeTab === 'all' || activeTab === 'latebreaks') && (
          <div className="card overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-surface-800"></div>
                <h3 className="text-xs font-semibold text-surface-900 uppercase tracking-wider">
                  Late breaks
                </h3>
                <span className="text-2xs text-surface-500 font-medium">({filteredLateBreaks.length})</span>
              </div>
              <span className="text-xs font-medium text-surface-700">
                Total Lost: <span className="font-semibold text-surface-800 dark:text-surface-300">{formatDur(filteredTotalLateBreaksSecs)}</span>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#4d4d8a] text-white">
                    <th className="font-semibold p-3">Agent Email</th>
                    <th className="font-semibold p-3 text-center">Status</th>
                    <th className="font-semibold p-3">Start</th>
                    <th className="font-semibold p-3">End</th>
                    <th className="font-semibold p-3 text-right">Total Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 bg-surface-0">
                  {filteredLateBreaks.length > 0 ? (
                    filteredLateBreaks.map((u: any, idx: number) => {
                      return (
                        <React.Fragment key={idx}>
                          <tr className="hover:bg-surface-50/50">
                            <td className="p-3 font-semibold text-surface-900">
                              {u.email}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-surface-800/10 text-surface-800 dark:text-[#a5f3fc]">
                                {String(u.type).toUpperCase().replace(/\s+/g, "_")}
                              </span>
                            </td>
                            <td className="p-3 text-surface-700">
                              {formatTimestamp(u.startMs, iso, sk)}
                            </td>
                            <td className="p-3 text-surface-700">
                              {u.endMs ? formatTimestamp(u.endMs, iso, sk) : '—'}
                            </td>
                            <td className="p-3 text-right font-semibold text-surface-900 align-middle border-l border-surface-200">
                              {formatDur(u.durSecs)}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-surface-400">
                        No late breaks matching your filters.
                      </td>
                    </tr>
                  )}
                  {filteredLateBreaks.length > 0 && (
                    <tr className="bg-surface-50 font-bold border-t-2 border-surface-200">
                      <td colSpan={4} className="p-3 text-right text-surface-700">
                        Total Lost Hours:
                      </td>
                      <td className="p-3 text-right text-surface-900">
                        {formatDur(filteredTotalLateBreaksSecs)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Table 4: Unavailable */}
        {(activeTab === 'all' || activeTab === 'unavail') && (
          <div className="card overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-surface-800"></div>
                <h3 className="text-xs font-semibold text-surface-900 uppercase tracking-wider">
                  Unavailable
                </h3>
                <span className="text-2xs text-surface-500 font-medium">({filteredUnavail.length})</span>
              </div>
              <span className="text-xs font-medium text-surface-700">
                Total Lost: <span className="font-semibold text-surface-800 dark:text-surface-300">{formatDur(filteredTotalUnavailSecs)}</span>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#4d4d8a] text-white">
                    <th className="font-semibold p-3">Agent Email</th>
                    <th className="font-semibold p-3 text-center">Status</th>
                    <th className="font-semibold p-3">Start</th>
                    <th className="font-semibold p-3">End</th>
                    <th className="font-semibold p-3 text-right">Total Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 bg-surface-0">
                  {filteredUnavail.length > 0 ? (
                    filteredUnavail.map((u: any, idx: number) => {
                      return (
                        <React.Fragment key={idx}>
                          <tr className="hover:bg-surface-50/50">
                            <td className="p-3 font-semibold text-surface-900">
                              {u.email}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-danger-100 text-danger-700 dark:bg-danger-950/40 dark:text-surface-300">
                                {String(u.type).toUpperCase().replace(/\s+/g, "_")}
                              </span>
                            </td>
                            <td className="p-3 text-surface-700">
                              {formatTimestamp(u.startMs, iso, sk)}
                            </td>
                            <td className="p-3 text-surface-700">
                              {u.endMs ? formatTimestamp(u.endMs, iso, sk) : '—'}
                            </td>
                            <td className="p-3 text-right font-semibold text-surface-900 align-middle border-l border-surface-200">
                              {formatDur(u.durSecs)}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-surface-400">
                        No unavailable/offline agents matching your filters.
                      </td>
                    </tr>
                  )}
                  {filteredUnavail.length > 0 && (
                    <tr className="bg-surface-50 font-bold border-t-2 border-surface-200">
                      <td colSpan={4} className="p-3 text-right text-surface-700">
                        Total Lost Hours:
                      </td>
                      <td className="p-3 text-right text-surface-900">
                        {formatDur(filteredTotalUnavailSecs)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state when zero activities exist */}
        {allActivities.length === 0 && (
          <div className="card p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-success-50 text-success-600 flex items-center justify-center mx-auto mb-2.5">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-sm font-semibold text-surface-900">
              No Unauthorized Activities Detected
            </h3>
            <div className="text-xs text-surface-500 mt-1 max-w-md mx-auto">
              No break overages, lunches, or non-approved OOQ activities overlapped during this interval window.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}




