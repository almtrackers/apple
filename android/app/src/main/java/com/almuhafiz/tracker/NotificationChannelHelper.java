package com.almuhafiz.tracker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

public class NotificationChannelHelper {
    private static final String TAG = "NotificationChannel";
    private static final String CHANNEL_ID = "default_channel";
    private static final String CHANNEL_NAME = "Default Channel";
    private static boolean channelInitialized = false;

    /**
     * Initialize the notification channel with custom sound at app startup.
     * This ensures the channel is ready before any notifications are received.
     */
    public static void initializeChannel(Context context) {
        if (channelInitialized) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = 
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            
            if (notificationManager == null) {
                Log.e(TAG, "NotificationManager is null");
                return;
            }

            // Get custom sound URI
            Uri soundUri = getNotificationSoundUri(context);
            
            // Check if channel already exists
            NotificationChannel existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID);
            
            // Delete and recreate if channel doesn't exist or sound doesn't match
            boolean needsRecreate = false;
            if (existingChannel == null) {
                needsRecreate = true;
                Log.d(TAG, "Channel doesn't exist, will create it");
            } else if (soundUri != null && !soundUri.equals(existingChannel.getSound())) {
                needsRecreate = true;
                Log.d(TAG, "Channel exists but sound doesn't match, will recreate");
            }
            
            if (needsRecreate) {
                // Delete existing channel if it exists
                if (existingChannel != null) {
                    notificationManager.deleteNotificationChannel(CHANNEL_ID);
                    Log.d(TAG, "Deleted existing channel");
                }
                
                // Create new channel with custom sound
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Default notification channel for AL-MUHAFIZ");
                channel.enableLights(true);
                channel.enableVibration(true);
                channel.setShowBadge(true);
                
                // Set custom sound with proper audio attributes
                if (soundUri != null) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                    channel.setSound(soundUri, audioAttributes);
                    Log.d(TAG, "Created channel with custom sound: " + soundUri.toString());
                } else {
                    // Use default sound
                    Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    channel.setSound(defaultSound, null);
                    Log.d(TAG, "Created channel with default sound");
                }
                
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel initialized successfully");
            } else {
                Log.d(TAG, "Notification channel already exists with correct sound");
            }
            
            channelInitialized = true;
        }
    }

    /**
     * Get the notification sound URI (custom or default)
     */
    private static Uri getNotificationSoundUri(Context context) {
        try {
            // Try to use custom sound from raw resources
            int soundResourceId = context.getResources().getIdentifier("notification_sound", "raw", context.getPackageName());
            if (soundResourceId != 0) {
                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + soundResourceId);
                Log.d(TAG, "Custom notification sound found: " + soundUri.toString());
                return soundUri;
            } else {
                Log.d(TAG, "Custom notification sound not found, will use default");
                return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting notification sound: " + e.getMessage());
            return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
    }

    /**
     * Get the channel ID
     */
    public static String getChannelId() {
        return CHANNEL_ID;
    }
}

