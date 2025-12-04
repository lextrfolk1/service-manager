const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const ServiceManager = require("./serviceManager");
const logger = require("./logger");

const configPath = path.join(__dirname, "..", "config", "services.json");
function loadConfig() {
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

let config = loadConfig();
let services = config.services;
let manager = new ServiceManager(services);

const app = express();
app.use(cors());
app.use(express.json());

// Reload config helper
function reloadConfig() {
  config = loadConfig();
  services = config.services;
  manager = new ServiceManager(services);
}

// List all services
app.get("/services", (req, res) => {
  const list = Object.entries(services).map(([name, meta]) => ({
    name,
    type: meta.type,
    port: meta.port,
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

// Admin: overwrite full services config
app.put("/config/services", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || !body.services) {
    return res.status(400).json({ error: "Invalid config payload" });
  }
  fs.writeFileSync(configPath, JSON.stringify(body, null, 2), "utf8");
  reloadConfig();
  res.json({ message: "Config updated" });
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

app.get("/config/services", (req, res) => {
  try {
    const configPath = path.join(__dirname, "../config/services.json");
    const raw = fs.readFileSync(configPath, "utf-8");
    const json = JSON.parse(raw);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: "Failed to load services.json", details: err.message });
  }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Service Manager backend running on http://localhost:${PORT}`);
});
