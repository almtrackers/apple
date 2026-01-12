# Building Android APK - Step by Step Guide

## Prerequisites
- Node.js installed
- Android Studio installed (for Gradle build)
- Java JDK installed
- Android SDK configured

## Step 1: Build Next.js Application

Build the Next.js app and sync with Capacitor:

```bash
npm run build
```

This will:
- Build your Next.js app
- Output to `out/` directory
- Automatically run `npx cap sync` (via postbuild script)

## Step 2: Sync Capacitor (if needed separately)

If you need to sync manually:

```bash
npm run cap:sync
```

Or use the full build script:

```bash
npm run app:build:android
```

This runs:
- `npm run build` - Build Next.js app
- `npm run assets:generate` - Generate app icons/assets
- `npx cap sync` - Sync web assets to Android

## Step 3: Update Version Number (Important!)

Before building the APK, update the version in `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 10  // Increment this number
    versionName "1.0.6"  // Update version name
}
```

**Note:** `versionCode` must be incremented for each new release. It's currently at `9`.

## Step 4: Build APK

### Option A: Using Gradle (Command Line)

```bash
cd android
./gradlew assembleRelease
```

Or on Windows:
```bash
cd android
gradlew.bat assembleRelease
```

The APK will be generated at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Option B: Using Android Studio

1. Open Android Studio
2. File → Open → Select the `android` folder
3. Wait for Gradle sync to complete
4. Build → Build Bundle(s) / APK(s) → Build APK(s)
5. Wait for build to complete
6. The APK location will be shown in a notification

### Option C: Build AAB (Android App Bundle) for Play Store

```bash
cd android
./gradlew bundleRelease
```

The AAB will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## Step 5: Sign the APK (if not already signed)

If you have a keystore file, you need to configure signing in `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('path/to/your/keystore.jks')
            storePassword 'your-store-password'
            keyAlias 'your-key-alias'
            keyPassword 'your-key-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

## Quick Build Script

You can create a simple script to automate the process:

### Windows (build-apk.bat)
```batch
@echo off
echo Building Next.js app...
call npm run build
echo.
echo Syncing Capacitor...
call npx cap sync android
echo.
echo Building APK...
cd android
call gradlew.bat assembleRelease
cd ..
echo.
echo APK built successfully!
echo Location: android/app/build/outputs/apk/release/app-release.apk
pause
```

### Linux/Mac (build-apk.sh)
```bash
#!/bin/bash
echo "Building Next.js app..."
npm run build
echo ""
echo "Syncing Capacitor..."
npx cap sync android
echo ""
echo "Building APK..."
cd android
./gradlew assembleRelease
cd ..
echo ""
echo "APK built successfully!"
echo "Location: android/app/build/outputs/apk/release/app-release.apk"
```

## Troubleshooting

### Build Fails with Gradle Errors
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

### Clear Build Cache
```bash
cd android
./gradlew clean
rm -rf app/build
cd ..
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

### Version Code Already Used Error
- Increment `versionCode` in `android/app/build.gradle`

### Missing Dependencies
```bash
npm install
cd android
./gradlew clean
./gradlew assembleRelease
```

## Current Changes Included in APK

After rebuilding, the APK will include:
- ✅ FCM token registration for Android (stores in `notificationTokens` attribute)
- ✅ Multiple token support (keeps last 2 + new token)
- ✅ Proper error handling and logging
- ✅ WebSocket notifications (for web platform - already handled)
- ✅ All your latest code changes

## Testing the APK

1. Install on device:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

2. Or manually transfer APK to device and install

3. Check logs for FCM registration:
   ```bash
   adb logcat | grep FCM
   ```

## Important Notes

- **Version Code**: Must be incremented for each new release
- **Signing**: APK must be signed for release (debug builds are auto-signed)
- **Permissions**: Ensure notification permissions are granted in AndroidManifest.xml
- **Firebase**: Ensure `google-services.json` is in `android/app/` directory

