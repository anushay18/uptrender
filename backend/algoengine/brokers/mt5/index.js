/**
 * MT5 Broker Integration Module
 * Main entry point for MT5 trading operations
 */

import { logger } from '../../utils/logger.js';
import { connectionManager } from './services/ConnectionManager.js';
import { tradeService } from './services/TradeService.js';
import { marketDataService } from './services/MarketDataService.js';
import { MT5_CONFIG } from './config/metaapi.config.js';

class MT5Broker {
  constructor() {
    this.isInitialized = false;
    this.config = MT5_CONFIG;
  }

  /**
   * Initialize MT5 broker connection
   * @param {Object} credentials - { apiKey, accountId }
   * @returns {Promise<void>}
   */
  async initialize(credentials) {
    try {
      if (!credentials || !credentials.apiKey || !credentials.accountId) {
        throw new Error('MetaAPI credentials required: apiKey and accountId');
      }

      logger.info('Initializing MT5 Broker...');

      // Initialize connection manager
      await connectionManager.initialize(credentials.apiKey);

      // Connect to account
      await connectionManager.connect(credentials.accountId);

      this.isInitialized = true;

      logger.info('✓ MT5 Broker initialized successfully');

      // Get and log account info
      const accountInfo = await this.getAccountInfo();
      logger.info(`Account: ${accountInfo.broker} | Balance: ${accountInfo.balance} | Leverage: ${accountInfo.leverage}x`);
    } catch (error) {
      logger.error(`MT5 Broker initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Place a trade
   * @param {Object} tradeParams - Trade parameters
   * @returns {Promise<Object>} Trade result
   */
  async placeTrade(tradeParams) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return tradeService.placeTrade(tradeParams);
  }

  /**
   * Place multiple trades in batch
   * @param {Array<Object>} tradeList - List of trade parameters
   * @returns {Promise<Array<Object>>} Batch results
   */
  async placeBatchTrades(tradeList) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return tradeService.placeBatchTrades(tradeList);
  }

  /**
   * Close a trade
   * @param {string|number} orderId - Order ID
   * @returns {Promise<Object>} Close result
   */
  async closeTrade(orderId) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return tradeService.closeTrade(orderId);
  }

  /**
   * Modify trade (SL/TP)
   * @param {string|number} orderId - Order ID
   * @param {Object} modifications - Modifications { stopLoss?, takeProfit? }
   * @returns {Promise<Object>} Modification result
   */
  async modifyTrade(orderId, modifications) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return tradeService.modifyTrade(orderId, modifications);
  }

  /**
   * Get open orders
   * @returns {Promise<Array<Object>>} Open orders
   */
  async getOpenOrders() {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return tradeService.getOpenOrders();
  }

  /**
   * Get trade history
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Trade history
   */
  async getTradeHistory(options = {}) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return tradeService.getTradeHistory(options);
  }

  /**
   * Get account information
   * @returns {Promise<Object>} Account info
   */
  async getAccountInfo() {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return connectionManager.getAccountInfo();
  }

  /**
   * Get current price
   * @param {string} symbol - Symbol
   * @returns {Promise<Object>} Price data
   */
  async getPrice(symbol) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return marketDataService.getCurrentPrice(symbol);
  }

  /**
   * Get candle data
   * @param {string} symbol - Symbol
   * @param {string} timeframe - Timeframe
   * @param {number} count - Number of candles
   * @returns {Promise<Array<Object>>} Candles
   */
  async getCandles(symbol, timeframe = 'H1', count = 100) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return marketDataService.getCandles(symbol, timeframe, count);
  }

  /**
   * Subscribe to price updates
   * @param {string} symbol - Symbol
   * @param {Function} callback - Callback function
   * @returns {string} Subscription ID
   */
  subscribeToPrices(symbol, callback) {
    if (!this.isInitialized) {
      throw new Error('MT5 Broker not initialized');
    }

    return marketDataService.subscribeToPrices(symbol, callback);
  }

  /**
   * Unsubscribe from price updates
   * @param {string} subscriptionId - Subscription ID
   */
  unsubscribeFromPrices(subscriptionId) {
    marketDataService.unsubscribeFromPrices(subscriptionId);
  }

  /**
   * Disconnect from MT5
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      // Unsubscribe all
      for (const [id] of marketDataService.subscriptions) {
        marketDataService.unsubscribeFromPrices(id);
      }

      // Disconnect connection manager
      await connectionManager.disconnect();

      this.isInitialized = false;

      logger.info('✓ MT5 Broker disconnected');
    } catch (error) {
      logger.error(`Error during disconnect: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get broker status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      connected: connectionManager.isConnectionActive(),
      subscriptions: marketDataService.subscriptions.size,
      cacheStats: marketDataService.getCacheStats(),
    };
  }

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return false;
      }

      await connectionManager.waitForConnection(5000);
      await this.getAccountInfo();

      return true;
    } catch (error) {
      logger.warn(`Health check failed: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance
export const mt5Broker = new MT5Broker();
export default MT5Broker;
