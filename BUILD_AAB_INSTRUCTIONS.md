# Building Android App Bundle (.aab) for Google Play Store

## Quick Build

### Windows
```bash
npm run android:aab
```

Or use the batch script:
```bash
build-aab.bat
```

### Linux/Mac
```bash
npm run build && npm run assets:generate && npx cap sync && cd android && ./gradlew bundleRelease
```

## Step-by-Step Process

### 1. Build Next.js App
```bash
npm run build
```
This builds your Next.js app (including PWA features) and outputs to `out/` directory.

### 2. Generate Android Assets
```bash
npm run assets:generate
```
Generates app icons and splash screens for Android.

### 3. Sync Capacitor
```bash
npx cap sync android
```
Syncs web assets to Android project.

### 4. Build AAB
```bash
cd android
gradlew.bat bundleRelease  # Windows
# or
./gradlew bundleRelease     # Linux/Mac
```

The AAB will be generated at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## Important Notes

### Version Updates
Before each release, update in `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 19  // Increment this (currently 18)
    versionName "1.1.7"  // Update version name
}
```

### Signing
The AAB must be signed for Play Store upload. Ensure you have:
- Keystore file configured in `android/app/build.gradle`
- Or use Play App Signing (recommended) - Google manages signing

### PWA vs Native Build
- **PWA**: For web/iOS installation (uses service worker, manifest)
- **Native Android**: For Google Play Store (uses Capacitor, native Android code)
- **Both work together**: PWA features are included in the native build!

## Uploading to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **Release** → **Production** (or Testing track)
4. Click **Create new release**
5. Upload `app-release.aab`
6. Fill in release notes
7. Review and publish

## Troubleshooting

### Build Fails
```bash
cd android
gradlew.bat clean
cd ..
npm run build
npx cap sync android
cd android
gradlew.bat bundleRelease
```

### Version Code Error
- Increment `versionCode` in `android/app/build.gradle`
- Each upload to Play Store requires a higher version code

### Missing Dependencies
```bash
npm install
cd android
gradlew.bat clean
gradlew.bat bundleRelease
```

## Current Configuration

- **App ID**: `com.almuhafiz.tracker`
- **Version Code**: 18
- **Version Name**: 1.1.6
- **Min SDK**: Configured in `android/variables.gradle`
- **Target SDK**: Configured in `android/variables.gradle`

## What's Included

The AAB includes:
- ✅ All Next.js app code (including PWA features)
- ✅ Capacitor plugins (Geolocation, Push Notifications, etc.)
- ✅ Firebase messaging for push notifications
- ✅ Native Android features
- ✅ Service worker and PWA manifest (for web features in the app)

## Testing Before Upload

1. Build APK for testing:
   ```bash
   npm run android:apk
   ```
2. Install on device:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```
3. Test all features
4. If everything works, build AAB and upload

