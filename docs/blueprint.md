# **App Name**: AL-MUHAFIZ Trackers

## Core Features:

- User Login: Login screen with Roman Urdu labels (Login karain, Email likhain, Password likhain) and email/password authentication against the Traccar API at `https://app.almtrace.com/api/session`. Show 
“Ghalat email ya password” message on failure.
- Home Screen: Home screen with three tabs (Location, Record, Control) and a title of “AL-MUHAFIZ TRACKERS” in Roman Urdu
- Live Location Display: Location tab displays the live location of the user's device on Google Maps, fetched from the `/api/positions` endpoint. Shows "Tracker ki location hasil ki ja rahi hai" message when loading
- Trip History: Record tab displays the trip history using data from the `/api/reports/route` endpoint. Shows "Koi Trip nahi mila" if no trip data is available.
- Engine Control: Control tab has two password-protected buttons, “Engine Band Karain” and “Engine Dobara Chalu Karain”, to manage engine commands
- Password Protected Commands: Password dialog prompted when an engine control button is pressed with title “Password likhain”. It verifies against the device's `enginePassword` attribute via `/api/devices/{id}`. Sends `engineStop` or `engineResume` command via POST to `/api/commands` when passwords match, or shows “Password ghalat hai” on mismatch.
- Session Management & Error Handling: Splash screen with app name “AL-MUHAFIZ TRACKERS”. Stored user session to persist login, and handles errors (session expired, tracker offline, invalid command)

## Style Guidelines:

- Primary color: A vivid blue (#2962FF) evoking reliability and security.
- Background color: A light blue-gray (#E8F0FE) that gives a clean, modern feel.
- Accent color: A saturated violet (#9C27B0) for interactive elements like buttons and selected tabs, adding a touch of uniqueness.
- Body and headline font: 'PT Sans' (sans-serif) for clear readability across the app.
- Simple, line-based icons for map markers and control functions to maintain clarity and ease of use.
- Clean and intuitive tab layout for the Home Screen (Location, Record, Control). All text to be rendered in Roman Urdu.
- Subtle animations for map marker updates and state changes for buttons.