# CRITICAL: Google Console Configuration Fix

## ⚠️ Current Error: redirect_uri_mismatch

Your app is sending:
- **Client ID**: `710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com` (Web Client)
- **Redirect URI**: `https://auth.expo.io/@khushi12singh/Uptrender`

Google is rejecting this because your **Web Application OAuth client** is not configured correctly.

---

## 🔧 EXACT Steps to Fix in Google Cloud Console

### Step 1: Open Your Web OAuth Client

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find the OAuth client with ID: `710894950429-qatr6ok68sfj1076befk4kc6ulor35do`
3. **VERIFY** it says "Type: Web application" at the top
4. Click on it to edit

---

### Step 2: Configure Authorized JavaScript Origins

In the "Authorized JavaScript origins" section:

**Click "+ ADD URI"** and add EXACTLY:
```
https://auth.expo.io
```

**Common mistakes to avoid:**
- ❌ `http://auth.expo.io` (must be https)
- ❌ `https://auth.expo.io/` (no trailing slash)
- ❌ Any other domain

---

### Step 3: Configure Authorized Redirect URIs

In the "Authorized redirect URIs" section:

**DELETE any existing URIs that don't match**, then **Click "+ ADD URI"** and add EXACTLY:
```
https://auth.expo.io/@khushi12singh/Uptrender
```

**Critical requirements:**
- ✅ Exactly as shown above
- ✅ Capital `U` in `Uptrender`
- ✅ `@khushi12singh` (your Expo username)
- ✅ NO trailing slash
- ✅ NO `/callback` at the end

**Common mistakes to avoid:**
- ❌ `https://auth.expo.io/@khushi12singh/uptrender` (lowercase u)
- ❌ `https://auth.expo.io/@khushi12singh/Uptrender/` (trailing slash)
- ❌ `https://auth.expo.io/@khushi12singh/Uptrender/callback`
- ❌ Any exp:// URIs

---

### Step 4: Save and Wait

1. Click **SAVE** at the bottom
2. **CRITICAL**: Wait 5-10 minutes for Google's servers to propagate the changes
3. Don't test immediately after saving

---

### Step 5: Verify OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Since your app is in **Testing** mode:
   - Click **+ ADD USERS**
   - Add your email address that you're testing with
   - Click **SAVE**

---

## 📋 Final Checklist

Before testing again, verify:

- [ ] Web OAuth client (`710894950429-qatr6ok68sfj...`) is configured
- [ ] JavaScript origin: `https://auth.expo.io` (no trailing slash)
- [ ] Redirect URI: `https://auth.expo.io/@khushi12singh/Uptrender` (capital U, no trailing slash)
- [ ] Your test email is added to OAuth consent screen test users
- [ ] You waited 5-10 minutes after saving
- [ ] You restarted Expo with `npx expo start --clear`

---

## 🔍 How to Verify Your Configuration

Take a screenshot of your Web OAuth client showing:
1. The "Authorized JavaScript origins" section
2. The "Authorized redirect URIs" section

Compare with these exact values:
```
JavaScript origins:
  https://auth.expo.io

Redirect URIs:
  https://auth.expo.io/@khushi12singh/Uptrender
```

---

## 🚨 Still Not Working?

If you've done all the above and still get an error after 10 minutes:

1. Try creating a **NEW** Web OAuth client:
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Select "Web application"
   - Name: "Uptrender Expo Dev"
   - Add the JavaScript origin and redirect URI above
   - Copy the new Client ID
   - Update `login.tsx` and `signup.tsx` with the new client ID

2. Verify your Expo username is correct:
   ```bash
   eas whoami
   ```
   Should show: `khushi12singh`

3. Share a screenshot of your Google Console OAuth client configuration so I can verify it matches exactly.

---

## ⚡ Quick Test After Configuration

After configuring Google Console and waiting 10 minutes:

```bash
cd /Users/muskansingh/Desktop/Uptrender
npx expo start --clear
```

Look for these logs when the app loads:
```
LOG  Redirect URI: https://auth.expo.io/@khushi12singh/Uptrender
LOG  Google Auth Request object: {"clientId": "710894950429-qatr6ok68sfj..."
```

Then try Google Sign-In. It should work!
