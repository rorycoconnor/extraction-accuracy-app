import { NextRequest, NextResponse } from 'next/server';
import { getBoxAccessToken } from '@/services/box';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const { searchParams } = new URL(request.url);
    
    logger.debug('Fetching thumbnail for file', { fileId });
    
    // Get Box access token
    logger.debug('Getting Box access token');
    const accessToken = await getBoxAccessToken();
    logger.debug('Got Box access token', { tokenLength: accessToken.length });
    
    // Box API supports specific thumbnail sizes: 32x32, 94x94, 160x160, 320x320, 1024x1024, 2048x2048 for JPG
    // For PNG: 1024x1024, 2048x2048
    // Let's use 320x320 JPG which should work for most files
    const boxUrl = `https://api.box.com/2.0/files/${fileId}/thumbnail.jpg?min_height=320&min_width=320&max_height=320&max_width=320`;
    logger.debug('Making Box API request', { boxUrl });
    
    const response = await fetch(boxUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    logger.debug('Box API response', { status: response.status, statusText: response.statusText });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Box thumbnail API error', { status: response.status, statusText: response.statusText, errorText });
      return new NextResponse(`Thumbnail not available: ${response.status} ${response.statusText}`, { status: response.status });
    }
    
    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    
    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    logger.error('Error fetching Box thumbnail', error instanceof Error ? error : { error });
    return new NextResponse('Internal server error', { status: 500 });
  }
}
