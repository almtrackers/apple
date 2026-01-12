package com.almuhafiz.tracker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FCMService";
    private static final String INCOMING_CALL_CHANNEL_ID = "incoming_call_channel";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "=== Firebase Message Received ===");
        Log.d(TAG, "From: " + remoteMessage.getFrom());
        Log.d(TAG, "Message ID: " + remoteMessage.getMessageId());
        Log.d(TAG, "App in background: " + (remoteMessage.getNotification() != null));

        java.util.Map<String, String> data = remoteMessage.getData();
        Log.d(TAG, "Data keys: " + (data != null ? data.keySet().toString() : "null"));
        if (data != null) {
            for (String key : data.keySet()) {
                Log.d(TAG, "  " + key + " = " + data.get(key));
            }
        }

        String title = null;
        String body = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
            Log.d(TAG, "Notification payload - Title: " + title + ", Body: " + body);
            
            // IMPORTANT: When notification payload exists, Android may not call onMessageReceived
            // when app is in background. We need to handle this case.
            // For now, we'll still try to trigger fake call if onMessageReceived is called.
        } else if (data != null && data.size() > 0) {
            title = data.get("title");
            body = data.get("body");
            Log.d(TAG, "Data-only message - Title: " + title + ", Body: " + body);
        }

        Log.d(TAG, "Calling checkAndTriggerFakeCall...");
        checkAndTriggerFakeCall(title, body, data);
    }
    
    /**
     * Override handleIntent to intercept notifications even when app is in background.
     * This is called by Firebase SDK before showing the notification.
     */
    @Override
    public void handleIntent(android.content.Intent intent) {
        Log.d(TAG, "=== handleIntent called ===");
        
        if (intent != null) {
            Log.d(TAG, "Intent action: " + intent.getAction());
            
            if (intent.getExtras() != null) {
                android.os.Bundle extras = intent.getExtras();
                Log.d(TAG, "Intent extras keys: " + extras.keySet().toString());
                
                // Extract notification data
                String title = extras.getString("gcm.notification.title");
                String body = extras.getString("gcm.notification.body");
                
                // Also try alternative keys
                if (title == null) title = extras.getString("title");
                if (body == null) body = extras.getString("body");
                
                // Extract data fields
                String eventType = extras.getString("eventType");
                String alarmType = extras.getString("alarmType");
                String alarm = extras.getString("alarm");
                String deviceId = extras.getString("deviceId");
                String deviceName = extras.getString("deviceName");
                
                Log.d(TAG, "Extracted from intent - Title: " + title + ", Body: " + body);
                Log.d(TAG, "Extracted from intent - eventType: " + eventType + ", alarmType: " + alarmType + ", alarm: " + alarm);
                
                // Convert extras to data map
                java.util.Map<String, String> data = new java.util.HashMap<>();
                for (String key : extras.keySet()) {
                    Object value = extras.get(key);
                    if (value != null) {
                        data.put(key, value.toString());
                    }
                }
                
                // Check and trigger fake call BEFORE showing notification
                // This way fake call triggers even when app is in background
                if (title != null || body != null || eventType != null || alarmType != null || alarm != null) {
                    Log.d(TAG, "Checking if fake call should be triggered from handleIntent...");
                    checkAndTriggerFakeCall(title, body, data);
                }
            }
        }
        
        // Call super AFTER processing to ensure notification is still shown
        super.handleIntent(intent);
    }

    private void checkAndTriggerFakeCall(String title, String body, java.util.Map<String, String> data) {
        if (title == null) title = "";
        if (body == null) body = "";

        String combinedText = (title + " " + body).toLowerCase();
        Log.d(TAG, "Checking for fake call trigger. Title: '" + title + "', Body: '" + body + "', Combined: '" + combinedText + "'");
        
        String eventType = data != null ? data.get("eventType") : null;
        String alarmType = data != null ? data.get("alarmType") : null;
        String alarm = data != null ? data.get("alarm") : null;
        String type = data != null ? data.get("type") : null;
        
        Log.d(TAG, "Data fields - eventType: " + eventType + ", alarmType: " + alarmType + ", alarm: " + alarm + ", type: " + type);

        boolean shouldTrigger = false;
        String alertType = "batteryCutoff";
        String deviceName = "Unknown Device";

        // Normalize strings for comparison (case-insensitive, remove spaces)
        String normalizedEventType = eventType != null ? eventType.toLowerCase().replaceAll("\\s+", "") : "";
        String normalizedAlarmType = alarmType != null ? alarmType.toLowerCase().replaceAll("\\s+", "") : "";
        String normalizedAlarm = alarm != null ? alarm.toLowerCase().replaceAll("\\s+", "") : "";
        String normalizedType = type != null ? type.toLowerCase().replaceAll("\\s+", "") : "";

        // Check eventType
        if (eventType != null) {
            if (normalizedEventType.equals("powercut") || normalizedEventType.equals("powercutoff") || 
                normalizedEventType.equals("batterycutoff") ||
                eventType.equals("powerCut") || eventType.equals("powerCutoff") || 
                eventType.equals("batteryCutoff")) {
                shouldTrigger = true;
                alertType = "batteryCutoff";
            } else if (normalizedEventType.equals("geofence") || normalizedEventType.equals("geofenceexit") ||
                       eventType.equals("geofence") || eventType.equals("geofenceExit")) {
                shouldTrigger = true;
                alertType = "geofenceExit";
            } else if (normalizedEventType.equals("proximity") || eventType.equals("proximity")) {
                shouldTrigger = true;
                alertType = "proximity";
            }
        }

        // Check alarmType
        if (!shouldTrigger && alarmType != null) {
            if (normalizedAlarmType.equals("powercut") || normalizedAlarmType.equals("powercutoff") || 
                normalizedAlarmType.equals("batterycutoff") ||
                alarmType.equals("powerCut") || alarmType.equals("powerCutoff") || 
                alarmType.equals("batteryCutoff")) {
                shouldTrigger = true;
                alertType = "batteryCutoff";
            }
        }

        // Check alarm field
        if (!shouldTrigger && alarm != null) {
            if (normalizedAlarm.equals("powercut") || normalizedAlarm.equals("powercutoff") || 
                normalizedAlarm.equals("batterycutoff") ||
                alarm.equals("powerCut") || alarm.equals("powerCutoff") || 
                alarm.equals("batteryCutoff") || alarm.equals("Power Cut")) {
                shouldTrigger = true;
                alertType = "batteryCutoff";
            }
        }

        // Check type field (if type is "alarm" and alarm field contains power cutoff)
        if (!shouldTrigger && type != null && normalizedType.equals("alarm") && alarm != null) {
            if (normalizedAlarm.equals("powercut") || normalizedAlarm.equals("powercutoff") || 
                normalizedAlarm.equals("batterycutoff") ||
                alarm.equals("powerCut") || alarm.equals("powerCutoff") || 
                alarm.equals("batteryCutoff") || alarm.equals("Power Cut")) {
                shouldTrigger = true;
                alertType = "batteryCutoff";
            }
        }

        // Check notification title and body text for power cutoff keywords
        // Format: "[Device Name]: alarm!" and "[Device name] alarm: Power Cut at Date Time"
        if (!shouldTrigger && (combinedText.contains("power cut") || combinedText.contains("powercut") || combinedText.contains("battery cutoff"))) {
            shouldTrigger = true;
            alertType = "batteryCutoff";
            Log.d(TAG, "Triggered by text detection: power cut found in title/body");
        }

        if (!shouldTrigger && (combinedText.contains("geofence exit") || combinedText.contains("geofenceexit") || combinedText.contains("exited geofence"))) {
            shouldTrigger = true;
            alertType = "geofenceExit";
            Log.d(TAG, "Triggered by text detection: geofence exit found in title/body");
        }

        if (!shouldTrigger && (combinedText.contains("proximity") || combinedText.contains("ignition"))) {
            shouldTrigger = true;
            alertType = "proximity";
            Log.d(TAG, "Triggered by text detection: proximity/ignition found in title/body");
        }
        
        // Also check if title contains "alarm!" which indicates an alarm notification
        // Format: "[Device Name]: alarm!" - this is a critical alert
        if (!shouldTrigger && title != null && title.toLowerCase().contains("alarm")) {
            // Check body for specific alarm types
            if (body != null && body.toLowerCase().contains("power cut")) {
                shouldTrigger = true;
                alertType = "batteryCutoff";
                Log.d(TAG, "Triggered by alarm notification with power cut in body");
            } else if (body != null && (body.toLowerCase().contains("geofence exit") || body.toLowerCase().contains("geofenceexit"))) {
                shouldTrigger = true;
                alertType = "geofenceExit";
                Log.d(TAG, "Triggered by alarm notification with geofence exit in body");
            }
        }

        Log.d(TAG, "checkAndTriggerFakeCall result - shouldTrigger: " + shouldTrigger + ", alertType: " + alertType);
        
        if (shouldTrigger) {
            if (data != null) {
                deviceName = data.get("deviceName");
                if (deviceName == null) deviceName = data.get("vehicle");
            }
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

            String deviceId = null;
            if (data != null) {
                deviceId = data.get("deviceId");
                if (deviceId == null) deviceId = data.get("device_id");
            }
            
            Log.d(TAG, "✓✓✓ TRIGGERING FAKE CALL ✓✓✓");
            Log.d(TAG, "  Alert Type: " + alertType);
            Log.d(TAG, "  Device Name: " + deviceName);
            Log.d(TAG, "  Device ID: " + deviceId);
            Log.d(TAG, "  Title: " + title);
            Log.d(TAG, "  Body: " + body);
            showIncomingCallNotification(title, body, alertType, deviceName, deviceId);
        } else {
            Log.d(TAG, "✗ Not triggering fake call - showing regular notification");
            Log.d(TAG, "  Title: " + title);
            Log.d(TAG, "  Body: " + body);
            showNotification(title, body, data);
        }
    }

    private void showIncomingCallNotification(String title, String messageBody, String alertType, String deviceName, String deviceId) {
        Log.d(TAG, "showIncomingCallNotification called");
        createIncomingCallChannel();

        Intent fullScreenIntent = new Intent(this, FakeCallActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("callerName", deviceName + " Alert");
        fullScreenIntent.putExtra("callerNumber", "+92-300-" + (1000 + (int)(Math.random() * 9000)) + "-" + (1000 + (int)(Math.random() * 9000)));
        fullScreenIntent.putExtra("alertType", alertType);
        fullScreenIntent.putExtra("deviceName", deviceName);
        fullScreenIntent.putExtra("message", messageBody != null ? messageBody : title);
        if (deviceId != null && !deviceId.isEmpty()) {
            fullScreenIntent.putExtra("deviceId", deviceId);
        }
        
        Log.d(TAG, "Starting FakeCallActivity with Intent extras:");
        Log.d(TAG, "  callerName: " + fullScreenIntent.getStringExtra("callerName"));
        Log.d(TAG, "  callerNumber: " + fullScreenIntent.getStringExtra("callerNumber"));
        Log.d(TAG, "  alertType: " + alertType);
        Log.d(TAG, "  deviceName: " + deviceName);
        Log.d(TAG, "  deviceId: " + deviceId);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(this, 0, fullScreenIntent, flags);

        int smallIcon = getResources().getIdentifier("ic_launcher_foreground", "mipmap", getPackageName());
        if (smallIcon == 0) {
            smallIcon = android.R.drawable.ic_dialog_info;
        }

        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, INCOMING_CALL_CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle(title)
                .setContentText(messageBody)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(fullScreenPendingIntent, true);

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "Notification posted with ID: " + notificationId);
        Log.d(TAG, "FullScreenIntent should launch FakeCallActivity immediately");
        
        // Also try to start activity directly as backup
        try {
            startActivity(fullScreenIntent);
            Log.d(TAG, "FakeCallActivity started directly (backup method)");
        } catch (Exception e) {
            Log.e(TAG, "Error starting FakeCallActivity directly: " + e.getMessage());
        }
    }

    private void createIncomingCallChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Incoming Calls";
            String description = "Channel for incoming call alerts";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(INCOMING_CALL_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void showNotification(String title, String messageBody, java.util.Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // Pass notification data to MainActivity so it can trigger fake call on click
        if (data != null) {
            for (String key : data.keySet()) {
                intent.putExtra(key, data.get(key));
            }
        }
        // Also pass title and body
        if (title != null) intent.putExtra("title", title);
        if (messageBody != null) intent.putExtra("body", messageBody);
        
        int flags = PendingIntent.FLAG_ONE_SHOT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, flags
        );

        int smallIcon = getResources().getIdentifier("ic_launcher_foreground", "mipmap", getPackageName());
        if (smallIcon == 0) {
            smallIcon = android.R.drawable.ic_dialog_info;
        }
        
        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, NotificationChannelHelper.getChannelId())
            .setSmallIcon(smallIcon)
            .setContentTitle(title != null ? title : "AL-MUHAFIZ")
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS | NotificationCompat.DEFAULT_VIBRATE);

        if (data != null && !data.isEmpty()) {
            android.os.Bundle extras = new android.os.Bundle();
            for (String key : data.keySet()) {
                extras.putString(key, data.get(key));
            }
            notificationBuilder.addExtras(extras);
        }

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannelHelper.initializeChannel(this);
        }

        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "Notification shown: " + title + " - " + messageBody);
    }
}
