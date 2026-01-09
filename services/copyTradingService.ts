import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface CopyTradingAccount {
  id: number;
  userId: number;
  name: string;
  type: 'master' | 'child';
  broker: string;
  apiKey?: string;
  secretKey?: string;
  masterAccountId?: number;
  masterAccount?: CopyTradingAccount;
  childAccounts?: CopyTradingAccount[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CopyTradingStats {
  totalAccounts: number;
  masterAccounts: number;
  childAccounts: number;
  activeAccounts: number;
  totalPnl: number;
  totalTrades: number;
}

export interface CreateCopyTradingAccountData {
  name: string;
  type: 'master' | 'child';
  broker: string;
  apiKey: string;
  secretKey: string;
  masterAccountId?: number;
}

export interface UpdateCopyTradingAccountData {
  name?: string;
  apiKey?: string;
  secretKey?: string;
  masterAccountId?: number;
}

export const copyTradingService = {
  // Get all copy trading accounts
  async getAccounts(): Promise<ApiResponse<CopyTradingAccount[]>> {
    return await api.get<CopyTradingAccount[]>(ENDPOINTS.COPY_TRADING.LIST);
  },

  // Get copy trading statistics
  async getStatistics(): Promise<ApiResponse<CopyTradingStats>> {
    return await api.get<CopyTradingStats>(ENDPOINTS.COPY_TRADING.STATISTICS);
  },

  // Get account by ID
  async getAccountById(id: number): Promise<ApiResponse<CopyTradingAccount>> {
    return await api.get<CopyTradingAccount>(ENDPOINTS.COPY_TRADING.BY_ID(id));
  },

  // Create copy trading account
  async createAccount(data: CreateCopyTradingAccountData): Promise<ApiResponse<CopyTradingAccount>> {
    return await api.post<CopyTradingAccount>(ENDPOINTS.COPY_TRADING.LIST, data);
  },

  // Update copy trading account
  async updateAccount(id: number, data: UpdateCopyTradingAccountData): Promise<ApiResponse<CopyTradingAccount>> {
    return await api.put<CopyTradingAccount>(ENDPOINTS.COPY_TRADING.BY_ID(id), data);
  },

  // Delete copy trading account
  async deleteAccount(id: number): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.COPY_TRADING.BY_ID(id));
  },

  // Test API connection
  async testConnection(id: number): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return await api.post(ENDPOINTS.COPY_TRADING.TEST(id));
  },

  // Toggle account status
  async toggleStatus(id: number): Promise<ApiResponse<CopyTradingAccount>> {
    return await api.patch<CopyTradingAccount>(ENDPOINTS.COPY_TRADING.TOGGLE(id));
  },
};

export default copyTradingService;
