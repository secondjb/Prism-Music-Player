@echo off
title Build Android Release - Prism Music Player
cd /d "%~dp0"

:: Set Java 17+ environment for Android Gradle Plugin
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.4.7-hotspot" (
    set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.4.7-hotspot"
) else if exist "C:\Program Files\Microsoft\jdk-25.0.3.9-hotspot" (
    set "JAVA_HOME=C:\Program Files\Microsoft\jdk-25.0.3.9-hotspot"
)
if defined JAVA_HOME (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

echo ===================================================
echo   Extracting Version Number from package.json...
echo ===================================================
for /f %%a in ('powershell -Command "(Get-Content package.json | ConvertFrom-Json).version"') do set VERSION=%%a
if "%VERSION%"=="" set VERSION=0.1.0

echo Application Version: v%VERSION%
if defined JAVA_HOME echo Using JAVA_HOME: %JAVA_HOME%
echo.

echo ===================================================
echo   Compiling Prism Music Player Android Release APK...
echo ===================================================
echo.

call npx tauri android build --apk

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Android build failed! Check log output above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   Copying Android APK to release directory...
echo ===================================================

if not exist "release" mkdir release

set "FOUND_APK="

:: Check universal & arm64 APK output paths
if exist "src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk" (
    set "SOURCE_APK=src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk"
    set "FOUND_APK=1"
) else if exist "src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release.apk" (
    set "SOURCE_APK=src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release.apk"
    set "FOUND_APK=1"
)

if defined FOUND_APK (
    copy /y "%SOURCE_APK%" "release\app-release.apk"
    copy /y "%SOURCE_APK%" "release\Prism-Music-Player-v%VERSION%.apk"
    echo.
    echo [SUCCESS] Android APK exported to:
    echo   - release\app-release.apk
    echo   - release\Prism-Music-Player-v%VERSION%.apk
) else (
    echo.
    echo [WARNING] Could not find output APK in standard build directory.
    echo Searching for any compiled .apk in src-tauri\gen\android...
    for /r "src-tauri\gen\android" %%f in (*-release.apk *.apk) do (
        copy /y "%%f" "release\Prism-Music-Player-v%VERSION%.apk"
        copy /y "%%f" "release\app-release.apk"
        echo [SUCCESS] Exported %%~nxf to release directory.
    )
)

echo.
echo ===================================================
echo   Android Release Build Complete!
echo ===================================================
echo.
pause
