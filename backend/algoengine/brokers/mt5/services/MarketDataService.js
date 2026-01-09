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

      const subscriptionId = `price-${symbol}-${Date.now()}`;
      const connection = connectionManager.getConnection();

      // Subscribe to symbol price stream
      const subscription = connection.addSynchronizationListener({
        onSymbolPriceUpdated: (price) => {
          if (price.symbol === symbol) {
            const priceData = {
              symbol: price.symbol,
              bid: price.bid,
              ask: price.ask,
              last: price.last,
              time: new Date(price.time).toISOString(),
              spread: price.ask - price.bid,
            };

            // Cache price
            this.priceCache.set(symbol, priceData);
            this.lastUpdateTime[symbol] = Date.now();

            // Call callback
            if (callback && typeof callback === 'function') {
              callback(priceData);
            }

            if (MT5_CONFIG.logging.logPrices) {
              logger.debug(`[PRICE] ${symbol} - Bid: ${price.bid}, Ask: ${price.ask}`);
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

      logger.info(`[MARKET] Subscribed to ${symbol} prices - ID: ${subscriptionId}`);

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
      const price = await connection.getSymbolPrice(symbol);

      const priceData = {
        symbol: price.symbol,
        bid: price.bid,
        ask: price.ask,
        last: price.last,
        time: new Date(price.time).toISOString(),
        spread: price.ask - price.bid,
      };

      // Cache price
      this.priceCache.set(symbol, priceData);
      this.lastUpdateTime[symbol] = Date.now();

      return priceData;
    } catch (error) {
      logger.error(`Failed to get price for ${symbol}: ${error.message}`);
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

      const connection = connectionManager.getConnection();
      const candles = await connection.getCandles(
        symbol,
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
