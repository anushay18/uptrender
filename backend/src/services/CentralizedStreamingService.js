/**
 * CentralizedStreamingService
 * 
 * SINGLE SOURCE OF TRUTH for price data streaming.
 * 
 * Architecture:
 * =============
 * 1. Admin configures ONE MetaAPI account for data streaming
 * 2. This service connects to MetaAPI and receives tick data
 * 3. Tick data is broadcast to ALL users via Redis pub/sub
 * 4. User brokers are ONLY used for trade execution, not data
 * 5. Small price differences between platform and brokers are acceptable
 *    (due to spread differences - this is manageable)
 * 
 * Benefits:
 * - NO rate limiting issues (single connection vs hundreds)
 * - Consistent price display across all users
 * - Simpler architecture and easier debugging
 * - Reduced server load (one stream vs per-broker streams)
 * 
 * Trade Execution (unchanged):
 * - Trades still execute on user's connected broker
 * - User gets filled at broker's actual price
 * - SL/TP calculated from actual fill price (risk-based)
 */

import { EventEmitter } from 'events';
import MetaApi from 'metaapi.cloud-sdk/esm-node';
import { DataStreamingSettings } from '../models/index.js';
import redisClient from '../utils/redisClient.js';
import DerivStreamingProvider from './DerivStreamingProvider.js';

class CentralizedStreamingService extends EventEmitter {
  constructor() {
    super();
    this.metaApi = null;
    this.account = null;
    this.connection = null;
    this.isConnected = false;
    this.isInitialized = false;
    this.settings = null;
    
    // Multi-provider support
    this.currentProvider = null; // 'metaapi' or 'deriv'
    this.derivProvider = null;
    
    // Price cache for all symbols
    // Key: symbol (uppercase), Value: { bid, ask, last, timestamp }
    this.priceCache = new Map();
    
    // Streaming statistics
    this.stats = {
      totalPriceUpdates: 0,
      lastPriceUpdate: null,
      startTime: null,
      errors: 0
    };
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    
    // Health check interval
    this.healthCheckInterval = null;
    
    console.log('🌐 CentralizedStreamingService initialized');
  }

  /**
   * Initialize the streaming service with admin-configured settings
   */
  async initialize() {
    try {
      console.log('📡 Initializing Centralized Streaming Service...');
      
      // Load settings from database
      this.settings = await DataStreamingSettings.findByPk(1);
      
      if (!this.settings) {
        console.log('⚠️ No streaming settings found. Admin needs to configure data provider.');
        return { success: false, message: 'No streaming settings configured' };
      }
      
      if (!this.settings.is_active) {
        console.log('⏸️ Streaming is disabled by admin');
        return { success: false, message: 'Streaming is disabled' };
      }
      
      // Determine which provider to use
      const provider = this.settings.data_provider || 'metaapi';
      this.currentProvider = provider;
      
      console.log(`📡 Using data provider: ${provider.toUpperCase()}`);
      
      if (provider === 'deriv') {
        // Initialize Deriv
        await this._initDeriv();
      } else {
        // Initialize MetaAPI (default)
        if (!this.settings.metaapi_token || !this.settings.metaapi_account_id) {
          console.log('⚠️ MetaAPI credentials not configured');
          return { success: false, message: 'MetaAPI credentials not configured' };
        }
        await this._initMetaApi();
      }
      
      this.isInitialized = true;
      this.stats.startTime = Date.now();
      
      // Start health check
      this._startHealthCheck();
      
      console.log('✅ Centralized Streaming Service initialized successfully');
      return { success: true, message: 'Streaming service initialized' };
    } catch (error) {
      console.error('❌ Failed to initialize streaming service:', error.message);
      await this._updateConnectionStatus('error', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Initialize Deriv streaming
   */
  async _initDeriv() {
    try {
      const appId = this.settings.deriv_app_id || '1089'; // Default demo app_id
      const symbols = this._parseSymbols(this.settings.symbols);
      
      console.log('🔌 Connecting to Deriv...');
      await this._updateConnectionStatus('connecting');
      
      // Create Deriv provider
      this.derivProvider = new DerivStreamingProvider();
      
      // Listen for price updates
      this.derivProvider.on('priceUpdate', async (priceData) => {
        await this._handlePriceUpdate(priceData);
      });
      
      this.derivProvider.on('error', (error) => {
        console.error('❌ Deriv provider error:', error.message);
        this.stats.errors++;
      });
      
      // Connect
      await this.derivProvider.connect(appId);
      
      // Subscribe to symbols
      await this.derivProvider.subscribeToSymbols(symbols);
      
      this.isConnected = true;
      await this._updateConnectionStatus('connected');
      
      console.log('✅ Deriv connected successfully');
    } catch (error) {
      console.error('❌ Deriv connection failed:', error.message);
      this.isConnected = false;
      await this._updateConnectionStatus('error', error.message);
      throw error;
    }
  }

  /**
   * Parse symbols from settings (handles JSON string or array)
   */
  _parseSymbols(symbols) {
    if (!symbols) return ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
    
    if (typeof symbols === 'string') {
      try {
        return JSON.parse(symbols);
      } catch (e) {
        return ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
      }
    }
    
    return Array.isArray(symbols) ? symbols : ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
  }

  /**
   * Initialize MetaAPI connection
   */
  async _initMetaApi() {
    try {
      const { metaapi_token, metaapi_account_id, symbols } = this.settings;
      
      console.log('🔌 Connecting to MetaAPI...');
      await this._updateConnectionStatus('connecting');
      
      // Initialize MetaApi SDK
      this.metaApi = new MetaApi(metaapi_token);
      
      // Get account
      this.account = await this.metaApi.metatraderAccountApi.getAccount(metaapi_account_id);
      
      // Check account state
      if (this.account.state !== 'DEPLOYED') {
        console.log('📦 Deploying MetaAPI account...');
        await this.account.deploy();
        await this.account.waitDeployed();
      }
      
      // Wait for connection
      console.log('⏳ Waiting for connection...');
      this.connection = this.account.getStreamingConnection();
      await this.connection.connect();
      await this.connection.waitSynchronized();
      
      this.isConnected = true;
      await this._updateConnectionStatus('connected');
      
      console.log('✅ MetaAPI connected successfully');
      
      // Subscribe to price updates for configured symbols
      await this._subscribeToSymbols(symbols || ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']);
      
      // Setup event listeners
      this._setupEventListeners();
      
    } catch (error) {
      console.error('❌ MetaAPI connection failed:', error.message);
      this.isConnected = false;
      await this._updateConnectionStatus('error', error.message);
      throw error;
    }
  }

  /**
   * Subscribe to price updates for symbols
   */
  async _subscribeToSymbols(symbols) {
    // Parse symbols if it's a JSON string
    let symbolsArray = symbols;
    if (typeof symbols === 'string') {
      try {
        symbolsArray = JSON.parse(symbols);
      } catch (e) {
        symbolsArray = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
      }
    }
    if (!Array.isArray(symbolsArray)) {
      symbolsArray = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
    }
    
    console.log(`📊 Subscribing to symbols: ${symbolsArray.join(', ')}`);
    
    for (const symbol of symbolsArray) {
      try {
        // Subscribe to tick data
        await this.connection.subscribeToMarketData(symbol, [
          { type: 'quotes' },
          { type: 'candles', timeframe: '1m' }
        ]);
        console.log(`✅ Subscribed to ${symbol}`);
      } catch (error) {
        console.warn(`⚠️ Failed to subscribe to ${symbol}:`, error.message);
      }
    }
  }

  /**
   * Setup event listeners for price updates
   */
  _setupEventListeners() {
    if (!this.connection) return;
    
    // Create a single comprehensive listener with all required methods
    const priceListener = {
      // Price update handlers
      onSymbolPriceUpdated: async (instanceIndex, price) => {
        await this._handlePriceUpdate(price);
      },
      onSymbolPricesUpdated: async (instanceIndex, prices) => {
        for (const price of prices) {
          await this._handlePriceUpdate(price);
        }
      },
      // Required but not used - provide empty implementations
      onCandlesUpdated: async (instanceIndex, candles, equity, margin, freeMargin, marginLevel, accountCurrencyExchangeRate) => {
        // No-op: We don't process candle updates
      },
      onConnected: (instanceIndex, replicas) => {
        console.log('📡 MetaAPI connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._updateConnectionStatus('connected');
      },
      onDisconnected: (instanceIndex) => {
        console.log('🔌 MetaAPI connection lost');
        this.isConnected = false;
        this._updateConnectionStatus('disconnected');
        this._attemptReconnect();
      },
      onSynchronizationStarted: (instanceIndex, specificationsHash, positionsHash, ordersHash, synchronizationId) => {
        console.log('🔄 MetaAPI synchronization started');
      },
      onAccountInformationUpdated: async (instanceIndex, accountInformation) => {
        // No-op
      },
      onPositionsReplaced: async (instanceIndex, positions) => {
        // No-op
      },
      onPositionUpdated: async (instanceIndex, position) => {
        // No-op
      },
      onPositionRemoved: async (instanceIndex, positionId) => {
        // No-op
      },
      onOrdersReplaced: async (instanceIndex, orders) => {
        // No-op
      },
      onOrderUpdated: async (instanceIndex, order) => {
        // No-op
      },
      onOrderCompleted: async (instanceIndex, orderId) => {
        // No-op
      },
      onHistoryOrderAdded: async (instanceIndex, order) => {
        // No-op
      },
      onDealAdded: async (instanceIndex, deal) => {
        // No-op
      },
      onSymbolSpecificationsUpdated: async (instanceIndex, specifications, removedSymbols) => {
        // No-op
      },
      onSymbolSpecificationUpdated: async (instanceIndex, specification) => {
        // No-op
      },
      onSymbolSpecificationRemoved: async (instanceIndex, symbol) => {
        // No-op
      },
      onHealthStatus: (instanceIndex, status) => {
        // Health status check - no action needed
      },
      onStreamClosed: (instanceIndex) => {
        console.log('📴 MetaAPI stream closed');
      },
      onBrokerConnectionStatusChanged: (instanceIndex, connected) => {
        console.log(`🔗 Broker connection status: ${connected ? 'connected' : 'disconnected'}`);
      },
      onPendingOrdersReplaced: async (instanceIndex, orders) => {
        // No-op
      },
      onPendingOrderUpdated: async (instanceIndex, order) => {
        // No-op
      },
      onPendingOrderCompleted: async (instanceIndex, orderId) => {
        // No-op
      }
    };
    
    this.connection.addSynchronizationListener(priceListener);
  }

  /**
   * Handle incoming price update
   */
  async _handlePriceUpdate(price) {
    if (!price?.symbol) return;
    
    const symbol = price.symbol.toUpperCase();
    const priceData = {
      symbol,
      bid: price.bid,
      ask: price.ask,
      last: price.last || ((price.bid + price.ask) / 2),
      mid: (price.bid + price.ask) / 2,
      timestamp: Date.now()
    };
    
    // Update cache
    this.priceCache.set(symbol, priceData);
    
    // Update stats
    this.stats.totalPriceUpdates++;
    this.stats.lastPriceUpdate = new Date().toISOString();
    
    // Emit local event
    this.emit('priceUpdate', priceData);
    
    // Broadcast via Redis to all connected clients
    await this._broadcastPrice(priceData);
  }

  /**
   * Broadcast price update via Redis pub/sub
   */
  async _broadcastPrice(priceData) {
    try {
      // Publish to symbol-specific channel
      await redisClient.publishPriceUpdate(priceData.symbol, priceData);
      
      // Also publish to global price channel for WebSocket broadcast
      if (redisClient.publisher) {
        await redisClient.publisher.publish('price:global', JSON.stringify(priceData));
      }
    } catch (error) {
      // Don't spam logs for Redis errors
      if (this.stats.errors % 100 === 0) {
        console.warn('⚠️ Redis broadcast error:', error.message);
      }
      this.stats.errors++;
    }
  }

  /**
   * Get current price for a symbol
   * Handles multiple symbol formats (Deriv uses prefixes like FRX for forex, CRY for crypto)
   */
  getPrice(symbol) {
    if (!symbol) return null;
    const normalizedSymbol = symbol.toUpperCase();
    
    // Try exact match first
    let price = this.priceCache.get(normalizedSymbol);
    if (price) return price;
    
    // Try with common Deriv prefixes
    const prefixes = ['FRX', 'CRY', 'WLD', 'SYN', 'JD', 'OTC'];
    for (const prefix of prefixes) {
      price = this.priceCache.get(`${prefix}${normalizedSymbol}`);
      if (price) return price;
    }
    
    // Try to find a match that ends with the symbol (handles any unknown prefix)
    for (const [key, value] of this.priceCache.entries()) {
      if (key.endsWith(normalizedSymbol)) {
        return value;
      }
    }
    
    return null;
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
   * Subscribe to price updates for a specific symbol (local subscription)
   */
  subscribe(symbol, callback) {
    const normalizedSymbol = symbol?.toUpperCase();
    
    const handler = (priceData) => {
      if (priceData.symbol === normalizedSymbol) {
        callback(priceData);
      }
    };
    
    this.on('priceUpdate', handler);
    
    // Return cached price immediately if available
    const cachedPrice = this.priceCache.get(normalizedSymbol);
    if (cachedPrice) {
      callback(cachedPrice);
    }
    
    // Return unsubscribe function
    return () => {
      this.off('priceUpdate', handler);
    };
  }

  /**
   * Attempt reconnection
   */
  async _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      await this._updateConnectionStatus('error', 'Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
    
    setTimeout(async () => {
      try {
        await this._initMetaApi();
      } catch (error) {
        console.error('❌ Reconnection failed:', error.message);
        this._attemptReconnect();
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Start health check interval
   */
  _startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      // Check if prices are stale (no update in 30 seconds)
      const lastUpdate = this.stats.lastPriceUpdate;
      if (lastUpdate) {
        const lastUpdateTime = new Date(lastUpdate).getTime();
        const now = Date.now();
        const staleThreshold = 30000; // 30 seconds
        
        if (now - lastUpdateTime > staleThreshold && this.isConnected) {
          console.warn('⚠️ Price data appears stale. Checking connection...');
          // Could trigger reconnect here if needed
        }
      }
      
      // Update stats in database periodically
      if (this.settings) {
        try {
          await this.settings.update({
            stats: {
              totalPriceUpdates: this.stats.totalPriceUpdates,
              lastPriceUpdate: this.stats.lastPriceUpdate,
              subscribersCount: this.listenerCount('priceUpdate'),
              uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0
            }
          });
        } catch (error) {
          // Ignore stats update errors
        }
      }
    }, 15000);
  }

  /**
   * Update connection status in database
   */
  async _updateConnectionStatus(status, error = null) {
    try {
      if (this.settings) {
        const update = {
          connection_status: status,
          last_error: error
        };
        
        if (status === 'connected') {
          update.last_connected_at = new Date();
        }
        
        await this.settings.update(update);
      }
    } catch (err) {
      console.warn('⚠️ Failed to update connection status:', err.message);
    }
  }

  /**
   * Add a new symbol to stream
   */
  async addSymbol(symbol) {
    const normalizedSymbol = symbol?.toUpperCase();
    
    if (!this.isConnected || !this.connection) {
      throw new Error('Streaming service not connected');
    }
    
    try {
      await this.connection.subscribeToMarketData(normalizedSymbol, [
        { type: 'quotes' }
      ]);
      
      // Update settings
      const currentSymbols = this.settings.symbols || [];
      if (!currentSymbols.includes(normalizedSymbol)) {
        await this.settings.update({
          symbols: [...currentSymbols, normalizedSymbol]
        });
      }
      
      console.log(`✅ Added symbol: ${normalizedSymbol}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to add symbol ${normalizedSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove a symbol from stream
   */
  async removeSymbol(symbol) {
    const normalizedSymbol = symbol?.toUpperCase();
    
    if (!this.isConnected || !this.connection) {
      throw new Error('Streaming service not connected');
    }
    
    try {
      await this.connection.unsubscribeFromMarketData(normalizedSymbol, [
        { type: 'quotes' }
      ]);
      
      // Remove from cache
      this.priceCache.delete(normalizedSymbol);
      
      // Update settings
      const currentSymbols = this.settings.symbols || [];
      await this.settings.update({
        symbols: currentSymbols.filter(s => s !== normalizedSymbol)
      });
      
      console.log(`✅ Removed symbol: ${normalizedSymbol}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to remove symbol ${normalizedSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.isConnected,
      connectionStatus: this.settings?.connection_status || 'unknown',
      provider: this.currentProvider || 'none',
      symbolCount: this.priceCache.size,
      symbols: Array.from(this.priceCache.keys()),
      stats: {
        ...this.stats,
        uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
        uptimeFormatted: this._formatUptime(this.stats.startTime)
      },
      config: this.settings ? {
        isActive: this.settings.is_active,
        configuredSymbols: this.settings.symbols,
        dataProvider: this.settings.data_provider || 'metaapi'
      } : null
    };
  }

  /**
   * Format uptime duration
   */
  _formatUptime(startTime) {
    if (!startTime) return '0s';
    
    const duration = Date.now() - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Reload settings from database
   */
  async reloadSettings() {
    try {
      this.settings = await DataStreamingSettings.findByPk(1);
      console.log('🔄 Streaming settings reloaded');
      return this.settings;
    } catch (error) {
      console.error('❌ Failed to reload settings:', error.message);
      throw error;
    }
  }

  /**
   * Stop the streaming service
   */
  async stop() {
    console.log('🛑 Stopping Centralized Streaming Service...');
    
    // Clear health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Close Deriv provider if active
    if (this.derivProvider) {
      try {
        await this.derivProvider.disconnect();
        this.derivProvider = null;
      } catch (error) {
        console.warn('⚠️ Error closing Deriv connection:', error.message);
      }
    }
    
    // Close MetaAPI connection
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (error) {
        console.warn('⚠️ Error closing MetaAPI connection:', error.message);
      }
    }
    
    this.isConnected = false;
    this.isInitialized = false;
    this.currentProvider = null;
    this.priceCache.clear();
    
    await this._updateConnectionStatus('disconnected');
    
    console.log('✅ Streaming service stopped');
  }

  /**
   * Restart the streaming service
   */
  async restart() {
    await this.stop();
    await this.initialize();
  }

  /**
   * Test connection with provided credentials
   */
  async testConnection(credentials) {
    const { provider = 'metaapi', metaApiToken, metaApiAccountId, derivAppId } = credentials;
    
    if (provider === 'deriv') {
      return this._testDerivConnection(derivAppId);
    } else {
      return this._testMetaApiConnection(metaApiToken, metaApiAccountId);
    }
  }

  /**
   * Test Deriv WebSocket connection
   */
  async _testDerivConnection(appId) {
    console.log('🧪 Testing Deriv connection...');
    
    try {
      const WebSocket = (await import('ws')).default;
      const testAppId = appId || '1089';
      const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${testAppId}`;
      
      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            success: false,
            error: 'Connection timeout'
          });
        }, 10000);
        
        ws.on('open', () => {
          // Send a simple ping request
          ws.send(JSON.stringify({ ping: 1 }));
        });
        
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.ping === 'pong' || msg.pong) {
              clearTimeout(timeout);
              ws.close();
              resolve({
                success: true,
                message: 'Deriv connection test successful',
                info: {
                  appId: testAppId,
                  endpoint: 'ws.binaryws.com'
                }
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          ws.close();
          resolve({
            success: false,
            error: error.message || 'Failed to connect to Deriv'
          });
        });
      });
    } catch (error) {
      console.error('❌ Deriv connection test failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to connect to Deriv'
      };
    }
  }

  /**
   * Test MetaAPI connection with provided credentials
   */
  async _testMetaApiConnection(metaApiToken, metaApiAccountId) {
    console.log('🧪 Testing MetaAPI connection...');
    
    try {
      // Create test MetaAPI instance
      const testMetaApi = new MetaApi(metaApiToken);
      
      // Try to get account
      const testAccount = await testMetaApi.metatraderAccountApi.getAccount(metaApiAccountId);
      
      if (!testAccount) {
        return {
          success: false,
          error: 'MetaAPI account not found'
        };
      }
      
      // Check account status
      const accountInfo = {
        name: testAccount.name,
        type: testAccount.type,
        platform: testAccount.platform,
        state: testAccount.state,
        connectionStatus: testAccount.connectionStatus
      };
      
      console.log('✅ MetaAPI account found:', accountInfo);
      
      // Try to deploy and wait briefly
      if (testAccount.state !== 'DEPLOYED') {
        await testAccount.deploy();
      }
      
      return {
        success: true,
        message: 'Connection test successful',
        accountInfo
      };
    } catch (error) {
      console.error('❌ MetaAPI connection test failed:', error.message);
      
      return {
        success: false,
        error: error.message || 'Failed to connect to MetaAPI'
      };
    }
  }
}

// Export singleton instance
const centralizedStreamingService = new CentralizedStreamingService();
export default centralizedStreamingService;
export { CentralizedStreamingService };
