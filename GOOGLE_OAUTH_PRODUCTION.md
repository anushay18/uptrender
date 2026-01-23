# Google OAuth Production Setup Guide

## Current Status

The app now uses **ID Token Flow** (implicit grant) for Google Sign-In:
- ✅ **Development (Expo Go)**: Works with Web Client ID via `auth.expo.io` proxy
- ✅ **Production (iOS)**: Uses iOS Client ID
- ✅ **Production (Android)**: Uses Web Client ID (works with ID Token flow)

## How It Works

### ID Token Flow (useIdTokenAuthRequest)

Instead of the traditional OAuth code flow that requires server-side token exchange, we use the **implicit grant flow** which:

1. Redirects user to Google for authentication
2. Google returns an **ID token** directly in the URL fragment
3. The ID token is a JWT containing user information (email, name, picture)
4. No server-side token exchange needed = more reliable with Expo proxy

### Client ID Configuration

| Environment | iOS Client ID | Android Client ID | Notes |
|-------------|---------------|-------------------|-------|
| Expo Go | Web Client ID | Web Client ID | Uses `auth.expo.io` proxy |
| Production iOS | iOS Client ID | - | Native redirect via bundle ID |
| Production Android | - | Web Client ID* | ID Token flow works with web client |

*For optimal production Android support, create a dedicated Android OAuth Client ID.

## Google Cloud Console Setup

### 1. Web Client (Required)

**Already configured:**
- Client ID: `710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com`
- Authorized JavaScript origins: `https://auth.expo.io`
- Authorized redirect URIs: `https://auth.expo.io/@raman42/uptrender`

### 2. iOS Client (Required for Production iOS)

**Already configured:**
- Client ID: `710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com`
- Bundle ID: `com.raman42.uptrender`

### 3. Android Client (Optional but Recommended for Production)

**To create:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Android" as application type
4. Enter:
   - Package name: `com.raman42.uptrender`
   - SHA-1 fingerprint: Get from EAS (see below)
5. Click "Create"

**Get SHA-1 fingerprint from EAS:**
```bash
npx eas credentials
# Select: Android > Build Credentials > Keystore > View credentials
```

Or manually from keystore:
```bash
keytool -keystore <path-to-keystore> -list -v
```

## Building for Production

### iOS

```bash
# Development build
npx eas build --platform ios --profile development

# Production build for App Store
npx eas build --platform ios --profile production
```

### Android

```bash
# Development build (APK)
npx eas build --platform android --profile development

# Production build for Play Store (AAB)
npx eas build --platform android --profile production
```

## Testing Google Sign-In

### In Expo Go (Development)

1. Start the development server: `npx expo start`
2. Open the app in Expo Go
3. Navigate to Login/Signup screen
4. Tap "Continue with Google"
5. Select your Google account
6. You should see the ID token being processed and logged in

**Expected logs:**
```
Starting Google OAuth (ID Token Flow)...
Is Expo Go: true
Google OAuth success!
ID Token received: true
User info from ID token: { email: '...', name: '...', ... }
```

### In Production Build

1. Build the app: `npx eas build --platform android`
2. Install the APK on your device
3. Test Google Sign-In the same way

## Troubleshooting

### "Something went wrong" error

This was caused by the code flow failing on token exchange. The ID token flow fixes this by getting the token directly without exchange.

### "redirect_uri_mismatch" error

Make sure:
1. Web Client ID has `https://auth.expo.io/@raman42/uptrender` in authorized redirect URIs
2. In Expo Go, the Web Client ID is being used (not iOS/Android client IDs)

### Google Sign-In button not enabled

The button is disabled until `request` is ready. Wait a moment for the OAuth configuration to initialize.

### ID Token parsing fails

Check the console logs for JWT parse errors. The token should be a valid JWT with 3 parts separated by dots.

## Files Modified

- [app/login.tsx](app/login.tsx) - Uses `useIdTokenAuthRequest` for ID token flow
- [app/signup.tsx](app/signup.tsx) - Same ID token flow implementation
- [services/googleAuthConfig.ts](services/googleAuthConfig.ts) - Centralized OAuth configuration

## Architecture

```
┌─────────────────┐
│   User taps     │
│ "Google Login"  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ promptAsync()   │
│ Opens browser   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Google Auth   │
│  Select account │
└────────┬────────┘
         │
         ▼ (ID Token in URL fragment)
┌─────────────────┐
│ auth.expo.io    │
│ Redirect back   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse JWT       │
│ Extract user    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend API     │
│ /auth/google    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Logged in!    │
└─────────────────┘
```

## Security Notes

- ID tokens are signed JWTs that can be verified
- The backend should ideally verify the ID token signature using Google's public keys
- Never store client secrets in the mobile app
- The Web Client ID is safe to expose (it's public)
