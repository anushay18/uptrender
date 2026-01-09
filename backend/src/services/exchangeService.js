import ccxt from 'ccxt';

/**
 * Universal CCXT Exchange Service
 * Supports 100+ crypto exchanges through a single unified interface
 */

// Cache for loaded markets (avoid repeated API calls)
const marketsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get list of all CCXT supported exchanges
 * @returns {string[]} Array of exchange IDs
 */
export const getSupportedExchanges = () => {
  return ccxt.exchanges;
};

/**
 * Get list of popular/recommended exchanges
 * @returns {Object[]} Array of exchange objects with metadata
 */
export const getPopularExchanges = () => {
  return [
    { id: 'binance', name: 'Binance', logo: 'binance.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'binanceusdm', name: 'Binance USDⓈ-M Futures', logo: 'binance.png', requiresPassword: false, defaultType: 'future' },
    { id: 'binancecoinm', name: 'Binance COIN-M Futures', logo: 'binance.png', requiresPassword: false, defaultType: 'future' },
    { id: 'bybit', name: 'Bybit', logo: 'bybit.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'okx', name: 'OKX', logo: 'okx.png', requiresPassword: true, defaultType: 'spot' },
    { id: 'kucoin', name: 'KuCoin', logo: 'kucoin.png', requiresPassword: true, defaultType: 'spot' },
    { id: 'kraken', name: 'Kraken', logo: 'kraken.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'coinbase', name: 'Coinbase', logo: 'coinbase.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'gateio', name: 'Gate.io', logo: 'gateio.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'bitget', name: 'Bitget', logo: 'bitget.png', requiresPassword: true, defaultType: 'spot' },
    { id: 'mexc', name: 'MEXC', logo: 'mexc.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'huobi', name: 'Huobi', logo: 'huobi.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'bitmex', name: 'BitMEX', logo: 'bitmex.png', requiresPassword: false, defaultType: 'swap' },
    { id: 'deribit', name: 'Deribit', logo: 'deribit.png', requiresPassword: false, defaultType: 'future' },
    { id: 'delta', name: 'Delta Exchange', logo: 'delta.png', requiresPassword: false, defaultType: 'future' },
    { id: 'wazirx', name: 'WazirX', logo: 'wazirx.png', requiresPassword: false, defaultType: 'spot' },
    { id: 'coindcx', name: 'CoinDCX', logo: 'coindcx.png', requiresPassword: false, defaultType: 'spot' },
  ];
};

/**
 * Check if an exchange requires a passphrase/password
 * @param {string} exchangeId - Exchange identifier
 * @returns {boolean}
 */
export const isPasswordRequired = (exchangeId) => {
  const requiresPassword = ['kucoin', 'okx', 'bitget', 'coinbasepro', 'phemex', 'ascendex'];
  return requiresPassword.includes(exchangeId.toLowerCase());
};

/**
 * Get exchange info and capabilities
 * @param {string} exchangeId - Exchange identifier
 * @returns {Object} Exchange info
 */
export const getExchangeInfo = (exchangeId) => {
  if (!ccxt.exchanges.includes(exchangeId)) {
    throw new Error(`Exchange ${exchangeId} is not supported`);
  }
  
  const ExchangeClass = ccxt[exchangeId];
  const exchange = new ExchangeClass();
  
  return {
    id: exchangeId,
    name: exchange.name,
    countries: exchange.countries,
    urls: exchange.urls,
    version: exchange.version,
    has: {
      fetchBalance: exchange.has.fetchBalance,
      fetchTicker: exchange.has.fetchTicker,
      fetchTickers: exchange.has.fetchTickers,
      fetchOrderBook: exchange.has.fetchOrderBook,
      fetchTrades: exchange.has.fetchTrades,
      fetchOHLCV: exchange.has.fetchOHLCV,
      createOrder: exchange.has.createOrder,
      cancelOrder: exchange.has.cancelOrder,
      fetchOpenOrders: exchange.has.fetchOpenOrders,
      fetchClosedOrders: exchange.has.fetchClosedOrders,
      fetchMyTrades: exchange.has.fetchMyTrades,
      fetchPositions: exchange.has.fetchPositions,
      withdraw: exchange.has.withdraw,
    },
    timeframes: exchange.timeframes,
    requiresPassword: isPasswordRequired(exchangeId),
  };
};

/**
 * Create an exchange instance - The Universal Factory
 * @param {string} exchangeId - Exchange identifier (e.g., 'binance', 'kucoin')
 * @param {string} apiKey - API key
 * @param {string} apiSecret - API secret
 * @param {string|null} passphrase - Passphrase (for KuCoin, OKX, etc.)
 * @param {Object} options - Additional options
 * @returns {Promise<ccxt.Exchange>} Exchange instance
 */
export const getExchangeInstance = async (
  exchangeId,
  apiKey,
  apiSecret,
  passphrase = null,
  options = {}
) => {
  // Validate exchange
  if (!ccxt.exchanges.includes(exchangeId)) {
    throw new Error(`Exchange ${exchangeId} is not supported by CCXT`);
  }

  // Dynamic Class Loading
  const ExchangeClass = ccxt[exchangeId];

  // Use plain keys directly and trim whitespace
  let key = apiKey;
  let secret = apiSecret;
  let password = passphrase || undefined;
  
  // Debug logging
  if (exchangeId === 'delta') {
    console.log(`🔓 Delta API Key length: ${key?.length}`);
    console.log(`🔓 Delta API Key first 10: ${key?.substring(0, 10)}`);
    console.log(`🔓 Delta Secret length: ${secret?.length}`);
  }
  
  // Clean the keys - remove any invalid characters, newlines, carriage returns
  if (key) {
    key = key.trim().replace(/[\r\n\t]/g, '');
  }
  if (secret) {
    secret = secret.trim().replace(/[\r\n\t]/g, '');
  }
  if (password) {
    password = password.trim().replace(/[\r\n\t]/g, '');
  }

  // Instantiate exchange
  const exchangeConfig = {
    apiKey: key,
    secret: secret,
    password: password, // Required for OKX, KuCoin, etc.
    enableRateLimit: true, // CRITICAL: Prevents bans
    options: {
      defaultType: options.defaultType || 'spot', // 'spot', 'future', 'swap'
      adjustForTimeDifference: true,
      ...options.exchangeOptions,
    },
    // Sandbox/Testnet mode
    ...(options.sandbox && { sandbox: true }),
  };

  // Configure Delta Exchange to use India API
  if (exchangeId === 'delta') {
    exchangeConfig.urls = {
      api: {
        public: 'https://api.india.delta.exchange',
        private: 'https://api.india.delta.exchange',
      },
    };
  }

  const exchange = new ExchangeClass(exchangeConfig);

  // Load markets if not cached
  const cacheKey = `${exchangeId}_${options.defaultType || 'spot'}`;
  const cachedMarkets = marketsCache.get(cacheKey);
  
  if (cachedMarkets && Date.now() - cachedMarkets.timestamp < CACHE_TTL) {
    exchange.markets = cachedMarkets.data;
    exchange.symbols = Object.keys(cachedMarkets.data);
  } else {
    try {
      await exchange.loadMarkets();
      marketsCache.set(cacheKey, {
        data: exchange.markets,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.warn(`Failed to load markets for ${exchangeId}:`, error.message);
    }
  }

  return exchange;
};

/**
 * Fetch balance from exchange
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @returns {Promise<Object>} Balance info
 */
export const fetchBalance = async (exchange) => {
  try {
    const balance = await exchange.fetchBalance();
    
    // Filter out zero balances
    const nonZeroBalance = {};
    for (const [currency, data] of Object.entries(balance)) {
      if (currency === 'info' || currency === 'free' || currency === 'used' || currency === 'total') {
        continue;
      }
      if (data.total > 0 || data.free > 0 || data.used > 0) {
        nonZeroBalance[currency] = data;
      }
    }
    
    return {
      success: true,
      data: nonZeroBalance,
      raw: balance,
    };
  } catch (error) {
    console.error(`Fetch balance error for ${exchange.id}:`, error.message);
    
    // Enhanced error handling for authentication issues
    if (error.message && error.message.includes('invalid_api_key')) {
      return {
        success: false,
        error: 'Invalid API credentials. Please verify your API key and secret are correct.',
      };
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Fetch ticker for a symbol
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
 * @returns {Promise<Object>} Ticker info
 */
export const fetchTicker = async (exchange, symbol) => {
  try {
    const ticker = await exchange.fetchTicker(symbol);
    return {
      success: true,
      data: {
        symbol: ticker.symbol,
        last: ticker.last,
        bid: ticker.bid,
        ask: ticker.ask,
        high: ticker.high,
        low: ticker.low,
        volume: ticker.baseVolume,
        quoteVolume: ticker.quoteVolume,
        change: ticker.change,
        percentage: ticker.percentage,
        timestamp: ticker.timestamp,
      },
    };
  } catch (error) {
    console.error('Fetch ticker error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Create a market order
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @param {string} symbol - Trading pair
 * @param {string} side - 'buy' or 'sell'
 * @param {number} amount - Order amount
 * @param {Object} params - Additional params
 * @returns {Promise<Object>} Order result
 */
export const createMarketOrder = async (exchange, symbol, side, amount, params = {}) => {
  try {
    const order = await exchange.createMarketOrder(symbol, side, amount, params);
    return {
      success: true,
      data: {
        id: order.id,
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        amount: order.amount,
        filled: order.filled,
        remaining: order.remaining,
        price: order.price,
        average: order.average,
        cost: order.cost,
        status: order.status,
        timestamp: order.timestamp,
      },
    };
  } catch (error) {
    console.error('Create market order error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Create a limit order
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @param {string} symbol - Trading pair
 * @param {string} side - 'buy' or 'sell'
 * @param {number} amount - Order amount
 * @param {number} price - Order price
 * @param {Object} params - Additional params
 * @returns {Promise<Object>} Order result
 */
export const createLimitOrder = async (exchange, symbol, side, amount, price, params = {}) => {
  try {
    const order = await exchange.createLimitOrder(symbol, side, amount, price, params);
    return {
      success: true,
      data: {
        id: order.id,
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        amount: order.amount,
        price: order.price,
        status: order.status,
        timestamp: order.timestamp,
      },
    };
  } catch (error) {
    console.error('Create limit order error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Cancel an order
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @param {string} orderId - Order ID
 * @param {string} symbol - Trading pair
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelOrder = async (exchange, orderId, symbol) => {
  try {
    const result = await exchange.cancelOrder(orderId, symbol);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Cancel order error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Fetch open orders
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @param {string|null} symbol - Trading pair (optional)
 * @returns {Promise<Object>} Open orders
 */
export const fetchOpenOrders = async (exchange, symbol = null) => {
  try {
    const orders = await exchange.fetchOpenOrders(symbol);
    return {
      success: true,
      data: orders.map(o => ({
        id: o.id,
        symbol: o.symbol,
        type: o.type,
        side: o.side,
        amount: o.amount,
        price: o.price,
        filled: o.filled,
        remaining: o.remaining,
        status: o.status,
        timestamp: o.timestamp,
      })),
    };
  } catch (error) {
    console.error('Fetch open orders error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Fetch positions (for futures/margin)
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @param {string[]|null} symbols - Trading pairs (optional)
 * @returns {Promise<Object>} Positions
 */
export const fetchPositions = async (exchange, symbols = null) => {
  try {
    if (!exchange.has.fetchPositions) {
      return {
        success: false,
        error: 'Exchange does not support position fetching',
      };
    }
    
    const positions = await exchange.fetchPositions(symbols);
    return {
      success: true,
      data: positions.filter(p => p.contracts > 0 || Math.abs(p.notional) > 0),
    };
  } catch (error) {
    console.error('Fetch positions error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Fetch OHLCV (candlestick) data
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @param {string} symbol - Trading pair
 * @param {string} timeframe - Timeframe (e.g., '1m', '5m', '1h', '1d')
 * @param {number} limit - Number of candles
 * @returns {Promise<Object>} OHLCV data
 */
export const fetchOHLCV = async (exchange, symbol, timeframe = '1h', limit = 100) => {
  try {
    if (!exchange.has.fetchOHLCV) {
      return {
        success: false,
        error: 'Exchange does not support OHLCV fetching',
      };
    }
    
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return {
      success: true,
      data: ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      })),
    };
  } catch (error) {
    console.error('Fetch OHLCV error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get available trading symbols for an exchange
 * @param {ccxt.Exchange} exchange - Exchange instance
 * @returns {Object} Symbols info
 */
export const getSymbols = (exchange) => {
  if (!exchange.markets) {
    return {
      success: false,
      error: 'Markets not loaded. Call loadMarkets() first.',
    };
  }
  
  const symbols = Object.keys(exchange.markets).map(symbol => {
    const market = exchange.markets[symbol];
    return {
      symbol,
      base: market.base,
      quote: market.quote,
      active: market.active,
      type: market.type,
      spot: market.spot,
      future: market.future,
      swap: market.swap,
    };
  });
  
  return {
    success: true,
    data: symbols,
  };
};

export default {
  getSupportedExchanges,
  getPopularExchanges,
  isPasswordRequired,
  getExchangeInfo,
  getExchangeInstance,
  fetchBalance,
  fetchTicker,
  createMarketOrder,
  createLimitOrder,
  cancelOrder,
  fetchOpenOrders,
  fetchPositions,
  fetchOHLCV,
  getSymbols,
};
