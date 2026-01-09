/**
 * AlgoEngine - Main Entry Point
 * Centralized module for all trading operations
 */

import { mt5Broker } from './brokers/mt5/index.js';
import { logger } from './utils/logger.js';

/**
 * Initialize AlgoEngine with specific broker
 * @param {Object} config - Configuration object
 * @param {string} config.broker - Broker name ('mt5', 'zerodha', 'binance')
 * @param {Object} config.credentials - Broker credentials
 * @returns {Promise<Object>} Broker instance
 */
export async function initializeAlgoEngine(config) {
  try {
    logger.info(`Initializing AlgoEngine with broker: ${config.broker}`);

    switch (config.broker.toLowerCase()) {
      case 'mt5':
        await mt5Broker.initialize(config.credentials);
        logger.info('✓ MT5 broker initialized');
        return mt5Broker;

      case 'zerodha':
        logger.warn('Zerodha integration coming soon');
        throw new Error('Zerodha not yet implemented');

      case 'binance':
        logger.warn('Binance integration coming soon');
        throw new Error('Binance not yet implemented');

      default:
        throw new Error(`Unknown broker: ${config.broker}`);
    }
  } catch (error) {
    logger.error(`Failed to initialize AlgoEngine: ${error.message}`);
    throw error;
  }
}

/**
 * Get broker instance by name
 * @param {string} brokerName - Broker name
 * @returns {Object} Broker instance
 */
export function getBroker(brokerName) {
  switch (brokerName.toLowerCase()) {
    case 'mt5':
      return mt5Broker;
    default:
      throw new Error(`Unknown broker: ${brokerName}`);
  }
}

/**
 * List available brokers
 * @returns {Array<string>} Available brokers
 */
export function getAvailableBrokers() {
  return [
    { name: 'mt5', status: 'production' },
    { name: 'zerodha', status: 'coming-soon' },
    { name: 'binance', status: 'coming-soon' },
    { name: 'deriv', status: 'planned' },
  ];
}

/**
 * Health check for AlgoEngine
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  try {
    const mt5Health = await mt5Broker.healthCheck();

    return {
      status: mt5Health ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      brokers: {
        mt5: mt5Health ? 'connected' : 'disconnected',
      },
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Shutdown AlgoEngine gracefully
 * @returns {Promise<void>}
 */
export async function shutdown() {
  try {
    logger.info('Shutting down AlgoEngine...');

    // Disconnect all brokers
    if (mt5Broker.isInitialized) {
      await mt5Broker.disconnect();
    }

    logger.info('✓ AlgoEngine shutdown complete');
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    throw error;
  }
}

// Export all brokers and services
export { mt5Broker };
export { logger };

export default {
  initializeAlgoEngine,
  getBroker,
  getAvailableBrokers,
  healthCheck,
  shutdown,
  mt5Broker,
  logger,
};
