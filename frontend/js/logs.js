async function initLogsPage() {
  const serviceSelect = document.getElementById("service-select");
  const svcFromQuery = getQueryParam("service");

  // Load services
  const data = await apiGet("/services");
  serviceSelect.innerHTML = "";
  data.services.forEach(svc => {
    const opt = document.createElement("option");
    opt.value = svc.name;
    opt.textContent = svc.name;
    serviceSelect.appendChild(opt);
  });

  if (svcFromQuery) {
    serviceSelect.value = svcFromQuery;
  }

  await loadLogFiles();

  setupWrapToggle();
  setupMaximizeToggle();

  // Auto-refresh log every 2 seconds
  setInterval(() => {
    const file = document.getElementById("log-files").value;
    if (file && file !== "No log files" && file !== "Error loading logs") {
      loadLog(true);
    }
  }, 2000);
}


async function loadLogFiles() {
  const serviceSelect = document.getElementById("service-select");
  const svc = serviceSelect.value;
  const filesSelect = document.getElementById("log-files");
  const content = document.getElementById("log-content");

  content.textContent = "(no log loaded)";
  filesSelect.innerHTML = "";

  try {
    const data = await apiGet(`/logs/${svc}`);
    let files = data.files || [];

    if (files.length === 0) {
      filesSelect.innerHTML = `<option disabled>No log files</option>`;
      return;
    }

    // Sort newest first
    files.sort((a, b) => b.localeCompare(a));

    // Populate dropdown
    files.forEach(file => {
      const opt = document.createElement("option");
      opt.value = file;
      opt.textContent = file;
      filesSelect.appendChild(opt);
    });

    // Select latest log
    filesSelect.value = files[0];

    await loadLog(false);

  } catch (err) {
    filesSelect.innerHTML = `<option disabled>Error loading logs</option>`;
  }
}


async function loadLog(isRefresh = false) {
  const serviceSelect = document.getElementById("service-select");
  const filesSelect = document.getElementById("log-files");
  const svc = serviceSelect.value;
  const file = filesSelect.value;
  const content = document.getElementById("log-content");

  if (!file || file === "No log files" || file === "Error loading logs") {
    content.textContent = "(no log loaded)";
    return;
  }

  try {
    const data = await apiGet(`/logs/${svc}/${encodeURIComponent(file)}`);

    // Track whether user is near bottom
    const isAtBottom =
      content.scrollHeight - content.scrollTop - content.clientHeight < 40;

    content.textContent = data.content || "(empty)";

    if (!isRefresh || isAtBottom) {
      content.scrollTop = content.scrollHeight;
    }

  } catch (err) {
    content.textContent = "Error loading log: " + err.message;
  }
}


/* ------------------------------------------------------------------
   WRAP / UNWRAP TOGGLE
--------------------------------------------------------------------*/
function setupWrapToggle() {
  const btn = document.getElementById("wrap-toggle");
  const log = document.getElementById("log-content");

  // Default → unwrap (no wrapping)
  log.style.whiteSpace = "pre";
  btn.textContent = "Wrap";

  btn.addEventListener("click", () => {
    if (log.style.whiteSpace === "pre") {
      log.style.whiteSpace = "pre-wrap";  // enable wrapping
      btn.textContent = "Unwrap";
    } else {
      log.style.whiteSpace = "pre"; // disable wrapping
      btn.textContent = "Wrap";
    }
  });
}


/* ------------------------------------------------------------------
   MAXIMIZE / RESTORE LOG VIEWER
--------------------------------------------------------------------*/
function setupMaximizeToggle() {
  const btn = document.getElementById("maximize-toggle");
  const log = document.getElementById("log-content");

  btn.addEventListener("click", () => {
    if (log.classList.contains("maximized")) {
      log.classList.remove("maximized");
      document.body.classList.remove("maximized-log");
      btn.textContent = "Maximize";
    } else {
      log.classList.add("maximized");
      document.body.classList.add("maximized-log");
      btn.textContent = "Restore";
    }
  });
}


/* ------------------------------------------------------------------
   Event Listeners
--------------------------------------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  initLogsPage();

  document.getElementById("service-select")
    .addEventListener("change", loadLogFiles);

  document.getElementById("log-files")
    .addEventListener("change", () => loadLog(false));
});
