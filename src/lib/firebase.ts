
// Firebase initialization for Web (FCM)
// Note: Android uses Capacitor PushNotifications; Web uses FCM in browser.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function initFirebaseWeb(): { app: FirebaseApp | null; messaging: Messaging | null } {
  if (typeof window === 'undefined') return { app: null, messaging: null };
  if (app) return { app, messaging };

  // Get config values from environment variables
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  // Validate required config values - projectId is required
  if (!projectId || !apiKey || !appId) {
    console.warn('[Firebase] Missing required configuration values. Firebase will not be initialized.');
    console.warn('[Firebase] Required: NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_APP_ID');
    return { app: null, messaging: null };
  }

  const config = {
    apiKey,
    authDomain: authDomain || undefined,
    projectId,
    storageBucket: storageBucket || undefined,
    messagingSenderId: messagingSenderId || undefined,
    appId,
    measurementId: measurementId || undefined,
  };

  try {
    app = initializeApp(config);
    return { app, messaging };
  } catch (error) {
    console.error('[Firebase] Failed to initialize Firebase:', error);
    return { app: null, messaging: null };
  }
}

export async function initMessagingWeb(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    if (!app) initFirebaseWeb();
    if (!app) return null;
    messaging = getMessaging(app);
    return messaging;
  } catch {
    return null;
  }
}

export async function getFcmWebToken(vapidKey?: string): Promise<string | null> {
  const msg = await initMessagingWeb();
  if (!msg) return null;
  try {
    const token = await getToken(msg, { 
      vapidKey: vapidKey || process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready
    });
    return token || null;
  } catch {
    return null;
  }
}

export function onForegroundWebMessage(callback: (payload: any) => void): void {
  if (!messaging) return;
  onMessage(messaging, (payload) => callback(payload));
}
