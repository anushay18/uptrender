import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface PaperPosition {
  id: number;
  userId: number;
  strategyId?: number;
  strategyName?: string;
  strategy?: {
    id: number;
    name: string;
  };
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
  createdAt: string;
  updatedAt: string;
}

export interface PaperPositionStats {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
}

export interface OpenPositionData {
  symbol: string;
  market: 'Forex' | 'Crypto' | 'Indian';
  type: 'Buy' | 'Sell';
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  strategyId?: number;
}

export interface ModifyPositionData {
  stopLoss?: number;
  takeProfit?: number;
}

export interface PositionFilters {
  page?: number;
  limit?: number;
  status?: string;
  market?: string;
  symbol?: string;
  strategyId?: number;
  startDate?: string;
  endDate?: string;
}

export const paperPositionService = {
  // Get open positions
  async getOpenPositions(filters?: PositionFilters): Promise<ApiResponse<PaperPosition[]>> {
    return await api.get<PaperPosition[]>(ENDPOINTS.PAPER_POSITIONS.LIST, filters);
  },

  // Get position history
  async getPositionHistory(filters?: PositionFilters): Promise<ApiResponse<PaperPosition[]>> {
    return await api.get<PaperPosition[]>(ENDPOINTS.PAPER_POSITIONS.HISTORY, filters);
  },

  // Get position statistics
  async getStats(): Promise<ApiResponse<PaperPositionStats>> {
    return await api.get<PaperPositionStats>(ENDPOINTS.PAPER_POSITIONS.STATS);
  },

  // Open new position
  async openPosition(data: OpenPositionData): Promise<ApiResponse<PaperPosition>> {
    return await api.post<PaperPosition>(ENDPOINTS.PAPER_POSITIONS.OPEN, data);
  },

  // Close specific position
  async closePosition(id: number, price?: number): Promise<ApiResponse<PaperPosition>> {
    return await api.post<PaperPosition>(ENDPOINTS.PAPER_POSITIONS.CLOSE(id), { price });
  },

  // Close all positions for a strategy
  async closeAllPositions(strategyId: number): Promise<ApiResponse<{ closed: number }>> {
    return await api.post(ENDPOINTS.PAPER_POSITIONS.CLOSE_ALL(strategyId));
  },

  // Modify position (SL/TP)
  async modifyPosition(id: number, data: ModifyPositionData): Promise<ApiResponse<PaperPosition>> {
    return await api.put<PaperPosition>(ENDPOINTS.PAPER_POSITIONS.MODIFY(id), data);
  },

  // Get position by ID (searches history since backend doesn't expose GET /paper-positions/:id)
  async getPositionById(id: number): Promise<ApiResponse<PaperPosition>> {
    const res = await api.get<PaperPosition[]>(ENDPOINTS.PAPER_POSITIONS.HISTORY, { limit: 200 });
    if (!res || !res.success || !res.data) {
      return { success: false, error: res?.error || 'Failed to fetch paper positions', data: null } as any;
    }
    const found = (res.data || []).find((p: any) => Number(p.id) === Number(id) || String(p.orderId) === String(id));
    if (found) {
      return { success: true, data: found } as any;
    }
    return { success: false, error: 'Position not found', data: null } as any;
  },
};

export default paperPositionService;
