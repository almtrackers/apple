"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';
import { useWebSocket } from '@/contexts/websocket-context';
import { useNotificationPreferences } from '@/contexts/notification-preferences-context';
import { speakText } from '@/lib/tts';
import { fakeCallService, FakeCallService } from '@/lib/fake-call-service';

let Geolocation: any = null;

// Haversine formula to calculate distance between two coordinates in meters
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

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  heading?: number; // Device heading/bearing in degrees (0-360)
}

const ALERT_DISTANCE_THRESHOLD_M = 25; // 25 meters threshold
const LOCATION_UPDATE_INTERVAL_MS = 30000; // Update location every 30 seconds
const MAX_LOCATION_AGE_MS = 60000; // Consider location valid for 1 minute

export const useLocationIgnitionAlert = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { devices: devicesMap, events } = useWebSocket();
  const { preferences } = useNotificationPreferences();

  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const currentLocationRef = useRef<LocationCoords | null>(null);
  const locationWatchIdRef = useRef<string | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const lastIgnitionOnRef = useRef<Map<number, number>>(new Map()); // Track last ignitionOn time per device to avoid duplicate alerts
  const processedEventIdsRef = useRef<Set<number>>(new Set()); // Track processed event IDs to avoid duplicate processing

  useEffect(() => {
    setIsMobile(Capacitor.getPlatform() !== 'web');
    try {
      // Try to import Capacitor Geolocation
      const geoModule = require('@capacitor/geolocation');
      if (geoModule && geoModule.Geolocation) {
        Geolocation = geoModule.Geolocation;
      }
    } catch (error) {
      console.warn('[LocationAlert] Geolocation plugin not available, will use browser API:', error);
      // Fallback to browser Geolocation API if Capacitor plugin not available
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        Geolocation = {
          checkPermissions: async () => {
            // Browser doesn't have permission status API, return prompt
            return { location: 'prompt' };
          },
          requestPermissions: async () => {
            return { location: 'prompt' };
          },
          getCurrentPosition: async (options: any) => {
            return new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                  },
                }),
                reject,
                options
              );
            });
          },
          watchPosition: async (options: any, callback: any) => {
            const watchId = navigator.geolocation.watchPosition(
              (position) => callback({
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                },
              }),
              (error) => console.error('[LocationAlert] Geolocation error:', error),
              options
            );
            return watchId.toString();
          },
          clearWatch: async ({ id }: { id: string }) => {
            navigator.geolocation.clearWatch(parseInt(id));
          },
        };
      }
    }
  }, []);

  // Request location permissions
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!isMobile) {
      console.log('[LocationAlert] Not a mobile device, skipping location permission request');
      return false;
    }

    if (!Geolocation) {
      console.warn('[LocationAlert] Geolocation plugin not available');
      return false;
    }

    try {
      const status = await Geolocation.checkPermissions();
      console.log('[LocationAlert] Current permission status:', status);

      if (status.location === 'granted') {
        setHasLocationPermission(true);
        return true;
      }

      if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
        const requestStatus = await Geolocation.requestPermissions();
        console.log('[LocationAlert] Permission request result:', requestStatus);

        if (requestStatus.location === 'granted') {
          setHasLocationPermission(true);
          return true;
        } else {
          toast({
            variant: 'destructive',
            title: 'Location Permission Required',
            description: 'Location access is required for vehicle start alerts. Please enable it in app settings.',
          });
          setHasLocationPermission(false);
          return false;
        }
      }

      // Permission denied
      toast({
        variant: 'destructive',
        title: 'Location Permission Denied',
        description: 'Location access is required for vehicle start alerts. Please enable it in app settings.',
      });
      setHasLocationPermission(false);
      return false;
    } catch (error) {
      console.error('[LocationAlert] Error requesting location permission:', error);
      toast({
        variant: 'destructive',
        title: 'Location Error',
        description: 'Failed to request location permission.',
      });
      return false;
    }
  }, [isMobile, toast]);

  // Get current location
  const getCurrentLocation = useCallback(async (): Promise<LocationCoords | null> => {
    if (!isMobile || !hasLocationPermission || !Geolocation) {
      return null;
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });

      const location: LocationCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || undefined,
        timestamp: Date.now(),
        heading: position.coords.heading !== undefined && !isNaN(position.coords.heading) 
          ? position.coords.heading 
          : undefined,
      };

      currentLocationRef.current = location;
      setCurrentLocation(location);
      lastLocationUpdateRef.current = Date.now();
      console.log('[LocationAlert] Current location updated:', location);
      return location;
    } catch (error: any) {
      console.error('[LocationAlert] Error getting current location:', error);
      return null;
    }
  }, [isMobile, hasLocationPermission]);

  // Watch location updates
  const startLocationWatch = useCallback(async () => {
    if (!isMobile || !hasLocationPermission || locationWatchIdRef.current || !Geolocation) {
      return;
    }

    try {
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        },
        (position) => {
          if (position) {
            const location: LocationCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || undefined,
              timestamp: Date.now(),
              heading: position.coords.heading !== undefined && !isNaN(position.coords.heading) 
                ? position.coords.heading 
                : undefined,
            };

            currentLocationRef.current = location;
            setCurrentLocation(location);
            lastLocationUpdateRef.current = Date.now();
            console.log('[LocationAlert] Location updated via watch:', location);
          }
        },
        (error) => {
          console.error('[LocationAlert] Location watch error:', error);
        }
      );

      locationWatchIdRef.current = watchId;
      setIsLocationEnabled(true);
      console.log('[LocationAlert] Location watch started:', watchId);
    } catch (error) {
      console.error('[LocationAlert] Error starting location watch:', error);
      setIsLocationEnabled(false);
    }
  }, [isMobile, hasLocationPermission]);

  // Stop location watch
  const stopLocationWatch = useCallback(() => {
    if (locationWatchIdRef.current && Geolocation) {
      Geolocation.clearWatch({ id: locationWatchIdRef.current });
      locationWatchIdRef.current = null;
      setIsLocationEnabled(false);
      console.log('[LocationAlert] Location watch stopped');
    }
  }, []);

  // Check location and show alert if needed
  const checkLocationAndAlert = useCallback(async (
    deviceName: string,
    deviceLat: number,
    deviceLon: number,
    deviceId: number
  ) => {
    if (!isMobile || !hasLocationPermission) {
      return;
    }

    // Get or use cached location
    let userLocation = currentLocationRef.current;
    const now = Date.now();

    // If location is too old or doesn't exist, get fresh location
    if (!userLocation || (now - lastLocationUpdateRef.current) > MAX_LOCATION_AGE_MS) {
      console.log('[LocationAlert] Getting fresh location for comparison');
      userLocation = await getCurrentLocation();
    }

    if (!userLocation) {
      console.warn('[LocationAlert] Cannot get user location, skipping alert check');
      return;
    }

    // Calculate distance between device location and user location
    const distanceMeters = haversineMeters(
      deviceLat,
      deviceLon,
      userLocation.latitude,
      userLocation.longitude
    );

    console.log('[LocationAlert] Distance check:', {
      deviceLocation: { lat: deviceLat, lon: deviceLon },
      userLocation: { lat: userLocation.latitude, lon: userLocation.longitude },
      distanceMeters,
      threshold: ALERT_DISTANCE_THRESHOLD_M,
    });

    // If distance is greater than threshold, show alert
    if (distanceMeters > ALERT_DISTANCE_THRESHOLD_M) {
      // Format distance for display
      const distanceText = distanceMeters >= 1000 
        ? `${(distanceMeters / 1000).toFixed(2)} km`
        : `${Math.round(distanceMeters)} m`;

      const alertMessage = `${deviceName}:Ignition On`;
      const distanceMessage = `Gardi say aapki Dori ${distanceText}`;
      const fullMessage = `${alertMessage}\n${distanceMessage}`;

      console.log('[LocationAlert] Alert triggered:', fullMessage);

      // Show toast notification
      toast({
        variant: 'destructive',
        title: 'Vehicle Start Alert',
        description: `${alertMessage}\n${distanceMessage}`,
      });

      // Speak alert
      try {
        await speakText({
          text: fullMessage,
          locale: 'ur-PK', // Urdu locale
        });
      } catch (error) {
        console.error('[LocationAlert] Error speaking alert:', error);
      }

      // Trigger fake call for proximity alert (only on mobile and if enabled)
      // Note: Background notifications also handle this, but we trigger here for immediate feedback when app is active
      if (Capacitor.getPlatform() !== 'web' && preferences.fakeCallAlert && preferences.proximityAlert) {
        const callerInfo = FakeCallService.generateCallerInfo('proximity', deviceName);
        fakeCallService.startCall({
          callerName: callerInfo.name,
          callerNumber: callerInfo.number,
          alertType: 'proximity',
          deviceName: deviceName,
          deviceId: deviceId,
          message: `${deviceName} ignition detected. Distance: ${distanceText}`,
        });
      }
    }
  }, [isMobile, hasLocationPermission, getCurrentLocation, toast, preferences]);

  // Initialize location permissions and watch on mount (mobile only)
  useEffect(() => {
    if (!isMobile || !user) {
      console.log('[LocationAlert] Skipping initialization - not mobile or user not logged in');
      return;
    }

    const initializeLocation = async () => {
      // Request location permission
      const hasPermission = await requestLocationPermission();
      
      if (hasPermission) {
        // Get initial location
        await getCurrentLocation();
        // Start watching location
        await startLocationWatch();
      }
    };

    initializeLocation();

    return () => {
      stopLocationWatch();
    };
  }, [isMobile, user, requestLocationPermission, getCurrentLocation, startLocationWatch, stopLocationWatch]);

  // Listen for Firebase push notifications with ignitionOn events
  useEffect(() => {
    if (!isMobile || !hasLocationPermission) {
      return;
    }

    const handlePushNotification = (notification: PushNotificationSchema) => {
      console.log('[LocationAlert] Push notification received:', notification);

      // Check if this is an ignitionOn event
      const data = (notification as any).data;
      if (!data || data.type !== 'ignitionOn') {
        return;
      }

      // Extract device information and location from notification
      const deviceId = parseInt(data.deviceId || data.device_id || '0');
      const deviceName = data.deviceName || data.vehicle || 'Unknown Device';
      const deviceLat = parseFloat(data.latitude || data.lat);
      const deviceLon = parseFloat(data.longitude || data.lon || data.lng);

      if (isNaN(deviceLat) || isNaN(deviceLon)) {
        console.warn('[LocationAlert] Invalid device location in notification:', data);
        return;
      }

      // Check if we've already processed this ignitionOn event recently (avoid duplicate alerts)
      const now = Date.now();
      const lastTime = lastIgnitionOnRef.current.get(deviceId) || 0;
      if (now - lastTime < 5000) { // 5 second cooldown per device
        console.log('[LocationAlert] Ignoring duplicate ignitionOn event for device:', deviceId);
        return;
      }
      lastIgnitionOnRef.current.set(deviceId, now);

      console.log('[LocationAlert] IgnitionOn event detected from Firebase:', {
        deviceId,
        deviceName,
        deviceLocation: { lat: deviceLat, lon: deviceLon },
      });

      // Check location and show alert if needed
      checkLocationAndAlert(deviceName, deviceLat, deviceLon, deviceId);
    };

    // Add listener for push notifications
    const removeListener = PushNotifications.addListener(
      'pushNotificationReceived',
      handlePushNotification
    );

    return () => {
      removeListener.remove();
    };
  }, [isMobile, hasLocationPermission, checkLocationAndAlert]);

  // Listen for WebSocket ignitionOn events (for web platform or when Firebase is not available)
  useEffect(() => {
    if (!hasLocationPermission) {
      return;
    }

    // Listen for ignitionOn events from WebSocket events array
    // Only process new events (events we haven't seen before)
    const ignitionOnEvents = events.filter(
      (event) => 
        event.type === 'ignitionOn' && 
        event.positionId &&
        !processedEventIdsRef.current.has(event.id) // Only process new events
    );

    ignitionOnEvents.forEach((event) => {
      // Mark this event as processed
      processedEventIdsRef.current.add(event.id);

      // Get device details
      const device = devicesMap[event.deviceId];
      if (!device || !device.position) return;

      const deviceLat = device.position.latitude;
      const deviceLon = device.position.longitude;

      if (!deviceLat || !deviceLon) {
        console.warn('[LocationAlert] Device position not available for event:', event);
        return;
      }

      // Check if we've already processed this ignitionOn event recently (avoid duplicate alerts)
      const now = Date.now();
      const lastTime = lastIgnitionOnRef.current.get(event.deviceId) || 0;
      if (now - lastTime < 5000) { // 5 second cooldown per device
        console.log('[LocationAlert] Ignoring duplicate ignitionOn event for device:', event.deviceId);
        return;
      }
      lastIgnitionOnRef.current.set(event.deviceId, now);

      console.log('[LocationAlert] IgnitionOn event detected from WebSocket:', {
        deviceId: event.deviceId,
        deviceName: device.name,
        deviceLocation: { lat: deviceLat, lon: deviceLon },
      });

      // Check location and show alert if needed
      checkLocationAndAlert(device.name, deviceLat, deviceLon, event.deviceId);
    });

    // Clean up old processed event IDs (keep only last 100)
    if (processedEventIdsRef.current.size > 100) {
      const eventIds = Array.from(processedEventIdsRef.current);
      const recentEventIds = events.slice(-50).map(e => e.id);
      const toKeep = new Set(recentEventIds);
      processedEventIdsRef.current = toKeep;
    }
  }, [events, devicesMap, hasLocationPermission, checkLocationAndAlert]);

  return {
    hasLocationPermission,
    isLocationEnabled,
    currentLocation,
    requestLocationPermission,
    getCurrentLocation,
    startLocationWatch,
    stopLocationWatch,
  };
};
