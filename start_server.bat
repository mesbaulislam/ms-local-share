@echo off
REM MS Local Transfer - Windows starter
REM Double-click this file to start the server.
title MS Local Transfer
cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
  echo Python is not installed or not in PATH.
  echo Install Python 3 from https://www.python.org/downloads/
  echo Tick "Add Python to PATH" during installation, then run this file again.
  pause
  exit /b 1
)

if not exist "uploads" mkdir uploads

REM Install dependencies on first run (skipped if already installed)
python -m pip install -r requirements.txt

echo.
echo Starting MS Local Transfer...
echo Open the URL shown below on your Android phone,
echo and the /receiver URL on your KaiOS phone.
echo.
python server.py
pause
