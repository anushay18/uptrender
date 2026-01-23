# Fix: Google OAuth "Error 400: redirect_uri_mismatch"

## ✅ What I Fixed

I updated your code to use `AuthSession.makeRedirectUri()` instead of hardcoding the redirect URI. This ensures the URI is generated correctly based on your app configuration.

### Changes Made:

1. **[login.tsx](app/login.tsx)** - Updated to use `makeRedirectUri()`
2. **[signup.tsx](app/signup.tsx)** - Updated to use `makeRedirectUri()`

## 🔍 Current Configuration

Based on your app.json:
- **Owner**: `raman42`
- **Slug**: `uptrender`
- **Expected Redirect URI**: `https://auth.expo.io/@raman42/uptrender`

## 📋 Google Console Checklist

### Step 1: Verify Web Application Client

Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)

Find your Web application client: `710894950429-qatr6ok68sfj1076befk4kc6ulor35do...`

### Step 2: Check Authorized JavaScript origins

Must have EXACTLY:
```
https://auth.expo.io
```

❌ **NOT** `http://auth.expo.io` (no http)
❌ **NOT** `https://auth.expo.io/` (no trailing slash)

### Step 3: Check Authorized redirect URIs

Must have EXACTLY:
```
https://auth.expo.io/@raman42/uptrender
```

⚠️ **CRITICAL CHECKS**:
- ✅ All lowercase: `uptrender` (not `Uptrender` or `upTrender`)
- ✅ No trailing slash
- ✅ No `/callback` at the end
- ✅ Correct username: `@raman42`

### Step 4: Save and Wait

1. Click **SAVE** in Google Console
2. **WAIT 5-10 minutes** for Google's servers to propagate the changes
3. Google's caching can cause issues immediately after saving

## 🧪 Testing Steps

### 1. Check the Generated URI

Run the app and check the console logs:
```bash
npx expo start
```

Look for this in the logs:
```
=== Google OAuth Debug ===
Generated redirectUri: https://auth.expo.io/@raman42/uptrender
```

### 2. Verify it Matches Google Console

The URI in the logs MUST match EXACTLY what's in Google Console.

### 3. Common Issues

#### Issue A: URI Case Mismatch
- Google Console: `https://auth.expo.io/@raman42/Uptrender` (capital U)
- Code generates: `https://auth.expo.io/@raman42/uptrender` (lowercase u)
- **Fix**: Update Google Console to match the lowercase version

#### Issue B: Extra Path
- Google Console: `https://auth.expo.io/@raman42/uptrender/callback`
- Code generates: `https://auth.expo.io/@raman42/uptrender`
- **Fix**: Remove `/callback` from Google Console

#### Issue C: Trailing Slash
- Google Console: `https://auth.expo.io/@raman42/uptrender/`
- Code generates: `https://auth.expo.io/@raman42/uptrender`
- **Fix**: Remove trailing slash from Google Console

#### Issue D: Wrong Username
- Google Console: `https://auth.expo.io/@khushi12singh/Uptrender`
- Code generates: `https://auth.expo.io/@raman42/uptrender`
- **Fix**: Update Google Console to use `@raman42/uptrender`

## 🔧 Additional Configuration

### OAuth Consent Screen

1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Make sure you're in **Testing** mode (if not published)
3. Add your test email under **Test users**:
   - Click "+ ADD USERS"
   - Add the email you're testing with

### Client ID Configuration

Make sure you're using the correct Client IDs:

**Web Client** (used for Expo Go and web):
```
710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com
```

**iOS Client** (used for native iOS builds):
```
710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com
```

## 🐛 If Still Not Working

### 1. Clear App Cache

```bash
npx expo start -c
```

### 2. Check Expo Owner

Make sure your Expo account owner is correct:
```bash
npx expo whoami
```

Should show: `raman42`

If not, update app.json:
```json
{
  "expo": {
    "owner": "raman42"
  }
}
```

### 3. Verify Expo Project

```bash
npx expo config --type public | grep "owner\|slug"
```

Should show:
```
owner: 'raman42',
slug: 'uptrender',
```

### 4. Check for Multiple OAuth Clients

In Google Console, make sure you only have ONE active Web application client with the correct redirect URI. Having multiple clients can cause confusion.

### 5. Enable Required APIs

Make sure these APIs are enabled in your Google Cloud Project:
- Google+ API (if available)
- Google People API
- Google OAuth2 API

Go to [APIs & Services → Library](https://console.cloud.google.com/apis/library)

## 📱 Platform-Specific Notes

### For iOS (Expo Go)
- Uses Web Client ID through auth.expo.io proxy
- No additional configuration needed for Expo Go

### For Android (Expo Go)
- Uses Web Client ID through auth.expo.io proxy
- No additional configuration needed for Expo Go

### For Production Builds
- iOS will use the iOS Client ID and native redirect
- Android will use the Android Client ID (if created) or Web Client ID

## 📸 What to Check in Your Screenshot

Looking at your Google Console screenshot:

✅ **JavaScript origins**: `https://auth.expo.io` - CORRECT
✅ **Redirect URI**: `https://auth.expo.io/@raman42/uptrender` - CORRECT

The configuration looks correct! The issue might be:

1. **Timing**: Google's servers may not have propagated the changes yet (wait 5-10 minutes)
2. **Caching**: Your browser or app might be caching the old configuration
3. **Wrong Client**: Make sure you're editing the Web application client, not an iOS or Android client

## 🔄 Next Steps

1. **Verify the redirect URI in logs** (run `npx expo start` and check console)
2. **Wait 5-10 minutes** after saving changes in Google Console
3. **Clear app cache** with `npx expo start -c`
4. **Try again** with the Google Sign In button

If you still get the error, please:
1. Share the console log showing the generated redirect URI
2. Share a fresh screenshot of your Google Console OAuth client configuration
3. Confirm you saved the changes and waited a few minutes

## 💡 Quick Fix Command

Run this to check everything is correct:
```bash
node check-redirect-uri.js
```

This will show you exactly what redirect URI your app will use, and what needs to be in Google Console.
