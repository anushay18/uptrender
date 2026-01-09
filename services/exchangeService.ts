import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface Exchange {
  id: string;
  name: string;
  logo?: string;
  countries?: string[];
  urls?: {
    www?: string;
    api?: string;
    doc?: string;
  };
  has?: {
    spot?: boolean;
    margin?: boolean;
    future?: boolean;
    swap?: boolean;
  };
  timeframes?: string[];
  requiresPassphrase?: boolean;
}

export interface Symbol {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  type?: string;
  active: boolean;
  precision?: {
    amount: number;
    price: number;
  };
  limits?: {
    amount?: { min: number; max: number };
    price?: { min: number; max: number };
    cost?: { min: number; max: number };
  };
}

export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  percentage: number;
  timestamp: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Balance {
  currency: string;
  free: number;
  used: number;
  total: number;
}

export interface Order {
  id: string;
  symbol: string;
  type: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  filled: number;
  remaining: number;
  cost: number;
  status: string;
  timestamp: number;
}

export interface PositionData {
  symbol: string;
  side: 'long' | 'short';
  contracts: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  marginType: string;
}

export const exchangeService = {
  // Get supported exchanges (100+)
  async getSupportedExchanges(): Promise<ApiResponse<Exchange[]>> {
    return await api.get<Exchange[]>(ENDPOINTS.EXCHANGES.SUPPORTED, undefined, { skipAuth: true });
  },

  // Get popular exchanges
  async getPopularExchanges(): Promise<ApiResponse<Exchange[]>> {
    return await api.get<Exchange[]>(ENDPOINTS.EXCHANGES.POPULAR, undefined, { skipAuth: true });
  },

  // Get exchange info
  async getExchangeInfo(exchangeId: string): Promise<ApiResponse<Exchange>> {
    return await api.get<Exchange>(ENDPOINTS.EXCHANGES.INFO(exchangeId), undefined, { skipAuth: true });
  },

  // Check if exchange requires passphrase
  async requiresPassphrase(exchangeId: string): Promise<ApiResponse<{ required: boolean }>> {
    return await api.get(ENDPOINTS.EXCHANGES.REQUIRES_PASSPHRASE(exchangeId), undefined, { skipAuth: true });
  },

  // Get trading symbols for exchange
  async getSymbols(exchangeId: string, type?: string): Promise<ApiResponse<Symbol[]>> {
    return await api.get<Symbol[]>(ENDPOINTS.EXCHANGES.SYMBOLS(exchangeId), { type }, { skipAuth: true });
  },

  // Get ticker data
  async getTicker(exchangeId: string, symbol: string): Promise<ApiResponse<Ticker>> {
    return await api.post<Ticker>(ENDPOINTS.EXCHANGES.TICKER, { exchangeId, symbol }, { skipAuth: true });
  },

  // Get OHLCV (candlestick) data
  async getOHLCV(
    exchangeId: string, 
    symbol: string, 
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<ApiResponse<OHLCV[]>> {
    return await api.post<OHLCV[]>(ENDPOINTS.EXCHANGES.OHLCV, {
      exchangeId,
      symbol,
      timeframe,
      limit,
    }, { skipAuth: true });
  },

  // Test API connection (requires API key)
  async testConnection(exchangeId: string, credentials: {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return await api.post(ENDPOINTS.EXCHANGES.TEST(exchangeId), credentials);
  },

  // Get account balance
  async getBalance(exchangeId: string, credentials: {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  }): Promise<ApiResponse<Balance[]>> {
    return await api.post<Balance[]>(ENDPOINTS.EXCHANGES.BALANCE(exchangeId), credentials);
  },

  // Create market order
  async createMarketOrder(exchangeId: string, data: {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
  }): Promise<ApiResponse<Order>> {
    return await api.post<Order>(ENDPOINTS.EXCHANGES.MARKET_ORDER(exchangeId), data);
  },

  // Create limit order
  async createLimitOrder(exchangeId: string, data: {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    price: number;
  }): Promise<ApiResponse<Order>> {
    return await api.post<Order>(ENDPOINTS.EXCHANGES.LIMIT_ORDER(exchangeId), data);
  },

  // Cancel order
  async cancelOrder(data: {
    exchangeId: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    orderId: string;
    symbol: string;
  }): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.EXCHANGES.CANCEL_ORDER, data);
  },

  // Get open orders
  async getOpenOrders(data: {
    exchangeId: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    symbol?: string;
  }): Promise<ApiResponse<Order[]>> {
    return await api.post<Order[]>(ENDPOINTS.EXCHANGES.OPEN_ORDERS, data);
  },

  // Get positions (for futures/derivatives)
  async getPositions(data: {
    exchangeId: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    symbol?: string;
  }): Promise<ApiResponse<PositionData[]>> {
    return await api.post<PositionData[]>(ENDPOINTS.EXCHANGES.POSITIONS, data);
  },
};

export default exchangeService;
