import exchangeService from '../services/exchangeService.js';
import ApiKey from '../models/ApiKey.js';

/**
 * Get list of all supported exchanges
 */
export const getSupportedExchanges = async (req, res) => {
  try {
    const exchanges = exchangeService.getSupportedExchanges();
    res.json({
      success: true,
      data: exchanges,
      count: exchanges.length,
    });
  } catch (error) {
    console.error('Get supported exchanges error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get list of popular/recommended exchanges
 */
export const getPopularExchanges = async (req, res) => {
  try {
    const exchanges = exchangeService.getPopularExchanges();
    res.json({
      success: true,
      data: exchanges,
    });
  } catch (error) {
    console.error('Get popular exchanges error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get exchange info and capabilities
 */
export const getExchangeInfo = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const info = exchangeService.getExchangeInfo(exchangeId);
    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    console.error('Get exchange info error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Check if an exchange requires passphrase
 */
export const checkPasswordRequired = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const required = exchangeService.isPasswordRequired(exchangeId);
    res.json({
      success: true,
      data: { requiresPassword: required },
    });
  } catch (error) {
    console.error('Check password required error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Fetch balance from user's exchange account
 */
export const fetchBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchangeId, apiKeyId, accountType } = req.body;

    // Get user's API key for this exchange
    let apiKey;
    if (apiKeyId) {
      apiKey = await ApiKey.findOne({
        where: { id: apiKeyId, userId },
      });
    } else {
      apiKey = await ApiKey.findOne({
        where: { userId, broker: exchangeId, status: 'Active' },
      });
    }

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found for this exchange',
      });
    }

    // Create exchange instance
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId || apiKey.broker,
      apiKey.apiKey,
      apiKey.apiSecret,
      apiKey.passphrase,
      { defaultType: accountType || 'spot' }
    );

    // Fetch balance
    const result = await exchangeService.fetchBalance(exchange);
    res.json(result);
  } catch (error) {
    console.error('Fetch balance error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Fetch ticker for a symbol
 */
export const fetchTicker = async (req, res) => {
  try {
    const { exchangeId, symbol } = req.body;

    // For public endpoint, create exchange without auth
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId,
      null,
      null,
      null
    );

    const result = await exchangeService.fetchTicker(exchange, symbol);
    res.json(result);
  } catch (error) {
    console.error('Fetch ticker error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Fetch OHLCV data
 */
export const fetchOHLCV = async (req, res) => {
  try {
    const { exchangeId, symbol, timeframe, limit } = req.body;

    // For public endpoint, create exchange without auth
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId,
      null,
      null,
      null
    );

    const result = await exchangeService.fetchOHLCV(exchange, symbol, timeframe, limit);
    res.json(result);
  } catch (error) {
    console.error('Fetch OHLCV error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get available symbols for an exchange
 */
export const getSymbols = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const { type } = req.query; // spot, future, swap

    const exchange = await exchangeService.getExchangeInstance(
      exchangeId,
      null,
      null,
      null,
      { defaultType: type || 'spot' }
    );

    const result = exchangeService.getSymbols(exchange);
    res.json(result);
  } catch (error) {
    console.error('Get symbols error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Create a market order
 */
export const createMarketOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchangeId, apiKeyId, symbol, side, amount, accountType, params } = req.body;

    // Validate input
    if (!symbol || !side || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, amount',
      });
    }

    // Get user's API key
    let apiKey;
    if (apiKeyId) {
      apiKey = await ApiKey.findOne({
        where: { id: apiKeyId, userId },
      });
    } else {
      apiKey = await ApiKey.findOne({
        where: { userId, broker: exchangeId, status: 'Active' },
      });
    }

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found for this exchange',
      });
    }

    // Create exchange instance
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId || apiKey.broker,
      apiKey.apiKey,
      apiKey.apiSecret,
      apiKey.passphrase,
      { defaultType: accountType || 'spot' }
    );

    // Create order
    const result = await exchangeService.createMarketOrder(
      exchange,
      symbol,
      side.toLowerCase(),
      parseFloat(amount),
      params || {}
    );

    res.json(result);
  } catch (error) {
    console.error('Create market order error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Create a limit order
 */
export const createLimitOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchangeId, apiKeyId, symbol, side, amount, price, accountType, params } = req.body;

    // Validate input
    if (!symbol || !side || !amount || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, amount, price',
      });
    }

    // Get user's API key
    let apiKey;
    if (apiKeyId) {
      apiKey = await ApiKey.findOne({
        where: { id: apiKeyId, userId },
      });
    } else {
      apiKey = await ApiKey.findOne({
        where: { userId, broker: exchangeId, status: 'Active' },
      });
    }

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found for this exchange',
      });
    }

    // Create exchange instance
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId || apiKey.broker,
      apiKey.apiKey,
      apiKey.apiSecret,
      apiKey.passphrase,
      { defaultType: accountType || 'spot' }
    );

    // Create order
    const result = await exchangeService.createLimitOrder(
      exchange,
      symbol,
      side.toLowerCase(),
      parseFloat(amount),
      parseFloat(price),
      params || {}
    );

    res.json(result);
  } catch (error) {
    console.error('Create limit order error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Cancel an order
 */
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchangeId, apiKeyId, orderId, symbol, accountType } = req.body;

    if (!orderId || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, symbol',
      });
    }

    // Get user's API key
    let apiKey;
    if (apiKeyId) {
      apiKey = await ApiKey.findOne({
        where: { id: apiKeyId, userId },
      });
    } else {
      apiKey = await ApiKey.findOne({
        where: { userId, broker: exchangeId, status: 'Active' },
      });
    }

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found for this exchange',
      });
    }

    // Create exchange instance
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId || apiKey.broker,
      apiKey.apiKey,
      apiKey.apiSecret,
      apiKey.passphrase,
      { defaultType: accountType || 'spot' }
    );

    // Cancel order
    const result = await exchangeService.cancelOrder(exchange, orderId, symbol);
    res.json(result);
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Fetch open orders
 */
export const fetchOpenOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchangeId, apiKeyId, symbol, accountType } = req.body;

    // Get user's API key
    let apiKey;
    if (apiKeyId) {
      apiKey = await ApiKey.findOne({
        where: { id: apiKeyId, userId },
      });
    } else {
      apiKey = await ApiKey.findOne({
        where: { userId, broker: exchangeId, status: 'Active' },
      });
    }

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found for this exchange',
      });
    }

    // Create exchange instance
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId || apiKey.broker,
      apiKey.apiKey,
      apiKey.apiSecret,
      apiKey.passphrase,
      { defaultType: accountType || 'spot' }
    );

    // Fetch open orders
    const result = await exchangeService.fetchOpenOrders(exchange, symbol);
    res.json(result);
  } catch (error) {
    console.error('Fetch open orders error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Fetch positions (futures/margin)
 */
export const fetchPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchangeId, apiKeyId, symbols, accountType } = req.body;

    // Get user's API key
    let apiKey;
    if (apiKeyId) {
      apiKey = await ApiKey.findOne({
        where: { id: apiKeyId, userId },
      });
    } else {
      apiKey = await ApiKey.findOne({
        where: { userId, broker: exchangeId, status: 'Active' },
      });
    }

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found for this exchange',
      });
    }

    // Create exchange instance
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId || apiKey.broker,
      apiKey.apiKey,
      apiKey.apiSecret,
      apiKey.passphrase,
      { defaultType: accountType || 'future' }
    );

    // Fetch positions
    const result = await exchangeService.fetchPositions(exchange, symbols);
    res.json(result);
  } catch (error) {
    console.error('Fetch positions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Test exchange connection with API keys
 */
export const testConnection = async (req, res) => {
  try {
    const { exchangeId, apiKey, apiSecret, passphrase, accountType } = req.body;

    if (!exchangeId || !apiKey || !apiSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: exchangeId, apiKey, apiSecret',
      });
    }

    // Trim whitespace from credentials
    const trimmedApiKey = apiKey.trim();
    const trimmedSecret = apiSecret.trim();
    const trimmedPassphrase = passphrase ? passphrase.trim() : null;

    console.log(`🔍 Test Connection for ${exchangeId}`);
    console.log(`📝 API Key length: ${trimmedApiKey.length}`);
    console.log(`📝 API Key first 10 chars: ${trimmedApiKey.substring(0, 10)}`);

    // Get exchange default type if not specified
    const popularExchanges = exchangeService.getPopularExchanges();
    const exchangeConfig = popularExchanges.find(ex => ex.id === exchangeId);
    const defaultType = accountType || exchangeConfig?.defaultType || 'spot';

    // Try to create exchange and fetch balance (using plain keys)
    const exchange = await exchangeService.getExchangeInstance(
      exchangeId,
      trimmedApiKey,
      trimmedSecret,
      trimmedPassphrase,
      { defaultType }
    );

    const balanceResult = await exchangeService.fetchBalance(exchange);

    if (balanceResult.success) {
      res.json({
        success: true,
        message: 'Connection successful',
        data: {
          exchange: exchange.name,
          balanceAvailable: Object.keys(balanceResult.data).length > 0,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: balanceResult.error,
      });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export default {
  getSupportedExchanges,
  getPopularExchanges,
  getExchangeInfo,
  checkPasswordRequired,
  fetchBalance,
  fetchTicker,
  fetchOHLCV,
  getSymbols,
  createMarketOrder,
  createLimitOrder,
  cancelOrder,
  fetchOpenOrders,
  fetchPositions,
  testConnection,
};
