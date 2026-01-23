# Google OAuth Setup for Uptrender (Expo React Native)

This guide explains how to configure Google Sign-In to work in both development (Expo Go) and production (Play Store / APK).

## Current Configuration

### Client IDs in Your App:
- **Web Client ID**: `710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com`
- **iOS Client ID**: `710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com`
- **Android Client ID**: Currently using Web Client ID (see below for proper setup)

---

## How It Works

### Development (Expo Go)
- Uses **Expo Auth Proxy** at `https://auth.expo.io/@raman42/uptrender`
- Uses **Web Client ID** since Expo Go can't use native OAuth
- ✅ Your current setup already supports this

### Production (Standalone Builds)
- **iOS**: Uses native OAuth with iOS Client ID and URL scheme
- **Android**: Uses native OAuth with Android Client ID and SHA-1 fingerprints

---

## Google Cloud Console Configuration

### 1. Web Client (Already Configured ✅)
Your Web Client is already set up correctly:
- **Type**: Web application
- **Authorized JavaScript origins**: `https://auth.expo.io`
- **Authorized redirect URIs**: `https://auth.expo.io/@raman42/uptrender`

### 2. iOS Client (Already Configured ✅)
Your iOS Client is already set up correctly:
- **Type**: iOS
- **Bundle ID**: `com.raman42.uptrender`
- The URL scheme is already configured in `app.json`

### 3. Android Client (NEEDS CONFIGURATION ⚠️)

You need to create an Android OAuth Client in Google Cloud Console:

#### Step 1: Get Your SHA-1 Fingerprints

**For EAS Builds (Recommended):**
```bash
# Get the SHA-1 for your upload certificate
eas credentials -p android

# Or run this command to see all certificates
eas credentials:list -p android
```

**For Local Debug Keystore (if needed):**
```bash
# macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Look for the SHA1 line in the output
```

#### Step 2: Create Android OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Android** application type
4. Fill in:
   - **Name**: `Uptrender Android`
   - **Package name**: `com.raman42.uptrender`
   - **SHA-1 certificate fingerprint**: (paste from Step 1)
5. Click **Create**
6. Copy the generated Client ID

#### Step 3: Update Your App

Edit `services/googleAuthConfig.ts` and replace the Android client ID:

```typescript
export const GOOGLE_CLIENT_IDS = {
  web: '710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com',
  ios: '710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com',
  android: 'YOUR_NEW_ANDROID_CLIENT_ID.apps.googleusercontent.com', // <-- Update this
};
```

---

## Testing

### Test in Expo Go (Development)
1. Run `npx expo start`
2. Open on your phone using Expo Go
3. Try Google Sign-In
4. It should use the Expo Auth Proxy

### Test in Production Build
```bash
# Create a preview build for Android
eas build --profile preview --platform android

# Or create an APK
eas build --profile production --platform android
```

---

## Troubleshooting

### "Access Blocked" Error
This usually means:
1. The redirect URI doesn't match what's in Google Console
2. Your email is not in the "Test Users" list (app is in testing mode)

**Solution:**
- Make sure your Google email is added as a test user in [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
- Or publish your app for production access

### "redirect_uri_mismatch" Error
The redirect URI in the OAuth request doesn't match Google Console.

**For Expo Go:**
- Make sure `https://auth.expo.io/@raman42/uptrender` is in your Web Client's redirect URIs

**For Standalone:**
- Android uses SHA-1 based authentication (no redirect URI)
- iOS uses the URL scheme configured in app.json

### Google Sign-In Button Disabled
The OAuth request is still initializing. Wait a moment and try again.

---

## Files Modified

1. **services/googleAuthConfig.ts** - Centralized Google OAuth configuration
2. **app/login.tsx** - Updated login screen with proper OAuth flow
3. **app/signup.tsx** - Updated signup screen with proper OAuth flow

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User clicks "Sign in with Google"        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   Check Environment: isExpoGo() from googleAuthConfig.ts    │
└──────────────────────────────┬──────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│   Expo Go (Development)  │    │   Standalone (Production)    │
├─────────────────────────┤    ├─────────────────────────────┤
│ • Uses Web Client ID     │    │ • Uses iOS/Android Client ID │
│ • auth.expo.io proxy     │    │ • Native OAuth flow          │
│ • Opens in system browser│    │ • Opens in native webview    │
└──────────────────────────┘    └─────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   Google returns access token → Fetch user info             │
│   → Send to backend (/auth/google) → Login successful       │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ Code implementation is complete
2. ⏳ Create Android OAuth Client in Google Console (see instructions above)
3. ⏳ Add SHA-1 fingerprints for both debug and release builds
4. ⏳ Test in both Expo Go and standalone builds
5. ⏳ Consider publishing OAuth consent screen for production
