const { google } = require('googleapis');

// Hardcoded Sheet IDs from the legacy GAS script
const ATT_SHEET_ID = '1XTlvnlk7EXCDcZ-0XPLaZfT7oJddWAWUboxirbTebKU';
const RESKILL_SHEET_ID = '1M-pl82UtPSNPvj76fB9kOzh20nbyt1UNER5_9unG9_A';
const REQ_SHEET_ID = '1BgHk0bV51MGGd4aB1gODOLSn_LuXG5vmVeVz1-nUEUY';

// Reusing the Google Auth Client from auth.cjs pattern
let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account credentials missing in .env');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// ---------------------------------------------------------
// Helper: Get sheet values safely
// ---------------------------------------------------------
async function getSheetValues(spreadsheetId, range) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return res.data.values || [];
  } catch (error) {
    console.error(`Error fetching sheet ${spreadsheetId} range ${range}:`, error.message);
    throw error;
  }
}

// Helper: Get all sheet metadata (names)
async function getSpreadsheetMetadata(spreadsheetId) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    return res.data.sheets.map(s => s.properties.title);
  } catch (error) {
    console.error(`Error fetching metadata for ${spreadsheetId}:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------
// API Handler
// ---------------------------------------------------------
const invoiceDataHandler = async (req, res) => {
  try {
    const { dates } = req.body;
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ success: false, error: 'No dates provided' });
    }

    const dateTargets = dates.map(dStr => {
      const parts = dStr.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const mNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      return {
        iso: dStr,
        y, m, d,
        dayRegex: new RegExp("(^|\\D)0?" + d.toString() + "(?:st|nd|rd|th)?(\\D|$)", "i"),
        monthStr: mNames[m]
      };
    });

    const finalReq = { "Combined": {}, "TPro": {}, "GHC": {}, "TMart-FU": {} };
    const finalAtt = {};
    const finalReskills = [];
    const dailyStats = {};

    Object.keys(finalReq).forEach(lob => {
      dateTargets.forEach(dt => {
        finalReq[lob][dt.iso] = {};
        for(let k=0; k<=1410; k+=30) finalReq[lob][dt.iso][k] = {agents:0, hours:0};
        
        if(!dailyStats[dt.iso]) dailyStats[dt.iso] = {};
        dailyStats[dt.iso][lob] = { hc: 0, abs: 0 };
      });
    });

    const parseDuration = (val) => {
      if(!val) return 0;
      if(typeof val === 'number') return val * 24; 
      let pts = val.toString().split(':');
      let h = parseFloat(pts[0]) || 0;
      let m = pts.length > 1 ? parseFloat(pts[1]) : 0;
      let s = pts.length > 2 ? parseFloat(pts[2]) : 0;
      return h + (m/60) + (s/3600);
    };

    // ---------------------------------------------------------
    // 1. Fetch ATT (Skill Matrix + HC/ABS Daily Stats)
    // ---------------------------------------------------------
    try {
      const attSheetNames = await getSpreadsheetMetadata(ATT_SHEET_ID);
      
      // Skill Matrix
      const skillSheetName = attSheetNames.find(name => name.toLowerCase().replace(/\s/g, '').includes('skill'));
      if (skillSheetName) {
        const attData = await getSheetValues(ATT_SHEET_ID, skillSheetName);
        let sfUserIdx = -1, headerRowIdx = -1;
        const dateColMap = {};

        for(let r=0; r<Math.min(20, attData.length); r++) {
          for(let c=0; c<attData[r].length; c++) {
            let cell = attData[r][c] ? attData[r][c].toString().toLowerCase().trim() : '';
            if(!cell) continue;
            
            if(sfUserIdx === -1 && (cell === 'sf user' || cell.includes('email') || cell === 'agent_email')) {
              sfUserIdx = c; if(headerRowIdx === -1) headerRowIdx = r;
            }
            
            dateTargets.forEach(dt => {
              if(dateColMap[dt.iso] === undefined) {
                if(dt.dayRegex.test(cell) && cell.includes(dt.monthStr)) {
                  dateColMap[dt.iso] = c; if(headerRowIdx === -1) headerRowIdx = r;
                }
              }
            });
          }
        }
        
        if(sfUserIdx !== -1 && headerRowIdx !== -1) {
          dateTargets.forEach(dt => {
            let cIdx = dateColMap[dt.iso];
            if(cIdx !== undefined) {
              finalAtt[dt.iso] = {};
              for(let row = headerRowIdx + 1; row < attData.length; row++) {
                if(!attData[row]) continue;
                let email = attData[row][sfUserIdx];
                let lob = attData[row][cIdx];
                if(email && lob) {
                  let cleanEmail = email.toString().toLowerCase().trim().split('@')[0].replace(/[^a-z0-9]/g, '');
                  let cleanLob = lob.toString().trim();
                  if(cleanEmail && cleanLob && cleanLob !== '-') finalAtt[dt.iso][cleanEmail] = cleanLob;
                }
              }
            }
          });
        }
      }

      // HC & ABS Daily Stats
      for (const sName of attSheetNames) {
        const sNameLower = sName.toLowerCase().trim();
        for (const dt of dateTargets) {
          const dayReg = new RegExp("^0?" + dt.d + "[\\s\\-]+" + dt.monthStr, "i");
          if(dayReg.test(sNameLower)) {
            const data = await getSheetValues(ATT_SHEET_ID, sName);
            let lobCol = -1, hcCol = -1, absCol = -1, targetRow = -1;
            
            for(let r=0; r<data.length; r++) {
              if(!data[r]) continue;
              for(let c=0; c<data[r].length; c++) {
                let val = data[r][c] ? data[r][c].toString().toLowerCase().trim() : '';
                if(val === 'lob') lobCol = c;
                else if(val === 'hc') hcCol = c;
                else if(val === 'abs') absCol = c;
              }
              if(lobCol !== -1 && hcCol !== -1) { targetRow = r; break; }
            }
            
            if(targetRow !== -1) {
              for(let r = targetRow + 1; r < data.length; r++) {
                if(!data[r]) continue;
                let rowLob = data[r][lobCol] ? data[r][lobCol].toString().toLowerCase().replace(/[\s\-\_\.]/g, '') : '';
                if(!rowLob) continue;
                
                let mappedLob = null;
                if(rowLob.includes('combined')) mappedLob = 'Combined';
                else if(rowLob.includes('tpro')) mappedLob = 'TPro';
                else if(rowLob.includes('ghc')) mappedLob = 'GHC';
                else if(rowLob.includes('tmart') && (rowLob.includes('fu') || rowLob.includes('followup'))) mappedLob = 'TMart-FU';

                if(mappedLob) {
                  let hcVal = data[r][hcCol];
                  let absVal = absCol !== -1 ? data[r][absCol] : "0";
                  dailyStats[dt.iso][mappedLob].hc = parseDuration(hcVal);
                  dailyStats[dt.iso][mappedLob].abs = parseDuration(absVal);
                }
              }
            }
          }
        }
      }
    } catch(e) {
      console.error('Error fetching ATT sheet:', e);
    }

    // ---------------------------------------------------------
    // 2. Fetch Reskilling
    // ---------------------------------------------------------
    try {
      const reskillSheetNames = await getSpreadsheetMetadata(RESKILL_SHEET_ID);
      const reskillSheetName = reskillSheetNames.includes("Reskilling") ? "Reskilling" : reskillSheetNames[0];
      
      const rsData = await getSheetValues(RESKILL_SHEET_ID, reskillSheetName);
      if(rsData.length > 0) {
        const rsHeaders = rsData[0].map(h => h ? h.toString().toLowerCase().trim() : '');
        const mIdx = rsHeaders.indexOf("mail"), dIdx = rsHeaders.indexOf("date"), tIdx = rsHeaders.indexOf("skilled to");
        const sIdx = rsHeaders.indexOf("start timestamp"), eIdx = rsHeaders.indexOf("end timestamp");

        if(mIdx !== -1 && tIdx !== -1) {
          for(let j=1; j<rsData.length; j++) {
            if(!rsData[j]) continue;
            let rDateStr = rsData[j][dIdx] ? rsData[j][dIdx].toString().toLowerCase().trim() : "";
            dateTargets.forEach(dt => {
              let isMatch = false;
              if(dt.dayRegex.test(rDateStr) && rDateStr.includes(dt.monthStr)) {
                isMatch = true;
              }
              if(isMatch) {
                let emailRaw = rsData[j][mIdx];
                if (emailRaw) {
                  let rsEmail = emailRaw.toString().toLowerCase().trim().split('@')[0].replace(/[^a-z0-9]/g, '');
                  if(rsEmail) {
                    finalReskills.push({
                      iso: dt.iso, 
                      emailKey: rsEmail, 
                      lob: rsData[j][tIdx] ? rsData[j][tIdx].toString().trim() : "",
                      startStr: (sIdx !== -1 && rsData[j][sIdx]) ? rsData[j][sIdx].toString().trim() : "", 
                      endStr: (eIdx !== -1 && rsData[j][eIdx]) ? rsData[j][eIdx].toString().trim() : ""
                    });
                  }
                }
              }
            });
          }
        }
      }
    } catch(e) {
      console.error('Error fetching Reskill sheet:', e);
    }

    // ---------------------------------------------------------
    // 3. Fetch REQ
    // ---------------------------------------------------------
    try {
      const reqSheetNames = await getSpreadsheetMetadata(REQ_SHEET_ID);
      const filledDates = { "delivery":{}, "pickup":{}, "fcr":{}, "support":{}, "tmart":{}, "tpro":{}, "ghc":{}, "tmartfu":{} };

      for(const sNameOrig of reqSheetNames) {
        const sName = sNameOrig.toLowerCase().replace(/[\s\-]/g, '');
        if(sName.includes("granted")) continue; 
        
        let targetGroup = null, subLobId = "";
        if(sName.includes("tpro")) { targetGroup = "TPro"; subLobId = "tpro"; }
        else if(sName.includes("ghc")) { targetGroup = "GHC"; subLobId = "ghc"; }
        else if(sName.includes("tmart") && (sName.includes("followup") || sName.includes("fu"))) { targetGroup = "TMart-FU"; subLobId = "tmartfu"; }
        else if(sName.includes("delivery") || sName.includes("dp")) { targetGroup = "Combined"; subLobId = "delivery"; }
        else if(sName.includes("pickup")) { targetGroup = "Combined"; subLobId = "pickup"; }
        else if(sName.includes("fcr")) { targetGroup = "Combined"; subLobId = "fcr"; }
        else if(sName.includes("support") || sName.includes("nonpilot")) { targetGroup = "Combined"; subLobId = "support"; }
        else if(sName.includes("tmart")) { targetGroup = "Combined"; subLobId = "tmart"; } 

        if(!targetGroup) continue;

        const sheetData = await getSheetValues(REQ_SHEET_ID, sNameOrig);
        if(sheetData.length < 2) continue;

        let maxCols = 0;
        for(let r=0; r<Math.min(5, sheetData.length); r++) {
          if(sheetData[r] && sheetData[r].length > maxCols) maxCols = sheetData[r].length;
        }

        const dateColMapReq = {};
        for(let c=0; c<maxCols; c++) {
          for(let r=0; r<Math.min(5, sheetData.length); r++) {
            let cell = (sheetData[r] && sheetData[r][c]) ? sheetData[r][c].toString().trim().toLowerCase() : '';
            if(!cell) continue;
            dateTargets.forEach(dt => {
              if(dateColMapReq[dt.iso] === undefined) {
                if(filledDates[subLobId] && filledDates[subLobId][dt.iso]) return; 
                if(dt.dayRegex.test(cell) && cell.includes(dt.monthStr)) {
                  dateColMapReq[dt.iso] = c;
                }
              }
            });
          }
        }

        if(Object.keys(dateColMapReq).length > 0) {
          Object.keys(dateColMapReq).forEach(iso => { filledDates[subLobId][iso] = true; });
          
          for(let i=1; i<sheetData.length; i++) {
            if(!sheetData[i]) continue;
            let dispVal = sheetData[i][0] ? sheetData[i][0].toString().trim().toLowerCase() : "";
            if(!dispVal || dispVal.includes('total')) continue;

            let h = -1, m = 0;
            let isPM = dispVal.includes('pm'), isAM = dispVal.includes('am');
            let cleanTime = dispVal.split('-')[0].replace(/[^0-9:]/g, '');
            let tParts = cleanTime.split(':');
            
            if(tParts.length > 0 && tParts[0] !== '') {
              h = parseInt(tParts[0], 10); m = tParts.length > 1 ? parseInt(tParts[1], 10) : 0;
              if(isPM && h !== 12) h += 12; if(isAM && h === 12) h = 0;
            }

            if(h !== -1) {
              let mR = m >= 30 ? 30 : 0;
              let sortKey = (h * 60) + mR;

              Object.keys(dateColMapReq).forEach(iso => {
                let cIdx = dateColMapReq[iso];
                let hRaw = (sheetData[i][cIdx]) ? sheetData[i][cIdx].toString().replace(/,/g, '').trim() : "";
                let heads = parseFloat(hRaw);
                if(!isNaN(heads) && heads > 0) {
                  finalReq[targetGroup][iso][sortKey].agents += heads;
                  finalReq[targetGroup][iso][sortKey].hours += (heads / 2.0);
                }
              });
            }
          }
        }
      }
    } catch(e) {
      console.error('Error fetching REQ sheet:', e);
    }

    return res.json({ success: true, reqStd: finalReq, reskills: finalReskills, att: finalAtt, dStats: dailyStats });

  } catch (error) {
    console.error("Backend Error in invoiceDataHandler:", error);
    return res.status(500).json({ success: false, error: error.toString() });
  }
};

module.exports = { invoiceDataHandler };
