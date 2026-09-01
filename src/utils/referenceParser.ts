import * as XLSX from 'xlsx';

export interface ReferenceData {
  reqSecs: number;
  billSecs: number;
  actualSecs?: number;
  icPerc?: number;
}

export type ReferenceStore = Record<string, Record<string, ReferenceData>>;

function parseDurationToSecs(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    // Excel time fraction (e.g., 0.5 = 12 hours = 43200 seconds)
    return Math.round(val * 24 * 3600);
  }
  const pts = String(val).replace(/[a-zA-Z\s]/g, '').split(':');
  const h = parseInt(pts[0], 10) || 0;
  const m = pts.length > 1 ? parseInt(pts[1], 10) : 0;
  const s = pts.length > 2 ? parseInt(pts[2], 10) : 0;
  return (h * 3600) + (m * 60) + s;
}

function parseDateStr(val: any): string | null {
  if (!val) return null;
  // If Excel serial date (e.g., 45500)
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // Try to parse "1-Aug" or similar
  const str = String(val).trim();
  if (str.toLowerCase() === 'total') return 'total';
  
  const parts = str.split('-');
  if (parts.length === 2) {
    const d = parseInt(parts[0], 10);
    const mStr = parts[1].toLowerCase();
    const mNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = mNames.findIndex(n => mStr.startsWith(n));
    if (mIdx !== -1 && !isNaN(d)) {
      const year = new Date().getFullYear(); // Assume current year
      return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

export async function parseReferenceExcel(file: File): Promise<ReferenceStore> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
  
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: '' });

  const result: ReferenceStore = {};

  // Find LOB headers
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const cellVal = String(data[r][c]).toLowerCase().trim().replace(/[\s\-\_\.]/g, '');
      let internalLob: string | null = null;
      
      if (cellVal === 'combined') internalLob = 'Combined';
      else if (cellVal.includes('tpro')) internalLob = 'TPro';
      else if (cellVal === 'ghc') internalLob = 'GHC';
      else if (cellVal.includes('fu') || cellVal.includes('followup')) internalLob = 'TMart-FU';
      
      if (internalLob) {
        if (!result[internalLob]) result[internalLob] = {};
        
        // Found a LOB header. The next row should be column names.
        const headerRow = r + 1;
        if (headerRow >= data.length) continue;
        
        const colHeaders = data[headerRow];
        let dateCol = -1, reqCol = -1, billCol = -1, actCol = -1, icCol = -1;
        
        // Find columns for this table
        for (let hc = c; hc < colHeaders.length; hc++) {
          const hVal = String(colHeaders[hc]).toLowerCase().trim();
          if (!hVal) {
            // If we hit an empty column, check if it's the end of the table
            if (hc > c + 3) break;
          }
          if (dateCol === -1 && (hVal.includes('date') || hVal.includes('day'))) dateCol = hc;
          if (reqCol === -1 && (hVal.includes('req') || hVal.includes('required'))) reqCol = hc;
          if (billCol === -1 && (hVal.includes('bill') || hVal.includes('billable'))) billCol = hc;
          if (actCol === -1 && (hVal.includes('act') || hVal === 'actual')) actCol = hc;
          if (icCol === -1 && (hVal.includes('ic') || hVal.includes('interval compliance') || hVal.includes('ic%'))) icCol = hc;
        }

        if (dateCol === -1 || reqCol === -1) continue; // Not a valid table

        // Read data rows
        for (let dr = headerRow + 1; dr < data.length; dr++) {
          const rawDateCell = rawData[dr][dateCol];
          if (!rawDateCell) break; // End of table
          
          const dateStr = parseDateStr(rawDateCell);
          if (!dateStr) continue;

          const reqSecs = parseDurationToSecs(rawData[dr][reqCol]);
          const billSecs = billCol !== -1 ? parseDurationToSecs(rawData[dr][billCol]) : 0;
          const actualSecs = actCol !== -1 ? parseDurationToSecs(rawData[dr][actCol]) : undefined;
          
          let icPerc: number | undefined;
          if (icCol !== -1) {
             const icRaw = rawData[dr][icCol];
             if (typeof icRaw === 'number') {
                icPerc = icRaw * 100;
             } else {
                icPerc = parseFloat(String(icRaw).replace('%', ''));
             }
          }

          result[internalLob][dateStr] = {
            reqSecs,
            billSecs,
            actualSecs,
            icPerc
          };
        }
      }
    }
  }

  return result;
}
