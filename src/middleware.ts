import { NextRequest, NextResponse } from 'next/server';

/**
 * Cookie isolation middleware for subdomain-specific cookie handling
 * Ensures cookies are scoped to their respective subdomains to prevent
 * cross-subdomain contamination between ebill.almtrace.com and apple.almtrace.com
 */

// Determine the current subdomain based on the request hostname
function getCurrentSubdomain(request: NextRequest): string | null {
  const hostname = request.headers.get('host') || '';
  const parts = hostname.split('.');

  // For local development, allow localhost and any port
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return null; // Skip cookie domain restrictions for local dev
  }

  // Extract subdomain from *.almtrace.com
  if (parts.length >= 3 && parts[parts.length - 2] === 'almtrace' && parts[parts.length - 1] === 'com') {
    return parts[0]; // e.g., 'ebill' or 'apple'
  }

  return null;
}

// Get the appropriate domain for cookie scoping
function getCookieDomain(subdomain: string | null): string | undefined {
  if (!subdomain) return undefined; // For local dev, don't set domain

  // Map subdomain to full domain for cookie scoping
  const subdomainMap: Record<string, string> = {
    'ebill': 'ebill.almtrace.com',
    'apple': 'apple.almtrace.com',
  };

  return subdomainMap[subdomain] || `${subdomain}.almtrace.com`;
}

// Check if a cookie name should be allowed for this subdomain
function isAllowedCookieForSubdomain(cookieName: string, subdomain: string | null): boolean {
  // Firebase Auth cookies that should be subdomain-specific
  const firebaseCookies = [
    'firebaseLocalStorageDb',
    'firebase-auth-token',
    'firebase-heartbeat-database',
    '__firebase_request_key',
  ];

  // App-specific cookies (customize based on your app's cookie naming)
  const appSpecificCookies: Record<string, string[]> = {
    'ebill': ['almtrack_session', 'ebill_auth'],
    'apple': ['nextn_session', 'apple_auth'],
  };

  // Allow Firebase cookies only if they match the subdomain
  if (firebaseCookies.some(fb => cookieName.includes(fb))) {
    return true; // Firebase handles its own domain scoping
  }

  // Allow app-specific cookies
  if (subdomain && appSpecificCookies[subdomain]) {
    return appSpecificCookies[subdomain].some(appCookie => cookieName.includes(appCookie));
  }

  // Block cookies from other subdomains
  const otherSubdomains = Object.keys(appSpecificCookies).filter(s => s !== subdomain);
  for (const otherSubdomain of otherSubdomains) {
    if (appSpecificCookies[otherSubdomain].some(appCookie => cookieName.includes(appCookie))) {
      return false;
    }
  }

  // Allow other cookies by default (be conservative)
  return true;
}

// Strip cookies that shouldn't be accessible from this subdomain
function filterIncomingCookies(request: NextRequest, subdomain: string | null): NextRequest {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return request;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const filteredCookies = cookies.filter(cookie => {
    const [name] = cookie.split('=');
    return isAllowedCookieForSubdomain(name, subdomain);
  });

  if (filteredCookies.length !== cookies.length) {
    // Create a new request with filtered cookies
    const newHeaders = new Headers(request.headers);
    newHeaders.set('cookie', filteredCookies.join('; '));

    // Create a new request with the filtered headers
    const { method, url, body, cache, credentials, integrity, keepalive, mode, redirect, referrer, referrerPolicy } = request;
    const newRequest = new Request(url, {
      method,
      headers: newHeaders,
      body,
      cache,
      credentials,
      integrity,
      keepalive,
      mode,
      redirect,
      referrer,
      referrerPolicy,
    });

    return newRequest as NextRequest;
  }

  return request;
}

// Modify outgoing cookies to ensure proper domain scoping
function processOutgoingCookies(response: NextResponse, cookieDomain: string | undefined): NextResponse {
  if (!cookieDomain) return response;

  const setCookieHeaders = response.headers.getAll('set-cookie');
  if (setCookieHeaders.length === 0) return response;

  // Clear existing set-cookie headers
  response.headers.delete('set-cookie');

  // Process each cookie and ensure proper domain
  setCookieHeaders.forEach(cookieHeader => {
    let processedCookie = cookieHeader;

    // Add or correct the Domain attribute
    if (processedCookie.includes('Domain=')) {
      // Replace existing domain with subdomain-specific one
      processedCookie = processedCookie.replace(/Domain=[^;]+/, `Domain=${cookieDomain}`);
    } else {
      // Add domain if not present
      processedCookie += `; Domain=${cookieDomain}`;
    }

    // Ensure secure and httpOnly flags are set appropriately
    if (!processedCookie.includes('Secure') && !processedCookie.includes('secure')) {
      processedCookie += '; Secure';
    }

    if (!processedCookie.includes('HttpOnly') && !processedCookie.includes('httponly')) {
      processedCookie += '; HttpOnly';
    }

    // Ensure SameSite is set appropriately (Lax for better compatibility)
    if (!processedCookie.includes('SameSite=')) {
      processedCookie += '; SameSite=Lax';
    }

    response.headers.append('set-cookie', processedCookie);
  });

  return response;
}

export function middleware(request: NextRequest) {
  const subdomain = getCurrentSubdomain(request);
  const cookieDomain = getCookieDomain(subdomain);

  // Filter incoming cookies
  const filteredRequest = filterIncomingCookies(request, subdomain);

  // Continue with the request (we can't modify the request object directly,
  // but NextResponse will handle the response cookies)
  const response = NextResponse.next();

  // Process outgoing cookies
  return processOutgoingCookies(response, cookieDomain);
}

// Configure which paths this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
