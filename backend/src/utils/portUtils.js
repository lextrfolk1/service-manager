const net = require("net");
const { exec } = require("child_process");

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      const open = await isPortOpen(port);
      if (open) return resolve(true);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout waiting for port ${port}`));
      }
      setTimeout(check, 1000);
    };
    check();
  });
}

let listeningCache = null;
let listeningCacheTime = 0;
const CACHE_TTL_MS = 2000;

function invalidatePortCache() {
  listeningCache = null;
  listeningCacheTime = 0;
}

function parseListeningPortsUnix(stdout) {
  const lines = stdout.split("\n");
  let currentPid = null;
  let currentCmd = null;
  let currentUser = null;
  const map = {};

  for (const line of lines) {
    if (!line) continue;
    const tag = line[0];
    const val = line.slice(1);
    if (tag === "p") {
      currentPid = parseInt(val, 10);
    } else if (tag === "c") {
      currentCmd = val;
    } else if (tag === "L") {
      currentUser = val;
    } else if (tag === "n") {
      const match = val.match(/:(\d+)$/);
      if (match) {
        const port = parseInt(match[1], 10);
        map[port] = {
          port,
          pid: currentPid,
          command: currentCmd,
          user: currentUser,
          inUse: true,
        };
      }
    }
  }
  return map;
}

function getAllListeningPorts(forceFresh = false) {
  return new Promise((resolve) => {
    const now = Date.now();
    if (!forceFresh && listeningCache && now - listeningCacheTime < CACHE_TTL_MS) {
      return resolve(listeningCache);
    }

    const isWindows = process.platform === "win32";
    if (isWindows) {
      exec("netstat -ano -p tcp", (err, stdout) => {
        if (err || !stdout) {
          listeningCache = {};
          listeningCacheTime = now;
          return resolve({});
        }
        const map = {};
        const lines = stdout.split("\n");
        for (const line of lines) {
          if (!line.includes("LISTENING")) continue;
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const addr = parts[1];
            const pid = parseInt(parts[4], 10);
            const portMatch = addr.match(/:(\d+)$/);
            if (portMatch && pid) {
              const port = parseInt(portMatch[1], 10);
              map[port] = { port, pid, command: "unknown", inUse: true };
            }
          }
        }
        listeningCache = map;
        listeningCacheTime = now;
        resolve(map);
      });
    } else {
      exec("lsof -nP -iTCP -sTCP:LISTEN -F pcfLn", { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (err && !stdout) {
          listeningCache = {};
          listeningCacheTime = now;
          return resolve({});
        }
        const map = parseListeningPortsUnix(stdout || "");
        listeningCache = map;
        listeningCacheTime = now;
        resolve(map);
      });
    }
  });
}

async function getPortProcess(port, forceFresh = false) {
  if (!port) return { inUse: false, port: null, pid: null, command: null };
  const all = await getAllListeningPorts(forceFresh);
  const numericPort = parseInt(port, 10);
  if (all[numericPort]) {
    return all[numericPort];
  }
  return { inUse: false, port: numericPort, pid: null, command: null };
}

async function killProcessOnPort(port, { force = true } = {}) {
  const numericPort = parseInt(port, 10);
  if (!numericPort) {
    return { success: false, error: "Valid port number is required" };
  }

  invalidatePortCache();
  const proc = await getPortProcess(numericPort, true);

  if (!proc || !proc.inUse || !proc.pid) {
    return {
      success: true,
      port: numericPort,
      freed: false,
      message: `Port ${numericPort} is not currently in use`,
    };
  }

  const pid = proc.pid;

  // Protect system processes and this server
  if (pid <= 1 || pid === process.pid || pid === process.ppid) {
    return {
      success: false,
      port: numericPort,
      pid,
      error: `Cannot kill protected system process (PID ${pid})`,
    };
  }

  const isWindows = process.platform === "win32";

  return new Promise((resolve) => {
    if (isWindows) {
      exec(`taskkill /F /PID ${pid} /T`, (err) => {
        invalidatePortCache();
        if (err) {
          return resolve({
            success: false,
            port: numericPort,
            pid,
            command: proc.command,
            error: `Failed to terminate PID ${pid}: ${err.message}`,
          });
        }
        resolve({
          success: true,
          port: numericPort,
          freed: true,
          killedPid: pid,
          command: proc.command,
          message: `Successfully terminated PID ${pid}${proc.command ? ` (${proc.command})` : ""} and freed port ${numericPort}`,
        });
      });
    } else {
      // First attempt SIGTERM for graceful shutdown
      try {
        process.kill(pid, "SIGTERM");
      } catch (e) {
        // Ignored
      }

      setTimeout(() => {
        // Enforce termination with kill -9
        exec(`kill -9 ${pid}`, () => {
          setTimeout(async () => {
            invalidatePortCache();
            const stillOpen = await isPortOpen(numericPort);
            if (!stillOpen) {
              resolve({
                success: true,
                port: numericPort,
                freed: true,
                killedPid: pid,
                command: proc.command,
                message: `Successfully terminated PID ${pid}${proc.command ? ` (${proc.command})` : ""} and freed port ${numericPort}`,
              });
            } else {
              const currentProc = await getPortProcess(numericPort, true);
              if (!currentProc.inUse) {
                resolve({
                  success: true,
                  port: numericPort,
                  freed: true,
                  killedPid: pid,
                  command: proc.command,
                  message: `Port ${numericPort} freed`,
                });
              } else {
                resolve({
                  success: false,
                  port: numericPort,
                  pid: currentProc.pid,
                  command: currentProc.command,
                  error: `Could not terminate PID ${pid}. Process may require elevated permissions.`,
                });
              }
            }
          }, 200);
        });
      }, 250);
    }
  });
}

function killByPort(port) {
  return killProcessOnPort(port, { force: true });
}

module.exports = {
  isPortOpen,
  waitForPort,
  getAllListeningPorts,
  getPortProcess,
  killProcessOnPort,
  killByPort,
  invalidatePortCache,
};
