@echo off
echo ========================================
echo Building AL-MUHAFIZ APK
echo ========================================
echo.

echo Step 1: Building Next.js application...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)
echo.

echo Step 2: Syncing Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo Sync failed!
    pause
    exit /b %errorlevel%
)
echo.

echo Step 3: Building Android APK...
cd android
call gradlew.bat clean
call gradlew.bat assembleRelease
if %errorlevel% neq 0 (
    echo APK build failed!
    cd ..
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo ========================================
echo APK built successfully!
echo ========================================
echo.
echo APK Location:
echo android\app\build\outputs\apk\release\app-release.apk
echo.
echo To install on connected device:
echo adb install android\app\build\outputs\apk\release\app-release.apk
echo.
pause

