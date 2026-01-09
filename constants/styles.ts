// Global Styles - Modern, Clean Design inspired by Streak
import { Dimensions, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

// Typography - Clean, modern font sizes
export const typography = {
  // Headlines
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  // Body text
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  // Labels
  labelLarge: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  labelMedium: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
  // Caption
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

// Colors - Modern, clean palette
export const colors = {
  // Primary brand color (Blue - like Streak)
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',
  primaryBg: 'rgba(37, 99, 235, 0.08)',
  
  // Success/Profit colors
  success: '#10B981',
  successLight: '#34D399',
  successBg: 'rgba(16, 185, 129, 0.1)',
  
  // Error/Loss colors
  error: '#EF4444',
  errorLight: '#F87171',
  errorBg: 'rgba(239, 68, 68, 0.1)',
  
  // Warning colors
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  
  // Light mode
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSecondary: '#F1F5F9',
    text: '#1E293B',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    divider: '#E2E8F0',
  },
  
  // Dark mode - Blackish dark with blue tint
  dark: {
    background: '#050510',
    surface: '#0a0a1a',
    surfaceSecondary: '#12122a',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    border: '#1a1a35',
    borderLight: '#0f0f20',
    divider: '#1a1a35',
  },
};

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border radius
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// Shadows
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
};

// Common component styles
export const commonStyles = StyleSheet.create({
  // Card styles - Clean with subtle border
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.md,
  },
  
  // Glass button effect
  glassButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(10px)',
  },
  
  // Pill badge
  pillBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  
  // Primary button
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  
  // Outline button
  outlineButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  
  // Input field
  input: {
    backgroundColor: colors.light.surfaceSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  
  // Search bar
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.light.surfaceSecondary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  
  // Icon container
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  
  // Section header
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.lg,
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.light.divider,
  },
});

// Theme helper function
export const getTheme = (isDark: boolean) => ({
  background: isDark ? colors.dark.background : colors.light.background,
  surface: isDark ? colors.dark.surface : colors.light.surface,
  surfaceSecondary: isDark ? colors.dark.surfaceSecondary : colors.light.surfaceSecondary,
  text: isDark ? colors.dark.text : colors.light.text,
  textSecondary: isDark ? colors.dark.textSecondary : colors.light.textSecondary,
  textTertiary: isDark ? colors.dark.textTertiary : colors.light.textTertiary,
  border: isDark ? colors.dark.border : colors.light.border,
  borderLight: isDark ? colors.dark.borderLight : colors.light.borderLight,
  divider: isDark ? colors.dark.divider : colors.light.divider,
  inputBg: isDark ? colors.dark.surfaceSecondary : colors.light.surfaceSecondary,
  primary: colors.primary,
  primaryLight: colors.primaryLight,
  primaryBg: colors.primaryBg,
  success: colors.success,
  successBg: colors.successBg,
  error: colors.error,
  errorBg: colors.errorBg,
});
