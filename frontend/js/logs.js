document.addEventListener("DOMContentLoaded", () => {
  initLogsPage();

  document.getElementById("service-select")
      .addEventListener("change", loadLogFiles);

  document.getElementById("log-files")
      .addEventListener("change", () => loadLog(false));

  setupWrapToggle();
  setupMaximizeToggle();
  setupClearButton();
});


async function initLogsPage() {
  const serviceSelect = document.getElementById("service-select");
  const svcFromQuery = getQueryParam("service");

   // Load services 
  const data = await apiGet("/services");
  serviceSelect.innerHTML = "";
  data.services.forEach(svc => {
    const o = document.createElement("option");
    o.value = svc.name;
    o.textContent = svc.name;
    serviceSelect.appendChild(o);
  });

  if (svcFromQuery) {
    serviceSelect.value = svcFromQuery;
  }
  
  await loadLogFiles();

  // Auto refresh
  setInterval(() => {
    const file = document.getElementById("log-files").value;
    if (file && file !== "No log files") loadLog(true);
  }, 2000);
}


async function loadLogFiles() {
  const svc = document.getElementById("service-select").value;
  const filesSelect = document.getElementById("log-files");
  const content = document.getElementById("log-content");

  content.textContent = "(no log loaded)";
  filesSelect.innerHTML = "";

  try {
    const data = await apiGet(`/logs/${svc}`);
    const files = (data.files || []).sort().reverse();

    if (!files.length) {
      filesSelect.innerHTML = `<option disabled>No log files</option>`;
      return;
    }

    files.forEach(f => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = f;
      filesSelect.appendChild(opt);
    });

    filesSelect.value = files[0];
    await loadLog(false);
  } catch (err) {
    filesSelect.innerHTML = `<option disabled>Error loading logs</option>`;
  }
}


async function loadLog(isRefresh = false) {
  const svc = document.getElementById("service-select").value;
  const file = document.getElementById("log-files").value;
  const content = document.getElementById("log-content");

  if (!file) return;

  try {
    const data = await apiGet(`/logs/${svc}/${encodeURIComponent(file)}`);

    const atBottom =
      content.scrollHeight - content.scrollTop - content.clientHeight < 40;

    content.textContent = data.content || "(empty)";

    if (!isRefresh || atBottom) {
      content.scrollTop = content.scrollHeight;
    }

  } catch (err) {
    content.textContent = "Error loading log: " + err.message;
  }
}


/* Wrap / Unwrap */
function setupWrapToggle() {
  const btn = document.getElementById("wrap-toggle");
  const log = document.getElementById("log-content");

  btn.addEventListener("click", () => {
    if (log.style.whiteSpace === "pre") {
      log.style.whiteSpace = "pre-wrap";
      btn.textContent = "Unwrap";
    } else {
      log.style.whiteSpace = "pre";
      btn.textContent = "Wrap";
    }
  });
}


/* Maximize / Restore */
function setupMaximizeToggle() {
  const btn = document.getElementById("maximize-toggle");
  const log = document.getElementById("log-content");

  btn.addEventListener("click", () => {
    const isMax = log.classList.toggle("maximized");
    document.body.classList.toggle("maximized-log", isMax);
    btn.textContent = isMax ? "Restore" : "Maximize";
  });
}


/* Clear log viewer */
function setupClearButton() {
  const btn = document.getElementById("clear-log");
  const log = document.getElementById("log-content");

  btn.addEventListener("click", () => {
    log.textContent = "";
  });
}
