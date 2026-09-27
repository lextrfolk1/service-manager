const { exec } = require("child_process");

function parseEtimeToSeconds(etimeStr) {
  if (!etimeStr) return 0;
  const str = etimeStr.trim();
  let days = 0;
  let rest = str;
  if (rest.includes("-")) {
    const parts = rest.split("-");
    days = parseInt(parts[0], 10) || 0;
    rest = parts[1];
  }
  const timeParts = rest.split(":").map((p) => parseInt(p, 10) || 0);
  let hours = 0, minutes = 0, seconds = 0;
  if (timeParts.length === 3) [hours, minutes, seconds] = timeParts;
  else if (timeParts.length === 2) [minutes, seconds] = timeParts;
  else if (timeParts.length === 1) [seconds] = timeParts;

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function formatUptime(etimeStr) {
  if (!etimeStr) return "Up 0m";
  const str = etimeStr.trim();
  let days = 0;
  let rest = str;
  if (rest.includes("-")) {
    const parts = rest.split("-");
    days = parseInt(parts[0], 10) || 0;
    rest = parts[1];
  }
  const timeParts = rest.split(":").map((p) => parseInt(p, 10) || 0);
  let hours = 0, minutes = 0, seconds = 0;
  if (timeParts.length === 3) [hours, minutes, seconds] = timeParts;
  else if (timeParts.length === 2) [minutes, seconds] = timeParts;
  else if (timeParts.length === 1) [seconds] = timeParts;

  if (days > 0) return `Up ${days}d ${hours}h`;
  if (hours > 0) return `Up ${hours}h ${minutes}m`;
  if (minutes > 0) return `Up ${minutes}m`;
  return `Up ${seconds}s`;
}

function formatMemory(rssKb) {
  if (!rssKb || rssKb <= 0) return "0 MB";
  if (rssKb < 1024) {
    return `${rssKb} KB`;
  }
  const mb = rssKb / 1024;
  if (mb < 1024) {
    return `${Math.round(mb)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

let metricsCache = null;
let metricsCacheTime = 0;
const CACHE_TTL_MS = 1500;

function fetchProcessMetrics(pids) {
  return new Promise((resolve) => {
    if (!Array.isArray(pids) || pids.length === 0) {
      return resolve({});
    }

    const uniquePids = [...new Set(pids.map((p) => parseInt(p, 10)).filter((p) => p && p > 1))];
    if (uniquePids.length === 0) {
      return resolve({});
    }

    const isWindows = process.platform === "win32";

    if (isWindows) {
      const pidList = uniquePids.join(",");
      const script = `Get-Process -Id ${pidList} -ErrorAction SilentlyContinue | Select-Object Id, WorkingSet64, CPU, StartTime | ConvertTo-Json`;
      exec(
        `powershell.exe -NoProfile -Command "${script}"`,
        { timeout: 4000 },
        (err, stdout) => {
          if (err || !stdout) {
            return resolve({});
          }
          try {
            const parsed = JSON.parse(stdout);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            const results = {};
            const now = Date.now();
            items.forEach((item) => {
              if (!item || !item.Id) return;
              const pid = item.Id;
              const wsBytes = item.WorkingSet64 || 0;
              const rssKb = Math.round(wsBytes / 1024);
              const cpu = typeof item.CPU === "number" ? Math.round(item.CPU * 10) / 10 : 0;
              let seconds = 0;
              if (item.StartTime) {
                const match = String(item.StartTime).match(/\/Date\((\d+)\)\//);
                if (match) {
                  seconds = Math.max(0, Math.floor((now - parseInt(match[1], 10)) / 1000));
                } else {
                  const parsedTime = Date.parse(item.StartTime);
                  if (!isNaN(parsedTime)) {
                    seconds = Math.max(0, Math.floor((now - parsedTime) / 1000));
                  }
                }
              }
              const mins = Math.floor(seconds / 60);
              const hrs = Math.floor(mins / 60);
              const etimeStr = hrs > 0 ? `${hrs}:${mins % 60}:${seconds % 60}` : `${mins}:${seconds % 60}`;
              results[pid] = {
                pid,
                rssKb,
                cpu,
                etime: etimeStr,
                etimeSeconds: seconds,
              };
            });
            resolve(results);
          } catch (e) {
            resolve({});
          }
        }
      );
    } else {
      // Unix / macOS / Linux: batch query in a single ps call
      const pidArg = uniquePids.join(",");
      exec(`ps -o pid,rss,%cpu,etime -p ${pidArg}`, { timeout: 3000 }, (err, stdout) => {
        if (err || !stdout) {
          return resolve({});
        }
        const lines = stdout.trim().split("\n");
        const results = {};
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 4) {
            const pid = parseInt(parts[0], 10);
            const rssKb = parseInt(parts[1], 10) || 0;
            const cpu = parseFloat(parts[2]) || 0;
            const etime = parts[3];
            const etimeSeconds = parseEtimeToSeconds(etime);
            results[pid] = {
              pid,
              rssKb,
              cpu,
              etime,
              etimeSeconds,
            };
          }
        }
        resolve(results);
      });
    }
  });
}

module.exports = {
  fetchProcessMetrics,
  formatUptime,
  formatMemory,
  parseEtimeToSeconds,
};
