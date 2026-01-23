#!/bin/bash

# Google OAuth Configuration Verification Script
# Run this to verify your setup

echo "================================================"
echo "Google OAuth Configuration Checker"
echo "================================================"
echo ""

echo "✅ Expo Configuration:"
echo "   Username: khushi12singh"
echo "   Slug: Uptrender"
echo ""

echo "✅ Expected Redirect URI:"
echo "   https://auth.expo.io/@khushi12singh/Uptrender"
echo ""

echo "✅ Web Client ID (for Expo Go):"
echo "   710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com"
echo ""

echo "✅ iOS Client ID (for native builds):"
echo "   710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com"
echo ""

echo "================================================"
echo "REQUIRED in Google Cloud Console"
echo "================================================"
echo ""

echo "For Web OAuth Client (710894950429-qatr6ok68sfj...):"
echo ""
echo "1. Authorized JavaScript origins:"
echo "   https://auth.expo.io"
echo ""
echo "2. Authorized redirect URIs:"
echo "   https://auth.expo.io/@khushi12singh/Uptrender"
echo ""

echo "================================================"
echo "Verification Steps"
echo "================================================"
echo ""
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Click on Web OAuth client (710894950429-qatr6ok68sfj...)"
echo "3. Verify EXACT match of JavaScript origins and redirect URIs above"
echo "4. Save and wait 5-10 minutes"
echo "5. Run: npx expo start --clear"
echo "6. Try Google Sign-In"
echo ""

echo "================================================"
echo "Current EAS Account:"
echo "================================================"
eas whoami 2>&1 || echo "Not logged in to EAS"
echo ""

echo "Done! Follow the steps above to configure Google Console."
