// PWA Service Worker
// Handles caching, offline support, and Firebase messaging

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

// Firebase config
const firebaseConfig = {
  apiKey: 'AIzaSyAY44_U_sO_mODcKG8Ioq4Nyaf7RnilKzE',
  authDomain: 'al-muhafiz-trackers.firebaseapp.com',
  projectId: 'al-muhafiz-trackers',
  storageBucket: 'al-muhafiz-trackers.firebasestorage.app',
  messagingSenderId: '846385769012',
  appId: '1:846385769012:web:default',
};

// Initialize Firebase
if (firebaseConfig.projectId && firebaseConfig.apiKey) {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    
    messaging.onBackgroundMessage((payload) => {
      const title = (payload && payload.notification && payload.notification.title) || 'AL-MUHAFIZ TRACKERS';
      const options = {
        body: (payload && payload.notification && payload.notification.body) || '',
        icon: '/logo.png',
        badge: '/icons/icon-96.webp',
        data: payload?.data || {},
      };
      self.registration.showNotification(title, options);
    });
  } catch (error) {
    console.error('[Service Worker] Firebase initialization error:', error);
  }
}

const CACHE_NAME = 'al-muhafiz-trackers-v1';
const RUNTIME_CACHE = 'al-muhafiz-runtime-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/home',
  '/login',
  '/logo.png',
  '/manifest.webmanifest',
  '/icons/icon-192.webp',
  '/icons/icon-512.webp',
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Handle API requests with network-first strategy
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response
          const responseClone = response.clone();
          // Cache successful responses
          if (response.status === 200) {
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
      })
  );
});

// Handle push notifications (fallback if Firebase doesn't handle them)
self.addEventListener('push', (event) => {
  // Firebase messaging handles most push notifications
  // This is a fallback for non-Firebase push notifications
  if (event.data) {
    const data = event.data.json();
    const title = data.notification?.title || 'AL-MUHAFIZ TRACKERS';
    const options = {
      body: data.notification?.body || '',
      icon: '/logo.png',
      badge: '/icons/icon-96.webp',
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

