/**
 * Paper Position Price Updater
 * Background service that updates paper position prices and checks SL/TP
 * 
 * ARCHITECTURE PRINCIPLES (UPDATED):
 * ==================================
 * 1. CENTRALIZED DATA STREAMING FOR ALL FOREX PRICES
 *    - Uses CentralizedStreamingService (MetaAPI or Deriv)
 *    - No per-user MT5 connections for paper trading
 *    - Prices broadcast via Redis to all users
 * 
 * 2. FALLBACK CHAIN
 *    - Centralized Streaming → CCXT (for crypto) → Public Exchange
 * 
 * 3. NO MetaAPI SUBSCRIPTION LIMIT ISSUES
 *    - Centralized streaming uses single admin connection
 *    - User connections only for REAL trade execution
 */

import { PaperPosition, ApiKey } from '../models/index.js';
import centralizedStreamingService from './CentralizedStreamingService.js';
import { paperTradingService } from '../services/PaperTradingService.js';
import { Op } from 'sequelize';
import redisClient from '../utils/redisClient.js';
import ccxt from 'ccxt';

// Crypto symbol patterns for detection (used only when market is not specified)
const CRYPTO_SYMBOLS_REGEX = /BTC|ETH|XRP|DOGE|SOL|AVAX|ADA|DOT|MATIC|LINK|UNI|AAVE|BNB|LTC|XLM|ATOM/i;

class PaperPositionPriceUpdater {
  constructor() {
    this.isRunning = false;
    this.updateInterval = null;
    this.intervalMs = 5000; // Update every 5 seconds
    this.subscribedSymbols = new Set();
    this.priceCache = new Map();
    this.ccxtExchangeCache = new Map(); // Cache CCXT exchange instances
    this.publicExchange = null; // Public Binance instance for fallback
  }

  /**
   * Check if a symbol is a crypto symbol (used for fallback detection)
   */
  isCryptoSymbol(symbol) {
    return CRYPTO_SYMBOLS_REGEX.test(symbol.toUpperCase());
  }

  /**
   * Get or create a public exchange instance for fallback streaming
   * Uses Binance public WebSocket (no API key needed)
   */
  async getPublicExchange() {
    if (!this.publicExchange) {
      try {
        // Use ccxt.pro for WebSocket support if available, otherwise regular ccxt
        const ExchangeClass = ccxt.pro?.binance || ccxt.binance;
        this.publicExchange = new ExchangeClass({
          enableRateLimit: true,
          options: { defaultType: 'spot' }
        });
        await this.publicExchange.loadMarkets().catch(() => {});
        console.log('📡 Public Binance exchange initialized for fallback streaming');
      } catch (error) {
        console.warn('⚠️ Could not initialize public exchange:', error.message);
        return null;
      }
    }
    return this.publicExchange;
  }

  /**
   * Get or create a CCXT exchange instance from cache
   */
  async getCCXTExchange(apiKey) {
    const cacheKey = `${apiKey.exchangeId}:${apiKey.id}`;
    
    if (this.ccxtExchangeCache.has(cacheKey)) {
      return this.ccxtExchangeCache.get(cacheKey);
    }

    try {
      // Map custom exchange IDs to CCXT exchange classes
      const exchangeIdMap = {
        'deltademo': 'delta', // Delta Demo uses the same CCXT class as Delta
      };
      
      const ccxtExchangeId = exchangeIdMap[apiKey.exchangeId] || apiKey.exchangeId;
      
      // Use ccxt.pro for WebSocket support if available
      const ExchangeClass = ccxt.pro?.[ccxtExchangeId] || ccxt[ccxtExchangeId];
      
      if (!ExchangeClass) {
        console.warn(`⚠️ Exchange ${apiKey.exchangeId} not found in CCXT`);
        return null;
      }

      const config = {
        apiKey: apiKey.apiKey,
        secret: apiKey.apiSecret,
        enableRateLimit: true,
        options: { defaultType: 'spot' }
      };

      // Configure Delta Exchange for India API
      if (apiKey.exchangeId === 'delta') {
        config.urls = {
          api: {
            public: 'https://api.india.delta.exchange',
            private: 'https://api.india.delta.exchange',
          },
        };
      }

      // Configure Delta Exchange Demo API
      if (apiKey.exchangeId === 'deltademo') {
        config.urls = {
          api: {
            public: 'https://cdn.demo.delta.exchange',
            private: 'https://api.demo.delta.exchange',
          },
        };
      }

      if (apiKey.passphrase) {
        config.password = apiKey.passphrase;
      }

      const exchange = new ExchangeClass(config);
      await exchange.loadMarkets().catch(() => {});
      
      this.ccxtExchangeCache.set(cacheKey, exchange);
      console.log(`📡 CCXT ${apiKey.exchangeId} exchange cached for API ${apiKey.id}`);
      
      return exchange;
    } catch (error) {
      console.error(`Error creating CCXT exchange for ${apiKey.exchangeId}:`, error.message);
      return null;
    }
  }

  /**
   * Start the price updater
   */
  async start() {
    if (this.isRunning) {
      console.log('📈 Paper position price updater already running');
      return;
    }

    console.log('📈 Starting paper position price updater...');
    this.isRunning = true;

    // Initial update
    await this.updateAllPositions();

    // Set up interval
    this.updateInterval = setInterval(async () => {
      await this.updateAllPositions();
    }, this.intervalMs);

    console.log(`📈 Paper position price updater started (interval: ${this.intervalMs}ms)`);
  }

  /**
   * Stop the price updater
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('📈 Paper position price updater stopped');
  }

  /**
   * Get unique symbols from all open paper positions with their API key info
   * Now includes broker type detection for proper data source selection
   */
  async getActiveSymbols() {
    try {
      const positions = await PaperPosition.findAll({
        where: { status: 'Open' },
        attributes: ['id', 'symbol', 'market', 'apiKeyId', 'userId'],
        include: [{
          model: ApiKey,
          as: 'apiKey',
          attributes: ['id', 'broker', 'exchangeId', 'segment', 'apiKey', 'apiSecret', 'passphrase', 'accessToken', 'appName'],
          required: false
        }],
        raw: false
      });

      // Group by symbol and collect all relevant info
      const symbolMap = new Map();
      for (const p of positions) {
        const key = p.symbol.toUpperCase();
        if (!symbolMap.has(key)) {
          symbolMap.set(key, {
            symbol: p.symbol,
            market: p.market,
            apiKeyId: p.apiKeyId,
            userId: p.userId,
            apiKey: p.apiKey ? p.apiKey.toJSON() : null,
            // Determine broker type: 'mt5', 'ccxt', or 'none'
            brokerType: this.determineBrokerType(p.apiKey)
          });
        }
      }

      return Array.from(symbolMap.values());
    } catch (error) {
      console.error('Error getting active symbols:', error);
      return [];
    }
  }

  /**
   * Determine broker type from API key
   * Returns: 'mt5' | 'ccxt' | 'none'
   */
  determineBrokerType(apiKey) {
    if (!apiKey) return 'none';
    
    const apiKeyData = apiKey.toJSON ? apiKey.toJSON() : apiKey;
    
    // Check if it's an MT5 broker
    if (apiKeyData.broker === 'MT5' || 
        (apiKeyData.accessToken && apiKeyData.appName && !apiKeyData.exchangeId)) {
      return 'mt5';
    }
    
    // Check if it's a CCXT exchange
    if (apiKeyData.exchangeId && apiKeyData.apiKey && apiKeyData.apiSecret) {
      return 'ccxt';
    }
    
    return 'none';
  }

  /**
   * Find the best API key for streaming when user doesn't have one
   * Priority: Centralized Streaming → CCXT API → Public Exchange
   */
  async findFallbackApiKey(market, symbol) {
    try {
      const isCrypto = market === 'Crypto' || this.isCryptoSymbol(symbol);
      
      if (isCrypto) {
        // For crypto: Find any recent active crypto API key
        const apiKey = await ApiKey.findOne({
          where: {
            segment: 'Crypto',
            status: 'Active',
            exchangeId: { [Op.ne]: null },
            apiKey: { [Op.ne]: null },
            apiSecret: { [Op.ne]: null }
          },
          order: [['updatedAt', 'DESC']] // Most recently used
        });
        
        if (apiKey) {
          console.log(`📡 Using fallback crypto API key ID ${apiKey.id} (User ${apiKey.userId}) for ${symbol}`);
          return { apiKey: apiKey.toJSON(), type: 'ccxt' };
        }
        
        // No API key found, use public exchange
        return { apiKey: null, type: 'public' };
      } else {
        // For forex/indian: Use centralized streaming (no per-user API needed)
        const status = centralizedStreamingService.getStatus();
        if (status.isConnected) {
          console.log(`📡 Using centralized streaming for ${symbol}`);
          return { apiKey: null, type: 'centralized' };
        }
        
        return { apiKey: null, type: 'none' };
      }
    } catch (error) {
      console.error('Error finding fallback API key:', error);
      return { apiKey: null, type: 'none' };
    }
  }

  /**
   * Initialize Forex price source - Now uses centralized streaming
   * No individual user connections needed for paper trading
   */
  async initializeForexPricing(apiKey = null) {
    try {
      // Check if centralized streaming is connected
      const status = centralizedStreamingService.getStatus();
      
      if (status.isConnected) {
        console.log(`📡 Using Centralized Streaming (${status.provider || 'metaapi'}) for paper trading prices`);
        return true;
      }
      
      // If not connected, log warning but continue with fallbacks
      console.warn('⚠️ Centralized streaming not connected - paper trades will use CCXT/public prices');
      return false;
    } catch (error) {
      console.error('Error checking centralized streaming:', error.message);
      return false;
    }
  }

  /**
   * Fetch price from centralized streaming (MetaAPI or Deriv)
   */
  async fetchFromCentralizedStreaming(symbol) {
    try {
      const priceData = centralizedStreamingService.getPrice(symbol.toUpperCase());
      if (priceData && priceData.bid) {
        return {
          bid: priceData.bid,
          ask: priceData.ask,
          mid: (priceData.bid + priceData.ask) / 2,
          source: `centralized:${priceData.source || 'streaming'}`
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching centralized price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch price from CCXT exchange
   */
  async fetchFromCCXT(symbol, apiKey) {
    try {
      const exchange = await this.getCCXTExchange(apiKey);
      if (!exchange) return null;

      const ticker = await exchange.fetchTicker(symbol);
      console.log(`✅ [CCXT ${apiKey.exchangeId}] Fetched price for ${symbol}:`, ticker.last);
      
      return {
        bid: ticker.bid,
        ask: ticker.ask,
        mid: ticker.last || ((ticker.bid + ticker.ask) / 2),
        source: `ccxt:${apiKey.exchangeId}`
      };
    } catch (error) {
      console.warn(`⚠️ CCXT fetch failed for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch price from public exchange (Binance - no API key needed)
   */
  async fetchFromPublicExchange(symbol) {
    try {
      const exchange = await this.getPublicExchange();
      if (!exchange) return null;

      // Convert symbol format for Binance if needed (BTCUSD → BTC/USDT)
      let binanceSymbol = symbol;
      if (symbol.endsWith('USD') && !symbol.includes('/')) {
        binanceSymbol = symbol.replace('USD', '/USDT');
      } else if (!symbol.includes('/')) {
        binanceSymbol = `${symbol}/USDT`;
      }

      const ticker = await exchange.fetchTicker(binanceSymbol);
      console.log(`✅ [PUBLIC Binance] Fetched price for ${symbol} (${binanceSymbol}):`, ticker.last);
      
      return {
        bid: ticker.bid,
        ask: ticker.ask,
        mid: ticker.last || ((ticker.bid + ticker.ask) / 2),
        source: 'public:binance'
      };
    } catch (error) {
      console.warn(`⚠️ Public exchange fetch failed for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch price for a symbol based on broker type
   * UPDATED ARCHITECTURE:
   * - Forex symbols → Use Centralized Streaming (MetaAPI or Deriv)
   * - Crypto with CCXT API → Use CCXT exchange
   * - Crypto without API → Use public Binance
   */
  async fetchPrice(symbolInfo) {
    const { symbol, market, apiKeyId, apiKey, brokerType } = symbolInfo;
    
    try {
      // CASE 1: Check centralized streaming first for Forex/MT5 symbols
      if (brokerType === 'mt5' || !this.isCryptoSymbol(symbol)) {
        console.log(`📊 [${symbol}] Checking centralized streaming for price`);
        const centralizedPrice = await this.fetchFromCentralizedStreaming(symbol);
        if (centralizedPrice) {
          return centralizedPrice;
        }
        console.log(`📊 [${symbol}] Centralized streaming no data, trying fallbacks`);
      }
      
      // CASE 2: Position has a CCXT API key → Use CCXT exchange
      if (brokerType === 'ccxt' && apiKey) {
        console.log(`📊 [${symbol}] Using CCXT ${apiKey.exchangeId} for price`);
        return await this.fetchFromCCXT(symbol, apiKey);
      }
      
      // CASE 3: No API key (brokerType === 'none') → Use fallback chain
      console.log(`📊 [${symbol}] Using fallback chain`);
      
      // For crypto, try public exchange
      if (this.isCryptoSymbol(symbol)) {
        const publicPrice = await this.fetchFromPublicExchange(symbol);
        if (publicPrice) return publicPrice;
      }
      
      // Try to find any CCXT API key for crypto fallback
      const fallback = await this.findFallbackApiKey(market, symbol);
      
      if (fallback.type === 'ccxt' && fallback.apiKey) {
        return await this.fetchFromCCXT(symbol, fallback.apiKey);
      }
      
      if (fallback.type === 'public') {
        return await this.fetchFromPublicExchange(symbol);
      }
      
      // Last resort for non-crypto - try centralized streaming again
      return await this.fetchFromCentralizedStreaming(symbol);
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Update all open paper positions with current prices
   * Uses broker-based streaming: MT5 positions use MT5, CCXT positions use CCXT
   */
  async updateAllPositions() {
    try {
      // Get active symbols with full broker info
      const symbols = await this.getActiveSymbols();
      
      if (symbols.length === 0) {
        return; // No open positions
      }

      console.log(`📊 Updating ${symbols.length} symbols:`, symbols.map(s => `${s.symbol}(${s.brokerType})`).join(', '));

      // Process each symbol based on its broker type
      for (const symbolInfo of symbols) {
        const priceData = await this.fetchPrice(symbolInfo);
        
        if (priceData) {
          // Update cache
          this.priceCache.set(symbolInfo.symbol.toUpperCase(), priceData);

          // Broadcast price to Redis for real-time updates
          await this.broadcastPrice(symbolInfo.symbol, priceData);

          // Update all positions for this symbol
          await paperTradingService.updatePriceForSymbol(symbolInfo.symbol, priceData.mid);
          
          console.log(`✅ [${symbolInfo.symbol}] Price updated: ${priceData.mid} (source: ${priceData.source})`);
        } else {
          console.warn(`⚠️ [${symbolInfo.symbol}] Could not fetch price`);
        }
      }
    } catch (error) {
      console.error('Error updating paper positions:', error);
    }
  }

  /**
   * Broadcast price update to Redis for real-time paper position MTM
   */
  async broadcastPrice(symbol, priceData) {
    try {
      if (!redisClient || !redisClient.isConnected) {
        return;
      }

      const message = {
        symbol: symbol.toUpperCase(),
        bid: priceData.bid,
        ask: priceData.ask,
        mid: priceData.mid,
        timestamp: new Date().toISOString()
      };

      // Publish to symbol-specific channel
      await redisClient.publisher.publish(
        `price:${symbol.toUpperCase()}`,
        JSON.stringify(message)
      );

      // Publish to global price channel
      await redisClient.publisher.publish(
        'price:all',
        JSON.stringify(message)
      );
    } catch (error) {
      console.error(`Error broadcasting price for ${symbol}:`, error.message);
    }
  }

  /**
   * Get cached price for a symbol
   */
  getCachedPrice(symbol) {
    return this.priceCache.get(symbol.toUpperCase());
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      cachedSymbols: Array.from(this.priceCache.keys()),
      priceCount: this.priceCache.size,
      ccxtExchangeCount: this.ccxtExchangeCache.size,
      hasPublicExchange: !!this.publicExchange
    };
  }

  /**
   * Cleanup resources on shutdown
   */
  async cleanup() {
    this.stop();
    
    // Close CCXT exchange connections
    for (const [key, exchange] of this.ccxtExchangeCache.entries()) {
      try {
        if (exchange.close) await exchange.close();
      } catch (e) {}
    }
    this.ccxtExchangeCache.clear();
    
    // Close public exchange
    if (this.publicExchange?.close) {
      try {
        await this.publicExchange.close();
      } catch (e) {}
    }
    this.publicExchange = null;
    
    console.log('📈 Paper position price updater cleaned up');
  }
}

// Export singleton instance
export const priceUpdater = new PaperPositionPriceUpdater();
export default priceUpdater;
