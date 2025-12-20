const net = require("net");
const { exec } = require("child_process");

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
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

function killByPort(port) {
  return new Promise(resolve => {
    if (!port) return resolve();
    
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows: Use netstat and taskkill
      const cmd = `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /f /pid %a`;
      exec(cmd, { shell: true }, () => resolve());
    } else {
      // Unix/Linux/macOS: Use lsof and kill
      const cmd = `lsof -ti :${port} | xargs -r kill -9`;
      exec(cmd, () => resolve());
    }
  });
}

module.exports = {
  isPortOpen,
  waitForPort,
  killByPort
};
