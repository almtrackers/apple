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

// For now, we'll focus on outgoing cookie domain scoping
// Incoming cookie filtering can be added later if needed
function filterIncomingCookies(request: NextRequest, subdomain: string | null): NextRequest {
  // Skip filtering for now to avoid login issues
  // This can be re-enabled once the basic functionality works
  return request;
}

// Modify outgoing cookies to ensure proper domain scoping
function processOutgoingCookies(response: NextResponse, cookieDomain: string | undefined): NextResponse {
  if (!cookieDomain) return response;

  try {
    // Get all set-cookie headers - handle differently for different environments
    const setCookieHeaders: string[] = [];

    // In NextResponse, we can iterate through headers
    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      setCookieHeaders.push(cookieHeader);
    }

    // Handle multiple cookies (though NextResponse might not support getAll)
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
  } catch (error) {
    console.warn('Middleware cookie processing failed:', error);
  }

  return response;
}

export function middleware(request: NextRequest) {
  const subdomain = getCurrentSubdomain(request);
  const cookieDomain = getCookieDomain(subdomain);

  // Filter incoming cookies
  const filteredRequest = filterIncomingCookies(request, subdomain);

  // Continue with the request
  const response = NextResponse.next();

  // For now, skip cookie processing to fix login issues
  // TODO: Re-enable cookie domain scoping after fixing login
  // return processOutgoingCookies(response, cookieDomain);

  return response;
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
