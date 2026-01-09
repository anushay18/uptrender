import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface Position {
  id: number;
  orderId: string;
  symbol: string;
  market: 'Forex' | 'Crypto' | 'Indian';
  type: 'Buy' | 'Sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  profitPercent: number;
  status: 'Open' | 'Closed' | 'SL_Hit' | 'TP_Hit';
  openTime: string;
  closeTime?: string;
  closePrice?: number;
  realizedProfit?: number;
  strategyId?: number;
  strategyName?: string;
  broker?: string;
}

export interface ExecuteTradeData {
  strategyId: number;
  symbol: string;
  action: 'buy' | 'sell';
  quantity?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ManualTradeData {
  apiKeyId: number;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit';
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  timestamp: number;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
}

export const algoTradeService = {
  // Execute strategy trade
  async executeStrategyTrade(data: ExecuteTradeData): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.ALGO_TRADES.EXECUTE, data);
  },

  // Execute manual trade
  async executeManualTrade(data: ManualTradeData): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.ALGO_TRADES.MANUAL, data);
  },

  // Get open positions
  async getPositions(): Promise<ApiResponse<Position[]>> {
    return await api.get<Position[]>(ENDPOINTS.ALGO_TRADES.POSITIONS);
  },

  // Close position
  async closePosition(positionId: number): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.ALGO_TRADES.CLOSE(positionId));
  },

  // Get symbol price
  async getPrice(symbol: string): Promise<ApiResponse<PriceData>> {
    return await api.get<PriceData>(ENDPOINTS.ALGO_TRADES.PRICE(symbol));
  },

  // Get multiple symbol prices
  async getPrices(symbols: string[]): Promise<ApiResponse<PriceData[]>> {
    return await api.post<PriceData[]>(ENDPOINTS.ALGO_TRADES.PRICES, { symbols });
  },

  // Get MT5 account info
  async getAccountInfo(): Promise<ApiResponse<AccountInfo>> {
    return await api.get<AccountInfo>(ENDPOINTS.ALGO_TRADES.ACCOUNT);
  },
};

export default algoTradeService;
