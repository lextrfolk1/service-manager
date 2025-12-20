@echo off
REM ############################################
REM  Struo Service Manager Startup Script (Windows)
REM ############################################

REM Directory where this script is located
set BASE_DIR=%~dp0
set BASE_DIR=%BASE_DIR:~0,-1%

REM React Frontend and Backend directories
set REACT_FRONTEND_DIR=%BASE_DIR%\react-frontend
set BACKEND_DIR=%BASE_DIR%\backend

REM Configurable ports
set REACT_FRONTEND_PORT=4005
set BACKEND_PORT=4000

REM Commands
set BACKEND_CMD=npm start
set REACT_FRONTEND_CMD=npm start

REM Logs location
set LOG_DIR=%BASE_DIR%\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM ############################################
REM Function: cleanup old log files
REM ############################################
echo [94mCleaning up log files older than 2 days...[0m

REM Cleanup main logs directory
if exist "%LOG_DIR%" (
    forfiles /p "%LOG_DIR%" /s /m *.log /d -2 /c "cmd /c del @path" 2>nul
    if %errorlevel% equ 0 (
        echo [92mCleaned up old log files from main logs[0m
    ) else (
        echo [94mNo old log files to clean up in main logs[0m
    )
)

REM Cleanup backend service logs directory
set BACKEND_LOGS_DIR=%BACKEND_DIR%\logs
if exist "%BACKEND_LOGS_DIR%" (
    forfiles /p "%BACKEND_LOGS_DIR%" /s /m *.log /d -2 /c "cmd /c del @path" 2>nul
    if %errorlevel% equ 0 (
        echo [92mCleaned up old service log files[0m
    ) else (
        echo [94mNo old service log files to clean up[0m
    )
    
    REM Remove empty service log directories
    for /f "delims=" %%d in ('dir "%BACKEND_LOGS_DIR%" /ad /b 2^>nul') do (
        dir "%BACKEND_LOGS_DIR%\%%d" /b 2>nul | findstr . >nul || rmdir "%BACKEND_LOGS_DIR%\%%d" 2>nul
    )
)

REM ############################################
REM Function: stop process on port
REM ############################################
:stop_by_port
set PORT=%1
echo [93mChecking for processes on port %PORT%...[0m

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT% 2^>nul') do (
    echo [93mStopping process on port %PORT% (PID %%a)[0m
    taskkill /f /pid %%a >nul 2>&1
)
goto :eof

REM ############################################
REM Function: check and install dependencies
REM ############################################
:install_dependencies
set DIR=%1
set NAME=%2

echo [94mChecking %NAME% dependencies...[0m
cd /d "%DIR%" || exit /b 1

if not exist "node_modules" (
    echo [93mInstalling %NAME% dependencies...[0m
    call npm install
    if %errorlevel% equ 0 (
        echo [92m%NAME% dependencies installed successfully[0m
    ) else (
        echo [91mFailed to install %NAME% dependencies[0m
        exit /b 1
    )
) else (
    echo [92m%NAME% dependencies already installed[0m
)
goto :eof

REM ############################################
REM STOP PREVIOUS INSTANCES
REM ############################################

echo [94m=====================================
echo    Stopping Previous Instances
echo =====================================[0m

REM Stop backend and React frontend
call :stop_by_port %BACKEND_PORT%
call :stop_by_port %REACT_FRONTEND_PORT%

REM ############################################
REM INSTALL DEPENDENCIES
REM ############################################

echo.
echo [94m=====================================
echo    Installing Dependencies
echo =====================================[0m

REM Install backend dependencies
call :install_dependencies "%BACKEND_DIR%" "Backend"

REM Install React frontend dependencies  
call :install_dependencies "%REACT_FRONTEND_DIR%" "React Frontend"

REM ############################################
REM START BACKEND FIRST
REM ############################################

echo.
echo [94m=====================================
echo    Starting Backend Server
echo =====================================[0m

echo [94mBackend directory: %BACKEND_DIR%[0m
cd /d "%BACKEND_DIR%" || exit /b 1

start /b cmd /c "%BACKEND_CMD% > "%LOG_DIR%\backend.log" 2>&1"

echo [92mBackend started[0m

REM Wait for backend to be ready
echo [93mWaiting for backend to start...[0m
timeout /t 3 /nobreak >nul

REM Check if backend is responding
curl -s http://localhost:%BACKEND_PORT%/services >nul 2>&1
if %errorlevel% equ 0 (
    echo [92mBackend is ready and responding[0m
) else (
    echo [93mBackend may still be starting up[0m
)

REM ############################################
REM START REACT FRONTEND AFTER BACKEND
REM ############################################

echo.
echo [94m=====================================
echo    Starting React Frontend
echo =====================================[0m

echo [94mReact Frontend directory: %REACT_FRONTEND_DIR%[0m
cd /d "%REACT_FRONTEND_DIR%" || exit /b 1

start /b cmd /c "%REACT_FRONTEND_CMD% > "%LOG_DIR%\react-frontend.log" 2>&1"

echo [92mReact Frontend started (Port: %REACT_FRONTEND_PORT%)[0m

REM ############################################
REM DONE
REM ############################################

echo.
echo [92m=====================================
echo  ALL SERVICES STARTED SUCCESSFULLY 
echo  Logs → %LOG_DIR%
echo =====================================[0m
echo.
echo [94mApplication URLs:[0m
echo    [92mReact Frontend:    http://localhost:%REACT_FRONTEND_PORT%[0m
echo    [92mBackend API:       http://localhost:%BACKEND_PORT%[0m
echo.
echo [94mLogs are written to:[0m
echo    Backend:        %LOG_DIR%\backend.log
echo    React Frontend: %LOG_DIR%\react-frontend.log
echo.
echo [92mStruo Service Manager is now running[0m
echo [93mServices are running independently. Use Task Manager or the dashboard to stop them.[0m

pause