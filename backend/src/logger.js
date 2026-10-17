const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const readline = require("readline");

const LOG_ROOT = path.join(__dirname, "..", "logs");
const { resolveConfigPath } = require("./configResolver");

// Defaults when config.logs is not set (env vars can still override).
const DEFAULT_LOG_SETTINGS = {
  previousRuns: "archive", // "archive": keep earlier runs within the limits below; "delete": remove them when a new run starts
  retentionDays: Number(process.env.LOG_RETENTION_DAYS || 3),
  maxRuns: Number(process.env.LOG_MAX_ARCHIVED_RUNS || 20),
};

// Largest slice of a log sent to the UI at once; bigger files are sent as their newest part.
const MAX_LOG_RESPONSE_BYTES = Number(process.env.LOG_MAX_RESPONSE_BYTES || 2 * 1024 * 1024);
const COUNT_CHUNK_BYTES = 1024 * 1024;

async function countNewlines(handle, endByte) {
  const buffer = Buffer.alloc(COUNT_CHUNK_BYTES);
  let count = 0;
  let position = 0;
  while (position < endByte) {
    const { bytesRead } = await handle.read(buffer, 0, Math.min(COUNT_CHUNK_BYTES, endByte - position), position);
    if (bytesRead === 0) break;
    let index = buffer.indexOf(10);
    while (index !== -1 && index < bytesRead) {
      count += 1;
      index = buffer.indexOf(10, index + 1);
    }
    position += bytesRead;
  }
  return count;
}

// Reads at most maxBytes from the end of a file, starting on a line boundary.
// Returns the text, its size in bytes on disk, and how many lines were skipped before it.
async function readLogTail(filePath, maxBytes = MAX_LOG_RESPONSE_BYTES) {
  const handle = await fsp.open(filePath, "r");
  try {
    const { size } = await handle.stat();
    if (size <= maxBytes) {
      const buffer = Buffer.alloc(size);
      const { bytesRead } = await handle.read(buffer, 0, size, 0);
      return { content: buffer.toString("utf8", 0, bytesRead), size: bytesRead, lineOffset: 0, truncated: false };
    }
    const start = size - maxBytes;
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, start);
    const firstNewline = buffer.indexOf(10);
    const cut = firstNewline === -1 || firstNewline >= bytesRead ? 0 : firstNewline + 1;
    const lineOffset = (await countNewlines(handle, start)) + (cut > 0 ? 1 : 0);
    return {
      content: buffer.toString("utf8", cut, bytesRead),
      size: start + bytesRead,
      lineOffset,
      truncated: true,
    };
  } finally {
    await handle.close();
  }
}

// Reads config.logs from the active services config on each call, so Admin changes apply without a restart.
function getLogSettings() {
  let configured = {};
  try {
    const raw = JSON.parse(fs.readFileSync(resolveConfigPath(), "utf8"));
    configured = raw?.config?.logs || {};
  } catch {
    // Fall back to defaults if the config can't be read
  }
  const retentionDays = Number(configured.retentionDays);
  const maxRuns = Number(configured.maxRuns);
  return {
    previousRuns: configured.previousRuns === "delete" ? "delete" : DEFAULT_LOG_SETTINGS.previousRuns,
    retentionDays: retentionDays > 0 ? retentionDays : DEFAULT_LOG_SETTINGS.retentionDays,
    maxRuns: maxRuns > 0 ? maxRuns : DEFAULT_LOG_SETTINGS.maxRuns,
  };
}
const ARCHIVE_DIR_NAME = "archive";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const pad = (value) => String(value).padStart(2, "0");

// One log file per run: <service>_YYYY-MM-DD_HH-MM-SS.log (local time). Names sort chronologically.
function getRunLogFileName(service, date = new Date()) {
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${service}_${stamp}.log`;
}

function getServiceDir(service) {
  return path.join(LOG_ROOT, service);
}

function getArchiveDir(service) {
  return path.join(getServiceDir(service), ARCHIVE_DIR_NAME);
}

function ensureServiceDirs(service) {
  const dir = getServiceDir(service);
  const archiveDir = getArchiveDir(service);
  ensureDir(dir);
  ensureDir(archiveDir);
  return { dir, archiveDir };
}

// Keeps only the newest (current run) log in the active folder; older runs are archived,
// or deleted outright when config.logs.previousRuns is "delete".
function archiveOldActiveLogs(service, keepFileName = null, settings = getLogSettings()) {
  const { dir, archiveDir } = ensureServiceDirs(service);
  const activeFiles = fs.readdirSync(dir).filter((fileName) => fileName.endsWith(".log")).sort();
  const currentFileName = keepFileName || activeFiles[activeFiles.length - 1];

  activeFiles
    .filter((fileName) => fileName !== currentFileName)
    .forEach((fileName) => {
      const sourcePath = path.join(dir, fileName);
      const targetPath = path.join(archiveDir, fileName);
      try {
        if (settings.previousRuns === "delete") {
          fs.unlinkSync(sourcePath);
          return;
        }
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        fs.renameSync(sourcePath, targetPath);
      } catch (error) {
        console.error(`Failed to archive log file ${sourcePath}:`, error.message);
      }
    });
}

function cleanupOldLogs(service, settings = getLogSettings()) {
  const archiveDir = getArchiveDir(service);
  if (!fs.existsSync(archiveDir)) {
    return;
  }

  // In "delete" mode nothing is kept in the archive.
  const keepCount = settings.previousRuns === "delete" ? 0 : settings.maxRuns;
  const cutoffTime = Date.now() - (settings.retentionDays * 24 * 60 * 60 * 1000);
  // Newest first; anything older than the retention window or beyond the run cap is removed.
  const archived = fs.readdirSync(archiveDir)
    .filter((fileName) => fileName.endsWith(".log"))
    .sort()
    .reverse();

  archived.forEach((fileName, index) => {
    const filePath = path.join(archiveDir, fileName);
    try {
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < cutoffTime || index >= keepCount) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to prune log file ${filePath}:`, error.message);
    }
  });
}

module.exports = {
  // Called on every start/restart: creates a new log file for this run and archives the previous run.
  createLogFile(service) {
    const { dir, archiveDir } = ensureServiceDirs(service);
    const startedAt = new Date();

    let fileName = getRunLogFileName(service, startedAt);
    let suffix = 2;
    while (fs.existsSync(path.join(dir, fileName)) || fs.existsSync(path.join(archiveDir, fileName))) {
      fileName = getRunLogFileName(service, startedAt).replace(/\.log$/, `_${suffix}.log`);
      suffix += 1;
    }

    const file = path.join(dir, fileName);
    fs.writeFileSync(file, `[RUN STARTED] ${startedAt.toString()}\n`);
    const settings = getLogSettings();
    archiveOldActiveLogs(service, fileName, settings);
    cleanupOldLogs(service, settings);
    return file;
  },

  getLogSettings,

  // Totals for previous runs (archive folders) across all services.
  getArchiveStats() {
    const stats = { services: 0, files: 0, bytes: 0 };
    if (!fs.existsSync(LOG_ROOT)) return stats;
    fs.readdirSync(LOG_ROOT).forEach((service) => {
      const archiveDir = getArchiveDir(service);
      if (!fs.existsSync(archiveDir)) return;
      const files = fs.readdirSync(archiveDir).filter((fileName) => fileName.endsWith(".log"));
      if (files.length) stats.services += 1;
      files.forEach((fileName) => {
        try {
          stats.bytes += fs.statSync(path.join(archiveDir, fileName)).size;
          stats.files += 1;
        } catch {
          // ignore files removed meanwhile
        }
      });
    });
    return stats;
  },

  // Permanently deletes every previous run (archive folders) for all services. Current runs are kept.
  clearArchives() {
    const before = this.getArchiveStats();
    if (!fs.existsSync(LOG_ROOT)) return before;
    fs.readdirSync(LOG_ROOT).forEach((service) => {
      const archiveDir = getArchiveDir(service);
      if (!fs.existsSync(archiveDir)) return;
      fs.readdirSync(archiveDir)
        .filter((fileName) => fileName.endsWith(".log"))
        .forEach((fileName) => {
          try {
            fs.unlinkSync(path.join(archiveDir, fileName));
          } catch (error) {
            console.error(`Failed to delete archived log ${fileName}:`, error.message);
          }
        });
    });
    return before;
  },

  getLogFiles(service) {
    const { dir, archiveDir } = ensureServiceDirs(service);
    archiveOldActiveLogs(service);
    cleanupOldLogs(service);
    if (!fs.existsSync(dir)) {
      return { files: [], archivedFiles: [] };
    }
    const files = fs.readdirSync(dir).filter((fileName) => fileName.endsWith(".log"));
    const archivedFiles = fs.existsSync(archiveDir)
      ? fs.readdirSync(archiveDir).filter((fileName) => fileName.endsWith(".log"))
      : [];

    // Size and last write time per file, so the UI can show run duration and log size.
    const details = {};
    const addDetails = (folder, fileName) => {
      try {
        const stats = fs.statSync(path.join(folder, fileName));
        details[fileName] = { size: stats.size, modifiedAt: stats.mtimeMs };
      } catch {
        // File rotated away between listing and stat
      }
    };
    files.forEach((fileName) => addDetails(dir, fileName));
    archivedFiles.forEach((fileName) => addDetails(archiveDir, fileName));

    return { files, archivedFiles, details };
  },

  async getLog(service, file) {
    const activePath = path.join(getServiceDir(service), file);
    const archivePath = path.join(getArchiveDir(service), file);
    const filePath = fs.existsSync(activePath) ? activePath : archivePath;
    if (!fs.existsSync(filePath)) {
      return { content: "", size: 0, lineOffset: 0, truncated: false };
    }
    return readLogTail(filePath);
  },

  readLogTail,

  MAX_LOG_RESPONSE_BYTES,

  async searchLog(service, file, query, limit = 100) {
    const trimmedQuery = String(query || "").trim();
    if (!trimmedQuery) {
      return { query: "", totalMatches: 0, matches: [] };
    }

    const activePath = path.join(getServiceDir(service), file);
    const archivePath = path.join(getArchiveDir(service), file);
    const filePath = fs.existsSync(activePath) ? activePath : archivePath;
    if (!fs.existsSync(filePath)) {
      return { query: trimmedQuery, totalMatches: 0, matches: [] };
    }

    const needle = trimmedQuery.toLowerCase();
    const matches = [];
    let totalMatches = 0;
    let lineNumber = 0;

    // Stream line by line so large logs are never held in memory at once.
    const lines = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      lineNumber += 1;
      if (line.toLowerCase().includes(needle)) {
        totalMatches += 1;
        if (matches.length < limit) {
          matches.push({
            lineNumber,
            preview: line,
          });
        }
      }
    }

    return {
      query: trimmedQuery,
      totalMatches,
      matches,
    };
  },

  getLogPath(service, file) {
    const activePath = path.join(getServiceDir(service), file);
    if (fs.existsSync(activePath)) {
      return activePath;
    }
    return path.join(getArchiveDir(service), file);
  },

  clearLog(service, file) {
    const filePath = this.getLogPath(service, file);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "");
    }
  }
};
