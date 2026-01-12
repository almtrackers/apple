# Fake Call Debugging Guide

## Testing Fake Calls

### 1. Test from Browser Console (Mobile Device)

Open the browser console on your mobile device and run:

```javascript
// Test battery cutoff alert
testFakeCall('batteryCutoff')

// Test geofence exit alert
testFakeCall('geofenceExit')

// Test proximity alert
testFakeCall('proximity')
```

### 2. Check Console Logs

Look for these log messages to debug:

- `[FakeCallOverlay] Platform:` - Should show 'android' or 'ios', not 'web'
- `[FakeCallOverlay] Setting up subscription` - Confirms overlay is initialized
- `[BackgroundNotifications] Notification received:` - Shows notification data
- `[BackgroundNotifications] Processing notification on mobile platform` - Confirms mobile processing
- `[FakeCall] Starting fake call:` - Shows call is being started
- `[FakeCall] Notifying listeners. Count:` - Shows listener count
- `[FakeCallOverlay] Received call update:` - Shows overlay received the call

### 3. Common Issues

#### Issue: Fake call not showing
**Check:**
1. Are you on a mobile device? (Check `[FakeCallOverlay] Platform:` log)
2. Is the overlay component mounted? (Check `[FakeCallOverlay] Setting up subscription` log)
3. Is the call being triggered? (Check `[FakeCall] Starting fake call:` log)
4. Are listeners registered? (Check `[FakeCall] Notifying listeners. Count:` log)

#### Issue: Notification received but no fake call
**Check:**
1. Notification data format - look for `[BackgroundNotifications] Notification received:` log
2. Alert type matching - check if `data.type`, `data.alarmType`, or `data.eventType` matches expected values
3. Platform check - ensure `[BackgroundNotifications] Processing notification on mobile platform` appears

#### Issue: Fake call shows but no sound/vibration
**Check:**
1. Device volume settings
2. Browser permissions for audio/vibration
3. Check console for audio errors

### 4. Expected Notification Data Format

For fake calls to trigger, Firebase notifications should include:

**Battery Cutoff:**
```json
{
  "data": {
    "type": "alarm",
    "alarm": "batteryCutoff",
    "deviceName": "Vehicle 1"
  }
}
```

**Geofence Exit:**
```json
{
  "data": {
    "type": "geofenceExit",
    "deviceName": "Vehicle 1",
    "geofenceName": "Office Area"
  }
}
```

**Proximity (Ignition On):**
```json
{
  "data": {
    "type": "ignitionOn",
    "deviceName": "Vehicle 1",
    "latitude": "24.8607",
    "longitude": "67.0011"
  }
}
```

### 5. Manual Testing Steps

1. **Test Overlay Component:**
   - Open app on mobile device
   - Open browser console
   - Run `testFakeCall('batteryCutoff')`
   - Fake call should appear immediately

2. **Test Background Notification:**
   - Send Firebase push notification with correct data format
   - Check console logs for processing
   - Fake call should trigger automatically

3. **Test Proximity Alert:**
   - Send ignitionOn notification with device location
   - App will get your current location
   - If distance > 25m, fake call triggers

### 6. Debug Checklist

- [ ] App is running on mobile device (not web)
- [ ] FakeCallOverlay component is in layout.tsx
- [ ] BackgroundNotificationsInitializer is initialized
- [ ] Console shows platform as 'android' or 'ios'
- [ ] Console shows subscription setup
- [ ] Notification data format matches expected structure
- [ ] No errors in console
- [ ] Device has location permission (for proximity alerts)
- [ ] Device has notification permission

### 7. Quick Fixes

If fake call still not working:

1. **Restart the app** - Sometimes state gets stuck
2. **Clear app cache** - Old code might be cached
3. **Check React DevTools** - Verify FakeCallOverlay is mounted
4. **Check Capacitor platform** - Run `Capacitor.getPlatform()` in console
5. **Verify service instance** - Check `fakeCallService.getActiveCall()` in console

