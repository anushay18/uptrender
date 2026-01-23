# Google OAuth Troubleshooting - Cache Issues

## The Problem

Even though your Google Console is configured correctly, Google may be caching the old redirect URI configuration.

## Solutions to Try (in order)

### Solution 1: Force Fresh Auth with prompt=consent ✅ DONE

I've updated your code to add `prompt: 'consent'` which forces Google to show the consent screen and bypass cache. This should work now.

### Solution 2: Clear Google Session

1. **On your iOS device/simulator:**
   - Open Safari
   - Go to Settings → Safari → Clear History and Website Data
   - OR go to https://myaccount.google.com/permissions
   - Remove "Uptrender" app access if it appears

2. **Close and restart:**
   - Force quit the Expo Go app
   - Restart with: `npx expo start --clear`

### Solution 3: Try Incognito/Private Mode

If using Expo Go on device:
- The auth will open in the system browser
- Clear browser data as mentioned above

### Solution 4: Wait Longer for Google Propagation

Google says "5 minutes" but sometimes takes longer:
- Wait 15-30 minutes after saving your Google Console changes
- Try again after waiting

### Solution 5: Verify Console Configuration Again

Double-check in Google Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on `710894950429-qatr6ok68sfj1076befk4kc6ulor35do`
3. Verify EXACTLY:
   - JavaScript origins: `https://auth.expo.io` (no trailing slash)
   - Redirect URIs: `https://auth.expo.io/@khushi12singh/Uptrender` (capital U, no slash)
4. Look for any RED ERROR messages at the top of the form
5. Make sure you clicked SAVE at the bottom

### Solution 6: Check OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Click on your app name
3. Under "Test users" - add your email if not there
4. Make sure app is in "Testing" mode (not Production if you're not verified)

## Test Now

```bash
cd /Users/muskansingh/Desktop/Uptrender
npx expo start --clear
```

Try Google Sign-In and check the logs for:
```
LOG  Google OAuth promptAsync result: ...
```

If you still see an error, paste the COMPLETE Metro log output here.

## Nuclear Option: Create New OAuth Client

If nothing works after 30 minutes:

1. Go to Google Console Credentials
2. Create a NEW Web OAuth client:
   - Name: "Uptrender Expo (NEW)"
   - JavaScript origins: `https://auth.expo.io`
   - Redirect URIs: `https://auth.expo.io/@khushi12singh/Uptrender`
3. Copy the new Client ID
4. Update in code:
   ```typescript
   const TEST_WEB_CLIENT_ID = 'YOUR_NEW_CLIENT_ID_HERE';
   ```
5. Wait 5 minutes and test
