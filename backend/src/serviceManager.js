const { spawn, exec } = require("child_process");
const fs = require("fs");
const logger = require("./logger");
const {
  killByPort,
  waitForPort,
  isPortOpen,
  getPortProcess,
  getAllListeningPorts,
  killProcessOnPort,
  invalidatePortCache,
} = require("./utils/portUtils");

const os = require("os");
const path = require("path");
const gitUtils = require("./utils/gitUtils");

const gitCache = new Map();
const GIT_CACHE_TTL_MS = 10000;

// Shared tracker across ServiceManager instances so PID tracking is preserved
const managedProcesses = new Map(); // serviceName -> { pid, startedAt }

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function createOperationError(message, options = {}) {
  const error = new Error(message);
  error.code = options.code || "operation_failed";
  error.phase = options.phase || "runtime";
  error.service = options.service || null;
  error.details = options.details || null;
  return error;
}

function resolveHome(p) {
  if (!p) return p;
  
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Windows: Handle both ~ and %USERPROFILE% patterns
    if (p.startsWith("~/")) {
      return path.join(os.homedir(), p.slice(2));
    }
    if (p.includes("%USERPROFILE%")) {
      return p.replace(/%USERPROFILE%/g, os.homedir());
    }
  } else {
    // Unix/Linux/macOS
    if (p.startsWith("~/")) {
      return path.join(os.homedir(), p.slice(2));
    }
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

  getResolvedDir(name) {
    const svc = this._getService(name);
    return svc.path ? resolveHome(resolvePlaceholders(svc.path, this.basePaths)) : null;
  }

  async getGitInfo(name, forceFresh = false) {
    if (this.config.config?.enableGit === false) {
      return {
        isGitRepo: false,
        currentBranch: null,
        isDirty: false,
        uncommittedCount: 0
      };
    }

    const svc = this._getService(name);
    if (svc.enableGit === false) {
      return {
        isGitRepo: false,
        currentBranch: null,
        isDirty: false,
        uncommittedCount: 0
      };
    }

    const resolvedDir = this.getResolvedDir(name);
    if (!resolvedDir) {
      return {
        isGitRepo: false,
        currentBranch: null,
        isDirty: false,
        uncommittedCount: 0
      };
    }

    const now = Date.now();
    const cached = gitCache.get(resolvedDir);
    if (!forceFresh && cached && (now - cached.timestamp < GIT_CACHE_TTL_MS)) {
      return cached.data;
    }

    const data = await gitUtils.getGitInfo(resolvedDir);
    gitCache.set(resolvedDir, { data, timestamp: now });
    return data;
  }

  async getGitBranches(name, shouldFetch = false) {
    if (this.config.config?.enableGit === false) {
      return {
        isGitRepo: false,
        currentBranch: null,
        localBranches: [],
        remoteBranches: [],
        remotes: [],
        isDirty: false,
        uncommittedCount: 0
      };
    }

    const svc = this._getService(name);
    if (svc.enableGit === false) {
      return {
        isGitRepo: false,
        currentBranch: null,
        localBranches: [],
        remoteBranches: [],
        remotes: [],
        isDirty: false,
        uncommittedCount: 0
      };
    }

    const resolvedDir = this.getResolvedDir(name);
    if (!resolvedDir) {
      return {
        isGitRepo: false,
        currentBranch: null,
        localBranches: [],
        remoteBranches: [],
        remotes: [],
        isDirty: false,
        uncommittedCount: 0
      };
    }
    return await gitUtils.getGitBranches(resolvedDir, shouldFetch);
  }

  async checkoutBranch(name, branchName, restart = false) {
    const resolvedDir = this.getResolvedDir(name);
    if (!resolvedDir) {
      throw createOperationError(`Service ${name} does not have a configured directory path`, {
        code: "invalid_config",
        phase: "git_checkout",
        service: name
      });
    }

    const result = await gitUtils.checkoutBranch(resolvedDir, branchName);
    gitCache.set(resolvedDir, {
      data: {
        isGitRepo: true,
        currentBranch: result.currentBranch,
        isDirty: result.isDirty,
        uncommittedCount: result.uncommittedCount,
        ahead: result.ahead,
        behind: result.behind,
        hasUpstream: result.hasUpstream,
        upstreamBranch: result.upstreamBranch
      },
      timestamp: Date.now()
    });

    const currentStatus = await this.status(name);
    let restarted = false;

    if (restart && currentStatus.running) {
      restarted = true;
      // Trigger restart in background so checkout response returns immediately without hanging
      this.restart(name).catch((err) => {
        console.error(`Failed to restart ${name} after checkout:`, err.message);
      });
    }

    return {
      success: true,
      service: name,
      branch: result.currentBranch,
      restarted,
      git: {
        isGitRepo: true,
        currentBranch: result.currentBranch,
        isDirty: result.isDirty,
        uncommittedCount: result.uncommittedCount,
        ahead: result.ahead,
        behind: result.behind,
        hasUpstream: result.hasUpstream,
        upstreamBranch: result.upstreamBranch
      },
      message: restarted
        ? `Switched ${name} to branch ${result.currentBranch} (restarting...)`
        : `Switched ${name} to branch ${result.currentBranch}`
    };
  }

  async pullBranch(name, restart = false) {
    const resolvedDir = this.getResolvedDir(name);
    if (!resolvedDir) {
      throw createOperationError(`Service ${name} does not have a configured directory path`, {
        code: "invalid_config",
        phase: "git_pull",
        service: name
      });
    }

    const result = await gitUtils.pullBranch(resolvedDir);
    gitCache.set(resolvedDir, {
      data: {
        isGitRepo: true,
        currentBranch: result.currentBranch,
        isDirty: result.isDirty,
        uncommittedCount: result.uncommittedCount,
        ahead: result.ahead,
        behind: result.behind,
        hasUpstream: result.hasUpstream,
        upstreamBranch: result.upstreamBranch
      },
      timestamp: Date.now()
    });

    const currentStatus = await this.status(name);
    let restarted = false;

    if (restart && currentStatus.running) {
      restarted = true;
      this.restart(name).catch((err) => {
        console.error(`Failed to restart ${name} after pull:`, err.message);
      });
    }

    const firstLine = (result.output || "").split("\n")[0] || "Already up to date.";

    return {
      success: true,
      service: name,
      branch: result.currentBranch,
      output: result.output,
      restarted,
      git: {
        isGitRepo: true,
        currentBranch: result.currentBranch,
        isDirty: result.isDirty,
        uncommittedCount: result.uncommittedCount,
        ahead: result.ahead,
        behind: result.behind,
        hasUpstream: result.hasUpstream,
        upstreamBranch: result.upstreamBranch
      },
      message: restarted
        ? `Pulled latest changes for ${name} (${firstLine}) - restarting...`
        : `Pulled latest changes for ${name}: ${firstLine}`
    };
  }

  async start(name, forceBuild = false) {
    const svc = this._getService(name);

    if (!svc.command) {
      throw createOperationError(`Service ${name} has no command configured`, {
        code: "invalid_config",
        phase: "validation",
        service: name
      });
    }

    // Resolve placeholders in path and command using basePaths
    const resolvedDir = svc.path ? resolveHome(resolvePlaceholders(svc.path, this.basePaths)) : null;
    const resolvedCommand = resolvePlaceholders(svc.command, this.basePaths);
    
    const logFile = logger.createLogFile(name);
    const out = fs.openSync(logFile, "a");
    const gitAutoPull = svc.gitAutoPull !== false;

    if (gitAutoPull && resolvedDir) {
      await new Promise((resolve, reject) => {
        exec(
          `git -C "${resolvedDir}" pull`,
          { shell: true },
          (err, stdout, stderr) => {
            fs.appendFileSync(logFile, `\n[GIT PULL STDOUT]\n${stdout || ""}`);
            fs.appendFileSync(logFile, `\n[GIT PULL STDERR]\n${stderr || ""}`);

            if (err) {
              return reject(createOperationError(`Git pull failed for ${name}: ${err.message}`, {
                code: "git_pull_failed",
                phase: "git_pull",
                service: name,
                details: stderr || stdout || err.message
              }));
            }
            gitCache.delete(resolvedDir);
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
              return reject(createOperationError(`Build failed for ${name}: ${err.message}`, {
                code: "build_failed",
                phase: "build",
                service: name,
                details: stderr || stdout || err.message
              }));
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
    managedProcesses.set(name, { pid: child.pid, startedAt: Date.now() });

    child.on("exit", () => {
      delete this.processes[name];
      managedProcesses.delete(name);
      invalidatePortCache();
    });

    const exitPromise = new Promise((_, reject) => {
      child.once("exit", (code, signal) => {
        if (svc.port) {
          reject(createOperationError(
            `Service ${name} exited before becoming ready${code !== null ? ` (code ${code})` : ""}${signal ? ` (${signal})` : ""}`,
            {
              code: "command_failed",
              phase: "start",
              service: name,
              details: `Process exited before port ${svc.port} became ready`
            }
          ));
        }
      });
      child.once("error", (error) => {
        reject(createOperationError(`Failed to start ${name}: ${error.message}`, {
          code: "command_failed",
          phase: "start",
          service: name,
          details: error.message
        }));
      });
    });

    if (svc.port) {
      try {
        await Promise.race([
          waitForPort(svc.port, 60000),
          exitPromise
        ]);
      } catch (error) {
        delete this.processes[name];
        managedProcesses.delete(name);
        invalidatePortCache();
        throw createOperationError(error.message, {
          code: error.code || (String(error.message).includes("Timeout") ? "startup_timeout" : "command_failed"),
          phase: error.phase || (String(error.message).includes("Timeout") ? "health_check" : "start"),
          service: name,
          details: error.details || null
        });
      }
    }

    invalidatePortCache();
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
              return reject(createOperationError(`stopCommand failed for ${name}: ${err.message}`, {
                code: "stop_command_failed",
                phase: "stop",
                service: name,
                details: err.message
              }));
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
    managedProcesses.delete(name);
    invalidatePortCache();
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
    let healthState = "unknown";
    let portConflict = null;

    const managed = managedProcesses.get(name);
    const isManagedAlive = managed && isProcessAlive(managed.pid);
    if (!isManagedAlive && managed) {
      managedProcesses.delete(name);
      delete this.processes[name];
    }

    // For services with ports, check if port is open and check for conflicts
    if (svc.port) {
      const portProc = await getPortProcess(svc.port);
      const isPortBound = Boolean(portProc && portProc.inUse);

      if (isPortBound) {
        if (isManagedAlive) {
          running = true;
          portConflict = null;
        } else if (svc.type === "redis" || svc.type === "neo4j") {
          // System/database services often run independently as background daemons
          running = true;
          portConflict = null;
        } else {
          // Port is in use by an external or orphaned process!
          running = false;
          portConflict = {
            hasConflict: true,
            port: svc.port,
            pid: portProc.pid,
            command: portProc.command || "unknown",
            user: portProc.user || null,
            message: `Port ${svc.port} in use by PID ${portProc.pid}${portProc.command ? ` (${portProc.command})` : ""}`,
          };
        }
      } else {
        running = false;
        portConflict = null;
      }

      healthState = svc.healthCommand
        ? (await this._checkHealthCommand(name, svc) ? "healthy" : "unhealthy")
        : (running ? "port-open" : "unknown");
    }
    // For services with explicit health commands, use health check
    else if (svc.healthCommand) {
      running = await this._checkHealthCommand(name, svc);
      healthState = running ? "healthy" : "unhealthy";
    }
    // For listener services without health commands, mark as not checkable
    else if (svc.type === "listener") {
      checkable = false;
      running = false;
      healthState = "unknown";
    }
    // For other services without ports, check if process is in our tracking
    else {
      running = isManagedAlive;
      healthState = running ? "unknown" : "unknown";
    }

    const healthy = checkable ? (running ? true : null) : null;
    const lifecycleState = portConflict?.hasConflict ? "blocked" : (running ? "running" : "stopped");
    const git = await this.getGitInfo(name);

    return {
      service: name,
      running,
      checkable,
      healthy,
      lifecycleState,
      healthState,
      port: svc.port || null,
      portConflict,
      type: svc.type || null,
      path: svc.path || null,
      pid: (managedProcesses.get(name)?.pid) || this.processes[name] || null,
      git,
    };
  }

  async freePort(name) {
    const svc = this._getService(name);
    if (!svc.port) {
      throw createOperationError(`Service ${name} has no port configured`, {
        code: "invalid_config",
        phase: "validation",
        service: name,
      });
    }

    const result = await killProcessOnPort(svc.port, { force: true });
    managedProcesses.delete(name);
    delete this.processes[name];
    invalidatePortCache();

    if (!result.success) {
      throw createOperationError(result.error || `Failed to free port ${svc.port}`, {
        code: "port_free_failed",
        phase: "runtime",
        service: name,
        details: result.error,
      });
    }

    return {
      success: true,
      service: name,
      port: svc.port,
      killedPid: result.killedPid || null,
      command: result.command || null,
      freed: result.freed,
      message: result.message || `Successfully freed port ${svc.port}`,
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
