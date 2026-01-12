// Firebase Messaging service worker
// This file must be at the root or in /public for Next.js to serve it.
// Note: Service workers cannot access environment variables directly.
// Firebase config should be passed from the main app or use default values.

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

// Default Firebase config - these should match your Firebase project
// In production, these values should be set via environment variables or passed from the main app
const firebaseConfig = {
  apiKey: 'AIzaSyAY44_U_sO_mODcKG8Ioq4Nyaf7RnilKzE', // From google-services.json
  authDomain: 'al-muhafiz-trackers.firebaseapp.com',
  projectId: 'al-muhafiz-trackers', // Required - from google-services.json
  storageBucket: 'al-muhafiz-trackers.firebasestorage.app',
  messagingSenderId: '846385769012', // From google-services.json project_number
  appId: '1:846385769012:web:default', // Web app ID (if you have one)
};

// Only initialize Firebase if we have required config values
if (firebaseConfig.projectId && firebaseConfig.apiKey) {
  try {
    firebase.initializeApp(firebaseConfig);
    
    const messaging = firebase.messaging();
    
    messaging.onBackgroundMessage((payload) => {
      const title = (payload && payload.notification && payload.notification.title) || 'Notification';
      const options = {
        body: (payload && payload.notification && payload.notification.body) || '',
        icon: '/logo.png',
        data: payload?.data || {},
      };
      self.registration.showNotification(title, options);
    });
  } catch (error) {
    console.error('[Service Worker] Firebase initialization error:', error);
  }
} else {
  console.warn('[Service Worker] Firebase config is incomplete. Background messaging will not work.');
}





