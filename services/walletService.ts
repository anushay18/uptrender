import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface Wallet {
  id: number;
  userId: number;
  balance: number;
  currency: string;
  status: 'Active' | 'Frozen' | 'Closed';
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: number;
  walletId: number;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference?: string;
  balanceAfter: number;
  status: 'pending' | 'completed' | 'rejected' | 'failed';
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalCredits: number;
  totalDebits: number;
  currentBalance: number;
  pendingTransactions: number;
}

export interface AddFundsData {
  amount: number;
  paymentMethod: string;
  transactionId?: string;
}

export interface WithdrawData {
  amount: number;
  paymentMethod: string;
  accountDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    walletAddress?: string;
  };
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: 'credit' | 'debit';
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const walletService = {
  // Get user wallet
  async getWallet(): Promise<ApiResponse<Wallet>> {
    return await api.get<Wallet>(ENDPOINTS.WALLET.GET);
  },

  // Get wallet transactions
  async getTransactions(filters?: TransactionFilters): Promise<ApiResponse<WalletTransaction[]>> {
    return await api.get<WalletTransaction[]>(ENDPOINTS.WALLET.TRANSACTIONS, filters);
  },

  // Get wallet statistics
  async getStats(): Promise<ApiResponse<WalletStats>> {
    return await api.get<WalletStats>(ENDPOINTS.WALLET.STATS);
  },

  // Add funds to wallet
  async addFunds(data: AddFundsData): Promise<ApiResponse<WalletTransaction>> {
    return await api.post<WalletTransaction>(ENDPOINTS.WALLET.ADD_FUNDS, data);
  },

  // Withdraw funds from wallet
  async withdraw(data: WithdrawData): Promise<ApiResponse<WalletTransaction>> {
    return await api.post<WalletTransaction>(ENDPOINTS.WALLET.WITHDRAW, data);
  },
};

export default walletService;
