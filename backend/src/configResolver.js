const fs = require("fs");
const path = require("path");

const CONFIG_DIR = path.join(__dirname, "..", "config");

function getPlatformConfigCandidates() {
  const override = process.env.STRUO_CONFIG_FILE;
  if (override) {
    return [path.isAbsolute(override) ? override : path.join(process.cwd(), override)];
  }

  const candidates = [];

  if (process.platform === "win32") {
    candidates.push(path.join(CONFIG_DIR, "services.windows.json"));
  } else if (process.platform === "darwin") {
    candidates.push(path.join(CONFIG_DIR, "services.macos.json"));
  } else if (process.platform === "linux") {
    candidates.push(path.join(CONFIG_DIR, "services.linux.json"));
  }

  candidates.push(path.join(CONFIG_DIR, "services.json"));
  return candidates;
}

function resolveConfigPath() {
  const candidates = getPlatformConfigCandidates();
  const resolvedPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!resolvedPath) {
    throw new Error(`No configuration file found. Checked: ${candidates.join(", ")}`);
  }

  return resolvedPath;
}

// Parsed config is reused until the file changes on disk, so manual edits are still picked up
// without re-reading and re-parsing it on every request. Callers must not modify the returned object.
let configCache = null; // { path, mtimeMs, size, parsed }

function invalidateConfigCache() {
  configCache = null;
}

function readConfig() {
  const configPath = resolveConfigPath();
  const stats = fs.statSync(configPath);
  if (
    configCache &&
    configCache.path === configPath &&
    configCache.mtimeMs === stats.mtimeMs &&
    configCache.size === stats.size
  ) {
    return configCache.parsed;
  }
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  console.log("Config loaded from", configPath, "- services:", Object.keys(parsed.services || {}).length);
  configCache = { path: configPath, mtimeMs: stats.mtimeMs, size: stats.size, parsed };
  return parsed;
}

function getConfigMetadata() {
  const configPath = resolveConfigPath();
  return {
    configPath,
    configFile: path.basename(configPath),
    platform: process.platform,
    overrideActive: Boolean(process.env.STRUO_CONFIG_FILE),
  };
}

module.exports = {
  resolveConfigPath,
  getConfigMetadata,
  readConfig,
  invalidateConfigCache,
};
