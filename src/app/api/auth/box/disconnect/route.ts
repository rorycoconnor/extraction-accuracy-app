import { NextRequest, NextResponse } from 'next/server';
import { disconnectOAuth } from '@/services/oauth';

export async function POST(request: NextRequest) {
  try {
    await disconnectOAuth();
    
    return NextResponse.json({
      success: true,
      message: 'OAuth disconnected successfully'
    });
  } catch (error) {
    console.error('Failed to disconnect OAuth:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to disconnect OAuth'
    }, { status: 500 });
  }
} 