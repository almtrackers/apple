#!/bin/bash

echo "========================================"
echo "Building Android App Bundle (.aab) for Play Store"
echo "========================================"
echo ""

echo "Step 1: Building Next.js app..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi
echo ""

echo "Step 2: Generating Android assets..."
npm run assets:generate
if [ $? -ne 0 ]; then
    echo "Assets generation failed!"
    exit 1
fi
echo ""

echo "Step 3: Syncing Capacitor..."
npx cap sync android
if [ $? -ne 0 ]; then
    echo "Capacitor sync failed!"
    exit 1
fi
echo ""

echo "Step 4: Building Android App Bundle (.aab)..."
cd android
./gradlew bundleRelease
if [ $? -ne 0 ]; then
    echo "AAB build failed!"
    cd ..
    exit 1
fi
cd ..
echo ""

echo "========================================"
echo "Build completed successfully!"
echo "========================================"
echo ""
echo "AAB Location: android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "You can now upload this file to Google Play Console."
echo ""

