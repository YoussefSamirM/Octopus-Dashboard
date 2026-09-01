import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export type ShiftMode = 'std' | 'ovn';

export interface AgentImpact {
  email: string;
  hr: string;
  name: string;
  tl: string;
  osv: string;
  durMs: number;
}

export interface ProcessedInterval {
  sk: number;
  iso: string;
  label: string;
  req: number;
  act: number;
  bill: number;
  over: number;
  lost: number;
  granted?: number;
  grantedBill?: number;
  agents?: AgentImpact[];
  unactivities?: { 
    email: string; 
    name: string; 
    type: string; 
    durSecs: number;
    startMs?: number;
    endMs?: number;
    overlapStart?: number;
    overlapEnd?: number;
  }[];
}

export interface ProcessedLOB {
  req: number;
  act: number;
  bill: number;
  over: number;
  lost: number;
  sch: number;
  abs: number;
  granted?: number;
  grantedBill?: number;
  intervals: ProcessedInterval[];
}

export interface ProcessedDaySummary {
  [key: string]: any;
  Total: ProcessedLOB;
  ICView?: ProcessedLOB; // Combined + TPro
}

export interface ProcessedDay {
  std: ProcessedDaySummary;
  ovn: ProcessedDaySummary;
}

interface InvoiceState {
  rawStatusParsed: any[];
  agentInfo: Record<string, any>;
  globalProcessedData: Record<string, ProcessedDay>;
  sortedDates: string[];
  maxObservedMs: number;
  currentShiftMode: ShiftMode;
  isLoading: boolean;
  error: string | null;
  navState: {
    view: "home" | "lob" | "interval" | "agents" | "analysis";
    lobId: string | null;
    date: string | null;
    sk: number | null;
  };

  setNavState: (navState: Partial<InvoiceState['navState']>) => void;
  setShiftMode: (mode: ShiftMode) => void;
  parseStatusCSV: (file: File) => Promise<number>;
  processOfflineFiles: (startDate: string, endDate: string, reqFile: File, skillsFile: File, absFile: File, breaksFile: File | null, grantedFile: File | null) => Promise<void>;
  clearData: () => void;
  loadFromServer: () => Promise<void>;
}

const LOBs = [
  { id: 'Combined', title: 'Combined' },
  { id: 'TPro', title: 'T-Pro' },
  { id: 'GHC', title: 'GHC' },
  { id: 'TMart-FU', title: 'T-Mart FU' }
];

function groupLOB(raw: string) {
  if (!raw) return "Unknown LOB";
  let l = String(raw).toLowerCase().trim().replace(/[\s\-\_\.]/g, '');
  if (l.includes('supportnonpilot') || l.includes('supportnonpolit') || l.includes('nonpilot') || l.includes('support')) return "Combined";
  if (l.includes('tmart') && (l.includes('followup') || l.includes('fu'))) return "TMart-FU";
  if (l.includes('tmart') || l.includes('fcr') || l.includes('delivery') || l.includes('pickup') || l.includes('dp')) return "Combined";
  if (l.includes('tpro') || l.includes('nursery')) return "TPro";
  if (l.includes('ghc')) return "GHC";
  return String(raw).trim();
}

function getDatesInRange(sDateStr: string, eDateStr: string, maxMs: number) {
  let dates = [];
  let curr = new Date(sDateStr + "T00:00:00");
  let endStr = eDateStr;
  if (!endStr && maxMs > 0) endStr = new Date(maxMs).toISOString().split('T')[0];
  if (!endStr) endStr = sDateStr;
  let end = new Date(endStr + "T00:00:00");
  end.setDate(end.getDate() + 1);
  while (curr <= end) {
    let y = curr.getFullYear(), m = String(curr.getMonth() + 1).padStart(2, '0'), d = String(curr.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function parseDurationSecs(val: any) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Math.round(val * 24 * 3600); 
  var pts = val.toString().replace(/[a-zA-Z\s]/g, '').split(':');
  var h = parseInt(pts[0], 10) || 0;
  var m = pts.length > 1 ? parseInt(pts[1], 10) : 0;
  var s = pts.length > 2 ? parseInt(pts[2], 10) : 0;
  return (h * 3600) + (m * 60) + s;
}

function parseInterval(str: string) {
  let s = String(str).toLowerCase().trim();
  let isPM = s.includes('pm'), isAM = s.includes('am');
  let tm = s.replace(/[^0-9:]/g, '').split(':');
  if (tm.length > 0 && tm[0] !== '') {
      let th = parseInt(tm[0], 10), tmins = tm.length > 1 ? parseInt(tm[1], 10) : 0;
      if (isPM && th !== 12) th += 12; if (isAM && th === 12) th = 0;
      return th * 60 + tmins;
  }
  return -1;
}

function aggregateShift(intervals: any[], absStats: any): ProcessedLOB {
  let dayData: ProcessedLOB = { 
    req: 0, 
    act: 0, 
    bill: 0, 
    over: 0, 
    lost: 0, 
    sch: absStats?.hc || 0, 
    abs: absStats?.abs || 0, 
    granted: 0, 
    grantedBill: 0, 
    intervals: [] 
  };
  
  const processedIntervals = intervals.map(intObj => {
    let hR = Math.floor(intObj.sk / 60), mR = intObj.sk % 60;
    let lbl = `${hR}:${mR === 0 ? '00' : '30'}`;
    
    let req = intObj.req || 0;
    let act = intObj.act || 0;
    let rawBill = intObj.bill || 0;
    
    // If actual is >= req, interval is fully covered -> bill = req
    let bill = act >= req ? req : Math.min(rawBill, req);
    
    let over = act > req ? act - req : 0;
    let lost = act < req ? req - Math.max(act, bill) : 0;

    dayData.req += req;
    dayData.act += act;
    dayData.bill += bill;
    dayData.granted += (intObj.granted || 0);
    dayData.grantedBill += (intObj.grantedBill || 0);

    return {
      ...intObj,
      label: lbl,
      req,
      act,
      bill,
      over,
      lost,
      granted: intObj.granted || 0,
      grantedBill: intObj.grantedBill || 0,
      unactivities: intObj.unactivities || []
    };
  });

  if (dayData.act > dayData.req) {
    dayData.over = dayData.act - dayData.req;
    dayData.lost = 0;
  } else {
    dayData.lost = dayData.req - dayData.act;
    dayData.over = 0;
  }

  dayData.intervals = processedIntervals;
  return dayData;
}

function combineLOBs(lobsData: ProcessedLOB[]): ProcessedLOB {
  let req=0, act=0, bill=0, over=0, lost=0, sch=0, abs=0, granted=0, grantedBill=0;
  let intervalsMap: Record<number, ProcessedInterval> = {};

  lobsData.forEach(l => {
    req += l.req; act += l.act; sch += l.sch; abs += l.abs; 
    granted += (l.granted || 0); grantedBill += (l.grantedBill || 0);
    l.intervals.forEach(int => {
      if (!intervalsMap[int.sk]) {
        intervalsMap[int.sk] = { 
          sk: int.sk, 
          iso: int.iso, 
          label: int.label, 
          req: 0, 
          act: 0, 
          bill: 0, 
          over: 0, 
          lost: 0, 
          granted: 0, 
          grantedBill: 0, 
          unactivities: [] 
        };
      }
      intervalsMap[int.sk].req += int.req;
      intervalsMap[int.sk].act += int.act;
      intervalsMap[int.sk].bill += int.bill;
      intervalsMap[int.sk].granted = (intervalsMap[int.sk].granted || 0) + (int.granted || 0);
      intervalsMap[int.sk].grantedBill = (intervalsMap[int.sk].grantedBill || 0) + (int.grantedBill || 0);
      if (int.unactivities && int.unactivities.length > 0) {
        intervalsMap[int.sk].unactivities = [...(intervalsMap[int.sk].unactivities || []), ...int.unactivities];
      }
    });
  });

  let totalCombinedBill = 0;
  let combinedIntervals = Object.values(intervalsMap).sort((a,b) => a.sk - b.sk).map(int => {
    // Cross-coverage: If act >= req, pooledBill = req
    let pooledBill = Math.min(int.act, int.req);
    let intBill = Math.max(int.bill, pooledBill);
    if (int.act >= int.req) {
      intBill = int.req;
    }
    intBill = Math.min(intBill, int.req);
    totalCombinedBill += intBill;

    let o = int.act > int.req ? int.act - int.req : 0;
    let l = int.act < int.req ? int.req - Math.max(int.act, intBill) : 0;
    
    // Merge unactivities for same agent if there are duplicates from different lobs
    let mergedUnacts: Record<string, any> = {};
    (int.unactivities || []).forEach(u => {
      let key = u.email + '_' + u.type;
      if (!mergedUnacts[key]) mergedUnacts[key] = { ...u };
      else mergedUnacts[key].durSecs = Math.max(mergedUnacts[key].durSecs, u.durSecs);
    });
    
    return { ...int, bill: intBill, over: o, lost: l, unactivities: Object.values(mergedUnacts) };
  });

  if (act > req) { over = act - req; lost = 0; } else { lost = req - act; over = 0; }

  return { req, act, bill: totalCombinedBill, over, lost, sch, abs, granted, grantedBill, intervals: combinedIntervals };
}


function normalizeLoadedData(
  data: Record<string, ProcessedDay>,
  rawStatus: any[],
  agentInfo: Record<string, any>
): Record<string, ProcessedDay> {
  if (!data) return {};
  const normalized: Record<string, ProcessedDay> = {};

  Object.keys(data).forEach((isoDate) => {
    const day = data[isoDate];
    if (!day) return;
    normalized[isoDate] = {
      std: {} as ProcessedDaySummary,
      ovn: {} as ProcessedDaySummary,
    };

    (["std", "ovn"] as ShiftMode[]).forEach((shift) => {
      const daySummary = day[shift];
      if (!daySummary) return;

      const lobIds = ["Combined", "TPro", "GHC", "TMart-FU"];
      const processedLobs: ProcessedLOB[] = [];

      lobIds.forEach((lobId) => {
        const lob = daySummary[lobId];
        if (!lob || !lob.intervals) return;

        let totalReq = 0,
          totalAct = 0,
          totalBill = 0,
          totalGranted = 0,
          totalGrantedBill = 0;

        const normalizedIntervals = lob.intervals.map(
          (int: ProcessedInterval) => {
            let req = int.req || 0;
            let act = int.act || 0;
            let rawBill = int.bill || 0;
            let bill = rawBill;

            let granted = int.granted || 0;
            let grantedBill = int.grantedBill || 0;
            if (granted > 0 && grantedBill === 0) {
              grantedBill = granted;
            }

            // If actual covers requirement or granted covers shortage -> bill = req (Pass 100%)
            let isPass = act >= req || rawBill >= req || (grantedBill > 0 && (act + grantedBill >= req || rawBill + grantedBill >= req));
            if (isPass) {
              bill = req;
            } else {
              bill = Math.min(rawBill, req);
            }
            let over = act > req ? act - req : 0;
            let lost = isPass ? 0 : (act < req ? req - Math.max(act, bill) : 0);

            totalReq += req;
            totalAct += act;
            totalBill += bill;
            totalGranted += granted;
            totalGrantedBill += grantedBill;

            let unacts = int.unactivities || [];
            if (unacts.length === 0 && rawStatus && rawStatus.length > 0 && bill < req) {
              let intStartMs =
                new Date(isoDate + "T00:00:00").getTime() + int.sk * 60 * 1000;
              let intEndMs = intStartMs + 30 * 60 * 1000;
              rawStatus.forEach((log: any) => {
                if (
                  log.isOOQ ||
                  log.status?.includes("BREAK") ||
                  log.status?.includes("LUNCH") ||
                  log.status?.includes("COACH") ||
                  log.status?.includes("UNAVAIL")
                ) {
                  let info = agentInfo[log.email];
                  let matchesLob =
                    lobId === "Combined" ||
                    info?.lobs?.[isoDate] === lobId ||
                    !info?.lobs?.[isoDate];
                  if (matchesLob) {
                    let overlapStart = Math.max(log.start, intStartMs);
                    let overlapEnd = Math.min(log.end, intEndMs);
                    if (overlapEnd > overlapStart) {
                      unacts.push({
                        email: log.email,
                        name: info?.name || log.name || log.email,
                        type: log.status,
                        startMs: log.start,
                        endMs: log.end,
                        overlapStart,
                        overlapEnd,
                        durSecs: Math.round((overlapEnd - overlapStart) / 1000),
                      });
                    }
                  }
                }
              });
            }

            return {
              ...int,
              req,
              act,
              bill,
              over,
              lost,
              granted: int.granted || 0,
              grantedBill: int.grantedBill || 0,
              unactivities: unacts,
            };
          }
        );

        const lobResult: ProcessedLOB = {
          ...lob,
          req: totalReq,
          act: totalAct,
          bill: totalBill,
          over: totalAct > totalReq ? totalAct - totalReq : 0,
          lost: totalAct < totalReq ? totalReq - totalAct : 0,
          granted: totalGranted,
          grantedBill: totalGrantedBill,
          intervals: normalizedIntervals,
        };

        normalized[isoDate][shift][lobId] = lobResult;
        processedLobs.push(lobResult);
      });

      normalized[isoDate][shift].Total = combineLOBs(processedLobs);

      let icViewLobs = [];
      if (normalized[isoDate][shift]["Combined"])
        icViewLobs.push(normalized[isoDate][shift]["Combined"]);
      if (normalized[isoDate][shift]["TPro"])
        icViewLobs.push(normalized[isoDate][shift]["TPro"]);
      normalized[isoDate][shift].ICView = combineLOBs(icViewLobs);
    });
  });

  return normalized;
}

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set, get) => ({
      rawStatusParsed: [],
      agentInfo: {},
      globalProcessedData: {},
      sortedDates: [],
      maxObservedMs: 0,
      currentShiftMode: 'std',
      isLoading: false,
      error: null,
      navState: {
        view: "home",
        lobId: null,
        date: null,
        sk: null,
      },

      setNavState: (navState) => set((state) => ({ navState: { ...state.navState, ...navState } })),
      setShiftMode: (mode) => set({ currentShiftMode: mode }),

      clearData: () => set({
        rawStatusParsed: [],
        agentInfo: {},
        globalProcessedData: {},
        sortedDates: [],
        maxObservedMs: 0,
        currentShiftMode: 'std',
        isLoading: false,
        error: null,
        navState: {
          view: "home",
          lobId: null,
          date: null,
          sk: null,
        },
      }),

      loadFromServer: async () => {
        set({ isLoading: true, error: null });
        try {
           const { data, error: downloadError } = await supabase.storage
             .from('uploads')
             .download('invoice_data.json', {
               transform: {
                 quality: 100
               }
             });
             
           if (downloadError) {
             console.error("Supabase download error:", downloadError);
             const { data: pubData } = supabase.storage.from('uploads').getPublicUrl('invoice_data.json');
             if (pubData && pubData.publicUrl) {
                const res = await fetch(`${pubData.publicUrl}?t=${new Date().getTime()}`);
                if (res.ok) {
                  const text = await res.text();
                  const parsed = JSON.parse(text);
                  const normalizedData = normalizeLoadedData(
                    parsed.globalProcessedData || {},
                    parsed.rawStatusParsed || [],
                    parsed.agentInfo || {}
                  );
                  set({ 
                    globalProcessedData: normalizedData,
                    sortedDates: parsed.sortedDates || [],
                    agentInfo: parsed.agentInfo || {},
                    rawStatusParsed: parsed.rawStatusParsed || [],
                    isLoading: false 
                  });
                  return;
                }
             }
             set({ error: downloadError.message, isLoading: false });
             return;
           }
           
           if (!data) {
             set({ error: "No data received from server", isLoading: false });
             return;
           }
           
           const text = await data.text();
           const parsed = JSON.parse(text);
           const normalizedData = normalizeLoadedData(
             parsed.globalProcessedData || {},
             parsed.rawStatusParsed || [],
             parsed.agentInfo || {}
           );
           
           set({ 
             globalProcessedData: normalizedData,
             sortedDates: parsed.sortedDates || [],
             agentInfo: parsed.agentInfo || {},
             rawStatusParsed: parsed.rawStatusParsed || [],
             isLoading: false 
           });
        } catch (e: any) {
           console.error("loadFromServer exception:", e);
           set({ error: e.message || "Failed to load data from server", isLoading: false });
        }
      },

      parseStatusCSV: (file) => {
    set({ isLoading: true, error: null });
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        worker: true, 
        complete: (results) => {
          try {
            const data = results.data as any[];
            if (data.length === 0) throw new Error("CSV is empty");

            const eKey = Object.keys(data[0]).find(h => h.toLowerCase().includes('email') || h.toLowerCase() === 'sf user' || h.toLowerCase() === 'agent_email');
            const sKey = Object.keys(data[0]).find(h => h.toLowerCase() === 'status');
            const startKey = Object.keys(data[0]).find(h => h.toLowerCase().includes('start') || h.toLowerCase() === 'date');
            const endKey = Object.keys(data[0]).find(h => h.toLowerCase().includes('end'));

            if (!eKey || !sKey || !startKey || !endKey) throw new Error("Missing required columns in CSV");

            let tempLogs: any[] = [];
            let maxMs = 0;

            data.forEach(row => {
              const emailRaw = row[eKey];
              if (!emailRaw) return;
              const status = row[sKey] ? String(row[sKey]).toUpperCase().trim() : '';
              const st = row[startKey] ? new Date(row[startKey]).getTime() : null;
              const enStr = row[endKey];
              const en = enStr && enStr.trim() !== '' ? new Date(enStr).getTime() : new Date().getTime();

              if (st && en && !isNaN(st) && !isNaN(en) && en > st) {
                let isOnline = status.includes('ONLINE');
                let isOOQ = status === 'TRAINING/QA/MEETING' || status.includes('TRAIN') || status.includes('QA') || status.includes('MEET') || status.includes('COACH') || status.includes('SESSION') || status.includes('SUPPORT');
                let isBreak = status.includes('BREAK') || status.includes('LUNCH') || status.includes('UNAVAIL') || status.includes('TOILET') || status.includes('NESTING') || status.includes('HEALTH');
                if (isOnline || isOOQ || isBreak) {
                  if (st > maxMs) maxMs = st;
                  if (en > maxMs) maxMs = en;
                  const cleanEmail = String(emailRaw).toLowerCase().trim();
                  tempLogs.push({ email: cleanEmail, start: st, end: en, status, name: cleanEmail, isOOQ, isBreak });
                }
              }
            });

            const agentGroups: Record<string, any[]> = {};
            tempLogs.forEach(log => {
              if (!agentGroups[log.email]) agentGroups[log.email] = [];
              agentGroups[log.email].push(log);
            });

            const parsed: any[] = [];
            Object.keys(agentGroups).forEach(email => {
              const logs = agentGroups[email].sort((a, b) => a.start - b.start);
              if (logs.length > 0) {
                const merged = [logs[0]];
                for (let i = 1; i < logs.length; i++) {
                  const curr = logs[i];
                  const last = merged[merged.length - 1];
                  if (curr.start <= last.end && curr.status === last.status) { 
                    last.end = Math.max(last.end, curr.end); 
                  } else { 
                    merged.push(curr); 
                  }
                }
                merged.forEach(m => parsed.push(m));
              }
            });

            set({ rawStatusParsed: parsed, maxObservedMs: maxMs, isLoading: false });
            resolve(parsed.length);
          } catch (e: any) {
            set({ isLoading: false });
            reject(e.message);
          }
        },
        error: (err) => { set({ isLoading: false }); reject(err.message); }
      });
    });
  },

  processOfflineFiles: async (startDate, endDate, reqFile, skillsFile, absFile, breaksFile, grantedFile) => {
    set({ isLoading: true, error: null });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      const { rawStatusParsed, maxObservedMs } = get();
      if (rawStatusParsed.length === 0) throw new Error("Parse Master Log CSV first");

      const reqDates = getDatesInRange(startDate, endDate, maxObservedMs);
      
      const dateTargets = reqDates.map(function(dStr) {
          var dObj = new Date(dStr + "T00:00:00");
          var mNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
          return {
              iso: dStr,
              strMatch: new RegExp("(^|\\D)0?" + dObj.getDate() + "(?:st|nd|rd|th)?\\-?" + mNames[dObj.getMonth()], "i"),
              y: dObj.getFullYear(), m: dObj.getMonth(), d: dObj.getDate(),
              monthStr: mNames[dObj.getMonth()]
          };
      });

      // 1. Process Skills Matrix
      const skillsDataBuffer = await skillsFile.arrayBuffer();
      const skillsWb = XLSX.read(skillsDataBuffer, { type: 'array' });
      const sSheetName = skillsWb.SheetNames[0];
      const sDataDisp = XLSX.utils.sheet_to_json<any[]>(skillsWb.Sheets[sSheetName], {header: 1, raw: false, defval: ""});
      
      let localAgentInfo: Record<string, any> = {};
      let sfUserIdx = -1, hrIdx = -1, nameIdx = -1, tlIdx = -1, osvIdx = -1;
      let headerRowIdx = -1;
      let dateColMapSkills: Record<string, number> = {};

      for(let r=0; r<Math.min(20, sDataDisp.length); r++) {
          if(!sDataDisp[r]) continue;
          for(let c=0; c<sDataDisp[r].length; c++) {
              let cell = String(sDataDisp[r][c]).toLowerCase().trim();
              if(!cell) continue;

              if(sfUserIdx === -1 && (cell === 'sf user' || cell.includes('email') || cell === 'agent_email')) {
                  sfUserIdx = c; headerRowIdx = r;
              }
              if(cell === 'hr id' || cell === 'hr') hrIdx = c;
              if(cell === 'agent name' || cell === 'name' || cell === 'agent_name') nameIdx = c;
              if(cell === 'tl' || cell === 'team leader') tlIdx = c;
              if(cell === 'osv') osvIdx = c;

              dateTargets.forEach(dt => {
                  if(dateColMapSkills[dt.iso] === undefined) {
                      if(dt.strMatch.test(cell)) {
                          dateColMapSkills[dt.iso] = c;
                      }
                  }
              });
          }
          if(sfUserIdx !== -1) break;
      }

      if(sfUserIdx !== -1) {
          for(let row = headerRowIdx + 1; row < sDataDisp.length; row++) {
              let email = sDataDisp[row][sfUserIdx];
              if(email) {
                  let cleanEmail = email.toString().toLowerCase().trim();
                  localAgentInfo[cleanEmail] = {
                      hr: hrIdx !== -1 ? sDataDisp[row][hrIdx] : '-',
                      name: nameIdx !== -1 ? sDataDisp[row][nameIdx] : cleanEmail,
                      tl: tlIdx !== -1 ? sDataDisp[row][tlIdx] : '-',
                      osv: osvIdx !== -1 ? sDataDisp[row][osvIdx] : '-',
                      lobs: {}
                  };
                  
                  dateTargets.forEach(dt => {
                      let cIdx = dateColMapSkills[dt.iso];
                      if(cIdx !== undefined) {
                          let lob = sDataDisp[row][cIdx];
                          if(lob) {
                              let cleanLob = lob.toString().trim();
                              if(cleanLob && cleanLob !== '-') {
                                  localAgentInfo[cleanEmail].lobs[dt.iso] = groupLOB(cleanLob);
                              }
                          }
                      }
                  });
              }
          }
      }

      // 2. Process ABS & HC Data
      const absDataBuffer = await absFile.arrayBuffer();
      const absWb = XLSX.read(absDataBuffer, { type: 'array' });
      let dailyAbsData: Record<string, any> = {}; 
      let absSheet = absWb.Sheets[absWb.SheetNames[0]]; 
      let absDataDisp = XLSX.utils.sheet_to_json<any[]>(absSheet, {header: 1, raw: false, defval: ""});
      let absDataRaw = XLSX.utils.sheet_to_json<any[]>(absSheet, {header: 1, raw: true, defval: ""});

      let dateColsAbs: Record<number, string> = {}; 
      for(let r=0; r<Math.min(10, absDataDisp.length); r++) {
          let foundDate = false;
          for(let c=0; c<absDataDisp[r].length; c++) {
              let cell = String(absDataDisp[r][c]).trim();
              dateTargets.forEach(dt => {
                  if(dt.strMatch.test(cell) || cell.includes(dt.d + "-" + dt.monthStr)) {
                      dateColsAbs[c] = dt.iso;
                      foundDate = true;
                  }
              });
          }
          if(foundDate) break; 
      }

      Object.keys(dateColsAbs).forEach(cStr => {
          let c = parseInt(cStr);
          let iso = dateColsAbs[c];
          dailyAbsData[iso] = {};
          for(let r=0; r<absDataDisp.length; r++) {
              let val = String(absDataDisp[r][c]).toLowerCase().replace(/[\s\-\_\.]/g, '');
              let matchedLob = null;
              if(val === 'combined') matchedLob = 'Combined';
              else if(val === 'tpro' || val === 't-pro') matchedLob = 'TPro';
              else if(val === 'ghc') matchedLob = 'GHC';
              else if(val.includes('tmart') && (val.includes('fu') || val.includes('followup'))) matchedLob = 'TMart-FU';

              if(matchedLob) {
                  let hcRaw = absDataRaw[r+1] ? absDataRaw[r+1][c] : 0;
                  let absRaw = absDataRaw[r+3] ? absDataRaw[r+3][c] : 0;
                  let absPercRaw = absDataRaw[r+4] ? absDataRaw[r+4][c] : 0;

                  let absPercVal = 0;
                  if (typeof absPercRaw === 'number') absPercVal = absPercRaw * 100;
                  else absPercVal = parseFloat(String(absPercRaw).replace('%', ''));

                  dailyAbsData[iso][matchedLob] = {
                      hc: parseDurationSecs(hcRaw), 
                      abs: parseDurationSecs(absRaw),
                      absPerc: isNaN(absPercVal) ? 0 : absPercVal
                  };
              }
          }
      });

      // 3. Initialize Master Data storage
      let dailyRawData: Record<string, any> = {}; 
      let sortedDatesOutput: string[] = [];
      for(let i=0; i<reqDates.length - 1; i++) {
          let dIso = reqDates[i];
          sortedDatesOutput.push(dIso);
          dailyRawData[dIso] = {};
          LOBs.forEach(lob => {
              dailyRawData[dIso][lob.id] = {};
              for(let k=0; k<=1410; k+=30) {
                  dailyRawData[dIso][lob.id][k] = { req:0, act:0, bill:0, over:0, lost:0, granted:0, grantedBill:0, ooq:0 };
              }
          });
      }

      const reqDataBuffer = await reqFile.arrayBuffer();
      const masterWb = XLSX.read(reqDataBuffer, { type: 'array' });
      
      masterWb.SheetNames.forEach(sNameOriginal => {
          var sInfo = masterWb.Workbook && masterWb.Workbook.Sheets ? masterWb.Workbook.Sheets.find(s => s.name === sNameOriginal) : null;
          if(sInfo && sInfo.Hidden !== 0) return;

          let sName = sNameOriginal.toLowerCase().trim();
          let matchedDt = dateTargets.find(dt => dt.strMatch.test(sName));
          if(!matchedDt || !dailyRawData[matchedDt.iso]) return;
          
          let dIso = matchedDt.iso;
          let sheetData = XLSX.utils.sheet_to_json<any[]>(masterWb.Sheets[sNameOriginal], {header: 1, raw: false, defval: ""});

          let lobCols: Record<string, {r: number, c: number}> = {};
          for(let r=0; r<Math.min(10, sheetData.length); r++) {
              if(!sheetData[r]) continue;
              for(let c=0; c<sheetData[r].length; c++) {
                  let val = String(sheetData[r][c]).toLowerCase().replace(/[\s\-\_\.]/g, '');
                  let matchedLob = null;
                  if(val === 'combined') matchedLob = 'Combined';
                  else if(val === 'tpro' || val === 't-pro') matchedLob = 'TPro';
                  else if(val === 'ghc') matchedLob = 'GHC';
                  else if(val.includes('tmart') && (val.includes('fu') || val.includes('followup'))) matchedLob = 'TMart-FU';

                  if(matchedLob && !lobCols[matchedLob]) {
                      let intCol = -1;
                      let dataRow = -1;
                      for(let r2=r; r2<Math.min(r+6, sheetData.length); r2++) {
                          if(!sheetData[r2]) continue;
                          for(let c2=Math.max(0, c-4); c2<=c+4; c2++) {
                              if(String(sheetData[r2][c2]).toLowerCase().includes('interval')) {
                                  intCol = c2;
                                  dataRow = r2 + 1;
                                  break;
                              }
                          }
                          if(intCol !== -1) break;
                      }
                      if(intCol !== -1) {
                          lobCols[matchedLob] = { r: dataRow, c: intCol };
                      }
                  }
              }
          }

          Object.keys(lobCols).forEach(lobId => {
              let startRow = lobCols[lobId].r; 
              for(let r=startRow; r<sheetData.length; r++) {
                  if(!sheetData[r]) continue;
                  let intStr = String(sheetData[r][lobCols[lobId].c]).trim();
                  if(!intStr || intStr.toLowerCase().includes('total')) continue;
                  
                  let sk = parseInterval(intStr);
                  if(sk !== -1 && dailyRawData[dIso][lobId][sk]) {
                      let req = parseDurationSecs(sheetData[r][lobCols[lobId].c + 1]);
                      let act = parseDurationSecs(sheetData[r][lobCols[lobId].c + 2]);
                      let bill = parseDurationSecs(sheetData[r][lobCols[lobId].c + 3]);
                      let over = Math.max(0, act - req);
                      let lost = parseDurationSecs(sheetData[r][lobCols[lobId].c + 5]);

                      dailyRawData[dIso][lobId][sk] = { req: req, act: act, bill: bill, over: over, lost: lost, granted: 0, grantedBill: 0, ooq: 0 };
                  }
              }
          });
      });

      // Calculate OOQ from Agent Status Logs
      if (rawStatusParsed && rawStatusParsed.length > 0) {
        rawStatusParsed.forEach(log => {
          if (log.isOOQ) {
            let info = localAgentInfo[log.email];
            if (info) {
              dateTargets.forEach(dt => {
                let lob = info.lobs[dt.iso];
                if (lob && dailyRawData[dt.iso] && dailyRawData[dt.iso][lob]) {
                  for (let k = 0; k <= 1410; k += 30) {
                    let intStartMs = new Date(dt.iso + "T00:00:00").getTime() + (k * 60 * 1000);
                    let intEndMs = intStartMs + (30 * 60 * 1000);
                    let overlapStart = Math.max(log.start, intStartMs);
                    let overlapEnd = Math.min(log.end, intEndMs);
                    if (overlapEnd > overlapStart) {
                      dailyRawData[dt.iso][lob][k].ooq += Math.round((overlapEnd - overlapStart) / 1000);
                    }
                  }
                }
              });
            }
          }
        });
      }

      // Parse Granted Req File if provided
      if (grantedFile) {
        try {
          const grantedDataBuffer = await grantedFile.arrayBuffer();
          const grantedWb = XLSX.read(grantedDataBuffer, { type: 'array' });
          grantedWb.SheetNames.forEach(sNameOriginal => {
            let sName = sNameOriginal.toLowerCase().trim().replace(/[\s\-\_\.]/g, '');
            let matchedLob: string | null = null;
            if(sName === 'combined') matchedLob = 'Combined';
            else if(sName === 'tpro' || sName === 't-pro') matchedLob = 'TPro';
            else if(sName === 'ghc') matchedLob = 'GHC';
            else if(sName.includes('tmart') || sName.includes('fu') || sName.includes('followup')) matchedLob = 'TMart-FU';
            
            if (matchedLob) {
              let sheetData = XLSX.utils.sheet_to_json<any[]>(grantedWb.Sheets[sNameOriginal], {header: 1, raw: false, defval: ""});
              let dateCols: Record<number, string> = {}; 
              let headerRow = -1;
              
              for(let r=0; r<Math.min(10, sheetData.length); r++) {
                if(!sheetData[r]) continue;
                let foundDate = false;
                for(let c=0; c<sheetData[r].length; c++) {
                  let cell = String(sheetData[r][c]).trim();
                  dateTargets.forEach(dt => {
                    if(dt.strMatch.test(cell) || cell.includes(dt.d + "-" + dt.monthStr)) {
                      dateCols[c] = dt.iso;
                      foundDate = true;
                    }
                  });
                }
                if(foundDate) {
                  headerRow = r;
                  break;
                }
              }
              
              if (headerRow !== -1) {
                for(let r=headerRow+1; r<sheetData.length; r++) {
                  if(!sheetData[r] || !sheetData[r][0]) continue;
                  let intStr = String(sheetData[r][0]).trim();
                  if(intStr.toLowerCase().includes('total')) continue;
                  let sk = parseInterval(intStr);
                  if (sk !== -1) {
                    Object.keys(dateCols).forEach(cStr => {
                      let c = parseInt(cStr);
                      let iso = dateCols[c];
                      if (dailyRawData[iso] && dailyRawData[iso][matchedLob] && dailyRawData[iso][matchedLob][sk]) {
                        let grantedVal = parseDurationSecs(sheetData[r][c]);
                        if (grantedVal > 0) {
                          let rd = dailyRawData[iso][matchedLob][sk];
                          rd.granted = grantedVal;
                          rd.req += grantedVal; // Add to REQ as requested
                          
                          // Granted Billable is the approved duration granted
                          rd.grantedBill = grantedVal;
                          rd.bill += rd.grantedBill;
                          rd.act += rd.grantedBill; // Add Granted Billable to Actual
                        }
                      }
                    });
                  }
                }
              }
            }
          });
        } catch (err) {
          console.warn("Failed to parse Granted Req file", err);
        }
      }

      // Parse Breaks File if provided
      let breaksLogs: { email: string; name: string; type: string; startMs: number; endMs: number; iso: string }[] = [];
      if (breaksFile) {
        try {
          const bDataBuffer = await breaksFile.arrayBuffer();
          const bWb = XLSX.read(bDataBuffer, { type: 'array' });
          const bSheet = bWb.Sheets[bWb.SheetNames[0]];
          const bData = XLSX.utils.sheet_to_json<any[]>(bSheet, {header: 1, raw: false, defval: ""});
          
          let eKey = -1, hrKey = -1, nameKey = -1, dayKey = -1, stKey = -1, enKey = -1, typeKey = -1, durKey = -1;
          for (let r=0; r<Math.min(15, bData.length); r++) {
            if (!bData[r]) continue;
            for (let c=0; c<bData[r].length; c++) {
              let val = String(bData[r][c]).toLowerCase().trim();
              if (val.includes('email') || val === 'sf user' || val === 'agent email' || val === 'agent_email') eKey = c;
              if (val === 'hr id' || val === 'hr' || val === 'hrid' || val === 'agent hr') hrKey = c;
              if (val === 'name' || val === 'agent name' || val === 'agent_name') nameKey = c;
              if (val === 'day' || val === 'date') dayKey = c;
              if (val === 'from' || val === 'start time' || val === 'start_time' || val === 'start') stKey = c;
              if (val === 'to' || val === 'end time' || val === 'end_time' || val === 'end') enKey = c;
              if (val.includes('type') || val.includes('activity') || val.includes('status')) typeKey = c;
              if (val.includes('duration') || val.includes('min')) durKey = c;
            }
            if ((eKey !== -1 || hrKey !== -1 || nameKey !== -1) && (stKey !== -1 || dayKey !== -1)) break;
          }

          function parseTimeComponents(val: any) {
            if (val === undefined || val === null || val === '') return null;
            if (typeof val === 'number') {
              let totalSec = Math.round(val * 86400);
              let h = Math.floor(totalSec / 3600);
              let m = Math.floor((totalSec % 3600) / 60);
              let s = totalSec % 60;
              return { h, m, s, crossMidnight: false };
            }
            let s = String(val).trim().toLowerCase();
            let crossMidnight = s.includes('+1');
            let isPM = s.includes('pm'), isAM = s.includes('am');
            let pts = s.replace(/[^0-9:]/g, '').split(':');
            if (pts.length === 0 || pts[0] === '') return null;
            let h = parseInt(pts[0], 10) || 0;
            let m = pts.length > 1 ? parseInt(pts[1], 10) : 0;
            let sec = pts.length > 2 ? parseInt(pts[2], 10) : 0;
            if (isPM && h !== 12) h += 12;
            if (isAM && h === 12) h = 0;
            return { h, m, s: sec, crossMidnight };
          }

          for (let r = 1; r < bData.length; r++) {
            if (!bData[r]) continue;
            let emailRaw = eKey !== -1 ? String(bData[r][eKey] || '').trim() : '';
            let hrRaw = hrKey !== -1 ? String(bData[r][hrKey] || '').trim() : '';
            let nameRaw = nameKey !== -1 ? String(bData[r][nameKey] || '').trim() : '';
            let dayRaw = dayKey !== -1 ? String(bData[r][dayKey] || '').trim() : '';
            let stRaw = stKey !== -1 ? bData[r][stKey] : null;
            let enRaw = enKey !== -1 ? bData[r][enKey] : null;
            let typeRaw = typeKey !== -1 ? String(bData[r][typeKey] || '').trim() : 'Break';
            let durRaw = durKey !== -1 ? parseFloat(String(bData[r][durKey])) : 15;

            if (!emailRaw && !hrRaw && !nameRaw) continue;
            if (!dayRaw && !stRaw) continue;

            // Agent identification & linking
            let matchedEmail = '';
            if (emailRaw && localAgentInfo[emailRaw.toLowerCase()]) {
              matchedEmail = emailRaw.toLowerCase();
            } else {
              const found = Object.keys(localAgentInfo).find(em => {
                const info = localAgentInfo[em];
                if (hrRaw && String(info.hr).trim() !== '-' && String(info.hr).toLowerCase().trim() === hrRaw.toLowerCase()) return true;
                if (nameRaw && String(info.name).trim() !== '-' && (
                  String(info.name).toLowerCase().trim() === nameRaw.toLowerCase() ||
                  String(info.name).toLowerCase().includes(nameRaw.toLowerCase()) ||
                  nameRaw.toLowerCase().includes(String(info.name).toLowerCase().trim())
                )) return true;
                if (emailRaw && em.includes(emailRaw.toLowerCase())) return true;
                return false;
              });
              if (found) matchedEmail = found;
            }

            if (!matchedEmail) {
              matchedEmail = emailRaw.toLowerCase() || nameRaw || hrRaw || 'unknown';
            }

            if (!localAgentInfo[matchedEmail]) {
              localAgentInfo[matchedEmail] = {
                hr: hrRaw || '-',
                name: nameRaw || matchedEmail,
                tl: '-',
                osv: '-',
                lobs: {}
              };
            }

            // Find matching Date Target
            let matchedDt: any = null;
            if (dayRaw) {
              let dLower = dayRaw.toLowerCase().trim();
              matchedDt = dateTargets.find(dt => 
                dt.strMatch.test(dLower) ||
                dLower.includes(dt.d + '-' + dt.monthStr) ||
                dLower.includes(dt.monthStr + '-' + dt.d) ||
                dLower === dt.iso
              );
            }
            if (!matchedDt && dateTargets.length === 1) {
              matchedDt = dateTargets[0];
            }
            if (!matchedDt) continue;

            // Parse Time
            let stTime = parseTimeComponents(stRaw);
            if (!stTime) continue;
            let startMs = new Date(matchedDt.y, matchedDt.m, matchedDt.d, stTime.h, stTime.m, stTime.s).getTime();

            let enTime = parseTimeComponents(enRaw);
            let endMs = enTime 
              ? new Date(matchedDt.y, matchedDt.m, matchedDt.d, enTime.h, enTime.m, enTime.s).getTime()
              : startMs + (isNaN(durRaw) || durRaw <= 0 ? 15 : durRaw) * 60 * 1000;

            if (enTime?.crossMidnight || endMs <= startMs) {
              endMs += 86400000;
            }

            let tUpper = typeRaw.toUpperCase();
            if (tUpper.includes('ONLINE') || tUpper.includes('LOGIN') || tUpper.includes('NORMAL')) continue;

            breaksLogs.push({
              email: matchedEmail,
              name: localAgentInfo[matchedEmail]?.name || matchedEmail,
              type: typeRaw,
              startMs,
              endMs,
              iso: matchedDt.iso
            });
          }
        } catch (err) {
          console.warn("Failed to parse breaks file", err);
        }
      }

      // 4. Structure Data for STD / OVN
      let processedOutput: Record<string, ProcessedDay> = {};

      sortedDatesOutput.forEach(dIso => {
          let dtNext = new Date(dIso + "T00:00:00"); dtNext.setDate(dtNext.getDate() + 1);
          let nxStr = dtNext.toISOString().split('T')[0];

          let stdDay: ProcessedDaySummary = {} as ProcessedDaySummary;
          let ovnDay: ProcessedDaySummary = {} as ProcessedDaySummary;
          let stdLobs: ProcessedLOB[] = [];
          let ovnLobs: ProcessedLOB[] = [];

          LOBs.forEach(lobConf => {
              let lob = lobConf.id;
              let absStats = dailyAbsData[dIso] && dailyAbsData[dIso][lob] ? dailyAbsData[dIso][lob] : {hc:0, abs:0, absPerc:0};
              
              let getUnactivities = (isoDate: string, sk: number) => {
                  if (!breaksLogs || breaksLogs.length === 0) return [];
                  let intStartMs = new Date(isoDate + "T00:00:00").getTime() + (sk * 60 * 1000);
                  let intEndMs = intStartMs + (30 * 60 * 1000);
                  let unacts: any[] = [];
                  breaksLogs.forEach(b => {
                      if (b.iso === isoDate) {
                          let agentInfo = localAgentInfo[b.email];
                          let agentLob = agentInfo?.lobs?.[isoDate];
                          let matchesLob = (lob === 'Combined') || (agentLob === lob) || (!agentLob);
                          if (matchesLob) {
                              let overlapStart = Math.max(b.startMs, intStartMs);
                              let overlapEnd = Math.min(b.endMs, intEndMs);
                              if (overlapEnd > overlapStart) {
                                  unacts.push({
                                      email: b.email,
                                      name: agentInfo?.name || b.name || b.email,
                                      type: b.type,
                                      startMs: b.startMs,
                                      endMs: b.endMs,
                                      overlapStart,
                                      overlapEnd,
                                      durSecs: Math.round((overlapEnd - overlapStart) / 1000)
                                  });
                              }
                          }
                      }
                  });
                  return unacts;
              };

              let stdInts = [], ovnInts = [];
              for(let k=0; k<=1410; k+=30) {
                  let obj = dailyRawData[dIso][lob][k] || {req:0, act:0, bill:0, over:0, lost:0, granted:0, grantedBill:0};
                  stdInts.push({ sk: k, iso: dIso, req: obj.req, act: obj.act, bill: obj.bill, over: obj.over, lost: obj.lost, granted: obj.granted || 0, grantedBill: obj.grantedBill || 0, unactivities: getUnactivities(dIso, k) });
              }
              for(let k=480; k<=1410; k+=30) {
                  let obj = dailyRawData[dIso][lob][k] || {req:0, act:0, bill:0, over:0, lost:0, granted:0, grantedBill:0};
                  ovnInts.push({ sk: k, iso: dIso, req: obj.req, act: obj.act, bill: obj.bill, over: obj.over, lost: obj.lost, granted: obj.granted || 0, grantedBill: obj.grantedBill || 0, unactivities: getUnactivities(dIso, k) });
              }
              if(dailyRawData[nxStr] && dailyRawData[nxStr][lob]) {
                  for(let k=0; k<=450; k+=30) {
                      let obj = dailyRawData[nxStr][lob][k] || {req:0, act:0, bill:0, over:0, lost:0, granted:0, grantedBill:0};
                      ovnInts.push({ sk: k, iso: nxStr, req: obj.req, act: obj.act, bill: obj.bill, over: obj.over, lost: obj.lost, granted: obj.granted || 0, grantedBill: obj.grantedBill || 0, unactivities: getUnactivities(nxStr, k) });
                  }
              }

              let stdAgg = aggregateShift(stdInts, absStats);
              let ovnAgg = aggregateShift(ovnInts, absStats);
              
              stdDay[lob] = stdAgg;
              ovnDay[lob] = ovnAgg;
              stdLobs.push(stdAgg);
              ovnLobs.push(ovnAgg);
          });

          stdDay.Total = combineLOBs(stdLobs);
          ovnDay.Total = combineLOBs(ovnLobs);

          let stdIcViewLobs = [];
          let ovnIcViewLobs = [];
          if (stdDay['Combined']) stdIcViewLobs.push(stdDay['Combined']);
          if (stdDay['TPro']) stdIcViewLobs.push(stdDay['TPro']);
          if (ovnDay['Combined']) ovnIcViewLobs.push(ovnDay['Combined']);
          if (ovnDay['TPro']) ovnIcViewLobs.push(ovnDay['TPro']);

          stdDay.ICView = combineLOBs(stdIcViewLobs);
          ovnDay.ICView = combineLOBs(ovnIcViewLobs);

          processedOutput[dIso] = { std: stdDay, ovn: ovnDay };
      });

      set({ globalProcessedData: processedOutput, sortedDates: sortedDatesOutput, agentInfo: localAgentInfo, isLoading: false });

    } catch (e: any) {
      console.error(e);
      set({ error: e.message, isLoading: false });
    }
  }
}),
{
  name: 'octopus-invoice-storage',
  partialize: (state) => ({ 
    currentShiftMode: state.currentShiftMode,
    navState: state.navState
  }),
}
));
