'use client';

import { useEffect } from 'react';
import { initializeCookieCleanup } from '@/lib/cookie-cleanup';

function CookieCleanupInitializer() {
  useEffect(() => {
    // Get current subdomain
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    let currentSubdomain: string | null = null;

    if (parts.length >= 3 && parts[parts.length - 2] === 'almtrace' && parts[parts.length - 1] === 'com') {
      currentSubdomain = parts[0];
    }

    if (currentSubdomain) {
      initializeCookieCleanup({
        currentSubdomain,
        debug: process.env.NODE_ENV === 'development',
        onCleanup: (cleanedCookies) => {
          console.log(`Cleaned ${cleanedCookies.length} broad-domain cookies for subdomain isolation:`, cleanedCookies);
        },
      });
    }
  }, []);

  return null;
}

export { CookieCleanupInitializer };
