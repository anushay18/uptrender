/**
 * User Trade Executor Service
 * 
 * ARCHITECTURE:
 * =============
 * - ONLY connects to user's personal MT5 when executing REAL trades
 * - Connection is short-lived: Connect -> Execute -> Disconnect
 * - Uses platform connection for paper trading
 * 
 * This avoids MetaAPI subscription limits by:
 * 1. Not maintaining persistent user connections
 * 2. Quick connect/execute/disconnect pattern
 * 3. Paper trades use platform connection (no user connection needed)
 */

import platformMT5Service from './PlatformMT5Service.js';

class UserTradeExecutor {
  constructor() {
    this.activeExecutions = new Map(); // Track ongoing executions to prevent duplicates
  }

  /**
   * Execute a trade for a user
   * For paper trading: Uses platform connection
   * For live trading: Temporarily connects to user's MT5, executes, disconnects
   */
  async executeTrade(params) {
    const {
      userId,
      apiKey,      // User's API key record
      symbol,
      type,        // 'Buy' or 'Sell'
      volume,
      stopLoss,
      takeProfit,
      isPaper = false
    } = params;

    // Paper trading - use platform prices only
    if (isPaper || !apiKey || apiKey.broker === 'PAPER') {
      return this.executePaperTrade(params);
    }

    // Live MT5 trading - connect, execute, disconnect
    if (apiKey.broker === 'MT5') {
      return this.executeMT5Trade(params);
    }

    // Other brokers (Crypto, etc.) - handle separately
    return this.executeOtherBrokerTrade(params);
  }

  /**
   * Execute paper trade using platform prices
   */
  async executePaperTrade(params) {
    const { userId, symbol, type, volume, stopLoss, takeProfit } = params;

    try {
      // Get current price from platform connection
      const price = await platformMT5Service.getPrice(symbol);
      
      if (!price) {
        throw new Error(`No price available for ${symbol}`);
      }

      const fillPrice = type === 'Buy' ? price.ask : price.bid;

      // Calculate SL/TP prices
      let slPrice = null;
      let tpPrice = null;

      if (stopLoss) {
        slPrice = type === 'Buy' 
          ? fillPrice - stopLoss 
          : fillPrice + stopLoss;
      }

      if (takeProfit) {
        tpPrice = type === 'Buy' 
          ? fillPrice + takeProfit 
          : fillPrice - takeProfit;
      }

      return {
        success: true,
        orderId: `PAPER-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        symbol,
        type,
        volume,
        fillPrice,
        stopLoss: slPrice,
        takeProfit: tpPrice,
        timestamp: new Date().toISOString(),
        isPaper: true,
        broker: 'PAPER'
      };
    } catch (error) {
      console.error('Paper trade execution failed:', error.message);
      return {
        success: false,
        error: error.message,
        isPaper: true
      };
    }
  }

  /**
   * Execute MT5 trade with short-lived connection
   * Connect -> Execute -> Disconnect immediately
   */
  async executeMT5Trade(params) {
    const { apiKey, symbol, type, volume, stopLoss, takeProfit } = params;
    const accountId = apiKey.appName;
    const token = apiKey.accessToken;

    // Prevent duplicate executions
    const executionKey = `${accountId}:${symbol}:${Date.now()}`;
    if (this.activeExecutions.has(executionKey)) {
      return { success: false, error: 'Execution already in progress' };
    }

    this.activeExecutions.set(executionKey, true);
    let connection = null;

    try {
      console.log(`🔌 Connecting to user MT5 ${accountId} for trade execution...`);

      // Dynamic import MetaAPI
      const MetaApi = (await import('metaapi.cloud-sdk/esm-node')).default;
      const metaApi = new MetaApi(token);
      
      // Get account
      const account = await metaApi.metatraderAccountApi.getAccount(accountId);
      
      if (!account) {
        throw new Error('MT5 account not found');
      }

      // Get RPC connection
      connection = account.getRPCConnection();
      await connection.connect();
      
      // Wait for sync with short timeout
      await connection.waitSynchronized({ timeout: 15000 });

      console.log(`✅ Connected to ${accountId}, executing trade...`);

      // Execute trade
      const tradeRequest = {
        symbol,
        actionType: type === 'Buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
        volume: parseFloat(volume),
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined
      };

      const result = await connection.createMarketBuyOrder(
        symbol,
        parseFloat(volume),
        stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit ? parseFloat(takeProfit) : undefined
      );

      if (type === 'Sell') {
        // Use sell order instead
        result = await connection.createMarketSellOrder(
          symbol,
          parseFloat(volume),
          stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit ? parseFloat(takeProfit) : undefined
        );
      }

      console.log(`✅ Trade executed on ${accountId}:`, result.orderId);

      return {
        success: true,
        orderId: result.orderId || result.positionId,
        symbol,
        type,
        volume,
        fillPrice: result.openPrice || result.price,
        stopLoss: result.stopLoss,
        takeProfit: result.takeProfit,
        timestamp: new Date().toISOString(),
        isPaper: false,
        broker: 'MT5',
        brokerResponse: result
      };

    } catch (error) {
      console.error(`❌ MT5 trade execution failed for ${accountId}:`, error.message);
      return {
        success: false,
        error: error.message,
        broker: 'MT5'
      };
    } finally {
      // ALWAYS disconnect after execution
      if (connection) {
        try {
          await connection.close();
          console.log(`🔌 Disconnected from user MT5 ${accountId}`);
        } catch (closeError) {
          console.warn('Error closing connection:', closeError.message);
        }
      }
      this.activeExecutions.delete(executionKey);
    }
  }

  /**
   * Close a trade on MT5
   */
  async closeMT5Trade(params) {
    const { apiKey, orderId, volume } = params;
    const accountId = apiKey.appName;
    const token = apiKey.accessToken;

    let connection = null;

    try {
      console.log(`🔌 Connecting to user MT5 ${accountId} to close trade...`);

      const MetaApi = (await import('metaapi.cloud-sdk/esm-node')).default;
      const metaApi = new MetaApi(token);
      const account = await metaApi.metatraderAccountApi.getAccount(accountId);
      
      if (!account) {
        throw new Error('MT5 account not found');
      }

      connection = account.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized({ timeout: 15000 });

      // Close position
      const result = await connection.closePosition(orderId, {
        volume: volume ? parseFloat(volume) : undefined
      });

      console.log(`✅ Trade ${orderId} closed on ${accountId}`);

      return {
        success: true,
        orderId,
        closePrice: result.closePrice || result.price,
        timestamp: new Date().toISOString(),
        brokerResponse: result
      };

    } catch (error) {
      console.error(`❌ MT5 close trade failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (closeError) {
          console.warn('Error closing connection:', closeError.message);
        }
      }
    }
  }

  /**
   * Get open positions from user's MT5
   */
  async getMT5Positions(apiKey) {
    const accountId = apiKey.appName;
    const token = apiKey.accessToken;
    let connection = null;

    try {
      const MetaApi = (await import('metaapi.cloud-sdk/esm-node')).default;
      const metaApi = new MetaApi(token);
      const account = await metaApi.metatraderAccountApi.getAccount(accountId);
      
      if (!account) {
        throw new Error('MT5 account not found');
      }

      connection = account.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized({ timeout: 15000 });

      const positions = await connection.getPositions();

      return {
        success: true,
        positions,
        count: positions.length
      };

    } catch (error) {
      console.error(`❌ Failed to get MT5 positions:`, error.message);
      return {
        success: false,
        error: error.message,
        positions: []
      };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (closeError) {
          console.warn('Error closing connection:', closeError.message);
        }
      }
    }
  }

  /**
   * Execute trade on other brokers (Crypto via CCXT, etc.)
   */
  async executeOtherBrokerTrade(params) {
    const { apiKey, symbol, type, volume } = params;

    // For crypto brokers, use exchange service
    if (apiKey.segment === 'Crypto' && apiKey.exchangeId) {
      try {
        const { getExchangeInstance, placeOrder } = await import('./exchangeService.js');
        
        const exchange = await getExchangeInstance(
          apiKey.exchangeId,
          apiKey.apiKey,
          apiKey.apiSecret,
          apiKey.passphrase
        );

        const orderType = type.toLowerCase();
        const result = await placeOrder(exchange, symbol, orderType, 'market', volume);

        return {
          success: true,
          orderId: result.id,
          symbol,
          type,
          volume,
          fillPrice: result.average || result.price,
          timestamp: new Date().toISOString(),
          isPaper: false,
          broker: apiKey.broker,
          brokerResponse: result
        };
      } catch (error) {
        console.error('Crypto trade execution failed:', error.message);
        return {
          success: false,
          error: error.message,
          broker: apiKey.broker
        };
      }
    }

    return {
      success: false,
      error: `Unsupported broker: ${apiKey.broker}`
    };
  }
}

// Singleton instance
const userTradeExecutor = new UserTradeExecutor();
export default userTradeExecutor;
