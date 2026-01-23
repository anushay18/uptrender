/**
 * Paper Position Controller
 * Handles all paper trading position management endpoints
 */

import { paperTradingService } from '../services/PaperTradingService.js';
import { PaperPosition, Strategy, Trade, ApiKey } from '../models/index.js';
import { mt5Broker } from '../../algoengine/index.js';
import { emitTradeUpdate } from '../config/socket.js';
import { Op } from 'sequelize';
import centralizedStreamingService from '../services/CentralizedStreamingService.js';

/**
 * Get all open paper positions for the authenticated user
 * GET /api/paper-positions
 */
export const getOpenPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await paperTradingService.getOpenPositions(userId);
    
    res.json({
      success: true,
      data: result.data,
      count: result.count
    });
  } catch (error) {
    console.error('Get paper positions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch paper positions',
      message: error.message
    });
  }
};

/**
 * Get paper position history for the authenticated user
 * GET /api/paper-positions/history
 */
export const getPositionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, status } = req.query;
    
    const result = await paperTradingService.getPositionHistory(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      status
    });
    
    res.json({
      success: true,
      data: result.data,
      count: result.count,
      total: result.total
    });
  } catch (error) {
    console.error('Get paper position history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch position history',
      message: error.message
    });
  }
};

/**
 * Get paper trading statistics for the authenticated user
 * GET /api/paper-positions/stats
 */
export const getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await paperTradingService.getStats(userId);
    
    res.json(result);
  } catch (error) {
    console.error('Get paper trading stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading stats',
      message: error.message
    });
  }
};

/**
 * Open a new paper position manually
 * POST /api/paper-positions/open
 */
export const openPosition = async (req, res) => {
  try {
    const userId = req.user.id;
    let {
      symbol,
      market,
      type,
      volume,
      stopLoss,
      takeProfit,
      stopLossType = 'points',
      takeProfitType = 'points',
      strategyId
    } = req.body;

    // Validate required fields
    if (!symbol || !type || !volume) {
      return res.status(400).json({
        success: false,
        error: 'symbol, type, and volume are required'
      });
    }

    // Auto-detect market if not provided
    if (!market) {
      const symbolUpper = symbol.toUpperCase();
      if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH') || 
          symbolUpper.includes('XRP') || symbolUpper.includes('DOGE') || 
          symbolUpper.includes('SOL') || symbolUpper.includes('USDT') ||
          symbolUpper.includes('BUSD') || symbolUpper.includes('ADA') ||
          symbolUpper.includes('DOT') || symbolUpper.includes('MATIC')) {
        market = 'Crypto';
      } else {
        market = 'Forex'; // Default to Forex
      }
      console.log(`🔍 Auto-detected market for ${symbol}: ${market}`);
    }

    if (!['BUY', 'SELL', 'Buy', 'Sell'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be BUY or SELL'
      });
    }

    // Get current price from streaming service or broker
    let currentPrice = 0;
    let selectedApiKey = null;
    
    // PRIORITY 1: Try centralized streaming service first (most reliable)
    const centralPrice = centralizedStreamingService.getPrice(symbol.toUpperCase());
    if (centralPrice) {
      currentPrice = type.toUpperCase() === 'BUY' ? centralPrice.ask : centralPrice.bid;
      if (!currentPrice) currentPrice = centralPrice.last || centralPrice.mid;
      console.log(`✅ [Centralized Streaming] Price for ${symbol}: ${currentPrice}`);
    }
    
    // PRIORITY 2: Get from broker API if streaming unavailable
    if (currentPrice <= 0) {
      try {
        // Get active API key based on market
        const apiKey = await ApiKey.findOne({
          where: { 
            userId,
            segment: market,
            broker: market === 'Crypto' ? { [Op.ne]: 'MT5' } : 'MT5',
            isActive: true
          }
        });
      
        if (apiKey) {
          selectedApiKey = apiKey;
        
          if (currentPrice <= 0 && market === 'Crypto' && apiKey.exchangeId && apiKey.apiKey && apiKey.apiSecret) {
            // Use CCXT for crypto
            try {
              const ccxt = await import('ccxt');
              const ExchangeClass = ccxt.default[apiKey.exchangeId];
              if (ExchangeClass) {
                const exchange = new ExchangeClass({
                  apiKey: apiKey.apiKey,
                  secret: apiKey.apiSecret,
                  enableRateLimit: true
                });
                const ticker = await exchange.fetchTicker(symbol);
                currentPrice = type.toUpperCase() === 'BUY' ? ticker.ask : ticker.bid;
                console.log(`✅ [CCXT ${apiKey.exchangeId}] Price for ${symbol}: ${currentPrice}`);
              }
            } catch (ccxtError) {
              console.warn('CCXT price fetch failed:', ccxtError.message);
            }
          }
        
          if (currentPrice <= 0 && apiKey.accessToken && apiKey.appName) {
            // Use MT5 for Forex/Indian or fallback
            const isConnected = await mt5Broker.healthCheck().catch(() => false);
            if (!isConnected) {
              await mt5Broker.initialize({
                apiKey: apiKey.accessToken,
                accountId: apiKey.appName
              });
            }
            const priceData = await mt5Broker.getPrice(symbol.toUpperCase());
            if (priceData && priceData.bid) {
              currentPrice = type.toUpperCase() === 'BUY' ? priceData.ask : priceData.bid;
              console.log(`✅ [MT5] Price for ${symbol}: ${currentPrice}`);
            }
          }
        }
      } catch (priceError) {
        console.warn('Could not fetch live price:', priceError.message);
      }
    }

    if (currentPrice <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Could not fetch current price. Please try again.'
      });
    }

    // Open paper position
    const result = await paperTradingService.openPosition({
      userId,
      strategyId,
      apiKeyId: selectedApiKey?.id || null,
      symbol: symbol.toUpperCase(),
      market,
      type: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
      volume: parseFloat(volume),
      openPrice: currentPrice,
      stopLossType,
      stopLossValue: stopLoss || 0,
      takeProfitType,
      takeProfitValue: takeProfit || 0,
      metadata: {
        source: 'Manual Paper Trade',
        timestamp: new Date().toISOString(),
        broker: selectedApiKey?.broker || 'Unknown',
        exchangeId: selectedApiKey?.exchangeId || null
      }
    });

    if (result.success) {
      // Also create a trade record
      const trade = await Trade.create({
        userId,
        orderId: result.orderId,
        market,
        symbol: symbol.toUpperCase(),
        type: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
        amount: parseFloat(volume),
        price: currentPrice,
        currentPrice: currentPrice,
        status: 'Open',
        date: new Date(),
        broker: 'PAPER',
        brokerType: 'Paper Trading',
        strategyId,
        signalReceivedAt: new Date(),
        signalPayload: {
          source: 'Manual Paper Trade',
          paperPositionId: result.position?.id,
          stopLoss: result.stopLoss,
          takeProfit: result.takeProfit
        },
        signalSendStatus: 'Paper',
        filledQuantity: parseFloat(volume),
        avgFillPrice: currentPrice,
        brokerStatus: 'PAPER_OPEN',
        brokerResponseJson: {
          mode: 'paper',
          paperPositionId: result.position?.id
        }
      });

      emitTradeUpdate(userId, trade, 'create');

      res.status(201).json({
        success: true,
        message: 'Paper position opened successfully',
        data: {
          position: result.position,
          orderId: result.orderId,
          openPrice: currentPrice,
          stopLoss: result.stopLoss,
          takeProfit: result.takeProfit,
          tradeId: trade.id
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to open paper position'
      });
    }
  } catch (error) {
    console.error('Open paper position error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to open paper position',
      message: error.message
    });
  }
};

/**
 * Close a paper position
 * POST /api/paper-positions/:orderId/close
 */
export const closePosition = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Verify position belongs to user
    const position = await PaperPosition.findOne({
      where: { orderId, userId, status: 'Open' }
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found or already closed'
      });
    }

    // Get current price
    let closePrice = parseFloat(position.currentPrice);
    
    try {
      const apiKey = await ApiKey.findOne({
        where: { 
          segment: position.market,
          broker: 'MT5',
          isActive: true
        }
      });
      
      if (apiKey && apiKey.accessToken && apiKey.appName) {
        const isConnected = await mt5Broker.healthCheck().catch(() => false);
        if (!isConnected) {
          await mt5Broker.initialize({
            apiKey: apiKey.accessToken,
            accountId: apiKey.appName
          });
        }
        const priceData = await mt5Broker.getPrice(position.symbol);
        if (priceData && priceData.bid) {
          closePrice = position.type === 'Buy' ? priceData.bid : priceData.ask;
        }
      }
    } catch (priceError) {
      console.warn('Could not fetch close price:', priceError.message);
    }

    // Close the position
    const result = await paperTradingService.closePosition(orderId, closePrice);

    if (result.success) {
      // Update trade record
      const trade = await Trade.findOne({
        where: { orderId, userId }
      });

      if (trade) {
        await trade.update({
          status: 'Closed',
          currentPrice: closePrice,
          pnl: result.profit,
          pnlPercentage: result.profitPercent,
          brokerStatus: 'PAPER_CLOSED',
          brokerResponseJson: {
            ...trade.brokerResponseJson,
            closePrice,
            profit: result.profit,
            profitPercent: result.profitPercent,
            closedAt: new Date().toISOString()
          }
        });

        emitTradeUpdate(userId, trade, 'update');
      }

      res.json({
        success: true,
        message: 'Paper position closed successfully',
        data: {
          orderId,
          closePrice,
          profit: result.profit,
          profitPercent: result.profitPercent
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to close position'
      });
    }
  } catch (error) {
    console.error('Close paper position error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close paper position',
      message: error.message
    });
  }
};

/**
 * Modify SL/TP of a paper position
 * PUT /api/paper-positions/:orderId
 */
export const modifyPosition = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { stopLoss, takeProfit } = req.body;

    // Verify position belongs to user
    const position = await PaperPosition.findOne({
      where: { orderId, userId, status: 'Open' }
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found or already closed'
      });
    }

    const result = await paperTradingService.modifyPosition(orderId, {
      stopLoss,
      takeProfit
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Position modified successfully',
        data: {
          orderId,
          stopLoss: result.stopLoss,
          takeProfit: result.takeProfit
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to modify position'
      });
    }
  } catch (error) {
    console.error('Modify paper position error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to modify paper position',
      message: error.message
    });
  }
};

/**
 * Close all open paper positions
 * POST /api/paper-positions/close-all
 */
export const closeAllPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.body;

    const result = await paperTradingService.closeAllPositions(userId, symbol);

    res.json({
      success: true,
      message: result.message,
      data: {
        closedCount: result.closedCount,
        results: result.results
      }
    });
  } catch (error) {
    console.error('Close all paper positions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close positions',
      message: error.message
    });
  }
};

/**
 * Update prices for all open paper positions (called by price streaming)
 * POST /api/paper-positions/update-prices (internal/admin only)
 */
export const updatePrices = async (req, res) => {
  try {
    const { prices } = req.body;
    
    if (!prices || !Array.isArray(prices)) {
      return res.status(400).json({
        success: false,
        error: 'prices array is required'
      });
    }

    for (const { symbol, price } of prices) {
      if (symbol && price) {
        await paperTradingService.updatePriceForSymbol(symbol, price);
      }
    }

    res.json({
      success: true,
      message: `Updated prices for ${prices.length} symbols`
    });
  } catch (error) {
    console.error('Update paper prices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prices',
      message: error.message
    });
  }
};

export default {
  getOpenPositions,
  getPositionHistory,
  getStats,
  openPosition,
  closePosition,
  modifyPosition,
  closeAllPositions,
  updatePrices
};
