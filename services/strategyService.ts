import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface Strategy {
  id: number;
  userId: number;
  name: string;
  isActive: boolean;
  type: 'Private' | 'Public';
  madeBy: 'Admin' | 'User';
  segment: 'Forex' | 'Crypto' | 'Indian';
  capital: number;
  symbol: string;
  lots: number;
  isRunning: boolean;
  isPaused: boolean;
  tradeMode: 'paper' | 'live';
  isPublic: boolean;
  performance: number;
  description?: string;
  webhookSecret: string;
  webhookUrl?: string;
  price: number;
  perTradeCharge: number;
  perTradeChargeEnabled: boolean;
  marketRisk?: any;
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  stats?: StrategyStats;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgProfit: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  subscribers?: number;
}

export interface StrategySubscription {
  id: number;
  userId: number;
  strategyId: number;
  strategy?: Strategy;
  lots: number;
  isActive: boolean;
  isPaused: boolean;
  tradeMode: 'paper' | 'live';
  subscribedAt: string;
  expiryDate?: string;
  brokers?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface StrategyFilters {
  page?: number;
  limit?: number;
  segment?: string;
  type?: string;
  isActive?: boolean;
  isPublic?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateStrategyData {
  name: string;
  segment: 'Forex' | 'Crypto' | 'Indian';
  symbol: string;
  capital: number;
  lots?: number;
  type?: 'Private' | 'Public';
  description?: string;
  price?: number;
  perTradeCharge?: number;
}

export interface SubscribeData {
  lots: number;
  tradeMode?: 'paper' | 'live';
  brokerIds?: number[];
}

export interface BacktestParams {
  strategyCode: string;
  symbol: string;
  startDate: string;
  endDate: string;
  capital: number;
}

export interface BacktestResult {
  trades: any[];
  stats: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  equityCurve: Array<{ date: string; equity: number }>;
}

export const strategyService = {
  // Get user's strategies
  async getStrategies(filters?: StrategyFilters): Promise<ApiResponse<Strategy[]>> {
    return await api.get<Strategy[]>(ENDPOINTS.STRATEGIES.LIST, filters);
  },

  // Get marketplace strategies
  async getMarketplaceStrategies(filters?: StrategyFilters): Promise<ApiResponse<Strategy[]>> {
    return await api.get<Strategy[]>(ENDPOINTS.STRATEGIES.MARKETPLACE, filters);
  },

  // Get strategy by ID
  async getStrategyById(id: number): Promise<ApiResponse<Strategy>> {
    return await api.get<Strategy>(ENDPOINTS.STRATEGIES.BY_ID(id));
  },

  // Get strategy public stats
  async getStrategyStats(id: number): Promise<ApiResponse<StrategyStats>> {
    return await api.get<StrategyStats>(ENDPOINTS.STRATEGIES.STATS(id));
  },

  // Create strategy
  async createStrategy(data: CreateStrategyData): Promise<ApiResponse<Strategy>> {
    return await api.post<Strategy>(ENDPOINTS.STRATEGIES.LIST, data);
  },

  // Update strategy
  async updateStrategy(id: number, data: Partial<Strategy>): Promise<ApiResponse<Strategy>> {
    return await api.put<Strategy>(ENDPOINTS.STRATEGIES.BY_ID(id), data);
  },

  // Delete strategy
  async deleteStrategy(id: number): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.STRATEGIES.BY_ID(id));
  },

  // Toggle running state
  async toggleRunning(id: number): Promise<ApiResponse<Strategy>> {
    return await api.post<Strategy>(ENDPOINTS.STRATEGIES.TOGGLE_RUNNING(id));
  },

  // Toggle favorite
  async toggleFavorite(id: number): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.STRATEGIES.TOGGLE_FAVORITE(id));
  },

  // Start strategy
  async startStrategy(id: number): Promise<ApiResponse<Strategy>> {
    return await api.post<Strategy>(ENDPOINTS.STRATEGIES.START(id));
  },

  // Stop strategy
  async stopStrategy(id: number): Promise<ApiResponse<Strategy>> {
    return await api.post<Strategy>(ENDPOINTS.STRATEGIES.STOP(id));
  },

  // Activate strategy
  async activateStrategy(id: number): Promise<ApiResponse<Strategy>> {
    return await api.post<Strategy>(ENDPOINTS.STRATEGIES.ACTIVATE(id));
  },

  // Deactivate strategy
  async deactivateStrategy(id: number): Promise<ApiResponse<Strategy>> {
    return await api.post<Strategy>(ENDPOINTS.STRATEGIES.DEACTIVATE(id));
  },

  // Get user's drafts
  async getDrafts(): Promise<ApiResponse<any[]>> {
    return await api.get(ENDPOINTS.STRATEGIES.DRAFTS);
  },

  // Save draft
  async saveDraft(data: any): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.STRATEGIES.SAVE_DRAFT, data);
  },

  // Validate strategy code
  async validateCode(code: string): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.STRATEGIES.VALIDATE, { code });
  },

  // Generate strategy code with AI
  async generateCode(prompt: string, params?: any): Promise<ApiResponse<{ code: string }>> {
    return await api.post(ENDPOINTS.STRATEGIES.GENERATE_CODE, { prompt, ...params });
  },

  // Run backtest
  async runBacktest(params: BacktestParams): Promise<ApiResponse<BacktestResult>> {
    return await api.post<BacktestResult>(ENDPOINTS.STRATEGIES.BACKTEST, params);
  },

  // Deploy strategy
  async deployStrategy(data: any): Promise<ApiResponse<Strategy>> {
    return await api.post<Strategy>(ENDPOINTS.STRATEGIES.DEPLOY, data);
  },

  // === Subscription Methods ===
  
  // Get user's subscriptions
  async getSubscriptions(): Promise<ApiResponse<StrategySubscription[]>> {
    return await api.get<StrategySubscription[]>(ENDPOINTS.SUBSCRIPTIONS.LIST);
  },

  // Get subscription by ID
  async getSubscriptionById(id: number): Promise<ApiResponse<StrategySubscription>> {
    return await api.get<StrategySubscription>(ENDPOINTS.SUBSCRIPTIONS.BY_ID(id));
  },

  // Subscribe to strategy
  async subscribe(strategyId: number, data: SubscribeData): Promise<ApiResponse<StrategySubscription>> {
    return await api.post<StrategySubscription>(ENDPOINTS.SUBSCRIPTIONS.SUBSCRIBE, { strategyId, ...data });
  },

  // Unsubscribe from strategy
  async unsubscribe(subscriptionId: number): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.SUBSCRIPTIONS.UNSUBSCRIBE(subscriptionId));
  },

  // Renew subscription
  async renewSubscription(subscriptionId: number): Promise<ApiResponse<StrategySubscription>> {
    return await api.post<StrategySubscription>(ENDPOINTS.SUBSCRIPTIONS.RENEW(subscriptionId));
  },

  // Pause/Resume subscription
  async toggleSubscriptionPause(subscriptionId: number): Promise<ApiResponse<StrategySubscription>> {
    return await api.put<StrategySubscription>(ENDPOINTS.SUBSCRIPTIONS.PAUSE(subscriptionId));
  },

  // Set trade mode (paper/live)
  async setTradeMode(subscriptionId: number, mode: 'paper' | 'live'): Promise<ApiResponse<StrategySubscription>> {
    return await api.put<StrategySubscription>(ENDPOINTS.SUBSCRIPTIONS.SET_MODE(subscriptionId), { tradeMode: mode });
  },

  // Get subscription brokers
  async getSubscriptionBrokers(subscriptionId: number): Promise<ApiResponse<any[]>> {
    return await api.get(ENDPOINTS.SUBSCRIPTIONS.BROKERS(subscriptionId));
  },

  // Update subscription brokers
  async updateSubscriptionBrokers(subscriptionId: number, brokerIds: number[]): Promise<ApiResponse> {
    return await api.put(ENDPOINTS.SUBSCRIPTIONS.BROKERS(subscriptionId), { brokerIds });
  },

  // Update subscription
  async updateSubscription(subscriptionId: number, data: Partial<StrategySubscription>): Promise<ApiResponse<StrategySubscription>> {
    return await api.put<StrategySubscription>(ENDPOINTS.SUBSCRIPTIONS.UPDATE(subscriptionId), data);
  },

  // Check open positions for subscription
  async checkOpenPositions(subscriptionId: number): Promise<ApiResponse<{ hasOpenPositions: boolean; count: number }>> {
    return await api.get(ENDPOINTS.SUBSCRIPTIONS.CHECK_POSITIONS(subscriptionId));
  },
};

export default strategyService;
