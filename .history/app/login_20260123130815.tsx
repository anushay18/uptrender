import { getTheme } from '@/constants/styles';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import authService from '@/services/authService';
import {
    getGoogleAuthConfig,
  logAuthConfig,
  configureNativeGoogleSignin,
} from '@/services/googleAuthConfig';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// CRITICAL: Must be at top level, outside component, runs when file loads
WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

// Use centralized Google auth config
const googleConfig = getGoogleAuthConfig();
logAuthConfig();
const REDIRECT_URI = googleConfig.redirectUri; // may be undefined for standalone builds

export default function LoginScreen() {
  const { isDark, toggleTheme } = useTheme();
  const { login, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const theme = getTheme(isDark);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Prevent duplicate auth handling
  const authHandledRef = useRef(false);

  // Use Google.useAuthRequest with EXPLICIT redirectUri
  // The key fix: pass redirectUri directly to force Expo proxy
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleConfig.webClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: REDIRECT_URI, // undefined for standalone (expo-auth-session will make native redirect)
  });

  // Debug logging
  useEffect(() => {
    console.log('=== Google Auth Debug ===');
    console.log('Redirect URI:', REDIRECT_URI || AuthSession.makeRedirectUri({ scheme: 'uptrender' }));
    console.log('Request ready:', !!request);
    if (request) {
      console.log('Request redirect URI:', (request as any).redirectUri);
    }
    console.log('=========================');
  }, [request]);

  // Handle Google OAuth response
  useEffect(() => {
    const handleResponse = async () => {
      if (authHandledRef.current) return;
      
      if (response?.type === 'success') {
        authHandledRef.current = true;
        setGoogleLoading(true);
        
        try {
          const { authentication } = response;
          
          if (authentication?.accessToken) {
            console.log('Got access token, fetching user info...');
            
            // Fetch user info from Google
            const userInfoResponse = await fetch(
              'https://www.googleapis.com/oauth2/v3/userinfo',
              { headers: { Authorization: `Bearer ${authentication.accessToken}` } }
            );
            const userInfo = await userInfoResponse.json();
            
            console.log('User info:', userInfo);

            if (!userInfo.email) {
              throw new Error('Could not get email from Google');
            }

            // Send to backend
            const payload = {
              email: userInfo.email,
              name: userInfo.name || userInfo.email.split('@')[0],
              googleId: userInfo.sub,
              avatar: userInfo.picture,
            };
            console.log('[Login] Sending googleLogin payload:', payload);
            const result = await authService.googleLogin(payload);
            console.log('[Login] googleLogin result:', result);

            if (result.success) {
              router.replace('/');
            } else {
              Alert.alert('Login Failed', result.error || 'Google login failed.');
            }
          } else {
            Alert.alert('Error', 'No access token received from Google.');
          }
        } catch (error: any) {
          console.error('Google auth error:', error);
          Alert.alert('Error', error.message || 'Failed to complete Google sign-in.');
        } finally {
          setGoogleLoading(false);
          setTimeout(() => { authHandledRef.current = false; }, 1000);
        }
      } else if (response?.type === 'error') {
        console.error('Google OAuth error:', response.error);
        Alert.alert('Authentication Error', response.error?.message || 'Google sign-in failed.');
      }
    };
    
    handleResponse();
  }, [response]);

    // Native Google Sign-In flow for standalone builds
    const nativeGoogleSignIn = async () => {
      try {
        setGoogleLoading(true);
        // ensure native module is configured
        await configureNativeGoogleSignin();
        const module = await import('@react-native-google-signin/google-signin');
        const GoogleSignin = module.GoogleSignin;
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const userInfo = await GoogleSignin.signIn();
        console.log('Native Google userInfo:', userInfo);

        const email = userInfo?.user?.email;
        const name = userInfo?.user?.name || email?.split('@')[0];
        const googleId = userInfo?.user?.id || userInfo?.user?.sub;
        const avatar = userInfo?.user?.photo;

        if (!email) throw new Error('Could not get email from Google (native)');

        const result = await authService.googleLogin({
          email,
          name,
          googleId,
          avatar,
        });

        if (result.success) {
          router.replace('/');
        } else {
          Alert.alert('Login Failed', result.error || 'Google login failed.');
        }
      } catch (error: any) {
        console.error('Native Google sign-in error:', error);
        Alert.alert('Error', error.message || 'Native Google sign-in failed.');
      } finally {
        setGoogleLoading(false);
      }
    };

  const handleGoogleLogin = async () => {
    if (!request) {
      Alert.alert('Error', 'Google Sign-In is not ready. Please wait and try again.');
      return;
    }

    console.log('Starting Google OAuth...');
    console.log('Redirect URI being used:', REDIRECT_URI || AuthSession.makeRedirectUri({ scheme: 'uptrender' }));
    
    setGoogleLoading(true);
    authHandledRef.current = false;
    
    try {
      if (googleConfig.isStandalone) {
        console.log('Using native Google Sign-In (standalone)');
        await nativeGoogleSignIn();
        return;
      }

      // useProxy only when running inside Expo Go / dev client
      const result = await promptAsync({ useProxy: googleConfig.isExpoGo });
      console.log('OAuth result type:', result.type);
      
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setGoogleLoading(false);
      }
    } catch (error: any) {
      console.error('Google OAuth error:', error);
      setGoogleLoading(false);
      Alert.alert('Error', error.message || 'Failed to start Google sign-in.');
    }
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await login({ email, password });

      if (result.success) {
        router.replace('/');
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Theme Toggle (top-right) */}
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: theme.surfaceSecondary, alignSelf: 'flex-end' }]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Centered Logo */}
          <View style={styles.brandSection}>
            <Image
              source={require('@/assets/images/uptrender-logo.png')}
              style={styles.logoImage}
            />
          </View>

          {/* Login Form */}
          <View style={styles.formSection}>
            <Text style={[styles.formTitle, { color: theme.text, textAlign: 'center' }]}>Welcome back!</Text>
            <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>
              Sign in to continue trading
            </Text>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email</Text>
              <View style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: errors.email ? '#EF4444' : theme.border,
                }
              ]}>
                <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Password</Text>
              <View style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: errors.password ? '#EF4444' : theme.border,
                }
              ]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => console.log('Forgot password')}
            >
              <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="reload" size={20} color="#fff" />
                    <Text style={styles.loginButtonText}>Signing in...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name="log-in-outline" size={20} color="#fff" />
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>Or continue with</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[styles.googleButton, {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: googleLoading ? 0.7 : 1,
              }]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <>
                  <Ionicons name="reload" size={20} color={theme.textSecondary} />
                  <Text style={[styles.googleButtonText, { color: theme.text }]}>
                    Signing in...
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Ionicons name="logo-google" size={20} color="#DB4437" />
                  </View>
                  <Text style={[styles.googleButtonText, { color: theme.text }]}>
                    Sign in with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View style={styles.signupSection}>
            <Text style={[styles.signupText, { color: theme.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={[styles.signupLink, { color: theme.primary }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: Platform.OS === 'android' ? 40 : 24,
  },
  themeToggle: {
    padding: 10,
    borderRadius: 12,
    marginTop: Platform.OS === 'android' ? 18 : 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 18 : 0,
    marginBottom: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 34 : 10,
  },
  logoContainer: {
    width: Platform.OS === 'android' ? 70 : 80,
    height: Platform.OS === 'android' ? 70 : 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandName: {
    fontWeight: '700',
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 14,
  },
  formSection: {
    flex: 1,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 3 : 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  googleIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  logoImage: {
    width: 80,
    height: 45,
  },
  signupSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 160 : 120,
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
