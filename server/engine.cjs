// Prisma will be wired up later

// Configuration
const LOBs = ['Combined', 'TPro', 'GHC', 'TMart-FU'];

function groupLOB(raw) {
  if (!raw) return "Unknown LOB";
  let l = String(raw).toLowerCase().trim().replace(/[\s\-\_\.]/g, '');
  if (l.includes('supportnonpilot') || l.includes('supportnonpolit') || l.includes('nonpilot') || l.includes('support')) return "Combined";
  if (l.includes('tmart') && (l.includes('followup') || l.includes('fu'))) return "TMart-FU";
  if (l.includes('tmart') || l.includes('fcr') || l.includes('delivery') || l.includes('pickup') || l.includes('dp')) return "Combined";
  if (l.includes('tpro')) return "TPro";
  if (l.includes('ghc')) return "GHC";
  return String(raw).trim();
}

function parseMins(str) {
  if (!str || str === "") return 0;
  let pd = new Date(str);
  if (!isNaN(pd.getTime())) return pd.getHours() * 60 + pd.getMinutes();
  let s = String(str).toLowerCase().trim();
  let isPM = s.includes('pm'), isAM = s.includes('am');
  let tm = s.replace(/[^0-9:]/g, '').split(':');
  if (tm.length > 0 && tm[0] !== '') {
    let th = parseInt(tm[0], 10), tmins = tm.length > 1 ? parseInt(tm[1], 10) : 0;
    if (isPM && th !== 12) th += 12;
    if (isAM && th === 12) th = 0;
    return th * 60 + tmins;
  }
  return 0;
}

function calculateWfmDay({ startDate, endDate, rawStatusLogs, reqStd, reskills, att, dStats }) {
  const sortedDates = [];
  let curr = new Date(startDate + "T00:00:00");
  let end = new Date((endDate || startDate) + "T00:00:00");
  while (curr <= end) {
    let y = curr.getFullYear(), 
        m = String(curr.getMonth() + 1).padStart(2, '0'), 
        d = String(curr.getDate()).padStart(2, '0');
    sortedDates.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
  }

  const globalProcessedData = {};

  const computeShift = (baseIso, mode) => {
    const actualMap = {};
    const agentImpacts = {};
    const intervals = [];

    let dt = new Date(baseIso + "T00:00:00");
    dt.setDate(dt.getDate() + 1);
    let y = dt.getFullYear(), mo = String(dt.getMonth() + 1).padStart(2, '0'), dy = String(dt.getDate()).padStart(2, '0');
    let nextIso = `${y}-${mo}-${dy}`;

    if (mode === 'std') {
      for (let k = 0; k <= 1410; k += 30) intervals.push({ iso: baseIso, sk: k, startMs: new Date(baseIso + "T00:00:00").getTime() + (k * 60000) });
    } else {
      for (let k = 480; k <= 1410; k += 30) intervals.push({ iso: baseIso, sk: k, startMs: new Date(baseIso + "T00:00:00").getTime() + (k * 60000) });
      for (let k = 0; k <= 450; k += 30) intervals.push({ iso: nextIso, sk: k, startMs: new Date(nextIso + "T00:00:00").getTime() + (k * 60000) });
    }

    const globalStartMs = intervals[0].startMs;
    const globalEndMs = intervals[intervals.length - 1].startMs + 1800000;

    const getEffectiveLOB = (email, iso, mins) => {
      let overrides = reskills.filter(r => r.emailKey === email && r.iso === iso);
      for (let i = 0; i < overrides.length; i++) {
        let r = overrides[i];
        let sm = parseMins(r.startStr), em = r.endStr ? parseMins(r.endStr) : 1440;
        if (sm > em) {
          if (mins >= sm || mins <= em) return groupLOB(r.lob);
        } else {
          if (mins >= sm && mins <= em) return groupLOB(r.lob);
        }
      }
      if (att[iso] && att[iso][email]) return groupLOB(att[iso][email]);
      return "Unknown LOB";
    };

    // Pre-process: merge overlapping logs per agent per status
    const agentGroups = {};
    rawStatusLogs.forEach(log => {
      if (!agentGroups[log.email]) agentGroups[log.email] = [];
      agentGroups[log.email].push(log);
    });

    const mergedLogs = [];
    Object.keys(agentGroups).forEach(email => {
      const logs = agentGroups[email].sort((a, b) => a.start - b.start);
      if (logs.length > 0) {
        const merged = [logs[0]];
        for (let i = 1; i < logs.length; i++) {
          const curr = logs[i];
          const last = merged[merged.length - 1];
          if (curr.start <= last.end && String(curr.status).toUpperCase() === String(last.status).toUpperCase()) { 
            last.end = Math.max(last.end, curr.end); 
          } else { 
            merged.push(curr); 
          }
        }
        merged.forEach(m => mergedLogs.push(m));
      }
    });

    mergedLogs.forEach(log => {
      if (log.end <= globalStartMs || log.start >= globalEndMs) return;
      let current = Math.max(log.start, globalStartMs);
      let stopTime = Math.min(log.end, globalEndMs);

      while (current < stopTime) {
        let dd = new Date(current);
        let hh = dd.getHours(), mm = dd.getMinutes(), mR = mm >= 30 ? 30 : 0;
        let nx = new Date(dd);
        if (mR === 0) nx.setMinutes(30, 0, 0, 0); else nx.setHours(hh + 1, 0, 0, 0);

        let cEnd = Math.min(stopTime, nx.getTime());
        let dur = (cEnd - current) / 3600000;
        let durMins = (cEnd - current) / 60000;

        let yr = dd.getFullYear(), mt = String(dd.getMonth() + 1).padStart(2, '0'), dte = String(dd.getDate()).padStart(2, '0');
        let localIso = `${yr}-${mt}-${dte}`;
        let sk = (hh * 60) + mR;
        let lob = getEffectiveLOB(log.email, localIso, (hh * 60) + mm);

        if (lob !== 'Unknown LOB') {
          if (!agentImpacts[lob]) agentImpacts[lob] = {};
          if (!agentImpacts[lob][localIso]) agentImpacts[lob][localIso] = {};
          if (!agentImpacts[lob][localIso][sk]) agentImpacts[lob][localIso][sk] = {};
          
          if (!agentImpacts[lob][localIso][sk][log.email]) {
            agentImpacts[lob][localIso][sk][log.email] = { email: log.email, lob, onlineMins: 0, authBreakMins: 0, unauthMins: 0 };
          }
          const a = agentImpacts[lob][localIso][sk][log.email];

          const s = String(log.status).toUpperCase();
          if (s.includes('ONLINE')) {
            if (!actualMap[lob]) actualMap[lob] = {};
            if (!actualMap[lob][localIso]) actualMap[lob][localIso] = {};
            if (!actualMap[lob][localIso][sk]) actualMap[lob][localIso][sk] = 0;
            actualMap[lob][localIso][sk] += dur;
            a.onlineMins += durMins;
          } else if (s.includes('BREAK') || s.includes('LUNCH')) {
            a.authBreakMins += durMins;
          } else {
            a.unauthMins += durMins;
          }
        }
        current = cEnd;
      }
    });

    const summary = {
      'Combined': { req: 0, act: 0, bill: 0, over: 0, lost: 0, sch: 0, abs: 0, intervals: [] },
      'TPro': { req: 0, act: 0, bill: 0, over: 0, lost: 0, sch: 0, abs: 0, intervals: [] },
      'GHC': { req: 0, act: 0, bill: 0, over: 0, lost: 0, sch: 0, abs: 0, intervals: [] },
      'TMart-FU': { req: 0, act: 0, bill: 0, over: 0, lost: 0, sch: 0, abs: 0, intervals: [] },
      'Total': { req: 0, act: 0, bill: 0, over: 0, lost: 0, sch: 0, abs: 0, intervals: [] },
      'ICView': { req: 0, act: 0, bill: 0, over: 0, lost: 0, sch: 0, abs: 0, intervals: [] }
    };

    const dayStats = dStats ? (dStats[baseIso] || {}) : {};

    LOBs.forEach(lob => {
      let stats = dayStats[lob] || { hc: 0, abs: 0 };
      summary[lob].sch = stats.hc;
      summary[lob].abs = stats.abs;

      intervals.forEach(chk => {
        let rH = (reqStd[lob] && reqStd[lob][chk.iso] && reqStd[lob][chk.iso][chk.sk]) ? reqStd[lob][chk.iso][chk.sk].hours : 0;
        let aH = (actualMap[lob] && actualMap[lob][chk.iso] && actualMap[lob][chk.iso][chk.sk]) ? actualMap[lob][chk.iso][chk.sk] : 0;
        
        rH = Number(rH.toFixed(4));
        aH = Number(aH.toFixed(4));
        let bH = Math.min(aH, rH);

        if (rH > 0 || aH > 0) {
          summary[lob].req += rH; summary[lob].act += aH; summary[lob].bill += bH;
          
          const agentsDict = (agentImpacts[lob] && agentImpacts[lob][chk.iso] && agentImpacts[lob][chk.iso][chk.sk]) ? agentImpacts[lob][chk.iso][chk.sk] : {};
          const agentsArr = Object.values(agentsDict).sort((x, y) => y.unauthMins - x.unauthMins || y.onlineMins - x.onlineMins);

          let hR = Math.floor(chk.sk / 60), mR = chk.sk % 60;
          let lbl = `${hR}:${mR === 0 ? '00' : '30'}`;
          summary[lob].intervals.push({ iso: chk.iso, label: lbl, req: rH, act: aH, bill: bH, agents: agentsArr });
        }
      });

      summary[lob].over = summary[lob].act > summary[lob].req ? summary[lob].act - summary[lob].req : 0;
      summary[lob].lost = summary[lob].req > summary[lob].act ? summary[lob].req - summary[lob].act : 0;

      summary.Total.req += summary[lob].req; summary.Total.act += summary[lob].act; summary.Total.bill += summary[lob].bill;
      summary.Total.sch += summary[lob].sch; summary.Total.abs += summary[lob].abs;
    });

    summary.Total.over = summary.Total.act > summary.Total.req ? summary.Total.act - summary.Total.req : 0;
    summary.Total.lost = summary.Total.req > summary.Total.act ? summary.Total.req - summary.Total.act : 0;

    intervals.forEach(chk => {
      let reqC = (reqStd['Combined'] && reqStd['Combined'][chk.iso] && reqStd['Combined'][chk.iso][chk.sk]) ? reqStd['Combined'][chk.iso][chk.sk].hours : 0;
      let actC = (actualMap['Combined'] && actualMap['Combined'][chk.iso] && actualMap['Combined'][chk.iso][chk.sk]) ? actualMap['Combined'][chk.iso][chk.sk] : 0;
      let reqT = (reqStd['TPro'] && reqStd['TPro'][chk.iso] && reqStd['TPro'][chk.iso][chk.sk]) ? reqStd['TPro'][chk.iso][chk.sk].hours : 0;
      let actT = (actualMap['TPro'] && actualMap['TPro'][chk.iso] && actualMap['TPro'][chk.iso][chk.sk]) ? actualMap['TPro'][chk.iso][chk.sk] : 0;

      let totalReq = Number((reqC + reqT).toFixed(4));
      let totalAct = Number((actC + actT).toFixed(4));
      let totalBill = Math.min(totalAct, totalReq); 

      if (totalReq > 0 || totalAct > 0) {
        summary.ICView.req += totalReq; summary.ICView.act += totalAct; summary.ICView.bill += totalBill;
        
        const agentsDictC = (agentImpacts['Combined'] && agentImpacts['Combined'][chk.iso] && agentImpacts['Combined'][chk.iso][chk.sk]) ? agentImpacts['Combined'][chk.iso][chk.sk] : {};
        const agentsDictT = (agentImpacts['TPro'] && agentImpacts['TPro'][chk.iso] && agentImpacts['TPro'][chk.iso][chk.sk]) ? agentImpacts['TPro'][chk.iso][chk.sk] : {};
        const agentsArr = [...Object.values(agentsDictC), ...Object.values(agentsDictT)].sort((x, y) => y.unauthMins - x.unauthMins || y.onlineMins - x.onlineMins);

        let hR = Math.floor(chk.sk / 60), mR = chk.sk % 60;
        let lbl = `${hR}:${mR === 0 ? '00' : '30'}`;
        summary.ICView.intervals.push({ iso: chk.iso, label: lbl, req: totalReq, act: totalAct, bill: totalBill, agents: agentsArr });
      }
    });

    summary.ICView.over = summary.ICView.act > summary.ICView.req ? summary.ICView.act - summary.ICView.req : 0;
    summary.ICView.lost = summary.ICView.req > summary.ICView.act ? summary.ICView.req - summary.ICView.act : 0;

    // Build Daily Agent Summary
    const agentSummaryMap = {};
    LOBs.forEach(lob => {
      if (!agentImpacts[lob]) return;
      Object.keys(agentImpacts[lob]).forEach(iso => {
        Object.keys(agentImpacts[lob][iso]).forEach(sk => {
          Object.values(agentImpacts[lob][iso][sk]).forEach(a => {
            if (!agentSummaryMap[a.email]) {
              agentSummaryMap[a.email] = { email: a.email, lob: a.lob, onlineMins: 0, authBreakMins: 0, unauthMins: 0 };
            }
            agentSummaryMap[a.email].onlineMins += a.onlineMins;
            agentSummaryMap[a.email].authBreakMins += a.authBreakMins;
            agentSummaryMap[a.email].unauthMins += a.unauthMins;
          });
        });
      });
    });
    
    summary.DailyAgents = Object.values(agentSummaryMap).sort((a, b) => b.unauthMins - a.unauthMins || b.onlineMins - a.onlineMins);

    return summary;
  };

  for (let i = 0; i < sortedDates.length; i++) {
    let dIso = sortedDates[i];
    globalProcessedData[dIso] = { std: computeShift(dIso, 'std'), ovn: computeShift(dIso, 'ovn') };
  }
  
  return { globalProcessedData, sortedDates };
}

// Data ingestion and calculation pipeline
async function processWfmData(req, res) {
  try {
    const { globalProcessedData, sortedDates } = calculateWfmDay(req.body);
    res.json({ success: true, globalProcessedData, sortedDates });
  } catch (err) {
    console.error("Engine Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { processWfmData, calculateWfmDay };
