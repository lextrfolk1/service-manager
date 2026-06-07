const fs = require("fs");
const path = require("path");

const LOG_ROOT = path.join(__dirname, "..", "logs");
const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS || 7);
const ARCHIVE_DIR_NAME = "archive";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDailyLogFileName(service, date = new Date()) {
  const dayStamp = date.toISOString().slice(0, 10);
  return `${service}-${dayStamp}.log`;
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

function archiveOldActiveLogs(service) {
  const { dir, archiveDir } = ensureServiceDirs(service);
  const currentFileName = getDailyLogFileName(service);

  fs.readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".log") && fileName !== currentFileName)
    .forEach((fileName) => {
      const sourcePath = path.join(dir, fileName);
      const targetPath = path.join(archiveDir, fileName);
      try {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        fs.renameSync(sourcePath, targetPath);
      } catch (error) {
        console.error(`Failed to archive log file ${sourcePath}:`, error.message);
      }
    });
}

function cleanupOldLogs(service) {
  const archiveDir = getArchiveDir(service);
  if (!fs.existsSync(archiveDir)) {
    return;
  }

  const cutoffTime = Date.now() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  fs.readdirSync(archiveDir)
    .filter((fileName) => fileName.endsWith(".log"))
    .forEach((fileName) => {
      const filePath = path.join(archiveDir, fileName);
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Failed to prune log file ${filePath}:`, error.message);
      }
    });
}

module.exports = {
  createLogFile(service) {
    const { dir } = ensureServiceDirs(service);
    archiveOldActiveLogs(service);
    cleanupOldLogs(service);

    const file = path.join(dir, getDailyLogFileName(service));
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, "");
    }
    return file;
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
    return { files, archivedFiles };
  },

  getLog(service, file) {
    const activePath = path.join(getServiceDir(service), file);
    const archivePath = path.join(getArchiveDir(service), file);
    const filePath = fs.existsSync(activePath) ? activePath : archivePath;
    if (!fs.existsSync(filePath)) {
      return { content: "" };
    }
    const content = fs.readFileSync(filePath, "utf8");
    return { content };
  },

  searchLog(service, file, query, limit = 100) {
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
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    const matches = [];
    let totalMatches = 0;

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) {
        totalMatches += 1;
        if (matches.length < limit) {
          matches.push({
            lineNumber: index + 1,
            preview: line,
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
