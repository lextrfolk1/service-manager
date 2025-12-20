const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const ServiceManager = require("./serviceManager");
const logger = require("./logger");

const servicesConfigPath = path.join(__dirname, "..", "config", "services.json");

function loadConfig() {
  const raw = fs.readFileSync(servicesConfigPath, "utf8");
  return JSON.parse(raw);
}

let config = loadConfig();
let services = config.services;
let manager = new ServiceManager(config);

const app = express();
app.use(cors());
app.use(express.json());

// Reload config helper
function reloadConfig() {
  config = loadConfig();
  services = config.services;
  manager = new ServiceManager(config);
}

// List all services
app.get("/services", (req, res) => {
  const list = Object.entries(services).map(([name, meta]) => ({
    name,
    type: meta.type,
    port: meta.port,
    path: meta.path,
    description: meta.description || ""
  }));
  res.json({ services: list });
});

// Get single service metadata
app.get("/services/:name", (req, res) => {
  const svc = services[req.params.name];
  if (!svc) return res.status(404).json({ error: "Unknown service" });
  res.json({ name: req.params.name, ...svc });
});

// Get full configuration (config + services)
app.get("/config", (req, res) => {
  res.json(config);
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
  res.json({ basePaths: config.config.basePaths });
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

// Start service
app.post("/service/:name/start", async (req, res) => {
  try {
    const result = await manager.start(req.params.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop service
app.post("/service/:name/stop", async (req, res) => {
  try {
    const result = await manager.stop(req.params.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restart service
app.post("/service/:name/restart", async (req, res) => {
  try {
    const result = await manager.restart(req.params.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Status
app.get("/service/:name/status", async (req, res) => {
  try {
    const result = await manager.status(req.params.name);
    res.json(result);
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
app.get("/logs/:name/:file", (req, res) => {
  try {
    const data = logger.getLog(req.params.name, req.params.file);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Service Manager backend running on http://localhost:${PORT}`);
});
