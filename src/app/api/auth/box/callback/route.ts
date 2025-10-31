import { NextRequest, NextResponse } from 'next/server';
import { storeOAuthTokens } from '@/services/oauth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      logger.error('Box OAuth error', { error });
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=' + encodeURIComponent(error), request.url)
      );
    }

    // Validate required parameters
    if (!code) {
      logger.error('Missing authorization code in OAuth callback');
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=missing_code', request.url)
      );
    }

    // Exchange authorization code for access token
    const clientId = process.env.BOX_CLIENT_ID;
    const clientSecret = process.env.BOX_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/box/callback`;

    logger.debug('OAuth callback - environment check', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri,
      origin: request.nextUrl.origin
    });

    if (!clientId || !clientSecret) {
      logger.error('Missing Box OAuth credentials', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        envVars: Object.keys(process.env).filter(k => k.includes('BOX'))
      });
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
      logger.error('Failed to exchange code for token', { errorText });
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    
    // Validate token data
    if (!tokenData.access_token) {
      logger.error('Token exchange succeeded but no access_token in response', { tokenData });
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed&message=no_access_token', request.url)
      );
    }
    
    logger.info('Token exchange successful', { 
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    });
    
    // Store the OAuth tokens securely
    await storeOAuthTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '', // Some OAuth flows don't return refresh token
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      tokenType: tokenData.token_type || 'Bearer',
    });
    
    logger.info('OAuth tokens stored successfully');
    
    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?success=oauth_connected', request.url)
    );

  } catch (error) {
    logger.error('OAuth callback error', error instanceof Error ? error : { error });
    return NextResponse.redirect(
      new URL('/settings?error=oauth_failed&message=unexpected_error', request.url)
    );
  }
} 