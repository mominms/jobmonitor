@echo off
title Job Lead Monitor - Ascend/Apex/SocketLogic

echo ===================================================
echo   Starting Job Lead Monitor System...
echo ===================================================

:: 1. Backend Setup
echo.
echo [1/3] Starting Backend (Port 8002)...
cd backend
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt > nul 2>&1
start "Job Monitor API" uvicorn main:app --reload --port 8002

:: 2. Frontend Setup
echo.
echo [2/3] Starting Dashboard (Port 3001)...
cd ..\frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install > nul 2>&1
)
start "Job Monitor Dashboard" npm run dev -- -p 3001

:: 3. Open Browser
echo.
echo [3/3] Launching Browser...
timeout /t 5 > nul
start http://localhost:3001

echo.
echo ===================================================
echo   Job Monitor is running!
echo   Dashboard: http://localhost:3001
echo   Backend:   http://localhost:8002
echo ===================================================
pause
