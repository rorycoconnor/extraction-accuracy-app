import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import BoxSDK from 'box-node-sdk';
import { logger } from '@/lib/logger';
import { getOAuthAccessToken } from '@/services/oauth';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Get all OAuth-related cookies for debugging
    const allCookies = cookieStore.getAll();
    const oauthCookies = allCookies.filter(c => c.name.includes('box_oauth'));
    
    logger.debug('[API] Checking authentication', {
      totalCookies: allCookies.length,
      oauthCookieCount: oauthCookies.length,
      oauthCookieNames: oauthCookies.map(c => c.name),
      hasRequestHeaders: !!request.headers.get('cookie')
    });
    
    const accessToken = cookieStore.get('box_oauth_access_token')?.value;
    const tokenType = cookieStore.get('box_oauth_token_type')?.value || 'Bearer';
    const expiresAt = cookieStore.get('box_oauth_expires_at')?.value;
    const refreshToken = cookieStore.get('box_oauth_refresh_token')?.value;
    
    logger.debug('[API] OAuth token details', { 
      hasToken: !!accessToken,
      tokenLength: accessToken?.length || 0,
      hasRefreshToken: !!refreshToken,
      hasExpiresAt: !!expiresAt,
      expiresAtValue: expiresAt
    });
    
    // Check for OAuth tokens first - try to get a valid token (will refresh if expired)
    // We check for cookies directly because getOAuthStatus might return false for expired tokens
    // but getOAuthAccessToken will attempt to refresh them
    if (accessToken || refreshToken) {
      try {
        logger.debug('[API] OAuth cookies present, attempting to get valid access token', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenLength: accessToken?.length || 0,
          refreshTokenLength: refreshToken?.length || 0,
          expiresAt: expiresAt ? new Date(parseInt(expiresAt)).toISOString() : null,
          expiresAtNow: Date.now(),
          isExpired: expiresAt ? Date.now() >= parseInt(expiresAt) : null
        });
        
        // Get a valid access token (will refresh if expired)
        const validAccessToken = await getOAuthAccessToken();
        
        logger.debug('[API] After getOAuthAccessToken call', {
          hasValidToken: !!validAccessToken,
          validTokenLength: validAccessToken?.length || 0
        });
        
        if (!validAccessToken) {
          logger.warn('[API] No valid OAuth access token available after refresh attempt', {
            hadAccessToken: !!accessToken,
            hadRefreshToken: !!refreshToken
          });
          // Continue to try other authentication methods
        } else {
          logger.debug('[API] Attempting OAuth authentication', {
            tokenLength: validAccessToken.length,
            hasClientId: !!process.env.NEXT_PUBLIC_BOX_CLIENT_ID,
            hasClientSecret: !!process.env.BOX_CLIENT_SECRET
          });
          
          // Create Box client with OAuth token
          const sdk = new BoxSDK({
            clientID: process.env.NEXT_PUBLIC_BOX_CLIENT_ID || process.env.BOX_CLIENT_ID || '',
            clientSecret: process.env.BOX_CLIENT_SECRET || '',
          });
          
          if (!sdk || !process.env.BOX_CLIENT_SECRET) {
            throw new Error('Box SDK configuration missing');
          }
          
          const client = sdk.getBasicClient(validAccessToken);
          const userInfo = await client.users.get(client.CURRENT_USER_ID);
          
          logger.info('[API] OAuth authentication successful', { user: userInfo.login });
          
          return NextResponse.json({
            success: true,
            authMethod: 'OAuth 2.0',
            user: {
              id: userInfo.id,
              name: userInfo.name,
              login: userInfo.login,
              enterprise: userInfo.enterprise ? {
                id: userInfo.enterprise.id,
                name: userInfo.enterprise.name
              } : null
            }
          });
        }
      } catch (oauthError) {
        const errorDetails = oauthError instanceof Error 
          ? { message: oauthError.message, stack: oauthError.stack }
          : { error: oauthError };
        logger.error('[API] OAuth user fetch failed', {
          ...errorDetails,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken
        });
        // OAuth token might be expired or invalid, continue to try other methods
      }
    } else {
      logger.debug('[API] No OAuth cookies found');
    }
    
    // Try service account authentication
    const configJson = process.env.BOX_CONFIG_JSON_BASE64;
    logger.debug('[API] Service account config present', { hasConfig: !!configJson });
    
    if (configJson) {
      try {
        logger.debug('[API] Attempting service account authentication');
        const config = JSON.parse(Buffer.from(configJson, 'base64').toString());
        const sdk = new BoxSDK(config);
        const serviceAccountClient = sdk.getAppAuthClient('enterprise', config.enterpriseID);
        
        // Get enterprise user (admin user)
        const adminUserInfo = await serviceAccountClient.enterprise.getUsers();
        const adminUser = adminUserInfo.entries?.[0];
        
        if (adminUser) {
          logger.info('[API] Service account authentication successful', { user: adminUser.login });
          
          return NextResponse.json({
            success: true,
            authMethod: 'Service Account',
            user: {
              id: adminUser.id,
              name: adminUser.name,
              login: adminUser.login,
              enterprise: {
                id: config.enterpriseID,
                name: config.boxSubjectType || 'Enterprise'
              }
            }
          });
        }
      } catch (serviceError) {
        logger.error('[API] Service account user fetch failed', serviceError instanceof Error ? serviceError : { error: serviceError });
      }
    }
    
    // Try developer token
    const developerToken = process.env.BOX_DEVELOPER_TOKEN;
    const enterpriseId = process.env.BOX_ENTERPRISE_ID;
    logger.debug('[API] Developer token present', { hasToken: !!developerToken });
    
    if (developerToken) {
      try {
        logger.debug('[API] Attempting developer token authentication');
        const sdk = new BoxSDK({
          clientID: 'dummy', // Not needed for developer token
          clientSecret: 'dummy'
        });
        
        const client = sdk.getBasicClient(developerToken);
        const userInfo = await client.users.get(client.CURRENT_USER_ID);
        
        logger.info('[API] Developer token authentication successful', { user: userInfo.login });
        
        return NextResponse.json({
          success: true,
          authMethod: 'Developer Token',
          user: {
            id: userInfo.id,
            name: userInfo.name,
            login: userInfo.login,
            enterprise: enterpriseId ? {
              id: enterpriseId,
              name: 'Enterprise'
            } : null
          }
        });
      } catch (devTokenError) {
        logger.error('[API] Developer token user fetch failed', devTokenError instanceof Error ? devTokenError : { error: devTokenError });
      }
    }
    
    // If no authentication method worked - return 200 so frontend can handle gracefully
    // This allows the endpoint to be accessed to check status and initiate OAuth flow
    logger.debug('[API] No valid authentication method found - returning unauthenticated status');
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: 'No valid authentication found. Please configure Box authentication in settings.',
      user: null,
      authMethod: null,
      requiresAuth: true
    }, { status: 200 });
    
  } catch (error) {
    logger.error('[API] Error fetching user info', error instanceof Error ? error : { error });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user information',
      details: error instanceof Error ? error.message : 'Unknown error',
      user: null,
      authMethod: null
    }, { status: 500 });
  }
}
