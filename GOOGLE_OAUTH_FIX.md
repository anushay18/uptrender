# Google OAuth Authorization Error Fix

## Error Summary
**Error:** `Access blocked: Authorization Error - Error 400: invalid_request`

This error occurs because the app's redirect URI or JavaScript origins are not registered in Google Cloud Console.

## Root Cause
Google requires all OAuth 2.0 clients to have:
1. **Secure (HTTPS) redirect URIs** - Must start with `https://`
2. **Registered JavaScript origins** - The domain where requests originate from
3. **Proper PKCE flow** - For mobile/native apps

## Solution

### Step 1: Update Google Cloud Console

Go to [Google Cloud Console](https://console.cloud.google.com):

1. **Select your project**
2. Navigate to **APIs & Services > Credentials**
3. Find your OAuth 2.0 Client ID (Web client: `315456117346-tdukveh1jile4sfshmdk64ns9emkvar7.apps.googleusercontent.com`)
4. Click **Edit** to configure it

### Step 2: Add Authorized Redirect URIs

Under "Authorized redirect URIs", add:

```
https://auth.expo.io/@yourusername/uptrender/callback
```

**Note:** Replace `yourusername` with your Expo account username. To find it:
- Run: `eas whoami` or check your Expo account

### Step 3: Add Authorized JavaScript Origins

Under "Authorized JavaScript origins", add:

```
https://auth.expo.io
```

### Step 4: Save Changes

Click the **Save** button and wait for changes to propagate (usually 5-10 minutes).

## Testing the Fix

1. **Clear cache and cookies** in your browser
2. **Restart the Expo app** if running in Expo Go
3. Try signing in with Google again

## Alternative: Use Expo Google Sign-In Plugin

If the above doesn't work, install and use the official Expo Google Sign-In plugin:

```bash
npx expo install expo-google-app-auth
```

Then update the OAuth implementation in `app/login.tsx` and `app/signup.tsx` to use the native plugin instead.

## Resources
- [Google OAuth 2.0 Validation Rules](https://developers.google.com/identity/protocols/oauth2)
- [Expo AuthSession Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google Cloud Console](https://console.cloud.google.com)

## Important Notes
⚠️ **Never use insecure (HTTP) URIs for OAuth** - Google will reject them.
⚠️ **Redirect URIs must be exact** - No trailing slashes or missing segments.
⚠️ **Changes can take 5-10 minutes** to propagate in Google's systems.
