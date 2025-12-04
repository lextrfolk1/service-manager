const { spawn, exec } = require("child_process");
const fs = require("fs");
const logger = require("./logger");
const { killByPort, waitForPort, isPortOpen } = require("./utils/portUtils");

const os = require("os");
const path = require("path");

function resolveHome(p) {
  if (!p) return p;
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

class ServiceManager {
  constructor(services) {
    this.services = services;
    this.processes = {}; // name -> pid
  }

  _getService(name) {
    const svc = this.services[name];
    if (!svc) {
      throw new Error(`Unknown service: ${name}`);
    }
    return svc;
  }

  async start(name) {
    const svc = this._getService(name);

    if (!svc.command) {
      throw new Error(`Service ${name} has no command configured`);
    }

    const resolvedDir = resolveHome(svc.dir);

    const logFile = logger.createLogFile(name);
    const out = fs.openSync(logFile, "a");

    // Optional build step for Java
    if (svc.build) {
      await new Promise((resolve, reject) => {
        exec(
          svc.build,
          { cwd: resolvedDir, shell: true },
          (err, stdout, stderr) => {
            fs.appendFileSync(logFile, `\n[BUILD STDOUT]\n${stdout || ""}`);
            fs.appendFileSync(logFile, `\n[BUILD STDERR]\n${stderr || ""}`);
            if (err) {
              return reject(
                new Error(`Build failed for ${name}: ${err.message}`)
              );
            }
            resolve();
          }
        );
      });
    }

    // Ensure port is free before starting
    if (svc.port) {
      await killByPort(svc.port);
    }

    const spawnOptions = {
      shell: true,
      stdio: ["ignore", out, out]
    };

    if (svc.dir) {
      spawnOptions.cwd = resolvedDir;
    }

    const child = spawn(svc.command, spawnOptions);
    this.processes[name] = child.pid;

    if (svc.port) {
      await waitForPort(svc.port, 60000);
    }

    return { message: `Service ${name} started`, pid: child.pid, logFile };
  }

  async stop(name) {
    const svc = this._getService(name);
    const resolvedDir = resolveHome(svc.dir);

    if (svc.stopCommand) {
      await new Promise((resolve, reject) => {
        exec(
          svc.stopCommand,
          { cwd: resolvedDir, shell: true },
          (err, stdout, stderr) => {
            if (err) {
              return reject(
                new Error(`stopCommand failed for ${name}: ${err.message}`)
              );
            }
            resolve();
          }
        );
      });
    }

    if (svc.port) {
      await killByPort(svc.port);
    }

    delete this.processes[name];
    return { message: `Service ${name} stopped` };
  }

  async restart(name) {
    await this.stop(name);
    return this.start(name);
  }

  async status(name) {
    const svc = this._getService(name);
    let running = false;

    if (svc.port) {
      running = await isPortOpen(svc.port);
    }

    return {
      service: name,
      running,
      port: svc.port || null,
      type: svc.type || null
    };
  }
}

module.exports = ServiceManager;
