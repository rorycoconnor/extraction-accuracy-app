import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { isAllowedBoxHost } from '@/lib/box-proxy-hosts';
import { getBoxAccessToken } from '@/services/box';

// `authorization` is deliberately absent: the token is injected server-side from
// the caller's session so a client-supplied bearer cannot be relayed through us.
const FORWARDED_REQUEST_HEADERS = [
  'range',
  'if-match',
  'if-none-match',
  'accept',
];

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
];

/**
 * Catch-all proxy for Box Content Preview SDK requests.
 *
 * URL pattern: /api/box-proxy/{host}/{rest-of-path}?{query}
 * Example:     /api/box-proxy/api.box.com/2.0/files/123?fields=name
 * Proxies to:  https://api.box.com/2.0/files/123?fields=name
 */
async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length < 2) {
    return NextResponse.json({ error: 'Invalid proxy path' }, { status: 400 });
  }

  const host = pathSegments[0];
  if (!isAllowedBoxHost(host)) {
    logger.warn('Box proxy: blocked request to disallowed host', { host });
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  let accessToken: string;
  try {
    accessToken = await getBoxAccessToken();
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const restPath = pathSegments.slice(1).join('/');
  const targetUrl = `https://${host}/${restPath}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('authorization', `Bearer ${accessToken}`);

  try {
    const boxResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      redirect: 'manual',
    });

    // Only follow redirects that stay on an allow-listed Box host.
    if (boxResponse.status >= 300 && boxResponse.status < 400) {
      const location = boxResponse.headers.get('location');
      const redirectUrl = location ? new URL(location, targetUrl) : null;

      if (!redirectUrl || !isAllowedBoxHost(redirectUrl.hostname)) {
        logger.warn('Box proxy: blocked redirect to disallowed host', {
          host: redirectUrl?.hostname,
        });
        return NextResponse.json({ error: 'Redirect not allowed' }, { status: 502 });
      }

      const proxiedRedirect = new URL(
        `/api/box-proxy/${redirectUrl.hostname}${redirectUrl.pathname}${redirectUrl.search}`,
        request.nextUrl.origin
      );
      return NextResponse.redirect(proxiedRedirect, 307);
    }

    const responseHeaders = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = boxResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new NextResponse(boxResponse.body, {
      status: boxResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    logger.error('Box proxy fetch failed', {
      targetUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 502 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
