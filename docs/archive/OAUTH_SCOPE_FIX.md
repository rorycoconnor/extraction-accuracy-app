# OAuth Scope Fix - Template Creation Permission

## Issue
Users authenticated via OAuth could sign in successfully but received **401 Unauthorized** errors when trying to create metadata templates in Box. The same operation worked fine with Developer Tokens.

## Root Cause
The OAuth authorization request was **not requesting the necessary scopes**. Without explicitly requesting scopes, Box only grants the default minimal permissions, which don't include the ability to manage enterprise metadata templates.

### Missing Scope
The critical missing scope was:
- `manage_enterprise_properties` - Required to create and manage metadata templates

## Solution
Added explicit scope requests to the OAuth authorization URL in two places:

### 1. Server-side OAuth Service (`src/services/oauth.ts`)
```typescript
const scopes = [
  'root_readwrite',           // Read and write all files and folders
  'manage_enterprise_properties', // Create and manage metadata templates
  'manage_managed_users',     // Access user information
].join(' ');
```

### 2. Client-side Settings Page (`src/app/settings/page.tsx`)
Same scopes added to the OAuth connection handler.

## Required Actions for Users

**IMPORTANT**: Existing OAuth connections will NOT have the new scopes. Users must:

1. **Disconnect** from OAuth (in Settings)
2. **Reconnect** via OAuth (this will request the new scopes)
3. **Authorize** the new permissions when prompted by Box

## Box Application Configuration

Your Box OAuth app must have these **Application Scopes** enabled in the Box Developer Console:

1. Go to [Box Developer Console](https://app.box.com/developers/console)
2. Select your OAuth app
3. Go to **Configuration** tab
4. Under **Application Scopes**, ensure these are checked:
   - ✅ **Read and write all files and folders stored in Box**
   - ✅ **Manage enterprise properties**
   - ✅ **Manage users** (optional, for user info display)
5. Click **Save Changes**

## Scopes Explained

| Scope | Purpose | Required For |
|-------|---------|--------------|
| `root_readwrite` | Read and write files/folders | File operations, metadata extraction |
| `manage_enterprise_properties` | Manage metadata templates | Creating templates from Library |
| `manage_managed_users` | Access user information | Displaying user info in Settings |

## Testing

To verify the fix works:

1. Disconnect from OAuth (if currently connected)
2. Reconnect via OAuth
3. Go to Library
4. Create a template with fields
5. Click "More" → "Create Template in Box"
6. Should succeed ✅

## Technical Details

### Before (Missing Scopes)
```typescript
// OAuth URL without scopes - only gets default permissions
https://account.box.com/api/oauth2/authorize?client_id=...&response_type=code&redirect_uri=...
```

### After (With Scopes)
```typescript
// OAuth URL with explicit scopes - gets required permissions
https://account.box.com/api/oauth2/authorize?client_id=...&response_type=code&redirect_uri=...&scope=root_readwrite%20manage_enterprise_properties%20manage_managed_users
```

## Why Developer Token Worked

Developer tokens inherit **all permissions** of the Box user who created them. If that user has admin rights, the token has admin rights. OAuth tokens, however, only get the permissions explicitly requested via scopes.

## Related Files
- `src/services/oauth.ts` - OAuth service with authorization URL generation
- `src/app/settings/page.tsx` - Settings page with OAuth connection handler
- `src/services/box.ts` - Box API service (uses the OAuth token)

