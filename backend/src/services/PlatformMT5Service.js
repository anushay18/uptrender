/**
 * Platform MT5 Service - Single Shared Connection
 * 
 * ARCHITECTURE:
 * =============
 * - ONE MetaAPI connection for the entire platform (using platform API key)
 * - Used for: Paper trading, price feeds, general market data
 * - Broadcasts prices via Redis to all connected users
 * - User's personal API is ONLY used when executing REAL trades
 * 
 * This solves the MetaAPI 25 subscription limit by:
 * 1. Using one platform account for all price data
 * 2. Only connecting user accounts when executing trades (then disconnect)
 * 3. Broadcasting prices via Redis pub/sub
 */

import redisClient from '../utils/redisClient.js';
import { EventEmitter } from 'events';
import metaApiRateLimiter from '../utils/MetaApiRateLimiter.js';

class PlatformMT5Service extends EventEmitter {
  constructor() {
    super();
    this.metaApi = null;
    this.account = null;
    this.connection = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.priceCache = new Map(); // symbol -> { bid, ask, last, timestamp }
    this.subscribedSymbols = new Set();
    this.priceUpdateInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // Reduced from 5
    this.reconnectDelay = 30000; // Start with 30 seconds
    this.maxReconnectDelay = 300000; // Max 5 minutes
    
    // Default symbols to stream for paper trading
    this.defaultSymbols = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD',
      'ETHUSD', 'US30', 'US500', 'USTEC'
    ];
  }

  /**
   * Initialize the platform MT5 connection
   * Uses environment variables for platform credentials
   */
  async initialize() {
    if (this.isConnected) {
      console.log('✅ Platform MT5 already connected');
      return true;
    }

    if (this.isConnecting) {
      console.log('⏳ Platform MT5 connection in progress...');
      return false;
    }

    // Check rate limiter before attempting connection
    const platformAccountId = process.env.METAAPI_ACCOUNT_ID;
    if (platformAccountId && metaApiRateLimiter.shouldSkipConnection(platformAccountId)) {
      console.warn('⚠️ Platform MT5 connection skipped due to rate limiting');
      this.scheduleRetry();
      return false;
    }

    this.isConnecting = true;

    try {
      // Get platform MT5 credentials from environment
      const platformApiKey = process.env.METAAPI_TOKEN;

      if (!platformApiKey || !platformAccountId) {
        console.warn('⚠️ Platform MT5 credentials not configured. Paper trading will use mock prices.');
        console.warn('   Set METAAPI_TOKEN and METAAPI_ACCOUNT_ID in .env for live prices');
        this.isConnecting = false;
        return false;
      }

      console.log('🔌 Initializing Platform MT5 connection...');

      // Request connection from rate limiter
      try {
        await metaApiRateLimiter.requestConnection(platformAccountId);
      } catch (error) {
        console.warn(`⚠️ Rate limiter blocked Platform MT5 connection: ${error.message}`);
        this.isConnecting = false;
        this.scheduleRetry();
        return false;
      }

      // Dynamic import to avoid loading if not needed
      const MetaApi = (await import('metaapi.cloud-sdk/esm-node')).default;
      
      this.metaApi = new MetaApi(platformApiKey);
      this.account = await this.metaApi.metatraderAccountApi.getAccount(platformAccountId);

      if (!this.account) {
        throw new Error('Platform MT5 account not found');
      }

      // Get RPC connection for trading operations
      this.connection = this.account.getRPCConnection();
      await this.connection.connect();
      
      // Wait for sync with timeout
      await this.connection.waitSynchronized({ timeout: 45000 });

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 30000; // Reset delay

      metaApiRateLimiter.recordSuccess(platformAccountId);
      metaApiRateLimiter.releaseConnection(platformAccountId);

      console.log('✅ Platform MT5 connected successfully');

      // Start price streaming
      this.startPriceStreaming();

      return true;
    } catch (error) {
      console.error('❌ Platform MT5 connection failed:', error.message);
      this.isConnecting = false;
      this.isConnected = false;

      // Record failure with rate limiter
      if (platformAccountId) {
        if (error.status === 429 || error.message?.includes('429')) {
          metaApiRateLimiter.recordRateLimitError(platformAccountId);
        } else {
          metaApiRateLimiter.recordFailure(platformAccountId);
        }
        metaApiRateLimiter.releaseConnection(platformAccountId);
      }

      // Schedule retry with exponential backoff
      this.scheduleRetry();

      return false;
    }
  }

  /**
   * Schedule a retry with exponential backoff
   */
  scheduleRetry() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, this.maxReconnectDelay);
      console.log(`🔄 Retrying Platform MT5 connection in ${delay/1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.initialize(), delay);
    } else {
      console.warn(`⚠️ Platform MT5 connection failed after ${this.maxReconnectAttempts} attempts. Giving up.`);
      console.warn(`   Paper trading will use mock prices. Check METAAPI_TOKEN and METAAPI_ACCOUNT_ID.`);
    }
  }

  /**
   * Start streaming prices for default symbols
   */
  async startPriceStreaming() {
    if (!this.isConnected) {
      console.warn('⚠️ Cannot start price streaming - not connected');
      return;
    }

    console.log('📊 Starting platform price streaming...');

    // Add default symbols
    for (const symbol of this.defaultSymbols) {
      this.subscribedSymbols.add(symbol);
    }

    // Start polling prices every 5 seconds
    this.priceUpdateInterval = setInterval(async () => {
      await this.updateAllPrices();
    }, 5000);

    // Initial price fetch
    await this.updateAllPrices();

    console.log(`✅ Price streaming started for ${this.subscribedSymbols.size} symbols`);
  }

  /**
   * Update prices for all subscribed symbols
   */
  async updateAllPrices() {
    if (!this.isConnected || !this.connection) {
      return;
    }

    const priceUpdates = {};

    for (const symbol of this.subscribedSymbols) {
      try {
        const price = await this.connection.getSymbolPrice(symbol);
        
        if (price) {
          const priceData = {
            symbol,
            bid: price.bid,
            ask: price.ask,
            last: price.bid, // Use bid as last price
            timestamp: Date.now()
          };

          this.priceCache.set(symbol, priceData);
          priceUpdates[symbol] = priceData;
        }
      } catch (err) {
        // Don't spam logs for individual symbol errors
        if (!err.message?.includes('timeout')) {
          console.debug(`⚠️ Price fetch failed for ${symbol}:`, err.message);
        }
      }
    }

    // Broadcast all prices via Redis
    if (Object.keys(priceUpdates).length > 0) {
      await this.broadcastPrices(priceUpdates);
    }
  }

  /**
   * Broadcast prices to all users via Redis
   */
  async broadcastPrices(priceUpdates) {
    if (!redisClient.isConnected) {
      return;
    }

    try {
      // Publish to a global price channel
      await redisClient.publisher.publish('platform:prices', JSON.stringify({
        type: 'price_update',
        prices: priceUpdates,
        timestamp: Date.now()
      }));

      // Also store in Redis for quick access
      for (const [symbol, price] of Object.entries(priceUpdates)) {
        await redisClient.client.hset('prices:mt5', symbol, JSON.stringify(price));
      }
    } catch (error) {
      console.error('❌ Failed to broadcast prices:', error.message);
    }
  }

  /**
   * Get current price for a symbol (from cache or fetch)
   */
  async getPrice(symbol) {
    // Check cache first
    if (this.priceCache.has(symbol)) {
      const cached = this.priceCache.get(symbol);
      // Return if cached within last 10 seconds
      if (Date.now() - cached.timestamp < 10000) {
        return cached;
      }
    }

    // Try Redis cache
    try {
      if (redisClient.isConnected) {
        const redisPrice = await redisClient.client.hget('prices:mt5', symbol);
        if (redisPrice) {
          const parsed = JSON.parse(redisPrice);
          if (Date.now() - parsed.timestamp < 10000) {
            this.priceCache.set(symbol, parsed);
            return parsed;
          }
        }
      }
    } catch (err) {
      // Ignore Redis errors
    }

    // Fetch fresh price if connected
    if (this.isConnected && this.connection) {
      try {
        const price = await this.connection.getSymbolPrice(symbol);
        if (price) {
          const priceData = {
            symbol,
            bid: price.bid,
            ask: price.ask,
            last: price.bid,
            timestamp: Date.now()
          };
          this.priceCache.set(symbol, priceData);
          
          // Add to subscribed symbols
          this.subscribedSymbols.add(symbol);
          
          return priceData;
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch price for ${symbol}:`, err.message);
      }
    }

    // Return mock price for paper trading if not connected
    return this.getMockPrice(symbol);
  }

  /**
   * Generate mock price for paper trading when MT5 is not connected
   */
  getMockPrice(symbol) {
    // Base mock prices for common symbols
    const mockPrices = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 148.50,
      'XAUUSD': 2050.00,
      'BTCUSD': 45000.00,
      'ETHUSD': 2500.00,
      'US30': 38000.00,
      'US500': 4800.00,
      'USTEC': 17000.00
    };

    const basePrice = mockPrices[symbol] || 100.00;
    // Add small random variation
    const spread = basePrice * 0.0001;
    
    return {
      symbol,
      bid: basePrice - spread,
      ask: basePrice + spread,
      last: basePrice,
      timestamp: Date.now(),
      isMock: true
    };
  }

  /**
   * Subscribe to price updates for a symbol
   */
  subscribeSymbol(symbol) {
    if (!this.subscribedSymbols.has(symbol)) {
      this.subscribedSymbols.add(symbol);
      console.log(`📊 Added ${symbol} to price streaming`);
    }
  }

  /**
   * Unsubscribe from price updates for a symbol
   */
  unsubscribeSymbol(symbol) {
    // Don't remove default symbols
    if (!this.defaultSymbols.includes(symbol)) {
      this.subscribedSymbols.delete(symbol);
    }
  }

  /**
   * Get account information (for platform account)
   */
  async getAccountInfo() {
    if (!this.isConnected || !this.connection) {
      return null;
    }

    try {
      return await this.connection.getAccountInformation();
    } catch (error) {
      console.error('Failed to get account info:', error.message);
      return null;
    }
  }

  /**
   * Check if platform connection is healthy
   */
  async healthCheck() {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.connection.getAccountInformation();
      return true;
    } catch (error) {
      console.warn('⚠️ Platform MT5 health check failed:', error.message);
      this.isConnected = false;
      // Try to reconnect
      this.initialize();
      return false;
    }
  }

  /**
   * Stop price streaming and disconnect
   */
  async disconnect() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
      } catch (error) {
        console.error('Error closing connection:', error.message);
      }
    }

    this.isConnected = false;
    this.connection = null;
    this.account = null;
    this.priceCache.clear();
    this.subscribedSymbols.clear();

    console.log('🔌 Platform MT5 disconnected');
  }

  /**
   * Get all cached prices
   */
  getAllPrices() {
    const prices = {};
    for (const [symbol, price] of this.priceCache.entries()) {
      prices[symbol] = price;
    }
    return prices;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      subscribedSymbols: Array.from(this.subscribedSymbols),
      pricesCached: this.priceCache.size,
      lastUpdate: this.priceCache.size > 0 
        ? Math.max(...Array.from(this.priceCache.values()).map(p => p.timestamp))
        : null
    };
  }
}

// Singleton instance
const platformMT5Service = new PlatformMT5Service();
export default platformMT5Service;
