# PWA Setup Guide

Your app has been configured as a Progressive Web App (PWA) and can now be installed on iPhone, Android, and desktop devices.

## What Was Added

1. **Complete PWA Manifest** (`public/manifest.webmanifest`)
   - App name, icons, theme colors
   - Standalone display mode
   - All required PWA fields

2. **Service Worker** (`public/sw.js`)
   - Caching for offline support
   - Firebase messaging integration
   - Push notification handling

3. **Service Worker Registration** (`src/components/service-worker-register.tsx`)
   - Automatically registers the service worker
   - Handles updates

4. **PWA Installer Component** (`src/components/pwa-installer.tsx`)
   - Shows install prompts for iOS and Android
   - Provides installation instructions

5. **iOS Meta Tags**
   - Apple touch icon
   - Mobile web app capable
   - Status bar styling

## Installation Instructions

### iPhone/iPad (Safari)

1. Open the app in Safari
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right
5. The app will appear on your home screen

### Android (Chrome)

1. Open the app in Chrome
2. You'll see an install prompt, or:
3. Tap the menu (3 dots) → **"Add to Home Screen"** or **"Install App"**
4. Confirm installation

### Desktop (Chrome/Edge)

1. Look for the install icon in the address bar
2. Click it and confirm installation
3. The app will open in its own window

## Testing

1. Build the app: `npm run build`
2. Serve the built files: `npm start` or use a static file server
3. Open in a browser and check:
   - Service worker is registered (DevTools → Application → Service Workers)
   - Manifest is loaded (DevTools → Application → Manifest)
   - Install prompt appears (if not already installed)

## Notes

- The service worker includes Firebase messaging, so push notifications will work
- Icons are served from `/icons/` directory
- The app works offline after first load (cached assets)
- Service worker updates automatically check for new versions

## Troubleshooting

- **Install prompt not showing**: Make sure you're accessing via HTTPS (or localhost)
- **Service worker not registering**: Check browser console for errors
- **Icons not showing**: Verify icons are in `public/icons/` directory
- **Firebase notifications not working**: Ensure service worker is registered and Firebase config is correct

