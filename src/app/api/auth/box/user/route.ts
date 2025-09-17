import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import BoxSDK from 'box-node-sdk';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('box_oauth_access_token')?.value;
    const tokenType = cookieStore.get('box_oauth_token_type')?.value || 'Bearer';
    
    // Check for OAuth tokens first
    if (accessToken) {
      try {
        // Create Box client with OAuth token
        const sdk = new BoxSDK({
          clientID: process.env.NEXT_PUBLIC_BOX_CLIENT_ID || '',
          clientSecret: process.env.BOX_CLIENT_SECRET || '',
        });
        
        const client = sdk.getBasicClient(accessToken);
        const userInfo = await client.users.get(client.CURRENT_USER_ID);
        
        return NextResponse.json({
          success: true,
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
      } catch (oauthError) {
        console.error('OAuth user fetch failed:', oauthError);
      }
    }
    
    // Try service account authentication
    const configJson = process.env.BOX_CONFIG_JSON_BASE64;
    if (configJson) {
      try {
        const config = JSON.parse(Buffer.from(configJson, 'base64').toString());
        const sdk = new BoxSDK(config);
        const serviceAccountClient = sdk.getAppAuthClient('enterprise', config.enterpriseID);
        
        // Get enterprise user (admin user)
        const adminUserInfo = await serviceAccountClient.enterprise.getUsers();
        const adminUser = adminUserInfo.entries?.[0];
        
        if (adminUser) {
          return NextResponse.json({
            success: true,
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
        console.error('Service account user fetch failed:', serviceError);
      }
    }
    
    // Try developer token
    const developerToken = process.env.BOX_DEVELOPER_TOKEN;
    const enterpriseId = process.env.BOX_ENTERPRISE_ID;
    
    if (developerToken) {
      try {
        const sdk = new BoxSDK({
          clientID: 'dummy', // Not needed for developer token
          clientSecret: 'dummy'
        });
        
        const client = sdk.getBasicClient(developerToken);
        const userInfo = await client.users.get(client.CURRENT_USER_ID);
        
        return NextResponse.json({
          success: true,
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
        console.error('Developer token user fetch failed:', devTokenError);
      }
    }
    
    // If no authentication method worked
    return NextResponse.json({
      success: false,
      error: 'No valid authentication found. Please configure Box authentication in settings.',
      user: null
    }, { status: 401 });
    
  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user information',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
