# Logout Authentication Fix

## Issues Identified

You reported that after clicking logout, the page briefly shows the login screen but then immediately redirects back to the application as if you're still logged in. This indicates a critical authentication flow issue.

## Root Causes Found

### 1. **Cookie Path Not Explicitly Set**
The cookie configuration didn't include an explicit `path: '/'` property. When clearing a cookie with `res.clearCookie()`, ALL options must match exactly, including the path. Without an explicit path, there could be a mismatch between setting and clearing.

**Location:** `src/webserver/config/constants.ts` line 50-57

**Before:**
```typescript
OPTIONS: {
  httpOnly: true,
  secure: false,
  sameSite: 'strict' as const,
},
```

**After:**
```typescript
OPTIONS: {
  httpOnly: true,
  secure: false,
  sameSite: 'strict' as const,
  path: '/',  // ← Added explicit path
},
```

### 2. **Cookie Not Being Cleared with Matching Options**
The logout endpoint was calling `res.clearCookie(AUTH_CONFIG.COOKIE.NAME)` without passing the cookie options. When clearing a cookie, you **must** pass the same options that were used when setting it.

**Location:** `src/webserver/routes/authRoutes.ts` line 89

**Before:**
```typescript
res.clearCookie(AUTH_CONFIG.COOKIE.NAME);
```

**After:**
```typescript
res.clearCookie(AUTH_CONFIG.COOKIE.NAME, AUTH_CONFIG.COOKIE.OPTIONS);
```

### 3. **Race Condition Between Logout and Page Reload**
After logout, the page reload was happening too quickly, potentially before the logout request completed. Also, the `AuthContext.refresh()` runs on every page load, which could re-authenticate if the cookie wasn't fully cleared yet.

**Location:** `src/renderer/sider.tsx` handleLogout function

**Before:**
```typescript
const handleLogout = async () => {
  await logout();
  navigate('/login');
};
```

**After:**
```typescript
const handleLogout = async () => {
  try {
    await logout();
    // Wait a bit to ensure logout request completes
    await new Promise(resolve => setTimeout(resolve, 100));
    // Force a full page reload to clear all state
    window.location.href = '/';
  } catch (error) {
    console.error('[Sider] Logout failed:', error);
    // Still try to reload even if logout fails
    window.location.href = '/';
  }
};
```

### 4. **Added Comprehensive Debug Logging**
Added console logging on both client and server to help diagnose authentication issues.

**Client-side Locations:**
- `src/renderer/context/AuthContext.tsx` - logout function
- `src/renderer/context/AuthContext.tsx` - refresh function
- `src/renderer/sider.tsx` - handleLogout function

**Server-side Locations:**
- `src/webserver/routes/authRoutes.ts` - POST /logout endpoint
- `src/webserver/routes/authRoutes.ts` - GET /api/auth/user endpoint

## How to Test

### Prerequisites
1. **Restart the server** to pick up the configuration changes
2. **Clear all browser cookies** for localhost:25808 before testing
3. **Open Chrome DevTools** (F12) and go to the Console tab

### Test Steps

1. **Log in** with username `admin` and your password
2. **Watch the server console** - you should see authentication logs
3. **Click the Logout button** at the bottom of the sidebar
4. **Watch BOTH consoles:**

   **Browser Console should show:**
   ```
   [AuthContext] Logging out...
   [AuthContext] Logout successful
   [AuthContext] User state cleared, status set to unauthenticated
   [Sider] Logout completed, reloading...
   ```

   **Server Console should show:**
   ```
   [Logout] User logging out: admin
   [Logout] Cookie before clear: present
   [Logout] Cookie cleared, sending response
   ```

5. **After page reload, browser console should show:**
   ```
   [AuthContext] Refreshing auth status...
   [AuthContext] No user found, setting unauthenticated
   ```

6. **Server console should show:**
   ```
   [Auth] /api/auth/user called, user: none
   [Auth] Cookie present: no
   ```

7. **Expected behavior:** You should stay on the login page
8. **BUG if:** You get redirected back to the application

## Browser Console Logs to Watch For

### Successful Logout Flow:
```
[AuthContext] Logging out...
[AuthContext] Logout successful
[AuthContext] User state cleared, status set to unauthenticated
[AuthContext] Refreshing auth status...
[AuthContext] No user found, setting unauthenticated
```

### If Still Authenticated (BUG):
```
[AuthContext] Logging out...
[AuthContext] Logout successful
[AuthContext] User state cleared, status set to unauthenticated
[AuthContext] Refreshing auth status...
[AuthContext] User authenticated: admin  ← This should NOT appear after logout
```

## Additional Verification

### Check Cookie in Browser DevTools:
1. Open DevTools → Application → Cookies
2. Before logout: You should see `aionui-session` cookie
3. After logout: The `aionui-session` cookie should be **completely removed**
4. If the cookie is still there after logout, the fix didn't work

### Check Network Tab:
1. Open DevTools → Network tab
2. Click Logout
3. Look for POST request to `/logout`
4. Check response headers - should include `Set-Cookie` with `aionui-session=; Max-Age=0` or similar
5. After logout, navigate to `/`
6. Look for GET request to `/api/auth/user`
7. Should return 401 Unauthorized (not 200 OK)

## Files Modified

1. **`src/webserver/config/constants.ts`** - Added explicit `path: '/'` to cookie options
2. **`src/webserver/routes/authRoutes.ts`** - Fixed cookie clearing with proper options + added server logging
3. **`src/renderer/sider.tsx`** - Added delay and full page reload after logout + added client logging
4. **`src/renderer/context/AuthContext.tsx`** - Added comprehensive debug logging

## Next Steps

If the issue persists after these fixes:
1. Check the browser console logs
2. Check the Network tab for the `/logout` request
3. Verify the cookie is actually being cleared in Application → Cookies
4. Share the console logs and network request details for further debugging

