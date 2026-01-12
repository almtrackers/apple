
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback, startTransition } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useNotificationPreferences } from "@/contexts/notification-preferences-context";
import { NotificationService } from "@/lib/notification-service";
import { speakText, buildVehicleAlertSpeech } from "@/lib/tts";
import { fakeCallService, FakeCallService } from "@/lib/fake-call-service";
import apiClient from "@/lib/api";

// --- Type Definitions ---

interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
  positionId: number;
  geofenceIds?: number[];
  attributes: { [key: string]: any };
  position?: Position;
  category?: string;
  expirationTime?: string;
}

interface Position {
  id?: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  attributes: { [key: string]: any };
  serverTime?: string;
  deviceTime?: string;
}

interface Geofence {
  id: number;
  name: string;
}

interface TraccarEvent {
  id: number;
  type: string;
  serverTime: string;
  deviceId: number;
  positionId: number;
  geofenceId: number;
  attributes: any;
  deviceName: string;
  geofenceName?: string;
}

type IgnitionState = { [deviceId: number]: boolean };

interface AppState {
  devices: { [id: number]: Device };
  positions: { [id: number]: Position };
  geofences: { [id: number]: Geofence };
  events: TraccarEvent[];
  ignition: IgnitionState;
  isLoading: boolean;
  isConnected: boolean;
}

// --- Helper Functions ---

function mapById<T extends { id?: number }>(arr: T[]): { [id: number]: T } {
  if (!arr) return {};
  return arr.reduce((acc, obj) => {
    if (obj?.id == null) return acc;
    acc[obj.id] = obj;
    return acc;
  }, {} as { [id: number]: T });
}

const STATUS_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_EVENTS = 25;
const HEARTBEAT_INTERVAL_MS = 30000; // send ping/check every 30s
const STALL_TIMEOUT_MS = 60000; // if no activity for 60s, force reconnect
const BASE_RECONNECT_DELAY_MS = 2000; // base backoff
const MAX_RECONNECT_DELAY_MS = 30000; // cap backoff at 30s

function bestTimestamp(dev?: Partial<Device>, pos?: Position): string | undefined {
  return dev?.lastUpdate || pos?.serverTime || pos?.deviceTime;
}

function computeStatus(lastUpdateIso?: string, nowMs = Date.now()): string {
  if (!lastUpdateIso) return "unknown";
  const delta = nowMs - new Date(lastUpdateIso).getTime();
  return delta <= STATUS_TIMEOUT_MS ? "online" : "offline";
}

function isDeviceExpired(device?: Partial<Device>): boolean {
  if (!device?.expirationTime) return false;
  const exp = Date.parse(device.expirationTime);
  if (Number.isNaN(exp)) return false;
  return Date.now() > exp;
}

// Coerce various time shapes to ISO string
function toIsoTime(value: any): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const ms = n < 1e12 ? n * 1000 : n;
      return new Date(ms).toISOString();
    }
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return undefined;
}

// Ensure every event has a usable serverTime; fallback to common alternates or device times
function ensureEventServerTime(ev: any, relatedDevice?: Device): string {
  const candidates = [
    ev?.serverTime,
    ev?.eventTime,
    ev?.time,
    ev?.attributes?.serverTime,
    ev?.attributes?.eventTime,
    ev?.attributes?.time,
    relatedDevice?.lastUpdate,
    relatedDevice?.position?.serverTime,
    relatedDevice?.position?.deviceTime,
  ];
  for (const c of candidates) {
    const iso = toIsoTime(c);
    if (iso) return iso;
  }
  return new Date().toISOString();
}

function enrichEvent(event: TraccarEvent, devices: { [id: number]: Device }, geofences: { [id: number]: Geofence }): TraccarEvent {
  const device = devices[event.deviceId];
  const serverTimeIso = ensureEventServerTime(event, device);
  return {
    ...event,
    serverTime: serverTimeIso,
    deviceName: device?.name || "Unknown Device",
    geofenceName: geofences[event.geofenceId]?.name || undefined,
  };
}

function mergeEvents(existing: TraccarEvent[], incoming: TraccarEvent[] | undefined, devices: { [id: number]: Device }, geofences: { [id: number]: Geofence }): TraccarEvent[] {
  if (!incoming || incoming.length === 0) return existing;
  const byId = new Map<number, TraccarEvent>();
  for (const e of existing) byId.set(e.id, e);
  for (const e of incoming) byId.set(e.id, enrichEvent(e, devices, geofences));
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime())
    .slice(0, MAX_EVENTS);
}

function buildSocketUrlFromApiBase(token?: string | null) {
  const isNative = Capacitor.isNativePlatform();
  const apiBase = isNative ? 'https://app.almtrace.com/api' : (apiClient?.defaults?.baseURL as string) || window.location.origin;
  const apiUrl = new URL(apiBase, isNative ? undefined : window.location.href);
  const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsOrigin = `${wsProtocol}//${apiUrl.host}`;
  const base = `${wsOrigin}/api/socket`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// Map event types to notification types and priorities
function mapEventTypeToNotification(eventType: string, alarmType?: string): { type: string; priority: 'low' | 'medium' | 'high' | 'critical' } {
  // Handle alarm events - check the alarm type in attributes
  if (eventType === 'alarm' && alarmType) {
    const alarmMap: { [key: string]: { type: string; priority: 'low' | 'medium' | 'high' | 'critical' } } = {
      'overspeed': { type: 'speeding', priority: 'high' },
      'speeding': { type: 'speeding', priority: 'high' },
      'sos': { type: 'emergency', priority: 'critical' },
      'panic': { type: 'emergency', priority: 'critical' },
      'emergency': { type: 'emergency', priority: 'critical' },
      'lowBattery': { type: 'batteryLow', priority: 'medium' },
      'batteryCutoff': { type: 'batteryCutoff', priority: 'critical' },
      'powerCutoff': { type: 'batteryCutoff', priority: 'critical' },
      'lowFuel': { type: 'fuelLow', priority: 'medium' },
      'harshBraking': { type: 'harshBraking', priority: 'high' },
      'rapidAcceleration': { type: 'rapidAcceleration', priority: 'high' },
      'idleTime': { type: 'idleTime', priority: 'low' },
    };
    return alarmMap[alarmType] || { type: 'emergency', priority: 'high' };
  }
  
  // Map other event types
  const typeMap: { [key: string]: { type: string; priority: 'low' | 'medium' | 'high' | 'critical' } } = {
    'geofenceEnter': { type: 'geofenceEnter', priority: 'medium' },
    'geofenceExit': { type: 'geofenceExit', priority: 'medium' },
    'deviceOnline': { type: 'deviceOnline', priority: 'low' },
    'deviceOffline': { type: 'deviceOffline', priority: 'high' },
    'maintenance': { type: 'maintenance', priority: 'medium' },
    'ignitionOn': { type: 'engineControl', priority: 'low' },
    'ignitionOff': { type: 'engineControl', priority: 'low' },
  };
  
  return typeMap[eventType] || { type: eventType, priority: 'medium' };
}

// Format event message for notification
function formatEventMessage(event: TraccarEvent, deviceName: string): string {
  // Use message from attributes if available
  if (event.attributes?.message) {
    return event.attributes.message;
  }
  
  // Build message based on event type
  if (event.type === 'alarm' && event.attributes?.alarm) {
    const alarmType = event.attributes.alarm;
    if (alarmType === 'overspeed' || alarmType === 'speeding') {
      const speed = event.attributes?.speed || 0;
      const speedKmh = (speed * 1.852).toFixed(0);
      return `${deviceName} is speeding at ${speedKmh} km/h`;
    }
    if (alarmType === 'sos' || alarmType === 'panic') {
      return `EMERGENCY: ${deviceName} has triggered SOS/panic alarm`;
    }
    if (alarmType === 'lowBattery') {
      return `${deviceName} has low battery`;
    }
    if (alarmType === 'lowFuel') {
      return `${deviceName} has low fuel`;
    }
    return `${deviceName}: ${alarmType} alert`;
  }
  
  if (event.type === 'geofenceEnter' || event.type === 'geofenceExit') {
    const action = event.type === 'geofenceEnter' ? 'entered' : 'exited';
    return `${deviceName} has ${action} ${event.geofenceName || 'geofence'}`;
  }
  
  if (event.type === 'deviceOnline' || event.type === 'deviceOffline') {
    const status = event.type === 'deviceOnline' ? 'online' : 'offline';
    return `${deviceName} is now ${status}`;
  }
  
  if (event.type === 'maintenance') {
    return `${deviceName} requires maintenance`;
  }
  
  // Default message
  return `${deviceName}: ${event.type}`;
}

// Handle event notification display
function handleEventNotification(
  event: TraccarEvent, 
  deviceName: string, 
  notificationService: NotificationService,
  preferences?: { fakeCallAlert?: boolean }
) {
  // Determine notification type and priority
  const alarmType = event.type === 'alarm' ? event.attributes?.alarm : undefined;
  const { type: notificationType, priority } = mapEventTypeToNotification(event.type, alarmType);
  
  // Format message
  const message = formatEventMessage(event, deviceName);
  
  // Format title
  let title = '';
  if (event.type === 'alarm' && alarmType) {
    if (alarmType === 'overspeed' || alarmType === 'speeding') {
      title = 'Speeding Alert';
    } else if (alarmType === 'sos' || alarmType === 'panic') {
      title = 'Emergency Alert';
    } else {
      title = `${alarmType.charAt(0).toUpperCase() + alarmType.slice(1)} Alert`;
    }
  } else {
    title = `${event.type.charAt(0).toUpperCase() + event.type.slice(1)}`;
  }
  
  // Show notification
  notificationService.showNotification({
    type: notificationType,
    deviceId: event.deviceId,
    deviceName,
    title,
    message,
    priority,
    timestamp: event.serverTime || new Date().toISOString(),
    data: event,
  });
  
  // Play sound for critical/high priority events
  if (priority === 'critical' || priority === 'high') {
    try {
      // Try to play alarm sound (if available)
      const audio = new Audio('/alarm.mp3');
      audio.play().catch(() => {
        // Fallback to system beep if audio file not available
        console.log('[WebSocket] Alarm sound not available');
      });
    } catch (e) {
      console.log('[WebSocket] Could not play alarm sound:', e);
    }
  }
  
  // Text-to-speech for critical events
  if (priority === 'critical' && event.type === 'alarm') {
    const speech = buildVehicleAlertSpeech({
      alertType: alarmType,
      vehicle: deviceName,
      message: message,
    });
    speakText({ text: speech, locale: 'en-US' }).catch(() => {
      // TTS failed, ignore
    });
  }

  // Note: Fake calls are now handled by Firebase push notifications in background
  // This ensures they work even when logged out or app is in background
  // Only trigger fake call here if app is active and user is logged in (for immediate feedback)
  // Background notifications will handle the main fake call triggering
  if (Capacitor.getPlatform() !== 'web' && preferences?.fakeCallAlert !== false) {
    // Normalize alarm type for comparison (handle various formats)
    const normalizedAlarmType = alarmType?.toLowerCase().replace(/\s+/g, '');
    const isPowerCutoff = normalizedAlarmType === 'batterycutoff' || 
                          normalizedAlarmType === 'powercutoff' || 
                          normalizedAlarmType === 'powercut' ||
                          alarmType === 'batteryCutoff' || 
                          alarmType === 'powerCutoff' ||
                          alarmType === 'Power Cut' ||
                          alarmType === 'powerCut';
    
    const shouldTriggerFakeCall = 
      (event.type === 'alarm' && isPowerCutoff) ||
      (event.type === 'geofenceExit');

    if (shouldTriggerFakeCall) {
      console.log('[WebSocket] Triggering fake call for alarm:', {
        alarmType,
        normalizedAlarmType,
        isPowerCutoff,
        eventType: event.type,
      });
      
      const callerInfo = FakeCallService.generateCallerInfo(
        event.type === 'alarm' ? 'batteryCutoff' : 'geofenceExit',
        deviceName
      );

      fakeCallService.startCall({
        callerName: callerInfo.name,
        callerNumber: callerInfo.number,
        alertType: event.type === 'alarm' ? 'batteryCutoff' : 'geofenceExit',
        deviceName: deviceName,
        deviceId: event.deviceId,
        message: message,
      });
    }
  }
}

// --- Context Definition ---

const AppStateContext = createContext<AppState | undefined>(undefined);

// --- Provider Component ---

// Session-based token storage key
const SESSION_TOKEN_KEY = 'session_token';

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, logout, user } = useAuth();
  const { toast } = useToast();
  const { preferences } = useNotificationPreferences();
  usePushNotifications(); // Register for push notifications
  
  // Initialize notification service (singleton)
  const notificationService = NotificationService.getInstance();
  
  // Re-initialize notification service when dependencies change
  useEffect(() => {
    notificationService.initialize(toast, preferences, user);
  }, [toast, preferences, user]);
  
  const [state, setState] = useState<AppState>({
    devices: {},
    positions: {},
    geofences: {},
    events: [],
    ignition: {},
    isLoading: true,
    isConnected: false,
  });
  const socketRef = useRef<WebSocket | null>(null);
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTsRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const onlineListenerRef = useRef<() => void>();
  const offlineListenerRef = useRef<() => void>();
  const offlineSignoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNotificationsRef = useRef<Array<{ event: TraccarEvent; deviceName: string }>>([]);

  // Token refresh function
  const refreshSessionToken = useCallback(async () => {
    try {
      const shortExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      const tokenRes = await apiClient.post('/session/token', 
        new URLSearchParams(`expiration=${shortExpiration}`)
      );
      if (tokenRes.data) {
        const newToken = typeof tokenRes.data === 'string' ? tokenRes.data : tokenRes.data.token;
        if (newToken) {
          sessionStorage.setItem(SESSION_TOKEN_KEY, newToken);
          console.log("Session token refreshed successfully");
          return newToken;
        }
      }
    } catch (error) {
      console.error("Failed to refresh session token:", error);
    }
    return null;
  }, []);

  // Start token refresh interval
  const startTokenRefresh = useCallback(() => {
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
    }
    // Refresh token every 30 minutes (before 1-hour expiration)
    tokenRefreshIntervalRef.current = setInterval(refreshSessionToken, 30 * 60 * 1000);
  }, [refreshSessionToken]);

  // Stop token refresh interval
  const stopTokenRefresh = useCallback(() => {
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }
  }, []);

  // --- Local position history (per device) persisted in localStorage ---
  const positionHistoryQueueRef = useRef<Map<number, any>>(new Map());
  const historyWriteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function appendPositionHistory(pos: any) {
    try {
      const deviceId = pos.deviceId;
      if (!deviceId || !pos.latitude || !pos.longitude) return;
      // Queue position for batched write
      positionHistoryQueueRef.current.set(deviceId, pos);
      
      // Debounce localStorage writes - batch them every 500ms
      if (historyWriteTimeoutRef.current) {
        clearTimeout(historyWriteTimeoutRef.current);
      }
      historyWriteTimeoutRef.current = setTimeout(() => {
        const queue = new Map(positionHistoryQueueRef.current);
        positionHistoryQueueRef.current.clear();
        
        // Use requestIdleCallback if available, otherwise setTimeout
        const writeHistory = () => {
          queue.forEach((pos, deviceId) => {
            try {
              const tsStr: string | undefined = pos.serverTime || pos.deviceTime;
              const ts = tsStr ? new Date(tsStr).getTime() : Date.now();
              const key = `deviceHistory:${deviceId}`;
              const raw = localStorage.getItem(key);
              const arr: Array<{ lat: number; lng: number; course: number; speed?: number; ts: number }>
                = raw ? JSON.parse(raw) : [];
              // Push new point
              arr.push({ lat: pos.latitude, lng: pos.longitude, course: pos.course || 0, speed: pos.speed, ts });
              // Keep only last 10 minutes or last 600 entries, whichever smaller
              const cutoff = Date.now() - 10 * 60 * 1000;
              const pruned = arr.filter(p => p.ts >= cutoff);
              const limited = pruned.length > 600 ? pruned.slice(pruned.length - 600) : pruned;
              localStorage.setItem(key, JSON.stringify(limited));
            } catch (_) {
              // ignore storage errors
            }
          });
        };
        
        if ('requestIdleCallback' in window) {
          requestIdleCallback(writeHistory, { timeout: 1000 });
        } else {
          setTimeout(writeHistory, 0);
        }
      }, 500);
    } catch (_) {
      // ignore storage errors
    }
  }

  useEffect(() => {
    let isComponentMounted = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWebSocket = async () => {
      if (socketRef.current || !isComponentMounted || !isAuthenticated) {
        return;
      }
      
      // Get session token from session storage (not localStorage for security)
      let token = sessionStorage.getItem(SESSION_TOKEN_KEY);

      if (!token) {
        try {
            // Generate a new session token if none exists
            const shortExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
            const tokenRes = await apiClient.post('/session/token', 
              new URLSearchParams(`expiration=${shortExpiration}`)
            );
            if (tokenRes.data) {
                const fetchedToken = typeof tokenRes.data === 'string' ? tokenRes.data : tokenRes.data.token;
                if (fetchedToken) {
                    sessionStorage.setItem(SESSION_TOKEN_KEY, fetchedToken);
                    token = fetchedToken;
                    console.log("Generated new session token for WebSocket authentication.");
                }
            }
        } catch (error) {
            console.error("Failed to generate session token for WebSocket, will try cookie-based auth.", error);
        }
      } else {
        console.log("Using existing session token for WebSocket.");
      }

      const socketUrl = buildSocketUrlFromApiBase(token);

      console.log(`Attempting to connect WebSocket to ${socketUrl}`);

      socketRef.current = new WebSocket(socketUrl);

      socketRef.current.onopen = () => {
        console.log("WebSocket connected");
        if (isComponentMounted) {
          setState(prevState => ({ ...prevState, isConnected: true }));
          socketRef.current?.send(JSON.stringify({ logs: true }));
          // Start token refresh when WebSocket connects
          startTokenRefresh();
          // Reset reconnect attempts on successful connect
          reconnectAttemptsRef.current = 0;
          // Mark activity and start heartbeat/watchdog
          lastActivityTsRef.current = Date.now();
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => {
            const now = Date.now();
            const inactiveForMs = now - lastActivityTsRef.current;
            // If stalled beyond timeout, force reconnect
            if (inactiveForMs > STALL_TIMEOUT_MS) {
              console.warn("WebSocket appears stalled (no activity)", { inactiveForMs });
              // Force close to trigger reconnect
              try { socketRef.current?.close(); } catch {}
              return;
            }
            // Send lightweight ping to keep-alive
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              try { socketRef.current.send(JSON.stringify({ ping: now })); } catch {}
            }
          }, HEARTBEAT_INTERVAL_MS);
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      };

      socketRef.current.onmessage = (event) => {
        if (!isComponentMounted) return;
        // Track last activity on any message
        lastActivityTsRef.current = Date.now();
        
        // Parse JSON in a try-catch to prevent blocking
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
          return;
        }

        // Process message asynchronously to prevent blocking
        const processMessage = () => {
          if (!isComponentMounted) return;
          
          // Use startTransition for non-urgent updates to prevent blocking
          startTransition(() => {
            setState(prev => {
              // Only create new objects if we actually have updates
              const hasDevices = msg.devices && Array.isArray(msg.devices) && msg.devices.length > 0;
              const hasPositions = msg.positions && Array.isArray(msg.positions) && msg.positions.length > 0;
              const hasEvents = msg.events && Array.isArray(msg.events) && msg.events.length > 0;
              
              if (!hasDevices && !hasPositions && !hasEvents) {
                return prev; // No changes, return previous state
              }

              const newState: AppState = { 
                ...prev, 
                devices: hasDevices || hasPositions ? { ...prev.devices } : prev.devices, 
                events: hasEvents ? [...prev.events] : prev.events,
                ignition: hasPositions || hasEvents ? { ...prev.ignition } : prev.ignition
              };

              if (hasDevices) {
                msg.devices.forEach((d: Device) => {
                  const existing = newState.devices[d.id];
                  if (existing) {
                    // Only update if there are actual changes
                    const ts = d.lastUpdate || bestTimestamp(existing, existing.position);
                    const newStatus = d.status || computeStatus(ts);
                    if (existing.lastUpdate !== ts || existing.status !== newStatus) {
                      newState.devices[d.id] = {
                        ...existing,
                        ...d,
                        lastUpdate: ts || existing.lastUpdate,
                        status: newStatus,
                      };
                    }
                  } else {
                    const merged = { ...d };
                    const ts = d.lastUpdate || bestTimestamp(merged, merged.position);
                    merged.lastUpdate = ts || merged.lastUpdate;
                    merged.status = d.status || computeStatus(ts);
                    newState.devices[d.id] = merged;
                  }
                });
              }
              
              if (hasPositions) {
                msg.positions.forEach((pos: Position) => {
                  const prevDev = newState.devices[pos.deviceId];
                  if (prevDev && !isDeviceExpired(prevDev)) {
                    const ts = pos.serverTime || pos.deviceTime || prevDev.lastUpdate;
                    const newStatus = computeStatus(ts || prevDev.lastUpdate);
                    newState.devices[pos.deviceId] = {
                      ...prevDev,
                      attributes: {
                        ...prevDev.attributes,
                        ...pos.attributes,
                      },
                      position: { ...prevDev.position, ...pos },
                      lastUpdate: ts || prevDev.lastUpdate,
                      status: newStatus,
                    };
                    if (pos.attributes?.ignition !== undefined) {
                        newState.ignition[pos.deviceId] = !!pos.attributes.ignition;
                    }
                    // Append to local history buffer for delayed playback (e.g., 12s behind)
                    appendPositionHistory(pos);
                  }
                });
              }

              if (hasEvents) {
                  const enriched = msg.events
                    .filter((e: any) => !isDeviceExpired(newState.devices[e.deviceId]))
                    .map((e: any) => enrichEvent(e, newState.devices, newState.geofences));
                  newState.events = mergeEvents(newState.events, enriched, newState.devices, newState.geofences);
                  
                  // Process events for notifications (queue them to be processed after state update)
                  enriched.forEach((evt: TraccarEvent) => {
                    const deviceToUpdate = newState.devices[evt.deviceId];
                    if (!deviceToUpdate || isDeviceExpired(deviceToUpdate)) return;
                    
                    // Update device status based on event type
                    const updatedDevice = { ...deviceToUpdate };
                    if (evt.type === "deviceOnline") updatedDevice.status = "online";
                    if (evt.type === "deviceOffline") updatedDevice.status = "offline";
                    if (evt.type === "ignitionOn") newState.ignition[evt.deviceId] = true;
                    if (evt.type === "ignitionOff") newState.ignition[evt.deviceId] = false;
                    updatedDevice.lastUpdate = evt.serverTime || updatedDevice.lastUpdate;
                    newState.devices[evt.deviceId] = updatedDevice;
                    
                    // Queue notification for processing after state update (only on web platform)
                    if (typeof window !== 'undefined') {
                      pendingNotificationsRef.current.push({ event: evt, deviceName: deviceToUpdate.name });
                    }
                  });
              }

              return newState;
            });
          });
          
          // Process queued notifications after state update completes (defer to next tick)
          if (pendingNotificationsRef.current.length > 0 && typeof window !== 'undefined') {
            // Use requestIdleCallback if available for better performance
            const processNotifications = () => {
              const notifications = [...pendingNotificationsRef.current];
              pendingNotificationsRef.current = [];
              notifications.forEach(({ event, deviceName }) => {
                handleEventNotification(event, deviceName, notificationService, preferences);
              });
            };
            
            if ('requestIdleCallback' in window) {
              requestIdleCallback(processNotifications, { timeout: 2000 });
            } else {
              requestAnimationFrame(() => {
                setTimeout(processNotifications, 0);
              });
            }
          }
        };

        // Defer processing to next tick to prevent blocking
        if ('requestIdleCallback' in window) {
          requestIdleCallback(processMessage, { timeout: 100 });
        } else {
          setTimeout(processMessage, 0);
        }
      };

      socketRef.current.onclose = async (event) => {
        console.warn(`WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason}"`);
        socketRef.current = null;
        if (isComponentMounted) {
          setState(prevState => ({ ...prevState, isConnected: false }));
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
          
          // Check session validity before attempting reconnect
          try {
            const sessionCheck = await apiClient.get('/session');
            if (sessionCheck.status !== 200) {
              console.warn("Session expired, logging out");
              logout();
              return;
            }
            
            // Session is valid, try to get new session token for WebSocket
            const newToken = await refreshSessionToken();
            if (newToken) {
              console.log("Obtained new session token for WebSocket reconnect");
            }
          } catch (error) {
            console.error("Session validation failed:", error);
            logout();
            return;
          }
          
          // Exponential backoff reconnect (halts if offline)
          if (!reconnectTimeout && navigator.onLine) {
            const attempt = reconnectAttemptsRef.current++;
            const delay = Math.min(
              BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
              MAX_RECONNECT_DELAY_MS
            );
            reconnectTimeout = setTimeout(connectWebSocket, delay);
          }
        }
      };

      socketRef.current.onerror = (error) => {
        console.error("WebSocket error occurred. See the 'onclose' event for details.", error);
      };
    };
    
    const disconnectWebSocket = () => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
        stopTokenRefresh(); // Stop token refresh when disconnecting
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.onclose = null; // prevent reconnect logic from firing
            socketRef.current.close();
            socketRef.current = null;
            console.log("WebSocket disconnected by client.");
        }
    }


    const fetchInitialData = async () => {
      if (!isComponentMounted) return;
      setState(prevState => ({ ...prevState, isLoading: true }));
      try {
        const [devicesRes, positionsRes, geofencesRes] = await Promise.all([
          apiClient.get<Device[]>("/devices"),
          apiClient.get<Position[]>("/positions"),
          apiClient.get<Geofence[]>("/geofences"),
        ]);

        if (!isComponentMounted) return;

        const devicesMap = mapById(devicesRes.data || []);
        const positionsMap = mapById(positionsRes.data || []);
        const geofencesMap = mapById(geofencesRes.data || []);
        const initialIgnitionState: IgnitionState = {};

        Object.values(devicesMap).forEach(device => {
          const position = positionsMap[device.positionId];
          // Do not attach initial position/ignition for expired devices
          if (position && !isDeviceExpired(device)) {
            device.position = position;
            if (position.attributes?.ignition !== undefined) {
              initialIgnitionState[device.id] = !!position.attributes.ignition;
            }
          }
          const ts = bestTimestamp(device, position);
          device.status = device.status || computeStatus(ts);
          device.lastUpdate = device.lastUpdate || ts || device.lastUpdate;
        });

        const now = new Date();
        const fromIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const toIso = now.toISOString();

        let initialEvents: TraccarEvent[] = [];
        try {
          const allDeviceIds = Object.keys(devicesMap);
          if (allDeviceIds.length > 0) {
            const eventsRes = await apiClient.get<TraccarEvent[]>(
              `/reports/events?from=${fromIso}&to=${toIso}&` + allDeviceIds.map(id => `deviceId=${id}`).join("&")
            );
            initialEvents = (eventsRes.data || [])
              .filter(e => !isDeviceExpired(devicesMap[e.deviceId]))
              .map(e => enrichEvent(e, devicesMap, geofencesMap));
            
            // Set initial ignition state from recent events
            initialEvents
              .filter(e => e.type === "ignitionOn" || e.type === "ignitionOff")
              .sort((a,b) => new Date(a.serverTime).getTime() - new Date(b.serverTime).getTime())
              .forEach(e => {
                initialIgnitionState[e.deviceId] = e.type === "ignitionOn";
              });
          }
        } catch (e) {
          console.warn("Failed to load initial events", e);
        }

        setState(prevState => ({
          ...prevState,
          devices: devicesMap,
          positions: positionsMap,
          geofences: geofencesMap,
          events: mergeEvents(prevState.events, initialEvents, devicesMap, geofencesMap),
          ignition: initialIgnitionState,
          isLoading: false,
        }));

        connectWebSocket();
      } catch (error) {
        console.error("Failed to fetch initial data from API", error);
        if (isComponentMounted) {
          setState(prevState => ({ ...prevState, isLoading: false }));
        }
      }
    };

    if (isAuthenticated) {
      // Network online/offline handling
      const handleOnline = () => {
        console.log("Browser is online. Ensuring WebSocket connection...");
        toast({ title: "Back online", description: "Connection restored." });
        if (offlineSignoutTimeoutRef.current) {
          clearTimeout(offlineSignoutTimeoutRef.current);
          offlineSignoutTimeoutRef.current = null;
        }
        // Try reconnect immediately when online
        if (!socketRef.current && !reconnectTimeout) {
          reconnectAttemptsRef.current = 0; // reset backoff
          reconnectTimeout = setTimeout(connectWebSocket, 100);
        }
      };
      const handleOffline = () => {
        console.warn("Browser is offline. Marking disconnected and stopping timers.");
        setState(prev => ({ ...prev, isConnected: false }));
        toast({
          variant: "destructive",
          title: "No internet connection",
          description: "Please check your internet. You will be signed out if it doesn't restore soon.",
        });
        // Do not attempt reconnects while offline
        disconnectWebSocket();
        // Schedule auto sign-out after 90s if still offline
        if (offlineSignoutTimeoutRef.current) clearTimeout(offlineSignoutTimeoutRef.current);
        offlineSignoutTimeoutRef.current = setTimeout(() => {
          if (!navigator.onLine) {
            console.warn("Offline persisted, signing out session.");
            logout();
          }
        }, 90000);
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      onlineListenerRef.current = handleOnline;
      offlineListenerRef.current = handleOffline;

      fetchInitialData();
    } else {
      disconnectWebSocket();
      setState({ devices: {}, positions: {}, geofences: {}, events: [], ignition: {}, isLoading: false, isConnected: false });
    }

    return () => {
      isComponentMounted = false;
      disconnectWebSocket();
      if (onlineListenerRef.current) window.removeEventListener('online', onlineListenerRef.current);
      if (offlineListenerRef.current) window.removeEventListener('offline', offlineListenerRef.current);
      if (historyWriteTimeoutRef.current) {
        clearTimeout(historyWriteTimeoutRef.current);
        historyWriteTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, startTokenRefresh, stopTokenRefresh]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const intervalId: ReturnType<typeof setInterval> = setInterval(() => {
      setState(prev => {
        const now = Date.now();
        const devices = { ...prev.devices };
        let changed = false;
        Object.values(devices).forEach(d => {
          const newStatus = computeStatus(bestTimestamp(d, d.position), now);
          if (d.status !== newStatus) {
            devices[d.id] = { ...d, status: newStatus };
            changed = true;
          }
        });
        return changed ? { ...prev, devices } : prev;
      });
    }, 60000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  return (
    <AppStateContext.Provider value={state}>
      {children}
    </AppStateContext.Provider>
  );
};

// --- Custom Hooks ---

export const useWebSocket = (): AppState => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

// Safe version that returns default values when provider is not available (for components in root layout)
export const useWebSocketSafe = (): AppState | null => {
  const context = useContext(AppStateContext);
  return context ?? null;
};

export const useIgnitionStatus = (deviceId: number): boolean => {
    const context = useContext(AppStateContext);
    if (context === undefined) {
        throw new Error("useIgnitionStatus must be used within a WebSocketProvider");
    }
    return context.ignition[deviceId] ?? false;
}

// --- Engine Status Logic ---
type EngineState = "locked" | "unlocked" | "unknown";

function normalizeBool(v: any): boolean | undefined {
  if (v === true || v === false) return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "on", "yes", "1", "y"].includes(s)) return true;
    if (["false", "off", "no", "0", "n"].includes(s)) return false;
  }
  return undefined;
}

function toStringValue(value: any): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function evaluateCommandResult(attributes: Record<string, any> | undefined) {
  if (!attributes) return undefined as EngineState | undefined;
  const resultSources = [
    attributes.result,
    attributes.commandResult,
    attributes.lastCommandResult,
    attributes.lastCommandDescription,
  ];
  const combined = resultSources
    .map(toStringValue)
    .filter((v): v is string => !!v)
    .join(" | ")
    .toLowerCase();

  if (!combined) return undefined;

  const cutOffKeywords = [
    "cut off the fuel supply",
    "cut off fuel supply",
    "fuel supply cut off",
    "engine stop",
  ];
  const hasCutOffSuccess =
    cutOffKeywords.some(kw => combined.includes(kw)) && combined.includes("success");
  if (hasCutOffSuccess) return "locked";

  const restoreKeywords = [
    "restore the fuel supply",
    "restore fuel supply",
    "resume the fuel supply",
    "resume fuel supply",
    "engine resume",
    "engine on",
  ];
  const hasRestoreSuccess =
    restoreKeywords.some(kw => combined.includes(kw)) && combined.includes("success");

  if (hasRestoreSuccess) return "unlocked";
  return undefined;
}

export function likelyEngineRunning(device: any): boolean {
  if (!device) return false;
  const da = device?.attributes ?? {};
  const pa = device?.position?.attributes ?? {};

  const ignition = normalizeBool(
    da.ignition ?? pa.ignition ?? da.engine ?? pa.engine ?? da.acc ?? pa.acc
  );
  if (ignition === true) return true;

  const rpm = Number(pa.rpm ?? da.rpm);
  if (!Number.isNaN(rpm) && rpm > 0) return true;

  const volts = [
    pa.externalVoltage, da.externalVoltage,
    pa.power, da.power,
    pa.batteryVoltage, da.batteryVoltage
  ].map(v => (v == null ? NaN : Number(v)))
   .find(v => !Number.isNaN(v));

  if (typeof volts === "number" && volts > 13.0) return true;

  return false;
}

export function useEngineAndTow(deviceId: number) {
  const { devices } = useWebSocket();
  const device = devices[deviceId];
  if (!device) return { engineState: "unknown" as EngineState, isTowed: false };

  const da = device.attributes ?? {};
  const pa = device.position?.attributes ?? {};
  const speed = device.position?.speed ?? 0;

  let engine: EngineState = "unknown";

  const blocked = normalizeBool(
    da.blocked ?? pa.blocked ??
    da.engineBlocked ?? pa.engineBlocked ??
    da.immobilizer ?? pa.immobilizer ??
    da.relay ?? pa.relay ??
    da.output1 ?? pa.output1 ??
    da.engineCut ?? pa.engineCut
  );

  if (blocked !== undefined) {
    engine = blocked ? "locked" : "unlocked";
  } else {
    const commandResultState =
      evaluateCommandResult(da) ?? evaluateCommandResult(pa);
    if (commandResultState) {
      engine = commandResultState;
    }
  }
  
  const isIgnitionOn = useIgnitionStatus(deviceId);
  if (engine === "unknown" && isIgnitionOn) engine = "unlocked";

  const moving = speed > 0.5 || normalizeBool(pa.motion) === true;
  const isTowed = moving && !isIgnitionOn;

  return { engineState: engine, isTowed };
}
