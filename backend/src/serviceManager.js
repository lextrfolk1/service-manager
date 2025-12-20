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

// Function to resolve template variables like ${basePaths.java}
function resolvePlaceholders(str, basePaths) {
  if (!str) return str;
  
  return str.replace(/\$\{basePaths\.(\w+)\}/g, (match, type) => {
    const basePath = basePaths[type];
    return basePath ? resolveHome(basePath) : '';
  });
}

class ServiceManager {
  constructor(config) {
    this.config = config;
    this.services = config.services;
    this.basePaths = config.config.basePaths;
    this.processes = {}; // name -> pid
  }

  _getService(name) {
    const svc = this.services[name];
    if (!svc) {
      throw new Error(`Unknown service: ${name}`);
    }
    return svc;
  }

  async start(name, forceBuild = false) {
    const svc = this._getService(name);

    if (!svc.command) {
      throw new Error(`Service ${name} has no command configured`);
    }

    // Resolve placeholders in path and command using basePaths
    const resolvedDir = svc.path ? resolveHome(resolvePlaceholders(svc.path, this.basePaths)) : null;
    const resolvedCommand = resolvePlaceholders(svc.command, this.basePaths);
    
    const logFile = logger.createLogFile(name);
    const out = fs.openSync(logFile, "a");
    let gitAutoPull = svc.gitAutoPull || true;

    if (gitAutoPull && resolvedDir) {
      await new Promise((resolve, reject) => {
        exec(
          `git -C "${resolvedDir}" pull`,
          { shell: true },
          (err, stdout, stderr) => {
            fs.appendFileSync(logFile, `\n[GIT PULL STDOUT]\n${stdout || ""}`);
            fs.appendFileSync(logFile, `\n[GIT PULL STDERR]\n${stderr || ""}`);

            if (err) {
              return reject(
                new Error(`Git pull failed for ${name}: ${err.message}`)
              );
            }
            resolve();
          }
        );
      });
    }

    // Optional build step - only run if forceBuild is true
    if (forceBuild && svc.build) {
      const resolvedBuild = resolvePlaceholders(svc.build, this.basePaths);
      await new Promise((resolve, reject) => {
        exec(
          resolvedBuild,
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

    if (resolvedDir) {
      spawnOptions.cwd = resolvedDir;
    }

    const child = spawn(resolvedCommand, spawnOptions);
    this.processes[name] = child.pid;

    if (svc.port) {
      await waitForPort(svc.port, 60000);
    }

    return { message: `Service ${name} started`, pid: child.pid, logFile };
  }

  async stop(name) {
    const svc = this._getService(name);
    const resolvedDir = svc.path ? resolveHome(resolvePlaceholders(svc.path, this.basePaths)) : null;

    if (svc.stopCommand) {
      const resolvedStopCommand = resolvePlaceholders(svc.stopCommand, this.basePaths);
      await new Promise((resolve, reject) => {
        exec(
          resolvedStopCommand,
          { cwd: resolvedDir, shell: true },
          (err) => {
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
      type: svc.type || null,
      path: svc.path || null
    };
  }
}

module.exports = ServiceManager;
