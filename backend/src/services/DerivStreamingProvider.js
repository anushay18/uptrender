/**
 * DerivStreamingProvider
 * 
 * Provides price data streaming via Deriv's free WebSocket API.
 * This is a FREE alternative to MetaAPI that works for major Forex pairs.
 * 
 * Deriv API Documentation: https://api.deriv.com/
 * 
 * Supported Symbols:
 * - Forex: EURUSD, GBPUSD, USDJPY, etc.
 * - Commodities: XAUUSD (Gold), XAGUSD (Silver)
 * - Crypto: BTCUSD, ETHUSD, etc.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Deriv symbol mapping (our symbol -> deriv symbol)
const SYMBOL_MAPPING = {
  // Forex
  'EURUSD': 'frxEURUSD',
  'GBPUSD': 'frxGBPUSD',
  'USDJPY': 'frxUSDJPY',
  'USDCHF': 'frxUSDCHF',
  'AUDUSD': 'frxAUDUSD',
  'NZDUSD': 'frxNZDUSD',
  'USDCAD': 'frxUSDCAD',
  'EURJPY': 'frxEURJPY',
  'GBPJPY': 'frxGBPJPY',
  'EURGBP': 'frxEURGBP',
  'EURCAD': 'frxEURCAD',
  'EURAUD': 'frxEURAUD',
  'EURNZD': 'frxEURNZD',
  'GBPAUD': 'frxGBPAUD',
  'GBPCAD': 'frxGBPCAD',
  'AUDCAD': 'frxAUDCAD',
  'AUDNZD': 'frxAUDNZD',
  'AUDCHF': 'frxAUDCHF',
  'CADJPY': 'frxCADJPY',
  'CHFJPY': 'frxCHFJPY',
  'NZDJPY': 'frxNZDJPY',
  
  // Commodities
  'XAUUSD': 'frxXAUUSD',
  'XAGUSD': 'frxXAGUSD',
  
  // Crypto (synthetic indices - may need adjustment)
  'BTCUSD': 'cryBTCUSD',
  'ETHUSD': 'cryETHUSD',
  'LTCUSD': 'cryLTCUSD'
};

// Reverse mapping
const REVERSE_SYMBOL_MAPPING = {};
Object.keys(SYMBOL_MAPPING).forEach(key => {
  REVERSE_SYMBOL_MAPPING[SYMBOL_MAPPING[key]] = key;
});

class DerivStreamingProvider extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isConnected = false;
    this.appId = null;
    this.subscribedSymbols = new Set();
    this.subscriptionIds = new Map(); // derivSymbol -> subscription_id
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.priceCache = new Map();
    
    // Stats
    this.stats = {
      totalPriceUpdates: 0,
      lastPriceUpdate: null,
      startTime: null,
      errors: 0
    };
  }

  /**
   * Initialize connection with Deriv API
   * @param {string} appId - Deriv App ID (can be demo app_id: 1089)
   */
  async connect(appId = '1089') {
    return new Promise((resolve, reject) => {
      try {
        this.appId = appId;
        const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${appId}`;
        
        console.log(`🔌 Connecting to Deriv WebSocket (App ID: ${appId})...`);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.on('open', () => {
          console.log('✅ Connected to Deriv WebSocket');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.stats.startTime = Date.now();
          
          // Start ping to keep connection alive
          this.startPing();
          
          resolve({ success: true, message: 'Connected to Deriv' });
        });
        
        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing Deriv message:', error.message);
          }
        });
        
        this.ws.on('error', (error) => {
          console.error('❌ Deriv WebSocket error:', error.message);
          this.stats.errors++;
          this.emit('error', error);
        });
        
        this.ws.on('close', () => {
          console.log('🔌 Deriv WebSocket closed');
          this.isConnected = false;
          this.stopPing();
          this.attemptReconnect();
        });
        
        // Timeout for initial connection
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        console.error('❌ Failed to connect to Deriv:', error.message);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    if (message.error) {
      console.error('❌ Deriv API Error:', message.error.message);
      this.stats.errors++;
      return;
    }
    
    // Handle tick stream
    if (message.msg_type === 'tick') {
      const tick = message.tick;
      const derivSymbol = tick.symbol;
      const ourSymbol = REVERSE_SYMBOL_MAPPING[derivSymbol] || derivSymbol;
      
      const priceData = {
        symbol: ourSymbol,
        bid: parseFloat(tick.bid),
        ask: parseFloat(tick.ask),
        last: parseFloat(tick.quote),
        mid: (parseFloat(tick.bid) + parseFloat(tick.ask)) / 2,
        timestamp: Date.now(),
        epoch: tick.epoch
      };
      
      // Update cache
      this.priceCache.set(ourSymbol, priceData);
      
      // Update stats
      this.stats.totalPriceUpdates++;
      this.stats.lastPriceUpdate = new Date().toISOString();
      
      // Emit price update
      this.emit('priceUpdate', priceData);
    }
    
    // Handle subscription confirmation
    if (message.msg_type === 'tick' && message.subscription) {
      const derivSymbol = message.tick?.symbol;
      if (derivSymbol) {
        this.subscriptionIds.set(derivSymbol, message.subscription.id);
        console.log(`✅ Subscribed to ${derivSymbol} (ID: ${message.subscription.id})`);
      }
    }
    
    // Handle ping response
    if (message.msg_type === 'ping') {
      // Connection is alive
    }
  }

  /**
   * Subscribe to price updates for symbols
   */
  async subscribeToSymbols(symbols) {
    if (!this.isConnected) {
      throw new Error('Not connected to Deriv');
    }
    
    const validSymbols = [];
    
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const derivSymbol = SYMBOL_MAPPING[upperSymbol];
      
      if (!derivSymbol) {
        console.warn(`⚠️ Symbol ${upperSymbol} not supported in Deriv mapping`);
        continue;
      }
      
      if (this.subscribedSymbols.has(derivSymbol)) {
        console.log(`ℹ️ Already subscribed to ${upperSymbol}`);
        continue;
      }
      
      // Send subscription request
      const request = {
        ticks: derivSymbol,
        subscribe: 1
      };
      
      this.ws.send(JSON.stringify(request));
      this.subscribedSymbols.add(derivSymbol);
      validSymbols.push(upperSymbol);
    }
    
    console.log(`📊 Subscribing to Deriv symbols: ${validSymbols.join(', ')}`);
    return validSymbols;
  }

  /**
   * Unsubscribe from a symbol
   */
  async unsubscribeFromSymbol(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const derivSymbol = SYMBOL_MAPPING[upperSymbol];
    
    if (!derivSymbol || !this.subscribedSymbols.has(derivSymbol)) {
      return;
    }
    
    const subscriptionId = this.subscriptionIds.get(derivSymbol);
    
    if (subscriptionId && this.isConnected) {
      const request = {
        forget: subscriptionId
      };
      this.ws.send(JSON.stringify(request));
    }
    
    this.subscribedSymbols.delete(derivSymbol);
    this.subscriptionIds.delete(derivSymbol);
    console.log(`🔕 Unsubscribed from ${upperSymbol}`);
  }

  /**
   * Get cached price for a symbol
   */
  getPrice(symbol) {
    return this.priceCache.get(symbol.toUpperCase());
  }

  /**
   * Get all cached prices
   */
  getAllPrices() {
    const prices = {};
    this.priceCache.forEach((value, key) => {
      prices[key] = value;
    });
    return prices;
  }

  /**
   * Start ping to keep connection alive
   */
  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Attempt to reconnect on disconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached for Deriv');
      this.emit('maxReconnectReached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000);
    
    console.log(`🔄 Attempting to reconnect to Deriv in ${delay/1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect(this.appId);
        // Resubscribe to symbols
        const symbols = Array.from(this.subscribedSymbols).map(ds => REVERSE_SYMBOL_MAPPING[ds] || ds);
        this.subscribedSymbols.clear();
        await this.subscribeToSymbols(symbols);
      } catch (error) {
        console.error('❌ Reconnection failed:', error.message);
      }
    }, delay);
  }

  /**
   * Disconnect from Deriv
   */
  async disconnect() {
    console.log('🔌 Disconnecting from Deriv...');
    
    this.stopPing();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.subscribedSymbols.clear();
    this.subscriptionIds.clear();
    this.priceCache.clear();
    
    console.log('✅ Disconnected from Deriv');
  }

  /**
   * Get streaming stats
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
      subscribedCount: this.subscribedSymbols.size,
      cachedPrices: this.priceCache.size
    };
  }

  /**
   * Test connection without subscribing
   */
  async testConnection(appId = '1089') {
    try {
      console.log('🧪 Testing Deriv connection...');
      
      const testWs = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${appId}`);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          testWs.close();
          reject(new Error('Connection test timeout'));
        }, 10000);
        
        testWs.on('open', () => {
          clearTimeout(timeout);
          testWs.close();
          resolve({
            success: true,
            message: 'Deriv connection test successful',
            provider: 'deriv',
            appId
          });
        });
        
        testWs.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get supported symbols
   */
  static getSupportedSymbols() {
    return Object.keys(SYMBOL_MAPPING);
  }

  /**
   * Check if a symbol is supported
   */
  static isSymbolSupported(symbol) {
    return !!SYMBOL_MAPPING[symbol.toUpperCase()];
  }
}

export default DerivStreamingProvider;
export { SYMBOL_MAPPING, REVERSE_SYMBOL_MAPPING };
