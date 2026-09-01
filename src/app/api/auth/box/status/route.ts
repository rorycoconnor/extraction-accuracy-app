import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getOAuthStatus } from '@/services/oauth';

/**
 * Reports whether Box OAuth is connected.
 *
 * The access and refresh tokens live in httpOnly cookies so that page scripts
 * cannot read them. Returning them here would defeat that, so only
 * non-sensitive connection metadata is serialized.
 */
export async function GET(request: NextRequest) {
  try {
    const status = await getOAuthStatus();

    return NextResponse.json({
      success: true,
      status: {
        isConnected: status?.isConnected ?? false,
        expiresAt: status?.tokens?.expiresAt,
        tokenType: status?.tokens?.tokenType,
        lastConnected: status?.lastConnected,
      }
    });
  } catch (error) {
    logger.error('Failed to get OAuth status', error instanceof Error ? error : { error });

    return NextResponse.json({
      success: false,
      error: 'Failed to get OAuth status',
      status: { isConnected: false }
    });
  }
}
