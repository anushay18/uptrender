/**
 * MT5 Services Index
 * Central export point for all MT5 services
 */

export { default as MT5ConnectionManager, connectionManager } from './ConnectionManager.js';
export { default as TradeService, tradeService } from './TradeService.js';
export { default as MarketDataService, marketDataService } from './MarketDataService.js';
export { default as CalculationService } from './CalculationService.js';

export const MT5Services = {
  connectionManager: require('./ConnectionManager.js').connectionManager,
  tradeService: require('./TradeService.js').tradeService,
  marketDataService: require('./MarketDataService.js').marketDataService,
  CalculationService: require('./CalculationService.js').default,
};
