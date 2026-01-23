/**
 * Trading Calculations Utility
 * Industry-standard calculations for MTM, SL/TP, and P&L
 * This file serves as the SINGLE SOURCE OF TRUTH for all trading calculations
 * 
 * @module tradingCalculations
 */

// Comprehensive crypto symbol list
export const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'XRP', 'DOGE', 'SOL', 'ADA', 'DOT', 'MATIC',
  'LINK', 'UNI', 'AAVE', 'BNB', 'LTC', 'XLM', 'ATOM', 'AVAX',
  'SHIB', 'APE', 'CRV', 'FTM', 'NEAR', 'OP', 'ARB', 'IMX',
  'PEPE', 'WIF', 'BONK', 'INJ', 'SEI', 'TIA', 'SUI'
];

/**
 * Check if symbol is a crypto symbol
 * @param {string} symbol - Trading symbol
 * @returns {boolean}
 */
export const isCryptoSymbol = (symbol) => {
  const sym = (symbol || '').toUpperCase();
  return CRYPTO_SYMBOLS.some(crypto => sym.includes(crypto));
};

/**
 * Get pip/point multiplier for a symbol
 * Used for SL/TP "points" calculation
 * 
 * @param {string} symbol - Trading symbol
 * @param {string} market - Market type (Crypto, Forex, Indian)
 * @returns {number} - Pip multiplier (e.g., 0.0001 for EURUSD, 0.01 for USDJPY, 1 for crypto)
 */
export const getPipMultiplier = (symbol, market = 'Forex') => {
  const sym = (symbol || '').toUpperCase();
  
  // Crypto: 1 point = $1 price move
  if (market === 'Crypto' || isCryptoSymbol(sym)) {
    return 1;
  }
  
  // JPY pairs: 2 decimal places (0.01)
  if (sym.includes('JPY')) {
    return 0.01;
  }
  
  // Gold/Silver: 0.01 for points
  if (sym.includes('XAU') || sym.includes('XAG')) {
    return 0.01;
  }
  
  // Indices: 1 point = 1 price unit
  if (sym.includes('US30') || sym.includes('US500') || sym.includes('NAS100') || 
      sym.includes('UK100') || sym.includes('DE40') || sym.includes('JP225')) {
    return 1;
  }
  
  // Standard Forex: 5 decimal places (0.0001)
  return 0.0001;
};

/**
 * Get contract size for P&L calculation
 * 
 * @param {string} symbol - Trading symbol
 * @param {string} market - Market type
 * @returns {number} - Contract size (e.g., 100000 for standard forex)
 */
export const getContractSize = (symbol, market = 'Forex') => {
  const sym = (symbol || '').toUpperCase();
  
  // Crypto: 1 unit = 1 unit (no leverage multiplier in P&L)
  if (market === 'Crypto' || isCryptoSymbol(sym)) {
    return 1;
  }
  
  // Gold (XAUUSD): 1 lot = 100 oz
  if (sym.includes('XAU')) {
    return 100;
  }
  
  // Silver (XAGUSD): 1 lot = 5,000 oz
  if (sym.includes('XAG')) {
    return 5000;
  }
  
  // Oil (WTI/USOIL/BRENT): 1 lot = 1000 barrels
  if (sym.includes('WTI') || sym.includes('OIL') || sym.includes('BRENT')) {
    return 1000;
  }
  
  // Indices: Varies by broker, typically 1
  if (sym.includes('US30') || sym.includes('US500') || sym.includes('NAS100')) {
    return 1;
  }
  
  // Indian markets
  if (market === 'Indian') {
    return 1;
  }
  
  // Standard Forex: 1 lot = 100,000 units
  return 100000;
};

/**
 * Calculate profit/loss (MTM) for a position
 * SINGLE SOURCE OF TRUTH for P&L calculations
 * 
 * @param {Object} params
 * @param {number} params.openPrice - Entry price
 * @param {number} params.currentPrice - Current market price
 * @param {number} params.volume - Position size in lots
 * @param {string} params.type - 'Buy' or 'Sell'
 * @param {string} params.symbol - Trading symbol
 * @param {string} params.market - Market type (Forex, Crypto, Indian)
 * @returns {Object} - { profit, profitPercent }
 */
export const calculatePnL = ({ openPrice, currentPrice, volume, type, symbol, market = 'Forex' }) => {
  // Validate inputs
  if (!openPrice || !currentPrice || !volume || openPrice <= 0 || volume <= 0) {
    return { profit: 0, profitPercent: 0 };
  }
  
  const sym = (symbol || '').toUpperCase();
  
  // Calculate price difference based on direction
  const priceDiff = type === 'Buy' 
    ? (currentPrice - openPrice) 
    : (openPrice - currentPrice);
  
  // Get contract size for this instrument
  const contractSize = getContractSize(sym, market);
  
  // Calculate profit
  let profit;
  
  // JPY pairs need special handling due to 2-decimal pricing
  if (sym.includes('JPY') && market !== 'Crypto') {
    profit = volume * contractSize * (priceDiff / 100);
  } else {
    profit = volume * contractSize * priceDiff;
  }
  
  // Calculate percentage
  const profitPercent = openPrice > 0 ? (priceDiff / openPrice) * 100 : 0;
  
  return {
    profit: parseFloat(profit.toFixed(2)),
    profitPercent: parseFloat(profitPercent.toFixed(4))
  };
};

/**
 * Calculate SL/TP price levels from points/percentage
 * 
 * @param {Object} params
 * @param {number} params.openPrice - Entry price
 * @param {string} params.type - 'Buy' or 'Sell'
 * @param {string} params.slType - 'price', 'points', or 'percentage'
 * @param {number} params.slValue - Stop loss value
 * @param {string} params.tpType - 'price', 'points', or 'percentage'
 * @param {number} params.tpValue - Take profit value
 * @param {string} params.symbol - Trading symbol
 * @param {string} params.market - Market type
 * @returns {Object} - { stopLoss, takeProfit }
 */
export const calculateStopLevels = ({ openPrice, type, slType, slValue, tpType, tpValue, symbol, market = 'Forex' }) => {
  let stopLoss = null;
  let takeProfit = null;
  
  const pipMultiplier = getPipMultiplier(symbol, market);
  
  // Calculate Stop Loss
  if (slValue && slValue > 0) {
    if (slType === 'price') {
      stopLoss = slValue;
    } else if (slType === 'points') {
      const distance = slValue * pipMultiplier;
      stopLoss = type === 'Buy' ? openPrice - distance : openPrice + distance;
    } else if (slType === 'percentage') {
      stopLoss = type === 'Buy'
        ? openPrice * (1 - slValue / 100)
        : openPrice * (1 + slValue / 100);
    }
  }
  
  // Calculate Take Profit
  if (tpValue && tpValue > 0) {
    if (tpType === 'price') {
      takeProfit = tpValue;
    } else if (tpType === 'points') {
      const distance = tpValue * pipMultiplier;
      takeProfit = type === 'Buy' ? openPrice + distance : openPrice - distance;
    } else if (tpType === 'percentage') {
      takeProfit = type === 'Buy'
        ? openPrice * (1 + tpValue / 100)
        : openPrice * (1 - tpValue / 100);
    }
  }
  
  return { stopLoss, takeProfit };
};

/**
 * Check if SL or TP is hit at current price
 * 
 * @param {Object} params
 * @param {number} params.currentPrice - Current market price
 * @param {number} params.stopLoss - Stop loss price (null if not set)
 * @param {number} params.takeProfit - Take profit price (null if not set)
 * @param {string} params.type - 'Buy' or 'Sell'
 * @returns {string|null} - 'SL_Hit', 'TP_Hit', or null
 */
export const checkStopLevels = ({ currentPrice, stopLoss, takeProfit, type }) => {
  // Check Stop Loss
  if (stopLoss) {
    const sl = parseFloat(stopLoss);
    if (type === 'Buy' && currentPrice <= sl) {
      return 'SL_Hit';
    }
    if (type === 'Sell' && currentPrice >= sl) {
      return 'SL_Hit';
    }
  }
  
  // Check Take Profit
  if (takeProfit) {
    const tp = parseFloat(takeProfit);
    if (type === 'Buy' && currentPrice >= tp) {
      return 'TP_Hit';
    }
    if (type === 'Sell' && currentPrice <= tp) {
      return 'TP_Hit';
    }
  }
  
  return null;
};

/**
 * Validate SL/TP values for a position
 * 
 * @param {Object} params
 * @param {number} params.currentPrice - Current market price
 * @param {number} params.stopLoss - Proposed stop loss price
 * @param {number} params.takeProfit - Proposed take profit price
 * @param {string} params.type - 'Buy' or 'Sell'
 * @returns {Object} - { slValid, tpValid, slError, tpError }
 */
export const validateStopLevels = ({ currentPrice, stopLoss, takeProfit, type }) => {
  const result = {
    slValid: true,
    tpValid: true,
    slError: null,
    tpError: null
  };
  
  if (stopLoss && currentPrice) {
    if (type === 'Buy' && stopLoss >= currentPrice) {
      result.slValid = false;
      result.slError = 'Stop Loss for Buy position should be below current price';
    }
    if (type === 'Sell' && stopLoss <= currentPrice) {
      result.slValid = false;
      result.slError = 'Stop Loss for Sell position should be above current price';
    }
  }
  
  if (takeProfit && currentPrice) {
    if (type === 'Buy' && takeProfit <= currentPrice) {
      result.tpValid = false;
      result.tpError = 'Take Profit for Buy position should be above current price';
    }
    if (type === 'Sell' && takeProfit >= currentPrice) {
      result.tpValid = false;
      result.tpError = 'Take Profit for Sell position should be below current price';
    }
  }
  
  return result;
};

/**
 * Format currency value with sign and symbol
 * 
 * @param {number} value - Currency value
 * @param {string} market - Market type
 * @returns {string}
 */
export const formatCurrency = (value, market = 'Forex') => {
  const symbol = market === 'Indian' ? '₹' : '$';
  const formatted = Math.abs(value).toFixed(2);
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${symbol}${formatted}`;
};

/**
 * Format price with appropriate decimals
 * 
 * @param {number} price - Price value
 * @param {string} symbol - Trading symbol
 * @param {string} market - Market type
 * @returns {string}
 */
export const formatPrice = (price, symbol, market = 'Forex') => {
  if (!price) return '0.00';
  
  const sym = (symbol || '').toUpperCase();
  
  let decimals;
  if (market === 'Crypto' || isCryptoSymbol(sym)) {
    decimals = 2; // Crypto typically 2 decimals
  } else if (sym.includes('JPY')) {
    decimals = 3; // JPY pairs
  } else if (market === 'Forex') {
    decimals = 5; // Standard forex
  } else {
    decimals = 2; // Indian markets
  }
  
  return parseFloat(price).toFixed(decimals);
};

export default {
  CRYPTO_SYMBOLS,
  isCryptoSymbol,
  getPipMultiplier,
  getContractSize,
  calculatePnL,
  calculateStopLevels,
  checkStopLevels,
  validateStopLevels,
  formatCurrency,
  formatPrice
};
