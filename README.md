# AL-MUHAFIZ NextN PWA

Progressive Web App for AL-MUHAFIZ vehicle tracking system.

## Features

- Real-time vehicle tracking
- Interactive maps with Google Maps integration
- Fuel consumption reports
- Speed violation monitoring
- Maintenance scheduling
- Offline map support
- Push notifications
- PWA capabilities (installable on mobile)
- Cookie subdomain isolation for security

## Tech Stack

- Next.js 15.3.3
- TypeScript
- Tailwind CSS
- Capacitor (for mobile app)
- Google Maps API
- Firebase (Cloud Messaging)
- React Hook Form
- PWA features

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run development server: `npm run dev`

## Mobile App Build

```bash
# Build for Android
npm run android:apk  # Generate APK
npm run android:aab  # Generate AAB for Play Store
```

## Cookie Isolation

This app implements subdomain-specific cookie isolation to prevent cross-contamination between different subdomains (ebill.almtrace.com vs apple.almtrace.com).

## Deployment

Deployed on: `apple.almtrace.com`