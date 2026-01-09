/**
 * Paper Trading Service
 * Manages paper trading positions with live price updates, SL/TP execution, and P&L calculations
 */

import { PaperPosition, Strategy } from '../models/index.js';
import { Op } from 'sequelize';
import { emitTradeUpdate, emitPaperPositionUpdate } from '../config/socket.js';
import redisClient from '../utils/redisClient.js';

// In-memory price cache for quick lookups
const priceCache = new Map();

// Active price subscriptions per symbol
const priceSubscriptions = new Map();

// Pip values for different instruments (for P&L calculation)
const PIP_VALUES = {
  // Forex majors (standard lot = 100,000 units)
  EURUSD: 10, GBPUSD: 10, AUDUSD: 10, NZDUSD: 10,
  USDJPY: 1000 / 100, USDCHF: 10, USDCAD: 10,
  // Forex crosses
  EURGBP: 10, EURJPY: 1000 / 100, GBPJPY: 1000 / 100,
  // Crypto (per 1 unit)
  BTCUSD: 1, ETHUSD: 1, XRPUSD: 1,
  // Indices
  US30: 1, US500: 1, NAS100: 1, UK100: 1,
  // Default
  DEFAULT: 1
};

/**
 * Get pip value for symbol
 */
const getPipValue = (symbol) => {
  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return PIP_VALUES[normalizedSymbol] || PIP_VALUES.DEFAULT;
};

/**
 * Calculate profit/loss for a position
 */
const calculatePnL = (position, currentPrice) => {
  const openPrice = parseFloat(position.openPrice);
  const volume = parseFloat(position.volume);
  const type = position.type;
  const pipValue = getPipValue(position.symbol);
  
  let priceDiff;
  if (type === 'Buy') {
    priceDiff = currentPrice - openPrice;
  } else {
    priceDiff = openPrice - currentPrice;
  }
  
  // Calculate profit based on symbol type
  let profit;
  const symbol = position.symbol.toUpperCase();
  
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('XRP')) {
    // Crypto: profit = volume * price difference
    profit = volume * priceDiff;
  } else if (symbol.includes('JPY')) {
    // JPY pairs: different pip calculation
    profit = volume * 100000 * (priceDiff / 100);
  } else {
    // Forex standard: profit = volume * 100000 * priceDiff * pipValue
    profit = volume * 100000 * priceDiff;
  }
  
  const profitPercent = openPrice > 0 ? (priceDiff / openPrice) * 100 : 0;
  
  return {
    profit: parseFloat(profit.toFixed(2)),
    profitPercent: parseFloat(profitPercent.toFixed(4))
  };
};

/**
 * Calculate SL/TP price levels
 */
const calculateStopLevels = (openPrice, type, slType, slValue, tpType, tpValue, symbol) => {
  let stopLoss = null;
  let takeProfit = null;
  
  const pipMultiplier = symbol.toUpperCase().includes('JPY') ? 0.01 : 0.0001;
  
  if (slValue && slValue > 0) {
    if (slType === 'price') {
      stopLoss = slValue;
    } else if (slType === 'points') {
      stopLoss = type === 'Buy' 
        ? openPrice - (slValue * pipMultiplier)
        : openPrice + (slValue * pipMultiplier);
    } else if (slType === 'percentage') {
      stopLoss = type === 'Buy'
        ? openPrice * (1 - slValue / 100)
        : openPrice * (1 + slValue / 100);
    }
  }
  
  if (tpValue && tpValue > 0) {
    if (tpType === 'price') {
      takeProfit = tpValue;
    } else if (tpType === 'points') {
      takeProfit = type === 'Buy'
        ? openPrice + (tpValue * pipMultiplier)
        : openPrice - (tpValue * pipMultiplier);
    } else if (tpType === 'percentage') {
      takeProfit = type === 'Buy'
        ? openPrice * (1 + tpValue / 100)
        : openPrice * (1 - tpValue / 100);
    }
  }
  
  return { stopLoss, takeProfit };
};

/**
 * Check if SL or TP is hit
 */
const checkStopLevels = (position, currentPrice) => {
  const { stopLoss, takeProfit, type } = position;
  
  if (stopLoss) {
    if (type === 'Buy' && currentPrice <= parseFloat(stopLoss)) {
      return 'SL_Hit';
    }
    if (type === 'Sell' && currentPrice >= parseFloat(stopLoss)) {
      return 'SL_Hit';
    }
  }
  
  if (takeProfit) {
    if (type === 'Buy' && currentPrice >= parseFloat(takeProfit)) {
      return 'TP_Hit';
    }
    if (type === 'Sell' && currentPrice <= parseFloat(takeProfit)) {
      return 'TP_Hit';
    }
  }
  
  return null;
};

class PaperTradingService {
  constructor() {
    this.isRunning = false;
    this.updateInterval = null;
  }

  /**
   * Open a new paper position
   */
  async openPosition(params) {
    const {
      userId,
      strategyId,
      symbol,
      market,
      type,
      volume,
      openPrice,
      stopLossType = 'points',
      stopLossValue = 0,
      takeProfitType = 'points',
      takeProfitValue = 0,
      metadata = {}
    } = params;

    try {
      // Calculate SL/TP levels
      const { stopLoss, takeProfit } = calculateStopLevels(
        openPrice, type, stopLossType, stopLossValue, takeProfitType, takeProfitValue, symbol
      );

      // Generate unique order ID
      const orderId = `PAPER-${Date.now()}-${userId}-${Math.random().toString(36).substr(2, 5)}`;

      // Create paper position
      const position = await PaperPosition.create({
        userId,
        strategyId,
        orderId,
        symbol: symbol.toUpperCase(),
        market,
        type,
        volume,
        openPrice,
        currentPrice: openPrice,
        stopLoss,
        takeProfit,
        stopLossType,
        takeProfitType,
        profit: 0,
        profitPercent: 0,
        status: 'Open',
        openTime: new Date(),
        metadata: {
          ...metadata,
          stopLossValue,
          takeProfitValue
        }
      });

      console.log(`📝 Paper position opened: ${orderId} | ${type} ${volume} ${symbol} @ ${openPrice}`);

      // Emit real-time update
      if (emitPaperPositionUpdate) {
        emitPaperPositionUpdate(userId, position, 'open');
      }

      return {
        success: true,
        position: position.toJSON(),
        orderId,
        openPrice,
        stopLoss,
        takeProfit,
        message: `Paper ${type} position opened for ${symbol}`
      };
    } catch (error) {
      console.error('Error opening paper position:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close a paper position
   */
  async closePosition(orderId, closePrice = null) {
    try {
      const position = await PaperPosition.findOne({
        where: { orderId, status: 'Open' }
      });

      if (!position) {
        return {
          success: false,
          error: 'Position not found or already closed'
        };
      }

      // Use provided close price or current price from cache
      const finalClosePrice = closePrice || priceCache.get(position.symbol) || parseFloat(position.currentPrice);

      // Calculate final P&L
      const { profit, profitPercent } = calculatePnL(position, finalClosePrice);

      // Update position
      await position.update({
        status: 'Closed',
        closeTime: new Date(),
        closePrice: finalClosePrice,
        currentPrice: finalClosePrice,
        profit,
        profitPercent,
        realizedProfit: profit
      });

      console.log(`📝 Paper position closed: ${orderId} | P&L: ${profit >= 0 ? '+' : ''}${profit}`);

      // Emit real-time update
      if (emitPaperPositionUpdate) {
        emitPaperPositionUpdate(position.userId, position, 'close');
      }

      return {
        success: true,
        orderId,
        closePrice: finalClosePrice,
        profit,
        profitPercent,
        message: `Position closed with ${profit >= 0 ? 'profit' : 'loss'} of ${profit}`
      };
    } catch (error) {
      console.error('Error closing paper position:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Modify SL/TP of an open position
   */
  async modifyPosition(orderId, modifications) {
    try {
      const position = await PaperPosition.findOne({
        where: { orderId, status: 'Open' }
      });

      if (!position) {
        return {
          success: false,
          error: 'Position not found or already closed'
        };
      }

      const updates = {};
      
      if (modifications.stopLoss !== undefined) {
        updates.stopLoss = modifications.stopLoss;
      }
      if (modifications.takeProfit !== undefined) {
        updates.takeProfit = modifications.takeProfit;
      }

      await position.update(updates);

      console.log(`📝 Paper position modified: ${orderId} | SL: ${updates.stopLoss}, TP: ${updates.takeProfit}`);

      // Emit real-time update
      if (emitPaperPositionUpdate) {
        emitPaperPositionUpdate(position.userId, position, 'modify');
      }

      return {
        success: true,
        orderId,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        message: 'Position modified successfully'
      };
    } catch (error) {
      console.error('Error modifying paper position:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all open positions for a user
   */
  async getOpenPositions(userId) {
    try {
      const positions = await PaperPosition.findAll({
        where: { userId, status: 'Open' },
        include: [{ model: Strategy, as: 'strategy', attributes: ['id', 'name'] }],
        order: [['openTime', 'DESC']]
      });

      return {
        success: true,
        data: positions.map(p => p.toJSON()),
        count: positions.length
      };
    } catch (error) {
      console.error('Error fetching paper positions:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Get position history for a user
   */
  async getPositionHistory(userId, options = {}) {
    try {
      const { limit = 50, offset = 0, status } = options;
      
      const where = { userId };
      if (status) {
        where.status = status;
      } else {
        where.status = { [Op.in]: ['Closed', 'SL_Hit', 'TP_Hit'] };
      }

      const positions = await PaperPosition.findAndCountAll({
        where,
        include: [{ model: Strategy, as: 'strategy', attributes: ['id', 'name'] }],
        order: [['closeTime', 'DESC']],
        limit,
        offset
      });

      return {
        success: true,
        data: positions.rows.map(p => p.toJSON()),
        count: positions.count,
        total: positions.count
      };
    } catch (error) {
      console.error('Error fetching paper position history:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Update price and check SL/TP for all open positions of a symbol
   */
  async updatePriceForSymbol(symbol, currentPrice) {
    try {
      // Update price cache
      priceCache.set(symbol.toUpperCase(), currentPrice);

      // Find all open positions for this symbol
      const positions = await PaperPosition.findAll({
        where: { 
          symbol: symbol.toUpperCase(), 
          status: 'Open' 
        }
      });

      if (positions.length === 0) return;

      for (const position of positions) {
        // Calculate P&L
        const { profit, profitPercent } = calculatePnL(position, currentPrice);

        // Check if SL or TP hit
        const stopResult = checkStopLevels(position, currentPrice);

        if (stopResult) {
          // Close position due to SL/TP
          await position.update({
            status: stopResult,
            closeTime: new Date(),
            closePrice: currentPrice,
            currentPrice,
            profit,
            profitPercent,
            realizedProfit: profit
          });

          console.log(`📝 Paper position ${stopResult}: ${position.orderId} | P&L: ${profit}`);

          // Emit real-time update
          if (emitPaperPositionUpdate) {
            emitPaperPositionUpdate(position.userId, position, stopResult.toLowerCase());
          }

          // Broadcast to Redis for cross-server sync
          await redisClient.publishPaperPositionMTM(position.userId, position, {
            currentPrice,
            profit,
            profitPercent
          });
        } else {
          // Just update current price and unrealized P&L
          await position.update({
            currentPrice,
            profit,
            profitPercent
          });

          // Emit MTM update via Socket.IO
          if (emitPaperPositionUpdate) {
            emitPaperPositionUpdate(position.userId, position, 'mtm');
          }

          // Broadcast MTM to Redis for real-time updates
          await redisClient.publishPaperPositionMTM(position.userId, position, {
            currentPrice,
            profit,
            profitPercent
          });
        }
      }
    } catch (error) {
      console.error(`Error updating price for ${symbol}:`, error);
    }
  }

  /**
   * Close all open positions for a user and symbol
   */
  async closeAllPositions(userId, symbol = null, closePrice = null) {
    try {
      const where = { userId, status: 'Open' };
      if (symbol) {
        where.symbol = symbol.toUpperCase();
      }

      const positions = await PaperPosition.findAll({ where });

      if (positions.length === 0) {
        return {
          success: true,
          message: 'No open positions to close',
          closedCount: 0
        };
      }

      const results = [];
      for (const position of positions) {
        const result = await this.closePosition(position.orderId, closePrice);
        results.push(result);
      }

      const successCount = results.filter(r => r.success).length;

      return {
        success: true,
        message: `Closed ${successCount}/${positions.length} positions`,
        closedCount: successCount,
        results
      };
    } catch (error) {
      console.error('Error closing all positions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get summary statistics for paper trading
   */
  async getStats(userId) {
    try {
      // Get open positions
      const openPositions = await PaperPosition.findAll({
        where: { userId, status: 'Open' }
      });

      // Get closed positions
      const closedPositions = await PaperPosition.findAll({
        where: { 
          userId, 
          status: { [Op.in]: ['Closed', 'SL_Hit', 'TP_Hit'] }
        }
      });

      // Calculate stats
      const totalTrades = closedPositions.length;
      const winningTrades = closedPositions.filter(p => parseFloat(p.realizedProfit) > 0).length;
      const losingTrades = closedPositions.filter(p => parseFloat(p.realizedProfit) < 0).length;
      const totalProfit = closedPositions.reduce((sum, p) => sum + parseFloat(p.realizedProfit || 0), 0);
      const openProfit = openPositions.reduce((sum, p) => sum + parseFloat(p.profit || 0), 0);

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(2) : 0;
      
      const avgWin = winningTrades > 0 
        ? closedPositions.filter(p => parseFloat(p.realizedProfit) > 0)
            .reduce((sum, p) => sum + parseFloat(p.realizedProfit), 0) / winningTrades
        : 0;
      
      const avgLoss = losingTrades > 0
        ? Math.abs(closedPositions.filter(p => parseFloat(p.realizedProfit) < 0)
            .reduce((sum, p) => sum + parseFloat(p.realizedProfit), 0)) / losingTrades
        : 0;

      return {
        success: true,
        stats: {
          openPositions: openPositions.length,
          totalTrades,
          winningTrades,
          losingTrades,
          winRate: parseFloat(winRate),
          totalProfit: parseFloat(totalProfit.toFixed(2)),
          openProfit: parseFloat(openProfit.toFixed(2)),
          avgWin: parseFloat(avgWin.toFixed(2)),
          avgLoss: parseFloat(avgLoss.toFixed(2)),
          profitFactor: avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : 0
        }
      };
    } catch (error) {
      console.error('Error getting paper trading stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const paperTradingService = new PaperTradingService();
export default paperTradingService;
