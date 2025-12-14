# Document Preview Errors - Fixed

**Date:** 2025-12-14  
**Status:** ✅ All 3 Errors Fixed

---

## Errors Fixed

### 1. ✅ Missing React Keys in List Rendering

**Error:**
```
Each child in a list should have a unique "key" prop.
Check the render method of `Layout`.
```

**Root Cause:**
The `MessageToolGroup` component was mapping over `message.content` without providing a `key` prop on the first return statement (ConfirmationDetails component).

**Fix Applied:**
Added `key={callId}` to the `<ConfirmationDetails>` component in `src/renderer/messages/MessageToolGroup.tsx` (line 358).

**File Modified:**
- `src/renderer/messages/MessageToolGroup.tsx`

---

### 2. ✅ React 19 ref Warning

**Error:**
```
Accessing element.ref was removed in React 19. ref is now a regular prop.
It will be removed from the JSX Element type in a future release.
```

**Root Cause:**
The `Layout` component was using `React.cloneElement()` without explicitly passing the `ref` prop, which React 19 now requires as a regular prop instead of accessing `element.ref`.

**Fix Applied:**
Updated `React.cloneElement()` to explicitly pass `ref: (sider as any).ref` as a regular prop in `src/renderer/layout.tsx` (line 125).

**File Modified:**
- `src/renderer/layout.tsx`

---

### 3. ✅ CSP Violation for MinIO PDF Preview

**Error:**
```
Content-Security-Policy: The page's settings blocked the loading of a resource (frame-src)
at https://minio.herd.test/herd-bucket/...
because it violates the following directive: "default-src 'self'"
```

**Root Cause:**
The Content-Security-Policy (CSP) headers were too restrictive. They only allowed `frame-src 'self'`, which blocked iframes from external S3/MinIO endpoints needed for document preview.

**Fix Applied:**
Updated CSP headers in `src/webserver/config/constants.ts` to allow:
- **Development:** `frame-src 'self' https://minio.herd.test https://*.linodeobjects.com`
- **Production:** `frame-src 'self' https://*.amazonaws.com https://*.linodeobjects.com`

Also added support for:
- `img-src` - Allow images from S3/MinIO
- `media-src` - Allow audio/video from S3/MinIO
- `connect-src` - Allow API calls to S3/MinIO

**File Modified:**
- `src/webserver/config/constants.ts`

---

## Files Modified

### 1. `src/renderer/messages/MessageToolGroup.tsx`
- **Line 358:** Added `key={callId}` to ConfirmationDetails component
- **Change:** Single line addition

### 2. `src/renderer/layout.tsx`
- **Line 125:** Added `ref: (sider as any).ref` to cloneElement props
- **Change:** Single line addition

### 3. `src/webserver/config/constants.ts`
- **Lines 134-139:** Updated CSP_DEV and CSP_PROD headers
- **Changes:**
  - Added `frame-src` directive for MinIO/S3 endpoints
  - Added `img-src https:` for S3 images
  - Added `media-src` for S3 audio/video
  - Added `connect-src https:` for S3 API calls

---

## Testing

### Test 1: Document Preview
1. Upload a PDF document
2. Click preview button
3. ✅ PDF should load in iframe without CSP errors
4. ✅ No console warnings about missing keys

### Test 2: Image Preview
1. Upload an image document
2. Click preview button
3. ✅ Image should load from S3/MinIO
4. ✅ No CSP violations

### Test 3: Message Tool Group
1. Send a message that triggers tool calls
2. ✅ Tool call results should render without key warnings
3. ✅ Confirmation dialogs should render with proper keys

---

## CSP Configuration Details

### Development Environment
```
frame-src 'self' https://minio.herd.test https://*.linodeobjects.com
```

### Production Environment
```
frame-src 'self' https://*.amazonaws.com https://*.linodeobjects.com
```

### Why These Changes?
- **frame-src:** Allows PDF/document preview in iframes from S3/MinIO
- **img-src https::** Allows images from S3/MinIO endpoints
- **media-src:** Allows audio/video playback from S3/MinIO
- **connect-src https::** Allows API calls to S3/MinIO for signed URLs

---

## Related Issues Fixed

This session also fixed:
1. ✅ Database migration error (CURRENT_DB_VERSION)
2. ✅ SSL certificate verification for MinIO/Herd
3. ✅ React 19 Modal.confirm incompatibility
4. ✅ File Search deletion logging
5. ✅ Cleanup of 6 lingering File Search stores

---

## Next Steps

### Immediate
- ✅ All errors fixed - ready for testing

### Future Enhancements
1. Make CSP configuration environment-aware (load from .env)
2. Add CSP nonce support for inline scripts
3. Implement CSP report-uri for monitoring violations
4. Add support for additional S3 providers (DigitalOcean Spaces, etc.)

---

## Summary

All three errors encountered during document preview have been successfully fixed:
- ✅ React key warnings resolved
- ✅ React 19 compatibility ensured
- ✅ CSP policy updated for S3/MinIO document preview

The application should now properly display document previews from S3/MinIO without console errors.

