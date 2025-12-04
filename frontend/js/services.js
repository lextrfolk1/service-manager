async function loadServices() {
  const container = document.getElementById("services");
  container.innerHTML = "Loading services...";
  try {
    const data = await apiGet("/services");
    container.innerHTML = "";
    data.services.forEach(svc => {
      const card = document.createElement("div");
      card.className = "service-card";
      card.id = `svc-${svc.name}`;

      const info = document.createElement("div");
      info.className = "service-info";
      info.innerHTML = `
        <h2>${svc.name}</h2>
        <p>${svc.description || ""}</p>
        <div class="service-meta">
          <span class="badge badge-type">${svc.type || "unknown"}</span>
          ${svc.port ? `<span class="badge badge-port">Port ${svc.port}</span>` : ""}
          <span class="status-text" id="status-${svc.name}">
            <span class="status-dot status-stopped"></span>checking...
          </span>
        </div>
      `;

      const actions = document.createElement("div");
      actions.innerHTML = `
        <button class="btn btn-primary" onclick="startService('${svc.name}')">Start</button>
        <button class="btn btn-secondary" onclick="stopService('${svc.name}')">Stop</button>
        <button class="btn btn-secondary" onclick="restartService('${svc.name}')">Restart</button>
        <button class="btn btn-secondary" onclick="viewLogs('${svc.name}')">View Logs</button>
      `;

      card.appendChild(info);
      card.appendChild(actions);
      container.appendChild(card);

      refreshStatus(svc.name);
    });
  } catch (err) {
    container.innerHTML = "Failed to load services: " + err.message;
  }
}

async function refreshStatus(name) {
  const el = document.getElementById("status-" + name);
  if (!el) return;
  try {
    const data = await apiGet(`/service/${name}/status`);
    const running = data.running;
    el.innerHTML = `
      <span class="status-dot ${running ? "status-running" : "status-stopped"}"></span>
      ${running ? "Running" : "Stopped"}
    `;
  } catch (err) {
    el.innerHTML = `<span class="status-dot status-stopped"></span>Unknown`;
  }
}

async function startService(name) {
  const out = document.getElementById("output");
  out.textContent = `Starting ${name}...\n`;
  try {
    const data = await apiPost(`/service/${name}/start`);
    out.textContent += JSON.stringify(data, null, 2);
    refreshStatus(name);
  } catch (err) {
    out.textContent += "Error: " + err.message;
  }
}

async function stopService(name) {
  const out = document.getElementById("output");
  out.textContent = `Stopping ${name}...\n`;
  try {
    const data = await apiPost(`/service/${name}/stop`);
    out.textContent += JSON.stringify(data, null, 2);
    refreshStatus(name);
  } catch (err) {
    out.textContent += "Error: " + err.message;
  }
}

async function restartService(name) {
  const out = document.getElementById("output");
  out.textContent = `Restarting ${name}...\n`;
  try {
    const data = await apiPost(`/service/${name}/restart`);
    out.textContent += JSON.stringify(data, null, 2);
    refreshStatus(name);
  } catch (err) {
    out.textContent += "Error: " + err.message;
  }
}

function viewLogs(name) {
  window.location.href = `logs.html?service=${encodeURIComponent(name)}`;
}

document.addEventListener("DOMContentLoaded", loadServices);
