"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api";

export interface NotificationPreferences {
  speeding: boolean;
  geofenceEnter: boolean;
  geofenceExit: boolean;
  deviceOnline: boolean;
  deviceOffline: boolean;
  maintenance: boolean;
  emergency: boolean;
  engineControl: boolean;
  batteryLow: boolean;
  fuelLow: boolean;
  harshBraking: boolean;
  rapidAcceleration: boolean;
  idleTime: boolean;
  proximityAlert: boolean;
  fakeCallAlert: boolean;
}

const defaultPreferences: NotificationPreferences = {
  speeding: true,
  geofenceEnter: true,
  geofenceExit: true,
  deviceOnline: false,
  deviceOffline: true,
  maintenance: true,
  emergency: true,
  engineControl: true,
  batteryLow: true,
  fuelLow: true,
  harshBraking: false,
  rapidAcceleration: false,
  idleTime: false,
  proximityAlert: true,
  fakeCallAlert: true,
};

interface NotificationPreferencesContextType {
  preferences: NotificationPreferences;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
  updateAllPreferences: (prefs: NotificationPreferences) => Promise<void>;
  isLoading: boolean;
}

const NotificationPreferencesContext = createContext<NotificationPreferencesContextType | undefined>(undefined);

export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/users/${user?.id}`);
      const userData = response.data;
      
      if (userData?.attributes?.notificationPreferences) {
        const savedPrefs = JSON.parse(userData.attributes.notificationPreferences);
        setPreferences({ ...defaultPreferences, ...savedPrefs });
      }
    } catch (error) {
      console.error("Failed to load notification preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    try {
      await apiClient.put(`/users/${user?.id}`, {
        ...user,
        attributes: {
          ...user?.attributes,
          notificationPreferences: JSON.stringify(newPreferences),
        }
      });
    } catch (error) {
      console.error("Failed to update notification preference:", error);
      // Revert on error
      setPreferences(preferences);
    }
  };

  const updateAllPreferences = async (newPreferences: NotificationPreferences) => {
    setPreferences(newPreferences);
    
    try {
      await apiClient.put(`/users/${user?.id}`, {
        ...user,
        attributes: {
          ...user?.attributes,
          notificationPreferences: JSON.stringify(newPreferences),
        }
      });
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      // Revert on error
      setPreferences(preferences);
    }
  };

  return (
    <NotificationPreferencesContext.Provider value={{
      preferences,
      updatePreference,
      updateAllPreferences,
      isLoading,
    }}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences() {
  const context = useContext(NotificationPreferencesContext);
  if (context === undefined) {
    throw new Error("useNotificationPreferences must be used within a NotificationPreferencesProvider");
  }
  return context;
}
