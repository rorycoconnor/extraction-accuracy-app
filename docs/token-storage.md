# OAuth Token Storage System

## Overview

Your OAuth access and refresh tokens are now stored **securely in HTTP-only cookies** instead of in-memory storage. This provides persistence, security, and better user experience.

## 🔐 **Where Tokens Are Stored**

### **Before (In-Memory)**
```typescript
// OLD: Tokens lost on page refresh
let oauthState = { isConnected: false };
```

### **Now (Secure Cookies)**
```typescript
// NEW: Tokens persist across sessions
const COOKIE_NAMES = {
  ACCESS_TOKEN: 'box_oauth_access_token',
  REFRESH_TOKEN: 'box_oauth_refresh_token',
  EXPIRES_AT: 'box_oauth_expires_at',
  TOKEN_TYPE: 'box_oauth_token_type',
  LAST_CONNECTED: 'box_oauth_last_connected'
};
```

## 🍪 **Cookie Details**

| Cookie Name | Purpose | Expiration | Security |
|-------------|---------|------------|----------|
| `box_oauth_access_token` | Box API access token | When token expires | HTTP-only, Secure |
| `box_oauth_refresh_token` | Token refresh capability | 30 days | HTTP-only, Secure |
| `box_oauth_expires_at` | Token expiration timestamp | When token expires | HTTP-only, Secure |
| `box_oauth_token_type` | Token type (usually "Bearer") | When token expires | HTTP-only, Secure |
| `box_oauth_last_connected` | Last connection timestamp | 30 days | HTTP-only, Secure |

## 🛡️ **Security Features**

### **HTTP-Only Cookies**
- **Cannot be accessed by JavaScript** - prevents XSS attacks
- **Automatically sent with requests** - seamless API calls
- **Server-side only access** - tokens never exposed to client code

### **Secure Settings**
- **HTTPS only in production** - prevents man-in-the-middle attacks
- **SameSite: lax** - protects against CSRF attacks
- **Automatic expiration** - tokens expire when they should

### **Token Lifecycle**
1. **Access Token**: Short-lived (typically 1 hour), automatically refreshed
2. **Refresh Token**: Long-lived (30 days), used to get new access tokens
3. **Automatic Refresh**: Happens 5 minutes before expiration

## 🔄 **How It Works**

### **1. Initial OAuth Flow**
```
User clicks "Connect" → Redirect to Box → User authorizes → 
Box redirects back → Exchange code for tokens → Store in cookies
```

### **2. Token Usage**
```
Box API call → Check cookies → Use access token → 
If expired → Use refresh token → Get new access token → Update cookies
```

### **3. Disconnection**
```
User clicks "Disconnect" → Clear all cookies → Reset connection status
```

## 📁 **File Structure**

```
src/
├── services/
│   └── oauth.ts              # Main OAuth service with cookie storage
├── app/
│   └── api/
│       └── auth/
│           └── box/
│               ├── callback/  # OAuth callback handler
│               ├── status/    # Check OAuth status
│               └── disconnect/ # Disconnect and clear cookies
```

## 🚀 **Benefits of New System**

### **✅ Persistence**
- **Tokens survive page refreshes** - no need to re-authenticate
- **Tokens survive server restarts** - development is smoother
- **Long-term connections** - users stay connected

### **✅ Security**
- **No token exposure** - tokens never visible in JavaScript
- **Automatic expiration** - tokens expire as intended
- **Secure by default** - follows OAuth2.0 best practices

### **✅ User Experience**
- **Seamless API calls** - no authentication interruptions
- **Automatic token refresh** - users don't see token errors
- **Clear connection status** - users know when they're connected

## 🔧 **Technical Implementation**

### **Cookie Storage**
```typescript
export async function storeOAuthTokens(tokens: OAuthTokens): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.expiresAt - Date.now(),
    path: '/'
  });
  // ... other cookies
}
```

### **Token Retrieval**
```typescript
export async function getOAuthStatus(): Promise<OAuthState> {
  const cookieStore = await cookies();
  
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;
  // ... build status object
}
```

### **Automatic Refresh**
```typescript
export async function isOAuthConnected(): Promise<boolean> {
  // Check if token is expired (with 5-minute buffer)
  if (now >= expiresAt - (5 * 60 * 1000)) {
    try {
      await refreshOAuthToken(); // Automatically refresh
      return true;
    } catch (error) {
      await disconnectOAuth(); // Clear invalid tokens
      return false;
    }
  }
  return true;
}
```

## 🧪 **Testing the System**

### **1. Connect OAuth**
- Click "Connect your Box Demo Account"
- Complete Box authorization
- Check browser cookies (should see OAuth cookies)

### **2. Test Persistence**
- Refresh the page
- OAuth status should remain "Connected"
- No need to re-authenticate

### **3. Test API Calls**
- Use any Box API feature
- Tokens should work automatically
- Check server logs for token usage

### **4. Test Disconnection**
- Click "Disconnect"
- Cookies should be cleared
- Status should change to "Not connected"

## 🚨 **Troubleshooting**

### **Tokens Still Not Persisting?**
- **Check cookie settings** - ensure cookies are enabled
- **Check domain** - cookies only work on same domain
- **Check HTTPS** - secure cookies require HTTPS in production

### **Getting "Token Expired" Errors?**
- **Check refresh token** - ensure it's valid
- **Check Box app settings** - refresh tokens can be revoked
- **Check server logs** - look for refresh errors

### **OAuth Status Not Updating?**
- **Check API routes** - ensure `/api/auth/box/status` works
- **Check network tab** - look for failed requests
- **Check server logs** - look for errors

## 🔮 **Future Enhancements**

### **Database Storage** (for multi-user apps)
```typescript
// Store tokens in database with user association
await db.oauthTokens.upsert({
  where: { userId: session.user.id },
  update: { tokens, updatedAt: new Date() },
  create: { userId: session.user.id, tokens, createdAt: new Date() }
});
```

### **Redis Storage** (for high-performance apps)
```typescript
// Store tokens in Redis with TTL
await redis.setex(`oauth:${userId}`, 3600, JSON.stringify(tokens));
```

### **JWT Storage** (for stateless apps)
```typescript
// Encode tokens in signed JWT
const tokenJWT = jwt.sign(tokens, process.env.JWT_SECRET, { expiresIn: '1h' });
```

## 📚 **Additional Resources**

- [Next.js Cookies Documentation](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [OAuth2.0 Security Best Practices](https://tools.ietf.org/html/rfc6819)
- [HTTP-Only Cookies Security](https://owasp.org/www-community/HttpOnly)
- [Box OAuth2.0 Documentation](https://developer.box.com/reference/oauth2/)

---

**Your OAuth tokens are now stored securely and will persist across sessions! 🎉** 