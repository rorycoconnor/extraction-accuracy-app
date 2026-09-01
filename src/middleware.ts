import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;
const AUTH_RATE_LIMIT_MAX = 20;
const PROXY_RATE_LIMIT_MAX = 2000;

const requestCounts = new Map<string, { count: number; windowStart: number }>();

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

function checkRateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  return { allowed: entry.count <= maxRequests, remaining };
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn01.boxcdn.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn01.boxcdn.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn01.boxcdn.net",
      "img-src 'self' data: blob: https://api.box.com https://placehold.co https://*.boxcloud.com https://*.boxcdn.net https://cdn01.boxcdn.net",
      "connect-src 'self' https://api.box.com https://account.box.com https://upload.box.com https://*.app.box.com https://dl.boxcloud.com https://*.boxcloud.com",
      "frame-src 'self' https://app.box.com https://*.app.box.com https://*.box.com",
      "base-uri 'self'",
      "form-action 'self' https://account.box.com",
    ].join('; ')
  );

  return response;
}

const PUBLIC_AUTH_ROUTES = [
  '/api/auth/box/callback',
  '/api/auth/box/status',
  '/api/auth/box/user',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block debug endpoint in production
  if (pathname === '/api/auth/box/debug') {
    if (process.env.NODE_ENV === 'production') {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Not found' }, { status: 404 })
      );
    }
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const rateLimitKey = getRateLimitKey(request);
    const isAuthRoute = pathname.startsWith('/api/auth/');
    // The Preview SDK fans out into many sub-requests per document, so the
    // proxy gets a much higher ceiling rather than being exempted entirely.
    const isProxyRoute = pathname.startsWith('/api/box-proxy/');
    const maxRequests = isProxyRoute
      ? PROXY_RATE_LIMIT_MAX
      : isAuthRoute
        ? AUTH_RATE_LIMIT_MAX
        : RATE_LIMIT_MAX_REQUESTS;
    const rateLimitBucket = isProxyRoute ? 'proxy' : isAuthRoute ? 'auth' : 'api';
    const { allowed, remaining } = checkRateLimit(
      `${rateLimitKey}:${rateLimitBucket}`,
      maxRequests
    );

    if (!allowed) {
      const response = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
      response.headers.set('Retry-After', '60');
      return addSecurityHeaders(response);
    }

    // Protect non-public API routes: require auth cookie or env-based auth
    if (!PUBLIC_AUTH_ROUTES.includes(pathname) && !pathname.startsWith('/api/auth/box/debug')) {
      const hasOAuthToken = request.cookies.get('box_oauth_access_token')?.value;
      const hasRefreshToken = request.cookies.get('box_oauth_refresh_token')?.value;
      const hasDevToken = !!process.env.BOX_DEVELOPER_TOKEN;
      const hasServiceAccount = !!process.env.BOX_CONFIG_JSON_BASE64;

      if (!hasOAuthToken && !hasRefreshToken && !hasDevToken && !hasServiceAccount) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        );
      }
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    return addSecurityHeaders(response);
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
