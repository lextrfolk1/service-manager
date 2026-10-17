# Struo – Local Microservices Manager

Struo is a local service control plane for development environments. It provides a React dashboard and Node/Express backend to start, stop, restart, monitor, and configure multiple services from one place.

It is designed to work across macOS, Linux, and Windows, while keeping service commands configurable per machine and per operating system.

---

## Features

- Unified dashboard for local services, organised in groups
- Start / stop / restart actions with port cleanup
- Service dependencies: start a service together with the services it needs
- Presets: start a named set of services in one click
- Build-on-start support
- Real-time status monitoring, with optional live CPU and memory per service
- Git on each card: current branch, branch switching, pull and push
- Per-machine run configuration: JVM options, program arguments and environment variables
- Import / export of the configuration, and a JSON editor
- Multi-service log viewing with live streaming for current files, and log retention settings
- Themes (Light, Dark, Graphite, Warm, Follow system) and selectable card styles
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
│   │   ├── services.json           # shared service definitions (committed)
│   │   ├── services.windows.json   # Windows variant, picked automatically on Windows
│   │   └── run-config.json         # this machine's run configuration (git-ignored)
│   └── src/
├── react-frontend/
├── docs/
│   └── MEMORY_LIMITS.md            # recommended memory settings per service
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
      "dependsOn": ["execution-service"],
      "group": "Background",
      "description": "Background execution worker"
    }
  }
}
```

### Service fields

| Field | Purpose |
| --- | --- |
| `type` | `java`, `python`, `npm`, `listener`, `redis`, `neo4j`, `database` or `docker`; decides which run configuration fields apply |
| `path` | Folder the commands run in; can use `${basePaths.<key>}` |
| `command` | Start command |
| `build` | Build command, run before start when build mode is on |
| `port` | Port the service listens on; used for status, port cleanup and links |
| `stopCommand` | Custom stop command (otherwise the process on the port is stopped) |
| `healthCommand` | Command that exits 0 when the service is healthy |
| `daemon` | `true` when the start command returns immediately and the service keeps running in the background |
| `dependsOn` | Services that must be running first |
| `group` | Dashboard group the service is shown in |
| `docsPath` | Path of the API docs (for example `/swagger-ui.html`), shown as a link on the card |
| `description` | Short description shown on the card |
| `enableGit` | `false` hides git features for the service |
| `gitAutoPull` | `false` skips the `git pull` before each start |

### Run configuration (per machine)

Each machine can add its own settings to a service without changing the shared `services.json`:

- **JVM arguments** (Java services), such as heap limits or `spring.profiles.active=local`
- **Program arguments**
- **Environment variables**, such as API keys

They are stored in `backend/config/run-config.json`, which is git-ignored and never committed. Edit them in **Admin › Services › Run configuration**, from a card's **Run configuration…** menu item, or in the `run-config.json` tab of **Admin › Import / Export**. Changes apply the next time the service starts.

See [docs/MEMORY_LIMITS.md](docs/MEMORY_LIMITS.md) for recommended memory settings for each service.

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

## Dashboard

- Services are shown by group (turn off with **View › Group services**); collapsed groups are remembered
- Start, stop and restart from each card, or for a selection of services
- When a start fails because a dependency isn't running, **Start all needed** starts the service with everything it depends on (Detailed, Accent strip and Elevated cards, when the dependency check is on)
- Presets start a named set of services
- Search and filters by status, type and group
- The **View** menu turns grouping, git branches and live resources (CPU, memory) on cards on or off, toggles **Build before start**, and sets the look, theme and card style for you only

## Admin Experience

The Admin screen has these tabs:

| Tab | What it does |
| --- | --- |
| Paths | Base paths, with native folder picking |
| Services | Service definitions, dependencies, groups and run configuration |
| Logs | How many earlier runs to keep and for how long; turns the combined log view on or off |
| Presets | Named service lists for the dashboard |
| Appearance | Default card style for everyone, with live previews, and your own theme |
| Import / Export | Export or import the configuration, and edit `services.json` or `run-config.json` as JSON |

Every change is checked before saving, and **Save** lists all changes for confirmation before anything is written.

### Import / Export

- **Export** downloads or copies the chosen sections. Paths and run configuration are off by default, and secret values are written as `<hidden>` unless you choose to include them.
- **Import** loads an exported file or a plain `services.json`. Choose the sections and **Merge** (add and update) or **Replace**, review the preview of changes and any new problems, then **Apply to editor**. Nothing is written until you Save. Paths from another operating system start unticked.
- The **JSON editor** has a tab per file. It is read-only until you choose **Unlock to edit**; syntax errors show their line and column.

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
- earlier runs are archived and kept for 3 days or 20 runs by default; change this in **Admin › Logs** or with `LOG_RETENTION_DAYS` and `LOG_MAX_ARCHIVED_RUNS`
- **Combined logs** (off by default; turn on in **Admin › Logs**): several services' current runs in one live view, ordered by time and tagged by service, with a filter for following a trace ID across services
- large logs open at their newest 8 MB (set `LOG_MAX_RESPONSE_BYTES` to change); search, go to line and download cover the whole file

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

### "Start X first"

- the service depends on another service that isn't running
- start the dependency first, or use **Start all needed** on the card (Detailed, Accent strip and Elevated card styles)

### Service uses too much memory

- set heap limits in the service's run configuration; see [docs/MEMORY_LIMITS.md](docs/MEMORY_LIMITS.md)

### Health looks wrong

- add an explicit `healthCommand` for services that can open a port before they are actually ready

---

## Notes

- `~` is expanded automatically
- Windows users can configure machine-specific paths in `services.windows.json`
- Build mode can be toggled per service or globally from the UI
- Listener services benefit from explicit `healthCommand` values
