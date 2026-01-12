"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNotificationPreferences, NotificationPreferences } from "@/contexts/notification-preferences-context";
import { Loader2, Bell, BellOff, AlertTriangle, MapPin, Power, Wrench, Battery, Fuel, Car } from "lucide-react";

const notificationCategories = [
  {
    title: "Safety Alerts",
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
    items: [
      { key: 'speeding' as keyof NotificationPreferences, label: 'Speeding Violations', description: 'Get notified when vehicles exceed speed limits' },
      { key: 'harshBraking' as keyof NotificationPreferences, label: 'Harsh Braking', description: 'Alert for sudden braking incidents' },
      { key: 'rapidAcceleration' as keyof NotificationPreferences, label: 'Rapid Acceleration', description: 'Alert for aggressive acceleration' },
      { key: 'emergency' as keyof NotificationPreferences, label: 'Emergency Alerts', description: 'Critical safety and emergency notifications' },
    ]
  },
  {
    title: "Location & Geofencing",
    icon: <MapPin className="h-5 w-5 text-blue-500" />,
    items: [
      { key: 'geofenceEnter' as keyof NotificationPreferences, label: 'Geofence Entry', description: 'When vehicles enter designated areas' },
      { key: 'geofenceExit' as keyof NotificationPreferences, label: 'Geofence Exit', description: 'When vehicles leave designated areas' },
      { key: 'proximityAlert' as keyof NotificationPreferences, label: 'Proximity Alert', description: 'Alert when vehicle starts far from your location' },
    ]
  },
  {
    title: "Device Status",
    icon: <Power className="h-5 w-5 text-green-500" />,
    items: [
      { key: 'deviceOnline' as keyof NotificationPreferences, label: 'Device Online', description: 'When devices come back online' },
      { key: 'deviceOffline' as keyof NotificationPreferences, label: 'Device Offline', description: 'When devices go offline' },
      { key: 'engineControl' as keyof NotificationPreferences, label: 'Engine Control', description: 'Engine start/stop commands and status' },
      { key: 'fakeCallAlert' as keyof NotificationPreferences, label: 'Fake Call Alerts', description: 'Receive fake call alerts for critical events (battery cutoff, geofence exit, proximity)' },
    ]
  },
  {
    title: "Maintenance & Performance",
    icon: <Wrench className="h-5 w-5 text-orange-500" />,
    items: [
      { key: 'maintenance' as keyof NotificationPreferences, label: 'Maintenance Reminders', description: 'Scheduled maintenance and service alerts' },
      { key: 'batteryLow' as keyof NotificationPreferences, label: 'Low Battery', description: 'When device battery is running low' },
      { key: 'fuelLow' as keyof NotificationPreferences, label: 'Low Fuel', description: 'When vehicle fuel level is low' },
      { key: 'idleTime' as keyof NotificationPreferences, label: 'Excessive Idle Time', description: 'When vehicles idle for too long' },
    ]
  },
];

export default function NotificationPreferencesComponent() {
  const { preferences, updatePreference, isLoading } = useNotificationPreferences();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Manage your notification settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading preferences...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which notifications you want to receive. You can customize alerts for different types of events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationCategories.map((category, categoryIndex) => (
          <div key={category.title}>
            <div className="flex items-center gap-2 mb-4">
              {category.icon}
              <h3 className="text-lg font-semibold">{category.title}</h3>
            </div>
            
            <div className="space-y-4">
              {category.items.map((item, itemIndex) => (
                <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={item.key} className="text-sm font-medium cursor-pointer">
                        {item.label}
                      </Label>
                      {preferences[item.key] ? (
                        <Bell className="h-4 w-4 text-green-500" />
                      ) : (
                        <BellOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                  <Switch
                    id={item.key}
                    checked={preferences[item.key]}
                    onCheckedChange={(checked) => updatePreference(item.key, checked)}
                    className="ml-4"
                  />
                </div>
              ))}
            </div>
            
            {categoryIndex < notificationCategories.length - 1 && (
              <Separator className="my-6" />
            )}
          </div>
        ))}
        
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-2">
            <Car className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Notification Tips</h4>
              <p className="text-sm text-muted-foreground mt-1">
                • Critical alerts (emergency, offline devices) are always shown regardless of settings<br/>
                • You can change these settings anytime and they'll sync across all your devices<br/>
                • Consider enabling maintenance alerts to keep your fleet in optimal condition
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
