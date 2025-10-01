import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import BoxSDK from 'box-node-sdk';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('box_oauth_access_token')?.value;
    const tokenType = cookieStore.get('box_oauth_token_type')?.value || 'Bearer';
    
    console.log('🔐 [API] Checking authentication...');
    console.log('🔐 [API] OAuth token present:', !!accessToken);
    
    // Check for OAuth tokens first
    if (accessToken) {
      try {
        console.log('🔐 [API] Attempting OAuth authentication...');
        // Create Box client with OAuth token
        const sdk = new BoxSDK({
          clientID: process.env.NEXT_PUBLIC_BOX_CLIENT_ID || '',
          clientSecret: process.env.BOX_CLIENT_SECRET || '',
        });
        
        const client = sdk.getBasicClient(accessToken);
        const userInfo = await client.users.get(client.CURRENT_USER_ID);
        
        console.log('✅ [API] OAuth authentication successful for user:', userInfo.login);
        
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
      } catch (oauthError) {
        console.error('❌ [API] OAuth user fetch failed:', oauthError);
        // OAuth token might be expired, continue to try other methods
      }
    }
    
    // Try service account authentication
    const configJson = process.env.BOX_CONFIG_JSON_BASE64;
    console.log('🔐 [API] Service account config present:', !!configJson);
    
    if (configJson) {
      try {
        console.log('🔐 [API] Attempting service account authentication...');
        const config = JSON.parse(Buffer.from(configJson, 'base64').toString());
        const sdk = new BoxSDK(config);
        const serviceAccountClient = sdk.getAppAuthClient('enterprise', config.enterpriseID);
        
        // Get enterprise user (admin user)
        const adminUserInfo = await serviceAccountClient.enterprise.getUsers();
        const adminUser = adminUserInfo.entries?.[0];
        
        if (adminUser) {
          console.log('✅ [API] Service account authentication successful for user:', adminUser.login);
          
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
        console.error('❌ [API] Service account user fetch failed:', serviceError);
      }
    }
    
    // Try developer token
    const developerToken = process.env.BOX_DEVELOPER_TOKEN;
    const enterpriseId = process.env.BOX_ENTERPRISE_ID;
    console.log('🔐 [API] Developer token present:', !!developerToken);
    
    if (developerToken) {
      try {
        console.log('🔐 [API] Attempting developer token authentication...');
        const sdk = new BoxSDK({
          clientID: 'dummy', // Not needed for developer token
          clientSecret: 'dummy'
        });
        
        const client = sdk.getBasicClient(developerToken);
        const userInfo = await client.users.get(client.CURRENT_USER_ID);
        
        console.log('✅ [API] Developer token authentication successful for user:', userInfo.login);
        
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
        console.error('❌ [API] Developer token user fetch failed:', devTokenError);
      }
    }
    
    // If no authentication method worked
    console.warn('❌ [API] No valid authentication method found');
    return NextResponse.json({
      success: false,
      error: 'No valid authentication found. Please configure Box authentication in settings.',
      user: null,
      authMethod: null
    }, { status: 401 });
    
  } catch (error) {
    console.error('❌ [API] Error fetching user info:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user information',
      details: error instanceof Error ? error.message : 'Unknown error',
      user: null,
      authMethod: null
    }, { status: 500 });
  }
}
