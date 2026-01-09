import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface Trade {
  id: number;
  userId: number;
  orderId: string;
  market: 'Forex' | 'Crypto' | 'Indian';
  symbol: string;
  type: 'Buy' | 'Sell';
  amount: number;
  price: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
  status: 'Completed' | 'Pending' | 'Failed' | 'Closed' | 'Open';
  date: string;
  broker: string;
  strategyId?: number;
  strategyName?: string;
  signalReceivedAt?: string;
  signalPayload?: any;
  brokerResponseJson?: any;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  profitableTrades: number;
  unprofitableTrades: number;
  totalPnl: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
}

export interface TradeFilters {
  page?: number;
  limit?: number;
  status?: string;
  market?: string;
  symbol?: string;
  strategyId?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTradeData {
  market: 'Forex' | 'Crypto' | 'Indian';
  symbol: string;
  type: 'Buy' | 'Sell';
  amount: number;
  price?: number;
  strategyId?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export const tradeService = {
  // Get all trades with filters and pagination
  async getTrades(filters?: TradeFilters): Promise<ApiResponse<Trade[]>> {
    return await api.get<Trade[]>(ENDPOINTS.TRADES.LIST, filters);
  },

  // Get trade by ID
  async getTradeById(id: number): Promise<ApiResponse<Trade>> {
    return await api.get<Trade>(ENDPOINTS.TRADES.BY_ID(id));
  },

  // Get trade statistics
  async getTradeStats(): Promise<ApiResponse<TradeStats>> {
    return await api.get<TradeStats>(ENDPOINTS.TRADES.STATS);
  },

  // Create a new trade
  async createTrade(data: CreateTradeData): Promise<ApiResponse<Trade>> {
    return await api.post<Trade>(ENDPOINTS.TRADES.LIST, data);
  },

  // Update trade
  async updateTrade(id: number, data: Partial<Trade>): Promise<ApiResponse<Trade>> {
    return await api.put<Trade>(ENDPOINTS.TRADES.BY_ID(id), data);
  },

  // Delete trade
  async deleteTrade(id: number): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.TRADES.BY_ID(id));
  },
};

export default tradeService;
