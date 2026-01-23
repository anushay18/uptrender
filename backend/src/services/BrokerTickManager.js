/**
 * BrokerTickManager - Real-Time Tick Data Manager (Crypto Only)
 * 
 * ARCHITECTURE:
 * =============
 * 
 * 1. CRYPTO SEGMENT → Uses CCXT Pro WebSocket (per-broker, works great)
 *    - Each user gets prices from their own exchange (Binance, Delta, etc.)
 *    - No rate limiting issues with exchanges
 * 
 * 2. FOREX SEGMENT → Uses CentralizedStreamingService (admin-configured)
 *    - Single MetaAPI connection shared by all users
 *    - Eliminates rate limiting (single connection vs hundreds)
 *    - Admin configures the data source in Admin Panel > Data Streaming
 * 
 * 3. INDIAN SEGMENT → Placeholder (not yet implemented)
 * 
 * IMPORTANT:
 * - This service ONLY handles Crypto WebSocket streaming
 * - Forex prices are fetched from CentralizedStreamingService
 * - Trade execution still happens on user's own broker
 */

import { EventEmitter } from 'events';
import ccxt from 'ccxt';

class BrokerTickManager extends EventEmitter {
  constructor() {
    super();
    
    // Map of active CCXT connections (Crypto only)
    // Key: apiKeyId, Value: { broker, exchange, symbols, lastUpdate, status }
    this.connections = new Map();
    
    // Price cache per broker
    // Key: `${apiKeyId}:${symbol}`, Value: { bid, ask, last, timestamp }
    this.priceCache = new Map();
    
    // Subscription tracking
    // Key: `${apiKeyId}:${symbol}`, Value: Set of subscriber callbacks
    this.subscriptions = new Map();
    
    // Connection health check interval
    this.healthCheckInterval = null;
    
    // Rate limiting per broker
    this.rateLimits = new Map();
    
    console.log('📊 BrokerTickManager initialized (Crypto only mode)');
    
    // Wire price updates to SL/TP monitoring
    this.on('priceUpdate', async ({ apiKeyId, symbol, price }) => {
      try {
        const { default: positionAggregationService } = await import('./PositionAggregationService.js');
        await positionAggregationService.checkSlTpTriggers(apiKeyId, symbol, price);
      } catch (error) {
        console.error('Error in SL/TP monitoring:', error.message);
      }
    });
  }

  /**
   * Start streaming prices for a Crypto broker API key
   * Note: Only supports Crypto segment. Forex uses CentralizedStreamingService.
   * @param {Object} apiKey - ApiKey model instance
   * @returns {Promise<boolean>}
   */
  async startBrokerStream(apiKey) {
    const { id: apiKeyId, broker, segment, exchangeId, apiKey: key, apiSecret: secret, passphrase } = apiKey;
    
    // Only handle Crypto segment
    if (segment !== 'Crypto') {
      console.log(`ℹ️ Broker ${broker} (${segment}) uses centralized streaming - no per-broker stream needed`);
      return true; // Return true as it's handled by centralized streaming
    }
    
    // Check if already connected
    if (this.connections.has(apiKeyId)) {
      console.log(`📡 Crypto broker ${broker} (${apiKeyId}) already connected`);
      return true;
    }

    if (!exchangeId) {
      console.warn(`⚠️ Crypto broker ${broker} has no exchangeId configured`);
      return false;
    }

    try {
      // Initialize CCXT Pro WebSocket streaming
      const connection = await this._initCCXTStream(apiKeyId, exchangeId, key, secret, passphrase, broker);

      if (connection) {
        this.connections.set(apiKeyId, {
          broker,
          segment,
          exchangeId,
          connection,
          symbols: new Set(),
          status: 'connected',
          lastUpdate: Date.now(),
          errorCount: 0
        });

        console.log(`✅ Started CCXT stream for ${broker} (${apiKeyId})`);
        this.emit('brokerConnected', { apiKeyId, broker, segment });
        
        this._startHealthCheck();
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to start broker stream for ${broker}:`, error.message);
      this.emit('brokerError', { apiKeyId, broker, error: error.message });
      return false;
    }

    return false;
  }

  /**
   * Initialize CCXT Pro WebSocket stream for crypto exchanges
   * Uses ccxt.pro for REAL-TIME tick data (not REST polling)
   */
  async _initCCXTStream(apiKeyId, exchangeId, apiKey, apiSecret, passphrase, brokerName) {
    // Map custom exchange IDs to CCXT exchange classes
    const exchangeIdMap = {
      'deltademo': 'delta', // Delta Demo uses the same CCXT class as Delta
    };
    
    const ccxtExchangeId = exchangeIdMap[exchangeId] || exchangeId;
    const exchangeClass = ccxt.pro?.[ccxtExchangeId];
    
    if (!exchangeClass) {
      throw new Error(`Exchange ${exchangeId} does not support WebSocket (ccxt.pro required)`);
    }

    const config = {
      apiKey,
      secret: apiSecret,
      password: passphrase || undefined,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
      }
    };

    // Configure Delta Exchange for India API
    if (exchangeId === 'delta') {
      config.urls = {
        api: {
          public: 'https://api.india.delta.exchange',
          private: 'https://api.india.delta.exchange',
        },
      };
    }

    // Configure Delta Exchange Demo API
    if (exchangeId === 'deltademo') {
      config.urls = {
        api: {
          public: 'https://cdn.demo.delta.exchange',
          private: 'https://api.demo.delta.exchange',
        },
      };
    }

    const exchange = new exchangeClass(config);

    try {
      await exchange.loadMarkets();
    } catch (err) {
      console.warn(`⚠️ Could not load markets for ${exchangeId}:`, err.message);
    }

    // Store active WebSocket subscriptions with abort controllers
    const activeStreams = new Map();
    const abortControllers = new Map();

    return {
      type: 'ccxt',
      exchange,
      exchangeId,
      brokerName,
      activeStreams,
      abortControllers,
      
      /**
       * Start WebSocket stream for a symbol
       */
      startWebSocketStream: async (symbol) => {
        const streamKey = `${exchangeId}:${symbol}`;
        
        if (abortControllers.has(streamKey)) {
          console.log(`🔄 Cancelling existing stream for ${symbol} on ${brokerName}`);
          abortControllers.get(streamKey).abort();
        }
        
        const controller = new AbortController();
        abortControllers.set(streamKey, controller);
        activeStreams.set(symbol, true);

        const streamLoop = async () => {
          try {
            while (!controller.signal.aborted) {
              const ticker = await exchange.watchTicker(symbol);
              
              if (controller.signal.aborted) break;
              
              const priceData = {
                bid: ticker.bid,
                ask: ticker.ask,
                last: ticker.last,
                timestamp: Date.now()
              };
              
              this.priceCache.set(`${apiKeyId}:${symbol}`, priceData);
              
              this.emit('priceUpdate', { 
                apiKeyId, 
                broker: brokerName,
                symbol, 
                price: priceData 
              });
            }
          } catch (error) {
            if (controller.signal.aborted) return;
            
            console.error(`❌ WebSocket error for ${symbol} on ${brokerName}:`, error.message);
            activeStreams.delete(symbol);
            abortControllers.delete(streamKey);
            
            setTimeout(() => {
              if (!controller.signal.aborted) {
                this.startWebSocketStream(symbol);
              }
            }, 5000);
          }
        };

        streamLoop();
        console.log(`✅ WebSocket streaming started: ${symbol} on ${brokerName}`);
      },

      /**
       * Stop WebSocket stream for a symbol
       */
      stopWebSocketStream: (symbol) => {
        const streamKey = `${exchangeId}:${symbol}`;
        
        if (abortControllers.has(streamKey)) {
          abortControllers.get(streamKey).abort();
          abortControllers.delete(streamKey);
        }
        
        if (activeStreams.has(symbol)) {
          activeStreams.delete(symbol);
          console.log(`🔌 WebSocket stopped: ${symbol} on ${brokerName}`);
        }
      },
      
      /**
       * Fallback: REST polling if WebSocket fails
       */
      fetchPrices: async (symbols) => {
        const prices = {};
        for (const symbol of symbols) {
          try {
            const ticker = await exchange.fetchTicker(symbol);
            prices[symbol] = {
              bid: ticker.bid,
              ask: ticker.ask,
              last: ticker.last,
              timestamp: Date.now()
            };
            
            this.priceCache.set(`${apiKeyId}:${symbol}`, prices[symbol]);
            
            this.emit('priceUpdate', { 
              apiKeyId, 
              broker: brokerName,
              symbol, 
              price: prices[symbol] 
            });
          } catch (err) {
            console.warn(`⚠️ Failed to fetch ${symbol} from ${exchangeId}:`, err.message);
          }
        }
        return prices;
      }
    };
  }

  /**
   * Subscribe to price updates for a Crypto symbol
   * @param {number} apiKeyId - API key ID
   * @param {string} symbol - Trading symbol
   * @param {Function} callback - Callback for price updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(apiKeyId, symbol, callback) {
    const key = `${apiKeyId}:${symbol}`;
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    
    this.subscriptions.get(key).add(callback);
    
    const connection = this.connections.get(apiKeyId);
    if (connection) {
      connection.symbols.add(symbol);
      
      if (connection.connection?.type === 'ccxt' && connection.connection?.startWebSocketStream) {
        connection.connection.startWebSocketStream(symbol).catch(err => {
          console.warn(`⚠️ WebSocket start failed for ${symbol}:`, err.message);
          this._startPolling(apiKeyId);
        });
      } else {
        this._startPolling(apiKeyId);
      }
    }
    
    const cachedPrice = this.priceCache.get(key);
    if (cachedPrice) {
      callback(cachedPrice);
    }
    
    return () => {
      const subs = this.subscriptions.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(key);
          if (connection) {
            connection.symbols.delete(symbol);
            if (connection.connection?.type === 'ccxt' && connection.connection?.stopWebSocketStream) {
              connection.connection.stopWebSocketStream(symbol);
            }
          }
        }
      }
    };
  }

  /**
   * Get current price for a Crypto symbol from specific broker
   * @param {number} apiKeyId - API key ID
   * @param {string} symbol - Trading symbol
   * @returns {Object|null} Price data or null
   */
  getPrice(apiKeyId, symbol) {
    const key = `${apiKeyId}:${symbol}`;
    return this.priceCache.get(key) || null;
  }

  /**
   * Get all prices for a broker
   * @param {number} apiKeyId - API key ID
   * @returns {Object} Map of symbol -> price
   */
  getBrokerPrices(apiKeyId) {
    const prices = {};
    for (const [key, price] of this.priceCache.entries()) {
      if (key.startsWith(`${apiKeyId}:`)) {
        const symbol = key.split(':')[1];
        prices[symbol] = price;
      }
    }
    return prices;
  }

  /**
   * Start polling for price updates on a broker
   */
  _startPolling(apiKeyId) {
    if (this.rateLimits.has(apiKeyId)) {
      return;
    }

    const connection = this.connections.get(apiKeyId);
    if (!connection || !connection.connection) {
      return;
    }

    const interval = setInterval(async () => {
      if (connection.symbols.size === 0) {
        return;
      }

      try {
        const symbols = Array.from(connection.symbols);
        await connection.connection.fetchPrices(symbols);
        connection.lastUpdate = Date.now();
        connection.errorCount = 0;
      } catch (error) {
        connection.errorCount++;
        console.warn(`⚠️ Polling error for ${connection.broker}:`, error.message);
        
        if (connection.errorCount > 5) {
          this.emit('brokerDisconnected', { 
            apiKeyId, 
            broker: connection.broker, 
            reason: 'Too many errors' 
          });
        }
      }
    }, 2000);

    this.rateLimits.set(apiKeyId, interval);
  }

  /**
   * Stop broker stream
   * @param {number} apiKeyId - API key ID
   */
  stopBrokerStream(apiKeyId) {
    const connection = this.connections.get(apiKeyId);
    if (!connection) {
      return;
    }

    const interval = this.rateLimits.get(apiKeyId);
    if (interval) {
      clearInterval(interval);
      this.rateLimits.delete(apiKeyId);
    }

    for (const [key] of this.subscriptions.entries()) {
      if (key.startsWith(`${apiKeyId}:`)) {
        this.subscriptions.delete(key);
      }
    }

    for (const [key] of this.priceCache.entries()) {
      if (key.startsWith(`${apiKeyId}:`)) {
        this.priceCache.delete(key);
      }
    }

    if (connection.connection?.type === 'ccxt' && connection.connection?.exchange?.close) {
      try {
        connection.connection.exchange.close();
      } catch (err) {
        console.warn(`⚠️ Error closing CCXT connection:`, err.message);
      }
    }

    this.connections.delete(apiKeyId);
    console.log(`🔌 Stopped tick stream for broker ${connection.broker} (${apiKeyId})`);
    
    this.emit('brokerDisconnected', { apiKeyId, broker: connection.broker });
  }

  /**
   * Start health check interval
   */
  _startHealthCheck() {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [apiKeyId, connection] of this.connections.entries()) {
        if (now - connection.lastUpdate > 30000 && connection.symbols.size > 0) {
          console.warn(`⚠️ Stale connection for ${connection.broker} (${apiKeyId})`);
          connection.status = 'stale';
          this.emit('brokerStale', { apiKeyId, broker: connection.broker });
        }
      }
    }, 15000);
  }

  /**
   * Get connection status for all brokers
   * @returns {Object[]}
   */
  getStatus() {
    const status = [];
    for (const [apiKeyId, connection] of this.connections.entries()) {
      status.push({
        apiKeyId,
        broker: connection.broker,
        segment: connection.segment,
        status: connection.status,
        symbolCount: connection.symbols.size,
        lastUpdate: connection.lastUpdate,
        errorCount: connection.errorCount
      });
    }
    return status;
  }

  /**
   * Shutdown all connections
   */
  async shutdown() {
    console.log('🔌 Shutting down BrokerTickManager...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    for (const apiKeyId of this.connections.keys()) {
      this.stopBrokerStream(apiKeyId);
    }

    console.log('✅ BrokerTickManager shutdown complete');
  }
}

// Export singleton instance
const brokerTickManager = new BrokerTickManager();
export default brokerTickManager;
export { BrokerTickManager };
