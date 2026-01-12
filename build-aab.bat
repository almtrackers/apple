@echo off
echo ========================================
echo Building Android App Bundle (.aab) for Play Store
echo ========================================
echo.

echo Step 1: Building Next.js app...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)
echo.

echo Step 2: Generating Android assets...
call npm run assets:generate
if %errorlevel% neq 0 (
    echo Assets generation failed!
    pause
    exit /b %errorlevel%
)
echo.

echo Step 3: Syncing Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo Capacitor sync failed!
    pause
    exit /b %errorlevel%
)
echo.

echo Step 4: Building Android App Bundle (.aab)...
cd android
call gradlew.bat bundleRelease
if %errorlevel% neq 0 (
    echo AAB build failed!
    cd ..
    pause
    exit /b %errorlevel%
)
cd ..
echo.

echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo AAB Location: android\app\build\outputs\bundle\release\app-release.aab
echo.
echo You can now upload this file to Google Play Console.
echo.
pause

