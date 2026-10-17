const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { StringDecoder } = require("string_decoder");
const crypto = require("crypto");

const LOG_ROOT = path.join(__dirname, "..", "logs");
const { readConfig } = require("./configResolver");

// Defaults when config.logs is not set (env vars can still override).
const DEFAULT_LOG_SETTINGS = {
  previousRuns: "archive", // "archive": keep earlier runs within the limits below; "delete": remove them when a new run starts
  retentionDays: Number(process.env.LOG_RETENTION_DAYS || 3),
  maxRuns: Number(process.env.LOG_MAX_ARCHIVED_RUNS || 20),
};

// Largest slice of a log sent to the UI at once; bigger files are sent as their newest part.
const MAX_LOG_RESPONSE_BYTES = Number(process.env.LOG_MAX_RESPONSE_BYTES || 8 * 1024 * 1024);
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

const ANSI_ESCAPES = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g; // eslint-disable-line no-control-regex

// Text as the log viewer shows it (keep in sync with plainText in react-frontend/src/components/logViewer/logLines.js):
// ANSI codes removed and, for progress output rewritten with "\r", only the last version kept.
function plainLine(rawLine) {
  let text = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  if (text.includes("\r")) {
    const parts = text.split("\r").filter(Boolean);
    text = parts.length ? parts[parts.length - 1] : "";
  }
  return text.includes("\x1b") ? text.replace(ANSI_ESCAPES, "") : text;
}

// Level named on a line (keep in sync with detectLevel in react-frontend/src/components/logViewer/logLines.js).
const LEVEL_KEY_VALUE = /\blevel["']?\s*[=:]\s*["']?(fatal|error|err|warn(?:ing)?|info|debug|trace)\b/i;
const LEVEL_WORD = /\b(FATAL|SEVERE|ERROR|ERR|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/;
const LEVEL_ALIASES = { fatal: "error", severe: "error", error: "error", err: "error", warn: "warn", warning: "warn", info: "info", debug: "debug", trace: "debug" };

// Node / npm / Vite / webpack output has no level word, so it is recognised by its usual messages.
const TOOL_LEVELS = [
  ["error", /^\s*(?:Uncaught\s+)?(?:[A-Z]\w*)?Error(?:\s*\[\w+\])?:|Internal server error|Pre-transform error|Failed to (?:compile|resolve|load)|error while updating|Module not found/],
  ["warn", /^\s*(?:\(node:\d+\)\s+)?(?:\[\w+\]\s+)?(?:[A-Z]\w*)?Warning:|Could not Fast Refresh|Compiled with warnings/],
  // Also Struo's "[GIT PULL STDOUT]" headers, npm's "> name@1.0.0 dev" / "> vite" and dev-server "➜  Local:" lines.
  ["info", /\[vite\]|\bVITE v\d|[Cc]ompiled successfully|^\[[A-Z][A-Z ]+\]$|^> \S|^\s*➜/],
];

function detectLevel(text) {
  const head = text.length > 300 ? text.slice(0, 300) : text;
  const match = LEVEL_KEY_VALUE.exec(head) || LEVEL_WORD.exec(head);
  if (match) return LEVEL_ALIASES[match[1].toLowerCase()] || null;
  const tool = TOOL_LEVELS.find(([, pattern]) => pattern.test(head));
  return tool ? tool[0] : null;
}

// Per-file level index: entry counts per level and the line numbers of error/warning entries, so the UI can
// show whole-file totals and jump between errors beyond the loaded lines. Built incrementally: a growing log
// only scans the bytes added since the last call. Only complete lines (ending in "\n") are indexed; the line
// still being written is counted on the fly by levelSummary.
//
// Indexes are also saved under logs/.index, so a backend restart reuses them. A saved index is used only if
// the file is the same (inode), not shorter, and sampled bytes of the indexed part are unchanged.
const MAX_INDEXED_FILES = 50;
const MAX_INDEXED_ENTRIES = 200000; // per level; further entries are counted but not listed
const INDEX_DIR = path.join(LOG_ROOT, ".index");
const INDEX_FORMAT = 3;
const MAX_SAVED_INDEXES = 200;
const FINGERPRINT_BYTES = 256;
const SAVE_DELAY_MS = 3000;
const MAX_PENDING_LINE_BYTES = 64 * 1024;
const logIndexes = new Map(); // filePath -> index
const indexQueues = new Map(); // filePath -> promise; updates of one file run one at a time
const saveTimers = new Map();

function emptyIndex(ino) {
  return {
    ino,
    bytes: 0,
    pendingBytes: 0, // bytes after the last "\n" (line still being written)
    lineCount: 0,
    lastLevel: "other",
    counts: { error: 0, warn: 0, info: 0, debug: 0, other: 0 },
    entries: { error: [], warn: [] },
  };
}

function indexFilePath(filePath) {
  return path.join(INDEX_DIR, `${crypto.createHash("sha1").update(filePath).digest("hex")}.json`);
}

// Hash of small samples spread over [0, endByte): the start, the end and evenly spaced points between.
// Cheap check that the indexed part of the file is still the same content.
async function fingerprint(filePath, endByte) {
  const samples = 10;
  const hash = crypto.createHash("sha1");
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(FINGERPRINT_BYTES);
    for (let sample = 0; sample < samples; sample += 1) {
      const start = Math.max(0, Math.floor(((endByte - FINGERPRINT_BYTES) * sample) / (samples - 1)));
      const length = Math.min(FINGERPRINT_BYTES, endByte - start);
      if (length <= 0) break;
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      hash.update(buffer.subarray(0, bytesRead));
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

async function loadSavedIndex(filePath, stats) {
  try {
    const saved = JSON.parse(await fsp.readFile(indexFilePath(filePath), "utf8"));
    if (saved.format !== INDEX_FORMAT || saved.filePath !== filePath || saved.ino !== stats.ino || saved.bytes > stats.size) {
      return null;
    }
    if (saved.fingerprint !== (await fingerprint(filePath, saved.bytes))) return null;
    return {
      ...emptyIndex(saved.ino),
      bytes: saved.bytes,
      lineCount: saved.lineCount,
      lastLevel: saved.lastLevel,
      counts: saved.counts,
      entries: saved.entries,
    };
  } catch {
    return null; // missing or unreadable: rebuild
  }
}

async function pruneSavedIndexes() {
  const names = (await fsp.readdir(INDEX_DIR)).filter((name) => name.endsWith(".json"));
  if (names.length <= MAX_SAVED_INDEXES) return;
  const withTimes = await Promise.all(names.map(async (name) => {
    try {
      return { name, mtimeMs: (await fsp.stat(path.join(INDEX_DIR, name))).mtimeMs };
    } catch {
      return { name, mtimeMs: 0 };
    }
  }));
  withTimes.sort((left, right) => left.mtimeMs - right.mtimeMs);
  await Promise.all(withTimes.slice(0, names.length - MAX_SAVED_INDEXES).map(({ name }) =>
    fsp.unlink(path.join(INDEX_DIR, name)).catch(() => {})
  ));
}

// Saves a snapshot a few seconds after the last change (one write per burst of appends).
function saveIndexSoon(filePath, index) {
  if (saveTimers.has(filePath)) return;
  const timer = setTimeout(async () => {
    saveTimers.delete(filePath);
    const snapshot = {
      format: INDEX_FORMAT,
      filePath,
      ino: index.ino,
      bytes: index.bytes,
      lineCount: index.lineCount,
      lastLevel: index.lastLevel,
      counts: { ...index.counts },
      entries: { error: index.entries.error.slice(), warn: index.entries.warn.slice() },
    };
    try {
      snapshot.fingerprint = await fingerprint(filePath, snapshot.bytes);
      await fsp.mkdir(INDEX_DIR, { recursive: true });
      const target = indexFilePath(filePath);
      const temporary = `${target}.${process.pid}.tmp`;
      await fsp.writeFile(temporary, JSON.stringify(snapshot));
      await fsp.rename(temporary, target);
      await pruneSavedIndexes();
    } catch {
      // The index is only a cache; it is rebuilt when missing
    }
  }, SAVE_DELAY_MS);
  timer.unref?.();
  saveTimers.set(filePath, timer);
}

async function scanLogIndex(index, filePath, endByte) {
  const stream = fs.createReadStream(filePath, { start: index.bytes, end: endByte - 1 });
  let leftover = Buffer.alloc(0);
  try {
    for await (const chunk of stream) {
      const buffer = leftover.length ? Buffer.concat([leftover, chunk]) : chunk;
      let lineStart = 0;
      let newline = buffer.indexOf(10);
      while (newline !== -1) {
        const text = plainLine(buffer.toString("utf8", lineStart, newline));
        const level = detectLevel(text);
        index.lineCount += 1;
        if (level) {
          index.lastLevel = level;
          index.counts[level] += 1;
          const list = index.entries[level];
          if (list && list.length < MAX_INDEXED_ENTRIES) list.push(index.lineCount);
        } else if (index.lastLevel === "other") {
          index.counts.other += 1;
        }
        index.bytes += newline + 1 - lineStart;
        lineStart = newline + 1;
        newline = buffer.indexOf(10, lineStart);
      }
      leftover = buffer.subarray(lineStart);
    }
  } finally {
    stream.destroy();
  }
  index.pendingBytes = endByte - index.bytes;
}

async function updateLogIndex(filePath) {
  const stats = await fsp.stat(filePath);
  let index = logIndexes.get(filePath);
  if (!index) {
    index = (await loadSavedIndex(filePath, stats)) || emptyIndex(stats.ino);
  } else if (stats.ino !== index.ino || stats.size < index.bytes) {
    index = emptyIndex(stats.ino); // replaced or truncated (cleared)
  }
  logIndexes.delete(filePath); // re-insert: most recently used last
  logIndexes.set(filePath, index);
  while (logIndexes.size > MAX_INDEXED_FILES) logIndexes.delete(logIndexes.keys().next().value);

  if (stats.size > index.bytes) {
    const before = index.bytes;
    await scanLogIndex(index, filePath, stats.size);
    if (index.bytes > before) saveIndexSoon(filePath, index);
  } else {
    index.pendingBytes = 0;
  }
  return index;
}

function getLogIndex(filePath) {
  const previous = indexQueues.get(filePath) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => updateLogIndex(filePath));
  indexQueues.set(filePath, next);
  next.catch(() => {}).finally(() => {
    if (indexQueues.get(filePath) === next) indexQueues.delete(filePath);
  });
  return next;
}

// Whole-file counts, including the line still being written (counted like the viewer does).
async function levelSummary(filePath) {
  const index = await getLogIndex(filePath);
  const counts = { ...index.counts };
  let lineCount = index.lineCount;
  if (index.pendingBytes > 0 && index.pendingBytes <= MAX_PENDING_LINE_BYTES) {
    try {
      const handle = await fsp.open(filePath, "r");
      try {
        const buffer = Buffer.alloc(index.pendingBytes);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, index.bytes);
        const text = plainLine(buffer.toString("utf8", 0, bytesRead));
        if (text) {
          const level = detectLevel(text);
          lineCount += 1;
          if (level) counts[level] += 1;
          else if (index.lastLevel === "other") counts.other += 1;
        }
      } finally {
        await handle.close();
      }
    } catch {
      // File changed underneath; the next call catches up
    }
  }
  return { lineCount, counts };
}

function firstAfter(list, value) {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (list[middle] > value) high = middle;
    else low = middle + 1;
  }
  return low;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Calls onLine(line, lineNumber) for each line, splitting on "\n" only so numbering matches the viewer
// (a lone "\r" from progress output does not start a new line). Return false from onLine to stop early.
async function forEachLine(filePath, onLine) {
  const stream = fs.createReadStream(filePath);
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let lineNumber = 0;
  try {
    for await (const chunk of stream) {
      pending += decoder.write(chunk);
      let lineStart = 0;
      let newline = pending.indexOf("\n");
      while (newline !== -1) {
        lineNumber += 1;
        if (onLine(pending.slice(lineStart, newline), lineNumber) === false) return;
        lineStart = newline + 1;
        newline = pending.indexOf("\n", lineStart);
      }
      pending = pending.slice(lineStart);
    }
    pending += decoder.end();
    if (pending) {
      lineNumber += 1;
      onLine(pending, lineNumber);
    }
  } finally {
    stream.destroy();
  }
}

// Lines startLine..startLine+count-1 (1-based), capped at maxBytes of text.
async function readLogLines(filePath, startLine, count, maxBytes = MAX_LOG_RESPONSE_BYTES) {
  const first = Math.max(1, Math.floor(startLine) || 1);
  const last = first + Math.max(1, Math.floor(count) || 1) - 1;
  const lines = [];
  let bytes = 0;
  await forEachLine(filePath, (line, lineNumber) => {
    if (lineNumber < first) return true;
    bytes += Buffer.byteLength(line) + 1;
    if (lineNumber > last || bytes > maxBytes) return false;
    lines.push(line);
    return true;
  });
  return {
    content: lines.length ? `${lines.join("\n")}\n` : "",
    lineOffset: first - 1,
    lineCount: lines.length,
    truncated: true,
  };
}

// Reads config.logs from the active services config (cached until the file changes), so Admin changes
// apply without a restart.
function getLogSettings() {
  let configured = {};
  try {
    configured = readConfig()?.config?.logs || {};
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

  // Newest part of the log, or with startLine, the lines from startLine onwards (count lines).
  async getLog(service, file, { startLine, count } = {}) {
    const activePath = path.join(getServiceDir(service), file);
    const archivePath = path.join(getArchiveDir(service), file);
    const filePath = fs.existsSync(activePath) ? activePath : archivePath;
    if (!fs.existsSync(filePath)) {
      return { content: "", size: 0, lineOffset: 0, truncated: false };
    }
    if (startLine) {
      return readLogLines(filePath, startLine, count || 2000);
    }
    return readLogTail(filePath);
  },

  readLogTail,

  async getLevelSummary(service, file) {
    return levelSummary(this.getLogPath(service, file));
  },

  levelSummary,

  // Line number of the next/previous entry at a level ("error" or "warn") after/before fromLine, or null.
  async findLevelEntry(service, file, level, fromLine, direction = "next") {
    const index = await getLogIndex(this.getLogPath(service, file));
    const list = index.entries[level];
    if (!list) {
      const invalid = new Error(`Unsupported level: ${level}`);
      invalid.statusCode = 400;
      throw invalid;
    }
    if (direction === "previous") {
      const position = firstAfter(list, fromLine - 1) - 1; // last entry < fromLine
      return { lineNumber: position >= 0 ? list[position] : null };
    }
    const position = firstAfter(list, fromLine); // first entry > fromLine
    return { lineNumber: position < list.length ? list[position] : null };
  },

  MAX_LOG_RESPONSE_BYTES,

  // Options: caseSensitive, regex. An invalid regular expression throws an error with statusCode 400.
  async searchLog(service, file, query, limit = 100, { caseSensitive = false, regex = false } = {}) {
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

    let pattern;
    try {
      pattern = new RegExp(regex ? trimmedQuery : escapeRegExp(trimmedQuery), caseSensitive ? "" : "i");
    } catch (error) {
      const invalid = new Error(error.message);
      invalid.statusCode = 400;
      throw invalid;
    }
    const matches = [];
    let totalMatches = 0;

    // Stream line by line so large logs are never held in memory at once.
    await forEachLine(filePath, (line, lineNumber) => {
      const text = plainLine(line);
      if (pattern.test(text)) {
        totalMatches += 1;
        if (matches.length < limit) {
          matches.push({
            lineNumber,
            preview: text.length > 500 ? `${text.slice(0, 500)}…` : text,
          });
        }
      }
    });

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
