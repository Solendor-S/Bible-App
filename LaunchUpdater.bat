@echo off
cd /d "%~dp0App\updater"
if not exist "node_modules" (
    echo Installing updater dependencies...
    npm install
)
npm run start
