const express = require("express");
const cors = require("cors");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const ServiceManager = require("./serviceManager");
const logger = require("./logger");
const { streamCombinedLogs } = require("./combinedLogs");
const runConfig = require("./runConfig");
const { resolveConfigPath, getConfigMetadata, readConfig, invalidateConfigCache } = require("./configResolver");
const { killProcessOnPort, getPortProcess } = require("./utils/portUtils");
let servicesConfigPath = resolveConfigPath();

function resolveHomeDir(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function runFileCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        return reject(error);
      }
      resolve((stdout || "").trim());
    });
  });
}

async function openNativeDirectoryPicker(initialPath) {
  const resolvedInitialPath = resolveHomeDir(initialPath);

  if (process.platform === "darwin") {
    const scriptLines = [
      'set chooserPrompt to "Select a folder for Struo"',
      resolvedInitialPath
        ? `set chosenFolder to POSIX path of (choose folder with prompt chooserPrompt default location POSIX file "${resolvedInitialPath.replace(/"/g, '\\"')}")`
        : 'set chosenFolder to POSIX path of (choose folder with prompt chooserPrompt)',
      'return chosenFolder'
    ];

    try {
      return await runFileCommand("osascript", scriptLines.flatMap((line) => ["-e", line]));
    } catch (error) {
      if (String(error.stderr || error.message).toLowerCase().includes("user canceled")) {
        return null;
      }
      throw error;
    }
  }

  if (process.platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      '$dialog.Description = "Select a folder for Struo"',
      resolvedInitialPath ? `$dialog.SelectedPath = '${resolvedInitialPath.replace(/'/g, "''")}'` : "",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
    ].filter(Boolean).join("; ");

    return (await runFileCommand("powershell.exe", ["-NoProfile", "-Command", script])) || null;
  }

  try {
    return (await runFileCommand("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select a folder for Struo",
      ...(resolvedInitialPath ? [`--filename=${resolvedInitialPath}`] : [])
    ])) || null;
  } catch (error) {
    if ((error.code || 0) === 1) {
      return null;
    }
    throw error;
  }
}

function loadConfig() {
  servicesConfigPath = resolveConfigPath();
  return readConfig();
}

// Length of buffer[0..length) without a trailing, incomplete UTF-8 character
// (it is picked up on the next read once the rest of its bytes are written).
function completeUtf8Length(buffer, length) {
  let continuation = 0;
  while (continuation < 3 && continuation < length && (buffer[length - 1 - continuation] & 0xc0) === 0x80) {
    continuation += 1;
  }
  const leadIndex = length - 1 - continuation;
  if (leadIndex < 0) return length;
  const lead = buffer[leadIndex];
  const expected = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
  return expected > continuation + 1 ? leadIndex : length;
}

function sendOperationError(res, err) {
  res.status(500).json({
    error: err.message,
    code: err.code || "operation_failed",
    phase: err.phase || "runtime",
    service: err.service || null,
    details: err.details || null
  });
}

// Own copy: the PUT handlers below modify `config` before writing it, and must not touch the shared cache.
let config = structuredClone(loadConfig());
let services = config.services;
let manager = new ServiceManager(config);

const app = express();
app.use(cors());
app.use(express.json());

// Reload config helper
function reloadConfig() {
  invalidateConfigCache();
  config = structuredClone(loadConfig());
  services = config.services;
  manager = new ServiceManager(config);
}

// List all services
app.get("/services", (req, res) => {
  try {
    // Always use fresh config to catch manual edits
    const freshConfig = loadConfig();
    const freshServices = freshConfig.services;

    const list = Object.entries(freshServices).map(([name, meta]) => ({
      name,
      type: meta.type,
      port: meta.port,
      path: meta.path,
      description: meta.description || "",
      dependsOn: meta.dependsOn || [],
      group: meta.group || null,
      hasBuild: Boolean(meta.build),
      hasHealthCheck: Boolean(meta.healthCommand),
      healthCommand: meta.healthCommand || null,
      docsPath: meta.docsPath || null,
      healthPath: meta.healthPath || null,
      enableGit: meta.enableGit !== false && freshConfig.config?.enableGit !== false
    }));

    res.json({ services: list });
  } catch (error) {
    console.error('Error in /services endpoint:', error);
    res.status(500).json({ error: `Failed to load services: ${error.message}` });
  }
});

// Get live resource metrics (CPU, RAM, Uptime) for running services
app.get("/services/metrics", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const metrics = await freshManager.getResourceMetrics();
    res.json({ metrics, timestamp: Date.now() });
  } catch (error) {
    console.error("Error in /services/metrics endpoint:", error);
    res.status(500).json({ error: `Failed to load metrics: ${error.message}` });
  }
});

// Status of all (or ?names=a,b) services in one request; ?git=false skips git info
app.get("/services/status", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const names = req.query.names
      ? String(req.query.names).split(",").map((name) => name.trim()).filter(Boolean)
      : undefined;
    const statuses = await freshManager.statusAll(names, { includeGit: req.query.git !== "false" });
    res.json({ statuses });
  } catch (error) {
    sendOperationError(res, error);
  }
});

// Get single service metadata
app.get("/services/:name", (req, res) => {
  // Always use fresh config to catch manual edits
  const freshConfig = loadConfig();
  const svc = freshConfig.services[req.params.name];
  if (!svc) return res.status(404).json({ error: "Unknown service" });
  res.json({ name: req.params.name, ...svc });
});

// Get full configuration (config + services)
app.get("/config", (req, res) => {
  try {
    // Always read fresh from file to catch manual edits
    const freshConfig = loadConfig();
    res.json({
      ...freshConfig,
      runtime: getConfigMetadata(),
    });
  } catch (error) {
    console.error('Error loading config:', error);
    res.status(500).json({ error: `Failed to load configuration: ${error.message}` });
  }
});

// Update full configuration
app.put("/config", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || !body.config || !body.services) {
    return res.status(400).json({ error: "Invalid config payload. Expected { config: object, services: object }" });
  }
  fs.writeFileSync(servicesConfigPath, JSON.stringify(body, null, 2), "utf8");
  reloadConfig();
  res.json({ message: "Configuration updated" });
});

// Get base paths configuration
app.get("/config/basepaths", (req, res) => {
  const freshConfig = loadConfig();
  res.json({ basePaths: freshConfig.config.basePaths });
});

// Update base paths configuration
app.put("/config/basepaths", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || !body.basePaths) {
    return res.status(400).json({ error: "Invalid payload. Expected { basePaths: object }" });
  }
  
  config.config.basePaths = body.basePaths;
  fs.writeFileSync(servicesConfigPath, JSON.stringify(config, null, 2), "utf8");
  reloadConfig();
  
  res.json({ message: "Base paths updated", basePaths: config.config.basePaths });
});

// Get services configuration
app.get("/config/services", (req, res) => {
  res.json({ services: config.services });
});

// Update services configuration
app.put("/config/services", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || !body.services) {
    return res.status(400).json({ error: "Invalid payload. Expected { services: object }" });
  }
  config.services = body.services;
  fs.writeFileSync(servicesConfigPath, JSON.stringify(config, null, 2), "utf8");
  reloadConfig();
  res.json({ message: "Services configuration updated" });
});

app.post("/system/pick-directory", async (req, res) => {
  try {
    const selectedPath = await openNativeDirectoryPicker(req.body?.initialPath);
    res.json({ path: selectedPath, cancelled: !selectedPath });
  } catch (error) {
    res.status(500).json({ error: `Directory picker failed: ${error.message}` });
  }
});

// Helper function to get fresh manager
function getFreshManager() {
  const freshConfig = loadConfig();
  return new ServiceManager(freshConfig);
}

// Start service
app.post("/service/:name/start", async (req, res) => {
  try {
    const buildFlag = req.query.build === 'true';
    const freshManager = getFreshManager();
    const result = await freshManager.start(req.params.name, buildFlag);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Stop service
app.post("/service/:name/stop", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.stop(req.params.name);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Restart service
app.post("/service/:name/restart", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.restart(req.params.name);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Status
app.get("/service/:name/status", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.status(req.params.name);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Git: get lightweight git status
app.get("/service/:name/git", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const forceFresh = req.query.fresh === "true";
    const result = await freshManager.getGitInfo(req.params.name, forceFresh);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Git: list branches
app.get("/service/:name/git/branches", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const shouldFetch = req.query.fetch === "true";
    const result = await freshManager.getGitBranches(req.params.name, shouldFetch);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Git: checkout branch
app.post("/service/:name/git/checkout", async (req, res) => {
  try {
    const { branch, restart } = req.body || {};
    if (!branch) {
      return res.status(400).json({ error: "Missing required 'branch' in request body" });
    }
    const freshManager = getFreshManager();
    const result = await freshManager.checkoutBranch(req.params.name, branch, Boolean(restart));
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Git: pull latest changes
app.post("/service/:name/git/pull", async (req, res) => {
  try {
    const { restart } = req.body || {};
    const freshManager = getFreshManager();
    const result = await freshManager.pullBranch(req.params.name, Boolean(restart));
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Git: push current local branch to remote and set upstream
app.post("/service/:name/git/push", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.pushBranch(req.params.name);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Port: Free port for service (terminate occupying process)
app.post(["/service/:name/free-port", "/service/:name/kill-port"], async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.freePort(req.params.name);
    res.json(result);
  } catch (err) {
    sendOperationError(res, err);
  }
});

// Port: Direct port kill
app.post("/port/:port/kill", async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const result = await killProcessOnPort(port, { force: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Port: Get process occupying port for service
app.get("/service/:name/port-process", async (req, res) => {
  try {
    const freshConfig = loadConfig();
    const svc = freshConfig.services[req.params.name];
    if (!svc || !svc.port) {
      return res.status(404).json({ error: "Service has no port" });
    }
    const proc = await getPortProcess(svc.port, true);
    res.json(proc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run configuration: per-machine extra parameters (env vars, JVM args, program args), not committed
app.get("/run-config", (req, res) => {
  try {
    res.json(runConfig.read());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/run-config", (req, res) => {
  try {
    res.json(runConfig.write(req.body || {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs: retention settings in effect and size of stored previous runs
app.get("/log-archive/stats", (req, res) => {
  try {
    res.json({ settings: logger.getLogSettings(), ...logger.getArchiveStats() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs: permanently delete all previous runs (current runs are kept)
app.post("/log-archive/clear", (req, res) => {
  try {
    const deleted = logger.clearArchives();
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs: list files
app.get("/logs/:name", (req, res) => {
  try {
    const data = logger.getLogFiles(req.params.name);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs: get content
app.get("/logs/:name/:file", async (req, res) => {
  try {
    const startLine = Number(req.query.startLine) || undefined;
    const count = Number(req.query.count) || undefined;
    const data = await logger.getLog(req.params.name, req.params.file, { startLine, count });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs: search within file
app.get("/logs/:name/:file/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const limit = Number(req.query.limit || 100);
    const data = await logger.searchLog(req.params.name, req.params.file, query, limit, {
      caseSensitive: req.query.case === "true",
      regex: req.query.regex === "true",
    });
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Logs: entry counts per level for the whole file
app.get("/logs/:name/:file/levels", async (req, res) => {
  try {
    res.json(await logger.getLevelSummary(req.params.name, req.params.file));
  } catch (err) {
    res.status(err.code === "ENOENT" ? 404 : err.statusCode || 500).json({ error: err.message });
  }
});

// Logs: next/previous entry at a level (?level=error|warn&from=<line>&direction=next|previous)
app.get("/logs/:name/:file/levels/find", async (req, res) => {
  try {
    const fromLine = Number(req.query.from) || 0;
    const direction = req.query.direction === "previous" ? "previous" : "next";
    res.json(await logger.findLevelEntry(req.params.name, req.params.file, String(req.query.level || "error"), fromLine, direction));
  } catch (err) {
    res.status(err.code === "ENOENT" ? 404 : err.statusCode || 500).json({ error: err.message });
  }
});

// Logs: download the whole log file
app.get("/logs/:name/:file/download", (req, res) => {
  const { name, file } = req.params;
  if (path.basename(file) !== file || !file.endsWith(".log") || name.includes("..") || name.includes("/")) {
    return res.status(400).json({ error: "Invalid log file" });
  }
  const logPath = logger.getLogPath(name, file);
  if (!fs.existsSync(logPath)) {
    return res.status(404).json({ error: "Log file not found" });
  }
  res.download(logPath, file);
});

// Logs: stream content via Server-Sent Events
app.get("/logs/:name/:file/stream", async (req, res) => {
  const serviceName = req.params.name;
  const fileName = req.params.file;
  let closed = false;
  let lastSize = 0;
  let checking = false;
  let watchInterval = null;
  let heartbeatInterval = null;

  const send = (payload) => {
    if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const cleanup = () => {
    closed = true;
    clearInterval(watchInterval);
    clearInterval(heartbeatInterval);
  };
  req.on("close", cleanup);
  req.on("aborted", cleanup);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control"
  });

  const logPath = logger.getLogPath(serviceName, fileName);

  // Whole-file level counts follow the stream, so the UI never waits for a poll.
  const sendLevels = async () => {
    try {
      send({ type: "levels", ...(await logger.levelSummary(logPath)) });
    } catch {
      // Counts are optional; the file may not exist yet
    }
  };

  // Sends the newest part of the file (bounded size) and remembers how much was read.
  const sendTail = async (type) => {
    try {
      const tail = await logger.readLogTail(logPath);
      lastSize = tail.size;
      send({ type, content: tail.content, lineOffset: tail.lineOffset, truncated: tail.truncated });
      await sendLevels();
    } catch (error) {
      lastSize = 0;
      send({ type, content: error.code === "ENOENT" ? "" : `Error loading log: ${error.message}`, lineOffset: 0 });
    }
  };

  await sendTail("initial");
  if (closed) return;

  // Poll size with async stat; skip a tick if the previous read is still running.
  watchInterval = setInterval(async () => {
    if (checking || closed) return;
    checking = true;
    try {
      const { size } = await fsp.stat(logPath);
      if (size < lastSize || size - lastSize > logger.MAX_LOG_RESPONSE_BYTES) {
        // Truncated (cleared), or too much new output to append: resend the newest part.
        await sendTail("replace");
      } else if (size > lastSize) {
        const handle = await fsp.open(logPath, "r");
        try {
          const length = size - lastSize;
          const buffer = Buffer.alloc(length);
          const { bytesRead } = await handle.read(buffer, 0, length, lastSize);
          const end = completeUtf8Length(buffer, bytesRead);
          if (end > 0) {
            send({ type: "append", content: buffer.toString("utf8", 0, end) });
            lastSize += end;
            await sendLevels();
          }
        } finally {
          await handle.close();
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") console.error("Error watching log file:", error);
    } finally {
      checking = false;
    }
  }, 1000);

  // Send heartbeat every 30 seconds to keep connection alive
  heartbeatInterval = setInterval(() => send({ type: "heartbeat" }), 30000);
});

// Combined live log of several services (?names=a,b&lines=300). Off unless config.logs.combinedView is true.
app.get("/combined-logs/stream", (req, res) => {
  const freshConfig = loadConfig();
  if (freshConfig.config?.logs?.combinedView !== true) {
    return res.status(404).json({ error: "The combined log view is turned off (Admin › Logs)" });
  }
  const names = String(req.query.names || "")
    .split(",")
    .map((name) => name.trim())
    .filter((name, index, all) => name && freshConfig.services?.[name] && all.indexOf(name) === index)
    .slice(0, 50);
  if (!names.length) return res.status(400).json({ error: "No known services given" });
  streamCombinedLogs(req, res, names, { lines: req.query.lines });
});

// Logs: clear log file
app.post("/logs/:name/:file/clear", (req, res) => {
  try {
    logger.clearLog(req.params.name, req.params.file);
    res.json({ message: "Log cleared successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Service Manager backend running on http://localhost:${PORT}`);
});
