# Windows Setup Guide for Struo Service Manager

This guide explains how to set up and run Struo Service Manager on Windows.

## Prerequisites

1. **Node.js** (v16 or higher) - Download from [nodejs.org](https://nodejs.org/)
2. **Git** - Download from [git-scm.com](https://git-scm.com/)
3. **Java JDK** (if running Java services) - Download from [Oracle](https://www.oracle.com/java/technologies/downloads/) or [OpenJDK](https://openjdk.org/)
4. **Python** (if running Python services) - Download from [python.org](https://www.python.org/)
5. **Maven** (if building Java services) - Download from [maven.apache.org](https://maven.apache.org/)

## Quick Start

### Option 1: Use Windows Configuration (Recommended)

1. **Copy the Windows configuration:**
   ```cmd
   copy backend\config\services.windows.json backend\config\services.json
   ```

2. **Update the base paths** in `backend/config/services.json`:
   ```json
   {
     "config": {
       "basePaths": {
         "java": "C:/your-project-path",
         "python": "C:/your-project-path",
         "npm": "C:/your-project-path",
         "listener": "C:/your-project-path",
         "default": "C:/your-project-path"
       }
     }
   }
   ```

3. **Run the Windows startup script:**
   ```cmd
   start-application.bat
   ```

### Option 2: Manual Configuration

1. **Edit the existing configuration** in `backend/config/services.json`:
   - Update `basePaths` to use Windows paths (e.g., `C:/codebase/lextr`)
   - Update Python commands to use Windows virtual environment paths:
     ```json
     "command": ".venv\\Scripts\\python.exe -m uvicorn app:app --host 0.0.0.0 --port 5002"
     ```
   - Update listener commands to use Windows syntax:
     ```json
     "command": "set PYTHONPATH=C:\\path\\to\\execution-service && .venv\\Scripts\\python.exe utils\\pg_sync_worker.py"
     ```

2. **Run the startup script:**
   ```cmd
   start-application.bat
   ```

## Configuration Differences

### Path Formats
- **Windows:** `C:/codebase/lextr` or `C:\\codebase\\lextr`
- **Unix/Linux/macOS:** `~/codebase/lextr`

### Python Virtual Environment
- **Windows:** `.venv\\Scripts\\python.exe`
- **Unix/Linux/macOS:** `$(pwd)/.venv/bin/python`

### Environment Variables
- **Windows:** `set PYTHONPATH=C:\\path\\to\\service`
- **Unix/Linux/macOS:** `export PYTHONPATH=/path/to/service`

### Process Management
- **Windows:** Uses `taskkill` and `netstat`
- **Unix/Linux/macOS:** Uses `kill` and `lsof`

## Service Configuration Examples

### Java Service (Windows)
```json
{
  "config-service": {
    "type": "java",
    "port": 8888,
    "path": "C:/codebase/lextr/config-service",
    "command": "mvn spring-boot:run",
    "build": "mvn clean install -DskipTests",
    "description": "Spring Cloud Config Server"
  }
}
```

### Python Service (Windows)
```json
{
  "execution-service": {
    "type": "python",
    "port": 5002,
    "path": "C:/codebase/lextr/execution-service",
    "command": ".venv\\Scripts\\python.exe -m uvicorn app:app --host 0.0.0.0 --port 5002",
    "description": "Service to handle code execution tasks"
  }
}
```

### Listener Service (Windows)
```json
{
  "execution-service-listener": {
    "type": "listener",
    "path": "C:/codebase/lextr/execution-service",
    "command": "set PYTHONPATH=C:\\codebase\\lextr\\execution-service && .venv\\Scripts\\python.exe utils\\pg_sync_worker.py",
    "stopCommand": "taskkill /f /im python.exe /fi \"WINDOWTITLE eq pg_sync_worker.py*\"",
    "healthCommand": "tasklist /fi \"IMAGENAME eq python.exe\" | findstr python.exe",
    "description": "Execution Service listener"
  }
}
```

## Troubleshooting

### Common Issues

1. **Path not found errors:**
   - Ensure all paths use forward slashes (`/`) or properly escaped backslashes (`\\`)
   - Verify that the base paths in configuration point to existing directories

2. **Python virtual environment not found:**
   - Create virtual environment: `python -m venv .venv`
   - Activate it: `.venv\\Scripts\\activate`
   - Install dependencies: `pip install -r requirements.txt`

3. **Port already in use:**
   - The startup script automatically kills processes on configured ports
   - Manually check with: `netstat -ano | findstr :PORT_NUMBER`
   - Kill process with: `taskkill /f /pid PID_NUMBER`

4. **Maven/Java not found:**
   - Ensure Java and Maven are installed and in your PATH
   - Test with: `java -version` and `mvn -version`

5. **Permission errors:**
   - Run Command Prompt as Administrator if needed
   - Ensure your user has write permissions to the project directory

### Log Files

Logs are written to the `logs/` directory:
- `logs/backend.log` - Backend service logs
- `logs/react-frontend.log` - Frontend logs
- `backend/logs/SERVICE_NAME/` - Individual service logs

### Stopping Services

- **Using the dashboard:** Use the web interface to stop individual services
- **Manual cleanup:** Run `taskkill /f /im node.exe` to stop all Node.js processes
- **Specific port:** `netstat -ano | findstr :PORT` then `taskkill /f /pid PID`

## Access URLs

After successful startup:
- **Frontend:** http://localhost:4005
- **Backend API:** http://localhost:4000
- **Individual services:** Check their configured ports in the services.json

## Support

If you encounter issues:
1. Check the log files in the `logs/` directory
2. Verify all prerequisites are installed
3. Ensure paths in configuration are correct for Windows
4. Make sure ports are not blocked by firewall