@echo off
setlocal
set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"

title AssignCheck server - do not close this window
cd /d "%APPDIR%"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Python not found. Install from https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)

echo.
echo   ============================================
echo     AssignCheck is running
echo.
echo     Open:  http://localhost:5599
echo     Folder: %APPDIR%
echo.
echo     * Keep this window open while using the app
echo     * Press Ctrl+C or close this window to stop
echo   ============================================
echo.

start "" http://localhost:5599
python -m http.server 5599 --directory "%APPDIR%"
