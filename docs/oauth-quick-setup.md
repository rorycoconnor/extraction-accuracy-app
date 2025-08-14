# Quick OAuth2.0 Setup Guide

## Fix the "Client ID variable not found" Issue

The OAuth button isn't working because the environment variables aren't properly configured. Here's how to fix it:

### 1. Create Environment File

Create a `.env.local` file in your project root (same folder as `package.json`):

```bash
# Box OAuth2.0 Configuration
BOX_CLIENT_ID=your_actual_box_client_id_here
BOX_CLIENT_SECRET=your_actual_box_client_secret_here
NEXT_PUBLIC_BOX_CLIENT_ID=your_actual_box_client_id_here
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

### 2. Get Your Box OAuth Credentials

1. Go to [Box Developer Console](https://app.box.com/developers/console)
2. Create a new app or use existing one
3. Choose "Custom App" → "Standard OAuth 2.0 (User Authentication)"
4. Set redirect URI to: `http://localhost:9002/api/auth/box/callback`
5. Copy the **Client ID** and **Client Secret**

### 3. Update Your .env.local File

Replace the placeholder values with your actual credentials:

```bash
BOX_CLIENT_ID=abc123def456ghi789
BOX_CLIENT_SECRET=xyz789abc123def456
NEXT_PUBLIC_BOX_CLIENT_ID=abc123def456ghi789
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

### 4. Restart Development Server

```bash
npm run dev
```

### 5. Test OAuth Connection

1. Go to Settings page
2. Select "OAuth2.0 (Demo Account)"
3. Click "Connect your Box Demo Account"
4. You should be redirected to Box for authorization

## Troubleshooting

### Still getting "Client ID not found"?

- **Check file name**: Must be exactly `.env.local` (not `.env` or `.env.local.txt`)
- **Check location**: Must be in project root (same folder as `package.json`)
- **Restart server**: Environment variables only load on server start
- **Check spelling**: Variable names are case-sensitive

### OAuth button is disabled?

The button is disabled when `NEXT_PUBLIC_BOX_CLIENT_ID` is not set. This prevents errors when clicking the button.

### Getting redirect URI errors?

Make sure the redirect URI in Box Developer Console exactly matches:
```
http://localhost:9002/api/auth/box/callback
```

## Environment Variable Reference

| Variable | Purpose | Where Used |
|----------|---------|------------|
| `BOX_CLIENT_ID` | Server-side OAuth | API callback route |
| `BOX_CLIENT_SECRET` | Server-side OAuth | API callback route |
| `NEXT_PUBLIC_BOX_CLIENT_ID` | Client-side OAuth | Settings page button |
| `NEXT_PUBLIC_APP_URL` | Client-side OAuth | Settings page button |

## Quick Test

After setup, you should see:
- ✅ OAuth button is enabled (not disabled)
- ✅ No configuration warnings on settings page
- ✅ Clicking OAuth button redirects to Box
- ✅ After authorization, you're redirected back to settings
- ✅ Connection status shows "Connected to Box" 