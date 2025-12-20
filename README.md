# Struo – Local Microservices Manager

Struo is a lightweight tool for managing local microservices during development.  
It provides a simple web dashboard to start, stop, restart, view logs, and configure multiple Java/Python/Node/DB services from one place.

---

## 🚀 Features

- Unified dashboard for all services
- Start / Stop / Restart with automatic port cleanup
- Optional Git pull + Maven build before start
- Auto-load + auto-refresh log viewer
- Delete log files directly from UI
- Configurable service definitions via `services.json`
- One-command startup script (`start-application.sh`)

---

## 📂 Project Structure

```
service-manager/
├── backend/                # Node.js API server
│   ├── src/
│   └── services.json       # Service definitions
├── frontend/               # Original Dashboard UI (HTML/JS)
├── react-frontend/         # React version of Dashboard UI
├── logs/                   # Captured logs
├── start-application.sh    # Starts backend + original frontend
└── start-react-app.sh      # Starts backend + React frontend
```

---

## ⚙️ Service Configuration

### Base Path Configuration (`config.json`)

Struo supports different base paths for different service types, allowing you to organize your projects by technology:

```json
{
  "basePaths": {
    "java": "~/workspace/java-services",
    "python": "~/workspace/python-services", 
    "npm": "~/workspace/frontend-services",
    "redis": null,
    "neo4j": "~/databases/neo4j",
    "listener": "~/workspace/python-services",
    "default": "~/workspace/microservices"
  }
}
```

**Setup:**
1. Copy `backend/config/config.example.json` to `backend/config/config.json`
2. Edit the base paths to match your project structure
3. Use `${basePath.type}` placeholders in `services.json`

### Service Definitions (`services.json`)

Each service entry defines how it should be built, started, and monitored. Service directories are resolved using `${basePath.type}` placeholders.

### Sample Configuration

```json
{
  "services": {
    "config-service": {
      "type": "java",
      "port": 8888,
      "dir": "${basePath.java}/config-service",
      "command": "mvn spring-boot:run",
      "build": "mvn clean install -DskipTests",
      "description": "Spring Cloud Config Server"
    },

    "execution-service": {
      "type": "python",
      "port": 5002,
      "dir": "${basePath.python}/execution-service",
      "command": "$(pwd)/.venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 5002"
    },

    "frontend-service": {
      "type": "npm",
      "port": 3000,
      "dir": "${basePath.npm}/frontend-service",
      "command": "npm run dev"
    },

    "redis": {
      "type": "redis",
      "port": 6379,
      "command": "redis-server"
    },

    "neo4j": {
      "type": "neo4j",
      "port": 7687,
      "dir": "${basePath.neo4j}",
      "command": "./bin/neo4j start",
      "stopCommand": "./bin/neo4j stop"
    }
  }
}
```

**Transparent Path Resolution:**
- `${basePath.java}` → Resolves to the Java base path from config.json
- `${basePath.python}` → Resolves to the Python base path from config.json  
- `${basePath.npm}` → Resolves to the NPM base path from config.json
- `${basePath.neo4j}` → Resolves to the Neo4j base path from config.json

**Path Resolution Examples:**
With base paths configured as:
```json
{
  "basePaths": {
    "java": "~/workspace/java-services",
    "python": "~/workspace/python-services",
    "npm": "~/workspace/frontend-services",
    "neo4j": "~/databases/neo4j"
  }
}
```

Services resolve to:
- `${basePath.java}/config-service` → `~/workspace/java-services/config-service`
- `${basePath.python}/execution-service` → `~/workspace/python-services/execution-service`  
- `${basePath.npm}/frontend-service` → `~/workspace/frontend-services/frontend-service`
- `${basePath.neo4j}` → `~/databases/neo4j`

**Special Path Handling:**
- Absolute paths (`/full/path`) are used as-is
- Home paths (`~/path`) are expanded to user home directory
- Placeholder paths (`${basePath.type}/service`) are resolved using config.json base paths
- Services without directories (like Redis) don't need path resolution

---

## ▶️ Starting the Application

### Start All Services (Recommended)

```bash
bash start-application.sh
```

This starts **both frontends simultaneously**:

- Original HTML/JS frontend on port 4002
- React frontend on port 4005
- Backend API on port 4000

### Start Individual Frontends

```bash
# Start only React frontend + backend
bash start-react-app.sh
```

All scripts:

- Stop previous backend/frontend processes
- Start backend API server
- Start respective frontend(s)
- Write logs to `/logs`

**Available Options:**

- `bash start-application.sh` - Starts **both frontends** + backend (recommended)
- `bash start-react-app.sh` - Starts only React frontend + backend

---

## 🌐 Access URLs

| Component             | URL                   |
| --------------------- | --------------------- |
| Original Dashboard UI | http://localhost:4002 |
| React Dashboard UI    | http://localhost:4005 |
| Backend API           | http://localhost:4000 |

---

## ⚛️ React Version

The React version provides the same functionality as the original with modern improvements:

- **Component-based architecture** with reusable React components
- **Better state management** using React hooks
- **Client-side routing** with React Router
- **Improved error handling** and loading states
- **Modern development experience** with hot reload
- **Same API compatibility** - works with existing backend

See `react-frontend/README.md` for detailed React-specific documentation.

---

## 📝 Notes

- Java + Maven required for Java services
- Python + Uvicorn required for Python services
- Redis/Neo4j binaries must exist for those services
- `~` is automatically expanded to your home directory
- Latest log file is auto-loaded and refreshed every 2 seconds
