"use client";

import { useEffect } from 'react';
import { initializeBackgroundNotifications } from '@/lib/background-notifications';

/**
 * Component that initializes background notifications
 * This works independently of authentication state
 * Ensures notifications work even when logged out
 */
export function BackgroundNotificationsInitializer() {
  useEffect(() => {
    // Initialize background notifications on mount
    // This runs regardless of authentication state
    initializeBackgroundNotifications().catch((error) => {
      console.error('[BackgroundNotificationsInitializer] Error:', error);
    });
  }, []);

  // This component doesn't render anything
  return null;
}

