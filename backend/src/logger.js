const fs = require("fs");
const path = require("path");

const LOG_ROOT = path.join(__dirname, "..", "logs");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  createLogFile(service) {
    const dir = path.join(LOG_ROOT, service);
    ensureDir(dir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `${service}-${timestamp}.log`);
    fs.writeFileSync(file, "");
    return file;
  },

  getLogFiles(service) {
    const dir = path.join(LOG_ROOT, service);
    if (!fs.existsSync(dir)) {
      return { files: [] };
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".log"));
    return { files };
  },

  getLog(service, file) {
    const filePath = path.join(LOG_ROOT, service, file);
    if (!fs.existsSync(filePath)) {
      return { content: "" };
    }
    const content = fs.readFileSync(filePath, "utf8");
    return { content };
  }
};
