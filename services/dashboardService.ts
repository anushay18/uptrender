import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface DashboardStats {
  totalUsers?: number;
  totalStrategies?: number;
  totalTrades?: number;
  totalVolume?: number;
  platformPnl?: number;
}

export interface UserDashboard {
  stats: {
    totalTrades: number;
    openPositions: number;
    closedPositions: number;
    totalPnl: number;
    todayPnl: number;
    winRate: number;
  };
  wallet: {
    balance: number;
    currency: string;
  };
  recentTrades: any[];
  activeStrategies: any[];
  notifications: {
    unreadCount: number;
  };
}

export interface PlatformSettings {
  id?: number;
  platformName?: string;
  platformLogo?: string;
  supportEmail?: string;
  supportPhone?: string;
  address?: string;
  termsUrl?: string;
  privacyUrl?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    telegram?: string;
  };
}

export const dashboardService = {
  // Get platform stats (public)
  async getPlatformStats(): Promise<ApiResponse<DashboardStats>> {
    return await api.get<DashboardStats>(ENDPOINTS.DASHBOARD.STATS, undefined, { skipAuth: true });
  },

  // Get user dashboard
  async getUserDashboard(): Promise<ApiResponse<UserDashboard>> {
    return await api.get<UserDashboard>(ENDPOINTS.DASHBOARD.USER);
  },

  // Get admin dashboard
  async getAdminDashboard(): Promise<ApiResponse<any>> {
    return await api.get(ENDPOINTS.DASHBOARD.ADMIN);
  },

  // Get platform settings (public)
  async getPlatformSettings(): Promise<ApiResponse<PlatformSettings>> {
    return await api.get<PlatformSettings>(ENDPOINTS.PLATFORM.SETTINGS, undefined, { skipAuth: true });
  },
};

export default dashboardService;
