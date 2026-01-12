
"use client";

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { useToast } from './use-toast';
import apiClient from '@/lib/api';
import { getFcmWebToken, initMessagingWeb, onForegroundWebMessage } from '@/lib/firebase';
import { useAuth } from './use-auth';
import { buildVehicleAlertSpeech, speakText } from '@/lib/tts';

export const usePushNotifications = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const registerDevice = useCallback(async (token: string) => {
      if (!user) {
        console.warn('Cannot register device: user not available');
        return;
      }
      
      if (!token) {
        console.warn('Cannot register device: token is empty');
        return;
      }
      
      try {
        console.log(`[FCM] Registering push token for user ${user.id}:`, token.substring(0, 20) + '...');
        
        // Get current user data to preserve existing attributes
        const userResponse = await apiClient.get(`/users/${user.id}`);
        const currentUser = userResponse.data;
        
        console.log('[FCM] Current user attributes:', currentUser.attributes);
        
        // Get existing tokens from attributes
        const existingTokensString = currentUser.attributes?.notificationTokens || '';
        const existingTokens = existingTokensString
          ? existingTokensString.split(',').filter((t: string) => t.trim() !== '')
          : [];
        
        console.log('[FCM] Existing tokens:', existingTokens);
        
        // Add new token if not already present
        if (!existingTokens.includes(token)) {
          // Keep only last 2 tokens + new one (max 3 tokens total)
          const updatedTokens = [...existingTokens.slice(-2), token].join(',');
          
          console.log('[FCM] Updating tokens to:', updatedTokens);
          
          // Update user with new token
          // Ensure attributes is always an object
          const updatedAttributes = {
            ...(currentUser.attributes || {}),
            notificationTokens: updatedTokens
          };
          
          const updateResponse = await apiClient.put(`/users/${user.id}`, {
            ...currentUser,
            attributes: updatedAttributes
          });
          
          console.log('[FCM] Update response:', updateResponse.status, updateResponse.data);
          
          // Verify the update worked
          const verifyResponse = await apiClient.get(`/users/${user.id}`);
          const verifiedTokens = verifyResponse.data.attributes?.notificationTokens || '';
          console.log('[FCM] Verified tokens after update:', verifiedTokens);
          
          // Don't show toast notification on successful registration (silent operation)
          // toast({
          //   title: "Success",
          //   description: "FCM token registered successfully with Traccar server.",
          // });
        } else {
          console.log('[FCM] Token already registered, skipping update.');
        }
      } catch (error: any) {
        console.error('[FCM] Error sending push token to server:', error);
        console.error('[FCM] Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        toast({
            variant: "destructive",
            title: "Token Registration Failed",
            description: error.response?.data?.message || error.message || "Could not register device for notifications.",
        });
      }
  }, [user, toast]);

  // Function to initialize native push notifications
  const registerNotifications = useCallback(() => {
    console.log('[FCM] Initializing Push Notifications (Native)...');
    
    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('[FCM] Push registration success, token: ' + token.value.substring(0, 20) + '...');
      console.log('[FCM] Full token length:', token.value.length);
      registerDevice(token.value);
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[FCM] Error on registration: ' + JSON.stringify(error));
      toast({
          variant: "destructive",
          title: 'Push Notification Error',
          description: 'Could not register for push notifications.',
      });
    });
    
    // Register for push notifications - this triggers the token retrieval
    PushNotifications.register()
      .then(() => {
        console.log('[FCM] Push notifications registration initiated');
      })
      .catch((error) => {
        console.error('[FCM] Failed to register push notifications:', error);
        toast({
          variant: "destructive",
          title: 'Push Notification Error',
          description: 'Failed to initialize push notifications.',
        });
      });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received: ', notification);
        toast({
            title: notification.title || 'New Notification',
            description: notification.body,
        });

        // Native payload may include data with alert context
        const data: Record<string, any> | undefined = (notification as any).data;
        if (data && data.type === 'alert') {
          const speech = buildVehicleAlertSpeech({
            alertType: data.alertType,
            vehicle: data.vehicle,
            message: data.message,
          });
          void speakText({ text: speech, locale: 'en-US' });
        }
      },
    );

    // Method called when tapping on a notification
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push action performed: ', notification);
        // Here you can navigate to a specific page for example
        // router.push(`/home/events`);
      },
    );
  }, [registerDevice, toast]);

  useEffect(() => {
    // Background notifications work independently via background-notifications.ts
    // This hook only handles token registration with server when user is logged in
    // Notifications will still work in background even when logged out
    
    // Native (Android/iOS) via Capacitor
    if (Capacitor.getPlatform() !== 'web') {
      // Only register token with server if user is logged in
      // But notifications will still work in background via background-notifications.ts
      if (!user) {
        console.log('[FCM] User not logged in, skipping token registration with server');
        console.log('[FCM] Background notifications will still work via background handler');
        return;
      }

      console.log('[FCM] Native platform detected, checking permissions...');
      PushNotifications.checkPermissions().then((res) => {
        console.log('[FCM] Permission status:', res.receive);
        if (res.receive !== 'granted') {
          console.log('[FCM] Requesting notification permissions...');
          PushNotifications.requestPermissions().then((res) => {
            if (res.receive === 'denied') {
              console.warn('[FCM] Notification permission denied');
              toast({
                title: 'Notification Permission',
                description: 'Push notifications permission denied. You can enable it in app settings.',
              });
            } else {
              console.log('[FCM] Permission granted, initializing notifications...');
              registerNotifications();
            }
          });
        } else {
          console.log('[FCM] Permission already granted, initializing notifications...');
          registerNotifications();
        }
      });

      return () => {
        PushNotifications.removeAllListeners();
      };
    }

    // Web (browser) - Skip FCM token registration
    // Web notifications are handled via WebSocket connection (see websocket-context.tsx)
    // FCM is only needed for native platforms (Android/iOS) where WebSocket may be unreliable
    if (Capacitor.getPlatform() === 'web') {
      console.log('[FCM] Web platform detected - notifications via WebSocket, skipping FCM registration');
      // Optionally still listen for foreground messages if needed
      // (async () => {
      //   const messaging = await initMessagingWeb();
      //   if (messaging) {
      //     onForegroundWebMessage((payload) => {
      //       const title = (payload?.notification?.title) || 'New Notification';
      //       const body = payload?.notification?.body || '';
      //       toast({ title, description: body });
      //     });
      //   }
      // })();
      return; // Exit early for web platform
    }

  }, [user, toast, registerDevice, registerNotifications]);
};
