#!/bin/bash

############################################
# Auto-detect directories
############################################

# Directory where this script is located
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Frontend and Backend directories relative to parent
FRONTEND_DIR="$BASE_DIR/frontend"
BACKEND_DIR="$BASE_DIR/backend"

# Configurable ports
FRONTEND_PORT=4002
BACKEND_PORT=4000

# Commands
BACKEND_CMD="npm start"
FRONTEND_CMD="npx http-server . -p $FRONTEND_PORT"

# Logs location
LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"


############################################
# Function: stop process on port
############################################
stop_by_port() {
  PORT=$1
  PID=$(lsof -t -i:$PORT)

  if [ -n "$PID" ]; then
    echo "Stopping process on port $PORT (PID $PID)"
    kill -9 $PID 2>/dev/null
  else
    echo "No process running on port $PORT"
  fi
}


############################################
# STOP PREVIOUS INSTANCES
############################################

echo "====================================="
echo "   Stopping Previous Instances"
echo "====================================="

# Stop backend and frontend
stop_by_port $BACKEND_PORT

stop_by_port $FRONTEND_PORT



############################################
# START BACKEND FIRST
############################################

start_backend() {
  echo ""
  echo "====================================="
  echo "   Starting Backend First"
  echo "====================================="

  echo "Backend directory: $BACKEND_DIR"
  cd "$BACKEND_DIR" || exit 1

  nohup $BACKEND_CMD > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!

  echo "Backend started → PID: $BACKEND_PID"
}

start_backend


############################################
# START FRONTEND AFTER BACKEND
############################################

start_frontend() {
  echo ""
  echo "====================================="
  echo "   Starting Frontend After Backend"
  echo "====================================="

  echo "Frontend directory: $FRONTEND_DIR"
  cd "$FRONTEND_DIR" || exit 1

  nohup $FRONTEND_CMD > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!

  echo "Frontend started → PID: $FRONTEND_PID (Port: $FRONTEND_PORT)"
}

start_frontend


############################################
# DONE
############################################

echo ""
echo "====================================="
echo " BOTH SERVICES RESTARTED SUCCESSFULLY "
echo " Logs → $LOG_DIR"
echo "====================================="
