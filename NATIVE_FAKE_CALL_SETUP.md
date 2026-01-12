# Native Fake Call Setup Guide

## Overview

Fake calls are now triggered via native Android activity (`FakeCallActivity`) when push notifications are received. This works even when the app is closed or in background.

## How It Works

1. **Firebase Push Notification** → Received by Capacitor PushNotifications plugin
2. **Event Detection** → Checks for `eventType: 'powerCut'`, `'geofence'`, or `'proximity'`
3. **Native Activity** → Starts `FakeCallActivity` via Capacitor plugin
4. **Fake Call UI** → Full-screen native Android activity displays call interface

## Files Created

1. **`android/app/src/main/java/com/almuhafiz/tracker/FakeCallActivity.java`**
   - Native Android activity that displays fake call UI
   - Handles ringtone, vibration, answer/decline
   - Works even when app is closed

2. **`android/app/src/main/java/com/almuhafiz/tracker/FakeCallPlugin.java`**
   - Capacitor plugin bridge to start FakeCallActivity
   - Exposes `startFakeCall()` method to JavaScript

3. **Updated `android/app/src/main/AndroidManifest.xml`**
   - Registered FakeCallActivity
   - Configured to show over lockscreen

## Firebase Notification Format

Your server should send notifications with `eventType` in the data payload:

### Power Cut / Battery Cutoff
```json
{
  "notification": {
    "title": "Battery Cutoff",
    "body": "Vehicle battery has been cut off"
  },
  "data": {
    "eventType": "powerCut",
    "deviceName": "Vehicle 1"
  }
}
```

### Geofence Exit
```json
{
  "notification": {
    "title": "Geofence Exit",
    "body": "Vehicle has exited geofence"
  },
  "data": {
    "eventType": "geofence",
    "deviceName": "Vehicle 1",
    "geofenceName": "Office Area"
  }
}
```

### Proximity Alert (Ignition On)
```json
{
  "notification": {
    "title": "Vehicle Started",
    "body": "Vehicle ignition detected"
  },
  "data": {
    "eventType": "proximity",
    "type": "ignitionOn",
    "deviceName": "Vehicle 1",
    "latitude": "24.8607",
    "longitude": "67.0011"
  }
}
```

## Supported Event Types

- `powerCut` or `powerCutoff` → Battery cutoff alert
- `geofence` or `geofenceExit` → Geofence exit alert  
- `proximity` → Proximity alert (when ignition detected >25m away)

## Installation Steps

1. **Install Capacitor App Plugin** (if not already installed):
   ```bash
   npm install @capacitor/app
   npx cap sync android
   ```

2. **Build and Sync**:
   ```bash
   npm run build
   npx cap sync android
   ```

3. **Rebuild Android App**:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

## Testing

### Test from Push Notification
1. Send Firebase notification with `eventType: 'powerCut'`
2. Fake call should appear immediately (even if app is closed)

### Test from JavaScript Console
```javascript
// Import and call the plugin
import { registerPlugin } from '@capacitor/core';
const FakeCall = registerPlugin('FakeCall');

FakeCall.startFakeCall({
  callerName: 'Test Alert',
  callerNumber: '+92-300-1234-5678',
  alertType: 'batteryCutoff',
  deviceName: 'Test Vehicle',
  message: 'Test message'
});
```

## Features

- ✅ Works when app is closed
- ✅ Works when app is in background
- ✅ Shows over lockscreen
- ✅ Plays ringtone and vibrates
- ✅ Auto-answers after 5 seconds
- ✅ Answer/Decline buttons
- ✅ Shows alert type badge
- ✅ Displays device name and message

## Troubleshooting

### Fake Call Not Showing
1. Check console logs for `[BackgroundNotifications] Triggering native fake call`
2. Verify `eventType` matches: `powerCut`, `geofence`, or `proximity`
3. Ensure app is built with latest code (`npx cap sync android`)
4. Check AndroidManifest.xml has FakeCallActivity registered

### Plugin Not Found Error
1. Run `npx cap sync android` to register plugin
2. Rebuild Android app
3. Check FakeCallPlugin.java is in correct package

### Activity Not Starting
1. Check Android logs: `adb logcat | grep FakeCall`
2. Verify intent extras are being passed correctly
3. Check FakeCallActivity is registered in AndroidManifest.xml

## Code Flow

```
Firebase Push Notification
    ↓
PushNotifications.addListener('pushNotificationReceived')
    ↓
Check eventType (powerCut/geofence/proximity)
    ↓
triggerNativeFakeCallFromPush()
    ↓
FakeCallPlugin.startFakeCall()
    ↓
FakeCallActivity.onCreate()
    ↓
Display Fake Call UI
```

## Notes

- Native activity only works on Android
- iOS will fallback to JavaScript fake call overlay
- Activity shows over lockscreen using FLAG_SHOW_WHEN_LOCKED
- Ringtone uses system default ringtone
- Vibration pattern: [200ms, 100ms, 200ms, 100ms, 200ms]

