
import { getTheme } from '@/constants/styles';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
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

const { width } = Dimensions.get('window');

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
          {/* Theme Toggle */}
          <TouchableOpacity 
            style={[styles.themeToggle, { backgroundColor: theme.surfaceSecondary }]}
            onPress={toggleTheme}
          >
            <Ionicons 
              name={isDark ? 'sunny' : 'moon'} 
              size={20} 
              color={theme.textSecondary} 
            />
          </TouchableOpacity>

          {/* Logo / Brand */}
          <View style={styles.brandSection}>
            <View style={[styles.logoContainer, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="trending-up" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.brandName, { color: theme.text }]}>Uptrender</Text>
            <Text style={[styles.brandTagline, { color: theme.textSecondary }]}>
              Start your trading journey
            </Text>
          </View>

          {/* Signup Form */}
          <View style={styles.formSection}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Create Account</Text>
            {/* <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>
              Join thousands of traders worldwide
            </Text> */}

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

            {/* Divider removed (social signup not used) */}
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
    alignSelf: 'flex-end',
    padding: 10,
    borderRadius: 12,
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: Platform.OS === 'android' ? 16 : 25,
  },
  logoContainer: {
    width: Platform.OS === 'android' ? 60 : 70,
    height: Platform.OS === 'android' ? 60 : 70,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandName: {
    fontSize: Platform.OS === 'android' ? 22 : 26,
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
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 12,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
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
    paddingVertical: Platform.OS === 'android' ? 3 : 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: Platform.OS === 'android' ? 15 : 16,
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
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
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
  signinSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 20 : 0,
  },
  signinText: {
    fontSize: 14,
  },
  signinLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
