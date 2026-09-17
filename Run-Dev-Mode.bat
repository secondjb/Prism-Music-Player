@echo off
title Prism Music Player - Dev Server (HMR)
cd /d %~dp0
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo ===================================================
echo   Starting Prism Music Player in Dev Mode
echo   React Frontend: http://localhost:1420 (Vite HMR)
echo   Rust Backend: Watching src-tauri
echo ===================================================
echo.

call npm run tauri dev
