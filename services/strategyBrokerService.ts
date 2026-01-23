import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface StrategyBroker {
  id: number;
  strategyBrokerId: number;
  apiKeyId: number;
  isActive: boolean;
  broker: string;
  apiName: string;
  segment: string;
  status: string;
  brokerId: string;
  createdAt: string;
}

export const strategyBrokerService = {
  // Get all brokers linked to a strategy
  async getStrategyBrokers(strategyId: number): Promise<ApiResponse<StrategyBroker[]>> {
    return await api.get<StrategyBroker[]>(ENDPOINTS.STRATEGY_BROKERS.LIST(strategyId));
  },

  // Add a single broker to strategy
  async addBrokerToStrategy(strategyId: number, apiKeyId: number): Promise<ApiResponse<StrategyBroker>> {
    return await api.post<StrategyBroker>(ENDPOINTS.STRATEGY_BROKERS.ADD(strategyId), { apiKeyId });
  },

  // Add multiple brokers to strategy (bulk update)
  async updateStrategyBrokers(strategyId: number, apiKeyIds: number[]): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.STRATEGY_BROKERS.BULK_ADD(strategyId), { apiKeyIds });
  },

  // Remove a broker from strategy
  async removeBrokerFromStrategy(strategyId: number, strategyBrokerId: number): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.STRATEGY_BROKERS.REMOVE(strategyId, strategyBrokerId));
  },

  // Toggle broker active status for strategy
  async toggleBrokerStatus(strategyId: number, strategyBrokerId: number): Promise<ApiResponse> {
    return await api.put(ENDPOINTS.STRATEGY_BROKERS.TOGGLE(strategyId, strategyBrokerId));
  },
};

export default strategyBrokerService;
