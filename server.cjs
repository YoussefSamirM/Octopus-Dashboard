const express = require("express");
const path = require("path");
const https = require("https");
const multer = require("multer");
const fs = require("fs");
const { googleAuthHandler } = require('./server/auth.cjs');
const { requireAuth, optionalAuth } = require('./server/middleware.cjs');
const { invoiceDataHandler } = require('./server/invoice.cjs');
const { processWfmData } = require('./server/engine.cjs');
const app = express();

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    if (file.fieldname === 'chats') {
      cb(null, 'chats.csv');
    } else if (file.fieldname === 'status') {
      cb(null, 'status.csv');
    } else {
      cb(null, file.originalname);
    }
  }
});
const upload = multer({ storage: storage });

// Global error handler to ensure JSON responses
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Bad JSON payload' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  return res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Serve Vite build output in production
const distPath = path.join(__dirname, "dist");
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(publicPath));
}

const BASE_URL = "https://mtaeno01.teleopticloud.com/Api/";
const BUSINESS_UNIT_ID = "e2a4defb-ca2c-44c8-a6f9-b16a00a885b5";
const SCENARIO = "69b1999d-d5d7-4740-8e97-b16a00a885f1";
const OVERTIME_GUID = "98039c9b-3828-4669-878c-b1a0009b271a";
const TARDY_ABSENCE_ID = "cc469248-eac6-42a4-abeb-b1e301089bf5";

const ACTIVITY_IDS = {
  Online: "15ebb3bf-29b8-4613-ae2f-b184008c49ac",
  "Short Break 2": "1d7ed10c-3f00-4182-8af3-b184008d03db",
  "Short Break 1": "e6494b03-5a8f-4b93-9d7b-b184008d03db",
  "Lunch Break": "e8518e38-c48e-48bc-aac9-b184008d03db",
  "TR Sessions": "9f42c22b-53fd-4834-a2eb-b184008d6544",
  "RF Session": "9ac3f9fb-1276-47b2-9e44-b18900ce7853",
  Nesting: "75e619dc-fc43-4a4f-b076-b1ad0102da19",
  Overage: "570f1445-3e9d-4116-8c9c-b1e30102ccfa",
  Coaching: "0fd9baa2-5468-4435-9bfc-b1e30102ccfa",
  Test: "6dac9c11-e282-48c0-b919-b1e600b51ce9",
  Support: "4d802c58-74e9-46fb-a161-b1f0010c72c5",
  "Extar Break": "6918d569-a8b3-4844-9ded-b21001182767",
  "OverTime by RTM": "308b1e48-3d28-4e92-b099-b21500f77480",
  Toilet: "5e6b15ef-c58d-48c0-b241-b241014e89ec",
  "Health Issue": "30412959-77f6-428f-83a1-b24401486f7d",
  Split: "e8b8060f-6b89-4804-b444-b291006ec4f9",
  Offline: "6d2a06c3-2cd7-4efe-9fa5-b2c201246631",
  "Offline +1": "3398448a-4606-4f3a-88aa-b30e014c2f8d",
  "Sohor Ramdan": "b0c65439-71f5-46d0-809b-b40b013ec26b",
  "Live task": "64747dda-e5bd-435a-954c-b419012b08a6",
};

const HARD_WALL_IDS = [
  ACTIVITY_IDS["Offline"],
  ACTIVITY_IDS["Offline +1"],
  ACTIVITY_IDS["Split"],
  ACTIVITY_IDS["Live task"],
];
const BREAK_IDS = [
  ACTIVITY_IDS["Short Break 1"],
  ACTIVITY_IDS["Short Break 2"],
  ACTIVITY_IDS["Lunch Break"],
  ACTIVITY_IDS["Extar Break"],
];

const undoHistory = {};

function getEgyptOffsetHours(apiDate) {
  const p = apiDate.split("-");
  const y = parseInt(p[0], 10),
    mo = parseInt(p[1], 10),
    d = parseInt(p[2], 10);
  if (mo < 4 || mo > 10) return 2;
  if (mo > 4 && mo < 10) return 3;
  if (mo === 4)
    return d >= 30 - ((new Date(Date.UTC(y, 3, 30, 12)).getUTCDay() + 2) % 7)
      ? 3
      : 2;
  if (mo === 10)
    return d >= 31 - ((new Date(Date.UTC(y, 9, 31, 12)).getUTCDay() + 2) % 7)
      ? 2
      : 3;
  return 2;
}

function getUtcIsoString(apiDate, localTime, offsetHours) {
  const dParts = apiDate.split("-"),
    tParts = String(localTime).trim().split(":");
  const d = new Date(
    Date.UTC(
      parseInt(dParts[0], 10),
      parseInt(dParts[1], 10) - 1,
      parseInt(dParts[2], 10),
      parseInt(tParts[0], 10),
      parseInt(tParts[1], 10)
    )
  );
  d.setTime(d.getTime() - offsetHours * 60 * 60 * 1000);
  return d.toISOString().split(".")[0] + "Z";
}

function addLocalMins(dateStr, timeStr, mins) {
  let cd = String(dateStr).trim();
  let y, mo, dy;
  if (cd.includes("/")) {
    let p = cd.split("/");
    mo = p[0];
    dy = p[1];
    y = p[2];
  } else {
    let p = cd.split("-");
    y = p[0];
    mo = p[1];
    dy = p[2];
  }
  let tp = String(timeStr).trim().split(":");
  let d = new Date(Date.UTC(
    y,
    mo - 1,
    dy,
    parseInt(tp[0], 10),
    parseInt(tp[1], 10) + mins
  ));
  return {
    date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
    time: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
    obj: d,
  };
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  options.agent = httpsAgent;
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403)
        throw new Error("Unauthorized");
      if (res.status >= 500 || res.status === 429) {
        attempts++;
        if (attempts >= maxRetries) return res;
        await new Promise((r) => setTimeout(r, 1000));
      } else return res;
    } catch (e) {
      if (e.message === "Unauthorized") throw e;
      attempts++;
      if (attempts >= maxRetries) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

function formatHeaders(token) {
  let c = token.trim();
  if (c.toLowerCase().startsWith("bearer ")) c = c.substring(7).trim();
  return { Authorization: `Bearer ${c}`, "Content-Type": "application/json" };
}

// ==========================================
// Google OAuth & Security
// ==========================================
app.post('/api/auth/google', googleAuthHandler);

// ---------------------------------------------------------
// WFM API Routes
// ---------------------------------------------------------
app.post('/api/invoice-data', optionalAuth, invoiceDataHandler);
app.post('/api/engine/process', optionalAuth, processWfmData);

// ---------------------------------------------------------
// Data Admin Routes
// ---------------------------------------------------------
app.post('/api/upload-invoice-data', optionalAuth, (req, res) => {
  try {
    const { globalProcessedData, sortedDates, agentInfo } = req.body;
    if (!globalProcessedData) return res.status(400).json({ error: 'Missing data' });
    fs.writeFileSync(path.join(uploadDir, 'invoice_data.json'), JSON.stringify({ globalProcessedData, sortedDates, agentInfo }));
    res.json({ message: 'Invoice data updated successfully.' });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to save invoice data.' });
  }
});

app.get('/api/invoice-data', optionalAuth, (req, res) => {
  try {
    const invoicePath = path.join(uploadDir, 'invoice_data.json');
    if (fs.existsSync(invoicePath)) {
      const data = fs.readFileSync(invoicePath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json({ empty: true });
    }
  } catch (error) {
    console.error('Fetch Data Error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice data.' });
  }
});

// ==========================================
// Existing API Routes
// ==========================================
app.post("/api/verify-token", async (req, res) => {
  try {
    const testRes = await fetchWithRetry(BASE_URL + "query/Skill/AllSkills", {
      method: "POST",
      headers: formatHeaders(req.body.token),
      body: JSON.stringify({ BusinessUnitId: BUSINESS_UNIT_ID }),
    });
    res.json({ valid: true });
  } catch (e) {
    res.status(500).json({ valid: false, message: e.message });
  }
});

app.post("/api/undo", async (req, res) => {
  try {
    const { token, opId } = req.body;
    const snapshots = undoHistory[opId];
    if (!snapshots || snapshots.length === 0)
      return res.status(400).json({ error: "Session expired." });
    const headers = formatHeaders(token);
    for (let i = 0; i < snapshots.length; i++) {
      const d = snapshots[i].originalData;
      let safeLayers = d.Shift
        ? d.Shift.map((l) => {
            let c = {
              Period: l.Period,
              ActivityId: l.ActivityId || ACTIVITY_IDS["Online"],
            };
            if (l.Overtime) c.Overtime = l.Overtime;
            return c;
          })
        : [];
      let dayPayload = {
        Date: d.Date,
        ShiftCategoryId: d.ShiftCategory ? d.ShiftCategory.Id : null,
        Layers: safeLayers,
      };
      if (d.DayOff) dayPayload.IsDayOff = true;
      if (d.FullDayAbsences && d.FullDayAbsences.length > 0)
        dayPayload.FullDayAbsenceId =
          d.FullDayAbsences[0].AbsenceId || d.FullDayAbsences[0].Id;
      if (d.PartDayAbsences && d.PartDayAbsences.length > 0) {
        dayPayload.PartDayAbsences = d.PartDayAbsences.map(a => ({
          AbsenceId: a.AbsenceId || a.Id,
          Period: a.Period
        }));
      }
      await fetchWithRetry(BASE_URL + "command/SetSchedulesForPerson", {
        method: "POST",
        headers,
        body: JSON.stringify({
          TimeZoneId: "UTC",
          BusinessUnitId: BUSINESS_UNIT_ID,
          DatePeriod: { StartDate: d.Date, EndDate: d.Date },
          ScheduleDays: [dayPayload],
          PersonId: snapshots[i].pId,
          ScenarioId: SCENARIO,
        }),
      });
    }
    delete undoHistory[opId];
    res.json({ message: "Reverted successfully." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function getStaffingBatch(
  startDate,
  startTime,
  endDate,
  endTime,
  headers,
  lobConfig
) {
  const resSkills = await fetchWithRetry(BASE_URL + "query/Skill/AllSkills", {
    method: "POST",
    headers,
    body: JSON.stringify({ BusinessUnitId: BUSINESS_UNIT_ID }),
  });
  const skillsData = await resSkills.json();
  const skills = {};
  if (skillsData.Result) skillsData.Result.forEach((s) => (skills[s.Name] = s));
  const fetchStart = addLocalMins(startDate, startTime, -30);
  const startUtc = getUtcIsoString(
    fetchStart.date,
    fetchStart.time,
    getEgyptOffsetHours(fetchStart.date)
  );
  const endUtc = getUtcIsoString(
    endDate,
    endTime,
    getEgyptOffsetHours(endDate)
  );
  const lobNames = Object.keys(lobConfig);
  let finalData = {};
  let currDate = addLocalMins(startDate, startTime, 0).date,
    currTime = addLocalMins(startDate, startTime, 0).time;
  let endLimitObj = addLocalMins(endDate, endTime, 0).obj;
  let dstOffset = getEgyptOffsetHours(startDate);

  while (true) {
    if (addLocalMins(currDate, currTime, 0).obj >= endLimitObj) break;
    finalData[`${currDate}_${currTime}`] = {};
    lobNames.forEach(
      (lob) =>
        (finalData[`${currDate}_${currTime}`][lob] = [0.0, 0.0, 0.0, 0.0])
    );
    let next = addLocalMins(currDate, currTime, 30);
    currDate = next.date;
    currTime = next.time;
  }

  const requests = lobNames.map((lob) => {
    let ids = (lobConfig[lob] || [])
      .map((n) => (skills[n] ? skills[n].Id : null))
      .filter(Boolean);
    return fetchWithRetry(BASE_URL + "query/Staffing/StaffingBySkills", {
      method: "POST",
      headers,
      body: JSON.stringify({
        BusinessUnitId: BUSINESS_UNIT_ID,
        SkillIds: ids,
        Period: { StartTime: startUtc, EndTime: endUtc },
      }),
    })
      .then((r) => r.json())
      .then((data) => ({ lob, result: data.Result || [] }));
  });

  const responses = await Promise.all(requests);
  responses.forEach((resp) => {
    resp.result.forEach((item) => {
      let utcDate = new Date(item.Period.StartTime);
      utcDate.setUTCHours(utcDate.getUTCHours() + dstOffset);
      let key = `${utcDate.getUTCFullYear()}-${String(
        utcDate.getUTCMonth() + 1
      ).padStart(2, "0")}-${String(utcDate.getUTCDate()).padStart(
        2,
        "0"
      )}_${String(utcDate.getUTCHours()).padStart(2, "0")}:${String(
        utcDate.getUTCMinutes()
      ).padStart(2, "0")}`;
      if (finalData[key]) {
        finalData[key][resp.lob][0] += Number(
          (item.ForecastedAgents || 0).toFixed(1)
        );
        finalData[key][resp.lob][1] += Number(
          (item.ScheduledAgents || 0).toFixed(1)
        );
        finalData[key][resp.lob][2] += Number(
          (item.ForecastedAgentsWithShrinkage || 0).toFixed(1)
        );
        finalData[key][resp.lob][3] += Number(
          (item.ScheduledAgentsWithShrinkage || 0).toFixed(1)
        );
      }
    });
  });
  return finalData;
}

app.post("/api/staffing/buffer", async (req, res) => {
  try {
    const endData = addLocalMins(req.body.date, req.body.interval, 30);
    const data = await getStaffingBatch(
      req.body.date,
      req.body.interval,
      endData.date,
      endData.time,
      formatHeaders(req.body.token),
      req.body.lobConfig || {}
    );
    let dash = [];
    const bucket = data[`${req.body.date}_${req.body.interval}`] || {};
    Object.keys(bucket)
      .sort()
      .forEach((lob) => {
        let m = bucket[lob];
        dash.push({
          lob: lob,
          forecast: m[0],
          scheduled: m[1],
          diff: Number((m[1] - m[0]).toFixed(1)),
          forecastShrink: m[2],
          scheduledShrink: m[3],
          diffShrink: Number((m[3] - m[2]).toFixed(1)),
        });
      });
    res.json(dash);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/staffing/shape", async (req, res) => {
  try {
    const endFetch = addLocalMins(req.body.endDate, req.body.endTime, 30);
    const data = await getStaffingBatch(
      req.body.startDate,
      req.body.startTime,
      endFetch.date,
      endFetch.time,
      formatHeaders(req.body.token),
      req.body.lobConfig || {}
    );
    const lobNames = Object.keys(req.body.lobConfig || {});
    let tableNormal = [],
      tableShrink = [];
    let currDate = req.body.startDate,
      currTime = req.body.startTime,
      limitObj = addLocalMins(req.body.endDate, req.body.endTime, 30).obj;
    while (true) {
      if (addLocalMins(currDate, currTime, 0).obj >= limitObj) break;
      let rowNorm = { time: currTime },
        rowShr = { time: currTime },
        bucket = data[`${currDate}_${currTime}`] || {};
      lobNames.forEach((lob) => {
        let m = bucket[lob] || [0, 0, 0, 0];
        rowNorm[lob] = Number((m[1] - m[0]).toFixed(1));
        rowShr[lob] = Number((m[3] - m[2]).toFixed(1));
      });
      tableNormal.push(rowNorm);
      tableShrink.push(rowShr);
      let next = addLocalMins(currDate, currTime, 30);
      currDate = next.date;
      currTime = next.time;
    }
    res.json({ lobs: lobNames, normal: tableNormal, shrink: tableShrink });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/tardy", async (req, res) => {
  try {
    const { token, requests, isSimulation } = req.body;
    const headers = formatHeaders(token);
    let validReqs = requests.filter(
      (r) => r.loginTime && r.loginTime.includes(":") && r.date
    );
    if (validReqs.length === 0) return res.json({ results: [] });
    const idRes = await fetchWithRetry(
      BASE_URL + "query/Person/PeopleByEmploymentNumbers",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          EmploymentNumbers: [...new Set(validReqs.map((r) => r.empId))],
        }),
      }
    );
    const idData = await idRes.json();
    const idMap = {};
    if (idData.Result)
      idData.Result.forEach(
        (p) => (idMap[String(p.EmploymentNumber).trim()] = p.Id)
      );
    let results = [],
      snapshots = [];

    for (let i = 0; i < validReqs.length; i++) {
      const reqRow = validReqs[i];
      const date = reqRow.date;
      const localOffset = getEgyptOffsetHours(date);
      const pId = idMap[reqRow.empId];
      if (!pId) {
        results.push({
          empId: reqRow.empId,
          status: "Invalid ID",
          color: "danger",
        });
        continue;
      }
      const schedRes = await fetchWithRetry(
        BASE_URL + "query/Schedule/ScheduleByPersonId",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            PersonId: pId,
            Period: { StartDate: date, EndDate: date },
            ScenarioId: SCENARIO,
          }),
        }
      );
      const schedData = await schedRes.json();
      if (!schedData.Result || schedData.Result.length === 0) {
        results.push({
          empId: reqRow.empId,
          status: "Day Off",
          color: "warning",
        });
        continue;
      }
      const targetDay = schedData.Result[0];
      snapshots.push({
        pId: pId,
        originalData: JSON.parse(JSON.stringify(targetDay)),
      });

      if (
        targetDay.DayOff ||
        !targetDay.Shift ||
        targetDay.Shift.length === 0
      ) {
        results.push({
          empId: reqRow.empId,
          status: "Day Off",
          color: "warning",
        });
        continue;
      }
      if (targetDay.FullDayAbsences && targetDay.FullDayAbsences.length > 0) {
        results.push({
          empId: reqRow.empId,
          status: "Full Day Absence",
          color: "warning",
        });
        continue;
      }

      const shiftStartMs = new Date(
        targetDay.Shift[0].Period.StartTime
      ).getTime();
      let loginMs = new Date(
        getUtcIsoString(date, reqRow.loginTime, localOffset)
      ).getTime();
      if (loginMs < shiftStartMs - 12 * 60 * 60 * 1000)
        loginMs += 24 * 60 * 60 * 1000;
      if (loginMs <= shiftStartMs) {
        results.push({
          empId: reqRow.empId,
          status: "Early Login",
          color: "info",
        });
        continue;
      }

      let allAbsences = [];
      if (targetDay.PartDayAbsences)
        targetDay.PartDayAbsences.forEach((a) =>
          allAbsences.push({
            start: new Date(a.Period.StartTime).getTime(),
            end: new Date(a.Period.EndTime).getTime(),
          })
        );
      targetDay.Shift.forEach((layer) => {
        if (layer.AbsenceId)
          allAbsences.push({
            start: new Date(layer.Period.StartTime).getTime(),
            end: new Date(layer.Period.EndTime).getTime(),
          });
      });
      allAbsences.sort((a, b) => a.start - b.start);

      let tardyStartMs = shiftStartMs;
      for (let a = 0; a < allAbsences.length; a++) {
        if (
          allAbsences[a].start <= tardyStartMs + 60000 &&
          allAbsences[a].end > tardyStartMs
        )
          tardyStartMs = Math.max(tardyStartMs, allAbsences[a].end);
      }
      if (tardyStartMs >= loginMs) {
        results.push({
          empId: reqRow.empId,
          status: "Already Updated",
          color: "warning",
        });
        continue;
      }

      let tardyMins = Math.round((loginMs - tardyStartMs) / 60000);
      if (tardyMins <= 0) {
        results.push({
          empId: reqRow.empId,
          status: "Early Login",
          color: "info",
        });
        continue;
      }

      if (isSimulation) {
        results.push({
          empId: reqRow.empId,
          status: `Dry Run: ${tardyMins} mins`,
          color: "warning",
        });
      } else {
        await fetchWithRetry(BASE_URL + "command/AddPartDayAbsence", {
          method: "POST",
          headers,
          body: JSON.stringify({
            TimeZoneId: "UTC",
            BusinessUnitId: BUSINESS_UNIT_ID,
            PersonId: pId,
            Period: {
              StartTime:
                new Date(tardyStartMs).toISOString().split(".")[0] + "Z",
              EndTime: new Date(loginMs).toISOString().split(".")[0] + "Z",
            },
            AbsenceId: TARDY_ABSENCE_ID,
            ScenarioId: SCENARIO,
          }),
        });
        results.push({
          empId: reqRow.empId,
          status: `Updated, ${tardyMins} mins`,
          color: "success",
        });
      }
    }
    const opId = Date.now().toString();
    if (!isSimulation && snapshots.length > 0) undoHistory[opId] = snapshots;
    res.json({ results, opId: isSimulation ? null : opId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function cloneLayer(origLayer, nStart, nEnd) {
  let cloned = {
    Period: { StartTime: nStart, EndTime: nEnd },
    ActivityId: origLayer.ActivityId || null,
  };
  if (origLayer.Overtime) cloned.Overtime = origLayer.Overtime;
  return cloned;
}
function createNewLayer(actId, start, end, otFlag, absId) {
  let layer = {
    Period: { StartTime: start, EndTime: end },
    ActivityId: actId,
    AbsenceId: absId || null,
  };
  if (otFlag) layer.Overtime = otFlag;
  return layer;
}
function sliceOnlineGap(gapStartMs, gapEndMs, originalLayers) {
  let slices = [],
    pointer = gapStartMs;
  for (let i = 0; i < originalLayers.length; i++) {
    let os = new Date(originalLayers[i].Period.StartTime).getTime(),
      oe = new Date(originalLayers[i].Period.EndTime).getTime();
    if (pointer < oe && gapEndMs > os) {
      let ss = Math.max(pointer, os),
        se = Math.min(gapEndMs, oe);
      if (se > ss) {
        slices.push(
          createNewLayer(
            ACTIVITY_IDS["Online"],
            new Date(ss).toISOString().split(".")[0] + "Z",
            new Date(se).toISOString().split(".")[0] + "Z",
            originalLayers[i].Overtime || null,
            null
          )
        );
        pointer = se;
      }
    }
  }
  return slices;
}
function fillGapsWithOriginalOt(
  floaters,
  originalLayers,
  shiftStartMs,
  shiftEndMs
) {
  let finalLayers = [],
    currentEdge = shiftStartMs;
  for (let i = 0; i < floaters.length; i++) {
    let fStart = new Date(floaters[i].Period.StartTime).getTime();
    if (currentEdge < fStart)
      finalLayers = finalLayers.concat(
        sliceOnlineGap(currentEdge, fStart, originalLayers)
      );
    finalLayers.push(floaters[i]);
    currentEdge = Math.max(
      currentEdge,
      new Date(floaters[i].Period.EndTime).getTime()
    );
  }
  if (currentEdge < shiftEndMs)
    finalLayers = finalLayers.concat(
      sliceOnlineGap(currentEdge, shiftEndMs, originalLayers)
    );
  return finalLayers;
}

app.post("/api/activity", async (req, res) => {
  try {
    const { token, requests, activityName, breakHandlingLogic, isSimulation } =
      req.body;
    const headers = formatHeaders(token);
    const targetActivityId = ACTIVITY_IDS[activityName];
    if (!targetActivityId)
      return res.status(400).json({ error: "Invalid Activity Type" });

    let validReqs = requests.filter((r) => r.date && r.start && r.end);
    if (validReqs.length === 0) return res.json({ results: [] });

    const idRes = await fetchWithRetry(
      BASE_URL + "query/Person/PeopleByEmploymentNumbers",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          EmploymentNumbers: [...new Set(validReqs.map((r) => r.empId))],
        }),
      }
    );
    const idData = await idRes.json();
    const idMap = {};
    if (idData.Result)
      idData.Result.forEach(
        (p) => (idMap[String(p.EmploymentNumber).trim()] = p.Id)
      );

    let results = [],
      snapshots = [];

    for (let i = 0; i < validReqs.length; i++) {
      const reqObj = validReqs[i];
      let sParts = reqObj.start.split(":"),
        eParts = reqObj.end.split(":");
      if (sParts.length !== 2 || eParts.length !== 2) {
        results.push({
          empId: reqObj.empId,
          status: "Invalid Time Format",
          color: "danger",
        });
        continue;
      }
      let diffMins =
        parseInt(eParts[0], 10) * 60 +
        parseInt(eParts[1], 10) -
        (parseInt(sParts[0], 10) * 60 + parseInt(sParts[1], 10));
      if (diffMins <= 0) diffMins += 24 * 60;
      if (diffMins > 240) {
        results.push({
          empId: reqObj.empId,
          status: "Exceeds 4 hours",
          color: "danger",
        });
        continue;
      }

      const pId = idMap[reqObj.empId];
      if (!pId) {
        results.push({
          empId: reqObj.empId,
          status: "Invalid ID",
          color: "danger",
        });
        continue;
      }

      let dayBeforeObj = new Date(reqObj.date);
      dayBeforeObj.setUTCDate(dayBeforeObj.getUTCDate() - 1);
      const schedRes = await fetchWithRetry(
        BASE_URL + "query/Schedule/ScheduleByPersonId",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            PersonId: pId,
            Period: {
              StartDate: dayBeforeObj.toISOString().split("T")[0],
              EndDate: reqObj.date,
            },
            ScenarioId: SCENARIO,
          }),
        }
      );
      const scheduleJson = await schedRes.json();
      if (!scheduleJson.Result) {
        results.push({
          empId: reqObj.empId,
          status: "No Schedule",
          color: "warning",
        });
        continue;
      }

      const localOffset = getEgyptOffsetHours(reqObj.date);
      let targetStartUtc = getUtcIsoString(
          reqObj.date,
          reqObj.start,
          localOffset
        ),
        targetEndUtc = getUtcIsoString(reqObj.date, reqObj.end, localOffset);

      if (targetStartUtc === targetEndUtc) {
        let eObj = new Date(targetEndUtc);
        eObj.setUTCMinutes(eObj.getUTCMinutes() + 1);
        targetEndUtc = eObj.toISOString().split(".")[0] + "Z";
      } else if (targetEndUtc < targetStartUtc) {
        let eObj = new Date(targetEndUtc);
        eObj.setUTCDate(eObj.getUTCDate() + 1);
        targetEndUtc = eObj.toISOString().split(".")[0] + "Z";
      }

      let targetDayData = scheduleJson.Result.find(
          (d) => d.Date.indexOf(reqObj.date) !== -1
        ),
        shiftFound = false;
      for (let d = 0; d < scheduleJson.Result.length; d++) {
        if (
          !scheduleJson.Result[d].Shift ||
          scheduleJson.Result[d].Shift.length === 0
        )
          continue;
        if (
          targetStartUtc >= scheduleJson.Result[d].Shift[0].Period.StartTime &&
          targetEndUtc <=
            scheduleJson.Result[d].Shift[
              scheduleJson.Result[d].Shift.length - 1
            ].Period.EndTime
        ) {
          targetDayData = scheduleJson.Result[d];
          shiftFound = true;
          break;
        }
      }

      if (!shiftFound) {
        let altS = new Date(targetStartUtc);
        altS.setUTCDate(altS.getUTCDate() + 1);
        let altStartUtc = altS.toISOString().split(".")[0] + "Z";
        let altE = new Date(targetEndUtc);
        altE.setUTCDate(altE.getUTCDate() + 1);
        let altEndUtc = altE.toISOString().split(".")[0] + "Z";
        for (let d = 0; d < scheduleJson.Result.length; d++) {
          if (
            !scheduleJson.Result[d].Shift ||
            scheduleJson.Result[d].Shift.length === 0
          )
            continue;
          if (
            altStartUtc >= scheduleJson.Result[d].Shift[0].Period.StartTime &&
            altEndUtc <=
              scheduleJson.Result[d].Shift[
                scheduleJson.Result[d].Shift.length - 1
              ].Period.EndTime
          ) {
            targetDayData = scheduleJson.Result[d];
            targetStartUtc = altStartUtc;
            targetEndUtc = altEndUtc;
            shiftFound = true;
            break;
          }
        }
      }

      let pStartMs = new Date(targetStartUtc).getTime(),
        pEndMs = new Date(targetEndUtc).getTime();
      if (
        !targetDayData ||
        targetDayData.DayOff ||
        !targetDayData.Shift ||
        targetDayData.Shift.length === 0
      ) {
        results.push({ empId: reqObj.empId, status: "OFF", color: "warning" });
        continue;
      }
      if (
        targetDayData.FullDayAbsences &&
        targetDayData.FullDayAbsences.length > 0
      ) {
        results.push({
          empId: reqObj.empId,
          status: "Absence",
          color: "warning",
        });
        continue;
      }

      snapshots.push({
        pId: pId,
        originalData: JSON.parse(JSON.stringify(targetDayData)),
      });

      let sStartMs = new Date(
          targetDayData.Shift[0].Period.StartTime
        ).getTime(),
        sEndMs = new Date(
          targetDayData.Shift[targetDayData.Shift.length - 1].Period.EndTime
        ).getTime();
      pStartMs = Math.max(pStartMs, sStartMs);
      pEndMs = Math.min(pEndMs, sEndMs);
      if (pStartMs >= pEndMs) {
        results.push({
          empId: reqObj.empId,
          status: "Out of Shift",
          color: "danger",
        });
        continue;
      }

      let hardWalls = [],
        wrapBlocks = [],
        movableBlocks = [];
      targetDayData.Shift.forEach((layer) => {
        if (layer.AbsenceId) {
          hardWalls.push(layer);
          return;
        }
        if (layer.ActivityId && HARD_WALL_IDS.includes(layer.ActivityId)) {
          hardWalls.push(layer);
          return;
        }
        if (layer.ActivityId === ACTIVITY_IDS["Online"]) return;
        if (layer.ActivityId === targetActivityId) {
          wrapBlocks.push(layer);
        } else if (layer.ActivityId && BREAK_IDS.includes(layer.ActivityId)) {
          if (breakHandlingLogic === "Shift breaks forward")
            movableBlocks.push(layer);
          else if (breakHandlingLogic === "Cancel if overlapping a break")
            hardWalls.push(layer);
          else wrapBlocks.push(layer);
        } else movableBlocks.push(layer);
      });

      hardWalls.sort(
        (a, b) =>
          new Date(a.Period.StartTime).getTime() -
          new Date(b.Period.StartTime).getTime()
      );
      let currStart = pStartMs,
        effStart = null,
        effEnd = null;
      for (let hw = 0; hw < hardWalls.length; hw++) {
        let hwStart = new Date(hardWalls[hw].Period.StartTime).getTime(),
          hwEnd = new Date(hardWalls[hw].Period.EndTime).getTime();
        if (hwEnd <= currStart) continue;
        if (hwStart >= pEndMs) break;
        if (hwStart > currStart) {
          effStart = currStart;
          effEnd = hwStart;
          break;
        } else currStart = Math.max(currStart, hwEnd);
      }
      if (!effStart && currStart < pEndMs) {
        effStart = currStart;
        effEnd = pEndMs;
      }
      if (!effStart || effStart >= effEnd) {
        results.push({
          empId: reqObj.empId,
          status: "Blocked by Hard Wall",
          color: "danger",
        });
        continue;
      }
      pStartMs = effStart;
      pEndMs = effEnd;

      let overlaps = movableBlocks.filter(
        (f) =>
          pStartMs < new Date(f.Period.EndTime).getTime() &&
          pEndMs > new Date(f.Period.StartTime).getTime()
      );
      if (overlaps.length > 0) {
        let totalDur = 0;
        overlaps.forEach((f) => {
          totalDur +=
            new Date(f.Period.EndTime).getTime() -
            new Date(f.Period.StartTime).getTime();
        });
        movableBlocks = movableBlocks.filter((f) => !overlaps.includes(f));
        let absoluteWalls = hardWalls.concat(wrapBlocks);
        let leftWallMs = sStartMs;
        absoluteWalls.forEach((aw) => {
          let e = new Date(aw.Period.EndTime).getTime();
          if (e > leftWallMs && e <= pStartMs) leftWallMs = e;
        });
        let rightWallMs = sEndMs;
        absoluteWalls.forEach((aw) => {
          let s = new Date(aw.Period.StartTime).getTime();
          if (s < rightWallMs && s >= pEndMs) rightWallMs = s;
        });

        let leftEdgeMs = pStartMs - totalDur,
          rightEdgeMs = pEndMs + totalDur;
        let dominosLeft = [],
          cCheckMsLeft = leftEdgeMs;
        while (true) {
          let hit = movableBlocks.find(
            (f) =>
              cCheckMsLeft < new Date(f.Period.EndTime).getTime() &&
              pStartMs > new Date(f.Period.StartTime).getTime() &&
              !dominosLeft.includes(f)
          );
          if (hit) {
            dominosLeft.push(hit);
            cCheckMsLeft -=
              new Date(hit.Period.EndTime).getTime() -
              new Date(hit.Period.StartTime).getTime();
            leftEdgeMs = cCheckMsLeft;
          } else break;
        }
        let tryLeft = leftEdgeMs >= leftWallMs;

        let dominosRight = [];
        let cCheckMsRight = rightEdgeMs;
        while (true) {
          let hit = movableBlocks.find(
            (f) =>
              cCheckMsRight > new Date(f.Period.StartTime).getTime() &&
              pEndMs < new Date(f.Period.EndTime).getTime() &&
              !dominosRight.includes(f)
          );
          if (hit) {
            dominosRight.push(hit);
            cCheckMsRight +=
              new Date(hit.Period.EndTime).getTime() -
              new Date(hit.Period.StartTime).getTime();
            rightEdgeMs = cCheckMsRight;
          } else break;
        }
        let tryRight = rightEdgeMs <= rightWallMs;

        if (
          tryLeft &&
          absoluteWalls.some(
            (aw) =>
              leftEdgeMs < new Date(aw.Period.EndTime).getTime() &&
              pStartMs > new Date(aw.Period.StartTime).getTime()
          )
        )
          tryLeft = false;
        if (
          tryRight &&
          absoluteWalls.some(
            (aw) =>
              pEndMs < new Date(aw.Period.EndTime).getTime() &&
              rightEdgeMs > new Date(aw.Period.StartTime).getTime()
          )
        )
          tryRight = false;

        if (!tryLeft && !tryRight) {
          results.push({
            empId: reqObj.empId,
            status: "Cannot Shift Blocks",
            color: "danger",
          });
          continue;
        }

        let newShiftedBlocks = [],
          pointerMs = 0;
        if (
          tryLeft &&
          (!tryRight || dominosLeft.length <= dominosRight.length)
        ) {
          pointerMs = pStartMs;
          overlaps.concat(dominosLeft).forEach((f) => {
            let dur =
              new Date(f.Period.EndTime).getTime() -
              new Date(f.Period.StartTime).getTime();
            let nStart = pointerMs - dur;
            newShiftedBlocks.push(
              cloneLayer(
                f,
                new Date(nStart).toISOString().split(".")[0] + "Z",
                new Date(pointerMs).toISOString().split(".")[0] + "Z"
              )
            );
            pointerMs = nStart;
          });
          movableBlocks = movableBlocks.filter((f) => !dominosLeft.includes(f));
        } else {
          pointerMs = pEndMs;
          overlaps.concat(dominosRight).forEach((f) => {
            let dur =
              new Date(f.Period.EndTime).getTime() -
              new Date(f.Period.StartTime).getTime();
            let nEnd = pointerMs + dur;
            newShiftedBlocks.push(
              cloneLayer(
                f,
                new Date(pointerMs).toISOString().split(".")[0] + "Z",
                new Date(nEnd).toISOString().split(".")[0] + "Z"
              )
            );
            pointerMs = nEnd;
          });
          movableBlocks = movableBlocks.filter(
            (f) => !dominosRight.includes(f)
          );
        }
        movableBlocks = movableBlocks.concat(newShiftedBlocks);
      }

      let slicedBreakNames = new Set(),
        targetSlices = [{ start: pStartMs, end: pEndMs }];
      wrapBlocks.forEach((wb) => {
        let wbStartMs = new Date(wb.Period.StartTime).getTime(),
          wbEndMs = new Date(wb.Period.EndTime).getTime(),
          newSlices = [],
          didSlice = false;
        targetSlices.forEach((slice) => {
          if (wbStartMs < slice.end && wbEndMs > slice.start) {
            didSlice = true;
            if (slice.start < wbStartMs)
              newSlices.push({ start: slice.start, end: wbStartMs });
            if (slice.end > wbEndMs)
              newSlices.push({ start: wbEndMs, end: slice.end });
          } else newSlices.push(slice);
        });
        if (didSlice && BREAK_IDS.includes(wb.ActivityId)) {
          let nName = Object.keys(ACTIVITY_IDS).find(
            (k) => ACTIVITY_IDS[k] === wb.ActivityId
          );
          if (nName) slicedBreakNames.add(nName);
        }
        targetSlices = newSlices;
      });

      let normalPieces = [],
        otPieces = [];
      targetSlices.forEach((slice) => {
        targetDayData.Shift.forEach((layer) => {
          let layerStartMs = new Date(layer.Period.StartTime).getTime(),
            layerEndMs = new Date(layer.Period.EndTime).getTime();
          if (slice.start < layerEndMs && slice.end > layerStartMs) {
            let slStart = Math.max(slice.start, layerStartMs),
              slEnd = Math.min(slice.end, layerEndMs);
            if (slEnd > slStart) {
              if (layer.Overtime) otPieces.push({ start: slStart, end: slEnd });
              else normalPieces.push({ start: slStart, end: slEnd });
            }
          }
        });
      });

      if (isSimulation) {
        results.push({
          empId: reqObj.empId,
          status:
            slicedBreakNames.size > 0
              ? `Dry Run: Wrapped around ${Array.from(slicedBreakNames).join(
                  " & "
                )}`
              : "Dry Run: Success",
          color: "warning",
        });
        continue;
      }

      try {
        for (let i = 0; i < otPieces.length; i++) {
          await fetchWithRetry(BASE_URL + "command/AddOvertime", {
            method: "POST",
            headers,
            body: JSON.stringify({
              TimeZoneId: "UTC",
              BusinessUnitId: BUSINESS_UNIT_ID,
              PersonId: pId,
              Period: {
                StartTime: new Date(otPieces[i].start)
                  .toISOString()
                  .substring(0, 19),
                EndTime: new Date(otPieces[i].end)
                  .toISOString()
                  .substring(0, 19),
              },
              ActivityId: targetActivityId,
              MultiplicatorDefinitionSetId: OVERTIME_GUID,
              ScenarioId: SCENARIO,
            }),
          });
        }
        let floaters = hardWalls.concat(wrapBlocks).concat(movableBlocks);
        normalPieces.forEach((np) => {
          floaters.push(
            createNewLayer(
              targetActivityId,
              new Date(np.start).toISOString().split(".")[0] + "Z",
              new Date(np.end).toISOString().split(".")[0] + "Z",
              null,
              null
            )
          );
        });
        floaters.sort(
          (a, b) =>
            new Date(a.Period.StartTime).getTime() -
            new Date(b.Period.StartTime).getTime()
        );
        targetDayData.Shift = fillGapsWithOriginalOt(
          floaters,
          targetDayData.Shift,
          sStartMs,
          sEndMs
        );
        let safeLayers = targetDayData.Shift.map((l) => {
          let c = {
            Period: l.Period,
            ActivityId: l.ActivityId || ACTIVITY_IDS["Online"],
          };
          if (l.Overtime) c.Overtime = l.Overtime;
          return c;
        });
        let dayPayload = {
          Date: targetDayData.Date,
          ShiftCategoryId: targetDayData.ShiftCategory
            ? targetDayData.ShiftCategory.Id
            : null,
          Layers: safeLayers,
        };
        if (targetDayData.DayOff) dayPayload.IsDayOff = true;
        if (
          targetDayData.FullDayAbsences &&
          targetDayData.FullDayAbsences.length > 0
        )
          dayPayload.FullDayAbsenceId =
            targetDayData.FullDayAbsences[0].AbsenceId ||
            targetDayData.FullDayAbsences[0].Id;
        await fetchWithRetry(BASE_URL + "command/SetSchedulesForPerson", {
          method: "POST",
          headers,
          body: JSON.stringify({
            TimeZoneId: "UTC",
            BusinessUnitId: BUSINESS_UNIT_ID,
            DatePeriod: {
              StartDate: targetDayData.Date,
              EndDate: targetDayData.Date,
            },
            ScheduleDays: [dayPayload],
            PersonId: pId,
            ScenarioId: SCENARIO,
          }),
        });
        results.push({
          empId: reqObj.empId,
          status:
            slicedBreakNames.size > 0
              ? "Updated (Wrapped around " +
                Array.from(slicedBreakNames).join(" & ") +
                ")"
              : "Updated",
          color: "success",
        });
      } catch (e) {
        results.push({
          empId: reqObj.empId,
          status: `Failed`,
          color: "danger",
        });
      }
    }
    const opId = Date.now().toString();
    if (!isSimulation && snapshots.length > 0) undoHistory[opId] = snapshots;
    res.json({ results, opId: isSimulation ? null : opId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  const indexPath = fs.existsSync(distPath)
    ? path.join(distPath, 'index.html')
    : path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WFM Server running on port ${PORT}`);
});
