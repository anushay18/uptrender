import { Trade, ApiKey } from '../models/index.js';
import mt5BrokerPool from '../utils/mt5BrokerPool.js';
import { emitTradeUpdate } from '../config/socket.js';
import { Op } from 'sequelize';
import metaApiRateLimiter from '../utils/MetaApiRateLimiter.js';

/**
 * Broker Position Sync Service
 * Periodically checks broker for position status and syncs with database
 * Detects positions closed on broker side and updates dashboard
 * 
 * NOTE: Uses connection pool to avoid MetaAPI subscription limit (25 max)
 * DISABLED by default - only enable when there are active MT5 trades
 * NOW WITH RATE LIMITING to prevent HTTP 429 errors
 */
class BrokerPositionSyncService {
  constructor() {
    this.syncInterval = 180000; // 3 minutes (increased from 60s to reduce API calls)
    this.syncTimer = null;
    this.isRunning = false;
    this.isSyncing = false; // Prevent overlapping syncs
    this.lastSync = null;
    this.enabled = false; // Disabled by default to avoid quota issues
    this.maxConcurrentConnections = 2; // Reduced from 3 to be more conservative
  }

  /**
   * Start the sync service (only if explicitly enabled)
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Broker Position Sync already running');
      return;
    }

    // Check if there are any open MT5 trades before starting
    this._checkAndStart();
  }

  /**
   * Check if there are open MT5 trades before starting sync
   */
  async _checkAndStart() {
    try {
      const openMT5Trades = await Trade.count({
        where: {
          status: 'Open',
          broker: 'MT5'
        }
      });

      if (openMT5Trades === 0) {
        console.log('✅ Broker Position Sync: No open MT5 trades - staying idle');
        this.isRunning = false;
        return;
      }

      console.log(`🔄 Starting Broker Position Sync Service (${openMT5Trades} open MT5 trades)...`);
      this.isRunning = true;
      this.enabled = true;
      
      // Wait 60 seconds before first sync to avoid startup connection storm
      console.log('⏳ Waiting 60s before first sync to avoid startup overload...');
      setTimeout(() => {
        if (this.isRunning) {
          this.syncAllBrokerPositions();
        }
      }, 60000);
      
      // Then run periodically
      this.syncTimer = setInterval(() => {
        this.syncAllBrokerPositions();
      }, this.syncInterval);

      console.log(`✅ Broker Position Sync Service scheduled (interval: ${this.syncInterval/1000}s)`);
    } catch (error) {
      console.error('❌ Error checking for MT5 trades:', error.message);
    }
  }

  /**
   * Stop the sync service
   */
  stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.isRunning = false;
    console.log('🛑 Broker Position Sync Service stopped');
  }

  /**
   * Sync all open positions with brokers
   * Uses connection pool to avoid MetaAPI quota issues
   */
  async syncAllBrokerPositions() {
    if (!this.enabled) {
      return; // Don't sync if disabled
    }

    if (this.isSyncing) {
      console.log('⏭️ Skipping sync - previous sync still in progress');
      return;
    }

    // Check global rate limiter
    if (metaApiRateLimiter.isRateLimited()) {
      console.log('⏭️ Skipping sync - MetaAPI rate limited');
      return;
    }

    this.isSyncing = true;

    try {
      // Only sync MT5 trades (broker = 'MT5') to avoid issues with other broker types
      const openTrades = await Trade.findAll({
        where: {
          status: 'Open',
          broker: 'MT5' // Only MT5 trades
        }
      });

      if (openTrades.length === 0) {
        console.log('✅ [BROKER SYNC] No open MT5 positions to sync');
        this.lastSync = new Date();
        // Stop service if no more trades
        this.stop();
        this.isSyncing = false;
        return;
      }

      console.log(`📊 [BROKER SYNC] Found ${openTrades.length} open MT5 position(s) to check`);

      let closedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      // Group trades by API key to minimize connections
      const tradesByApiKey = {};
      
      for (const trade of openTrades) {
        const apiKey = await this._findApiKeyForTrade(trade);
        
        if (!apiKey || !apiKey.accessToken || !apiKey.appName) {
          console.warn(`⚠️  [BROKER SYNC] No valid API key for trade ${trade.id}`);
          skippedCount++;
          continue;
        }

        const keyId = apiKey.appName;
        if (!tradesByApiKey[keyId]) {
          tradesByApiKey[keyId] = {
            apiKey,
            trades: []
          };
        }
        tradesByApiKey[keyId].trades.push(trade);
      }

      // Process only a limited number of accounts per sync to avoid quota issues
      const accountIds = Object.keys(tradesByApiKey);
      const accountsToProcess = accountIds.slice(0, this.maxConcurrentConnections);

      if (accountsToProcess.length < accountIds.length) {
        console.log(`⚠️ [BROKER SYNC] Limited to ${accountsToProcess.length}/${accountIds.length} accounts this sync`);
      }

      for (const keyId of accountsToProcess) {
        const { apiKey, trades } = tradesByApiKey[keyId];
        
        // Check if rate limiter allows this connection
        if (metaApiRateLimiter.shouldSkipConnection(apiKey.appName)) {
          console.log(`⏭️ [BROKER SYNC] Skipping ${apiKey.appName} due to rate limiting`);
          skippedCount += trades.length;
          continue;
        }
        
        try {
          // Use connection pool instead of creating new connections
          const broker = await mt5BrokerPool.getConnection(apiKey.accessToken, apiKey.appName);
          
          if (!broker) {
            console.warn(`⚠️  [BROKER SYNC] Could not get connection for ${apiKey.appName}`);
            skippedCount += trades.length;
            continue;
          }

          // Throttle the request through rate limiter
          await metaApiRateLimiter.throttleRequest();

          // Get current open positions from broker
          const brokerPositions = await broker.getOpenOrders();
          const brokerOrderIds = new Set(
            brokerPositions.map(p => String(p.id || p.orderId || p.ticket))
          );

          // Check each trade
          for (const trade of trades) {
            const tradeOrderId = String(trade.orderId);
            
            if (!brokerOrderIds.has(tradeOrderId)) {
              try {
                await trade.update({
                  status: 'Completed',
                  closedAt: new Date(),
                  closedReason: 'Position closed on broker (auto-sync)',
                  currentPrice: trade.currentPrice || trade.price
                });

                emitTradeUpdate(trade.userId, trade, 'update');
                closedCount++;
              } catch (updateError) {
                console.error(`❌ [BROKER SYNC] Failed to update trade ${trade.id}:`, updateError.message);
                errorCount++;
              }
            }
          }

          // Release connection back to pool
          mt5BrokerPool.releaseConnection(apiKey.appName);

        } catch (brokerError) {
          // Handle specific MetaAPI errors
          if (brokerError.message?.includes('subscription') || brokerError.status === 429 || brokerError.message?.includes('429')) {
            console.warn(`⚠️  [BROKER SYNC] Rate limited for ${apiKey.appName} - will retry later`);
            metaApiRateLimiter.recordRateLimitError(apiKey.appName);
          } else if (brokerError.message?.includes('deploy') || brokerError.status === 400) {
            console.warn(`⚠️  [BROKER SYNC] Account ${apiKey.appName} not deployed - skipping`);
          } else {
            console.error(`❌ [BROKER SYNC] Error checking ${apiKey.appName}:`, brokerError.message);
          }
          skippedCount += trades.length;
        }
      }

      this.lastSync = new Date();
      console.log(`✅ [BROKER SYNC] Sync complete - Closed: ${closedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error('❌ [BROKER SYNC] Sync failed:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Find the API key for a trade
   */
  async _findApiKeyForTrade(trade) {
    try {
      // Find user's MT5 API key for this segment
      const apiKey = await ApiKey.findOne({
        where: {
          userId: trade.userId,
          broker: 'MT5',
          segment: trade.market,
          isActive: true
        }
      });

      return apiKey;
    } catch (error) {
      console.error(`Error finding API key for trade ${trade.id}:`, error.message);
      return null;
    }
  }

  /**
   * Manually trigger sync for a specific user
   */
  async syncUserPositions(userId) {
    try {
      console.log(`🔄 [BROKER SYNC] Syncing positions for user ${userId}...`);
      
      const openTrades = await Trade.findAll({
        where: {
          userId,
          status: 'Open',
          broker: { [Op.ne]: 'PAPER' }
        }
      });

      if (openTrades.length === 0) {
        console.log(`✅ [BROKER SYNC] No open positions for user ${userId}`);
        return { success: true, message: 'No open positions to sync' };
      }

      // Get user's API key
      const apiKey = await ApiKey.findOne({
        where: {
          userId,
          broker: 'MT5',
          isActive: true
        }
      });

      if (!apiKey || !apiKey.accessToken || !apiKey.appName) {
        return { success: false, error: 'No valid MT5 API key found' };
      }

      // Use connection pool to avoid quota issues
      let broker;
      try {
        broker = await mt5BrokerPool.getConnection(apiKey.accessToken, apiKey.appName);
      } catch (connError) {
        return { success: false, error: `Connection failed: ${connError.message}` };
      }

      // Get broker positions
      const brokerPositions = await broker.getOpenOrders();
      const brokerOrderIds = new Set(
        brokerPositions.map(p => String(p.id || p.orderId || p.ticket))
      );

      let closedCount = 0;

      // Check each trade
      for (const trade of openTrades) {
        if (!brokerOrderIds.has(String(trade.orderId))) {
          await trade.update({
            status: 'Completed',
            closedAt: new Date(),
            closedReason: 'Position closed on broker (manual sync)',
            currentPrice: trade.currentPrice || trade.price
          });

          emitTradeUpdate(userId, trade, 'update');
          closedCount++;
        }
      }

      // Release connection back to pool
      if (apiKey?.appName) {
        mt5BrokerPool.releaseConnection(apiKey.appName);
      }

      return {
        success: true,
        message: `Synced ${openTrades.length} position(s), closed ${closedCount}`,
        total: openTrades.length,
        closed: closedCount
      };

    } catch (error) {
      console.error(`❌ [BROKER SYNC] User sync failed for ${userId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      running: this.isRunning,
      lastSync: this.lastSync,
      syncInterval: this.syncInterval
    };
  }
}

// Singleton instance
export const brokerPositionSyncService = new BrokerPositionSyncService();
export default brokerPositionSyncService;
