document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
  ["bufferDate", "shapeStartDate", "shapeEndDate", "tardyDate"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = today;
    }
  );
});

function createToast(message, type) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "check-circle" : "alert-circle";
  toast.innerHTML = `<i data-lucide="${icon}" class="toast-icon"></i> <span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function switchTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.add("hidden"));
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(tabId + "-view").classList.remove("hidden");
  event.currentTarget.classList.add("active");
}

function getToken() {
  let t = document.getElementById("apiToken").value.trim();
  if (!t) {
    createToast("Authentication Required", "error");
    return null;
  }
  return t;
}

async function verifyToken() {
  const token = document.getElementById("apiToken").value.trim();
  const statusDiv = document.getElementById("tokenStatus");
  if (!token) return createToast("Paste token first!", "error");
  statusDiv.textContent = "Verifying...";
  statusDiv.style.color = "var(--text-tertiary)";
  try {
    const res = await fetch("/api/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (data.valid) {
      statusDiv.textContent = "Authorized ✓";
      statusDiv.style.color = "var(--success-main)";
      createToast("Connected to Calabrio", "success");
    } else {
      statusDiv.textContent = "Unauthorized ×";
      statusDiv.style.color = "var(--danger-main)";
      createToast(data.message, "error");
    }
  } catch (e) {
    statusDiv.textContent = "Connection Failed";
    statusDiv.style.color = "var(--danger-main)";
  }
}

let lastTardyOpId = null;
let lastActivityOpId = null;

async function executeUndo(type) {
  const token = getToken();
  if (!token) return;
  const opId = type === "tardy" ? lastTardyOpId : lastActivityOpId;
  if (!opId) return createToast("No action to undo.", "error");
  if (!confirm("Confirm Undo? Restores original schedules.")) return;
  try {
    const res = await fetch("/api/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, opId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    createToast(data.message, "success");
    document
      .getElementById(type === "tardy" ? "undoTardyBtn" : "undoActBtn")
      .classList.add("hidden");
  } catch (e) {
    createToast(e.message, "error");
  }
}

function exportCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  let csv = [];
  for (let i = 0; i < table.rows.length; i++) {
    let row = [],
      cols = table.rows[i].querySelectorAll("td, th");
    for (let j = 0; j < cols.length; j++)
      row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
    csv.push(row.join(","));
  }
  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.download = `${filename}_${new Date().getTime()}.csv`;
  link.href = window.URL.createObjectURL(blob);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  createToast("Exported successfully", "success");
}

function getBadge(status, colorCode) {
  let cssClass = "badge-info";
  if (colorCode.includes("success") || colorCode.includes("d9ead3"))
    cssClass = "badge-success";
  if (
    colorCode.includes("danger") ||
    colorCode.includes("f4cccc") ||
    colorCode.includes("fef2f2")
  )
    cssClass = "badge-danger";
  if (
    colorCode.includes("warning") ||
    colorCode.includes("fff2cc") ||
    colorCode.includes("fef08a")
  )
    cssClass = "badge-warning";
  return `<span class="badge ${cssClass}">${status}</span>`;
}

async function runBuffer() {
  const token = getToken();
  if (!token) return;
  document.getElementById("bufferLoading").classList.remove("hidden");
  document.getElementById("bufferDashboard").classList.add("hidden");
  try {
    const res = await fetch("/api/staffing/buffer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        date: document.getElementById("bufferDate").value,
        interval: document.getElementById("bufferTime").value,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const format = (v) =>
      `<span style="color:${
        v >= 0 ? "var(--success-text)" : "var(--danger-text)"
      };font-weight:600">${v > 0 ? "+" + v : v}</span>`;
    document.getElementById("bufferNormalBody").innerHTML = data
      .map(
        (r) =>
          `<tr><td><strong>${r.lob}</strong></td><td>${r.forecast}</td><td>${
            r.scheduled
          }</td><td>${format(r.diff)}</td></tr>`
      )
      .join("");
    document.getElementById("bufferShrinkBody").innerHTML = data
      .map(
        (r) =>
          `<tr><td><strong>${r.lob}</strong></td><td>${
            r.forecastShrink
          }</td><td>${r.scheduledShrink}</td><td>${format(
            r.diffShrink
          )}</td></tr>`
      )
      .join("");
    document.getElementById("bufferDashboard").classList.remove("hidden");
    createToast("Buffer data retrieved", "success");
  } catch (e) {
    createToast(e.message, "error");
  }
  document.getElementById("bufferLoading").classList.add("hidden");
}

async function runShape() {
  const token = getToken();
  if (!token) return;
  document.getElementById("shapeLoading").classList.remove("hidden");
  document.getElementById("shapeDashboard").classList.add("hidden");
  try {
    const res = await fetch("/api/staffing/shape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        startDate: document.getElementById("shapeStartDate").value,
        startTime: document.getElementById("shapeStartTime").value,
        endDate: document.getElementById("shapeEndDate").value,
        endTime: document.getElementById("shapeEndTime").value,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const build = (h, b, arr) => {
      document.getElementById(h).innerHTML = `<tr><th>Time</th>${data.lobs
        .map((l) => `<th>${l}</th>`)
        .join("")}</tr>`;
      document.getElementById(b).innerHTML = arr
        .map(
          (r) =>
            `<tr><td><strong>${r.time}</strong></td>${data.lobs
              .map((lob) => {
                let v = r[lob] || 0;
                return `<td style="color:${
                  v >= 0 ? "var(--success-text)" : "var(--danger-text)"
                };font-weight:600">${v > 0 ? "+" + v : v}</td>`;
              })
              .join("")}</tr>`
        )
        .join("");
    };
    build("shapeNormalHead", "shapeNormalBody", data.normal);
    build("shapeShrinkHead", "shapeShrinkBody", data.shrink);
    document.getElementById("shapeDashboard").classList.remove("hidden");
    createToast("Shape analysis complete", "success");
  } catch (e) {
    createToast(e.message, "error");
  }
  document.getElementById("shapeLoading").classList.add("hidden");
}

async function runActivity() {
  const token = getToken();
  if (!token) return;
  const raw = document.getElementById("actInput").value.trim().split("\n");
  const reqs = raw.map((r) => {
    const p = r.split("\t");
    return {
      empId: p[0]?.trim(),
      date: p[1]?.trim(),
      start: p[2]?.trim(),
      end: p[3]?.trim(),
    };
  });
  document.getElementById("actTableContainer").classList.remove("hidden");
  document.getElementById("actBody").innerHTML = "";
  document.getElementById("actLoading").classList.remove("hidden");
  document.getElementById("undoActBtn").classList.add("hidden");
  try {
    const res = await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        requests: reqs,
        activityName: document.getElementById("actType").value,
        breakHandlingLogic: document.getElementById("actLogic").value,
        isSimulation: document.getElementById("safeModeAct").checked,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    document.getElementById("actBody").innerHTML = data.results
      .map(
        (r) =>
          `<tr><td><strong>${r.empId}</strong></td><td>${getBadge(
            r.status,
            r.color
          )}</td></tr>`
      )
      .join("");
    if (data.opId) {
      lastActivityOpId = data.opId;
      document.getElementById("undoActBtn").classList.remove("hidden");
    }
    createToast("Activity batch processed", "success");
  } catch (e) {
    createToast(e.message, "error");
  }
  document.getElementById("actLoading").classList.add("hidden");
}

async function runTardy() {
  const token = getToken();
  if (!token) return;
  const date = document.getElementById("tardyDate").value;
  const raw = document.getElementById("tardyInput").value.trim().split("\n");
  const reqs = raw.map((r) => {
    const p = r.split("\t");
    return { empId: p[0]?.trim(), loginTime: p[1]?.trim() };
  });
  document.getElementById("tardyTableContainer").classList.remove("hidden");
  document.getElementById("tardyBody").innerHTML = "";
  document.getElementById("tardyLoading").classList.remove("hidden");
  document.getElementById("undoTardyBtn").classList.add("hidden");
  try {
    const res = await fetch("/api/tardy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        date,
        requests: reqs,
        isSimulation: document.getElementById("safeModeTardy").checked,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    document.getElementById("tardyBody").innerHTML = data.results
      .map(
        (r) =>
          `<tr><td><strong>${r.empId}</strong></td><td>${getBadge(
            r.status,
            r.color
          )}</td></tr>`
      )
      .join("");
    if (data.opId) {
      lastTardyOpId = data.opId;
      document.getElementById("undoTardyBtn").classList.remove("hidden");
    }
    createToast("Tardy batch processed", "success");
  } catch (e) {
    createToast(e.message, "error");
  }
  document.getElementById("tardyLoading").classList.add("hidden");
}
