import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getOAuthStatus } from '@/services/oauth';

export async function GET(request: NextRequest) {
  try {
    const status = await getOAuthStatus();
    
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Failed to get OAuth status', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get OAuth status',
      status: { isConnected: false }
    });
  }
} 