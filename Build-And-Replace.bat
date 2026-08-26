@echo off
title Build & Update Prism Music Player
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo ===================================================
echo   Compiling Prism Music Player Release Build...
echo ===================================================
echo.

call npm run tauri build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed! Check log output above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   Replacing Root Binary with New Release Build...
echo ===================================================

:: Terminate running instance if open so file can be overwritten
taskkill /f /im "Prism Music Player.exe" 2>nul

set "SOURCE_EXE=src-tauri\target\release\Prism Music Player.exe"
if not exist "%SOURCE_EXE%" (
    set "SOURCE_EXE=src-tauri\target\release\prism_music_player.exe"
)

if exist "%SOURCE_EXE%" (
    copy /y "%SOURCE_EXE%" "Prism Music Player.exe"
    echo.
    echo [SUCCESS] Root binary updated: "Prism Music Player.exe"
) else (
    echo.
    echo [ERROR] Compiled binary not found in release output directory.
    pause
    exit /b 1
)

echo.
pause
