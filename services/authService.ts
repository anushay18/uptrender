import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiResponse } from './api';
import { ENDPOINTS, STORAGE_KEYS } from './config';
import { wsService } from './websocket';

// Storage helpers
const secureStorage = {
  getItem: async (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: async (key: string) => AsyncStorage.removeItem(key),
};
const storage = secureStorage;

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role: 'admin' | 'user';
  status: 'Active' | 'Inactive';
  currency: string;
  avatar?: string;
  emailVerified: 'Yes' | 'No';
  phoneVerified: 'Yes' | 'No';
  referralCode?: string;
  referralLink?: string;
  referredBy?: string;
  clientId?: string;
  clientType?: 'Individual' | 'Organization';
  organizationName?: string;
  kycStatus?: 'Verified' | 'Pending' | 'Rejected';
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  panNumber?: string;
  gstNumber?: string;
  taxId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
  referralCode?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: User;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<any>(
      ENDPOINTS.AUTH.LOGIN, 
      credentials,
      { skipAuth: true }
    );

    // Backend returns { message, token, refreshToken, user } directly on success
    // Or { error: "message" } on failure
    // API wrapper may return { success, data, error } or raw response
    
    const data = response.data || response;
    const token = data.accessToken || data.token;
    const refreshToken = data.refreshToken;
    const user = data.user;
    
    // Check if login was successful (has token and user)
    if ((token || user) && !response.error && !data.error) {
      if (token) {
        await secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      }
      if (refreshToken) {
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      if (user) {
        await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
      
      // Connect WebSocket after successful login
      wsService.connect();
      
      return {
        success: true,
        user: user,
        accessToken: token,
        refreshToken: refreshToken,
        message: data.message || 'Login successful'
      };
    }

    return {
      success: false,
      error: response.error || data.error || 'Login failed',
    };
  },

  async register(registerData: RegisterData): Promise<AuthResponse> {
    const response = await api.post<any>(
      ENDPOINTS.AUTH.REGISTER,
      registerData,
      { skipAuth: true }
    );

    // Backend returns { message, token, refreshToken, user } directly on success
    // Or { error: "message" } on failure
    const data = response.data || response;
    const token = data.accessToken || data.token;
    const refreshToken = data.refreshToken;
    const user = data.user;
    
    // Check if registration was successful (has token and user)
    if ((token || user) && !response.error && !data.error) {
      if (token) {
        await secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      }
      if (refreshToken) {
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      if (user) {
        await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
      
      // Connect WebSocket after successful registration
      wsService.connect();
      
      return {
        success: true,
        user: user,
        accessToken: token,
        refreshToken: refreshToken,
        message: data.message || 'Registration successful'
      };
    }

    return {
      success: false,
      error: response.error || data.error || data.errors?.[0]?.msg || 'Registration failed',
    };
  },

  async logout(): Promise<void> {
    try {
      // Call logout API
      await api.post(ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error('Logout API error:', error);
    }
    
    // Disconnect WebSocket
    wsService.disconnect();
    
    // Clear all stored data
    await secureStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    await storage.removeItem(STORAGE_KEYS.USER);
  },

  async getStoredUser(): Promise<User | null> {
    const userStr = await storage.getItem(STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    return !!token;
  },

  async getProfile(): Promise<ApiResponse<User>> {
    const response = await api.get<User>(ENDPOINTS.USER.PROFILE);
    
    if (response.success && response.data) {
      await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data));
    }
    
    return response;
  },

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await api.put<User>(ENDPOINTS.USER.PROFILE, data);
    
    if (response.success && response.data) {
      await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data));
    }
    
    return response;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return await api.put(ENDPOINTS.USER.CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    });
  },

  async getWebhookSecret(): Promise<ApiResponse<{ webhookSecret: string }>> {
    return await api.get(ENDPOINTS.USER.WEBHOOK_SECRET);
  },

  async regenerateWebhookSecret(): Promise<ApiResponse<{ webhookSecret: string }>> {
    return await api.post('/users/webhook-secret/regenerate');
  },
};

export default authService;
