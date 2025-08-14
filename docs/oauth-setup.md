# OAuth2.0 Setup for Box Integration

## Overview

This application now supports OAuth2.0 authentication with Box, which is the recommended method for demo accounts and testing. OAuth2.0 provides a more secure and user-friendly way to authenticate with Box compared to developer tokens or service accounts.

## Prerequisites

1. A Box account (free or paid)
2. Access to the [Box Developer Console](https://app.box.com/developers/console)

## Step-by-Step Setup

### 1. Create a Box App

1. Go to the [Box Developer Console](https://app.box.com/developers/console)
2. Click "Create New App"
3. Choose "Custom App" and "Standard OAuth 2.0 (User Authentication)"
4. Give your app a name (e.g., "Accuracy Optimizer Demo")
5. Click "Create App"

### 2. Configure OAuth2.0 Settings

1. In your app settings, go to the "OAuth 2.0 Redirect URIs" section
2. Add the redirect URI: `http://localhost:9002/api/auth/box/callback`
3. Save the changes

### 3. Get Your Credentials

1. In the app settings, note your **Client ID**
2. Click "View Client Secret" to reveal your **Client Secret**
3. Keep these credentials secure

### 4. Configure Environment Variables

Create or update your `.env.local` file with:

```bash
# Box OAuth2.0
BOX_CLIENT_ID=your_client_id_here
BOX_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_BOX_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

### 5. Restart Your Development Server

```bash
npm run dev
```

## Using OAuth2.0 Authentication

1. Go to the **Settings** page in your application
2. Select **"OAuth2.0 (Demo Account)"** as your authentication method
3. Click **"Connect your Box Demo Account"**
4. You'll be redirected to Box to authorize the application
5. After authorization, you'll be redirected back to the settings page
6. Your Box account is now connected!

## How It Works

1. **Authorization Request**: User clicks the connect button and is redirected to Box
2. **User Consent**: User logs into Box and authorizes the application
3. **Authorization Code**: Box redirects back with an authorization code
4. **Token Exchange**: The application exchanges the code for access and refresh tokens
5. **Token Storage**: Tokens are securely stored and used for API calls
6. **Automatic Refresh**: Access tokens are automatically refreshed when needed

## Security Features

- **No Credential Storage**: User credentials are never stored in the application
- **Token Expiration**: Access tokens automatically expire and are refreshed
- **Secure Storage**: Tokens are stored securely in memory (production should use secure session stores)
- **State Parameter**: OAuth flow includes state parameter to prevent CSRF attacks

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI" error**
   - Ensure the redirect URI in Box Developer Console matches exactly: `http://localhost:9002/api/auth/box/callback`

2. **"Missing credentials" error**
   - Check that `BOX_CLIENT_ID` and `BOX_CLIENT_SECRET` are set in your `.env.local` file

3. **OAuth callback fails**
   - Verify your app is running on the correct port (9002)
   - Check the browser console and server logs for detailed error messages

### Environment Variable Checklist

- [ ] `BOX_CLIENT_ID` is set
- [ ] `BOX_CLIENT_SECRET` is set  
- [ ] `NEXT_PUBLIC_BOX_CLIENT_ID` is set
- [ ] `NEXT_PUBLIC_APP_URL` is set to `http://localhost:9002`
- [ ] Development server restarted after adding variables

## Production Considerations

For production deployment:

1. **Use HTTPS**: OAuth2.0 requires secure connections
2. **Secure Token Storage**: Implement secure session management or database storage
3. **Environment Variables**: Use your hosting platform's secure environment variable system
4. **Redirect URIs**: Update redirect URIs to match your production domain
5. **Rate Limiting**: Implement rate limiting for OAuth endpoints

## Support

If you encounter issues:

1. Check the browser console for client-side errors
2. Check the server logs for backend errors
3. Verify your Box app configuration
4. Ensure all environment variables are correctly set 