# Struo – Local Microservices Manager

Struo is a local service control plane for development environments. It provides a React dashboard and Node/Express backend to start, stop, restart, monitor, and configure multiple services from one place.

It is designed to work across macOS, Linux, and Windows, while keeping service commands configurable per machine and per operating system.

---

## Features

- Unified dashboard for local services
- Start / stop / restart actions with port cleanup
- Build-on-start support
- Real-time status monitoring
- Multi-service log viewing with live streaming for current files
- Config-driven service definitions
- Base path templates for reusable service locations
- Native folder picker support in Admin
- Platform-aware config selection

---

## Requirements

Install the tools that match the services you want to run:

- `Node.js` 16+ for Struo itself
- `Git` if you use `gitAutoPull`
- `Java` + `Maven` for Java services
- `Python` for Python services
- `Redis`, `Neo4j`, or other service binaries if configured

Struo itself is cross-platform, but each service command must still be valid for the machine where it runs.

---

## Quick Start

| Platform | Startup Command |
| --- | --- |
| macOS / Linux | `bash start-application.sh` |
| Windows | `start-application.bat` |

After startup:

- Frontend: `http://localhost:4005`
- Backend API: `http://localhost:4000`

---

## Project Structure

```text
service-manager/
├── backend/
│   ├── config/
│   │   ├── services.json
│   │   └── services.windows.json
│   └── src/
├── react-frontend/
├── logs/
├── start-application.sh
└── start-application.bat
```

---

## Configuration Model

Struo reads service definitions from JSON config files.

### Config selection order

Struo resolves config files in this order:

1. `STRUO_CONFIG_FILE`
2. platform-specific file if present
3. fallback `backend/config/services.json`

Current platform-specific filenames supported automatically:

- Windows: `backend/config/services.windows.json`
- macOS: `backend/config/services.macos.json`
- Linux: `backend/config/services.linux.json`

Examples:

```bash
STRUO_CONFIG_FILE=backend/config/services.json npm start
```

```cmd
set STRUO_CONFIG_FILE=backend\config\services.windows.json && npm start
```

### Base paths

Base paths let you reuse common roots across services.

```json
{
  "config": {
    "basePaths": {
      "java": "~/workspace/java-services",
      "python": "~/workspace/python-services",
      "npm": "~/workspace/npm-services",
      "listener": "~/workspace/python-services",
      "default": "~/workspace/microservices"
    }
  }
}
```

Use them in service paths like:

- `${basePaths.java}/config-service`
- `${basePaths.python}/execution-service`
- `${basePaths.listener}/workers`

### Service definition example

```json
{
  "services": {
    "config-service": {
      "type": "java",
      "port": 8888,
      "path": "${basePaths.java}/config-service",
      "command": "mvn spring-boot:run",
      "build": "mvn clean install -DskipTests",
      "description": "Spring Cloud Config Server"
    },
    "execution-service": {
      "type": "python",
      "port": 5002,
      "path": "${basePaths.python}/execution-service",
      "command": ".venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 5002",
      "description": "Code execution service"
    },
    "execution-listener": {
      "type": "listener",
      "path": "${basePaths.listener}/execution-service",
      "command": ".venv/bin/python worker.py",
      "stopCommand": "pkill -f worker.py",
      "healthCommand": "pgrep -f worker.py > /dev/null",
      "description": "Background execution worker"
    }
  }
}
```

---

## Cross-Platform Guidance

Struo handles platform awareness around config loading, path picking, and port cleanup. Service commands remain your responsibility.

### What Struo handles

- Picks the right config file for the current OS
- Expands home-directory style paths
- Uses native folder picker support in Admin
- Uses platform-appropriate process cleanup for occupied ports

### What you configure per platform

- `command`
- `build`
- `stopCommand`
- `healthCommand`
- base paths for your machine

### Command differences by platform

| Concern | macOS / Linux | Windows |
| --- | --- | --- |
| Python venv | `.venv/bin/python` | `.venv\\Scripts\\python.exe` |
| Env var in command | `export PYTHONPATH=/path && ...` | `set PYTHONPATH=C:\\path && ...` |
| Process health check | `pgrep -f worker.py` | `tasklist /fi "IMAGENAME eq python.exe" \| findstr python.exe` |
| Stop process | `pkill -f worker.py` | `taskkill /f /im python.exe` |
| Typical path | `~/codebase/lextr` | `C:/codebase/lextr` |

### Recommended Windows approach

Use `backend/config/services.windows.json` and keep Windows-specific commands there.

Example:

```json
{
  "execution-service": {
    "type": "python",
    "port": 5002,
    "path": "${basePaths.python}\\execution-service",
    "command": ".venv\\Scripts\\python.exe -m uvicorn app:app --host 0.0.0.0 --port 5002",
    "description": "Service to handle code execution tasks"
  }
}
```

---

## Starting Struo

### macOS / Linux

```bash
bash start-application.sh
```

### Windows

```cmd
start-application.bat
```

The startup scripts:

- install missing frontend/backend dependencies when needed
- stop processes on Struo ports
- start backend on `4000`
- start frontend on `4005`
- write boot logs to `logs/`

---

## Admin Experience

The Admin screen supports:

- editing base paths
- editing service definitions
- native folder picking
- raw JSON editing for advanced cases
- validation before save

Runtime metadata is shown in Admin so users can see:

- current platform
- active config file
- whether `STRUO_CONFIG_FILE` is overriding default selection

---

## Logs

Logs are stored in:

- `logs/backend.log`
- `logs/react-frontend.log`
- `backend/logs/<service>/`

Current log file behavior:

- current active file supports live streaming
- older files are static
- log viewing is service-oriented in the UI

---

## Troubleshooting

### Path not found

- verify base paths point to real directories
- verify service `path` values resolve correctly
- on Windows, prefer forward slashes or properly escaped backslashes

### Python environment not found

- create the virtual environment in the service repo
- verify the configured Python executable path matches the OS

### Port already in use

- Struo tries to free configured ports automatically
- if needed, verify manually with platform tools:
  - macOS / Linux: `lsof -nP -iTCP:<port> -sTCP:LISTEN`
  - Windows: `netstat -ano | findstr :<port>`

### Java or Maven not found

- ensure `java` and `mvn` are installed and available in `PATH`

### Health looks wrong

- add an explicit `healthCommand` for services that can open a port before they are actually ready

---

## Notes

- `~` is expanded automatically
- Windows users can configure machine-specific paths in `services.windows.json`
- Build mode can be toggled per service or globally from the UI
- Listener services benefit from explicit `healthCommand` values
