let allServices = [];

/* Utility: badge builder */
function badge(text, type) {
  return `<span class="badge ${type}">${text}</span>`;
}

/* Utility: button builder */
function actionBtn(label, onClick, style = "") {
  return `<button class="btn ${style}" onclick="${onClick}">${label}</button>`;
}

/* --------------------------------------------------------- */
/* Load Services                                              */
/* --------------------------------------------------------- */

async function loadServices() {
  const container = document.getElementById("services");
  container.innerHTML = `<div>Loading...</div>`;

  try {
    const data = await apiGet("/services");
    allServices = data.services;
    renderServices(allServices);
  } catch (err) {
    container.innerHTML = `<div>Failed to load: ${err.message}</div>`;
  }
}

/* --------------------------------------------------------- */
/* Render Services (supports search filter)                   */
/* --------------------------------------------------------- */

function renderServices(list) {
  const container = document.getElementById("services");
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `<div>No matching services found.</div>`;
    return;
  }

  list.forEach(renderCard);
}

/* --------------------------------------------------------- */
/* Create Service Card                                        */
/* --------------------------------------------------------- */

function renderCard(svc) {
  const container = document.getElementById("services");

  const card = document.createElement("div");
  card.className = "service-card";
  card.id = `svc-${svc.name}`;

  card.innerHTML = `
    <div class="svc-header">
      <h2>${svc.name}</h2>
      ${badge(svc.type || "Unknown", "type")}
    </div>

    <p class="svc-desc">${svc.description || ""}</p>

    <div class="svc-meta">
      ${svc.port ? badge("Port " + svc.port, "port") : ""}
      <span id="status-${svc.name}" class="status-text">
        <span class="status-dot status-stopped"></span>checking...
      </span>
    </div>

    <div class="svc-actions">
      ${actionBtn("Start", `startService('${svc.name}')`, "btn-primary")}
      ${actionBtn("Stop", `stopService('${svc.name}')`, "btn-secondary")}
      ${actionBtn("Restart", `restartService('${svc.name}')`, "btn-secondary")}
      ${actionBtn("Logs", `viewLogs('${svc.name}')`, "btn-secondary")}
    </div>
  `;

  container.appendChild(card);
  refreshStatus(svc.name);
}

/* --------------------------------------------------------- */
/* Status Refresh                                             */
/* --------------------------------------------------------- */

async function refreshStatus(name) {
  const el = document.getElementById("status-" + name);
  if (!el) return;

  try {
    const { running } = await apiGet(`/service/${name}/status`);
    el.innerHTML = `
      <span class="status-dot ${running ? "status-running" : "status-stopped"}"></span>
      ${running ? "Running" : "Stopped"}
    `;
  } catch {
    el.innerHTML = `<span class="status-dot status-stopped"></span>Unknown`;
  }
}

/* --------------------------------------------------------- */
/* Start / Stop / Restart                                     */
/* --------------------------------------------------------- */

async function execServiceAction(name, action) {
  const out = document.getElementById("output");
  out.textContent = `${action.toUpperCase()} ${name}...\n`;

  try {
    const data = await apiPost(`/service/${name}/${action}`);
    out.textContent += JSON.stringify(data, null, 2);
    refreshStatus(name);
  } catch (err) {
    out.textContent += "Error: " + err.message;
  }
}

function startService(name) { execServiceAction(name, "start"); }
function stopService(name) { execServiceAction(name, "stop"); }
function restartService(name) { execServiceAction(name, "restart"); }

/* --------------------------------------------------------- */
/* Logs                                                       */
/* --------------------------------------------------------- */

function viewLogs(name) {
  window.location.href = `logs.html?service=${encodeURIComponent(name)}`;
}

/* --------------------------------------------------------- */
/* Search Feature                                             */
/* --------------------------------------------------------- */

document.getElementById("search-input").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();

  const filtered = allServices.filter(svc =>
    svc.name.toLowerCase().includes(q) ||
    (svc.description || "").toLowerCase().includes(q) ||
    (svc.type || "").toLowerCase().includes(q)
  );

  renderServices(filtered);
});

/* --------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", loadServices);
