/**
 * Paper Position Price Updater
 * Background service that updates paper position prices and checks SL/TP
 */

import { PaperPosition, ApiKey } from '../models/index.js';
import { mt5Broker } from '../../algoengine/index.js';
import { paperTradingService } from '../services/PaperTradingService.js';
import { Op } from 'sequelize';
import redisClient from '../utils/redisClient.js';

class PaperPositionPriceUpdater {
  constructor() {
    this.isRunning = false;
    this.updateInterval = null;
    this.intervalMs = 5000; // Update every 5 seconds
    this.subscribedSymbols = new Set();
    this.priceCache = new Map();
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
   * Get unique symbols from all open paper positions
   */
  async getActiveSymbols() {
    try {
      const positions = await PaperPosition.findAll({
        where: { status: 'Open' },
        attributes: ['symbol', 'market'],
        group: ['symbol', 'market']
      });

      return positions.map(p => ({
        symbol: p.symbol,
        market: p.market
      }));
    } catch (error) {
      console.error('Error getting active symbols:', error);
      return [];
    }
  }

  /**
   * Initialize MT5 connection using ANY available API key
   * (doesn't need to be user-specific for price data)
   */
  async initializeBroker(market = 'Forex') {
    try {
      // Get ANY active MT5 API key from ANY user (for price data only)
      const apiKey = await ApiKey.findOne({
        where: { 
          segment: market,
          broker: 'MT5',
          status: 'Active'
        },
        order: [['updatedAt', 'DESC']] // Get most recently used
      });

      if (!apiKey || !apiKey.accessToken || !apiKey.appName) {
        console.warn(`⚠️ No active ${market} MT5 API key found for price updates`);
        return false;
      }

      console.log(`📡 Using API key ID ${apiKey.id} (User ${apiKey.userId}) for ${market} price data`);

      const isConnected = await mt5Broker.healthCheck().catch(() => false);
      if (!isConnected) {
        await mt5Broker.initialize({
          apiKey: apiKey.accessToken,
          accountId: apiKey.appName
        });
      }

      return true;
    } catch (error) {
      console.error('Error initializing broker for price updates:', error);
      return false;
    }
  }

  /**
   * Fetch price for a symbol
   */
  async fetchPrice(symbol) {
    try {
      const priceData = await mt5Broker.getPrice(symbol.toUpperCase());
      if (priceData && priceData.bid) {
        return {
          bid: priceData.bid,
          ask: priceData.ask,
          mid: (priceData.bid + priceData.ask) / 2
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Update all open paper positions with current prices
   */
  async updateAllPositions() {
    try {
      // Get active symbols
      const symbols = await this.getActiveSymbols();
      
      if (symbols.length === 0) {
        return; // No open positions
      }

      // Group by market for broker initialization
      const marketGroups = {};
      for (const { symbol, market } of symbols) {
        if (!marketGroups[market]) {
          marketGroups[market] = [];
        }
        marketGroups[market].push(symbol);
      }

      // Process each market
      for (const [market, marketSymbols] of Object.entries(marketGroups)) {
        // Initialize broker for this market
        const isConnected = await this.initializeBroker(market);
        if (!isConnected) {
          console.warn(`⚠️ Could not connect to broker for ${market} market`);
          continue;
        }

        // Fetch prices for all symbols in this market
        for (const symbol of marketSymbols) {
          const priceData = await this.fetchPrice(symbol);
          
          if (priceData) {
            // Update cache
            this.priceCache.set(symbol, priceData);

            // Broadcast price to Redis for real-time updates
            await this.broadcastPrice(symbol, priceData);

            // Update all positions for this symbol using the mid price
            // (or bid/ask based on position type, handled in service)
            await paperTradingService.updatePriceForSymbol(symbol, priceData.mid);
          }
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
      priceCount: this.priceCache.size
    };
  }
}

// Export singleton instance
export const priceUpdater = new PaperPositionPriceUpdater();
export default priceUpdater;
