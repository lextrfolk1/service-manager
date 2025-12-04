# Struo – Local Microservices Manager

Struo is a lightweight tool for managing local microservices during development.  
It provides a simple web dashboard to start, stop, restart, view logs, and configure multiple Java/Python/Node/DB services from one place.

---

## 🚀 Features
- Unified dashboard for all services  
- Start / Stop / Restart with automatic port cleanup  
- Optional Git pull + Maven build before start  i.e gitAutoPull flag
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
├── frontend/               # Dashboard UI
├── logs/                   # Captured logs
└── start-application.sh    # Starts backend + frontend
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
      "description": "Spring Cloud Config Server",
      "gitAutoPull": true
    },

    "generic-service": {
      "type": "java",
      "port": 8053,
      "dir": "~/codebase/lextr/generic-service",
      "command": "mvn spring-boot:run -Dspring-boot.run.jvmArguments=\"-Dspring.profiles.active=dev -Dspring.cloud.config.uri=http://localhost:8888\"",
      "build": "mvn clean install -DskipTests",
      "gitAutoPull": false
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

Run:

```bash
bash start-application.sh
```

The script:
- Stops previous backend/frontend processes
- Starts backend
- Starts frontend
- Writes logs to `/logs`

---

## 🌐 Access URLs

| Component    | URL                        |
|--------------|----------------------------|
| Dashboard UI | http://localhost:4002      |
| Backend API  | http://localhost:4000      |

---

## 📝 Notes

- Java + Maven required for Java services
- Python + Uvicorn required for Python services
- Redis/Neo4j binaries must exist for those services
- `~` is automatically expanded to your home directory
- Latest log file is auto-loaded and refreshed every 2 seconds
