# Google OAuth Setup Guide for Uptrender

## ⚠️ Current Issue: Error 400 - invalid_request

This error means the redirect URI in your Google Cloud Console doesn't match what expo-auth-session is sending.

---

## 🔧 EXACT Configuration Required in Google Cloud Console

### Your App Configuration:
| Setting | Value |
|---------|-------|
| Expo Owner | `khushi12singh` |
| App Slug | `Uptrender` |
| Web Client ID | `710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com` |
| iOS Client ID | `710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com` |
| Bundle ID | `com.khushi12.uptrender` |

---

## Step 1: Fix Web Application OAuth Client

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your **Web application** client (`710894950429-qatr6ok68sfj1076befk4kc6ulor35do...`)
3. Under **"Authorized JavaScript origins"**, ensure you have:
   ```
   https://auth.expo.io
   ```

4. Under **"Authorized redirect URIs"**, **DELETE the current one** and add:
   ```
   https://auth.expo.io/@khushi12singh/Uptrender
   ```

   ⚠️ **CRITICAL**: 
   - Capital `U` in `Uptrender`
   - NO `/callback` at the end
   - NO trailing slash

5. Click **SAVE**

---

## Step 2: Verify OAuth Consent Screen

1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Since you're in **Testing** mode, add your test email:
   - Click **+ Add users**
   - Add the email you're testing with
3. Verify these scopes are added:
   - `openid`
   - `profile`
   - `email`

---

## Step 3: Wait for Propagation

Google takes **5-10 minutes** to propagate changes. Wait before testing again.

---

## Step 4: Test the OAuth Flow

1. Close the Expo app completely
2. Restart the Expo dev server:
   ```bash
   npx expo start --clear
   ```
3. Try Google Sign In again

---

## 🔍 Debugging

When you try to sign in, check your terminal/console for logs like:
```
=== Google OAuth Debug ===
Redirect URI: https://auth.expo.io/@khushi12singh/Uptrender
Web Client ID: 710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com
===========================
```

The **Redirect URI** shown MUST exactly match what's in Google Console.

---

## ❌ Common Mistakes

| Mistake | Fix |
|---------|-----|
| `uptrender` (lowercase) | Use `Uptrender` (capital U) |
| `/callback` at end | Remove it |
| Trailing slash `/` | Remove it |
| HTTP instead of HTTPS | Must use `https://` |
| Wrong owner username | Must be `@khushi12singh` |

---

## 🎯 Summary Checklist

- [ ] Web Client JavaScript Origin: `https://auth.expo.io`
- [ ] Web Client Redirect URI: `https://auth.expo.io/@khushi12singh/Uptrender`
- [ ] OAuth Consent Screen: Your test email is added as test user
- [ ] Waited 5-10 minutes after saving changes
- [ ] Restarted Expo with cache clear

---

## iOS Native Build Configuration

For development builds or production iOS apps:

1. The iOS Client ID is already configured: `710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com`
2. Bundle ID in app.json matches: `com.khushi12.uptrender`
3. URL Scheme is configured in app.json infoPlist

---

If still not working after all steps, create a **NEW** Web Application OAuth client in Google Console with the exact settings above.
