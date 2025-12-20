# Struo – Local Microservices Manager

Struo is a lightweight tool for managing local microservices during development.  
It provides a React-based web dashboard to start, stop, restart, view logs, and configure multiple Java/Python/Node/DB services from one place.

---

## Features

- Unified React dashboard for all services
- Start / Stop / Restart with automatic port cleanup
- Build mode toggle for services that need compilation
- Real-time service status monitoring
- Multi-service log viewer with tabs
- Configurable service definitions via `services.json`
- Support for listener services (background processes)
- One-command startup script

---

## Project Structure

```
service-manager/
├── backend/                # Node.js API server
│   ├── src/
│   └── config/
│       └── services.json   # Service definitions
├── react-frontend/         # React Dashboard UI
├── logs/                   # Captured logs
└── start-application.sh    # Single startup script with auto-dependencies
```

---

## Service Configuration

### Base Path Configuration

Struo supports different base paths for different service types, allowing you to organize your projects by technology:

```json
{
  "config": {
    "basePaths": {
      "java": "~/workspace/java-services",
      "python": "~/workspace/python-services", 
      "npm": "~/workspace/npm-services",
      "neo4j": "~/databases/neo4j",
      "listener": "~/workspace/python-services",
      "default": "~/workspace/microservices"
    }
  }
}
```

### Service Definitions (`services.json`)

Each service entry defines how it should be built, started, and monitored. Service directories are resolved using `${basePaths.type}` placeholders.

### Sample Configuration

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
      "command": "$(pwd)/.venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 5002",
      "description": "Code execution service"
    },

    "redis": {
      "type": "redis",
      "port": 6379,
      "command": "redis-server",
      "stopCommand": "redis-cli shutdown",
      "description": "Redis in-memory data store"
    },

    "execution-listener": {
      "type": "listener",
      "path": "${basePaths.listener}/execution-service",
      "command": "$(pwd)/.venv/bin/python worker.py",
      "stopCommand": "pkill -f worker.py",
      "healthCommand": "pgrep -f worker.py > /dev/null",
      "description": "Background execution worker"
    }
  }
}
```

**Path Resolution Examples:**
- `${basePaths.java}/config-service` → `~/workspace/java-services/config-service`
- `${basePaths.python}/execution-service` → `~/workspace/python-services/execution-service`  
- `${basePaths.neo4j}` → `~/databases/neo4j`

---

## Starting the Application

### Start Application

```bash
bash start-application.sh
```

This script will:
- **Auto-install dependencies** for both backend and React frontend (if not present)
- **Stop any existing processes** on ports 4000 and 4005
- **Start backend API** on port 4000
- **Start React frontend** on port 4005
- **Provide colored output** with clear status messages
- **Handle graceful shutdown** with Ctrl+C

The script includes:
- Automatic dependency detection and installation
- Health checks for backend readiness
- Colored terminal output for better visibility
- Proper cleanup on exit
- Comprehensive logging

---

## Access URLs

| Component          | URL                   |
| ------------------ | --------------------- |
| React Dashboard    | http://localhost:4005 |
| Backend API        | http://localhost:4000 |

---

## React Dashboard Features

The React dashboard provides modern service management with:

- **Real-time status monitoring** for all service types
- **Build mode toggle** - enable/disable builds per service or globally
- **Multi-service log viewer** - monitor logs from multiple services simultaneously
- **Advanced filtering** - filter by service type, status, or search text
- **Bulk operations** - start/stop all services with progress tracking
- **Listener service support** - manage background processes without ports
- **Responsive design** - works on desktop and mobile
- **Toast notifications** - real-time feedback for all operations

### Service Types Supported:
- **Java** services (with Maven build support)
- **Python** services (with virtual environment support)
- **NPM** services (with build support)
- **Database** services (Redis, Neo4j)
- **Listener** services (background processes)

---

## Notes

- Java + Maven required for Java services
- Python + virtual environments recommended for Python services
- Redis/Neo4j binaries must exist for database services
- Listener services require `healthCommand` for status monitoring
- `~` is automatically expanded to your home directory
- Build mode can be toggled per service or globally
