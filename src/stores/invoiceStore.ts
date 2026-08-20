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
  agents?: AgentImpact[];
}

export interface ProcessedLOB {
  req: number;
  act: number;
  bill: number;
  over: number;
  lost: number;
  sch: number;
  abs: number;
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
    view: "home" | "lob" | "interval" | "agents";
    lobId: string | null;
    date: string | null;
    sk: number | null;
  };

  setNavState: (navState: Partial<InvoiceState['navState']>) => void;
  setShiftMode: (mode: ShiftMode) => void;
  parseStatusCSV: (file: File) => Promise<number>;
  processOfflineFiles: (startDate: string, endDate: string, reqFile: File, skillsFile: File, absFile: File) => Promise<void>;
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
  if (l.includes('tpro')) return "TPro";
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
  let dayData: ProcessedLOB = { req: 0, act: 0, bill: 0, over: 0, lost: 0, sch: absStats.hc, abs: absStats.abs, intervals: intervals.map(intObj => {
      let hR = Math.floor(intObj.sk / 60), mR = intObj.sk % 60;
      let lbl = `${hR}:${mR === 0 ? '00' : '30'}`;
      return { ...intObj, label: lbl };
  }) };
  
  intervals.forEach(intObj => {
      dayData.req += intObj.req;
      dayData.act += intObj.act;
      dayData.bill += intObj.bill;
  });

  if(dayData.act > dayData.req) {
      dayData.over = dayData.act - dayData.req;
      dayData.lost = 0;
  } else {
      dayData.lost = dayData.req - dayData.act;
      dayData.over = 0;
  }
  return dayData;
}

function combineLOBs(lobsData: ProcessedLOB[]): ProcessedLOB {
  let req=0, act=0, bill=0, over=0, lost=0, sch=0, abs=0;
  let intervalsMap: Record<number, ProcessedInterval> = {};

  lobsData.forEach(l => {
    req += l.req; act += l.act; bill += l.bill; sch += l.sch; abs += l.abs;
    l.intervals.forEach(int => {
      if (!intervalsMap[int.sk]) intervalsMap[int.sk] = { sk: int.sk, iso: int.iso, label: int.label, req: 0, act: 0, bill: 0, over: 0, lost: 0 };
      intervalsMap[int.sk].req += int.req;
      intervalsMap[int.sk].act += int.act;
      intervalsMap[int.sk].bill += int.bill;
    });
  });

  if (act > req) { over = act - req; lost = 0; } else { lost = req - act; over = 0; }

  let combinedIntervals = Object.values(intervalsMap).sort((a,b) => a.sk - b.sk).map(int => {
    let o=0, l=0;
    if (int.act > int.req) o = int.act - int.req; else l = int.req - int.act;
    return { ...int, over: o, lost: l };
  });

  return { req, act, bill, over, lost, sch, abs, intervals: combinedIntervals };
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
           const { data, error: downloadError } = await supabase.storage.from('uploads').download('invoice_data.json');
           if (downloadError || !data) {
             set({ isLoading: false });
             return;
           }
           const text = await data.text();
           const parsed = JSON.parse(text);
           
           set({ 
             globalProcessedData: parsed.globalProcessedData || {},
             sortedDates: parsed.sortedDates || [],
             agentInfo: parsed.agentInfo || {},
             rawStatusParsed: parsed.rawStatusParsed || [],
             isLoading: false 
           });
        } catch (e: any) {
           console.error(e);
           set({ error: e.message, isLoading: false });
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

              if (st && en && !isNaN(st) && !isNaN(en) && status.includes('ONLINE') && en > st) {
                if (st > maxMs) maxMs = st;
                if (en > maxMs) maxMs = en;
                const cleanEmail = String(emailRaw).toLowerCase().trim();
                tempLogs.push({ email: cleanEmail, start: st, end: en, status, name: cleanEmail });
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
                  if (curr.start <= last.end) { 
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

  processOfflineFiles: async (startDate, endDate, reqFile, skillsFile, absFile) => {
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
                  dailyRawData[dIso][lob.id][k] = { req:0, act:0, bill:0, over:0, lost:0 };
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
                      let over = parseDurationSecs(sheetData[r][lobCols[lobId].c + 4]);
                      let lost = parseDurationSecs(sheetData[r][lobCols[lobId].c + 5]);

                      dailyRawData[dIso][lobId][sk] = { req: req, act: act, bill: bill, over: over, lost: lost };
                  }
              }
          });
      });

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
              
              let stdInts = [], ovnInts = [];
              for(let k=0; k<=1410; k+=30) {
                  let obj = dailyRawData[dIso][lob][k] || {req:0, act:0, bill:0, over:0, lost:0};
                  stdInts.push({ sk: k, iso: dIso, req: obj.req, act: obj.act, bill: obj.bill, over: obj.over, lost: obj.lost });
              }
              for(let k=480; k<=1410; k+=30) {
                  let obj = dailyRawData[dIso][lob][k] || {req:0, act:0, bill:0, over:0, lost:0};
                  ovnInts.push({ sk: k, iso: dIso, req: obj.req, act: obj.act, bill: obj.bill, over: obj.over, lost: obj.lost });
              }
              if(dailyRawData[nxStr] && dailyRawData[nxStr][lob]) {
                  for(let k=0; k<=450; k+=30) {
                      let obj = dailyRawData[nxStr][lob][k] || {req:0, act:0, bill:0, over:0, lost:0};
                      ovnInts.push({ sk: k, iso: nxStr, req: obj.req, act: obj.act, bill: obj.bill, over: obj.over, lost: obj.lost });
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
    globalProcessedData: state.globalProcessedData, 
    sortedDates: state.sortedDates, 
    agentInfo: state.agentInfo, 
    currentShiftMode: state.currentShiftMode,
    navState: state.navState
  }),
}
));
