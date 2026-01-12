package com.almuhafiz.tracker;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize notification channel with custom sound at app startup
        // This ensures the channel is ready before any notifications are received
        // and works even when the app is in background or screen is off
        NotificationChannelHelper.initializeChannel(this);
        
        // Check if app was opened from a notification click
        handleNotificationIntent(getIntent());
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }
    
    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        
        // Check if this intent came from a notification
        Bundle extras = intent.getExtras();
        if (extras == null) return;
        
        Log.d(TAG, "Checking notification intent extras...");
        
        // Extract notification data
        String eventType = extras.getString("eventType");
        String alarmType = extras.getString("alarmType");
        String alarm = extras.getString("alarm");
        String type = extras.getString("type");
        String title = extras.getString("title");
        String body = extras.getString("body");
        String deviceName = extras.getString("deviceName");
        String deviceId = extras.getString("deviceId");
        
        // Check if this is a critical alert that needs fake call
        boolean shouldTriggerFakeCall = false;
        String alertType = "batteryCutoff";
        
        if (eventType != null) {
            String normalized = eventType.toLowerCase().replaceAll("\\s+", "");
            if (normalized.equals("powercut") || normalized.equals("powercutoff") || 
                normalized.equals("batterycutoff") ||
                eventType.equals("powerCut") || eventType.equals("powerCutoff") || 
                eventType.equals("batteryCutoff")) {
                shouldTriggerFakeCall = true;
                alertType = "batteryCutoff";
            } else if (normalized.equals("geofence") || normalized.equals("geofenceexit") ||
                       eventType.equals("geofence") || eventType.equals("geofenceExit")) {
                shouldTriggerFakeCall = true;
                alertType = "geofenceExit";
            }
        }
        
        if (!shouldTriggerFakeCall && alarmType != null) {
            String normalized = alarmType.toLowerCase().replaceAll("\\s+", "");
            if (normalized.equals("powercut") || normalized.equals("powercutoff") || 
                normalized.equals("batterycutoff") ||
                alarmType.equals("powerCut") || alarmType.equals("powerCutoff") || 
                alarmType.equals("batteryCutoff")) {
                shouldTriggerFakeCall = true;
                alertType = "batteryCutoff";
            }
        }
        
        if (!shouldTriggerFakeCall && alarm != null) {
            String normalized = alarm.toLowerCase().replaceAll("\\s+", "");
            if (normalized.equals("powercut") || normalized.equals("powercutoff") || 
                normalized.equals("batterycutoff") ||
                alarm.equals("powerCut") || alarm.equals("powerCutoff") || 
                alarm.equals("batteryCutoff") || alarm.equals("Power Cut")) {
                shouldTriggerFakeCall = true;
                alertType = "batteryCutoff";
            }
        }
        
        // Also check title/body text
        // Format: Title: "[Device Name]: alarm!" Body: "[Device name] alarm: Power Cut at Date Time"
        if (!shouldTriggerFakeCall && (title != null || body != null)) {
            String combined = ((title != null ? title : "") + " " + (body != null ? body : "")).toLowerCase();
            // Check body first (more specific format)
            if (body != null && (body.toLowerCase().contains("power cut") || body.toLowerCase().contains("powercut") || 
                body.toLowerCase().contains("battery cutoff"))) {
                shouldTriggerFakeCall = true;
                alertType = "batteryCutoff";
                Log.d(TAG, "Triggered by body text: power cut found");
            } else if (combined.contains("power cut") || combined.contains("powercut") || 
                combined.contains("battery cutoff")) {
                shouldTriggerFakeCall = true;
                alertType = "batteryCutoff";
                Log.d(TAG, "Triggered by combined text: power cut found");
            } else if (combined.contains("geofence exit") || combined.contains("geofenceexit")) {
                shouldTriggerFakeCall = true;
                alertType = "geofenceExit";
                Log.d(TAG, "Triggered by combined text: geofence exit found");
            }
        }
        
        // Check if title contains "alarm!" which indicates a critical alarm notification
        // Format: "[Device Name]: alarm!" - check body for specific alarm type
        if (!shouldTriggerFakeCall && title != null && title.toLowerCase().contains("alarm")) {
            if (body != null && body.toLowerCase().contains("power cut")) {
                shouldTriggerFakeCall = true;
                alertType = "batteryCutoff";
                Log.d(TAG, "Triggered by alarm notification with power cut in body");
            } else if (body != null && (body.toLowerCase().contains("geofence exit") || body.toLowerCase().contains("geofenceexit"))) {
                shouldTriggerFakeCall = true;
                alertType = "geofenceExit";
                Log.d(TAG, "Triggered by alarm notification with geofence exit in body");
            }
        }
        
        if (shouldTriggerFakeCall) {
            Log.d(TAG, "Notification click detected for critical alert - triggering fake call");
            Log.d(TAG, "  Alert Type: " + alertType);
            Log.d(TAG, "  Device Name: " + deviceName);
            Log.d(TAG, "  Device ID: " + deviceId);
            
            // Extract device name from title format: "[Device Name]: alarm!"
            if (deviceName == null || deviceName.isEmpty()) {
                if (title != null) {
                    // Try to extract device name from title format "[Device Name]: alarm!"
                    java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("^\\[?([A-Z0-9-]+)\\]?\\s*:");
                    java.util.regex.Matcher matcher = pattern.matcher(title);
                    if (matcher.find()) {
                        deviceName = matcher.group(1);
                        Log.d(TAG, "Extracted device name from title: " + deviceName);
                    } else {
                        // Fallback: try simple pattern
                        pattern = java.util.regex.Pattern.compile("^([A-Z0-9-]+)");
                        matcher = pattern.matcher(title);
                        if (matcher.find()) {
                            deviceName = matcher.group(1);
                            Log.d(TAG, "Extracted device name from title (fallback): " + deviceName);
                        }
                    }
                }
            }
            // Also try to extract from body format: "[Device name] alarm: Power Cut..."
            if ((deviceName == null || deviceName.isEmpty()) && body != null) {
                java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("^\\[?([A-Z0-9-]+)\\]?\\s+alarm");
                java.util.regex.Matcher matcher = pattern.matcher(body);
                if (matcher.find()) {
                    deviceName = matcher.group(1);
                    Log.d(TAG, "Extracted device name from body: " + deviceName);
                }
            }
            if (deviceName == null || deviceName.isEmpty()) {
                deviceName = "Unknown Device";
            }
            
            // Start FakeCallActivity
            Intent fakeCallIntent = new Intent(this, FakeCallActivity.class);
            fakeCallIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            fakeCallIntent.putExtra("callerName", deviceName + " Alert");
            fakeCallIntent.putExtra("callerNumber", "+92-300-" + (1000 + (int)(Math.random() * 9000)) + "-" + (1000 + (int)(Math.random() * 9000)));
            fakeCallIntent.putExtra("alertType", alertType);
            fakeCallIntent.putExtra("deviceName", deviceName);
            fakeCallIntent.putExtra("message", body != null ? body : (title != null ? title : "Alert"));
            if (deviceId != null && !deviceId.isEmpty()) {
                fakeCallIntent.putExtra("deviceId", deviceId);
            }
            
            startActivity(fakeCallIntent);
        }
    }
}
