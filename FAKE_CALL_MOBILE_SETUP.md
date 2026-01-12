# Fake Call Mobile Setup - Firebase Push Notifications

## Overview

Fake calls now work **ONLY on mobile devices** and are triggered via **Firebase push notifications**. This ensures they work even when:
- User is logged out
- App is in background
- App is closed

## How It Works

### 1. Firebase Push Notification Flow

When the server sends a Firebase push notification with specific alert types:

1. **Notification Received** → Capacitor PushNotifications plugin receives it
2. **Background Handler** → `handleBackgroundNotification()` processes it
3. **Alert Detection** → Checks notification data for alert type
4. **Fake Call Trigger** → Starts fake call if alert matches criteria

### 2. Supported Alert Types

#### A. Ignition On (Proximity Alert)
- **Notification Data**: `{ type: 'ignitionOn', latitude, longitude, deviceName }`
- **Process**:
  1. Gets mobile's current location using Capacitor Geolocation
  2. Calculates distance between device and mobile
  3. If distance > 25 meters → Triggers fake call

#### B. Geofence Exit
- **Notification Data**: `{ type: 'geofenceExit', deviceName, geofenceName }`
- **Process**: Immediately triggers fake call

#### C. Battery Cutoff / Power Cutoff
- **Notification Data**: `{ type: 'alarm', alarm: 'batteryCutoff' }` OR `{ alarmType: 'batteryCutoff' }`
- **Process**: Immediately triggers fake call

## Server-Side Requirements

Your Traccar server must send Firebase push notifications with the following data structure:

### Ignition On Notification
```json
{
  "notification": {
    "title": "Vehicle Started",
    "body": "Vehicle ignition detected"
  },
  "data": {
    "type": "ignitionOn",
    "deviceId": "123",
    "deviceName": "Vehicle 1",
    "latitude": "24.8607",
    "longitude": "67.0011"
  }
}
```

### Geofence Exit Notification
```json
{
  "notification": {
    "title": "Geofence Exit",
    "body": "Vehicle has exited geofence"
  },
  "data": {
    "type": "geofenceExit",
    "deviceId": "123",
    "deviceName": "Vehicle 1",
    "geofenceName": "Office Area"
  }
}
```

### Battery Cutoff Notification
```json
{
  "notification": {
    "title": "Battery Cutoff",
    "body": "Vehicle battery has been cut off"
  },
  "data": {
    "type": "alarm",
    "alarm": "batteryCutoff",
    "deviceId": "123",
    "deviceName": "Vehicle 1"
  }
}
```

**OR**

```json
{
  "data": {
    "alarmType": "batteryCutoff",
    "deviceId": "123",
    "deviceName": "Vehicle 1"
  }
}
```

## Mobile-Only Implementation

### Platform Check
All fake call functionality includes platform checks:
```typescript
if (Capacitor.getPlatform() === 'web') {
  return; // Skip on web
}
```

### Components
- `FakeCallOverlay` - Only renders on mobile
- `fakeCallService.startCall()` - Only works on mobile
- Background notification handlers - Only process on mobile

## Background Processing

### Location Permission
- App requests location permission on first use
- Permission is checked before getting location
- If permission denied, alert is stored for processing when app opens

### Location Access
- Uses Capacitor Geolocation plugin
- Works in background (Android/iOS background location)
- Falls back to storing alert if location unavailable

## Testing

### Test Ignition On Alert
1. Send Firebase notification with `type: 'ignitionOn'`
2. Include device location in notification
3. App will get mobile location and check distance
4. If > 25m, fake call will trigger

### Test Geofence Exit
1. Send Firebase notification with `type: 'geofenceExit'`
2. Fake call should trigger immediately

### Test Battery Cutoff
1. Send Firebase notification with `alarm: 'batteryCutoff'`
2. Fake call should trigger immediately

## Permissions Required

### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

### iOS (Info.plist)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to check proximity alerts</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location to check proximity alerts in background</string>
```

## Troubleshooting

### Fake Call Not Triggering
1. Check if notification data structure matches expected format
2. Verify app is on mobile device (not web)
3. Check console logs for errors
4. Verify location permission is granted (for proximity alerts)

### Location Not Available
- Check location permissions in device settings
- Verify GPS is enabled
- Check if app has background location permission
- Alert will be stored and processed when app opens

### Background Not Working
- Verify Firebase Cloud Messaging is properly configured
- Check Capacitor PushNotifications plugin is installed
- Verify notification handlers are registered
- Check Android/iOS background restrictions

## Code Flow

```
Firebase Push Notification
    ↓
Capacitor PushNotifications Plugin
    ↓
handleBackgroundNotification()
    ↓
Check Alert Type
    ↓
┌─────────────────┬──────────────────┬──────────────────┐
│ Ignition On     │ Geofence Exit    │ Battery Cutoff    │
│                 │                  │                   │
│ Get Location    │ Trigger Call     │ Trigger Call      │
│ Check Distance  │                  │                   │
│ Trigger Call    │                  │                   │
│ (if > 25m)      │                  │                   │
└─────────────────┴──────────────────┴──────────────────┘
    ↓
fakeCallService.startCall()
    ↓
FakeCallOverlay Displayed
```

## Notes

- Fake calls only work on mobile devices (Android/iOS)
- Web platform is completely skipped
- Works independently of authentication state
- Background location requires proper permissions
- Falls back gracefully if location unavailable

