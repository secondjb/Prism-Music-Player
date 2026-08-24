@echo off
title Prism Music Player
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

if exist "Prism Music Player.exe" (
    echo Starting Prism Music Player...
    start "" "Prism Music Player.exe"
) else if exist "src-tauri\target\release\Prism Music Player.exe" (
    echo Starting Prism Music Player Release Build...
    start "" "src-tauri\target\release\Prism Music Player.exe"
) else (
    echo Starting Prism Music Player Dev Server...
    npm run tauri dev
)
