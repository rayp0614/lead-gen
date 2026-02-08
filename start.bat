@echo off
echo Starting DDSScraper...
echo.

:: Start backend in background
start "Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\activate && uvicorn main:app --reload"

:: Wait a moment for backend to start
timeout /t 3 /nobreak > nul

:: Start frontend
start "Frontend" cmd /k "cd /d %~dp0\NPResearch\NPResearch && npm run dev"

echo.
echo Both servers starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Close both terminal windows to stop.
