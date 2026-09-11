@echo off
echo ===================================================
echo 🛡️  NEXUS: Starting GIS Command Center Dashboard...
echo ===================================================
cd /d "%~dp0frontend"

if not exist "node_modules\" (
    echo [NEXUS] Installing frontend dependencies...
    call npm install
)

echo [NEXUS] Launching dashboard at http://localhost:3000 ...
call npm run dev
pause
