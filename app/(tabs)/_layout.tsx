import { colors, getTheme } from '@/constants/styles';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Tabs, useRouter } from 'expo-router';
import { Compass, Copy, House, Stack, User } from 'phosphor-react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const theme = getTheme(isDark);
  const insets = useSafeAreaInsets();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Don't render tabs if not authenticated
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          // Add extra height on Android to account for system navigation inset
          height: Platform.OS === 'android' ? 64 + insets.bottom : 80,
          paddingBottom: Platform.OS === 'android' ? 12 + insets.bottom : 28,
          paddingTop: Platform.OS === 'android' ? 8 : 12,
          paddingHorizontal: 8,
          // Add elevation for Android to ensure it's above navigation bar
          elevation: Platform.OS === 'android' ? 8 : 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarItemStyle: {
          gap: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <House 
              size={24} 
              color={color} 
              weight={focused ? 'fill' : 'regular'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Wizard',
          tabBarIcon: ({ color, focused }) => (
            <Compass 
              size={24} 
              color={color} 
              weight={focused ? 'fill' : 'regular'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="strategies"
        options={{
          title: 'Strategy',
          tabBarIcon: ({ color, focused }) => (
            <Stack 
              size={24} 
              color={color} 
              weight={focused ? 'fill' : 'regular'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Copy Trading',
          tabBarIcon: ({ color, focused }) => (
            <Copy 
              size={24} 
              color={color} 
              weight={focused ? 'fill' : 'regular'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <User 
              size={24} 
              color={color} 
              weight={focused ? 'fill' : 'regular'} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
