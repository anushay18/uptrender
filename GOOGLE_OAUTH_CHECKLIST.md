# Google OAuth Configuration Checklist

## Current Error: "invalid request"

This means your Google Cloud Console OAuth client configuration doesn't match what the app is sending.

## ✅ CRITICAL: Required Google Console Configuration

### Your Current Setup:
- **Expo Owner**: `khushi12singh`
- **App Slug**: `Uptrender`
- **Web Client ID**: `710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com`
- **iOS Client ID**: `710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com`

### Step 1: Update Web Application OAuth Client in Google Console

Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)

Find client ID: `710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com`

**Under "Authorized JavaScript origins", add:**
```
https://auth.expo.io
```

**Under "Authorized redirect URIs", add EXACTLY (case-sensitive):**
```
https://auth.expo.io/@khushi12singh/Uptrender
```

⚠️ **IMPORTANT**: The slug must be `Uptrender` with capital U to match app.json!

### Step 2: Verify OAuth Consent Screen
1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Ensure your email is added as a test user (since app is in Testing mode)
3. Required scopes: `openid`, `profile`, `email`

### Step 3: Verify iOS OAuth Client (for native builds)
For the iOS client ID `710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com`:
- Bundle ID must be: `com.khushi12.uptrender`
2. Click on your OAuth client to edit it
3. Screenshot the "Application type" at the top
4. Screenshot the "Authorized redirect URIs" section
5. If "Application type" is NOT "Web application", create a new Web client
6. Share the screenshots if still not working

## 📞 Still Not Working?

If you've verified all the above and it still fails:
- Clear browser cache
- Wait 5-10 minutes after saving changes
- Ensure OAuth consent screen has your email as a test user
- Try creating a completely new Web OAuth client
