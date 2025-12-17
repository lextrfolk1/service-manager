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

## ⚙️ Service Configuration (`services.json`)

Each service entry defines how it should be built, started, and monitored.

### Sample Configuration

```json
{
  "services": {
    "config-service": {
      "type": "java",
      "port": 8888,
      "dir": "~/codebase/lextr/config-service",
      "command": "mvn spring-boot:run",
      "build": "mvn clean install -DskipTests",
      "description": "Spring Cloud Config Server"
    },

    "generic-service": {
      "type": "java",
      "port": 8053,
      "dir": "~/codebase/lextr/generic-service",
      "command": "mvn spring-boot:run -Dspring-boot.run.jvmArguments=\"-Dspring.profiles.active=dev -Dspring.cloud.config.uri=http://localhost:8888\"",
      "build": "mvn clean install -DskipTests"
    },

    "workflow-service": {
      "type": "java",
      "port": 8051,
      "dir": "~/codebase/lextr/workflow-service",
      "command": "mvn spring-boot:run -Dspring-boot.run.jvmArguments=\"-Dspring.profiles.active=dev -Dspring.cloud.config.uri=http://localhost:8888\"",
      "build": "mvn clean install -DskipTests"
    },

    "execution-service": {
      "type": "python",
      "port": 5002,
      "dir": "~/codebase/lextr/execution-service",
      "command": "uvicorn app:app --host 0.0.0.0 --port 5002"
    },

    "redis": {
      "type": "redis",
      "port": 6379,
      "command": "redis-server"
    },

    "neo4j": {
      "type": "neo4j",
      "port": 7687,
      "dir": "~/neo4j",
      "command": "./bin/neo4j start",
      "stopCommand": "./bin/neo4j stop"
    }
  }
}
```

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
