#!/bin/bash

# Struo React Application Startup Script
# This script starts both the backend API server and React frontend

echo "🚀 Starting Struo React Application..."

# Function to kill processes on script exit
cleanup() {
    echo "🛑 Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "   Backend stopped"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "   Frontend stopped"
    fi
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start backend server
echo "🔧 Starting backend server..."
cd backend
npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! curl -s http://localhost:4000/services > /dev/null; then
    echo "❌ Backend failed to start. Check logs/backend.log"
    exit 1
fi

echo "✅ Backend started on http://localhost:4000"

# Start React frontend
echo "⚛️  Starting React frontend..."
cd react-frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing React dependencies..."
    npm install
fi

npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "✅ React frontend starting on http://localhost:3000"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend (React): http://localhost:3000"
echo "   Backend API:      http://localhost:4000"
echo ""
echo "📝 Logs are written to:"
echo "   Backend:  logs/backend.log"
echo "   Frontend: logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for processes to finish
wait