import { NextRequest, NextResponse } from 'next/server';
import { storeOAuthTokens } from '@/services/oauth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Box OAuth error:', error);
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=' + encodeURIComponent(error), request.url)
      );
    }

    // Validate required parameters
    if (!code) {
      console.error('Missing authorization code in OAuth callback');
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=missing_code', request.url)
      );
    }

    // Exchange authorization code for access token
    const clientId = process.env.BOX_CLIENT_ID;
    const clientSecret = process.env.BOX_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/box/callback`;

    if (!clientId || !clientSecret) {
      console.error('Missing Box OAuth credentials');
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=missing_credentials', request.url)
      );
    }

    const tokenResponse = await fetch('https://api.box.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    
    // Store the OAuth tokens securely
    await storeOAuthTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      tokenType: tokenData.token_type,
    });
    
    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?success=oauth_connected', request.url)
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/settings?error=oauth_failed&message=unexpected_error', request.url)
    );
  }
} 