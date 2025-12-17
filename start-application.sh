#!/bin/bash

############################################
# Auto-detect directories
############################################

# Directory where this script is located
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Frontend and Backend directories relative to parent
FRONTEND_DIR="$BASE_DIR/frontend"
REACT_FRONTEND_DIR="$BASE_DIR/react-frontend"
BACKEND_DIR="$BASE_DIR/backend"

# Configurable ports
FRONTEND_PORT=4002
REACT_FRONTEND_PORT=4005
BACKEND_PORT=4000

# Commands
BACKEND_CMD="npm start"
FRONTEND_CMD="npx http-server . -p $FRONTEND_PORT"
REACT_FRONTEND_CMD="npm start"

# Logs location
LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"

# Check command line arguments for starting both frontends
START_BOTH=false
if [ "$1" = "--both" ] || [ "$1" = "-b" ]; then
    START_BOTH=true
fi


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

# Stop backend and both frontends
stop_by_port $BACKEND_PORT
stop_by_port $FRONTEND_PORT
stop_by_port $REACT_FRONTEND_PORT



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

############################################
# START REACT FRONTEND AFTER BACKEND
############################################

start_react_frontend() {
  echo ""
  echo "====================================="
  echo "   Starting React Frontend"
  echo "====================================="

  echo "React Frontend directory: $REACT_FRONTEND_DIR"
  cd "$REACT_FRONTEND_DIR" || exit 1

  # Install dependencies if node_modules doesn't exist
  if [ ! -d "node_modules" ]; then
    echo "📦 Installing React dependencies..."
    npm install
  fi

  nohup $REACT_FRONTEND_CMD > "$LOG_DIR/react-frontend.log" 2>&1 &
  REACT_FRONTEND_PID=$!

  echo "React Frontend started → PID: $REACT_FRONTEND_PID (Port: $REACT_FRONTEND_PORT)"
}

# Always start original frontend
start_frontend

# Always start React frontend
start_react_frontend


############################################
# DONE
############################################

echo ""
echo "====================================="
echo " ALL SERVICES STARTED SUCCESSFULLY "
echo " Logs → $LOG_DIR"
echo "====================================="
echo ""
echo "🌐 Application URLs:"
echo "   Original Frontend: http://localhost:$FRONTEND_PORT"
echo "   React Frontend:    http://localhost:$REACT_FRONTEND_PORT"
echo "   Backend API:       http://localhost:$BACKEND_PORT"
echo ""
echo "📝 Logs are written to:"
echo "   Backend:        $LOG_DIR/backend.log"
echo "   Original Frontend: $LOG_DIR/frontend.log"
echo "   React Frontend:    $LOG_DIR/react-frontend.log"
echo ""
echo "Both frontends are now running simultaneously!"
echo "Choose your preferred interface or compare them side by side."
