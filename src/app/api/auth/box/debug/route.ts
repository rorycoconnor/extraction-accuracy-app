import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuthStatus } from '@/services/oauth';
import { logger } from '@/lib/logger';

/**
 * Debug endpoint to check OAuth status and cookies
 * Access at: /api/auth/box/debug
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Get all cookies
    const allCookies = cookieStore.getAll();
    const oauthCookies = allCookies.filter(c => c.name.includes('box_oauth'));
    
    // Get OAuth status
    const oAuthStatus = await getOAuthStatus();
    
    // Check environment variables (without exposing secrets)
    const envCheck = {
      hasClientId: !!process.env.BOX_CLIENT_ID,
      hasClientSecret: !!process.env.BOX_CLIENT_SECRET,
      hasPublicClientId: !!process.env.NEXT_PUBLIC_BOX_CLIENT_ID,
      clientIdLength: process.env.BOX_CLIENT_ID?.length || 0,
      publicClientIdLength: process.env.NEXT_PUBLIC_BOX_CLIENT_ID?.length || 0,
    };
    
    return NextResponse.json({
      success: true,
      debug: {
        cookies: {
          total: allCookies.length,
          oauth: {
            count: oauthCookies.length,
            names: oauthCookies.map(c => c.name),
            values: oauthCookies.map(c => ({
              name: c.name,
              hasValue: !!c.value,
              valueLength: c.value?.length || 0,
              // Don't expose actual token values for security
            }))
          },
          // Check for cookie header in request
          requestHasCookieHeader: !!request.headers.get('cookie'),
        },
        oauthStatus: oAuthStatus,
        environment: envCheck,
        timestamp: new Date().toISOString(),
      }
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
  } catch (error) {
    logger.error('Debug endpoint error', error instanceof Error ? error : { error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

