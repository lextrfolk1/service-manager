const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const ServiceManager = require("./serviceManager");
const logger = require("./logger");

const servicesConfigPath = path.join(__dirname, "..", "config", "services.json");

function loadConfig() {
  console.log('Loading config from:', servicesConfigPath);
  const raw = fs.readFileSync(servicesConfigPath, "utf8");
  const parsed = JSON.parse(raw);
  console.log('Config loaded, services found:', Object.keys(parsed.services || {}));
  return parsed;
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
  try {
    // Always use fresh config to catch manual edits
    const freshConfig = loadConfig();
    const freshServices = freshConfig.services;
    
    console.log('Services endpoint called, found services:', Object.keys(freshServices));
    
    const list = Object.entries(freshServices).map(([name, meta]) => ({
      name,
      type: meta.type,
      port: meta.port,
      path: meta.path,
      description: meta.description || ""
    }));
    
    console.log('Returning services list:', list.map(s => s.name));
    res.json({ services: list });
  } catch (error) {
    console.error('Error in /services endpoint:', error);
    res.status(500).json({ error: `Failed to load services: ${error.message}` });
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
    console.log('Config loaded successfully, keys:', Object.keys(freshConfig));
    res.json(freshConfig);
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
    res.status(500).json({ error: err.message });
  }
});

// Stop service
app.post("/service/:name/stop", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.stop(req.params.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restart service
app.post("/service/:name/restart", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.restart(req.params.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Status
app.get("/service/:name/status", async (req, res) => {
  try {
    const freshManager = getFreshManager();
    const result = await freshManager.status(req.params.name);
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

// Logs: stream content via Server-Sent Events
app.get("/logs/:name/:file/stream", (req, res) => {
  try {
    const serviceName = req.params.name;
    const fileName = req.params.file;
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial log content
    try {
      const initialData = logger.getLog(serviceName, fileName);
      res.write(`data: ${JSON.stringify({ type: 'initial', content: initialData.content })}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'initial', content: `Error loading log: ${error.message}` })}\n\n`);
    }

    // Set up file watching
    const logPath = logger.getLogPath(serviceName, fileName);
    let lastSize = 0;
    
    if (fs.existsSync(logPath)) {
      lastSize = fs.statSync(logPath).size;
    }

    const watchInterval = setInterval(() => {
      try {
        if (fs.existsSync(logPath)) {
          const stats = fs.statSync(logPath);
          if (stats.size > lastSize) {
            // Read only the new content
            const stream = fs.createReadStream(logPath, { start: lastSize });
            let newContent = '';
            
            stream.on('data', (chunk) => {
              newContent += chunk.toString();
            });
            
            stream.on('end', () => {
              if (newContent) {
                res.write(`data: ${JSON.stringify({ type: 'append', content: newContent })}\n\n`);
              }
              lastSize = stats.size;
            });

            stream.on('error', (error) => {
              console.error('Error reading log stream:', error);
            });
          } else if (stats.size < lastSize) {
            // File was truncated (cleared)
            try {
              const fullContent = fs.readFileSync(logPath, 'utf8');
              res.write(`data: ${JSON.stringify({ type: 'replace', content: fullContent })}\n\n`);
              lastSize = stats.size;
            } catch (readError) {
              console.error('Error reading cleared log file:', readError);
              res.write(`data: ${JSON.stringify({ type: 'replace', content: '' })}\n\n`);
              lastSize = 0;
            }
          }
        }
      } catch (error) {
        console.error('Error watching log file:', error);
      }
    }, 1000); // Check every second

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 30000);

    // Clean up on client disconnect
    const cleanup = () => {
      clearInterval(watchInterval);
      clearInterval(heartbeatInterval);
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
