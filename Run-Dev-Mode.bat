@echo off
title Prism Music Player - Dev Server (HMR)
cd /d %~dp0
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

set LOG_FILE=dev-output.log

echo ===================================================
echo   Starting Prism Music Player in Dev Mode
echo   React Frontend: http://localhost:1420 (Vite HMR)
echo   Rust Backend: Watching src-tauri
echo   Logging output to: %LOG_FILE%
echo ===================================================
echo.

call node scripts\patch-revogrid.js
call npm run tauri dev 2>&1 | node scripts\tee.js "%LOG_FILE%"
