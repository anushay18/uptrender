import { getTheme } from '@/constants/styles';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import authService from '@/services/authService';
import {
  configureNativeGoogleSignin,
  getGoogleAuthConfig,
  logAuthConfig,
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

export default function SignupScreen() {
  const { isDark, toggleTheme } = useTheme();
  const { register, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const theme = getTheme(isDark);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Prevent duplicate auth handling
  const authHandledRef = useRef(false);

  // Use Google.useAuthRequest with EXPLICIT redirectUri
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleConfig.webClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: REDIRECT_URI, // undefined for standalone (expo-auth-session will make native redirect)
  });

  // Debug logging
  useEffect(() => {
    console.log('=== Google Auth Debug (Signup) ===');
    console.log('Redirect URI:', REDIRECT_URI || AuthSession.makeRedirectUri({ scheme: 'uptrender' }));
    console.log('Request ready:', !!request);
    if (request) {
      console.log('Request redirect URI:', (request as any).redirectUri);
    }
    console.log('==================================');
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

            // Send to backend (googleLogin handles both login and signup)
            const payload = {
              email: userInfo.email,
              name: userInfo.name || userInfo.email.split('@')[0],
              googleId: userInfo.sub,
              avatar: userInfo.picture,
            };
            console.log('[Signup] Sending googleLogin payload:', payload);
            const result = await authService.googleLogin(payload);
            console.log('[Signup] googleLogin result:', result);

            if (result.success) {
              router.replace('/');
            } else {
              Alert.alert('Sign Up Failed', result.error || 'Google sign up failed.');
            }
          } else {
            Alert.alert('Error', 'No access token received from Google.');
          }
        } catch (error: any) {
          console.error('Google auth error:', error);
          Alert.alert('Error', error.message || 'Failed to complete Google sign-up.');
        } finally {
          setGoogleLoading(false);
          setTimeout(() => { authHandledRef.current = false; }, 1000);
        }
      } else if (response?.type === 'error') {
        console.error('Google OAuth error:', response.error);
        Alert.alert('Authentication Error', response.error?.message || 'Google sign-up failed.');
      }
    };
    
    handleResponse();
  }, [response]);

    // Native Google Sign-In flow for standalone builds
    const nativeGoogleSignUp = async () => {
      try {
        setGoogleLoading(true);
        await configureNativeGoogleSignin();
        const module = await import('@react-native-google-signin/google-signin');
        const GoogleSignin = module.GoogleSignin;
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const userInfo = await GoogleSignin.signIn();
        console.log('Native Google userInfo (signup):', userInfo);

        const email = userInfo?.user?.email;
        const name = userInfo?.user?.name || email?.split('@')[0];
        const googleId = userInfo?.user?.id || userInfo?.user?.sub;
        const avatar = userInfo?.user?.photo;

        if (!email) throw new Error('Could not get email from Google (native)');

        const payload = { email, name, googleId, avatar };
        console.log('[Signup][native] Sending googleLogin payload:', payload);
        const result = await authService.googleLogin(payload);

        if (result.success) {
          router.replace('/');
        } else {
          Alert.alert('Sign Up Failed', result.error || 'Google sign up failed.');
        }
      } catch (error: any) {
        console.error('Native Google sign-up error:', error);
        Alert.alert('Error', error.message || 'Native Google sign-up failed.');
      } finally {
        setGoogleLoading(false);
      }
    };

  const handleGoogleSignup = async () => {
    if (!request) {
      Alert.alert('Error', 'Google Sign-Up is not ready. Please wait and try again.');
      return;
    }

    console.log('Starting Google OAuth (Signup) with proxy...');
    console.log('Redirect URI being used:', REDIRECT_URI);
    
    setGoogleLoading(true);
    authHandledRef.current = false;
    
    try {
      if (googleConfig.isStandalone) {
        console.log('Using native Google Sign-In (standalone) for signup');
        await nativeGoogleSignUp();
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
      Alert.alert('Error', error.message || 'Failed to start Google sign-up.');
    }
  };

  const validateUsername = (text: string) => {
    // 3-50 characters. Letters, numbers, dots, underscore and hyphen allowed
    const usernameRegex = /^[a-zA-Z0-9._-]{3,50}$/;
    return usernameRegex.test(text);
  };

  const validatePassword = (text: string) => {
    // At least 6 characters with uppercase, lowercase, and number
    const hasUppercase = /[A-Z]/.test(text);
    const hasLowercase = /[a-z]/.test(text);
    const hasNumber = /[0-9]/.test(text);
    const isLongEnough = text.length >= 6;

    return hasUppercase && hasLowercase && hasNumber && isLongEnough;
  };

  const getPasswordStrength = () => {
    if (!password) return null;

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const isLongEnough = password.length >= 6;

    return { hasUppercase, hasLowercase, hasNumber, isLongEnough };
  };

  const passwordStrength = getPasswordStrength();

  const validateForm = () => {
    const newErrors: {
      name?: string;
      username?: string;
      email?: string;
      password?: string;
    } = {};

    if (!name) {
      newErrors.name = 'Name is required';
    }

    if (!username) {
      newErrors.username = 'Username is required';
    } else if (!validateUsername(username)) {
      newErrors.username = '3-50 characters. Letters, numbers, dots, underscore and hyphen allowed';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(password)) {
      newErrors.password = 'At least 6 characters with uppercase, lowercase, and number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await register({ name, username, email, password });

      if (result.success) {
        router.replace('/');
      } else {
        Alert.alert('Registration Failed', result.error || 'Could not create account. Please try again.');
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

          {/* Signup Form */}
          <View style={styles.formSection}>
            <Text style={[styles.formTitle, { color: theme.text, textAlign: 'center' }]}>Create Account</Text>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Name</Text>
              <View style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: errors.name ? '#EF4444' : theme.border,
                }
              ]}>
                <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  autoCapitalize="words"
                />
              </View>
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Username</Text>
              <View style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: errors.username ? '#EF4444' : theme.border,
                }
              ]}>
                <Ionicons name="at-outline" size={20} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Choose a username"
                  placeholderTextColor={theme.textSecondary}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errors.username) setErrors({ ...errors, username: undefined });
                  }}
                  autoCapitalize="none"
                />
              </View>
              <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                3-50 characters. Letters, numbers, dots, underscore and hyphen allowed
              </Text>
              {errors.username && (
                <Text style={styles.errorText}>{errors.username}</Text>
              )}
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email Address</Text>
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
                  placeholder="Create a password"
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

              {/* Password Requirements */}
              {password.length > 0 && (
                <View style={styles.passwordRequirements}>
                  <Text style={[styles.requirementText, { color: theme.textSecondary }]}>
                    At least 6 characters with uppercase, lowercase, and number
                  </Text>
                  <View style={styles.requirementsList}>
                    <View style={styles.requirementItem}>
                      <Ionicons
                        name={passwordStrength?.isLongEnough ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={passwordStrength?.isLongEnough ? '#10B981' : theme.textSecondary}
                      />
                      <Text style={[styles.requirementItemText, {
                        color: passwordStrength?.isLongEnough ? '#10B981' : theme.textSecondary
                      }]}>
                        6+ characters
                      </Text>
                    </View>
                    <View style={styles.requirementItem}>
                      <Ionicons
                        name={passwordStrength?.hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={passwordStrength?.hasUppercase ? '#10B981' : theme.textSecondary}
                      />
                      <Text style={[styles.requirementItemText, {
                        color: passwordStrength?.hasUppercase ? '#10B981' : theme.textSecondary
                      }]}>
                        Uppercase
                      </Text>
                    </View>
                    <View style={styles.requirementItem}>
                      <Ionicons
                        name={passwordStrength?.hasLowercase ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={passwordStrength?.hasLowercase ? '#10B981' : theme.textSecondary}
                      />
                      <Text style={[styles.requirementItemText, {
                        color: passwordStrength?.hasLowercase ? '#10B981' : theme.textSecondary
                      }]}>
                        Lowercase
                      </Text>
                    </View>
                    <View style={styles.requirementItem}>
                      <Ionicons
                        name={passwordStrength?.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={passwordStrength?.hasNumber ? '#10B981' : theme.textSecondary}
                      />
                      <Text style={[styles.requirementItemText, {
                        color: passwordStrength?.hasNumber ? '#10B981' : theme.textSecondary
                      }]}>
                        Number
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signupButtonGradient}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="reload" size={20} color="#fff" />
                    <Text style={styles.signupButtonText}>Creating account...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.signupButtonText}>Sign Up</Text>
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

            {/* Google Sign-Up Button */}
            <TouchableOpacity
              style={[styles.googleButton, {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: googleLoading ? 0.7 : 1,
              }]}
              onPress={handleGoogleSignup}
              disabled={googleLoading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <>
                  <Ionicons name="reload" size={20} color={theme.textSecondary} />
                  <Text style={[styles.googleButtonText, { color: theme.text }]}>
                    Signing up...
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Ionicons name="logo-google" size={20} color="#DB4437" />
                  </View>
                  <Text style={[styles.googleButtonText, { color: theme.text }]}>
                    Sign up with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign In Link */}
          <View style={styles.signinSection}>
            <Text style={[styles.signinText, { color: theme.textSecondary }]}>
              Already have an Account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={[styles.signinLink, { color: theme.primary }]}>Sign In</Text>
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
    paddingTop: Platform.OS === 'android' ? 30 : 0,
    paddingBottom: Platform.OS === 'android' ? 60 : 40,
  },
  themeToggle: {
    padding: 10,
    borderRadius: 12,
    marginTop: Platform.OS === 'android' ? 17 : 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 10 : 0,
    marginBottom: 30,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 15,
  },
  formSection: {
    flex: 1,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 12,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 2 : 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: Platform.OS === 'android' ? 13 : 16,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
  },
  passwordRequirements: {
    marginTop: 8,
  },
  requirementText: {
    fontSize: 12,
    marginBottom: 8,
  },
  requirementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requirementItemText: {
    fontSize: 11,
  },
  signupButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
  },
  signupButtonGradient: {
    paddingVertical: Platform.OS === 'android' ? 14 : 16,
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
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
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
    marginBottom: 6,
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
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 70,
    height: 42,
    paddingTop: 10,
  },
  signinSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 20 : 20,
  },
  signinText: {
    fontSize: 14,
  },
  signinLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
