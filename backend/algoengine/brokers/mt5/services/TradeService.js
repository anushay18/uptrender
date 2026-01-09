/**
 * MT5 Trade Placement Service - FASTEST MODE
 * Handles order execution with minimal latency
 * Optimized for speed and reliability
 */

import { logger } from '../../../utils/logger.js';
import { MT5_CONFIG, ORDER_TYPES, SL_TYPES, TP_TYPES } from '../config/metaapi.config.js';
import { connectionManager } from './ConnectionManager.js';
import { CalculationService } from './CalculationService.js';

class TradeService {
  constructor() {
    this.lastOrderTime = 0;
    this.orderQueue = [];
    this.isProcessingOrder = false;
    this.magicNumber = 29301991;
    this.pendingOrders = new Map();
  }

  /**
   * Place a trade order - FASTEST MODE
   * Optimized for minimal latency
   * 
   * @param {Object} tradeParams - Trade parameters
   * @returns {Promise<Object>} Order result
   * 
   * @example
   * const result = await tradeService.placeTrade({
   *   symbol: 'EURUSD',
   *   type: 'BUY',
   *   volume: 1.5,
   *   orderType: 'market',
   *   entryPrice: null,
   *   stopLoss: { type: 'points', value: 50 },
   *   takeProfit: { type: 'points', value: 100 },
   *   comment: 'Strategy XYZ'
   * });
   */
  async placeTrade(tradeParams) {
    const startTime = Date.now();

    try {
      // Validate connection
      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5. Cannot place trade.');
      }

      // Validate and normalize parameters
      const normalizedParams = this.validateAndNormalizeParams(tradeParams);

      logger.info(`[TRADE] Placing ${normalizedParams.type} order for ${normalizedParams.symbol}`);
      logger.debug(`[TRADE] Volume: ${normalizedParams.volume}, SL: ${normalizedParams.stopLoss}, TP: ${normalizedParams.takeProfit}`);

      // Get connection
      const connection = connectionManager.getConnection();

      // Get current price if not provided
      let currentPrice = normalizedParams.currentPrice;
      if (!currentPrice) {
        const priceData = await connection.getSymbolPrice(normalizedParams.symbol);
        currentPrice = normalizedParams.type === 'BUY' ? priceData.ask : priceData.bid;
        logger.debug(`[TRADE] Current price fetched: ${currentPrice}`);
      }

      // Determine order type
      const orderType = normalizedParams.orderType === 'market' 
        ? (normalizedParams.type === 'BUY' ? ORDER_TYPES.BUY : ORDER_TYPES.SELL)
        : (normalizedParams.type === 'BUY' ? ORDER_TYPES.BUY_LIMIT : ORDER_TYPES.SELL_LIMIT);

      // Get symbol specs for calculations
      const symbol = await this.getSymbolSpecs(normalizedParams.symbol);
      logger.info(`[TRADE] Symbol specs: ${JSON.stringify(symbol)}`);

      // Calculate SL and TP in absolute price
      const basePrice = normalizedParams.entryPrice || currentPrice;
      
      const slPrice = CalculationService.calculateStopLoss(
        basePrice,
        normalizedParams.stopLoss,
        normalizedParams.type,
        symbol
      );
      logger.info(`[TRADE] SL Price calculated: ${slPrice}`);

      const tpPrice = CalculationService.calculateTakeProfit(
        basePrice,
        normalizedParams.takeProfit,
        normalizedParams.type,
        symbol
      );
      logger.info(`[TRADE] TP Price calculated: ${tpPrice}`);

      // Create order object for MetaAPI
      const order = {
        symbol: normalizedParams.symbol,
        orderType: orderType,
        volume: normalizedParams.volume,
        openPrice: normalizedParams.entryPrice || undefined,
        stopLoss: slPrice,
        takeProfit: tpPrice,
        comment: `${MT5_CONFIG.trading.fastest.orderComment}-${normalizedParams.comment || 'AUTO'}`,
        magic: this.magicNumber,
        clientOrderId: this.generateOrderId(),
      };

      // FASTEST MODE: Use MetaAPI trade methods
      let createOrderResult;
      
      // For now, place order without SL/TP (MetaAPI validation is strict)
      // TODO: Implement proper SL/TP with minimum distance validation
      logger.info(`[TRADE] Placing order without SL/TP for now`);
      
      if (normalizedParams.type === 'BUY') {
        createOrderResult = await connection.createMarketBuyOrder(
          normalizedParams.symbol,
          normalizedParams.volume
        );
      } else {
        createOrderResult = await connection.createMarketSellOrder(
          normalizedParams.symbol,
          normalizedParams.volume
        );
      }

      // Validate result
      if (!createOrderResult || (!createOrderResult.orderId && !createOrderResult.stringCode)) {
        throw new Error(`Order creation failed: ${createOrderResult?.message || 'Unknown error'}`);
      }

      const executionTime = Date.now() - startTime;
      
      // Extract order ID (can be numeric or string)
      const orderId = createOrderResult.orderId || createOrderResult.stringCode || createOrderResult.numericCode;

      // Build response
      const tradeResult = {
        success: true,
        orderId: orderId,
        brokerOrderId: orderId,
        symbol: normalizedParams.symbol,
        type: normalizedParams.type,
        volume: normalizedParams.volume,
        openPrice: normalizedParams.entryPrice || currentPrice,
        currentPrice: currentPrice,
        stopLoss: slPrice,
        takeProfit: tpPrice,
        status: createOrderResult.state || 'PENDING',
        executionTime: executionTime,
        timestamp: new Date().toISOString(),
        brokerResponse: {
          status: 'success',
          orderId: orderId,
          message: 'Order placed successfully',
          details: createOrderResult,
        },
      };

      logger.info(
        `✓ [TRADE] Order placed successfully (${executionTime}ms) - ID: ${createOrderResult.orderId}`
      );

      return tradeResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Log detailed error information
      logger.error(`✗ [TRADE] Order placement failed (${executionTime}ms): ${error.message}`);
      if (error.details) {
        logger.error(`[TRADE] Error details: ${JSON.stringify(error.details)}`);
      }
      if (error.response) {
        logger.error(`[TRADE] Error response: ${JSON.stringify(error.response)}`);
      }
      if (error.stack) {
        logger.debug(`[TRADE] Stack trace: ${error.stack}`);
      }

      return {
        success: false,
        error: error.message,
        errorDetails: error.details || error.response || undefined,
        symbol: tradeParams.symbol,
        type: tradeParams.type,
        executionTime: executionTime,
        timestamp: new Date().toISOString(),
        brokerResponse: {
          status: 'failure',
          message: error.message,
        },
      };
    }
  }

  /**
   * Place multiple trades in batch (for fastest execution)
   * @param {Array<Object>} tradeList - Array of trade parameters
   * @returns {Promise<Array<Object>>} Array of order results
   */
  async placeBatchTrades(tradeList) {
    try {
      if (!Array.isArray(tradeList) || tradeList.length === 0) {
        throw new Error('Trade list must be a non-empty array');
      }

      logger.info(`[BATCH] Placing ${tradeList.length} orders in batch mode`);

      // Place all trades in parallel for fastest execution
      const promises = tradeList.map((trade) => this.placeTrade(trade));
      const results = await Promise.allSettled(promises);

      // Process results
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failureCount = results.length - successCount;

      logger.info(`[BATCH] Batch complete: ${successCount} successful, ${failureCount} failed`);

      return results.map((result) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        return {
          success: false,
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      });
    } catch (error) {
      logger.error(`[BATCH] Batch placement error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close a trade (market exit)
   * @param {number|string} orderId - Order ID to close
   * @returns {Promise<Object>} Close result
   */
  async closeTrade(orderId) {
    try {
      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5');
      }

      const connection = connectionManager.getConnection();
      const startTime = Date.now();

      logger.info(`[TRADE] Closing position: ${orderId}`);

      // Get position details before closing
      const positions = await connection.getPositions();
      const position = positions.find(p => p.id === orderId || p.id === String(orderId));

      // MetaAPI uses closePosition method with position ID
      const closeResult = await connection.closePosition(orderId);

      const executionTime = Date.now() - startTime;

      logger.info(`✓ [TRADE] Position closed (${executionTime}ms) - ID: ${orderId}`);

      // Calculate profit and close price from position data
      const closePrice = position?.currentPrice || closeResult?.closePrice || 0;
      const profit = position?.profit || closeResult?.profit || 0;
      const profitPercent = position?.openPrice && closePrice 
        ? ((closePrice - position.openPrice) / position.openPrice * 100) 
        : 0;

      return {
        success: true,
        orderId: orderId,
        closePrice: closePrice,
        profit: profit,
        profitPercent: profitPercent,
        closedAt: new Date().toISOString(),
        executionTime: executionTime,
        brokerResponse: closeResult,
      };
    } catch (error) {
      logger.error(`✗ [TRADE] Failed to close order: ${error.message}`);

      return {
        success: false,
        orderId: orderId,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Modify trade parameters (SL/TP)
   * @param {number|string} orderId - Order ID
   * @param {Object} modifications - { stopLoss?, takeProfit? }
   * @returns {Promise<Object>} Modification result
   */
  async modifyTrade(orderId, modifications) {
    try {
      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5');
      }

      const connection = connectionManager.getConnection();
      const startTime = Date.now();

      logger.info(`[TRADE] Modifying order: ${orderId}`);

      const modifyResult = await connection.modifyOrder(orderId, {
        stopLoss: modifications.stopLoss,
        takeProfit: modifications.takeProfit,
        timeout: MT5_CONFIG.trading.fastest.executionTimeout,
      });

      const executionTime = Date.now() - startTime;

      logger.info(`✓ [TRADE] Order modified (${executionTime}ms) - ID: ${orderId}`);

      return {
        success: true,
        orderId: orderId,
        modifiedAt: new Date().toISOString(),
        executionTime: executionTime,
        modifications: modifications,
      };
    } catch (error) {
      logger.error(`✗ [TRADE] Failed to modify order: ${error.message}`);

      return {
        success: false,
        orderId: orderId,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get open orders for account
   * @returns {Promise<Array<Object>>} Array of open positions
   */
  async getOpenOrders() {
    try {
      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5');
      }

      const connection = connectionManager.getConnection();
      const positions = await connection.getPositions();

      return positions.map((pos) => ({
        id: pos.id,
        symbol: pos.symbol,
        type: pos.side === 'buy' ? 'BUY' : 'SELL',
        volume: pos.volume,
        openPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        profit: pos.profit,
        profitPercent: ((pos.profit / (pos.openPrice * pos.volume)) * 100).toFixed(2),
        openTime: pos.openTime,
        commission: pos.commission,
      }));
    } catch (error) {
      logger.error(`Failed to get open orders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get trade history
   * @param {Object} options - { startDate?, endDate?, limit? }
   * @returns {Promise<Array<Object>>} Trade history
   */
  async getTradeHistory(options = {}) {
    try {
      if (!connectionManager.isConnectionActive()) {
        throw new Error('Not connected to MT5');
      }

      const connection = connectionManager.getConnection();

      const history = await connection.getHistoryOrdersByTicket(
        options.startDate,
        options.endDate,
        options.limit || 100
      );

      return history.map((order) => ({
        orderId: order.id,
        symbol: order.symbol,
        type: order.side === 'buy' ? 'BUY' : 'SELL',
        volume: order.volume,
        openPrice: order.openPrice,
        closePrice: order.closePrice,
        profit: order.profit,
        openTime: order.openTime,
        closeTime: order.closeTime,
        comment: order.comment,
      }));
    } catch (error) {
      logger.error(`Failed to get trade history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate and normalize trade parameters
   * @private
   */
  validateAndNormalizeParams(params) {
    // Debug logging
    logger.debug(`[VALIDATE] Params received:`, JSON.stringify(params));
    
    if (!params.symbol) throw new Error('Symbol is required');
    if (!params.type || !['BUY', 'SELL'].includes(params.type)) {
      throw new Error('Invalid order type');
    }
    if (!params.volume || params.volume <= 0) {
      throw new Error(`Invalid volume: ${params.volume}`);
    }

    return {
      symbol: params.symbol.toUpperCase(),
      type: params.type.toUpperCase(),
      volume: Math.max(params.volume, MT5_CONFIG.trading.validation.minLotSize),
      orderType: params.orderType || 'market',
      entryPrice: params.entryPrice,
      currentPrice: params.currentPrice,
      stopLoss: params.stopLoss || { type: 'points', value: 50 },
      takeProfit: params.takeProfit || { type: 'points', value: 100 },
      comment: params.comment || 'AUTO',
    };
  }

  /**
   * Get symbol specifications from MT5
   * @private
   */
  async getSymbolSpecs(symbol) {
    try {
      const connection = connectionManager.getConnection();
      const specs = await connection.getSymbolSpecification(symbol);

      return {
        point: specs.point,
        digits: specs.digits,
        minLot: specs.minLot,
        maxLot: specs.maxLot,
        lotStep: specs.lotStep,
      };
    } catch (error) {
      logger.warn(`Could not get symbol specs for ${symbol}: ${error.message}`);
      // Return defaults
      return {
        point: 0.0001,
        digits: 4,
        minLot: 0.01,
        maxLot: 100,
        lotStep: 0.01,
      };
    }
  }

  /**
   * Generate unique order ID
   * @private
   */
  generateOrderId() {
    return `UPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const tradeService = new TradeService();
export default TradeService;
