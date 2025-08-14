# Environment Configuration

## Required Environment Variables

### Box API Configuration
You can use OAuth2.0, Developer Token, or Service Account:

**Option 1: Box OAuth2.0 (recommended for demo accounts)**
```
# Server-side variables (for OAuth callback)
BOX_CLIENT_ID=your_box_oauth_client_id
BOX_CLIENT_SECRET=your_box_oauth_client_secret

# Client-side variables (for OAuth initiation)
NEXT_PUBLIC_BOX_CLIENT_ID=your_box_oauth_client_id
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

**Option 2: Box Developer Token (easier for development)**
```
BOX_DEVELOPER_TOKEN=your_box_developer_token_here
```

**Option 3: Box Service Account (recommended for production)**
```
BOX_CONFIG_JSON_BASE64=your_service_account_config_base64_here
```

### Google Gemini API Key (Optional)
For AI prompt generation in Prompt Studio:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

- **Required for**: AI-powered prompt suggestions in Prompt Studio
- **Get API key from**: https://ai.google.dev/
- **Note**: The app works without this, but you won't have AI prompt suggestions

## Setup Instructions

1. **Create a `.env.local` file** in the project root
2. **Add your environment variables** using the format above
3. **Restart your development server** after adding environment variables

### Example .env.local file:
```
# Box OAuth2.0 (recommended for demo)
BOX_CLIENT_ID=your_oauth_client_id
BOX_CLIENT_SECRET=your_oauth_client_secret
NEXT_PUBLIC_BOX_CLIENT_ID=your_oauth_client_id
NEXT_PUBLIC_APP_URL=http://localhost:9002

# Box API (alternative methods)
# BOX_DEVELOPER_TOKEN=dev_token_xxxxxxxx

# Google Gemini API (optional)
GEMINI_API_KEY=AIza...your_api_key_here
```

## OAuth2.0 Setup

To use OAuth2.0 authentication:

1. **Create a Box App** in the [Box Developer Console](https://app.box.com/developers/console)
2. **Set OAuth2.0 redirect URI** to: `http://localhost:9002/api/auth/box/callback`
3. **Copy Client ID and Client Secret** to your `.env.local` file
4. **Use the "Connect your Box Demo Account" button** in Settings

## Important Notes

- **Server-side variables** (BOX_CLIENT_ID, BOX_CLIENT_SECRET) are only available in API routes and server components
- **Client-side variables** (NEXT_PUBLIC_*) are exposed to the browser and should be safe to share
- The `.env.local` file is automatically ignored by git
- Environment variables are loaded automatically by Next.js
- Restart the dev server (`npm run dev`) after changing environment variables
- The app will work without `GEMINI_API_KEY`, but prompt generation will use fallback prompts
- OAuth2.0 is the recommended method for demo accounts and testing 