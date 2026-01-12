#!/bin/bash

echo "========================================"
echo "Building AL-MUHAFIZ APK"
echo "========================================"
echo ""

echo "Step 1: Building Next.js application..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi
echo ""

echo "Step 2: Syncing Capacitor..."
npx cap sync android
if [ $? -ne 0 ]; then
    echo "Sync failed!"
    exit 1
fi
echo ""

echo "Step 3: Building Android APK..."
cd android
./gradlew clean
./gradlew assembleRelease
if [ $? -ne 0 ]; then
    echo "APK build failed!"
    cd ..
    exit 1
fi
cd ..

echo ""
echo "========================================"
echo "APK built successfully!"
echo "========================================"
echo ""
echo "APK Location:"
echo "android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "To install on connected device:"
echo "adb install android/app/build/outputs/apk/release/app-release.apk"
echo ""

