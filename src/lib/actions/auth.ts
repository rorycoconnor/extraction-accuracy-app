'use server'

import { cookies } from 'next/headers';

/**
 * Server action to generate the OAuth authorization URL with CSRF protection.
 * Sets a state cookie and returns the URL for client-side redirect.
 */
export async function getOAuthUrl(origin: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_BOX_CLIENT_ID;
  if (!clientId || clientId === 'your_box_client_id') {
    throw new Error('BOX_CLIENT_ID is not configured');
  }

  const redirectUri = `${origin}/api/auth/box/callback`;
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set('box_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const authUrl = new URL('https://account.box.com/api/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}
