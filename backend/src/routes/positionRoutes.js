/**
 * Position Routes
 * 
 * API endpoints for the Parent-Child position architecture
 * Provides aggregated and drill-down position views
 */

import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import positionAggregationService from '../services/PositionAggregationService.js';
import centralizedStreamingService from '../services/CentralizedStreamingService.js';
import { Trade, ApiKey } from '../models/index.js';
import { Op } from 'sequelize';
import mt5BrokerPool from '../utils/mt5BrokerPool.js';
import { emitTradeUpdate } from '../config/socket.js';

const router = express.Router();

/**
 * Helper: Get price from CentralizedStreamingService ONLY
 * 
 * Architecture:
 * - ALL price data comes from admin-configured CentralizedStreamingService
 * - User brokers are ONLY for trade execution, NOT for data streaming
 * - Supports MetaAPI or Deriv (configured by admin)
 */
const getPrice = (apiKeyId, symbol, segment) => {
  // ALL segments use centralized streaming from admin panel
  const centralPrice = centralizedStreamingService.getPrice(symbol?.toUpperCase());
  if (centralPrice) return centralPrice;
  
  return null;
};

/**
 * GET /api/positions
 * Get aggregated positions by strategy (top-level view)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { market, strategyId, status } = req.query;

    const positions = await positionAggregationService.getAggregatedPositions(userId, {
      market,
      strategyId: strategyId ? parseInt(strategyId) : undefined,
      status
    });

    res.json({
      success: true,
      data: positions,
      count: positions.length,
      summary: {
        totalPositions: positions.length,
        totalMtm: positions.reduce((sum, p) => sum + (p.totalMtm || 0), 0),
        totalQuantity: positions.reduce((sum, p) => sum + (p.totalQuantity || 0), 0),
        uniqueStrategies: new Set(positions.map(p => p.strategyId)).size,
        uniqueBrokers: new Set(positions.flatMap(p => p.brokers || [])).size
      }
    });
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch positions' });
  }
});

/**
 * GET /api/positions/drilldown/:strategyId/:symbol
 * Get broker-level breakdown for a strategy+symbol combination
 */
router.get('/drilldown/:strategyId/:symbol', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId, symbol } = req.params;

    const drilldown = await positionAggregationService.getDrillDownPositions(
      userId,
      parseInt(strategyId),
      symbol.toUpperCase()
    );

    res.json({
      success: true,
      data: drilldown
    });
  } catch (error) {
    console.error('Get drilldown error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch position details' });
  }
});

/**
 * POST /api/positions/:tradeId/close
 * Manually close a specific child trade position
 */
router.post('/:tradeId/close', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tradeId } = req.params;
    const { closePrice } = req.body; // Optional: manual close price

    // Find the trade
    const trade = await Trade.findOne({
      where: {
        id: tradeId,
        userId,
        status: { [Op.in]: ['Pending', 'Open', 'Partial'] },
        isParent: false // Can only close child trades
      },
      include: [
        {
          model: ApiKey,
          as: 'apiKey',
          attributes: ['id', 'broker', 'exchangeId', 'apiKey', 'apiSecret', 'passphrase', 'accessToken', 'appName', 'segment']
        }
      ]
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: 'Trade not found or already closed'
      });
    }

    // Get current market price if not provided
    let currentClosePrice = closePrice;
    
    if (!currentClosePrice) {
      const tickPrice = getPrice(trade.apiKeyId, trade.symbol, trade.market);
      if (tickPrice) {
        currentClosePrice = trade.type === 'Buy' ? tickPrice.bid : tickPrice.ask;
      } else {
        currentClosePrice = parseFloat(trade.currentPrice) || parseFloat(trade.price);
      }
    }

    const apiKey = trade.apiKey;
    let closeResult;

    // Execute close order on broker
    try {
      // MT5 Broker - use connection pool
      if (apiKey && apiKey.broker === 'MT5' && apiKey.accessToken && apiKey.appName) {
        const mt5Broker = await mt5BrokerPool.getConnection(apiKey.accessToken, apiKey.appName);
        
        if (!mt5Broker) {
          return res.status(500).json({
            success: false,
            error: 'Could not connect to MT5 broker'
          });
        }
        
        closeResult = await mt5Broker.closeTrade({
          orderId: trade.orderId,
          volume: parseFloat(trade.filledQuantity || trade.amount)
        });
        
        // Release connection back to pool
        mt5BrokerPool.releaseConnection(apiKey.appName);
        
        currentClosePrice = closeResult.closePrice || currentClosePrice;
      }
      // CCXT Crypto Exchanges
      else if (apiKey && apiKey.segment === 'Crypto' && apiKey.exchangeId) {
        const { getExchangeInstance, placeOrder } = await import('../services/exchangeService.js');
        const exchange = await getExchangeInstance(
          apiKey.exchangeId,
          apiKey.apiKey,
          apiKey.apiSecret,
          apiKey.passphrase
        );
        
        // Close position by placing opposite order
        const closeType = trade.type === 'Buy' ? 'sell' : 'buy';
        closeResult = await placeOrder(
          exchange,
          trade.symbol,
          closeType,
          'market',
          parseFloat(trade.filledQuantity || trade.amount)
        );
        
        currentClosePrice = closeResult.avgPrice || closeResult.price || currentClosePrice;
      }
      // Paper Trading
      else if (!apiKey || apiKey.broker === 'PAPER') {
        const { paperTradingService } = await import('../services/PaperTradingService.js');
        closeResult = await paperTradingService.closePosition({
          userId: trade.userId,
          symbol: trade.symbol,
          closePrice: currentClosePrice
        });
      }
      else {
        return res.status(400).json({
          success: false,
          error: `Unsupported broker for manual close: ${apiKey?.broker || 'Unknown'}`
        });
      }
    } catch (brokerError) {
      console.error(`❌ Broker close failed:`, brokerError);
      return res.status(500).json({
        success: false,
        error: `Failed to close position on broker: ${brokerError.message}`
      });
    }

    // Calculate final P&L
    const entryPrice = parseFloat(trade.avgFillPrice || trade.price);
    const quantity = parseFloat(trade.filledQuantity || trade.amount);
    let pnl = 0;
    
    if (trade.type === 'Buy') {
      pnl = (currentClosePrice - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - currentClosePrice) * quantity;
    }

    const pnlPercentage = ((pnl / (entryPrice * quantity)) * 100).toFixed(2);

    // Update trade record
    await trade.update({
      status: 'Closed',
      currentPrice: currentClosePrice,
      pnl,
      pnlPercentage,
      brokerResponseJson: {
        ...trade.brokerResponseJson,
        closeReason: 'MANUAL',
        closePrice: currentClosePrice,
        closeTime: new Date().toISOString(),
        closeOrderResult: closeResult,
        closedBy: userId
      }
    });

    // Emit socket update
    emitTradeUpdate(userId, trade, 'update');

    // Check if we should update parent trade
    if (trade.parentTradeId) {
      const siblingTrades = await Trade.count({
        where: {
          parentTradeId: trade.parentTradeId,
          isParent: false,
          status: { [Op.in]: ['Pending', 'Open', 'Partial'] }
        }
      });

      // If no more open siblings, close parent too
      if (siblingTrades === 0) {
        await Trade.update(
          { status: 'Closed' },
          { where: { id: trade.parentTradeId } }
        );
      }
    }

    res.json({
      success: true,
      message: 'Position closed successfully',
      data: {
        tradeId: trade.id,
        orderId: trade.orderId,
        broker: trade.broker,
        symbol: trade.symbol,
        type: trade.type,
        quantity: quantity,
        entryPrice: entryPrice,
        closePrice: currentClosePrice,
        pnl: pnl,
        pnlPercentage: pnlPercentage,
        closedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Close position error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close position',
      message: error.message
    });
  }
});

/**
 * GET /api/positions/children/:parentTradeId
 * Get all child trades for a parent trade
 */
router.get('/children/:parentTradeId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { parentTradeId } = req.params;

    // Verify parent trade belongs to user
    const parentTrade = await Trade.findOne({
      where: { id: parentTradeId, userId, isParent: true }
    });

    if (!parentTrade) {
      return res.status(404).json({ 
        success: false, 
        error: 'Parent trade not found' 
      });
    }

    const children = await positionAggregationService.getChildTrades(parseInt(parentTradeId));

    res.json({
      success: true,
      data: {
        parent: parentTrade,
        children,
        count: children.length
      }
    });
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch child trades' });
  }
});

/**
 * GET /api/positions/broker-prices
 * Get current prices from all connected brokers for user's open positions
 */
router.get('/broker-prices', authenticate, async (req, res) => {
  try {
    // ALL prices come from centralized streaming (admin-configured)
    const allPrices = centralizedStreamingService.getAllPrices();
    const status = centralizedStreamingService.getStatus();

    res.json({
      success: true,
      data: {
        centralized: {
          provider: status.provider || 'unknown',
          prices: allPrices,
          symbolCount: Object.keys(allPrices).length
        }
      },
      source: 'centralized-streaming',
      provider: status.provider
    });
  } catch (error) {
    console.error('Get broker prices error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch prices' });
  }
});

/**
 * GET /api/positions/broker-status
 * Get connection status for centralized streaming
 */
router.get('/broker-status', authenticate, async (req, res) => {
  try {
    const status = centralizedStreamingService.getStatus();

    res.json({
      success: true,
      data: status,
      connected: status.isConnected,
      provider: status.provider,
      symbolCount: status.subscribedSymbols?.length || 0
    });
  } catch (error) {
    console.error('Get broker status error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch streaming status' });
  }
});

/**
 * POST /api/positions/subscribe-prices
 * Subscribe to price updates for specific symbols
 * 
 * Architecture:
 * - ALL data from CentralizedStreamingService (admin configured)
 * - User brokers are ONLY for trade execution
 */
router.post('/subscribe-prices', authenticate, async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ 
        success: false, 
        error: 'symbols array required' 
      });
    }

    // Subscribe symbols to centralized streaming
    for (const symbol of symbols) {
      await centralizedStreamingService.subscribeSymbol(symbol.toUpperCase());
    }

    const status = centralizedStreamingService.getStatus();

    res.json({
      success: true,
      message: `Subscribed to ${symbols.length} symbols via centralized streaming`,
      provider: status.provider,
      streamType: 'centralized',
      symbols
    });
  } catch (error) {
    console.error('Subscribe prices error:', error);
    res.status(500).json({ success: false, error: 'Failed to subscribe to prices' });
  }
});

/**
 * GET /api/positions/mtm-summary
 * Get MTM summary grouped by broker
 */
router.get('/mtm-summary', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all open trades with API key info
    const trades = await Trade.findAll({
      where: {
        userId,
        status: { [Op.in]: ['Pending', 'Open'] },
        isParent: false
      },
      include: [{
        model: ApiKey,
        as: 'apiKey',
        attributes: ['id', 'broker', 'apiName']
      }]
    });

    // Group MTM by broker
    const mtmByBroker = {};
    let totalMtm = 0;

    for (const trade of trades) {
      const brokerId = trade.apiKeyId || 'unknown';
      const brokerName = trade.apiKey?.broker || trade.broker;

      if (!mtmByBroker[brokerId]) {
        mtmByBroker[brokerId] = {
          broker: brokerName,
          apiName: trade.apiKey?.apiName || brokerName,
          tradeCount: 0,
          totalMtm: 0,
          positions: []
        };
      }

      // Get broker price (uses centralized streaming for Forex)
      const tickPrice = getPrice(brokerId, trade.symbol, trade.market);
      const currentPrice = tickPrice?.last || 
                          parseFloat(trade.brokerLastPrice) || 
                          parseFloat(trade.currentPrice) || 
                          parseFloat(trade.price);

      // Calculate MTM
      const entryPrice = parseFloat(trade.price) || 0;
      const quantity = parseFloat(trade.amount) || 0;
      let priceDiff = trade.type === 'Buy' 
        ? currentPrice - entryPrice 
        : entryPrice - currentPrice;

      let mtm = priceDiff * quantity;
      if (trade.market === 'Forex') {
        mtm *= 100000; // Standard lot multiplier
      }

      mtmByBroker[brokerId].tradeCount++;
      mtmByBroker[brokerId].totalMtm += mtm;
      mtmByBroker[brokerId].positions.push({
        symbol: trade.symbol,
        type: trade.type,
        quantity,
        entryPrice,
        currentPrice,
        mtm
      });

      totalMtm += mtm;
    }

    res.json({
      success: true,
      data: {
        byBroker: Object.values(mtmByBroker),
        totalMtm,
        totalTrades: trades.length,
        brokerCount: Object.keys(mtmByBroker).length
      }
    });
  } catch (error) {
    console.error('Get MTM summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch MTM summary' });
  }
});

/**
 * GET /api/positions/aggregated
 * Get hierarchical aggregated positions (Parent-Child view)
 * Returns positions grouped by symbol with broker drill-down
 */
router.get('/aggregated', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { segment, mode } = req.query;

    // Build where clause for trades
    const whereClause = {
      userId,
      status: { [Op.in]: ['Pending', 'Open'] }
    };

    if (segment && segment !== 'all') {
      whereClause.segment = segment;
    }

    if (mode === 'paper') {
      whereClause.isPaper = true;
    }

    // Get all open trades with broker info
    const trades = await Trade.findAll({
      where: whereClause,
      include: [{
        model: ApiKey,
        as: 'apiKey',
        attributes: ['id', 'broker', 'apiName', 'segment']
      }],
      order: [['symbol', 'ASC'], ['createdAt', 'DESC']]
    });

    // Group by symbol and aggregate
    const positionMap = new Map();

    for (const trade of trades) {
      const symbol = trade.symbol;
      
      if (!positionMap.has(symbol)) {
        positionMap.set(symbol, {
          symbol,
          type: trade.type,
          market: trade.market || trade.segment || 'Forex',
          segment: trade.segment,
          strategyName: trade.strategy?.name || 'Strategy',
          strategyId: trade.strategyId,
          totalQuantity: 0,
          avgEntryPrice: 0,
          currentPrice: 0,
          totalMtm: 0,
          pnlPercentage: 0,
          brokers: []
        });
      }

      const position = positionMap.get(symbol);
      const quantity = parseFloat(trade.amount || trade.volume || 0);
      const entryPrice = parseFloat(trade.price || trade.openPrice || 0);

      // Get current price (uses centralized streaming for Forex)
      const tickPrice = getPrice(trade.apiKeyId, symbol, trade.market);
      const currentPrice = tickPrice?.last || 
                          parseFloat(trade.brokerLastPrice) || 
                          parseFloat(trade.currentPrice) || 
                          entryPrice;

      // Calculate broker-level MTM
      let contractSize = 100000; // Standard Forex
      const symbolUpper = symbol.toUpperCase();
      
      if (symbolUpper.includes('XAU')) {
        contractSize = 100; // Gold
      } else if (symbolUpper.includes('XAG')) {
        contractSize = 5000; // Silver
      }

      const isBuy = trade.type === 'Buy';
      let priceDiff = isBuy ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
      
      let mtm;
      if (trade.market === 'Forex') {
        mtm = priceDiff * quantity * contractSize;
      } else if (trade.market === 'Crypto') {
        mtm = priceDiff * quantity;
      } else {
        mtm = priceDiff * quantity;
      }

      // Find or create broker entry
      let brokerEntry = position.brokers.find(b => b.brokerId === trade.apiKeyId);
      if (!brokerEntry) {
        brokerEntry = {
          brokerId: trade.apiKeyId,
          broker: trade.apiKey?.broker || trade.broker,
          apiName: trade.apiKey?.apiName,
          totalQuantity: 0,
          avgEntryPrice: 0,
          currentPrice,
          mtm: 0,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          trades: []
        };
        position.brokers.push(brokerEntry);
      }

      // Update broker aggregates
      const prevTotal = brokerEntry.totalQuantity * brokerEntry.avgEntryPrice;
      brokerEntry.totalQuantity += quantity;
      brokerEntry.avgEntryPrice = (prevTotal + (quantity * entryPrice)) / brokerEntry.totalQuantity;
      brokerEntry.currentPrice = currentPrice;
      brokerEntry.mtm += mtm;
      brokerEntry.trades.push(trade);

      // Update position aggregates
      const posPrevTotal = position.totalQuantity * position.avgEntryPrice;
      position.totalQuantity += quantity;
      position.avgEntryPrice = (posPrevTotal + (quantity * entryPrice)) / position.totalQuantity;
      position.currentPrice = currentPrice;
      position.totalMtm += mtm;
    }

    // Calculate P&L percentages
    const positions = Array.from(positionMap.values()).map(pos => {
      pos.pnlPercentage = ((pos.totalMtm / (pos.avgEntryPrice * pos.totalQuantity)) * 100) || 0;
      return pos;
    });

    res.json({
      success: true,
      data: positions,
      count: positions.length
    });
  } catch (error) {
    console.error('Get aggregated positions error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch aggregated positions',
      message: error.message 
    });
  }
});

/**
 * POST /api/positions/update-sltp/:symbol
 * Update SL/TP for all positions of a given symbol
 */
router.post('/update-sltp/:symbol', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.params;
    const { stopLoss, takeProfit, stopLossType, takeProfitType, mode } = req.body;

    // Build where clause
    const whereClause = {
      userId,
      symbol: symbol.toUpperCase(),
      status: { [Op.in]: ['Pending', 'Open'] }
    };

    if (mode === 'paper') {
      whereClause.isPaper = true;
    }

    // Find all matching trades
    const trades = await Trade.findAll({ where: whereClause });

    if (trades.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No open positions found for this symbol'
      });
    }

    // Update all trades with new SL/TP
    const updateData = {
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      stopLossType: stopLossType || 'price',
      takeProfitType: takeProfitType || 'price'
    };

    await Trade.update(updateData, { where: whereClause });

    // Emit socket updates
    for (const trade of trades) {
      trade.stopLoss = updateData.stopLoss;
      trade.takeProfit = updateData.takeProfit;
      trade.stopLossType = updateData.stopLossType;
      trade.takeProfitType = updateData.takeProfitType;
      emitTradeUpdate(userId, trade, 'update');
    }

    res.json({
      success: true,
      message: `SL/TP updated for ${trades.length} position(s)`,
      data: {
        symbol,
        updatedCount: trades.length,
        stopLoss: updateData.stopLoss,
        takeProfit: updateData.takeProfit
      }
    });
  } catch (error) {
    console.error('Update SL/TP error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update SL/TP',
      message: error.message 
    });
  }
});

/**
 * POST /api/positions/close-all/:symbol
 * Close all positions for a given symbol
 */
router.post('/close-all/:symbol', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.params;
    const { mode } = req.body;

    // Build where clause
    const whereClause = {
      userId,
      symbol: symbol.toUpperCase(),
      status: { [Op.in]: ['Pending', 'Open'] }
    };

    if (mode === 'paper') {
      whereClause.isPaper = true;
    }

    // Find all matching trades
    const trades = await Trade.findAll({
      where: whereClause,
      include: [{
        model: ApiKey,
        as: 'apiKey',
        attributes: ['id', 'broker', 'exchangeId', 'apiKey', 'apiSecret', 'passphrase', 'accessToken', 'appName']
      }]
    });

    if (trades.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No open positions found for this symbol'
      });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Close each position
    for (const trade of trades) {
      try {
        // Get current price (uses centralized streaming for Forex)
        const tickPrice = getPrice(trade.apiKeyId, trade.symbol, trade.market);
        let closePrice = tickPrice?.last || parseFloat(trade.currentPrice) || parseFloat(trade.price);

        const apiKey = trade.apiKey;
        let closeResult;

        // Execute close on broker
        if (apiKey && apiKey.broker === 'MT5' && apiKey.accessToken && apiKey.appName) {
          await mt5Broker.initialize({
            apiKey: apiKey.accessToken,
            accountId: apiKey.appName
          });
          
          closeResult = await mt5Broker.closeTrade({
            orderId: trade.orderId,
            volume: parseFloat(trade.filledQuantity || trade.amount)
          });
          
          closePrice = closeResult.closePrice || closePrice;
        } else if (!apiKey || apiKey.broker === 'PAPER') {
          const { paperTradingService } = await import('../services/PaperTradingService.js');
          closeResult = await paperTradingService.closePosition({
            userId: trade.userId,
            symbol: trade.symbol,
            closePrice
          });
        }

        // Calculate P&L
        const entryPrice = parseFloat(trade.avgFillPrice || trade.price);
        const quantity = parseFloat(trade.filledQuantity || trade.amount);
        let pnl = trade.type === 'Buy' 
          ? (closePrice - entryPrice) * quantity 
          : (entryPrice - closePrice) * quantity;

        // Update trade record
        await trade.update({
          status: 'Closed',
          currentPrice: closePrice,
          pnl,
          pnlPercentage: ((pnl / (entryPrice * quantity)) * 100).toFixed(2),
          brokerResponseJson: {
            ...trade.brokerResponseJson,
            closeReason: 'CLOSE_ALL',
            closePrice,
            closeTime: new Date().toISOString()
          }
        });

        emitTradeUpdate(userId, trade, 'update');
        
        results.push({ tradeId: trade.id, success: true, pnl });
        successCount++;
      } catch (error) {
        console.error(`Failed to close trade ${trade.id}:`, error);
        results.push({ tradeId: trade.id, success: false, error: error.message });
        failCount++;
      }
    }

    res.json({
      success: successCount > 0,
      message: `Closed ${successCount} of ${trades.length} positions`,
      data: {
        symbol,
        totalPositions: trades.length,
        successCount,
        failCount,
        results
      }
    });
  } catch (error) {
    console.error('Close all positions error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to close positions',
      message: error.message 
    });
  }
});

export default router;