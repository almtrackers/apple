"use client";

import { useToast } from "@/hooks/use-toast";
import { useNotificationPreferences } from "@/contexts/notification-preferences-context";
import { useAuth } from "@/hooks/use-auth";

export interface NotificationData {
  type: string;
  deviceId: number;
  deviceName: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  data?: any;
}

export class NotificationService {
  private static instance: NotificationService;
  private toast: any;
  private preferences: any;
  private user: any;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  initialize(toast: any, preferences: any, user: any) {
    this.toast = toast;
    this.preferences = preferences;
    this.user = user;
  }

  private shouldShowNotification(type: string): boolean {
    if (!this.preferences) return true;
    
    const preferences = this.preferences;
    const preferenceMap: { [key: string]: keyof typeof preferences } = {
      'speeding': 'speeding',
      'geofenceEnter': 'geofenceEnter',
      'geofenceExit': 'geofenceExit',
      'deviceOnline': 'deviceOnline',
      'deviceOffline': 'deviceOffline',
      'maintenance': 'maintenance',
      'emergency': 'emergency',
      'engineControl': 'engineControl',
      'batteryLow': 'batteryLow',
      'fuelLow': 'fuelLow',
      'harshBraking': 'harshBraking',
      'rapidAcceleration': 'rapidAcceleration',
      'idleTime': 'idleTime',
    };

    const preferenceKey = preferenceMap[type];
    return preferenceKey ? preferences[preferenceKey] : true;
  }

  private getNotificationIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'speeding': '🚨',
      'geofenceEnter': '📍',
      'geofenceExit': '📍',
      'deviceOnline': '🟢',
      'deviceOffline': '🔴',
      'maintenance': '🔧',
      'emergency': '🚨',
      'engineControl': '🔑',
      'batteryLow': '🔋',
      'fuelLow': '⛽',
      'harshBraking': '🛑',
      'rapidAcceleration': '⚡',
      'idleTime': '⏰',
    };
    return iconMap[type] || '📱';
  }

  private getNotificationVariant(priority: string): "default" | "destructive" {
    return priority === 'critical' || priority === 'high' ? 'destructive' : 'default';
  }

  showNotification(notification: NotificationData) {
    if (!this.shouldShowNotification(notification.type)) {
      return;
    }

    const icon = this.getNotificationIcon(notification.type);
    const variant = this.getNotificationVariant(notification.priority);
    
    this.toast({
      variant,
      title: `${icon} ${notification.title}`,
      description: notification.message,
      duration: notification.priority === 'critical' ? 10000 : 5000,
    });

    // Log for debugging
    console.log('Notification shown:', {
      type: notification.type,
      device: notification.deviceName,
      priority: notification.priority,
      timestamp: notification.timestamp,
    });
  }

  // Convenience methods for common notification types
  showSpeedingAlert(deviceName: string, speed: number, limit: number) {
    this.showNotification({
      type: 'speeding',
      deviceId: 0,
      deviceName,
      title: 'Speeding Alert',
      message: `${deviceName} is traveling at ${speed} km/h (limit: ${limit} km/h)`,
      priority: 'high',
      timestamp: new Date().toISOString(),
    });
  }

  showGeofenceAlert(deviceName: string, geofenceName: string, type: 'enter' | 'exit') {
    this.showNotification({
      type: type === 'enter' ? 'geofenceEnter' : 'geofenceExit',
      deviceId: 0,
      deviceName,
      title: `Geofence ${type === 'enter' ? 'Entry' : 'Exit'}`,
      message: `${deviceName} has ${type === 'enter' ? 'entered' : 'exited'} ${geofenceName}`,
      priority: 'medium',
      timestamp: new Date().toISOString(),
    });
  }

  showDeviceStatusAlert(deviceName: string, status: 'online' | 'offline') {
    this.showNotification({
      type: status === 'online' ? 'deviceOnline' : 'deviceOffline',
      deviceId: 0,
      deviceName,
      title: `Device ${status === 'online' ? 'Online' : 'Offline'}`,
      message: `${deviceName} is now ${status}`,
      priority: status === 'offline' ? 'high' : 'low',
      timestamp: new Date().toISOString(),
    });
  }

  showMaintenanceAlert(deviceName: string, message: string) {
    this.showNotification({
      type: 'maintenance',
      deviceId: 0,
      deviceName,
      title: 'Maintenance Required',
      message,
      priority: 'medium',
      timestamp: new Date().toISOString(),
    });
  }

  showEmergencyAlert(deviceName: string, message: string) {
    this.showNotification({
      type: 'emergency',
      deviceId: 0,
      deviceName,
      title: 'Emergency Alert',
      message,
      priority: 'critical',
      timestamp: new Date().toISOString(),
    });
  }
}

// Hook for using the notification service
export function useNotificationService() {
  const toast = useToast();
  const preferences = useNotificationPreferences();
  const { user } = useAuth();

  const service = NotificationService.getInstance();
  service.initialize(toast, preferences.preferences, user);

  return service;
}
