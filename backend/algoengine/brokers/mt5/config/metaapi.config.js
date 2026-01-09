/**
 * MetaAPI Configuration for MT5
 * Handles connection parameters and optimization settings
 */

export const MT5_CONFIG = {
  // MetaAPI Account Configuration
  account: {
    // MetaAPI credentials - get from environment
    apiKey: process.env.METAAPI_KEY,
    accountId: process.env.METAAPI_ACCOUNT_ID,
    accountType: 'cloud', // cloud, cloud-g2, cloud-g1
  },

  // Connection Settings
  connection: {
    // Connection timeout in milliseconds
    timeout: 30000,
    
    // Automatic reconnection attempts
    maxRetries: 3,
    retryDelay: 2000,
    
    // Keep-alive ping interval
    keepAliveInterval: 30000,
    
    // Connection pool settings
    poolSize: 5,
  },

  // Trading Settings
  trading: {
    // Trade placement mode: 'fastest', 'risk_management', 'balanced'
    mode: 'fastest',
    
    // Execution settings for fastest mode
    fastest: {
      // Skip order verification for instant execution
      skipVerification: false,
      
      // Use synchronous order placement (wait for response)
      synchronous: true,
      
      // Timeout for order execution
      executionTimeout: 5000,
      
      // Automatically detect and set magic number
      autoMagicNumber: true,
      
      // Use market orders for fastest execution
      preferMarketOrders: true,
      
      // Slippage tolerance in points (0-5 for faster execution)
      slippage: 2,
      
      // Order comment for tracking
      orderComment: 'UPTRENDER-AUTO',
    },

    // Order validation
    validation: {
      // Minimum lot size check
      minLotSize: 0.01,
      
      // Maximum lot size check
      maxLotSize: 100,
      
      // Check account balance before order
      checkBalance: true,
      
      // Check margin availability
      checkMargin: true,
      
      // Maximum daily trades per account
      maxDailyTrades: 100,
    },

    // Risk management
    riskManagement: {
      // Maximum loss per trade
      maxLossPerTrade: 100, // USD
      
      // Maximum loss per day
      maxLossPerDay: 500, // USD
      
      // Stop loss minimum distance in points
      minSlDistance: 10,
      
      // Take profit minimum distance in points
      minTpDistance: 10,
      
      // Auto close orders at end of day
      closeAtDayEnd: true,
      
      // Auto close orders before important news
      closeBeforeNews: true,
    },
  },

  // Market Data Settings
  marketData: {
    // Price feed update frequency
    updateInterval: 100, // milliseconds
    
    // Keep historical candles in memory
    keepHistory: true,
    
    // Number of candles to keep
    historySize: 500,
    
    // Supported timeframes
    timeframes: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'],
  },

  // Logging Settings
  logging: {
    // Log level: 'debug', 'info', 'warn', 'error'
    level: process.env.LOG_LEVEL || 'info',
    
    // Log trade placements
    logTrades: true,
    
    // Log price updates
    logPrices: false,
    
    // Log connection events
    logConnection: true,
    
    // Log to file
    logToFile: true,
    
    // Log file path
    logPath: './logs/mt5-algoengine.log',
  },

  // Performance Optimization
  optimization: {
    // Use connection pooling
    usePooling: true,
    
    // Cache symbol data
    cacheSymbols: true,
    
    // Cache duration in milliseconds
    cacheDuration: 300000, // 5 minutes
    
    // Batch order placement (for multiple orders)
    batchMode: true,
    
    // Batch size
    batchSize: 10,
  },

  // Symbols and Instruments
  symbols: {
    // Forex pairs
    forex: [
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
      'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY',
    ],
    
    // Indices
    indices: [
      'US30', 'US100', 'US500', // US indices
      'UK100', 'DE30', 'FR40',   // EU indices
      'JP225',                    // Japan Nikkei
    ],
    
    // Commodities
    commodities: [
      'XAUUSD', // Gold
      'XAGUSD', // Silver
      'XPDUSD', // Palladium
      'XPTUSD', // Platinum
      'WTI',    // Crude Oil
      'BRENT',  // Brent Oil
    ],
    
    // Cryptocurrencies
    cryptocurrencies: [
      'BTCUSD', 'ETHUSD', 'XRPUSD', 'LTCUSD',
    ],
  },

  // Webhook Settings (for real-time updates)
  webhooks: {
    // Webhook server port
    port: process.env.WEBHOOK_PORT || 8080,
    
    // Webhook endpoint paths
    endpoints: {
      trades: '/webhooks/mt5/trades',
      prices: '/webhooks/mt5/prices',
      account: '/webhooks/mt5/account',
    },
  },

  // Fallback and Error Handling
  fallback: {
    // Fallback to REST API if WebSocket fails
    enableFallback: true,
    
    // Fallback poll interval
    pollInterval: 5000,
    
    // Number of fallback retries
    maxRetries: 5,
  },
};

// Order types mapping
export const ORDER_TYPES = {
  BUY: 0,           // Buy operation
  SELL: 1,          // Sell operation
  BUY_LIMIT: 2,     // Buy limit order
  SELL_LIMIT: 3,    // Sell limit order
  BUY_STOP: 4,      // Buy stop order
  SELL_STOP: 5,     // Sell stop order
};

// Trade modes
export const TRADE_MODES = {
  DEMO: 0,          // Demo account
  REAL: 1,          // Real account
};

// Fill types
export const FILL_TYPES = {
  FOK: 0,           // Fill or Kill
  IOC: 1,           // Immediate or Cancel
  RETURN: 2,        // Return remaining volume
  DEFAULT: 3,       // Use broker default
};

// Stop loss types
export const SL_TYPES = {
  PERCENTAGE: 'percentage',  // SL as percentage
  POINTS: 'points',          // SL as absolute points
  FIXED_PRICE: 'fixed_price', // SL as absolute price
};

// Take profit types
export const TP_TYPES = {
  PERCENTAGE: 'percentage',  // TP as percentage
  POINTS: 'points',          // TP as absolute points
  FIXED_PRICE: 'fixed_price', // TP as absolute price
};

export default MT5_CONFIG;
