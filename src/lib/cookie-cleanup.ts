/**
 * Cookie cleanup utility for subdomain isolation
 * Helps clear broad-domain cookies that were set before subdomain isolation was implemented
 */

interface CookieCleanupOptions {
  /** Current subdomain (e.g., 'ebill', 'apple') */
  currentSubdomain: string;
  /** Whether to perform cleanup automatically on page load */
  autoCleanup?: boolean;
  /** Callback for when cleanup is performed */
  onCleanup?: (cleanedCookies: string[]) => void;
  /** Whether to log cleanup operations */
  debug?: boolean;
}

/**
 * Get all cookies from document.cookie
 */
function getAllCookies(): Record<string, string> {
  const cookies: Record<string, string> = {};
  const cookieString = document.cookie;

  if (!cookieString) return cookies;

  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name) {
      cookies[name] = value || '';
    }
  });

  return cookies;
}

/**
 * Check if a cookie has a broad domain (not subdomain-specific)
 */
function hasBroadDomain(cookieName: string, currentSubdomain: string): boolean {
  // Check for cookies that might be shared across subdomains
  const broadDomainPatterns = [
    // Session cookies that might be shared
    /session/i,
    /auth/i,
    // Traccar-specific cookies that might need isolation
    /^JSESSIONID/i,
    /^rememberMe/i,
    // Custom app cookies that might need isolation
    new RegExp(currentSubdomain, 'i'), // Actually check if it's from the current subdomain
  ];

  // More specific checks for known problematic cookies
  const knownBroadCookies = [
    'authCredentials_local', // The localStorage key from auth context
    'authCredentials_session', // The sessionStorage key from auth context
    'session_token', // Session token for WebSocket auth
    'traccar_session', // Traccar session cookies
    'jsessionid', // Tomcat session cookie
  ];

  return knownBroadCookies.includes(cookieName.toLowerCase()) ||
         broadDomainPatterns.some(pattern => pattern.test(cookieName));
}

/**
 * Clear a specific cookie by setting it to expire
 */
function clearCookie(name: string, domain?: string): void {
  const cookieOptions = [
    `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    'path=/',
    'Secure',
    'SameSite=Lax',
  ];

  if (domain) {
    cookieOptions.push(`domain=${domain}`);
  }

  // Clear cookie with and without domain
  document.cookie = cookieOptions.join('; ');

  // Also try clearing with .almtrace.com domain (the problematic broad domain)
  if (domain && domain.includes('almtrace.com') && !domain.startsWith('.')) {
    const broadDomain = `.${domain.split('.').slice(-2).join('.')}`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure; SameSite=Lax; domain=${broadDomain}`;
  }
}

/**
 * Perform cleanup of broad-domain cookies
 */
export function cleanupBroadDomainCookies(options: CookieCleanupOptions): string[] {
  const { currentSubdomain, debug = false, onCleanup } = options;
  const allCookies = getAllCookies();
  const cleanedCookies: string[] = [];

  if (debug) {
    console.log('Cookie cleanup starting...', { currentSubdomain, allCookies });
  }

  Object.keys(allCookies).forEach(cookieName => {
    if (hasBroadDomain(cookieName, currentSubdomain)) {
      if (debug) {
        console.log(`Clearing broad-domain cookie: ${cookieName}`);
      }

      // Clear the cookie with current subdomain domain
      const currentDomain = `${currentSubdomain}.almtrace.com`;
      clearCookie(cookieName, currentDomain);

      // Also clear with broad domain (.almtrace.com)
      clearCookie(cookieName, '.almtrace.com');

      // Clear without domain specification
      clearCookie(cookieName);

      cleanedCookies.push(cookieName);
    }
  });

  if (cleanedCookies.length > 0) {
    if (debug) {
      console.log('Cookie cleanup completed:', cleanedCookies);
    }
    onCleanup?.(cleanedCookies);
  }

  return cleanedCookies;
}

/**
 * Check if cleanup has been performed recently (to avoid repeated cleanups)
 */
export function hasRecentCleanup(): boolean {
  const cleanupKey = 'cookie_cleanup_performed';
  const lastCleanup = localStorage.getItem(cleanupKey);

  if (!lastCleanup) return false;

  const lastCleanupTime = parseInt(lastCleanup, 10);
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000; // 24 hours

  // Consider cleanup recent if performed within last 24 hours
  return (now - lastCleanupTime) < oneDayMs;
}

/**
 * Mark cleanup as performed
 */
export function markCleanupPerformed(): void {
  localStorage.setItem('cookie_cleanup_performed', Date.now().toString());
}

/**
 * Initialize automatic cookie cleanup for subdomain isolation
 * Call this once when the app starts
 */
export function initializeCookieCleanup(options: Omit<CookieCleanupOptions, 'autoCleanup'>): void {
  const { currentSubdomain, debug = false, onCleanup } = options;

  // Skip if running on server or not in browser
  if (typeof window === 'undefined') return;

  // Skip for localhost development
  if (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')) {
    return;
  }

  // Check if cleanup was recently performed
  if (hasRecentCleanup()) {
    if (debug) {
      console.log('Cookie cleanup skipped - recently performed');
    }
    return;
  }

  // Perform cleanup
  const cleanedCookies = cleanupBroadDomainCookies({
    currentSubdomain,
    debug,
    onCleanup: (cookies) => {
      markCleanupPerformed();
      onCleanup?.(cookies);
    },
  });

  if (cleanedCookies.length > 0) {
    // Reload the page to ensure clean state (optional but recommended)
    if (debug) {
      console.log('Cookies cleaned, consider reloading page for clean state');
    }
  }
}

/**
 * Manual cleanup function that can be called from developer console
 */
export function manualCookieCleanup(subdomain?: string): string[] {
  const currentSubdomain = subdomain || getCurrentSubdomain();

  if (!currentSubdomain) {
    console.warn('Could not determine current subdomain for cookie cleanup');
    return [];
  }

  console.log(`Manually cleaning cookies for subdomain: ${currentSubdomain}`);
  return cleanupBroadDomainCookies({
    currentSubdomain,
    debug: true,
    onCleanup: (cookies) => {
      console.log('Manual cookie cleanup completed:', cookies);
      markCleanupPerformed();
    },
  });
}

/**
 * Get current subdomain for cookie operations
 */
function getCurrentSubdomain(): string | null {
  const hostname = window.location.hostname;

  // Extract subdomain from *.almtrace.com
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[parts.length - 2] === 'almtrace' && parts[parts.length - 1] === 'com') {
    return parts[0]; // e.g., 'ebill' or 'apple'
  }

  return null;
}

// Export the manual cleanup function globally for developer console access
if (typeof window !== 'undefined') {
  (window as any).cleanupCookies = manualCookieCleanup;
}
