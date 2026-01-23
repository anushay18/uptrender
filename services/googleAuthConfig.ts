/**
 * Google OAuth Configuration for Expo
 * 
 * This configuration handles Google Sign-In for:
 * - Development (Expo Go) - Uses Expo Auth Proxy with Web Client ID + ID Token Flow
 * - Production iOS - Uses native iOS Client ID
 * - Production Android - Uses native Android Client ID (requires SHA-1 fingerprint)
 * 
 * SETUP REQUIREMENTS IN GOOGLE CLOUD CONSOLE:
 * 
 * 1. WEB CLIENT (for Expo Go development + ID Token Flow):
 *    - Type: Web application
 *    - Authorized JavaScript origins: https://auth.expo.io
 *    - Authorized redirect URIs: https://auth.expo.io/@raman42/uptrender
 * 
 * 2. iOS CLIENT (for production iOS builds):
 *    - Type: iOS
 *    - Bundle ID: com.raman42.uptrender
 * 
 * 3. ANDROID CLIENT (for production Android builds):
 *    - Type: Android
 *    - Package name: com.raman42.uptrender
 *    - SHA-1 certificate fingerprint: 
 *      Get from EAS: npx eas credentials (select Android > View credentials)
 *      Or from keystore: keytool -keystore <keystore> -list -v
 * 
 * IMPORTANT: The ID Token flow (useIdTokenAuthRequest) is used because:
 * - It uses the implicit grant flow which returns an ID token directly
 * - No server-side token exchange is needed (more reliable with Expo proxy)
 * - The ID token is a JWT containing user info
 */

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Google OAuth Client IDs from Google Cloud Console
export const GOOGLE_CLIENT_IDS = {
  // Web Client ID - REQUIRED for ID Token flow (implicit grant)
  // This is used for ALL platforms (iOS, Android, Web) because:
  // - ID token flow only works with Web Client ID
  // - Native iOS/Android client IDs do NOT support implicit grant
  web: '710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com',
  
  // iOS Client ID - Only used if switching to native auth code flow
  // Currently NOT used because we use ID token flow
  ios: '710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com',
  
  // Android Client ID - Only used if switching to native auth code flow
  // Currently NOT used because we use ID token flow
  android: '710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com',
  // Updated client IDs provided by user
  // Android native client
  // Note: this must match the Android OAuth client in Google Cloud (package + SHA-1)
  android: '710894950429-6cp7gi073u9vija4gs6f6leinst3e4le.apps.googleusercontent.com',
  // iOS native client
  ios: '710894950429-8levbhu3gmb8jucir4eq38n5sjkqn4q2.apps.googleusercontent.com',
  // Web client (used for Expo Go / auth.expo.io proxy)
  web: '710894950429-qatr6ok68sfj1076befk4kc6ulor35do.apps.googleusercontent.com',
};

// Expo project info
export const EXPO_PROJECT = {
  owner: 'raman42',
  slug: 'uptrender',
};

/**
 * Check if running in Expo Go (development client)
 */
export const isExpoGo = (): boolean => {
  // Check multiple conditions for Expo Go
  const isExpoApp = Constants.appOwnership === 'expo';
  const isStoreClient = Constants.executionEnvironment === 'storeClient';
  const noAppId = !Application.applicationId;
  
  return isExpoApp || isStoreClient || noAppId;
};

/**
 * Check if running in a standalone/production build
 */
export const isStandaloneBuild = (): boolean => {
  // In standalone builds, we have an application ID and we're not in Expo Go
  const hasAppId = !!Application.applicationId;
  const notExpoGo = !isExpoGo();
  
  return hasAppId && notExpoGo;
};

/**
 * Get the appropriate client ID based on the current environment
 */
export const getGoogleClientId = (): string => {
  if (isExpoGo()) {
    // In Expo Go, always use web client ID (works with auth.expo.io proxy)
    console.log('[GoogleAuth] Using Web Client ID (Expo Go)');
    return GOOGLE_CLIENT_IDS.web;
  }
  
  // In standalone builds, use platform-specific client ID
  if (Platform.OS === 'ios') {
    console.log('[GoogleAuth] Using iOS Client ID (standalone)');
    return GOOGLE_CLIENT_IDS.ios;
  }
  
  if (Platform.OS === 'android') {
    console.log('[GoogleAuth] Using Android Client ID (standalone)');
    return GOOGLE_CLIENT_IDS.android;
  }
  
  // Fallback to web client ID
  console.log('[GoogleAuth] Using Web Client ID (fallback)');
  return GOOGLE_CLIENT_IDS.web;
};

/**
 * Get the redirect URI based on the current environment
 * 
 * For Expo Go: Uses Expo's auth proxy (https://auth.expo.io/@owner/slug)
 * For Standalone: Uses native scheme (no redirect URI needed for native)
 */
export const getRedirectUri = (): string | undefined => {
  if (isExpoGo()) {
    // Use Expo's auth proxy for Expo Go
    const redirectUri = `https://auth.expo.io/@${EXPO_PROJECT.owner}/${EXPO_PROJECT.slug}`;
    console.log('[GoogleAuth] Redirect URI (Expo Go):', redirectUri);
    return redirectUri;
  }
  
  // For standalone builds, let expo-auth-session handle the redirect
  // It will use the native app scheme configured in app.json
  console.log('[GoogleAuth] Using native redirect (standalone)');
  return undefined;
};

/**
 * Get full Google Auth configuration
 */
export const getGoogleAuthConfig = () => {
  const expoGo = isExpoGo();
  
  // In Expo Go, we MUST use Web Client ID for ALL platforms
  // because only the Web Client has auth.expo.io redirect URI configured
  // In standalone builds, use platform-specific client IDs
  return {
    clientId: getGoogleClientId(),
    iosClientId: expoGo ? GOOGLE_CLIENT_IDS.web : GOOGLE_CLIENT_IDS.ios,
    androidClientId: expoGo ? GOOGLE_CLIENT_IDS.web : GOOGLE_CLIENT_IDS.android,
    webClientId: GOOGLE_CLIENT_IDS.web,
    redirectUri: getRedirectUri(),
    scopes: ['openid', 'profile', 'email'],
    isExpoGo: expoGo,
    isStandalone: isStandaloneBuild(),
  };
};

/**
 * Log current auth configuration for debugging
 */
export const logAuthConfig = () => {
  const config = getGoogleAuthConfig();
  console.log('=== Google Auth Configuration ===');
  console.log('Platform:', Platform.OS);
  console.log('Is Expo Go:', config.isExpoGo);
  console.log('Is Standalone:', config.isStandalone);
  console.log('App Ownership:', Constants.appOwnership);
  console.log('Execution Environment:', Constants.executionEnvironment);
  console.log('Client ID (selected):', config.clientId);
  console.log('Web Client ID:', config.webClientId);
  console.log('iOS Client ID:', config.iosClientId);
  console.log('Android Client ID:', config.androidClientId);
  console.log('Redirect URI:', config.redirectUri || '(native)');
  console.log('================================');
  return config;
};

/**
 * Configure native Google Sign-In (for standalone builds)
 * This dynamically imports the native module so it doesn't break Expo Go.
 */
export const configureNativeGoogleSignin = async () => {
  try {
    const config = getGoogleAuthConfig();
    // Dynamic import to avoid requiring native module in Expo Go
    const module = await import('@react-native-google-signin/google-signin');
    const GoogleSignin = module.GoogleSignin;

    GoogleSignin.configure({
      webClientId: config.webClientId,
      iosClientId: config.iosClientId,
      offlineAccess: false,
      scopes: config.scopes,
    });

    console.log('[GoogleAuth] Native GoogleSignin configured');
  } catch (error) {
    console.warn('[GoogleAuth] Failed to configure native GoogleSignin:', error);
  }
};
