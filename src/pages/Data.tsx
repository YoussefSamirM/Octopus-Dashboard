import { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet, FileClock, Users, Filter, Download,
  BarChart2, CheckCircle2, RefreshCw, TrendingUp, Activity,
  ShieldCheck, Gauge, Clock
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine
} from 'recharts';
import { useAppStore } from '@/stores/appStore';
import {
  parseDirectory, parseChats, parseStatus,
  processAHT, processCPH, exportToExcel,
  type DirectoryMeta, type ParsedChat, type ParsedStatus, type AHTResult, type CPHResult
} from '@/services/calcLogic';

// ─── ANIMATED COUNTER ───
function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v.toFixed(decimals) + suffix),
    });
    return controls.stop;
  }, [value]);

  return <span>{display}</span>;
}

// ─── COLOR helpers ───
function getCPHColor(cph: number) {
  if (cph >= 5)   return '#22c55e';
  if (cph >= 3.5) return '#eab308';
  if (cph >= 2)   return '#f97316';
  return '#ef4444';
}
function getAHTColor(aht: number) {
  if (aht <= 300) return '#22c55e';
  if (aht <= 500) return '#eab308';
  if (aht <= 700) return '#f97316';
  return '#ef4444';
}

// ─── CUSTOM TOOLTIP ───
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 dark:bg-[#0a0f1e]/95 backdrop-blur-md border border-surface-200/60 dark:border-brand-900/20/60 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 text-xs z-50">
      <p className="font-bold text-surface-800 dark:text-surface-200 mb-3 border-b border-surface-100 dark:border-brand-900/20 pb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6 mb-1.5 last:mb-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: p.color }} />
            <span className="text-surface-500 font-medium">{p.name}</span>
          </div>
          <span className="font-bold text-surface-900">
            {typeof p.value === 'number' ? p.value.toFixed(2).replace(/\.00$/, '') : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── STAGGER VARIANTS ───
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } }
};

// ─── TABLE ROW VARIANT ───
const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  show:   { opacity: 1, x: 0 }
};

export default function Data() {
  const addToast = useAppStore((s) => s.addToast);

  // ─── STATE ───
  const [activeTab, setActiveTab] = useState<'aht' | 'cph' | 'sla'>('cph');
  const [siteFilter, setSiteFilter] = useState('All');
  const [lobFilter, setLobFilter] = useState('All');
  const [boundsStart, setBoundsStart] = useState('');
  const [boundsEnd, setBoundsEnd] = useState('');

  const [dirMap, setDirMap] = useState<Record<string, DirectoryMeta> | null>(null);
  const [rawChats, setRawChats] = useState<ParsedChat[]>([]);
  const [rawStatus, setRawStatus] = useState<ParsedStatus[]>([]);

  const [ahtResult, setAhtResult] = useState<AHTResult | null>(null);
  const [cphResult, setCphResult] = useState<CPHResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('wfm_sheet_url') || '');
  const [isFetchingDir, setIsFetchingDir] = useState(false);

  const chatsInputRef = useRef<HTMLInputElement>(null);
  const statusInputRef = useRef<HTMLInputElement>(null);

  // ─── FILE UPLOAD ───
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'chats' | 'status') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (type === 'chats') {
          const chats = parseChats(content, dirMap || {});
          if (chats.length === 0) {
            addToast({ message: 'Warning: 0 valid chats found. Check columns.', type: 'error' });
          } else {
            setRawChats(chats);
            addToast({ message: `Chats Loaded (${chats.length})`, type: 'success' });
          }
        } else {
          const statuses = parseStatus(content);
          if (statuses.length === 0) {
            addToast({ message: 'Warning: 0 valid statuses found. Check columns.', type: 'error' });
          } else {
            setRawStatus(statuses);
            addToast({ message: `Status Loaded (${statuses.length})`, type: 'success' });
          }
        }
      } catch (err: any) {
        addToast({ message: `Error parsing file: ${err.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ─── FETCH DIRECTORY ───
  const handleFetchDirectory = async () => {
    if (!sheetUrl) { addToast({ message: 'Please enter a Google Sheet URL', type: 'warning' }); return; }
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) { addToast({ message: 'Invalid Google Sheet URL format', type: 'error' }); return; }
    const sheetId = match[1];
    setIsFetchingDir(true);
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
      if (!res.ok) throw new Error('Make sure the sheet is public ("Anyone with link can view")');
      const csvContent = await res.text();
      const map = parseDirectory(csvContent);
      if (Object.keys(map).length === 0) throw new Error('Could not parse any valid directory data from the sheet.');
      setDirMap(map);
      localStorage.setItem('wfm_sheet_url', sheetUrl);
      addToast({ message: 'Directory Fetched Successfully', type: 'success' });
    } catch (err: any) {
      addToast({ message: `Error fetching directory: ${err.message}`, type: 'error' });
    } finally {
      setIsFetchingDir(false);
    }
  };

  // ─── PROCESS DATA ───
  const handleApplyFilters = () => {
    if (rawChats.length === 0) { addToast({ message: 'Please upload Chats first', type: 'warning' }); return; }
    setIsProcessing(true);
    setTimeout(() => {
      const bStart = boundsStart ? new Date(boundsStart).getTime() : null;
      const bEnd   = boundsEnd   ? new Date(boundsEnd).getTime()   : null;
      setAhtResult(processAHT(rawChats, siteFilter, bStart, bEnd));
      setCphResult(processCPH(rawChats, rawStatus, siteFilter, lobFilter, bStart, bEnd));
      setIsProcessing(false);
      addToast({ message: 'Data processed successfully', type: 'success' });
    }, 100);
  };

  // ─── EXPORT ───
  const handleExport = async () => {
    if (activeTab === 'aht' && ahtResult) await exportToExcel(ahtResult, 'AHT');
    else if (activeTab === 'cph' && cphResult) await exportToExcel(cphResult, 'CPH');
    else if (activeTab === 'sla' && cphResult) await exportToExcel(cphResult, 'CPH');
  };

  // ─── TABLE RENDER ───
  const renderTable = (
    headers: string[],
    rows: any[],
    rowRenderer: (row: any, i: number) => React.ReactNode,
    footer?: React.ReactNode
  ) => (
    <div className="overflow-x-auto max-h-[380px] overflow-y-auto border border-surface-200 rounded-lg">
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-50 dark:bg-[#060b18] sticky top-0 z-10 shadow-[0_1px_0_#e2e8f0] dark:shadow-none">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-xs font-semibold text-surface-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <motion.tbody
          className="divide-y divide-surface-100 dark:divide-brand-900/15 bg-white dark:bg-[#0a0f1e]"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {rows.length > 0 ? rows.map((row, i) => (
            <motion.tr key={i} variants={rowVariants} transition={{ duration: 0.25, delay: i * 0.02 }} className="hover:bg-brand-50/40 transition-colors">
              {rowRenderer(row, i) as any}
            </motion.tr>
          )) : (
            <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-sm text-surface-400">No data available</td></tr>
          )}
        </motion.tbody>
        {footer && (
          <tfoot className="bg-surface-50 dark:bg-[#060b18] sticky bottom-0 z-10 shadow-[0_-1px_0_#e2e8f0] dark:shadow-none font-semibold text-surface-700 dark:text-surface-300">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );

  // ─── KPI CARD ───
  const KPICard = ({ label, value, decimals = 0, suffix = '', icon: Icon, color = 'brand' }: any) => (
    <motion.div variants={itemVariants} className="card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-${color}-100 flex items-center justify-center`}>
          <Icon size={16} className={`text-${color}-600`} />
        </div>
      </div>
      <p className={`text-3xl font-bold text-${color}-600`}>
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </p>
    </motion.div>
  );

  // ─── METRIC KPI (with target/status badge) ───
  const MetricKPICard = ({ label, value, decimals = 1, suffix = '%', icon: Icon, low, high, targetLabel, invert = false }: any) => {
    // invert=true means lower is better (not used for current metrics)
    let status: 'good' | 'warn' | 'bad' = 'bad';
    if (high !== undefined && low !== undefined) {
      // Target is a range
      if (value >= low && value <= high) status = 'good';
      else if (value >= low * 0.9) status = 'warn';
      else status = 'bad';
    } else if (low !== undefined) {
      // Target is a minimum
      if (value >= low) status = 'good';
      else if (value >= low * 0.9) status = 'warn';
      else status = 'bad';
    }
    const colors = {
      good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-600' },
      warn: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   icon: 'text-amber-600' },
      bad:  { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',       icon: 'text-red-600' },
    }[status];
    return (
      <motion.div variants={itemVariants} className={`card p-5 flex flex-col gap-2 ${colors.bg} ${colors.border}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text} opacity-80`}>{label}</span>
          <div className={`w-8 h-8 rounded-lg ${colors.badge} flex items-center justify-center`}>
            <Icon size={16} className={colors.icon} />
          </div>
        </div>
        <p className={`text-3xl font-bold ${colors.text}`}>
          <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
        </p>
        {targetLabel && (
          <p className={`text-xs ${colors.text} opacity-70`}>{targetLabel}</p>
        )}
      </motion.div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-12">
      {/* ─── PAGE HEADER ─── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="page-header mb-6"
      >
        <h1 className="page-title">AHT & CPH Calculator</h1>
        <p className="page-description">Calculate, visualize and export AHT, CPH, SLA, Occupancy and Utilization metrics.</p>
      </motion.div>

      {/* ─── TOOLBAR ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="card p-5 mb-6 space-y-5"
      >


        {/* File uploads */}
        <div className="flex flex-wrap items-center gap-4">
          <input type="file" ref={chatsInputRef} className="hidden" accept=".csv" onChange={e => handleFileUpload(e, 'chats')} />
          <input type="file" ref={statusInputRef} className="hidden" accept=".csv" onChange={e => handleFileUpload(e, 'status')} />

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => chatsInputRef.current?.click()}
            className={`btn-secondary ${rawChats.length > 0 ? 'border-success-300 bg-success-50 text-success-700 hover:bg-success-100' : ''}`}
          >
            <FileSpreadsheet size={16} /> 1. Chats Log
            {rawChats.length > 0 && <span className="ml-1 text-xs">({rawChats.length})</span>}
          </motion.button>

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => statusInputRef.current?.click()}
            className={`btn-secondary ${rawStatus.length > 0 ? 'border-success-300 bg-success-50 text-success-700 hover:bg-success-100' : ''}`}
          >
            <FileClock size={16} /> 2. Agent Status
            {rawStatus.length > 0 && <span className="ml-1 text-xs">({rawStatus.length})</span>}
          </motion.button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-surface-100">
          <div className="flex-1 min-w-[150px]">
            <label className="input-label">Start Boundary</label>
            <input type="datetime-local" className="input" value={boundsStart} onChange={e => setBoundsStart(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="input-label">End Boundary</label>
            <input type="datetime-local" className="input" value={boundsEnd} onChange={e => setBoundsEnd(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="input-label">Site</label>
            <select className="input" value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
              <option value="All">All Sites</option>
              <option value="Alex">Alexandria</option>
              <option value="Assiut">Assiut</option>
            </select>
          </div>
          {(activeTab === 'cph' || activeTab === 'sla') && (
            <div className="flex-1 min-w-[150px]">
              <label className="input-label">LOB</label>
              <select className="input" value={lobFilter} onChange={e => setLobFilter(e.target.value)}>
                <option value="All">All LOBs</option>
                <option value="Combined">Combined</option>
                <option value="TPro">TPro</option>
              </select>
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleApplyFilters}
            disabled={isProcessing}
            className="btn-primary"
          >
            {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <Filter size={16} />}
            Process Data
          </motion.button>
        </div>
      </motion.div>

      {/* ─── TABS & EXPORT ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between mb-5 border-b border-surface-200"
      >
        <div className="flex gap-6">
          {(['cph', 'aht', 'sla'] as const).map(tab => {
            const labels: Record<string, string> = { cph: 'CPH View', aht: 'AHT View', sla: 'Main Matrix' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                  activeTab === tab
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
        <div className="pb-2">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleExport}
            disabled={!ahtResult && !cphResult}
            className="btn-success py-1.5 px-4 text-xs"
          >
            <Download size={14} /> Export {activeTab.toUpperCase()}
          </motion.button>
        </div>
      </motion.div>

      {/* ─── CONTENT ─── */}
      <AnimatePresence mode="wait">

        {/* ══════ CPH VIEW ══════ */}
        {activeTab === 'cph' && cphResult && (
          <motion.div
            key="cph"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* KPI Cards - CPH */}
            <motion.div
              variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <KPICard label="Total Chats" value={cphResult.totals.chats} icon={Activity} color="brand" />
              <KPICard label="Active Agents" value={cphResult.agents.length} icon={Users} color="indigo" />
              <KPICard label="Net Login Hrs" value={cphResult.totals.hours} decimals={2} icon={TrendingUp} color="emerald" />
            </motion.div>

            {/* ─── CHARTS ROW ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CPH by Interval Bar Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="card p-5"
              >
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                  <BarChart2 size={16} className="text-brand-500" /> CPH by Interval
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cphResult.intervals.filter(i => i.cph !== -1)} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={5} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 10, fill: '#22c55e' }} />
                    <Bar dataKey="cph" name="CPH" radius={[6, 6, 0, 0]}>
                      {cphResult.intervals.filter(i => i.cph !== -1).map((entry, index) => (
                        <Cell key={index} fill={getCPHColor(entry.cph)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Chats by Interval Line Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="card p-5"
              >
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-500" /> Chats Volume by Interval
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cphResult.intervals} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone" dataKey="chats" name="Chats"
                      stroke="#6366f1" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* CPH by SV Bar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="card p-5"
            >
              <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                <Users size={16} className="text-indigo-500" /> CPH by Supervisor
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cphResult.svs.filter(s => s.cph !== -1).slice(0, 15)} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#475569' }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cph" name="CPH" radius={[0, 6, 6, 0]}>
                    {cphResult.svs.filter(s => s.cph !== -1).slice(0, 15).map((entry, index) => (
                      <Cell key={index} fill={getCPHColor(entry.cph)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Agent Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="card p-5"
            >
              <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4">View per Agent</h3>
              {renderTable(
                ['HR', 'Agent Name', 'Site', 'LOB', 'TL', 'SPV', 'Chats', 'AHT', 'Net Hrs', 'CPH'],
                cphResult.agents,
                (a) => <>
                  <td className="px-4 py-2.5 text-sm">{a.hr}</td>
                  <td className="px-4 py-2.5 text-sm font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-sm">{a.site}</td>
                  <td className="px-4 py-2.5 text-sm">{a.lob}</td>
                  <td className="px-4 py-2.5 text-sm">{a.tl}</td>
                  <td className="px-4 py-2.5 text-sm">{a.sv}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold">{a.chats}</td>
                  <td className="px-4 py-2.5 text-sm">{a.aht.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-sm">{a.hours.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-sm font-bold" style={{ color: a.cph === -1 ? '#94a3b8' : getCPHColor(a.cph) }}>
                    {a.cph === -1 ? 'N/A' : a.cph.toFixed(2)}
                  </td>
                </>,
                <tr>
                  <td colSpan={6} className="px-4 py-3">Overall</td>
                  <td className="px-4 py-3">{cphResult.totals.chats}</td>
                  <td className="px-4 py-3">{(cphResult.totals.totalHandle / Math.max(1, cphResult.totals.chats)).toFixed(2)}</td>
                  <td className="px-4 py-3">{cphResult.totals.hours.toFixed(2)}</td>
                  <td className="px-4 py-3 text-brand-600">{cphResult.totals.hours > 0 ? (cphResult.totals.chats / cphResult.totals.hours).toFixed(2) : 'N/A'}</td>
                </tr>
              )}
            </motion.div>

            {/* SV + Interval Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4">By Supervisor</h3>
                {renderTable(
                  ['Supervisor', 'Chats', 'AHT', 'Aux Hrs', 'CPH'],
                  cphResult.svs,
                  (s) => <>
                    <td className="px-4 py-2.5 text-sm font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-sm">{s.chats}</td>
                    <td className="px-4 py-2.5 text-sm">{s.aht.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{s.hours.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm font-bold" style={{ color: s.cph === -1 ? '#94a3b8' : getCPHColor(s.cph) }}>
                      {s.cph === -1 ? 'N/A' : s.cph.toFixed(2)}
                    </td>
                  </>
                )}
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card p-5">
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4">By Interval</h3>
                {renderTable(
                  ['Interval', 'Chats', 'AHT', 'Aux Hrs', 'CPH'],
                  cphResult.intervals,
                  (int) => <>
                    <td className="px-4 py-2.5 text-sm font-medium">{int.label}</td>
                    <td className="px-4 py-2.5 text-sm">{int.chats}</td>
                    <td className="px-4 py-2.5 text-sm">{int.aht.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{int.hours.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm font-bold" style={{ color: int.cph === -1 ? '#94a3b8' : getCPHColor(int.cph) }}>
                      {int.cph === -1 ? 'N/A' : int.cph.toFixed(2)}
                    </td>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ══════ AHT VIEW ══════ */}
        {activeTab === 'aht' && ahtResult && (
          <motion.div
            key="aht"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* KPI Cards - AHT */}
            <motion.div
              variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <KPICard label="Total Chats" value={ahtResult.totals.chats} icon={Activity} color="brand" />
              <KPICard
                label="Overall AHT"
                value={ahtResult.totals.chats > 0 ? ahtResult.totals.totalHandle / ahtResult.totals.chats : 0}
                decimals={2} suffix="s" icon={TrendingUp} color="amber"
              />
              <KPICard label="Total Talk (s)" value={ahtResult.totals.talk} decimals={0} icon={BarChart2} color="indigo" />
            </motion.div>

            {/* ─── CHARTS ROW ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AHT by Interval */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="card p-5"
              >
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                  <BarChart2 size={16} className="text-amber-500" /> AHT by Interval
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ahtResult.intervals} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="aht" name="AHT (s)" radius={[6, 6, 0, 0]}>
                      {ahtResult.intervals.map((entry, index) => (
                        <Cell key={index} fill={getAHTColor(entry.aht)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Talk vs ACW Stacked */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="card p-5"
              >
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-500" /> Talk vs ACW by Interval
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ahtResult.intervals} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="avgT" name="Talk+Hold" stackId="a" fill="#6366f1" radius={[0,0,0,0]} />
                    <Bar dataKey="avgC" name="ACW" stackId="a" fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* AHT by SV Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="card p-5"
            >
              <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                <Users size={16} className="text-indigo-500" /> AHT by Supervisor
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ahtResult.svs.slice(0, 15)} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#475569' }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="aht" name="AHT (s)" radius={[0, 6, 6, 0]}>
                    {ahtResult.svs.slice(0, 15).map((entry, index) => (
                      <Cell key={index} fill={getAHTColor(entry.aht)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Agent Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="card p-5"
            >
              <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4">View per Agent</h3>
              {renderTable(
                ['HR', 'Name', 'LOB', 'TL', 'SPV', 'Chats', 'AHT', 'Talk+Hold', 'ACW'],
                ahtResult.agents,
                (a) => <>
                  <td className="px-4 py-2.5 text-sm">{a.hr}</td>
                  <td className="px-4 py-2.5 text-sm font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-sm">{a.lob}</td>
                  <td className="px-4 py-2.5 text-sm">{a.tl}</td>
                  <td className="px-4 py-2.5 text-sm">{a.sv}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold">{a.chats}</td>
                  <td className="px-4 py-2.5 text-sm font-bold" style={{ color: getAHTColor(a.aht) }}>{a.aht.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-sm">{a.avgT.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-sm">{a.avgC.toFixed(2)}</td>
                </>,
                <tr>
                  <td colSpan={5} className="px-4 py-3">Overall</td>
                  <td className="px-4 py-3">{ahtResult.totals.chats}</td>
                  <td className="px-4 py-3 text-amber-600">{(ahtResult.totals.totalHandle / Math.max(1, ahtResult.totals.chats)).toFixed(2)}</td>
                  <td className="px-4 py-3">{(ahtResult.totals.talk / Math.max(1, ahtResult.totals.chats)).toFixed(2)}</td>
                  <td className="px-4 py-3">{(ahtResult.totals.acw / Math.max(1, ahtResult.totals.chats)).toFixed(2)}</td>
                </tr>
              )}
            </motion.div>

            {/* SV + Interval Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4">By Supervisor</h3>
                {renderTable(
                  ['Supervisor', 'Chats', 'AHT', 'Talk+Hold', 'ACW'],
                  ahtResult.svs,
                  (s) => <>
                    <td className="px-4 py-2.5 text-sm font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-sm">{s.chats}</td>
                    <td className="px-4 py-2.5 text-sm font-bold" style={{ color: getAHTColor(s.aht) }}>{s.aht.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{s.avgT.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{s.avgC.toFixed(2)}</td>
                  </>
                )}
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card p-5">
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4">By Interval</h3>
                {renderTable(
                  ['Interval', 'Chats', 'AHT', 'Talk+Hold', 'ACW'],
                  ahtResult.intervals,
                  (int) => <>
                    <td className="px-4 py-2.5 text-sm font-medium">{int.label}</td>
                    <td className="px-4 py-2.5 text-sm">{int.chats}</td>
                    <td className="px-4 py-2.5 text-sm font-bold" style={{ color: getAHTColor(int.aht) }}>{int.aht.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{int.avgT.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{int.avgC.toFixed(2)}</td>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ══════ EMPTY STATE ══════ */}
        {!ahtResult && !cphResult && !isProcessing && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.35 }}
            className="card p-16 flex flex-col items-center justify-center text-center"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 bg-gradient-to-br from-brand-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
            >
              <BarChart2 className="text-brand-500" size={36} />
            </motion.div>
            <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-200 mb-2">No Data Processed Yet</h3>
            <p className="text-sm text-surface-500 max-w-md">
              Connect your Google Sheet directory, upload your Chats Log and Agent Status files, then click <strong>Process Data</strong> to see charts and metrics.
            </p>
          </motion.div>
        )}

        {/* ══════ SLA & QUALITY VIEW ══════ */}
        {activeTab === 'sla' && cphResult && (
          <motion.div
            key="sla"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* ─── BIG METRIC HERO CARDS ─── */}
            <motion.div variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
            >
              <MetricKPICard label="Service Level (SLA)" value={cphResult.totals.sla}
                icon={ShieldCheck} low={80} targetLabel={`Target ≥80% · Threshold: ${cphResult.slaThreshold}s`} />
              <MetricKPICard label="Occupancy" value={cphResult.totals.occupancy}
                icon={Gauge} low={80} high={85} targetLabel="Target: 80% – 85%" />
              <MetricKPICard label="Utilization" value={cphResult.totals.utilization}
                icon={Clock} low={86} targetLabel={`Target ≥86% · ${cphResult.shiftHoursPerAgent}h shift/agent · ${cphResult.agentCount} agents`} />
            </motion.div>

            {/* ─── GAUGE CHARTS ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[
                { label: 'SLA', value: cphResult.totals.sla, low: 80, high: 100, color: cphResult.totals.sla >= 80 ? '#22c55e' : cphResult.totals.sla >= 72 ? '#f59e0b' : '#ef4444' },
                { label: 'Occupancy', value: cphResult.totals.occupancy, low: 80, high: 85, color: (cphResult.totals.occupancy >= 80 && cphResult.totals.occupancy <= 85) ? '#22c55e' : cphResult.totals.occupancy >= 72 ? '#f59e0b' : '#ef4444' },
                { label: 'Utilization', value: cphResult.totals.utilization, low: 86, high: 100, color: cphResult.totals.utilization >= 86 ? '#22c55e' : cphResult.totals.utilization >= 77 ? '#f59e0b' : '#ef4444' },
              ].map(({ label, value, low, high, color }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="card p-5 flex flex-col items-center gap-3"
                >
                  <h3 className="text-sm font-semibold text-surface-700 self-start">{label}</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={[{ name: label, value: Math.min(value, 100), rest: Math.max(0, 100 - Math.min(value, 100)) }]}
                      layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip formatter={(val: any) => [`${Number(val).toFixed(1)}%`, label]} />
                      <ReferenceLine x={low} stroke="#94a3b8" strokeDasharray="4 4"
                        label={{ value: `${low}%`, fontSize: 9, fill: '#64748b', position: 'top' }} />
                      {high < 100 && <ReferenceLine x={high} stroke="#94a3b8" strokeDasharray="4 4"
                        label={{ value: `${high}%`, fontSize: 9, fill: '#64748b', position: 'top' }} />}
                      <Bar dataKey="value" name={label} radius={[0, 6, 6, 0]} stackId="a" fill={color} />
                      <Bar dataKey="rest" stackId="a" fill="#f1f5f9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-4xl font-bold" style={{ color }}>{value.toFixed(1)}%</p>
                  <p className="text-xs text-surface-400">Target: {low}%{high < 100 ? `–${high}%` : '+'}</p>
                </motion.div>
              ))}
            </div>

            {/* ─── TREND CHARTS ROW ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="card p-5">
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-500" /> SLA Trend by Interval
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cphResult.intervals} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Target 80%', fill: '#22c55e', fontSize: 10, position: 'insideTopLeft' }} />
                    <Line type="monotone" dataKey="sla" name="SLA %" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="card p-5">
                <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                  <Gauge size={16} className="text-brand-500" /> Occupancy Trend by Interval
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cphResult.intervals.filter(i => i.occupancy > 0)} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target 80%', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }} />
                    <Line type="monotone" dataKey="occupancy" name="Occupancy %" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* ─── SLA & OCCUPANCY BREAKDOWN BY SV ─── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-5">
              <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center gap-2">
                <Users size={16} className="text-brand-500" /> Occupancy & Hours by Supervisor
              </h3>
              {renderTable(
                ['Supervisor', 'Chats', 'AHT (s)', 'Net Login Hrs', 'Handle Time (s)', 'Occupancy %'],
                cphResult.svs,
                (s: any) => {
                  const loginSecs = s.hours * 3600;
                  const occ = loginSecs > 0 ? (s.totalHandle / loginSecs) * 100 : 0;
                  const occColor = occ >= 80 && occ <= 85 ? '#22c55e' : occ >= 72 ? '#f59e0b' : '#ef4444';
                  return <>
                    <td className="px-4 py-2.5 text-sm font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-sm">{s.chats}</td>
                    <td className="px-4 py-2.5 text-sm">{s.aht.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{s.hours.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm">{s.totalHandle?.toFixed(0) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-bold" style={{ color: occColor }}>
                      {loginSecs > 0 ? `${occ.toFixed(1)}%` : 'N/A'}
                    </td>
                  </>;
                },
                <tr>
                  <td colSpan={3} className="px-4 py-3">Overall</td>
                  <td className="px-4 py-3">{cphResult.totals.hours.toFixed(2)}</td>
                  <td className="px-4 py-3">{cphResult.totals.totalHandle?.toFixed(0)}</td>
                  <td className="px-4 py-3 font-bold"
                    style={{ color: cphResult.totals.occupancy >= 80 && cphResult.totals.occupancy <= 85 ? '#22c55e' : '#ef4444' }}>
                    {cphResult.totals.occupancy.toFixed(1)}%
                  </td>
                </tr>
              )}
            </motion.div>

            {/* ─── SUMMARY NOTES ─── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-surface-500">
              <div className="card p-4 border-l-4 border-emerald-400">
                <p className="font-semibold text-surface-700 mb-1">SLA Formula</p>
                <p>Chats answered ≤ {cphResult.slaThreshold}s / Total Chats with reply data</p>
                <p className="mt-1 font-medium">{cphResult.totals.slaCount} / {cphResult.totals.slaTotal} chats</p>
              </div>
              <div className="card p-4 border-l-4 border-amber-400">
                <p className="font-semibold text-surface-700 mb-1">Occupancy Formula</p>
                <p>Total Handle Time / Total Login Time × 100</p>
                <p className="mt-1 font-medium">{cphResult.totals.totalHandle?.toFixed(0)}s / {(cphResult.totals.hours * 3600).toFixed(0)}s</p>
              </div>
              <div className="card p-4 border-l-4 border-blue-400">
                <p className="font-semibold text-surface-700 mb-1">Utilization Formula</p>
                <p>Total Login Time / (Agents × {cphResult.shiftHoursPerAgent}h) × 100</p>
                <p className="mt-1 font-medium">{cphResult.totals.hours.toFixed(2)}h / {(cphResult.agentCount * cphResult.shiftHoursPerAgent).toFixed(0)}h total shift</p>
              </div>
            </motion.div>

          </motion.div>
        )}

        {/* Processing spinner */}

        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card p-16 flex flex-col items-center justify-center"
          >
            <RefreshCw size={40} className="text-brand-500 animate-spin mb-4" />
            <p className="text-sm text-surface-500">Crunching the numbers…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
