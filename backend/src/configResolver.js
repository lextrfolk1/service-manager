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
};
