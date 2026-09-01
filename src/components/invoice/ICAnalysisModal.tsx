import React, { useState, useMemo, useEffect } from "react";
import { 
  X, ArrowLeft, Clock, ShieldAlert, AlertTriangle, User, Search, Filter, 
  CheckCircle2, TrendingDown, Users, Coffee, UserX, HelpCircle, Activity, 
  Copy, Check, Download, FileSpreadsheet, Sparkles, ExternalLink
} from "lucide-react";
import * as XLSX from "xlsx";

interface ICAnalysisModalProps {
  intObj: any;
  iso: string;
  lobId: string;
  agentInfo: Record<string, any>;
  onClose: () => void;
}

const LOBs = [
  { id: "Combined", title: "Combined" },
  { id: "TPro", title: "T-Pro" },
  { id: "GHC", title: "GHC" },
  { id: "TMart-FU", title: "T-Mart Follow Up" },
];

export default function ICAnalysisModal({
  intObj,
  iso,
  lobId,
  agentInfo,
  onClose,
}: ICAnalysisModalProps) {
  if (!intObj) return null;

  const [activeTab, setActiveTab] = useState<'all' | 'ooq' | 'unbreaks' | 'latebreaks' | 'unavail'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tlFilter, setTlFilter] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const unacts = useMemo(() => {
    const raw = intObj?.unactivities || [];
    return raw.filter((u: any) => {
      const cleanEmail = String(u.email || '').toLowerCase().trim();
      const info = agentInfo[cleanEmail] || agentInfo[u.email] || {};
      const effLob = info.lobs?.[iso] || "Unknown LOB";
      if (lobId === "ICView") {
        return effLob === "Combined" || effLob === "TPro";
      } else if (lobId === "Total") {
        return effLob !== "Unknown LOB";
      } else {
        return effLob === lobId;
      }
    });
  }, [intObj, agentInfo, iso, lobId]);

  const intStartMs = new Date(iso + "T00:00:00").getTime() + (intObj.sk * 60 * 1000);
  const intEndMs = intStartMs + 30 * 60 * 1000;
  
  // Categorization helpers
  const isUnavailable = (type: string) => {
    const t = String(type || '').toLowerCase().trim();
    return t.includes("unavail") || t.includes("offline") || t.includes("away") || t.includes("logged off") || t.includes("log off");
  };

  const isLateBreak = (u: any) => {
    const t = String(u.type || '').toLowerCase().trim();
    if (isUnavailable(u.type)) return false;
    const isBrk = t.includes("break") || t.includes("lunch");
    // If break started prior to interval timeline (spillover) or explicitly late
    return isBrk && (t.includes("late") || (u.startMs && u.startMs < intStartMs));
  };

  const isUNBreak = (u: any) => {
    const t = String(u.type || '').toLowerCase().trim();
    if (isUnavailable(u.type)) return false;
    const isBrk = t.includes("break") || t.includes("lunch");
    return isBrk && !isLateBreak(u);
  };

  const isUNOOQ = (u: any) => {
    return !isUNBreak(u) && !isLateBreak(u) && !isUnavailable(u.type);
  };

  // Grouped lists
  const ooqUnacts = useMemo(() => unacts.filter((u: any) => isUNOOQ(u)), [unacts, intStartMs]);
  const unBreaksUnacts = useMemo(() => unacts.filter((u: any) => isUNBreak(u)), [unacts, intStartMs]);
  const lateBreaksUnacts = useMemo(() => unacts.filter((u: any) => isLateBreak(u)), [unacts, intStartMs]);
  const unavailUnacts = useMemo(() => unacts.filter((u: any) => isUnavailable(u.type)), [unacts]);

  // Extract all unique Team Leaders for filter
  const allTLs = useMemo(() => {
    const set = new Set<string>();
    unacts.forEach((u: any) => {
      const info = agentInfo[u.email?.toLowerCase()] || agentInfo[u.email] || {};
      if (info.tl && info.tl !== '-') set.add(info.tl);
    });
    return Array.from(set).sort();
  }, [unacts, agentInfo]);

  // Filter helper
  const filterList = (list: any[]) => {
    return list.filter((u: any) => {
      const info = agentInfo[u.email?.toLowerCase()] || agentInfo[u.email] || {};
      const matchesTL = !tlFilter || info.tl === tlFilter;
      if (!matchesTL) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.type || '').toLowerCase().includes(q) ||
        String(info.name || '').toLowerCase().includes(q) ||
        String(info.hr || '').toLowerCase().includes(q) ||
        String(info.tl || '').toLowerCase().includes(q) ||
        String(info.osv || '').toLowerCase().includes(q)
      );
    });
  };

  const filteredOOQ = useMemo(() => filterList(ooqUnacts), [ooqUnacts, searchQuery, tlFilter, agentInfo]);
  const filteredUNBreaks = useMemo(() => filterList(unBreaksUnacts), [unBreaksUnacts, searchQuery, tlFilter, agentInfo]);
  const filteredLateBreaks = useMemo(() => filterList(lateBreaksUnacts), [lateBreaksUnacts, searchQuery, tlFilter, agentInfo]);
  const filteredUnavail = useMemo(() => filterList(unavailUnacts), [unavailUnacts, searchQuery, tlFilter, agentInfo]);

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

  const totalOOQSecs = ooqUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalUNBreaksSecs = unBreaksUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalLateBreaksSecs = lateBreaksUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalUnavailSecs = unavailUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalAllLostSecs = totalOOQSecs + totalUNBreaksSecs + totalLateBreaksSecs + totalUnavailSecs;
  
  const lobTitle = LOBs.find((l) => l.id === lobId)?.title || lobId;
  const shortageSecs = Math.max(0, intObj.req - intObj.bill);

  // Copy Markdown Summary
  const handleCopySummary = () => {
    let md = `### Down Interval Analysis: ${lobTitle} (${intObj.label} - ${iso})\n`;
    md += `- **Requirement:** ${formatDur(intObj.req)}\n`;
    md += `- **Actual Logged:** ${formatDur(intObj.act)}\n`;
    md += `- **Total Lost Time:** ${formatDur(shortageSecs > 0 ? shortageSecs : totalAllLostSecs)}\n\n`;

    if (ooqUnacts.length > 0) {
      md += `#### UN-OOQ (Total: ${formatDur(totalOOQSecs)})\n`;
      md += `| HR ID | Email | Team Leader | SPV | Status | Aux Duration |\n|---|---|---|---|---|---|\n`;
      ooqUnacts.forEach((u: any) => {
        const info = agentInfo[u.email?.toLowerCase()] || {};
        md += `| ${info.hr || '-'} | ${u.email} | ${info.tl || '-'} | ${info.osv || '-'} | ${u.type} | ${formatDur(u.durSecs)} |\n`;
      });
      md += `\n`;
    }

    if (lateBreaksUnacts.length > 0) {
      md += `#### Late breaks (Total: ${formatDur(totalLateBreaksSecs)})\n`;
      md += `| Agent Email | Status | Date | Total Duration |\n|---|---|---|---|\n`;
      lateBreaksUnacts.forEach((u: any) => {
        md += `| ${u.email} | ${u.type} | ${formatTimestamp(u.startMs, iso, intObj.sk)} | ${formatDur(u.durSecs)} |\n`;
        if (u.endMs) {
          md += `| ${u.email} | ONLINE | ${formatTimestamp(u.endMs, iso, intObj.sk)} | |\n`;
        }
      });
      md += `\n`;
    }

    if (unBreaksUnacts.length > 0) {
      md += `#### UN-Breaks (Total: ${formatDur(totalUNBreaksSecs)})\n`;
      md += `| Agent Email | Status | Date | Total Duration |\n|---|---|---|---|\n`;
      unBreaksUnacts.forEach((u: any) => {
        md += `| ${u.email} | ${u.type} | ${formatTimestamp(u.startMs, iso, intObj.sk)} | ${formatDur(u.durSecs)} |\n`;
        if (u.endMs) {
          md += `| ${u.email} | ONLINE | ${formatTimestamp(u.endMs, iso, intObj.sk)} | |\n`;
        }
      });
      md += `\n`;
    }

    if (unavailUnacts.length > 0) {
      md += `#### Unavailable (Total: ${formatDur(totalUnavailSecs)})\n`;
      md += `| Agent Email | Status | Date | Total Duration |\n|---|---|---|---|\n`;
      unavailUnacts.forEach((u: any) => {
        md += `| ${u.email} | ${u.type} | ${formatTimestamp(u.startMs, iso, intObj.sk)} | ${formatDur(u.durSecs)} |\n`;
        if (u.endMs) {
          md += `| ${u.email} | ONLINE | ${formatTimestamp(u.endMs, iso, intObj.sk)} | |\n`;
        }
      });
      md += `\n`;
    }

    navigator.clipboard.writeText(md);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (ooqUnacts.length > 0) {
      const dataOOQ = ooqUnacts.map((u: any) => {
        const info = agentInfo[u.email?.toLowerCase()] || {};
        return {
          "HR ID": info.hr || "-",
          "Email": u.email,
          "Team Leader": info.tl || "-",
          "SPV": info.osv || "-",
          "LOB": info.lobs?.[iso] || lobTitle,
          "Status": u.type,
          "Aux Duration": formatDur(u.durSecs),
        };
      });
      const wsOOQ = XLSX.utils.json_to_sheet(dataOOQ);
      XLSX.utils.book_append_sheet(wb, wsOOQ, "UN-OOQ");
    }

    if (lateBreaksUnacts.length > 0) {
      const dataLate: any[] = [];
      lateBreaksUnacts.forEach((u: any) => {
        dataLate.push({
          "Agent Email": u.email,
          "Status": u.type,
          "Date": formatTimestamp(u.startMs, iso, intObj.sk),
          "Total Duration": formatDur(u.durSecs),
        });
        if (u.endMs) {
          dataLate.push({
            "Agent Email": u.email,
            "Status": "ONLINE",
            "Date": formatTimestamp(u.endMs, iso, intObj.sk),
            "Total Duration": "",
          });
        }
      });
      const wsLate = XLSX.utils.json_to_sheet(dataLate);
      XLSX.utils.book_append_sheet(wb, wsLate, "Late Breaks");
    }

    if (unBreaksUnacts.length > 0) {
      const dataUNB: any[] = [];
      unBreaksUnacts.forEach((u: any) => {
        dataUNB.push({
          "Agent Email": u.email,
          "Status": u.type,
          "Date": formatTimestamp(u.startMs, iso, intObj.sk),
          "Total Duration": formatDur(u.durSecs),
        });
        if (u.endMs) {
          dataUNB.push({
            "Agent Email": u.email,
            "Status": "ONLINE",
            "Date": formatTimestamp(u.endMs, iso, intObj.sk),
            "Total Duration": "",
          });
        }
      });
      const wsUNB = XLSX.utils.json_to_sheet(dataUNB);
      XLSX.utils.book_append_sheet(wb, wsUNB, "UN-Breaks");
    }

    if (unavailUnacts.length > 0) {
      const dataUnav: any[] = [];
      unavailUnacts.forEach((u: any) => {
        dataUnav.push({
          "Agent Email": u.email,
          "Status": u.type,
          "Date": formatTimestamp(u.startMs, iso, intObj.sk),
          "Total Duration": formatDur(u.durSecs),
        });
        if (u.endMs) {
          dataUnav.push({
            "Agent Email": u.email,
            "Status": "ONLINE",
            "Date": formatTimestamp(u.endMs, iso, intObj.sk),
            "Total Duration": "",
          });
        }
      });
      const wsUnav = XLSX.utils.json_to_sheet(dataUnav);
      XLSX.utils.book_append_sheet(wb, wsUnav, "Unavailable");
    }

    XLSX.writeFile(wb, `Interval_Analysis_${lobId}_${iso}_${intObj.label.replace(':', '')}.xlsx`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-5xl bg-surface-0 dark:bg-[#16181f] border border-surface-200 dark:border-surface-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header Hero */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-50/90 dark:bg-[#252836]/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-danger-50 dark:bg-danger-950/50 border border-danger-200 dark:border-danger-900/60 flex items-center justify-center text-surface-800 dark:text-surface-300 shadow-sm">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white">
                  Down Interval Root Cause Analysis
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800/60 ">
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

  const totalOOQSecs = ooqUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalUNBreaksSecs = unBreaksUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalLateBreaksSecs = lateBreaksUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalUnavailSecs = unavailUnacts.reduce((sum: number, u: any) => sum + (u.durSecs || 0), 0);
  const totalAllLostSecs = totalOOQSecs + totalUNBreaksSecs + totalLateBreaksSecs + totalUnavailSecs;
  
  const lobTitle = LOBs.find((l) => l.id === lobId)?.title || lobId;
  const shortageSecs = Math.max(0, intObj.req - intObj.bill);

  // Copy Markdown Summary
  const handleCopySummary = () => {
    let md = `### Down Interval Analysis: ${lobTitle} (${intObj.label} - ${iso})\n`;
    md += `- **Requirement:** ${formatDur(intObj.req)}\n`;
    md += `- **Actual Logged:** ${formatDur(intObj.act)}\n`;
    md += `- **Total Lost Time:** ${formatDur(shortageSecs > 0 ? shortageSecs : totalAllLostSecs)}\n\n`;

    if (ooqUnacts.length > 0) {
      md += `#### UN-OOQ (Total: ${formatDur(totalOOQSecs)})\n`;
      md += `| HR ID | Email | Team Leader | SPV | Status | Aux Duration |\n|---|---|---|---|---|---|\n`;
      ooqUnacts.forEach((u: any) => {
        const info = agentInfo[u.email?.toLowerCase()] || {};
        md += `| ${info.hr || '-'} | ${u.email} | ${info.tl || '-'} | ${info.osv || '-'} | ${u.type} | ${formatDur(u.durSecs)} |\n`;
      });
      md += `\n`;
    }

    if (lateBreaksUnacts.length > 0) {
      md += `#### Late breaks (Total: ${formatDur(totalLateBreaksSecs)})\n`;
      md += `| Agent Email | Status | Date | Total Duration |\n|---|---|---|---|\n`;
      lateBreaksUnacts.forEach((u: any) => {
        md += `| ${u.email} | ${u.type} | ${formatTimestamp(u.startMs, iso, intObj.sk)} | ${formatDur(u.durSecs)} |\n`;
        if (u.endMs) {
          md += `| ${u.email} | ONLINE | ${formatTimestamp(u.endMs, iso, intObj.sk)} | |\n`;
        }
      });
      md += `\n`;
    }

    if (unBreaksUnacts.length > 0) {
      md += `#### UN-Breaks (Total: ${formatDur(totalUNBreaksSecs)})\n`;
      md += `| Agent Email | Status | Date | Total Duration |\n|---|---|---|---|\n`;
      unBreaksUnacts.forEach((u: any) => {
        md += `| ${u.email} | ${u.type} | ${formatTimestamp(u.startMs, iso, intObj.sk)} | ${formatDur(u.durSecs)} |\n`;
        if (u.endMs) {
          md += `| ${u.email} | ONLINE | ${formatTimestamp(u.endMs, iso, intObj.sk)} | |\n`;
        }
      });
      md += `\n`;
    }

    if (unavailUnacts.length > 0) {
      md += `#### Unavailable (Total: ${formatDur(totalUnavailSecs)})\n`;
      md += `| Agent Email | Status | Date | Total Duration |\n|---|---|---|---|\n`;
      unavailUnacts.forEach((u: any) => {
        md += `| ${u.email} | ${u.type} | ${formatTimestamp(u.startMs, iso, intObj.sk)} | ${formatDur(u.durSecs)} |\n`;
        if (u.endMs) {
          md += `| ${u.email} | ONLINE | ${formatTimestamp(u.endMs, iso, intObj.sk)} | |\n`;
        }
      });
      md += `\n`;
    }

    navigator.clipboard.writeText(md);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (ooqUnacts.length > 0) {
      const dataOOQ = ooqUnacts.map((u: any) => {
        const info = agentInfo[u.email?.toLowerCase()] || {};
        return {
          "HR ID": info.hr || "-",
          "Email": u.email,
          "Team Leader": info.tl || "-",
          "SPV": info.osv || "-",
          "LOB": info.lobs?.[iso] || lobTitle,
          "Status": u.type,
          "Aux Duration": formatDur(u.durSecs),
        };
      });
      const wsOOQ = XLSX.utils.json_to_sheet(dataOOQ);
      XLSX.utils.book_append_sheet(wb, wsOOQ, "UN-OOQ");
    }

    if (lateBreaksUnacts.length > 0) {
      const dataLate: any[] = [];
      lateBreaksUnacts.forEach((u: any) => {
        dataLate.push({
          "Agent Email": u.email,
          "Status": u.type,
          "Date": formatTimestamp(u.startMs, iso, intObj.sk),
          "Total Duration": formatDur(u.durSecs),
        });
        if (u.endMs) {
          dataLate.push({
            "Agent Email": u.email,
            "Status": "ONLINE",
            "Date": formatTimestamp(u.endMs, iso, intObj.sk),
            "Total Duration": "",
          });
        }
      });
      const wsLate = XLSX.utils.json_to_sheet(dataLate);
      XLSX.utils.book_append_sheet(wb, wsLate, "Late Breaks");
    }

    if (unBreaksUnacts.length > 0) {
      const dataUNB: any[] = [];
      unBreaksUnacts.forEach((u: any) => {
        dataUNB.push({
          "Agent Email": u.email,
          "Status": u.type,
          "Date": formatTimestamp(u.startMs, iso, intObj.sk),
          "Total Duration": formatDur(u.durSecs),
        });
        if (u.endMs) {
          dataUNB.push({
            "Agent Email": u.email,
            "Status": "ONLINE",
            "Date": formatTimestamp(u.endMs, iso, intObj.sk),
            "Total Duration": "",
          });
        }
      });
      const wsUNB = XLSX.utils.json_to_sheet(dataUNB);
      XLSX.utils.book_append_sheet(wb, wsUNB, "UN-Breaks");
    }

    if (unavailUnacts.length > 0) {
      const dataUnav: any[] = [];
      unavailUnacts.forEach((u: any) => {
        dataUnav.push({
          "Agent Email": u.email,
          "Status": u.type,
          "Date": formatTimestamp(u.startMs, iso, intObj.sk),
          "Total Duration": formatDur(u.durSecs),
        });
        if (u.endMs) {
          dataUnav.push({
            "Agent Email": u.email,
            "Status": "ONLINE",
            "Date": formatTimestamp(u.endMs, iso, intObj.sk),
            "Total Duration": "",
          });
        }
      });
      const wsUnav = XLSX.utils.json_to_sheet(dataUnav);
      XLSX.utils.book_append_sheet(wb, wsUnav, "Unavailable");
    }

    XLSX.writeFile(wb, `Interval_Analysis_${lobId}_${iso}_${intObj.label.replace(':', '')}.xlsx`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-5xl bg-surface-0 dark:bg-[#16181f] border border-surface-200 dark:border-surface-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header Hero */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-50/90 dark:bg-[#252836]/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-danger-50 dark:bg-danger-950/50 border border-danger-200 dark:border-danger-900/60 flex items-center justify-center text-surface-800 dark:text-surface-300 shadow-sm">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white">
                  Down Interval Root Cause Analysis
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800/60 ">
                  {intObj.label} • {iso}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60">
                  {lobTitle}
                </span>
              </div>
              <div className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 flex items-center gap-2">
                <span>REQ: <strong className="text-surface-800 dark:text-surface-200 ">{formatDur(intObj.req)}</strong></span>
                <span>•</span>
                <span>Actual: <strong className="text-surface-800 dark:text-surface-200 ">{formatDur(intObj.act)}</strong></span>
                <span>•</span>
                <span>Shortage: <strong className="text-surface-800 dark:text-surface-300 ">-{formatDur(shortageSecs > 0 ? shortageSecs : totalAllLostSecs)}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition-colors shadow-sm"
              title="Export tables to Excel"
            >
              <FileSpreadsheet size={14} />
              <span>Export</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200/60 dark:hover:bg-surface-700 transition-colors ml-1"
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

                {/* Dynamic Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 px-6 py-3.5 border-b border-surface-100 dark:border-surface-800 bg-surface-0 dark:bg-[#16181f]">
          
          {/* Card 1: UN-OOQ */}
          <div 
            onClick={() => setActiveTab('ooq')}
            className={cursor-pointer p-3 rounded-xl border transition-all }
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#4d4d8a] dark:text-[#cda4ff] uppercase tracking-wider">UN-OOQ</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#4d4d8a]/20 text-[#4d4d8a] dark:text-[#cda4ff]">
                {ooqUnacts.length}
              </span>
            </div>
          </div>

          {/* Card 2: UN-Breaks */}
          <div 
            onClick={() => setActiveTab('unbreaks')}
            className={cursor-pointer p-3 rounded-xl border transition-all }
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#0284c7] dark:text-[#38bdf8] uppercase tracking-wider">UN-Breaks</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0284c7]/20 text-[#0284c7] dark:text-[#38bdf8]">
                {unBreaksUnacts.length}
              </span>
            </div>
          </div>

          {/* Card 3: Late breaks */}
          <div 
            onClick={() => setActiveTab('latebreaks')}
            className={cursor-pointer p-3 rounded-xl border transition-all }
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#1a6b8c] dark:text-[#67e8f9] uppercase tracking-wider">Late breaks</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1a6b8c]/20 text-[#1a6b8c] dark:text-[#67e8f9]">
                {lateBreaksUnacts.length}
              </span>
            </div>
          </div>

          {/* Card 4: Unavailable */}
          <div 
            onClick={() => setActiveTab('unavail')}
            className={cursor-pointer p-3 rounded-xl border transition-all }
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-danger-600 dark:text-danger-400 uppercase tracking-wider">Unavailable</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-500/20 text-danger-600 dark:text-danger-400">
                {unavailUnacts.length}
              </span>
            </div>
          </div>

        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 border-t border-surface-200 dark:border-surface-800 bg-surface-50/90 dark:bg-[#252836]/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <span className="font-semibold text-surface-700 dark:text-surface-300">Shortcut:</span>
            <kbd className="px-2 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-[10px] font-bold ">Esc</kbd>
            <span>to close</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface-900 dark:bg-surface-100 hover:bg-surface-800 dark:hover:bg-surface-200 text-white dark:text-surface-900 text-xs font-bold transition-all shadow-sm"
          >
            Close Analysis
          </button>
        </div>

      </div>
    </div>
  );
}




