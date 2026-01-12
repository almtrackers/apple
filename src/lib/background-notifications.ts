/**
 * Background notification handlers that work independently of authentication state
 * These handlers ensure notifications work even when the user is logged out
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { fakeCallService, FakeCallService } from './fake-call-service';

const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
const DEVICE_ID_STORAGE_KEY = 'device_id';
const ALERT_DISTANCE_THRESHOLD_M = 25; // 25 meters threshold for proximity alert

/**
 * Initialize push notifications for background handling
 * This works independently of authentication state
 */
export async function initializeBackgroundNotifications() {
  if (Capacitor.getPlatform() === 'web') {
    // Web notifications are handled by service worker
    return;
  }

  try {
    // Check permissions
    const permissionStatus = await PushNotifications.checkPermissions();
    
    if (permissionStatus.receive !== 'granted') {
      // Request permission if not granted
      const requestResult = await PushNotifications.requestPermissions();
      if (requestResult.receive !== 'granted') {
        console.warn('[BackgroundNotifications] Permission not granted');
        return;
      }
    }

    // Register for push notifications
    await PushNotifications.register();

    // Listen for token registration
    PushNotifications.addListener('registration', async (token: any) => {
      console.log('[BackgroundNotifications] Token received:', token.value?.substring(0, 20) + '...');
      
      // Store token in localStorage for later use
      if (typeof window !== 'undefined' && token.value) {
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token.value);
        
        // Try to register token with server if user is logged in
        // This will be handled by usePushNotifications hook when user logs in
        // But we store it here so it's available even when logged out
      }
    });

    // Listen for background notifications (when app is in background/closed)
    // NOTE: When app is in background, the native Firebase service (MyFirebaseMessagingService)
    // handles fake calls directly. This listener is mainly for when app is in foreground.
    PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        console.log('[BackgroundNotifications] Notification received:', notification);
        
        // Handle notification even when logged out
        await handleBackgroundNotification(notification);
        
        // Only trigger JavaScript fake call if app is in foreground
        // When app is in background, native Firebase service handles it
        const data = (notification as any).data;
        const event = data?.eventType || data?.type || data?.alarmType || data?.alarm;
        
        // Also check notification title and body for alarm keywords
        const title = notification.title || '';
        const body = notification.body || '';
        const titleBody = `${title} ${body}`.toLowerCase();
        
        // Detect alarm type from text if not in data
        // Format: Title: "[Device Name]: alarm!" Body: "[Device name] alarm: Power Cut at Date Time"
        let detectedEvent = event;
        if (!detectedEvent) {
          // Check for power cut in body (format: "[Device name] alarm: Power Cut at Date Time")
          if (body && (body.toLowerCase().includes('power cut') || body.toLowerCase().includes('powercut') || body.toLowerCase().includes('battery cutoff'))) {
            detectedEvent = 'powerCut';
          } else if (titleBody.includes('power cut') || titleBody.includes('powercut') || titleBody.includes('battery cutoff')) {
            detectedEvent = 'powerCut';
          } else if (titleBody.includes('geofence exit') || titleBody.includes('geofenceexit') || titleBody.includes('exited geofence')) {
            detectedEvent = 'geofence';
          } else if (titleBody.includes('proximity') || titleBody.includes('ignition')) {
            detectedEvent = 'proximity';
          }
        }
        
        // Also check if title contains "alarm!" which indicates a critical alarm notification
        if (!detectedEvent && title && title.toLowerCase().includes('alarm')) {
          if (body && body.toLowerCase().includes('power cut')) {
            detectedEvent = 'powerCut';
          } else if (body && (body.toLowerCase().includes('geofence exit') || body.toLowerCase().includes('geofenceexit'))) {
            detectedEvent = 'geofence';
          }
        }
        
        console.log('[BackgroundNotifications] Event detection:', {
          eventFromData: event,
          detectedEvent,
          title,
          body,
          dataKeys: data ? Object.keys(data) : [],
        });
        
        // Only trigger JavaScript fake call if app is in foreground
        // Native Firebase service handles background calls
        if (Capacitor.getPlatform() === 'android') {
          // Check if app is in foreground (JavaScript can execute)
          // If app is truly in background, native service already handled it
          // This is a fallback for when app is transitioning or in foreground
          if (detectedEvent === 'powerCut' || detectedEvent === 'geofence' || detectedEvent === 'proximity' || 
              detectedEvent === 'batteryCutoff' || detectedEvent === 'powerCutoff' || 
              detectedEvent === 'geofenceExit' || detectedEvent === 'powerCut') {
            console.log('[BackgroundNotifications] App in foreground, triggering JavaScript fake call for event:', detectedEvent);
            // Use JavaScript fake call service as fallback (native should have already handled it)
            try {
              await triggerNativeFakeCallFromPush(notification, detectedEvent);
            } catch (error) {
              console.log('[BackgroundNotifications] JavaScript fake call failed (native may have handled it):', error);
            }
          } else {
            console.log('[BackgroundNotifications] No matching event type found. Event:', detectedEvent);
          }
        }
      }
    );

    // Listen for notification taps (when app is opened from notification)
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('[BackgroundNotifications] Notification tapped:', notification);
        
        // Handle notification tap
        handleNotificationTap(notification);
      }
    );

    console.log('[BackgroundNotifications] Background notification handlers initialized');
  } catch (error) {
    console.error('[BackgroundNotifications] Error initializing:', error);
  }
}

/**
 * Handle background notifications (works even when logged out)
 * Triggers fake calls for critical alerts
 */
async function handleBackgroundNotification(notification: PushNotificationSchema) {
  const data = (notification as any).data;
  const platform = Capacitor.getPlatform();
  
  console.log('[BackgroundNotifications] Notification received:', {
    platform,
    title: notification.title,
    body: notification.body,
    data: data
  });

  // Only process on mobile devices
  if (platform === 'web') {
    console.log('[BackgroundNotifications] Skipping - web platform');
    return;
  }
  
  console.log('[BackgroundNotifications] Processing notification on mobile platform');
  
  // Handle ignitionOn events - check proximity and trigger fake call
  if (data && data.type === 'ignitionOn') {
    console.log('[BackgroundNotifications] IgnitionOn event detected:', data);
    
    const deviceLat = parseFloat(data.latitude || data.lat);
    const deviceLon = parseFloat(data.longitude || data.lon || data.lng);
    const deviceName = data.deviceName || data.vehicle || 'Unknown Device';
    const deviceId = parseInt(data.deviceId || data.device_id || '0');
    
    if (!isNaN(deviceLat) && !isNaN(deviceLon)) {
      // Get current location and check proximity
      await checkProximityAndTriggerCall(deviceName, deviceLat, deviceLon, deviceId);
    }
  }
  
  // Handle geofence exit - trigger fake call
  if (data && (data.type === 'geofenceExit' || data.eventType === 'geofenceExit' || data.eventType === 'geofence')) {
    console.log('[BackgroundNotifications] Geofence exit detected:', data);
    
    const deviceName = data.deviceName || data.vehicle || 'Unknown Device';
    const geofenceName = data.geofenceName || 'geofence';
    
    const callerInfo = FakeCallService.generateCallerInfo('geofenceExit', deviceName);
    console.log('[BackgroundNotifications] Triggering fake call for geofence exit:', callerInfo);
    
    const deviceId = parseInt(data.deviceId || data.device_id || '0');
    
    // Trigger native Android activity
    triggerNativeFakeCall({
      callerName: callerInfo.name,
      callerNumber: callerInfo.number,
      alertType: 'geofenceExit',
      deviceName: deviceName,
      deviceId: deviceId || undefined,
      message: `${deviceName} has exited ${geofenceName}`,
    });
  }
  
  // Handle battery cutoff / power cutoff - trigger fake call
  // Check data fields first - normalize for comparison
  const normalizedAlarm = data?.alarm?.toLowerCase().replace(/\s+/g, '') || '';
  const normalizedAlarmType = data?.alarmType?.toLowerCase().replace(/\s+/g, '') || '';
  const normalizedEventType = data?.eventType?.toLowerCase().replace(/\s+/g, '') || '';
  
  const isPowerCutFromData = data && (
    (data.type === 'alarm' && (
      normalizedAlarm === 'batterycutoff' || 
      normalizedAlarm === 'powercutoff' || 
      normalizedAlarm === 'powercut' ||
      data.alarm === 'batteryCutoff' || 
      data.alarm === 'powerCutoff' || 
      data.alarm === 'Power Cut' ||
      data.alarm === 'powerCut'
    )) ||
    normalizedAlarmType === 'batterycutoff' || 
    normalizedAlarmType === 'powercutoff' ||
    normalizedAlarmType === 'powercut' ||
    data.alarmType === 'batteryCutoff' || 
    data.alarmType === 'powerCutoff' ||
    normalizedEventType === 'batterycutoff' || 
    normalizedEventType === 'powercutoff' ||
    normalizedEventType === 'powercut' ||
    data.eventType === 'batteryCutoff' || 
    data.eventType === 'powerCut' || 
    data.eventType === 'powerCutoff'
  );
  
  // Also check notification text for "Power Cut"
  const notificationText = `${notification.title || ''} ${notification.body || ''}`.toLowerCase();
  const isPowerCutFromText = notificationText.includes('power cut') || 
                              notificationText.includes('powercut') || 
                              notificationText.includes('battery cutoff') ||
                              notificationText.includes('power cutoff');
  
  console.log('[BackgroundNotifications] Power cutoff check:', {
    isPowerCutFromData,
    isPowerCutFromText,
    normalizedAlarm,
    normalizedAlarmType,
    normalizedEventType,
    alarm: data?.alarm,
    alarmType: data?.alarmType,
    eventType: data?.eventType,
    type: data?.type,
    title: notification.title,
    body: notification.body,
  });
  
  if (isPowerCutFromData || isPowerCutFromText) {
    console.log('[BackgroundNotifications] Battery cutoff detected:', {
      fromData: isPowerCutFromData,
      fromText: isPowerCutFromText,
      data,
      title: notification.title,
      body: notification.body,
    });
    
    // Extract device name from title or data
    let deviceName = data?.deviceName || data?.vehicle || 'Unknown Device';
    if (!deviceName || deviceName === 'Unknown Device') {
      const title = notification.title || '';
      const match = title.match(/^([A-Z0-9-]+)/);
      if (match) {
        deviceName = match[1];
      }
    }
    
    const deviceId = parseInt(data?.deviceId || data?.device_id || '0');
    const callerInfo = FakeCallService.generateCallerInfo('batteryCutoff', deviceName);
    console.log('[BackgroundNotifications] Triggering fake call for battery cutoff:', callerInfo);
    
    // Trigger native Android activity
    await triggerNativeFakeCall({
      callerName: callerInfo.name,
      callerNumber: callerInfo.number,
      alertType: 'batteryCutoff',
      deviceName: deviceName,
      deviceId: deviceId || undefined,
      message: notification.body || `${deviceName} battery has been cut off`,
    });
  }
  
  // Log if no matching alert type found
  if (data && !data.type && !data.alarmType && !data.eventType && !isPowerCutFromText) {
    console.log('[BackgroundNotifications] Notification data does not contain alert type:', {
      dataKeys: Object.keys(data),
      title: notification.title,
      body: notification.body,
    });
  }
}

/**
 * Handle notification tap (when user opens app from notification)
 */
function handleNotificationTap(notification: ActionPerformed) {
  const data = notification.notification?.data;
  
  if (data && data.deviceId) {
    // Store device ID for navigation when app opens
    if (typeof window !== 'undefined') {
      localStorage.setItem('pending_notification_device_id', data.deviceId.toString());
    }
  }
  
  // Navigate to relevant page if app is open
  if (typeof window !== 'undefined' && window.location) {
    // The app will handle navigation based on stored device ID
    // This will be processed by the main app when it loads
  }
}

/**
 * Check proximity and trigger fake call if needed
 * Works in background using Capacitor Geolocation
 */
async function checkProximityAndTriggerCall(deviceName: string, deviceLat: number, deviceLon: number, deviceId: number) {
  try {
    // Dynamically import Geolocation
    let Geolocation: any = null;
    try {
      const geoModule = await import('@capacitor/geolocation');
      Geolocation = geoModule.Geolocation;
    } catch (error) {
      console.warn('[BackgroundNotifications] Geolocation not available:', error);
      return;
    }

    // Check location permission
    const permissionStatus = await Geolocation.checkPermissions();
    if (permissionStatus.location !== 'granted') {
      console.warn('[BackgroundNotifications] Location permission not granted');
      // Store for processing when app opens
      storePendingLocationAlert(deviceName, deviceLat, deviceLon);
      return;
    }

    // Get current location
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    if (!position || !position.coords) {
      console.warn('[BackgroundNotifications] Could not get current location');
      storePendingLocationAlert(deviceName, deviceLat, deviceLon);
      return;
    }

    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    // Calculate distance
    const distanceMeters = haversineMeters(deviceLat, deviceLon, userLat, userLon);

    console.log('[BackgroundNotifications] Proximity check:', {
      deviceLocation: { lat: deviceLat, lon: deviceLon },
      userLocation: { lat: userLat, lon: userLon },
      distanceMeters,
      threshold: ALERT_DISTANCE_THRESHOLD_M,
    });

    // If distance is greater than threshold, trigger fake call
    if (distanceMeters > ALERT_DISTANCE_THRESHOLD_M) {
      const distanceText = distanceMeters >= 1000 
        ? `${(distanceMeters / 1000).toFixed(2)} km`
        : `${Math.round(distanceMeters)} m`;

      console.log('[BackgroundNotifications] Proximity alert triggered. Distance:', distanceText);
      const callerInfo = FakeCallService.generateCallerInfo('proximity', deviceName);
      console.log('[BackgroundNotifications] Triggering fake call for proximity:', callerInfo);
      
      // Trigger native Android activity
      triggerNativeFakeCall({
        callerName: callerInfo.name,
        callerNumber: callerInfo.number,
        alertType: 'proximity',
        deviceName: deviceName,
        deviceId: deviceId,
        message: `${deviceName} ignition detected. Distance: ${distanceText}`,
      });
    } else {
      console.log('[BackgroundNotifications] Proximity check passed - distance within threshold:', distanceMeters, 'm');
    }
  } catch (error) {
    console.error('[BackgroundNotifications] Error checking proximity:', error);
    // Store for processing when app opens
    storePendingLocationAlert(deviceName, deviceLat, deviceLon);
  }
}

/**
 * Trigger native fake call directly from push notification
 */
async function triggerNativeFakeCallFromPush(notification: PushNotificationSchema, detectedEvent?: string) {
  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  const data = (notification as any).data;
  const event = detectedEvent || data?.eventType || data?.type || data?.alarmType || data?.alarm;
  
  // Extract device name from notification title or data
  let deviceName = data?.deviceName || data?.vehicle || data?.deviceName || 'Unknown Device';
  
  // Try to extract device name from title (format: "TST-123 ...")
  if (!deviceName || deviceName === 'Unknown Device') {
    const title = notification.title || '';
    const match = title.match(/^([A-Z0-9-]+)/);
    if (match) {
      deviceName = match[1];
    }
  }
  
  console.log('[BackgroundNotifications] triggerNativeFakeCallFromPush:', {
    event,
    deviceName,
    title: notification.title,
    body: notification.body,
    dataKeys: data ? Object.keys(data) : [],
  });
  
  let alertType = 'batteryCutoff';
  if (event === 'geofence' || event === 'geofenceExit') {
    alertType = 'geofenceExit';
  } else if (event === 'proximity') {
    alertType = 'proximity';
  } else if (event === 'powerCut' || event === 'powerCutoff' || event === 'batteryCutoff') {
    alertType = 'batteryCutoff';
  }
  
  const deviceId = parseInt(data?.deviceId || data?.device_id || '0');
  const callerInfo = FakeCallService.generateCallerInfo(alertType, deviceName);
  
  await triggerNativeFakeCall({
    callerName: callerInfo.name,
    callerNumber: callerInfo.number,
    alertType: alertType,
    deviceName: deviceName,
    deviceId: deviceId || undefined,
    message: notification.body || notification.title || `${deviceName} alert`,
  });
}

/**
 * Trigger native Android FakeCallActivity
 */
async function triggerNativeFakeCall(config: {
  callerName: string;
  callerNumber: string;
  alertType: string;
  deviceName: string;
  deviceId?: number;
  message: string;
}) {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      console.log('[BackgroundNotifications] Native fake call only works on Android');
      // Fallback to JavaScript fake call for iOS
      fakeCallService.startCall({
        callerName: config.callerName,
        callerNumber: config.callerNumber,
        alertType: config.alertType as any,
        deviceName: config.deviceName,
        deviceId: config.deviceId,
        message: config.message,
      });
      return;
    }

    console.log('[BackgroundNotifications] Starting native FakeCallActivity with config:', config);
    
    // Use Capacitor native bridge to call the plugin
    try {
      const { registerPlugin } = await import('@capacitor/core');
      const FakeCall = registerPlugin<any>('FakeCall');
      
      console.log('[BackgroundNotifications] FakeCall plugin registered:', !!FakeCall);
      
      if (FakeCall && FakeCall.startFakeCall) {
        const result = await FakeCall.startFakeCall({
          callerName: config.callerName,
          callerNumber: config.callerNumber,
          alertType: config.alertType,
          deviceName: config.deviceName,
          message: config.message,
        });
        console.log('[BackgroundNotifications] FakeCallActivity started successfully:', result);
        return; // Success, exit early
      } else {
        console.warn('[BackgroundNotifications] FakeCall.startFakeCall method not available');
        throw new Error('FakeCall plugin method not available');
      }
    } catch (pluginError) {
      console.error('[BackgroundNotifications] Plugin error, trying direct Intent approach:', pluginError);
      
      // Fallback: Try to start activity directly via Capacitor bridge
      try {
        const { Capacitor } = await import('@capacitor/core');
        const bridge = (Capacitor as any).getPlatform() === 'android' ? (Capacitor as any).Plugins?.App : null;
        
        if (bridge && bridge.startActivity) {
          await bridge.startActivity({
            className: 'com.almuhafiz.tracker.FakeCallActivity',
            extras: {
              callerName: config.callerName,
              callerNumber: config.callerNumber,
              alertType: config.alertType,
              deviceName: config.deviceName,
              message: config.message,
            },
          });
          console.log('[BackgroundNotifications] FakeCallActivity started via bridge');
          return;
        }
      } catch (bridgeError) {
        console.error('[BackgroundNotifications] Bridge error:', bridgeError);
      }
      
      // If all else fails, throw to trigger fallback
      throw pluginError;
    }
  } catch (error) {
    console.error('[BackgroundNotifications] Error starting FakeCallActivity:', error);
    // Fallback to JavaScript fake call
    fakeCallService.startCall({
      callerName: config.callerName,
      callerNumber: config.callerNumber,
      alertType: config.alertType as any,
      deviceName: config.deviceName,
      deviceId: config.deviceId,
      message: config.message,
    });
  }
}

/**
 * Store pending location alert for processing when app opens
 */
function storePendingLocationAlert(deviceName: string, deviceLat: number, deviceLon: number) {
  if (typeof window !== 'undefined') {
    const alertData = {
      deviceName,
      deviceLat,
      deviceLon,
      timestamp: Date.now(),
    };
    localStorage.setItem('pending_location_alert', JSON.stringify(alertData));
    console.log('[BackgroundNotifications] Stored location alert for processing:', alertData);
  }
}

/**
 * Haversine formula to calculate distance between two coordinates in meters
 */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get stored FCM token (works even when logged out)
 */
export function getStoredFcmToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
}

/**
 * Store FCM token (works even when logged out)
 */
export function storeFcmToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
}

