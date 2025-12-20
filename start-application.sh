#!/bin/bash

############################################
 # Struo Service Manager Startup Script
############################################

# Directory where this script is located
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

# React Frontend and Backend directories
REACT_FRONTEND_DIR="$BASE_DIR/react-frontend"
BACKEND_DIR="$BASE_DIR/backend"

# Configurable ports
REACT_FRONTEND_PORT=4005
BACKEND_PORT=4000

# Commands
BACKEND_CMD="npm start"
REACT_FRONTEND_CMD="npm start"

# Logs location
LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

############################################
# Function: stop process on port
############################################
stop_by_port() {
  PORT=$1
  PID=$(lsof -t -i:$PORT 2>/dev/null)

  if [ -n "$PID" ]; then
    echo -e "${YELLOW}Stopping process on port $PORT (PID $PID)${NC}"
    kill -9 $PID 2>/dev/null
  else
    echo -e "${BLUE}No process running on port $PORT${NC}"
  fi
}

############################################
# Function: check and install dependencies
############################################
install_dependencies() {
  DIR=$1
  NAME=$2
  
  echo -e "${BLUE}Checking $NAME dependencies...${NC}"
  cd "$DIR" || exit 1
  
  if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    echo -e "${YELLOW}Installing $NAME dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}$NAME dependencies installed successfully${NC}"
    else
      echo -e "${RED}Failed to install $NAME dependencies${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}$NAME dependencies already installed${NC}"
  fi
}

############################################
# STOP PREVIOUS INSTANCES
############################################

echo -e "${BLUE}====================================="
echo -e "   Stopping Previous Instances"
echo -e "=====================================${NC}"

# Stop backend and React frontend
stop_by_port $BACKEND_PORT
stop_by_port $REACT_FRONTEND_PORT

############################################
# INSTALL DEPENDENCIES
############################################

echo -e "\n${BLUE}====================================="
echo -e "   Installing Dependencies"
echo -e "=====================================${NC}"

# Install backend dependencies
install_dependencies "$BACKEND_DIR" "Backend"

# Install React frontend dependencies  
install_dependencies "$REACT_FRONTEND_DIR" "React Frontend"

############################################
# START BACKEND FIRST
############################################

start_backend() {
  echo -e "\n${BLUE}====================================="
  echo -e "   Starting Backend Server"
  echo -e "=====================================${NC}"

  echo -e "${BLUE}Backend directory: $BACKEND_DIR${NC}"
  cd "$BACKEND_DIR" || exit 1

  nohup $BACKEND_CMD > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!

  echo -e "${GREEN}Backend started → PID: $BACKEND_PID${NC}"
  
  # Wait for backend to be ready
  echo -e "${YELLOW}Waiting for backend to start...${NC}"
  sleep 3
  
  # Check if backend is responding
  if curl -s http://localhost:$BACKEND_PORT/services > /dev/null 2>&1; then
    echo -e "${GREEN}Backend is ready and responding${NC}"
  else
    echo -e "${YELLOW}Backend may still be starting up${NC}"
  fi
}

start_backend

############################################
# START REACT FRONTEND AFTER BACKEND
############################################

start_react_frontend() {
  echo -e "\n${BLUE}====================================="
  echo -e "   Starting React Frontend"
  echo -e "=====================================${NC}"

  echo -e "${BLUE}React Frontend directory: $REACT_FRONTEND_DIR${NC}"
  cd "$REACT_FRONTEND_DIR" || exit 1

  nohup $REACT_FRONTEND_CMD > "$LOG_DIR/react-frontend.log" 2>&1 &
  REACT_FRONTEND_PID=$!

  echo -e "${GREEN}React Frontend started → PID: $REACT_FRONTEND_PID (Port: $REACT_FRONTEND_PORT)${NC}"
}

# Start React frontend
start_react_frontend

############################################
# DONE
############################################

echo -e "\n${GREEN}====================================="
echo -e " ALL SERVICES STARTED SUCCESSFULLY "
echo -e " Logs → $LOG_DIR"
echo -e "=====================================${NC}"
echo ""
echo -e "${BLUE}Application URLs:${NC}"
echo -e "   ${GREEN}React Frontend:    http://localhost:$REACT_FRONTEND_PORT${NC}"
echo -e "   ${GREEN}Backend API:       http://localhost:$BACKEND_PORT${NC}"
echo ""
echo -e "${BLUE}Logs are written to:${NC}"
echo -e "   Backend:        $LOG_DIR/backend.log"
echo -e "   React Frontend: $LOG_DIR/react-frontend.log"
echo ""
echo -e "${GREEN}Struo Service Manager is now running${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${BLUE}   Backend stopped${NC}"
    fi
    if [ ! -z "$REACT_FRONTEND_PID" ]; then
        kill $REACT_FRONTEND_PID 2>/dev/null
        echo -e "${BLUE}   React Frontend stopped${NC}"
    fi
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes to finish
wait
