/**
 * MT5 Market Data Service
 * Handles price feeds, candle data, and real-time updates
 */

import { logger } from '../../../utils/logger.js';
import { connectionManager } from './ConnectionManager.js';
import { MT5_CONFIG } from '../config/metaapi.config.js';

class MarketDataService {
  constructor() {
    this.priceCache = new Map();
    this.candleCache = new Map();
    this.subscriptions = new Map();
    this.lastUpdateTime = {};
    // Cache successful symbol mappings per broker account (accountId:symbol -> resolvedSymbol)
    this.resolvedSymbols = new Map();
    // Track current account for cache invalidation
    this.currentAccountId = null;
    
    // Symbol variants to try (in order of preference)
    // Different brokers use different naming conventions
    this.symbolVariants = {
      'XAUUSD': ['XAUUSD', 'GOLD', 'XAUUSDm', 'XAUUSD.', 'XAUUSD.r', 'GOLDm', 'GOLD.', 'XAUUSD_o'],
      'XAGUSD': ['XAGUSD', 'SILVER', 'XAGUSDm', 'XAGUSD.', 'XAGUSD.r', 'SILVERm', 'SILVER.', 'XAGUSD_o'],
      'BTCUSD': ['BTCUSD', 'BTCUSDm', 'BTCUSD.', 'BITCOIN', 'BTC/USD', 'BTCUSD_o'],
      'ETHUSD': ['ETHUSD', 'ETHUSDm', 'ETHUSD.', 'ETHEREUM', 'ETH/USD', 'ETHUSD_o'],
    };
    
    // Legacy symbol mapping (for backward compatibility)
    this.symbolMap = {
      'XAUUSD': 'GOLD',      // Gold
      'XAGUSD': 'SILVER',    // Silver
      'XAUUSD.': 'GOLD',
      'XAGUSD.': 'SILVER',
    };
  }

  /**
   * Normalize symbol name for MT5 broker
   * @param {string} symbol - Original symbol
   * @returns {string} Normalized symbol for MT5
   */
  normalizeSymbol(symbol) {
    const upperSymbol = symbol.toUpperCase();
    // Check if we have a cached resolved symbol
    if (this.resolvedSymbols.has(upperSymbol)) {
      return this.resolvedSymbols.get(upperSymbol);
    }
    // Use legacy mapping as fallback
    return this.symbolMap[upperSymbol] || symbol;
  }
  
  /**
   * Get all possible variants for a symbol
   * @param {string} symbol - Original symbol
   * @returns {Array<string>} List of possible symbol variants
   */
  getSymbolVariants(symbol) {
    const upperSymbol = symbol.toUpperCase();
    // Return defined variants or just the symbol itself
    return this.symbolVariants[upperSymbol] || [symbol, this.symbolMap[upperSymbol]].filter(Boolean);
  }

  /**
   * Subscribe to real-time price updates
   * @param {string} symbol - Symbol to subscribe
   * @param {Function} callback - Callback for price updates
   * @returns {string} Subscription ID
   */
  subscribeToPrices(symbol, callback) {
    try {
      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5');
      }

      const normalizedSymbol = this.normalizeSymbol(symbol);
      const subscriptionId = `price-${symbol}-${Date.now()}`;
      const connection = connectionManager.getConnection();

      // Subscribe to symbol price stream
      const subscription = connection.addSynchronizationListener({
        onSymbolPriceUpdated: (price) => {
          if (price.symbol === normalizedSymbol) {
            const priceData = {
              symbol: symbol, // Return original symbol name
              bid: price.bid,
              ask: price.ask,
              last: price.last,
              time: new Date(price.time).toISOString(),
              spread: price.ask - price.bid,
            };

            // Cache price with original symbol
            this.priceCache.set(symbol, priceData);
            this.lastUpdateTime[symbol] = Date.now();

            // Call callback
            if (callback && typeof callback === 'function') {
              callback(priceData);
            }

            if (MT5_CONFIG.logging.logPrices) {
              logger.debug(`[PRICE] ${symbol} (${normalizedSymbol}) - Bid: ${price.bid}, Ask: ${price.ask}`);
            }
          }
        },
      });

      this.subscriptions.set(subscriptionId, {
        symbol,
        type: 'price',
        subscription,
        callback,
      });

      logger.info(`[MARKET] Subscribed to ${symbol} (${normalizedSymbol}) prices - ID: ${subscriptionId}`);

      return subscriptionId;
    } catch (error) {
      logger.error(`Failed to subscribe to ${symbol} prices: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unsubscribe from price updates
   * @param {string} subscriptionId - Subscription ID
   */
  unsubscribeFromPrices(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);

    if (subscription) {
      const connection = connectionManager.getConnection();
      connection.removeSynchronizationListener(subscription.subscription);
      this.subscriptions.delete(subscriptionId);

      logger.info(`[MARKET] Unsubscribed from ${subscription.symbol}`);
    }
  }

  /**
   * Get current price for symbol
   * @param {string} symbol - Symbol
   * @returns {Promise<Object>} Price data
   */
  async getCurrentPrice(symbol) {
    try {
      // Check cache first
      const cached = this.priceCache.get(symbol);
      if (cached && Date.now() - this.lastUpdateTime[symbol] < 1000) {
        return cached;
      }

      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5');
      }

      const connection = connectionManager.getConnection();
      const upperSymbol = symbol.toUpperCase();
      
      // Get current account ID for per-account caching
      const accountId = connectionManager.account?.id || 'default';
      const cacheKey = `${accountId}:${upperSymbol}`;
      
      // Check if account changed - clear resolved symbols cache if so
      if (this.currentAccountId && this.currentAccountId !== accountId) {
        logger.debug(`[PRICE] Account changed from ${this.currentAccountId} to ${accountId}, clearing resolved symbols cache`);
        this.resolvedSymbols.clear();
      }
      this.currentAccountId = accountId;
      
      // If we have a resolved symbol from previous successful fetch for this account, use it
      if (this.resolvedSymbols.has(cacheKey)) {
        const resolvedSymbol = this.resolvedSymbols.get(cacheKey);
        try {
          const price = await connection.getSymbolPrice(resolvedSymbol);
          return this._buildPriceData(symbol, price);
        } catch (cachedError) {
          // Cached symbol no longer works, clear it and retry
          logger.debug(`[PRICE] Cached symbol ${resolvedSymbol} failed, retrying with variants`);
          this.resolvedSymbols.delete(cacheKey);
        }
      }
      
      // Try symbol variants until one works
      const variants = this.getSymbolVariants(symbol);
      let lastError = null;
      
      for (const variant of variants) {
        try {
          logger.debug(`[PRICE] Trying symbol variant: ${variant} for ${symbol}`);
          const price = await connection.getSymbolPrice(variant);
          
          // Success! Cache the resolved symbol for future requests (per account)
          this.resolvedSymbols.set(cacheKey, variant);
          logger.info(`[PRICE] Symbol ${symbol} resolved to broker symbol: ${variant} (account: ${accountId})`);
          
          return this._buildPriceData(symbol, price);
        } catch (variantError) {
          lastError = variantError;
          // Continue to next variant
        }
      }
      
      // All variants failed
      throw lastError || new Error(`No valid symbol variant found for ${symbol}`);
    } catch (error) {
      const variants = this.getSymbolVariants(symbol);
      logger.error(`Failed to get price for ${symbol} (tried variants: ${variants.join(', ')}): ${error.message}`);
      
      // Return cached value if available
      const cached = this.priceCache.get(symbol);
      if (cached) {
        logger.warn(`[PRICE] Using cached price for ${symbol}`);
        return cached;
      }
      throw error;
    }
  }
  
  /**
   * Build price data object
   * @private
   */
  _buildPriceData(symbol, price) {
    const priceData = {
      symbol: symbol, // Return original symbol name
      bid: price.bid,
      ask: price.ask,
      last: price.last,
      time: new Date(price.time).toISOString(),
      spread: price.ask - price.bid,
    };

    // Cache price with original symbol
    this.priceCache.set(symbol, priceData);
    this.lastUpdateTime[symbol] = Date.now();

    return priceData;
  }

  /**
   * Get candle data
   * @param {string} symbol - Symbol
   * @param {string} timeframe - Timeframe (M1, M5, M15, H1, H4, D1)
   * @param {number} count - Number of candles
   * @returns {Promise<Array<Object>>} Candle data
   */
  async getCandles(symbol, timeframe = 'H1', count = 100) {
    try {
      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5');
      }

      const normalizedSymbol = this.normalizeSymbol(symbol);
      const connection = connectionManager.getConnection();
      const candles = await connection.getCandles(
        normalizedSymbol,
        timeframe,
        { count }
      );

      const candleData = candles.map((candle) => ({
        time: new Date(candle.time).toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        spread: candle.spread,
      }));

      // Cache candles
      const cacheKey = `${symbol}-${timeframe}`;
      this.candleCache.set(cacheKey, candleData);

      return candleData;
    } catch (error) {
      logger.error(`Failed to get candles for ${symbol} (${timeframe}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Get multiple timeframes data (for analysis)
   * @param {string} symbol - Symbol
   * @param {Array<string>} timeframes - List of timeframes
   * @param {number} count - Number of candles per timeframe
   * @returns {Promise<Object>} Multi-timeframe data
   */
  async getMultiTimeframeData(symbol, timeframes = ['M15', 'H1', 'H4'], count = 50) {
    try {
      const data = {};

      const promises = timeframes.map(async (tf) => {
        const candles = await this.getCandles(symbol, tf, count);
        data[tf] = candles;
      });

      await Promise.all(promises);

      return {
        symbol,
        timeframes: data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to get multi-timeframe data for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate technical indicators
   * @param {Array<Object>} candles - Candle data
   * @param {string} indicator - Indicator name (SMA, EMA, RSI, MACD)
   * @param {Object} params - Indicator parameters
   * @returns {Array<number>} Indicator values
   */
  async calculateIndicator(candles, indicator, params = {}) {
    const closes = candles.map((c) => c.close);

    switch (indicator.toUpperCase()) {
      case 'SMA':
        return this.calculateSMA(closes, params.period || 20);

      case 'EMA':
        return this.calculateEMA(closes, params.period || 20);

      case 'RSI':
        return this.calculateRSI(closes, params.period || 14);

      case 'MACD':
        return this.calculateMACD(closes, params.fast || 12, params.slow || 26);

      case 'BB':
        return this.calculateBollingerBands(closes, params.period || 20, params.stdDev || 2);

      default:
        throw new Error(`Unknown indicator: ${indicator}`);
    }
  }

  /**
   * Calculate Simple Moving Average
   * @private
   */
  calculateSMA(closes, period) {
    const sma = [];
    for (let i = period - 1; i < closes.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  /**
   * Calculate Exponential Moving Average
   * @private
   */
  calculateEMA(closes, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += closes[i];
    }
    ema.push(sum / period);

    // Calculate EMA
    for (let i = period; i < closes.length; i++) {
      const current = (closes[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(current);
    }

    return ema;
  }

  /**
   * Calculate Relative Strength Index
   * @private
   */
  calculateRSI(closes, period) {
    const deltas = [];
    for (let i = 1; i < closes.length; i++) {
      deltas.push(closes[i] - closes[i - 1]);
    }

    let gainSum = 0,
      lossSum = 0;
    for (let i = 0; i < period; i++) {
      if (deltas[i] > 0) gainSum += deltas[i];
      else lossSum -= deltas[i];
    }

    const rsi = [];
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    for (let i = period; i < deltas.length; i++) {
      const delta = deltas[i];
      if (delta > 0) gainSum = delta;
      else lossSum = -delta;

      avgGain = (avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (delta < 0 ? -delta : 0)) / period;

      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }

    return rsi;
  }

  /**
   * Calculate MACD
   * @private
   */
  calculateMACD(closes, fastPeriod, slowPeriod) {
    const emaFast = this.calculateEMA(closes, fastPeriod);
    const emaSlow = this.calculateEMA(closes, slowPeriod);

    const macd = [];
    const signal = [];
    const histogram = [];

    const minLength = Math.min(emaFast.length, emaSlow.length);
    for (let i = 0; i < minLength; i++) {
      macd.push(emaFast[i] - emaSlow[i]);
    }

    const signalEMA = this.calculateEMA(macd, 9);
    for (let i = 0; i < signalEMA.length; i++) {
      signal.push(signalEMA[i]);
      histogram.push(macd[i + macd.length - signalEMA.length] - signalEMA[i]);
    }

    return { macd, signal, histogram };
  }

  /**
   * Calculate Bollinger Bands
   * @private
   */
  calculateBollingerBands(closes, period, stdDev) {
    const sma = this.calculateSMA(closes, period);
    const bands = [];

    for (let i = period - 1; i < closes.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = sma[i - (period - 1)];

      let variance = 0;
      for (const val of slice) {
        variance += (val - mean) ** 2;
      }
      variance /= period;

      const std = Math.sqrt(variance);
      bands.push({
        upper: mean + std * stdDev,
        middle: mean,
        lower: mean - std * stdDev,
      });
    }

    return bands;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.priceCache.clear();
    this.candleCache.clear();
    this.lastUpdateTime = {};
    logger.info('[MARKET] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedPrices: this.priceCache.size,
      cachedCandles: this.candleCache.size,
      activeSubscriptions: this.subscriptions.size,
    };
  }
}

export const marketDataService = new MarketDataService();
export default MarketDataService;
