
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { NotificationPreferencesProvider } from "@/contexts/notification-preferences-context";
import { Toaster } from "@/components/ui/toaster";
import { BackgroundNotificationsInitializer } from "@/components/background-notifications-initializer";
import FakeCallOverlay from "@/components/fake-call-overlay";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PWAInstaller } from "@/components/pwa-installer";
import { CookieCleanupInitializer } from "@/components/cookie-cleanup-initializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "AL-MUHAFIZ TRACKERS",
  description: "Vehicle Tracking System",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AL-MUHAFIZ",
  },
  icons: {
    apple: "/icons/icon-192.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.webp" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AL-MUHAFIZ" />
        <meta name="theme-color" content="#1a1a1a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <NotificationPreferencesProvider>
              <CookieCleanupInitializer />
              <ServiceWorkerRegister />
              <BackgroundNotificationsInitializer />
              {children}
              <FakeCallOverlay />
              <PWAInstaller />
              <Toaster />
            </NotificationPreferencesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
