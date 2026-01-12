# Fake Call Feature Documentation

## Overview

The Fake Call feature simulates incoming phone calls for critical alerts. This provides a discreet way to alert users about important events like battery cutoff, geofence exits, and proximity alerts.

## Features

- **Realistic Phone Call UI**: Full-screen overlay that looks like a real incoming call
- **Ringtone & Vibration**: Plays ringtone and vibrates when call comes in
- **Auto-Answer**: Automatically answers after 5 seconds if not manually answered/declined
- **Alert-Specific Caller Info**: Different caller names and numbers for different alert types

## Supported Alert Types

### 1. Battery Cutoff Alert
- **Trigger**: When device sends `batteryCutoff` or `powerCutoff` alarm
- **Caller Name**: `{DeviceName} Alert` or `Vehicle Alert`
- **Caller Number**: Format `+92-300-XXXX-XXXX`

### 2. Geofence Exit Alert
- **Trigger**: When device exits a geofence
- **Caller Name**: `{DeviceName} Security` or `Security Alert`
- **Caller Number**: Format `+92-321-XXXX-XXXX`

### 3. Proximity Alert
- **Trigger**: When vehicle ignition is detected and user is more than 25 meters away
- **Caller Name**: `{DeviceName} Proximity` or `Proximity Alert`
- **Caller Number**: Format `+92-333-XXXX-XXXX`

## How It Works

### 1. Alert Detection
- Battery cutoff and geofence exit alerts are detected in `websocket-context.tsx`
- Proximity alerts are detected in `use-location-ignition-alert.ts`

### 2. Fake Call Trigger
When an alert is detected, the system:
1. Generates caller information based on alert type
2. Starts the fake call service
3. Displays the call overlay
4. Plays ringtone and vibrates

### 3. User Interaction
- **Answer**: Tap the green answer button (or wait 5 seconds for auto-answer)
- **Decline**: Tap the red decline button
- **Auto-Answer**: Call automatically answers after 5 seconds

## Implementation Details

### Files Created

1. **`src/lib/fake-call-service.ts`**
   - Core service managing fake call state
   - Handles ringtone, vibration, and call lifecycle
   - Singleton pattern for global access

2. **`src/components/fake-call-overlay.tsx`**
   - React component displaying the call UI
   - Handles user interactions (answer/decline)
   - Shows caller info and alert type

### Integration Points

1. **`src/app/layout.tsx`**
   - Added `<FakeCallOverlay />` component to root layout

2. **`src/contexts/websocket-context.tsx`**
   - Added fake call trigger for battery cutoff and geofence exit
   - Integrated in `handleEventNotification` function

3. **`src/hooks/use-location-ignition-alert.ts`**
   - Added fake call trigger for proximity alerts
   - Integrated in `checkLocationAndAlert` function

## Usage

### Automatic Triggering
Fake calls are automatically triggered when:
- Battery cutoff alarm is received
- Geofence exit event occurs
- Proximity alert is triggered (vehicle started >25m away)

### Manual Triggering (for testing)
```typescript
import { fakeCallService } from '@/lib/fake-call-service';

// Trigger a fake call
fakeCallService.startCall({
  callerName: 'Test Alert',
  callerNumber: '+92-300-1234-5678',
  alertType: 'batteryCutoff',
  deviceName: 'Test Vehicle',
  message: 'This is a test alert',
});
```

## Customization

### Change Ringtone
1. Add a ringtone file to `public/ringtone.mp3`
2. Update `fake-call-service.ts`:
   ```typescript
   this.ringtoneAudio.src = '/ringtone.mp3';
   ```

### Change Auto-Answer Delay
In `fake-call-service.ts`:
```typescript
setTimeout(() => {
  if (this.activeCall && this.isRinging) {
    this.answerCall();
  }
}, 5000); // Change 5000 to desired milliseconds
```

### Customize Caller Info Format
In `fake-call-service.ts`, modify `generateCallerInfo` method:
```typescript
static generateCallerInfo(alertType: string, deviceName?: string): { name: string; number: string } {
  // Customize name and number format here
}
```

## Mobile vs Web

### Mobile (Capacitor)
- ✅ Full-screen overlay
- ✅ Vibration support
- ✅ Ringtone playback
- ✅ Works when app is in background (with proper permissions)

### Web
- ✅ Full-screen overlay
- ⚠️ Vibration (if browser supports)
- ✅ Ringtone playback
- ⚠️ May not work when tab is inactive (browser restrictions)

## Troubleshooting

### Call Not Showing
- Check browser console for errors
- Verify alert is being triggered
- Check if another call is already active (only one call at a time)

### No Sound
- Check browser/device volume
- Verify audio permissions
- Check if ringtone file exists (if using custom ringtone)

### No Vibration
- Check device vibration settings
- Verify app has vibration permission (Android)
- Vibration may not work on all devices/browsers

## Security & Privacy

- Fake calls are displayed locally only
- No actual phone calls are made
- No data is sent to external services
- Caller numbers are randomly generated

## Future Enhancements

Potential improvements:
- [ ] Settings to enable/disable fake calls per alert type
- [ ] Custom ringtones per alert type
- [ ] Call history/log
- [ ] Multiple simultaneous calls support
- [ ] Custom caller names/numbers in settings
- [ ] Background call support (service worker)

## Testing

To test fake calls:

1. **Battery Cutoff**: Send a test alarm with type `batteryCutoff` or `powerCutoff`
2. **Geofence Exit**: Trigger a geofence exit event for a device
3. **Proximity Alert**: Start vehicle ignition when user is >25m away

## Notes

- Only one fake call can be active at a time
- Calls automatically end after being answered for 3 seconds
- Call overlay has highest z-index (9999) to appear above all content
- Works best on mobile devices for full experience

