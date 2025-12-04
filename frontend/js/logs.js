async function initLogsPage() {
  const serviceSelect = document.getElementById("service-select");
  const svcFromQuery = getQueryParam("service");

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

  // 🔄 Auto-refresh log every 2 seconds
  setInterval(() => {
    const file = document.getElementById("log-files").value;
    if (file && file !== "No log files" && file !== "Error loading logs") {
      loadLog(true); // auto-refresh mode
    }
  }, 2000);
}

async function loadLogFiles() {
  const serviceSelect = document.getElementById("service-select");
  const svc = serviceSelect.value;
  const filesSelect = document.getElementById("log-files");
  const content = document.getElementById("log-content");
  content.textContent = "(no log loaded)";

  try {
    const data = await apiGet(`/logs/${svc}`);
    filesSelect.innerHTML = "";

    if (!data.files || data.files.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No log files";
      opt.disabled = true;
      filesSelect.appendChild(opt);
      return;
    }

    data.files.forEach(file => {
      const opt = document.createElement("option");
      opt.value = file;
      opt.textContent = file;
      filesSelect.appendChild(opt);
    });

    // Load first log automatically
    loadLog(false);
  } catch (err) {
    filesSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.textContent = "Error loading logs";
    opt.disabled = true;
    filesSelect.appendChild(opt);
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
    const previousScrollBottom =
      content.scrollHeight - content.scrollTop - content.clientHeight < 40;

    content.textContent = data.content || "(empty)";

    // Auto-scroll only if user was already at bottom OR the load is manual
    if (!isRefresh || previousScrollBottom) {
      content.scrollTop = content.scrollHeight;
    }

  } catch (err) {
    content.textContent = "Error loading log: " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initLogsPage();
  document
    .getElementById("service-select")
    .addEventListener("change", loadLogFiles);

  document
    .getElementById("log-files")
    .addEventListener("change", () => loadLog(false));
});
