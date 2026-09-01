/**
 * Single source of truth for which upstream hosts the Box preview proxy may reach.
 *
 * Each pattern anchors the subdomain boundary with `(?:[a-z0-9-]+\.)*`. A looser
 * pattern such as `[a-z0-9-]*\.?boxcloud\.com` also matches lookalike domains
 * like `evilboxcloud.com`, which would let the proxy forward the caller's
 * Authorization header to an attacker-controlled host.
 */
const ALLOWED_HOST_PATTERNS = [
  /^api\.box\.com$/,
  /^(?:[a-z0-9-]+\.)*boxcloud\.com$/,
  /^(?:[a-z0-9-]+\.)*boxcdn\.net$/,
  /^(?:[a-z0-9-]+\.)*app\.box\.com$/,
];

export const BOX_PROXY_PREFIX = '/api/box-proxy';

export function isAllowedBoxHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return ALLOWED_HOST_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Rewrites an absolute Box URL so it routes through the server-side proxy.
 * Returns the input unchanged when the URL is unparseable or off-allow-list,
 * so callers fail closed rather than proxying somewhere unexpected.
 */
export function rewriteBoxUrlToProxy(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return url;
  if (!isAllowedBoxHost(parsed.hostname)) return url;

  return `${BOX_PROXY_PREFIX}/${parsed.hostname}${parsed.pathname}${parsed.search}`;
}
