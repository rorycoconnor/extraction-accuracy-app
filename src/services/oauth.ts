import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

interface OAuthState {
  isConnected: boolean;
  tokens?: OAuthTokens;
  lastConnected?: string;
}

// Cookie names for secure token storage
const COOKIE_NAMES = {
  ACCESS_TOKEN: 'box_oauth_access_token',
  REFRESH_TOKEN: 'box_oauth_refresh_token',
  EXPIRES_AT: 'box_oauth_expires_at',
  TOKEN_TYPE: 'box_oauth_token_type',
  LAST_CONNECTED: 'box_oauth_last_connected'
} as const;

/**
 * Store OAuth tokens securely in HTTP-only cookies
 */
export async function storeOAuthTokens(tokens: OAuthTokens): Promise<void> {
  const cookieStore = await cookies();
  
  // Set secure HTTP-only cookies with tokens
  cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax',
    maxAge: tokens.expiresAt - Date.now(), // Cookie expires when token expires
    path: '/'
  });
  
  cookieStore.set(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days for refresh token
    path: '/'
  });
  
  cookieStore.set(COOKIE_NAMES.EXPIRES_AT, tokens.expiresAt.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.expiresAt - Date.now(),
    path: '/'
  });
  
  cookieStore.set(COOKIE_NAMES.TOKEN_TYPE, tokens.tokenType, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.expiresAt - Date.now(),
    path: '/'
  });
  
  cookieStore.set(COOKIE_NAMES.LAST_CONNECTED, new Date().toISOString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/'
  });
  
  // Verify cookies were set
  const verifyAccessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  logger.info('OAuth tokens stored securely in HTTP-only cookies', {
    accessTokenStored: !!verifyAccessToken,
    accessTokenLength: verifyAccessToken?.length || 0,
    expiresAt: tokens.expiresAt,
    nodeEnv: process.env.NODE_ENV,
    isSecure: process.env.NODE_ENV === 'production'
  });
}

/**
 * Get current OAuth connection status from cookies
 */
export async function getOAuthStatus(): Promise<OAuthState> {
  const cookieStore = await cookies();
  
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;
  const expiresAt = cookieStore.get(COOKIE_NAMES.EXPIRES_AT)?.value;
  const tokenType = cookieStore.get(COOKIE_NAMES.TOKEN_TYPE)?.value;
  const lastConnected = cookieStore.get(COOKIE_NAMES.LAST_CONNECTED)?.value;
  
  logger.debug('OAuth status check', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    hasExpiresAt: !!expiresAt,
    accessTokenLength: accessToken?.length || 0,
    refreshTokenLength: refreshToken?.length || 0,
    expiresAt,
    lastConnected
  });
  
  if (!accessToken || !refreshToken || !expiresAt) {
    logger.debug('OAuth not connected - missing required tokens', {
      missingAccessToken: !accessToken,
      missingRefreshToken: !refreshToken,
      missingExpiresAt: !expiresAt
    });
    return { isConnected: false };
  }
  
  // Check if token is expired
  const expiresAtNum = parseInt(expiresAt);
  const now = Date.now();
  const isExpired = now >= expiresAtNum;
  
  logger.debug('OAuth token validation', {
    expiresAt: expiresAtNum,
    now,
    isExpired,
    timeUntilExpiry: expiresAtNum - now
  });
  
  if (isExpired) {
    logger.warn('OAuth token expired', {
      expiresAt: expiresAtNum,
      now,
      expiredBy: now - expiresAtNum
    });
    return { isConnected: false };
  }
  
  return {
    isConnected: true,
    tokens: {
      accessToken,
      refreshToken,
      expiresAt: expiresAtNum,
      tokenType: tokenType || 'Bearer'
    },
    lastConnected
  };
}

/**
 * Check if OAuth is connected and tokens are valid
 */
export async function isOAuthConnected(): Promise<boolean> {
  const cookieStore = await cookies();
  
  // Get tokens directly from cookies to check refresh token even if access token is expired
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;
  const expiresAt = cookieStore.get(COOKIE_NAMES.EXPIRES_AT)?.value;
  
  // Need at least access token or refresh token to proceed
  if (!accessToken && !refreshToken) {
    return false;
  }
  
  // If we have a refresh token but no access token, or access token is expired/expiring soon, try to refresh
  const now = Date.now();
  const expiresAtNum = expiresAt ? parseInt(expiresAt) : 0;
  const isExpiredOrExpiringSoon = !expiresAtNum || now >= expiresAtNum - (5 * 60 * 1000);
  
  if (isExpiredOrExpiringSoon && refreshToken) {
    // Token expired or expiring soon, try to refresh
    try {
      logger.debug('Attempting to refresh OAuth token', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiresAt: expiresAtNum,
        now,
        isExpired: now >= expiresAtNum
      });
      await refreshOAuthToken();
      return true;
    } catch (error) {
      logger.error('Failed to refresh OAuth token', error instanceof Error ? error : { error });
      await disconnectOAuth();
      return false;
    }
  }
  
  // If we have a valid (non-expired) access token, we're connected
  if (accessToken && expiresAtNum && now < expiresAtNum) {
    return true;
  }
  
  return false;
}

/**
 * Get valid access token for Box API calls
 */
export async function getOAuthAccessToken(): Promise<string | null> {
  // Ensure we're connected (will refresh token if needed)
  if (!(await isOAuthConnected())) {
    return null;
  }
  
  // Read the access token directly from cookies (may have been refreshed)
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const expiresAt = cookieStore.get(COOKIE_NAMES.EXPIRES_AT)?.value;
  
  // Double-check the token is still valid (in case it expired between checks)
  if (!accessToken || !expiresAt) {
    logger.warn('Access token missing after connection check');
    return null;
  }
  
  const expiresAtNum = parseInt(expiresAt);
  const now = Date.now();
  
  // If token is expired, try to refresh one more time
  if (now >= expiresAtNum) {
    logger.debug('Token expired between connection check and token retrieval, attempting refresh');
    try {
      await refreshOAuthToken();
      // Read the refreshed token
      const refreshedToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
      return refreshedToken || null;
    } catch (error) {
      logger.error('Failed to refresh token in getOAuthAccessToken', error instanceof Error ? error : { error });
      return null;
    }
  }
  
  return accessToken;
}

/**
 * Refresh OAuth access token using refresh token
 */
async function refreshOAuthToken(): Promise<void> {
  const cookieStore = await cookies();
  
  // Read refresh token directly from cookies (even if access token is expired)
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const clientId = process.env.BOX_CLIENT_ID;
  const clientSecret = process.env.BOX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Box OAuth credentials');
  }

  const response = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await response.json();
  
  // Store the new tokens
  // Use the new refresh token if provided, otherwise keep the existing one
  await storeOAuthTokens({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || refreshToken,
    expiresAt: Date.now() + (tokenData.expires_in * 1000),
    tokenType: tokenData.token_type,
  });

  logger.info('OAuth token refreshed successfully');
}

/**
 * Disconnect OAuth (clear all cookies)
 */
export async function disconnectOAuth(): Promise<void> {
  const cookieStore = await cookies();
  
  // Clear all OAuth cookies
  Object.values(COOKIE_NAMES).forEach(cookieName => {
    cookieStore.delete(cookieName);
  });
  
  logger.info('OAuth disconnected and cookies cleared');
}

/**
 * Get OAuth authorization URL for Box
 */
export async function getOAuthAuthorizationUrl(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_BOX_CLIENT_ID || 'your_box_client_id';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/api/auth/box/callback`;
  const state = Math.random().toString(36).substring(7);
  
  // Build authorization URL - Box will use scopes configured in Developer Console
  const authUrl = new URL('https://account.box.com/api/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  
  return authUrl.toString();
} 