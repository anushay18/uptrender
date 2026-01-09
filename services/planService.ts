import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface Plan {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration: number;
  durationType: 'days' | 'months' | 'years';
  walletBalance?: number;
  features?: string[];
  isPopular: boolean;
  isActive: boolean;
  planType: 'basic' | 'professional' | 'enterprise';
  maxStrategies?: number;
  maxTrades?: number;
  apiAccess: boolean;
  priority?: 'low' | 'standard' | 'high' | 'urgent';
  subscribers?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserPlan {
  id: number;
  userId: number;
  planId?: number;
  plan?: Plan;
  name: string;
  type: 'Monthly' | 'Yearly';
  price: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

export const planService = {
  // Get available plans (public)
  async getAvailablePlans(): Promise<ApiResponse<Plan[]>> {
    return await api.get<Plan[]>(ENDPOINTS.PLANS.AVAILABLE, undefined, { skipAuth: true });
  },

  // Get plan catalog
  async getPlanCatalog(): Promise<ApiResponse<Plan[]>> {
    return await api.get<Plan[]>(ENDPOINTS.PLANS.CATALOG, undefined, { skipAuth: true });
  },

  // Get user's current plan
  async getMyPlan(): Promise<ApiResponse<UserPlan>> {
    return await api.get<UserPlan>(ENDPOINTS.PLANS.MY_PLAN);
  },

  // Get current plan (alias)
  async getCurrentPlan(): Promise<ApiResponse<UserPlan>> {
    return await api.get<UserPlan>(ENDPOINTS.PLANS.CURRENT);
  },

  // Subscribe to a plan
  async subscribeToPlan(planId: number): Promise<ApiResponse<UserPlan>> {
    return await api.post<UserPlan>(ENDPOINTS.PLANS.SUBSCRIBE(planId));
  },

  // Cancel plan
  async cancelPlan(): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.PLANS.CANCEL);
  },

  // Toggle auto-renew
  async toggleAutoRenew(): Promise<ApiResponse<UserPlan>> {
    return await api.post<UserPlan>(ENDPOINTS.PLANS.TOGGLE_AUTO_RENEW);
  },
};

export default planService;
