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
  
  logger.info('OAuth tokens stored securely in HTTP-only cookies');
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
  
  if (!accessToken || !refreshToken || !expiresAt) {
    return { isConnected: false };
  }
  
  return {
    isConnected: true,
    tokens: {
      accessToken,
      refreshToken,
      expiresAt: parseInt(expiresAt),
      tokenType: tokenType || 'Bearer'
    },
    lastConnected
  };
}

/**
 * Check if OAuth is connected and tokens are valid
 */
export async function isOAuthConnected(): Promise<boolean> {
  const status = await getOAuthStatus();
  
  if (!status.isConnected || !status.tokens) {
    return false;
  }

  // Check if token is expired (with 5-minute buffer)
  const now = Date.now();
  const expiresAt = status.tokens.expiresAt;
  
  if (now >= expiresAt - (5 * 60 * 1000)) {
    // Token expired, try to refresh
    try {
      await refreshOAuthToken();
      return true;
    } catch (error) {
      logger.error('Failed to refresh OAuth token', error instanceof Error ? error : { error });
      await disconnectOAuth();
      return false;
    }
  }

  return true;
}

/**
 * Get valid access token for Box API calls
 */
export async function getOAuthAccessToken(): Promise<string | null> {
  if (!(await isOAuthConnected())) {
    return null;
  }
  
  const status = await getOAuthStatus();
  return status.tokens?.accessToken || null;
}

/**
 * Refresh OAuth access token using refresh token
 */
async function refreshOAuthToken(): Promise<void> {
  const status = await getOAuthStatus();
  
  if (!status.tokens?.refreshToken) {
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
      refresh_token: status.tokens.refreshToken,
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
  await storeOAuthTokens({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || status.tokens.refreshToken,
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
  
  // Request necessary scopes for the application
  // See: https://developer.box.com/guides/api-calls/permissions-and-errors/scopes/
  const scopes = [
    'root_readwrite',           // Read and write all files and folders
    'manage_enterprise_properties', // Create and manage metadata templates
    'manage_managed_users',     // Access user information
  ].join(' ');
  
  return `https://account.box.com/api/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes)}`;
} 