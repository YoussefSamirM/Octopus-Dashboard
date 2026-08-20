import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── TYPES ───

export interface DirectoryMeta {
  hr: string;
  sv: string;
  tl: string;
  lob: string;
  site: string;
}

export interface ParsedChat {
  key: string;
  hr: string;
  name: string;
  email: string;
  sv: string;
  tl: string;
  lob: string;
  site: string;
  intervalBaseStr: string | null;
  chatTs: number | null;
  talk: number;
  acw: number;
  totalHandle: number;
  driver: string;
  tenure: string;
  ttfr: number | null; // time to first reply in seconds (null = no first reply data)
}

export interface ParsedStatus {
  key: string;
  start: number;
  end: number;
}

export interface AHTResult {
  agents: any[];
  svs: any[];
  tls: any[];
  drivers: any[];
  intervals: any[];
  totals: {
    chats: number;
    totalHandle: number;
    talk: number;
    acw: number;
    slaCount: number;    // chats answered within SLA threshold
    slaTotal: number;    // chats with ttfr data (denominator)
    sla: number;         // SLA % (0-100)
  };
  slaThreshold: number; // seconds used
}

export interface CPHResult {
  agents: any[];
  svs: any[];
  tls: any[];
  lobs: any[];
  drivers: any[];
  intervals: any[];
  totals: {
    chats: number;
    totalHandle: number;
    hours: number;
    slaCount: number;    // chats answered within SLA threshold
    slaTotal: number;    // chats with ttfr data
    sla: number;         // SLA % (0-100)
    occupancy: number;   // totalHandle / (hours * 3600) as %
    utilization: number; // hours / shiftHours as % (shiftHours = agents * 9h)
  };
  slaThreshold: number;
  agentCount: number;
  shiftHoursPerAgent: number;
}

// ─── UTILS ───

export function makeUltraKey(str: string): string {
  if (!str) return '';
  return String(str).toLowerCase().replace('@talabat.com', '').replace('.ext', '').replace(/[\s\.]/g, '').trim();
}

function safeParseFloat(str: any): number {
  if (!str) return 0;
  const num = parseFloat(String(str).replace(/,/g, '').trim());
  return isNaN(num) ? 0 : num;
}

function extractTimestampSafe(str: any): number | null {
  if (!str || String(str).trim() === '-' || String(str).trim() === '') return null;
  const d = new Date(String(str).trim().replace(/^"|"$/g, ''));
  return isNaN(d.getTime()) ? null : d.getTime();
}

function extractExactIntervalKey(dateStr: string | null) {
  if (!dateStr || String(dateStr).trim() === '-' || String(dateStr).trim() === '') return { sortKey: -1, label: "Unknown" };
  const d = new Date(String(dateStr).trim().replace(/^"|"$/g, ''));
  if (isNaN(d.getTime())) return { sortKey: -1, label: "Unknown" };
  const h = d.getHours();
  const m = d.getMinutes();
  const mRounded = m >= 30 ? 30 : 0;
  const sortKey = h * 60 + mRounded;
  const mmStr = mRounded === 0 ? "30" : "00";
  const displayH = mRounded === 0 ? h : (h === 0 ? 0 : h);
  return { sortKey, label: `${displayH}:${mmStr}` };
}

function isGHC(site: string, lob: string) {
  const s = String(site).toLowerCase();
  const l = String(lob).toLowerCase();
  return s.includes('ghc') || l.includes('ghc');
}

function groupLOB(rawLob: string) {
  if (!rawLob || rawLob === 'Unassigned' || rawLob === 'Unassigned LOB') return "Unknown LOB";
  const l = String(rawLob).toLowerCase().replace(/[\s\-]/g, '');
  if (l.includes('tmart') || l.includes('fcr') || l.includes('delivery') || l.includes('pickup')) return "Combined";
  if (l.includes('tpro')) return "TPro";
  return String(rawLob).trim();
}

// ─── PARSERS ───

export function parseDirectory(fileContent: string): Record<string, DirectoryMeta> {
  const parsed = Papa.parse(fileContent, { header: false, skipEmptyLines: true });
  const map: Record<string, DirectoryMeta> = {};
  const entries = parsed.data as string[][];
  if (entries.length < 2) return map;

  const headings = entries[0].map(h => h ? String(h).toLowerCase().replace(/^\ufeff/, '').trim() : '');
  const emailIdx = headings.findIndex(h => h === 'talabat email' || h.includes('email'));
  const hrIdx = headings.findIndex(h => h === 'hr id' || h === 'hr');
  const svIdx = headings.findIndex(h => h === '2nd level' || h === 'supervisor' || h === 'sv');
  const tlIdx = headings.findIndex(h => h === '1st level' || h === 'tl' || h === 'team leader');
  const lobIdx = headings.findIndex(h => h === 'lob' || h === 'business');
  const siteIdx = headings.findIndex(h => h === 'site' || h === 'location');

  if (emailIdx === -1) return map;

  for (let i = 1; i < entries.length; i++) {
    const row = entries[i];
    if (!row || row.length <= emailIdx || !row[emailIdx]) continue;
    const key = makeUltraKey(row[emailIdx]);
    if (!key) continue;

    map[key] = {
      hr: hrIdx !== -1 && row[hrIdx] ? String(row[hrIdx]).trim() : 'N/A',
      sv: svIdx !== -1 && row[svIdx] ? String(row[svIdx]).trim() : 'Unassigned SPV',
      tl: tlIdx !== -1 && row[tlIdx] ? String(row[tlIdx]).trim() : 'Unassigned TL',
      lob: lobIdx !== -1 && row[lobIdx] ? String(row[lobIdx]).trim() : 'Unknown LOB',
      site: siteIdx !== -1 && row[siteIdx] ? String(row[siteIdx]).trim() : 'Unknown Site',
    };
  }

  return map;
}

export function parseChats(fileContent: string, dirMap: Record<string, DirectoryMeta>): ParsedChat[] {
  const parsed = Papa.parse(fileContent, { header: false, skipEmptyLines: true });
  const chats: ParsedChat[] = [];
  const entries = parsed.data as string[][];
  if (entries.length < 2) return chats;

  const headings = entries[0].map(h => h ? String(h).toLowerCase().replace(/^\ufeff/, '').trim() : '');
  const emailIdx = headings.findIndex(h => h.includes('agent email') || h.includes('email'));
  const statusIdx = headings.findIndex(h => h.includes('chat status') || h === 'status');
  const createIdx = headings.findIndex(h => h.includes('creation timestamp'));
  const firstReplyIdx = headings.findIndex(h => h.includes('first reply timestamp'));
  const handlingIdx = headings.findIndex(h => h === 'handling time' || h.includes('handling time'));
  const wrapIdx = headings.findIndex(h => h === 'wrap up time' || h.includes('wrap up'));
  const driverIdx = headings.findIndex(h => h.includes('ccr category l3') || h.includes('driver'));
  const tenureIdx = headings.findIndex(h => h === 'tenure id' || h.includes('tenure'));

  if (emailIdx === -1 || handlingIdx === -1 || wrapIdx === -1 || statusIdx === -1) return chats;

  for (let i = 1; i < entries.length; i++) {
    const row = entries[i];
    if (!row || row.length <= emailIdx || !row[emailIdx]) continue;

    const currentStatus = row[statusIdx] ? String(row[statusIdx]).toUpperCase().trim() : '';
    if (currentStatus !== 'CLOSED' && currentStatus !== 'CLOSE') continue;

    const talkTime = safeParseFloat(row[handlingIdx]);
    const wrapTime = safeParseFloat(row[wrapIdx]);
    const totalAHT = talkTime + wrapTime;

    let intervalStr = null;
    if (firstReplyIdx !== -1 && row[firstReplyIdx] && String(row[firstReplyIdx]).trim() !== '-') {
      intervalStr = String(row[firstReplyIdx]).trim();
    }
    if (!intervalStr) {
      intervalStr = createIdx !== -1 && row[createIdx] ? String(row[createIdx]).trim() : null;
    }

    const cTs = createIdx !== -1 ? extractTimestampSafe(row[createIdx]) : null;
    const chatTs = extractTimestampSafe(intervalStr) || cTs;

    const uKey = makeUltraKey(row[emailIdx]);
    const meta = dirMap[uKey] || { hr: 'N/A', sv: 'Unassigned SPV', tl: 'Unassigned TL', lob: 'Unknown LOB', site: 'Unknown Site' };

    chats.push({
      key: uKey,
      hr: meta.hr,
      name: String(row[emailIdx]).split('@')[0],
      email: String(row[emailIdx]).trim(),
      sv: String(meta.sv).trim(),
      tl: String(meta.tl).trim(),
      lob: groupLOB(meta.lob),
      site: String(meta.site).trim(),
      intervalBaseStr: intervalStr,
      chatTs,
      talk: talkTime,
      acw: wrapTime,
      totalHandle: totalAHT,
      driver: driverIdx !== -1 && row[driverIdx] ? String(row[driverIdx]).trim() : 'Unspecified',
      tenure: tenureIdx !== -1 && row[tenureIdx] ? String(row[tenureIdx]).trim() : 'Unspecified',
      ttfr: (() => {
        // Calculate time to first reply in seconds
        if (createIdx !== -1 && firstReplyIdx !== -1 && row[createIdx] && row[firstReplyIdx]
            && String(row[firstReplyIdx]).trim() !== '-' && String(row[firstReplyIdx]).trim() !== '') {
          const createTs = extractTimestampSafe(row[createIdx]);
          const replyTs  = extractTimestampSafe(row[firstReplyIdx]);
          if (createTs && replyTs && replyTs >= createTs) {
            return (replyTs - createTs) / 1000; // ms → seconds
          }
        }
        return null;
      })()
    });
  }

  return chats;
}

export function parseStatus(fileContent: string): ParsedStatus[] {
  const parsed = Papa.parse(fileContent, { header: false, skipEmptyLines: true });
  const statuses: ParsedStatus[] = [];
  const entries = parsed.data as string[][];
  if (entries.length < 2) return statuses;

  const headings = entries[0].map(h => h ? String(h).toLowerCase().replace(/^\ufeff/, '').trim() : '');
  const emailIdx = headings.findIndex(h => h === 'agent_email' || h.includes('email'));
  const statusIdx = headings.findIndex(h => h === 'status');
  const startIdx = headings.findIndex(h => h === 'date' || h.includes('start'));
  const endIdx = headings.findIndex(h => h === 'end_timestamp' || h.includes('end'));

  if (emailIdx === -1 || startIdx === -1 || statusIdx === -1) return statuses;

  let maxObservedTime = 0;
  for (let i = 1; i < entries.length; i++) {
    const row = entries[i];
    if (!row || row.length <= startIdx) continue;
    const st = extractTimestampSafe(row[startIdx]);
    const et = endIdx !== -1 && row[endIdx] ? extractTimestampSafe(row[endIdx]) : null;
    if (st && st > maxObservedTime) maxObservedTime = st;
    if (et && et > maxObservedTime) maxObservedTime = et;
  }
  const basePullTime = maxObservedTime > 0 ? maxObservedTime : new Date().getTime();

  for (let i = 1; i < entries.length; i++) {
    const row = entries[i];
    if (!row || row.length <= emailIdx) continue;

    const currentStatus = row[statusIdx] ? String(row[statusIdx]).toUpperCase() : '';
    const st = startIdx !== -1 && row[startIdx] ? extractTimestampSafe(row[startIdx]) : null;
    const enStr = endIdx !== -1 ? row[endIdx] : null;

    if (row[emailIdx] && st && (currentStatus.includes('ONLINE') || currentStatus.includes('BUSY') || currentStatus.includes('AVAILABLE') || currentStatus.includes('READY'))) {
      const en = (enStr && String(enStr).trim() !== '') ? extractTimestampSafe(enStr) : basePullTime;
      if (en && en > st) {
        statuses.push({ key: makeUltraKey(row[emailIdx]), start: st, end: en });
      }
    }
  }

  return statuses;
}

// ─── PROCESSORS ───

export function processAHT(chats: ParsedChat[], siteFilter: string, boundsStart: number | null, boundsEnd: number | null): AHTResult {
  const agentMap: Record<string, any> = {};
  const svMap: Record<string, any> = {};
  const tlMap: Record<string, any> = {};
  const intMap: Record<string, any> = {};
  const driverMap: Record<string, any> = {};
  const SLA_THRESHOLD = 60; // seconds - industry standard
  const totals = { chats: 0, totalHandle: 0, talk: 0, acw: 0, slaCount: 0, slaTotal: 0, sla: 0 };

  chats.forEach(c => {
    if (boundsStart && c.chatTs && c.chatTs < boundsStart) return;
    if (boundsEnd && c.chatTs && c.chatTs > boundsEnd) return;
    if (isGHC(c.site, c.lob)) return;

    const sVal = String(c.site).toLowerCase();
    if (siteFilter !== 'All') {
      if (siteFilter === 'Alex' && !sVal.includes('alex')) return;
      if (siteFilter === 'Assiut' && !sVal.includes('assuit') && !sVal.includes('assiut')) return;
    }

    const currentInterval = extractExactIntervalKey(c.intervalBaseStr);

    if (!agentMap[c.key]) agentMap[c.key] = { hr: c.hr, email: c.email, name: c.name, sv: c.sv, tl: c.tl, lob: c.lob, site: c.site, chats: 0, totalHandle: 0, talk: 0, acw: 0 };
    agentMap[c.key].chats++; agentMap[c.key].totalHandle += c.totalHandle; agentMap[c.key].talk += c.talk; agentMap[c.key].acw += c.acw;

    if (!svMap[c.sv]) svMap[c.sv] = { name: c.sv, chats: 0, totalHandle: 0, talk: 0, acw: 0 };
    svMap[c.sv].chats++; svMap[c.sv].totalHandle += c.totalHandle; svMap[c.sv].talk += c.talk; svMap[c.sv].acw += c.acw;

    const tlKey = `${c.sv} | ${c.tl}`;
    if (!tlMap[tlKey]) tlMap[tlKey] = { sv: c.sv, name: c.tl, chats: 0, totalHandle: 0, talk: 0, acw: 0 };
    tlMap[tlKey].chats++; tlMap[tlKey].totalHandle += c.totalHandle; tlMap[tlKey].talk += c.talk; tlMap[tlKey].acw += c.acw;

    if (!intMap[currentInterval.sortKey]) intMap[currentInterval.sortKey] = { label: currentInterval.label, sortKey: currentInterval.sortKey, chats: 0, totalHandle: 0, talk: 0, acw: 0 };
    intMap[currentInterval.sortKey].chats++; intMap[currentInterval.sortKey].totalHandle += c.totalHandle; intMap[currentInterval.sortKey].talk += c.talk; intMap[currentInterval.sortKey].acw += c.acw;

    const dKey = c.driver || 'Unknown';
    if (!driverMap[dKey]) driverMap[dKey] = { name: dKey, chats: 0, totalHandle: 0, talk: 0, acw: 0 };
    driverMap[dKey].chats++; driverMap[dKey].totalHandle += c.totalHandle; driverMap[dKey].talk += c.talk; driverMap[dKey].acw += c.acw;

    totals.chats++; totals.totalHandle += c.totalHandle; totals.talk += c.talk; totals.acw += c.acw;

    // SLA: count chats that had a first-reply time
    if (c.ttfr !== null) {
      totals.slaTotal++;
      if (c.ttfr <= SLA_THRESHOLD) totals.slaCount++;
    }
  });

  const calcAverages = (items: any[]) => items.map(item => ({
    ...item,
    aht: item.chats > 0 ? (item.totalHandle / item.chats) : 0,
    avgT: item.chats > 0 ? (item.talk / item.chats) : 0,
    avgC: item.chats > 0 ? (item.acw / item.chats) : 0
  }));

  totals.sla = totals.slaTotal > 0 ? (totals.slaCount / totals.slaTotal) * 100 : 0;

  return {
    agents: calcAverages(Object.values(agentMap)).sort((a, b) => b.chats - a.chats),
    svs: calcAverages(Object.values(svMap)).sort((a, b) => b.chats - a.chats),
    tls: calcAverages(Object.values(tlMap)).sort((a, b) => b.chats - a.chats),
    drivers: calcAverages(Object.values(driverMap)).sort((a, b) => b.chats - a.chats),
    intervals: calcAverages(Object.values(intMap)).sort((a, b) => a.sortKey - b.sortKey),
    totals,
    slaThreshold: SLA_THRESHOLD
  };
}

export function processCPH(chats: ParsedChat[], statuses: ParsedStatus[], siteFilter: string, lobFilter: string, boundsStart: number | null, boundsEnd: number | null): CPHResult {
  const aMap: Record<string, any> = {};
  const sMap: Record<string, any> = {};
  const tMap: Record<string, any> = {};
  const lMap: Record<string, any> = {};
  const iMap: Record<string, any> = {};
  const dMap: Record<string, any> = {};
  const SLA_THRESHOLD = 60; // seconds
  const SHIFT_HOURS = 9;   // standard 9h shift per agent
  const totals = { chats: 0, hours: 0, totalHandle: 0, slaCount: 0, slaTotal: 0, sla: 0, occupancy: 0, utilization: 0 };

  // Count Chats
  chats.forEach(c => {
    if (boundsStart && c.chatTs && c.chatTs < boundsStart) return;
    if (boundsEnd && c.chatTs && c.chatTs > boundsEnd) return;
    if (isGHC(c.site, c.lob)) return;

    const sVal = String(c.site).toLowerCase();
    if (siteFilter !== 'All') {
      if (siteFilter === 'Alex' && !sVal.includes('alex')) return;
      if (siteFilter === 'Assiut' && !sVal.includes('assuit') && !sVal.includes('assiut')) return;
    }

    const finalLob = groupLOB(c.lob);
    if (lobFilter !== 'All' && finalLob !== lobFilter) return;

    if (!aMap[c.key]) aMap[c.key] = { key: c.key, hr: c.hr, email: c.email, name: c.name, site: c.site, lob: finalLob, sv: c.sv, tl: c.tl, chats: 0, hours: 0, totalHandle: 0 };
    aMap[c.key].chats++; aMap[c.key].totalHandle += c.totalHandle;

    if (!sMap[c.sv]) sMap[c.sv] = { name: c.sv, chats: 0, hours: 0, totalHandle: 0 };
    sMap[c.sv].chats++; sMap[c.sv].totalHandle += c.totalHandle;

    const tlKey = `${c.sv} | ${c.tl}`;
    if (!tMap[tlKey]) tMap[tlKey] = { name: c.tl, sv: c.sv, chats: 0, hours: 0, totalHandle: 0 };
    tMap[tlKey].chats++; tMap[tlKey].totalHandle += c.totalHandle;

    if (!lMap[finalLob]) lMap[finalLob] = { name: finalLob, chats: 0, hours: 0, totalHandle: 0 };
    lMap[finalLob].chats++; lMap[finalLob].totalHandle += c.totalHandle;

    const currentInterval = extractExactIntervalKey(c.intervalBaseStr);
    if (!iMap[currentInterval.sortKey]) iMap[currentInterval.sortKey] = { label: currentInterval.label, sortKey: currentInterval.sortKey, chats: 0, hours: 0, totalHandle: 0, slaCount: 0, slaTotal: 0 };
    iMap[currentInterval.sortKey].chats++; iMap[currentInterval.sortKey].totalHandle += c.totalHandle;

    const dKey = c.driver || 'Unknown';
    if (!dMap[dKey]) dMap[dKey] = { name: dKey, chats: 0, hours: 0, totalHandle: 0 };
    dMap[dKey].chats++; dMap[dKey].totalHandle += c.totalHandle;

    totals.chats++; totals.totalHandle += c.totalHandle;

    // SLA tracking
    if (c.ttfr !== null) {
      totals.slaTotal++;
      iMap[currentInterval.sortKey].slaTotal++;
      if (c.ttfr <= SLA_THRESHOLD) {
        totals.slaCount++;
        iMap[currentInterval.sortKey].slaCount++;
      }
    }
  });

  // Distribute Online Hours
  statuses.forEach(st => {
    const sTime = st.start;
    const eTime = st.end;
    if (eTime <= sTime) return;

    let effStart = sTime;
    let effEnd = eTime;
    if (boundsStart && effStart < boundsStart) effStart = boundsStart;
    if (boundsEnd && effEnd > boundsEnd) effEnd = boundsEnd;
    if (effStart >= effEnd) return;

    const durHrs = (effEnd - effStart) / 3600000;
    if (aMap[st.key]) aMap[st.key].hours += durHrs;
  });

  // Calculate sv, tl, lob hours based on their agents
  Object.values(aMap).forEach(a => {
    if (a.hours > 0) {
      if (sMap[a.sv]) sMap[a.sv].hours += a.hours;
      const tlKey = `${a.sv} | ${a.tl}`;
      if (tMap[tlKey]) tMap[tlKey].hours += a.hours;
      if (lMap[a.lob]) lMap[a.lob].hours += a.hours;
      totals.hours += a.hours;
    }
  });

  // Apportion intervals (basic heuristic based on chats distribution if precise intervals missing, 
  // or simply skip precise interval hour allocation for now, matching original code's approximation)
  const totalChatsInIntervals = Object.values(iMap).reduce((sum, i) => sum + i.chats, 0);
  if (totalChatsInIntervals > 0 && totals.hours > 0) {
    Object.values(iMap).forEach(i => {
      i.hours = totals.hours * (i.chats / totalChatsInIntervals);
    });
  }

  // Compute SLA, Occupancy, Utilization — all per-agent averaged
  totals.sla = totals.slaTotal > 0 ? (totals.slaCount / totals.slaTotal) * 100 : 0;

  const agentCount = Object.keys(aMap).length;

  // Occupancy per agent: agent's totalHandle / (agent's loginHours * 3600)
  // This avoids inflated numbers from concurrent chat handling.
  // We cap each agent at 100% (a single agent can't be >100% occupied).
  const agentOccupancies = Object.values(aMap)
    .filter((a: any) => a.hours > 0)
    .map((a: any) => Math.min((a.totalHandle / (a.hours * 3600)) * 100, 100));
  totals.occupancy = agentOccupancies.length > 0
    ? agentOccupancies.reduce((s: number, v: number) => s + v, 0) / agentOccupancies.length
    : 0;

  // Utilization per agent: agent's loginHours / shiftHours (capped at 100%)
  const agentUtilizations = Object.values(aMap)
    .map((a: any) => Math.min((a.hours / SHIFT_HOURS) * 100, 100));
  totals.utilization = agentUtilizations.length > 0
    ? agentUtilizations.reduce((s: number, v: number) => s + v, 0) / agentUtilizations.length
    : 0;

  // Also attach per-agent occupancy to each agent for table display
  Object.values(aMap).forEach((a: any) => {
    const loginSecs = a.hours * 3600;
    a.occupancy = loginSecs > 0 ? Math.min((a.totalHandle / loginSecs) * 100, 100) : 0;
    a.utilization = Math.min((a.hours / SHIFT_HOURS) * 100, 100);
  });

  const calcCph = (items: any[]) => items.map(item => ({
    ...item,
    aht: item.chats > 0 ? (item.totalHandle / item.chats) : 0,
    cph: item.hours >= 0.016 ? (item.chats / item.hours) : -1
  }));

  return {
    agents: calcCph(Object.values(aMap)).sort((a, b) => b.chats - a.chats),
    svs: calcCph(Object.values(sMap)).sort((a, b) => b.chats - a.chats),
    tls: calcCph(Object.values(tMap)).sort((a, b) => b.chats - a.chats),
    lobs: calcCph(Object.values(lMap)).sort((a, b) => b.chats - a.chats),
    drivers: calcCph(Object.values(dMap)).sort((a, b) => b.chats - a.chats),
    intervals: calcCph(Object.values(iMap)).sort((a, b) => a.sortKey - b.sortKey),
    totals,
    slaThreshold: SLA_THRESHOLD,
    agentCount,
    shiftHoursPerAgent: SHIFT_HOURS
  };
}

// ─── EXPORT ───

// Color helper: returns ARGB hex given a CPH value
function cphColor(cph: number): string {
  if (cph === -1) return 'FFFFFFFF'; // white - no hours data
  if (cph >= 5) return 'FF92D050';  // Green - excellent
  if (cph >= 3.5) return 'FFFFEB9C'; // Yellow - ok
  if (cph >= 2) return 'FFFFCC99'; // Orange - below target
  return 'FFFF9999';               // Red - poor
}

function ahtColor(aht: number): string {
  if (aht === 0) return 'FFFFFFFF';
  if (aht <= 300) return 'FF92D050';  // Green - great AHT
  if (aht <= 500) return 'FFFFEB9C'; // Yellow
  if (aht <= 700) return 'FFFFCC99'; // Orange
  return 'FFFF9999';                // Red - high AHT
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF1F3864' } // deep navy
};
const TOTAL_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF2F5496' } // lighter navy for totals
};
const ALT_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FFF2F6FC' } // very light blue alternating
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right:  { style: 'thin', color: { argb: 'FFBFBFBF' } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });
  row.height = 28;
}

function styleTotals(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.fill = TOTAL_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  });
  row.height = 22;
}

function styleDataRow(row: ExcelJS.Row, idx: number) {
  const isAlt = idx % 2 === 0;
  row.eachCell({ includeEmpty: true }, cell => {
    if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === 'FFFFFFFF' || !cell.value) {
      if (isAlt) cell.fill = ALT_FILL;
    }
    cell.font = { size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  });
  row.height = 18;
}

export async function exportToExcel(data: any, type: 'AHT' | 'CPH') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WFM Enterprise';
  wb.created = new Date();
  const dateStr = new Date().toISOString().slice(0, 10);

  // Helper to draw a table
  function drawTable(ws: ExcelJS.Worksheet, startRow: number, startCol: number, headers: string[], widths: number[], rows: any[][], overall: any[]) {
    // Set column widths if not set (or expand if smaller)
    widths.forEach((w, i) => {
      const col = ws.getColumn(startCol + i);
      if (!col.width || col.width < w) col.width = w;
    });

    // Header
    const headerRow = ws.getRow(startRow);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(startCol + i);
      cell.value = h;
      cell.fill = HEADER_FILL;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = THIN_BORDER;
    });
    headerRow.height = 28;

    // Data
    rows.forEach((rData, idx) => {
      const row = ws.getRow(startRow + 1 + idx);
      rData.forEach((val, i) => {
        const cell = row.getCell(startCol + i);
        cell.value = val;
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { size: 10, name: 'Calibri' };
        if (idx % 2 === 0) cell.fill = ALT_FILL;
        
        // Color specific columns based on headers
        const h = headers[i];
        if (h === 'CPH' && val !== 'N/A' && typeof val === 'number') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cphColor(val) } };
          cell.font = { bold: true, size: 10, name: 'Calibri' };
        }
        if (h.includes('AHT') && typeof val === 'number') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ahtColor(val) } };
          cell.font = { bold: true, size: 10, name: 'Calibri' };
        }
      });
      row.height = 18;
    });

    // Totals
    const totRow = ws.getRow(startRow + 1 + rows.length);
    overall.forEach((val, i) => {
      const cell = totRow.getCell(startCol + i);
      cell.value = val;
      cell.fill = TOTAL_FILL;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
      
      const h = headers[i];
      if (h === 'CPH' && val !== 'N/A' && typeof val === 'number') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cphColor(val) } };
      }
      if (h.includes('AHT') && typeof val === 'number') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ahtColor(val) } };
      }
    });
    totRow.height = 22;

    return startRow + 2 + rows.length;
  }

  // Create Combined Sheet Function
  const createCombinedSheet = (sheetName: string, filterFn: (a: any) => boolean) => {
    const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
    
    const filteredAgents = data.agents.filter(filterFn);
    
    // Calculate totals for filtered agents
    const fTot = { chats: 0, totalHandle: 0, talk: 0, acw: 0, hours: 0 };
    filteredAgents.forEach((a: any) => {
      fTot.chats += a.chats;
      fTot.totalHandle += (a.totalHandle || 0);
      fTot.talk += (a.talk || 0);
      fTot.acw += (a.acw || 0);
      fTot.hours += (a.hours || 0);
    });

    const oAHT = fTot.chats > 0 ? parseFloat((fTot.totalHandle / fTot.chats).toFixed(2)) : 0;
    const oCPH = fTot.hours > 0 ? parseFloat((fTot.chats / fTot.hours).toFixed(2)) : null;

    // Agent Table Data
    const agentRows = filteredAgents.map((a: any) => {
      if (type === 'AHT') {
        return [
          a.hr, a.name, a.email, a.tl, a.sv, a.chats, parseFloat(a.aht.toFixed(2)), parseFloat((a.talk || 0).toFixed(2)), parseFloat((a.acw || 0).toFixed(2)), parseFloat((a.avgT || 0).toFixed(2)), parseFloat((a.avgC || 0).toFixed(2)), a.site
        ];
      } else {
        const c = a.cph === -1 ? null : parseFloat(a.cph.toFixed(2));
        return [
          a.hr, a.name, a.email, a.tl, a.sv, a.chats, parseFloat(a.aht.toFixed(2)), parseFloat(a.hours.toFixed(2)), c ?? 'N/A', a.site, a.lob
        ];
      }
    });

    const aHeaders = type === 'AHT' 
      ? ['HR', 'Name', 'Email', 'First', 'Sec', 'Chats', 'AHT', 'Total Talk time', 'Total CW', 'Average Talk time', 'ACW', 'Site']
      : ['HR', 'Name', 'Email', 'First', 'Sec', 'Chats', 'AHT (s)', 'Net Hrs', 'CPH', 'Site', 'LOB'];
    const aWidths = type === 'AHT'
      ? [10, 25, 30, 22, 22, 8, 8, 12, 10, 15, 8, 12]
      : [10, 25, 30, 22, 22, 8, 10, 10, 10, 12, 12];
      
    const aTotals = type === 'AHT'
      ? ['Overall', '', '', '', '', fTot.chats, oAHT, parseFloat(fTot.talk.toFixed(2)), parseFloat(fTot.acw.toFixed(2)), '', '', '']
      : ['Overall', '', '', '', '', fTot.chats, oAHT, parseFloat(fTot.hours.toFixed(2)), oCPH ?? 'N/A', '', ''];
      
    drawTable(ws, 1, 1, aHeaders, aWidths, agentRows, aTotals);

    // SV Data (Filtered)
    const svMap: any = {};
    filteredAgents.forEach((a: any) => {
      if (!svMap[a.sv]) svMap[a.sv] = { name: a.sv, chats: 0, totalHandle: 0, talk: 0, acw: 0, hours: 0 };
      svMap[a.sv].chats += a.chats;
      svMap[a.sv].totalHandle += (a.totalHandle || 0);
      svMap[a.sv].talk += (a.talk || 0);
      svMap[a.sv].acw += (a.acw || 0);
      svMap[a.sv].hours += (a.hours || 0);
    });
    const svs = Object.values(svMap).sort((a: any, b: any) => b.chats - a.chats);
    
    const svRows = svs.map((s: any) => {
      const saht = s.chats > 0 ? (s.totalHandle / s.chats) : 0;
      if (type === 'AHT') {
        return [
          s.name, s.chats, parseFloat(saht.toFixed(2)), parseFloat(s.talk.toFixed(2)), parseFloat(s.acw.toFixed(2)), s.chats > 0 ? parseFloat((s.talk / s.chats).toFixed(2)) : 0, s.chats > 0 ? parseFloat((s.acw / s.chats).toFixed(2)) : 0
        ];
      } else {
        const scph = s.hours >= 0.016 ? (s.chats / s.hours) : -1;
        return [
          s.name, s.chats, parseFloat(saht.toFixed(2)), parseFloat(s.hours.toFixed(2)), scph === -1 ? 'N/A' : parseFloat(scph.toFixed(2))
        ];
      }
    });
    const sHeaders = type === 'AHT'
      ? ['Sec', 'Chats', 'AHT', 'Total Talk time', 'Total CW', 'Average Talk time', 'ACW']
      : ['Sec', 'Chats', 'AHT (s)', 'Net Hrs', 'CPH'];
    const sWidths = type === 'AHT'
      ? [22, 8, 8, 12, 10, 15, 8]
      : [22, 8, 10, 10, 10];
    const sTotals = type === 'AHT'
      ? ['Overall', fTot.chats, oAHT, parseFloat(fTot.talk.toFixed(2)), parseFloat(fTot.acw.toFixed(2)), '', '']
      : ['Overall', fTot.chats, oAHT, parseFloat(fTot.hours.toFixed(2)), oCPH ?? 'N/A'];

    const nextRowAfterSV = drawTable(ws, 1, aHeaders.length + 2, sHeaders, sWidths, svRows, sTotals);

    // TL Data (Filtered)
    const tlMap: any = {};
    filteredAgents.forEach((a: any) => {
      const key = `${a.sv}|${a.tl}`;
      if (!tlMap[key]) tlMap[key] = { first: a.tl, sec: a.sv, chats: 0, totalHandle: 0, talk: 0, acw: 0, hours: 0 };
      tlMap[key].chats += a.chats;
      tlMap[key].totalHandle += (a.totalHandle || 0);
      tlMap[key].talk += (a.talk || 0);
      tlMap[key].acw += (a.acw || 0);
      tlMap[key].hours += (a.hours || 0);
    });
    const tls = Object.values(tlMap).sort((a: any, b: any) => b.chats - a.chats);

    const tlRows = tls.map((t: any) => {
      const taht = t.chats > 0 ? (t.totalHandle / t.chats) : 0;
      if (type === 'AHT') {
        return [
          t.first, t.sec, t.chats, parseFloat(taht.toFixed(2)), parseFloat(t.talk.toFixed(2)), parseFloat(t.acw.toFixed(2)), t.chats > 0 ? parseFloat((t.talk / t.chats).toFixed(2)) : 0, t.chats > 0 ? parseFloat((t.acw / t.chats).toFixed(2)) : 0
        ];
      } else {
        const tcph = t.hours >= 0.016 ? (t.chats / t.hours) : -1;
        return [
          t.first, t.sec, t.chats, parseFloat(taht.toFixed(2)), parseFloat(t.hours.toFixed(2)), tcph === -1 ? 'N/A' : parseFloat(tcph.toFixed(2))
        ];
      }
    });
    
    const tHeaders = type === 'AHT'
      ? ['First', 'Sec', 'Chats', 'AHT', 'Total Talk time', 'Total CW', 'Average Talk time', 'ACW']
      : ['First', 'Sec', 'Chats', 'AHT (s)', 'Net Hrs', 'CPH'];
    const tWidths = type === 'AHT'
      ? [22, 22, 8, 8, 12, 10, 15, 8]
      : [22, 22, 8, 10, 10, 10];
    const tTotals = type === 'AHT'
      ? ['Overall', '', fTot.chats, oAHT, parseFloat(fTot.talk.toFixed(2)), parseFloat(fTot.acw.toFixed(2)), '', '']
      : ['Overall', '', fTot.chats, oAHT, parseFloat(fTot.hours.toFixed(2)), oCPH ?? 'N/A'];
      
    drawTable(ws, nextRowAfterSV + 2, aHeaders.length + 2, tHeaders, tWidths, tlRows, tTotals);

    // Driver Data
    const dRows = (data.drivers || []).map((d: any) => {
      if (type === 'AHT') {
        return [
          d.name, d.chats, parseFloat(d.aht.toFixed(2)), parseFloat((d.talk || 0).toFixed(2)), parseFloat((d.acw || 0).toFixed(2))
        ];
      } else {
        const dcph = d.hours && d.hours >= 0.016 ? (d.chats / d.hours) : -1;
        return [
          d.name, d.chats, parseFloat(d.aht.toFixed(2)), parseFloat((d.hours || 0).toFixed(2)), dcph === -1 ? 'N/A' : parseFloat(dcph.toFixed(2))
        ];
      }
    });
    
    const dHeaders = type === 'AHT'
      ? ['Contact Driver', 'Chats', 'AHT', 'Talk Time', 'ACW']
      : ['Contact Driver', 'Chats', 'AHT (s)', 'Net Hrs', 'CPH'];
    const dWidths = type === 'AHT'
      ? [25, 8, 8, 12, 10]
      : [25, 8, 10, 10, 10];
    const dTotals = type === 'AHT'
      ? ['Overall', data.totals.chats, data.totals.chats > 0 ? parseFloat((data.totals.totalHandle / data.totals.chats).toFixed(2)) : 0, parseFloat(data.totals.talk?.toFixed(2) || 0), parseFloat(data.totals.acw?.toFixed(2) || 0)]
      : ['Overall', data.totals.chats, data.totals.chats > 0 ? parseFloat((data.totals.totalHandle / data.totals.chats).toFixed(2)) : 0, parseFloat(data.totals.hours?.toFixed(2) || 0), 'N/A'];

    drawTable(ws, 1, aHeaders.length + sHeaders.length + 4, dHeaders, dWidths, dRows, dTotals);
  };

  // 1. Chats Tab
  createCombinedSheet('Chats', () => true);

  // 2. Chats Per Interval Tab
  const wsInt = wb.addWorksheet('Chats Per Interval', { views: [{ state: 'frozen', ySplit: 1 }] });
  const iHeaders = type === 'AHT'
    ? ['Interval', 'Chats', 'AHT', 'Talk Time', 'ACW']
    : ['Interval', 'Chats', 'AHT (s)', 'Net Hrs', 'CPH'];
  const iWidths = [12, 10, 10, 12, 10];
  const iRows = data.intervals.map((i: any) => {
    if (type === 'AHT') {
      return [i.label, i.chats, parseFloat(i.aht.toFixed(2)), parseFloat((i.talk || 0).toFixed(2)), parseFloat((i.acw || 0).toFixed(2))];
    } else {
      const c = i.cph === -1 ? null : parseFloat(i.cph.toFixed(2));
      return [i.label, i.chats, parseFloat(i.aht.toFixed(2)), parseFloat((i.hours || 0).toFixed(2)), c ?? 'N/A'];
    }
  });
  const iTot = type === 'AHT'
    ? ['Overall', data.totals.chats, data.totals.chats > 0 ? parseFloat((data.totals.totalHandle / data.totals.chats).toFixed(2)) : 0, parseFloat(data.totals.talk?.toFixed(2) || 0), parseFloat(data.totals.acw?.toFixed(2) || 0)]
    : ['Overall', data.totals.chats, data.totals.chats > 0 ? parseFloat((data.totals.totalHandle / data.totals.chats).toFixed(2)) : 0, parseFloat(data.totals.hours?.toFixed(2) || 0), data.totals.hours > 0 ? parseFloat((data.totals.chats / data.totals.hours).toFixed(2)) : 'N/A'];
  drawTable(wsInt, 1, 1, iHeaders, iWidths, iRows, iTot);

  // 3. Alex & Assiut Tab
  createCombinedSheet('Alex & Assiut', (a: any) => {
    const s = String(a.site).toLowerCase();
    return s.includes('alex') || s.includes('assuit') || s.includes('assiut');
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `WFM_${type}_Report_${dateStr}.xlsx`);
}
