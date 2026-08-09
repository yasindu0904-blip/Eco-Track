@echo off
REM EcoTrack SRS Mockup - Quick Start Script for Windows

echo.
echo 🌱 EcoTrack SRS Mockup - Quick Start
echo ====================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install Node.js 16+
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js version: %NODE_VERSION%

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm not found. Please install npm
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm version: %NPM_VERSION%
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)

echo ✅ Dependencies installed
echo.

REM Start development server
echo 🚀 Starting development server...
echo.
echo The app will be available at: http://127.0.0.1:5173
echo.
echo To generate screenshots in another terminal, run:
echo   npm run test:screenshot
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run dev

pause
