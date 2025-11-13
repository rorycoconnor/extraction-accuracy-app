# OAuth Token Refresh Issue - Root Cause Analysis

## The Problem

**Symptoms:**
- OAuth shows as "Connected" in settings
- After 1-2 hours, "Not authenticated. Go to Settings" appears
- But user is still showing as connected
- Tried fixing 10+ times without success

## Root Cause: Multiple Interconnected Failures

### Issue #1: `/api/auth/box/user` Bypasses Token Refresh ⚠️ **CRITICAL**

**File:** `src/app/api/auth/box/user/route.ts` (Lines 9-46)

**Problem:**
```typescript
// Line 9: Reads cookie directly
const accessToken = cookieStore.get('box_oauth_access_token')?.value;

// Line 16-26: Uses token WITHOUT checking if expired
if (accessToken) {
  const client = sdk.getBasicClient(accessToken);
  const userInfo = await client.users.get(client.CURRENT_USER_ID);
  // ...
}

// Line 43-46: On failure, catches error and CONTINUES
catch (oauthError) {
  logger.error('[API] OAuth user fetch failed', oauthError);
  // OAuth token might be expired, continue to try other methods
}
```

**Why This Breaks:**
1. Expired token is read from cookie
2. API call to Box fails with 401
3. Error is caught and logged
4. Endpoint tries other auth methods (service account, dev token)
5. **OAuth cookies remain untouched**
6. Status check still sees cookies → reports "connected"
7. But actual API calls fail → shows "not authenticated"

**This is why you see "connected" but get "not authenticated" errors!**

---

### Issue #2: Token Refresh Logic Not Called ⚠️ **CRITICAL**

**File:** `src/services/oauth.ts` (Lines 107-131)

**Where refresh SHOULD happen:**
```typescript
export async function isOAuthConnected(): Promise<boolean> {
  // ... checks expiration ...
  if (now >= expiresAt - (5 * 60 * 1000)) {
    // Token expired, try to refresh
    await refreshOAuthToken();  // ← This function exists!
    return true;
  }
}
```

**Where refresh IS called:**
- ✅ `getAccessToken()` in `box.ts` (Line 85)
- ❌ `/api/auth/box/user` route **DOESN'T call this**

**Result:** The user info endpoint never refreshes tokens!

---

### Issue #3: Environment Variable Mismatch 🐛

**Refresh function** (`oauth.ts` Line 155-156):
```typescript
const clientId = process.env.BOX_CLIENT_ID;        // ← Server-side only
const clientSecret = process.env.BOX_CLIENT_SECRET;
```

**User endpoint** (`user/route.ts` Line 21):
```typescript
const sdk = new BoxSDK({
  clientID: process.env.NEXT_PUBLIC_BOX_CLIENT_ID,  // ← Different var!
  clientSecret: process.env.BOX_CLIENT_SECRET,
});
```

**Problem:** If `BOX_CLIENT_ID` (non-public) isn't set, refresh silently fails!

---

### Issue #4: Refresh Error Handling Disconnects User ⚠️

**File:** `src/services/oauth.ts` (Lines 118-127)

```typescript
if (now >= expiresAt - (5 * 60 * 1000)) {
  try {
    await refreshOAuthToken();
    return true;
  } catch (error) {
    logger.error('Failed to refresh OAuth token', error);
    await disconnectOAuth();  // ← DELETES all cookies!
    return false;
  }
}
```

**Problem:** 
- If refresh fails for ANY reason (network hiccup, rate limit, etc.)
- User is IMMEDIATELY disconnected
- No retry logic, no grace period
- Too aggressive!

---

### Issue #5: Token Caching Creates Race Conditions 🐛

**File:** `src/services/box.ts` (Lines 88-93)

```typescript
// Cache the OAuth token (typically expires in 60 minutes)
cachedToken = {
  token: oauthToken,
  expiresAt: now + (55 * 60 * 1000), // Cache for 55 minutes
  tokenType: 'oauth'
};
```

**Problem:**
- Cookie expires in 60 minutes (from Box)
- Cache expires in 55 minutes (our choice)
- But if token is refreshed, cache isn't invalidated
- Can use stale tokens for up to 5 minutes

---

## Why This Seemed Impossible to Fix

Each issue makes the others harder to diagnose:

1. **User endpoint bypasses refresh** → tokens never refresh
2. **Refresh disconnects on error** → even if called, might disconnect
3. **Env var mismatch** → refresh might fail silently
4. **Error is caught and hidden** → looks like it's working
5. **Status check sees cookies** → reports "connected"
6. **Actual API calls fail** → shows "not authenticated"

**Result:** OAuth says "connected" but auth fails! 😵

---

## The Fix (3-Part Solution)

### Fix #1: Make `/api/auth/box/user` Use OAuth Service

**Before:**
```typescript
// Reads cookie directly, no refresh
const accessToken = cookieStore.get('box_oauth_access_token')?.value;
if (accessToken) {
  const client = sdk.getBasicClient(accessToken);
  // ... try to use it ...
}
```

**After:**
```typescript
// Use OAuth service which handles refresh automatically
import { getOAuthAccessToken, isOAuthConnected } from '@/services/oauth';

if (await isOAuthConnected()) {
  const accessToken = await getOAuthAccessToken();
  if (accessToken) {
    const client = sdk.getBasicClient(accessToken);
    // ... use refreshed token ...
  }
}
```

### Fix #2: Standardize Environment Variables

Add to your `.env`:
```bash
# Make sure BOTH are set (BOX_CLIENT_ID is the server-side version)
BOX_CLIENT_ID=your_client_id
NEXT_PUBLIC_BOX_CLIENT_ID=your_client_id
BOX_CLIENT_SECRET=your_client_secret
```

### Fix #3: Add Retry Logic to Token Refresh

**Before:**
```typescript
catch (error) {
  logger.error('Failed to refresh OAuth token', error);
  await disconnectOAuth();  // Too aggressive!
  return false;
}
```

**After:**
```typescript
catch (error) {
  logger.error('Failed to refresh OAuth token', error);
  
  // Check if this is a permanent failure (invalid refresh token)
  const isPermanentFailure = error.message?.includes('invalid_grant') || 
                             error.message?.includes('unauthorized_client');
  
  if (isPermanentFailure) {
    await disconnectOAuth();  // Only disconnect on permanent errors
    return false;
  }
  
  // For temporary errors (network, rate limit), keep trying
  logger.warn('Token refresh failed but will retry on next attempt');
  return false;  // Let caller retry
}
```

---

## Testing the Fix

### Scenario 1: Token Expires During Use
1. Connect via OAuth
2. Wait 65 minutes (past token expiration)
3. Refresh page
4. **Expected:** Token auto-refreshes, no "not authenticated" error

### Scenario 2: Network Interruption During Refresh
1. Connect via OAuth
2. Disable network briefly
3. Wait for token to expire
4. Re-enable network
5. **Expected:** Retry succeeds, user stays connected

### Scenario 3: Invalid Refresh Token
1. Connect via OAuth
2. Manually corrupt refresh token cookie
3. Make an API call
4. **Expected:** Disconnect and show "not authenticated"

---

## Why This Was So Hard to Fix

This bug required fixing **5 interconnected issues** in **3 different layers**:

1. **API Route Layer** - User endpoint bypassing OAuth service
2. **Service Layer** - Refresh logic with aggressive disconnect
3. **Environment Layer** - Variable name inconsistencies
4. **Caching Layer** - Race conditions
5. **Error Handling** - Silent failures

Each "fix" that addressed one issue likely broke something else or didn't address the root cause.

**The key insight:** Token refresh must happen **before** trying to use the token, not after it fails!

---

## Priority

🔴 **CRITICAL** - This affects all OAuth users after 1 hour of use

Fix order:
1. **Fix #1** (user endpoint) - Most important
2. **Fix #2** (env vars) - Prevents silent failures  
3. **Fix #3** (retry logic) - Improves reliability






