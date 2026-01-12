package com.almuhafiz.tracker;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

public class FakeCallActivity extends Activity {
    private MediaPlayer ringtonePlayer;
    private Vibrator vibrator;
    private boolean isRinging = true;
    private String callerName = "Alert Service";
    private String callerNumber = "+92-300-0000-0000";
    private String alertType = "";
    private String deviceName = "";
    private String message = "";
    private TextView statusTextView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Make activity fullscreen and show over lockscreen (Modern Android approach)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // Get data from intent
        Intent intent = getIntent();
        if (intent != null) {
            callerName = intent.getStringExtra("callerName");
            if (callerName == null || callerName.isEmpty()) callerName = "Alert Service";

            callerNumber = intent.getStringExtra("callerNumber");
            if (callerNumber == null || callerNumber.isEmpty()) callerNumber = "+92-300-0000-0000";

            alertType = intent.getStringExtra("alertType");
            if (alertType == null) alertType = "";

            deviceName = intent.getStringExtra("deviceName");
            if (deviceName == null) deviceName = "";

            message = intent.getStringExtra("message");
            if (message == null) message = "";
        }

        // Create layout programmatically
        createLayout();

        // Start ringing and vibration
        startRinging();

        // Auto-answer after 5 seconds
        getWindow().getDecorView().postDelayed(() -> {
            if (isRinging) {
                answerCall();
            }
        }, 5000);
    }

    private void createLayout() {
        // Create main container
        android.widget.LinearLayout mainLayout = new android.widget.LinearLayout(this);
        mainLayout.setOrientation(android.widget.LinearLayout.VERTICAL);
        mainLayout.setGravity(android.view.Gravity.CENTER);
        mainLayout.setPadding(64, 64, 64, 64);
        mainLayout.setBackgroundColor(0xFF000000);

        // Caller avatar
        TextView avatar = new TextView(this);
        avatar.setText(callerName.length() > 0 ? String.valueOf(callerName.charAt(0)).toUpperCase() : "A");
        avatar.setTextSize(48);
        avatar.setTextColor(0xFFFFFFFF);
        avatar.setGravity(android.view.Gravity.CENTER);
        // Create circular background programmatically
        android.graphics.drawable.GradientDrawable avatarBg = new android.graphics.drawable.GradientDrawable();
        avatarBg.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        avatarBg.setColor(0xFF6366F1); // Purple-blue gradient color
        avatar.setBackground(avatarBg);
        avatar.setPadding(32, 32, 32, 32);
        // Set fixed size for circular avatar (128dp = 128px at mdpi, scale accordingly)
        int avatarSize = (int) (128 * getResources().getDisplayMetrics().density);
        android.widget.LinearLayout.LayoutParams avatarParams = new android.widget.LinearLayout.LayoutParams(
            avatarSize,
            avatarSize
        );
        avatarParams.setMargins(0, 0, 0, 32);
        avatarParams.gravity = android.view.Gravity.CENTER;
        avatar.setLayoutParams(avatarParams);
        mainLayout.addView(avatar);

        // Caller name
        TextView nameText = new TextView(this);
        nameText.setText(callerName);
        nameText.setTextSize(24);
        nameText.setTextColor(0xFFFFFFFF);
        nameText.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams nameParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        nameParams.setMargins(0, 0, 0, 8);
        nameText.setLayoutParams(nameParams);
        mainLayout.addView(nameText);

        // Caller number
        TextView numberText = new TextView(this);
        numberText.setText(callerNumber);
        numberText.setTextSize(18);
        numberText.setTextColor(0xFF999999);
        numberText.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams numberParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        numberParams.setMargins(0, 0, 0, 16);
        numberText.setLayoutParams(numberParams);
        mainLayout.addView(numberText);

        // Alert type badge
        if (!alertType.isEmpty()) {
            TextView alertBadge = new TextView(this);
            String alertText = "";
            if (alertType.equals("batteryCutoff") || alertType.equals("powerCut")) {
                alertText = "🔋 Battery Cutoff Alert";
            } else if (alertType.equals("geofenceExit") || alertType.equals("geofence")) {
                alertText = "📍 Geofence Exit Alert";
            } else if (alertType.equals("proximity")) {
                alertText = "📍 Proximity Alert";
            }
            alertBadge.setText(alertText);
            alertBadge.setTextSize(12);
            alertBadge.setTextColor(0xFFFF6B6B);
            alertBadge.setGravity(android.view.Gravity.CENTER);
            alertBadge.setPadding(16, 8, 16, 8);
            android.widget.LinearLayout.LayoutParams badgeParams = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            );
            badgeParams.setMargins(0, 0, 0, 32);
            badgeParams.gravity = android.view.Gravity.CENTER;
            alertBadge.setLayoutParams(badgeParams);
            mainLayout.addView(alertBadge);
        }

        // Status text (store reference for later update)
        TextView statusText = new TextView(this);
        statusText.setText("Incoming Call");
        statusText.setTextSize(16);
        statusText.setTextColor(0xFF4A9EFF);
        statusText.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams statusParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        statusParams.setMargins(0, 0, 0, 32);
        statusText.setLayoutParams(statusParams);
        mainLayout.addView(statusText);

        // Store status text reference for answerCall method
        this.statusTextView = statusText;

        // Button container
        android.widget.LinearLayout buttonLayout = new android.widget.LinearLayout(this);
        buttonLayout.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        buttonLayout.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams buttonLayoutParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        buttonLayout.setLayoutParams(buttonLayoutParams);

        // Decline button
        Button declineButton = new Button(this);
        declineButton.setText("✕");
        declineButton.setTextSize(24);
        declineButton.setBackgroundColor(0xFFFF4444);
        declineButton.setTextColor(0xFFFFFFFF);
        android.widget.LinearLayout.LayoutParams declineParams = new android.widget.LinearLayout.LayoutParams(120, 120);
        declineParams.setMargins(0, 0, 32, 0);
        declineButton.setLayoutParams(declineParams);
        declineButton.setOnClickListener(v -> declineCall());
        buttonLayout.addView(declineButton);

        // Answer button
        Button answerButton = new Button(this);
        answerButton.setText("✓");
        answerButton.setTextSize(24);
        answerButton.setBackgroundColor(0xFF4CAF50);
        answerButton.setTextColor(0xFFFFFFFF);
        android.widget.LinearLayout.LayoutParams answerParams = new android.widget.LinearLayout.LayoutParams(120, 120);
        answerButton.setLayoutParams(answerParams);
        answerButton.setOnClickListener(v -> answerCall());
        buttonLayout.addView(answerButton);

        mainLayout.addView(buttonLayout);

        setContentView(mainLayout);
    }

    private void startRinging() {
        // Start vibration
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            long[] pattern = {0, 200, 100, 200, 100, 200};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }

        // Try to play system ringtone
        try {
            ringtonePlayer = MediaPlayer.create(this, android.provider.Settings.System.DEFAULT_RINGTONE_URI);
            if (ringtonePlayer != null) {
                ringtonePlayer.setLooping(true);
                ringtonePlayer.start();
            }
        } catch (Exception e) {
            android.util.Log.e("FakeCallActivity", "Error playing ringtone", e);
        }
    }

    private void stopRinging() {
        isRinging = false;

        if (vibrator != null) {
            vibrator.cancel();
        }

        if (ringtonePlayer != null) {
            ringtonePlayer.stop();
            ringtonePlayer.release();
            ringtonePlayer = null;
        }
    }

    private void answerCall() {
        stopRinging();

        // Update status
        if (statusTextView != null) {
            statusTextView.setText("Call Answered");
            statusTextView.setTextColor(0xFF4CAF50);
        }

        // Show message if available
        if (!message.isEmpty()) {
            android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show();
        }

        // Close after 3 seconds
        getWindow().getDecorView().postDelayed(() -> finish(), 3000);
    }

    private void declineCall() {
        stopRinging();
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopRinging();
    }

    @Override
    public void onBackPressed() {
        declineCall();
    }
}
