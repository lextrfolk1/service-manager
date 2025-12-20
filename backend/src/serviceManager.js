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
  
  return str.replace(/\$\{basePaths\.(\w+)\}/g, (_, type) => {
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
    let checkable = true;

    // For services with ports, check if port is open
    if (svc.port) {
      running = await isPortOpen(svc.port);
    } 
    // For services with explicit health commands, use health check
    else if (svc.healthCommand) {
      running = await this._checkHealthCommand(name, svc);
    }
    // For listener services without health commands, mark as not checkable
    else if (svc.type === 'listener') {
      checkable = false;
      running = false;
    }
    // For other services without ports, check if process is in our tracking
    else {
      running = !!this.processes[name];
    }

    return {
      service: name,
      running,
      checkable,
      port: svc.port || null,
      type: svc.type || null,
      path: svc.path || null
    };
  }

  // Helper method to check service health using health command
  async _checkHealthCommand(name, svc) {
    try {
      // Only use explicit healthCommand - no auto-derivation
      const healthCommand = svc.healthCommand;

      // If no health command available, return false (service not checkable)
      if (!healthCommand) {
        console.warn(`No health check available for service: ${name}. Add a healthCommand to enable status checking.`);
        return false;
      }

      const resolvedDir = svc.path ? resolveHome(resolvePlaceholders(svc.path, this.basePaths)) : null;
      const resolvedHealthCommand = resolvePlaceholders(healthCommand, this.basePaths);
      
      return new Promise((resolve) => {
        exec(
          resolvedHealthCommand,
          { cwd: resolvedDir, shell: true },
          (err) => {
            // If command exits with code 0, service is running
            resolve(!err);
          }
        );
      });
    } catch (error) {
      console.error(`Health check failed for ${name}:`, error.message);
      return false;
    }
  }
}

module.exports = ServiceManager;
