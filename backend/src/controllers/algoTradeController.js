import { Trade, Strategy, ApiKey, User, StrategySubscription, StrategyBroker, Wallet, WalletTransaction, PerTradeCharge, PaperPosition } from '../models/index.js';
import { mt5Broker } from '../../algoengine/index.js';
import { emitTradeUpdate, emitPaperPositionUpdate } from '../config/socket.js';
import { Op } from 'sequelize';
import crypto from 'crypto';
import mt5BrokerPool from '../utils/mt5BrokerPool.js';
import redisClient from '../utils/redisClient.js';
import { sequelize } from '../config/database.js';
import paperTradingService from '../services/PaperTradingService.js';
import * as exchangeService from '../services/exchangeService.js';

/**
 * Get admin-defined per-trade charge for a strategy
 * Returns the charge amount if the strategy has per-trade charge applied
 */
const getAdminPerTradeChargeForStrategy = async (strategyId) => {
  try {
    const perTradeCharge = await PerTradeCharge.findOne({
      where: { isActive: true },
      order: [['id', 'ASC']]
    });

    if (!perTradeCharge || !perTradeCharge.strategyIds) {
      return null;
    }

    // Check if the strategy is in the strategyIds array
    const strategyIds = Array.isArray(perTradeCharge.strategyIds) 
      ? perTradeCharge.strategyIds 
      : JSON.parse(perTradeCharge.strategyIds || '[]');

    if (strategyIds.includes(Number(strategyId))) {
      return {
        amount: parseFloat(perTradeCharge.amount),
        description: perTradeCharge.description
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking admin per trade charge for strategy:', error);
    return null;
  }
};

/**
 * Per-Trade Charge Deduction System
 * Deducts charge from subscriber wallet (admin-defined charges, no credit to owner)
 * 
 * @param {Object} params
 * @param {number} params.subscriberId - The subscriber user ID
 * @param {number} params.ownerId - The strategy owner user ID
 * @param {number} params.strategyId - The strategy ID
 * @param {number} params.tradeId - The trade ID
 * @param {number} params.chargeAmount - The charge amount to deduct
 * @param {string} params.strategyName - The strategy name for reference
 * @returns {Object} { success: boolean, error?: string, subscriberDeducted?: number }
 */
const processPerTradeCharge = async ({ subscriberId, ownerId, strategyId, tradeId, chargeAmount, strategyName }) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Skip if no charge or owner trading their own strategy
    if (!chargeAmount || chargeAmount <= 0 || subscriberId === ownerId) {
      await transaction.commit();
      return { success: true, skipped: true, reason: 'No charge applicable or owner trading' };
    }

    // Get subscriber wallet
    const subscriberWallet = await Wallet.findOne({
      where: { userId: subscriberId, status: 'Active' },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!subscriberWallet) {
      await transaction.rollback();
      return { success: false, error: 'Subscriber wallet not found or inactive' };
    }

    const currentBalance = parseFloat(subscriberWallet.balance) || 0;
    
    // Check if subscriber has sufficient balance
    if (currentBalance < chargeAmount) {
      await transaction.rollback();
      console.warn(`⚠️ Insufficient balance for per-trade charge: User ${subscriberId} has ${currentBalance}, needs ${chargeAmount}`);
      // We still allow the trade to go through, just log the warning
      // In a stricter implementation, you might want to block the trade
      return { 
        success: false, 
        error: 'Insufficient balance for per-trade charge',
        currentBalance,
        requiredAmount: chargeAmount
      };
    }

    // Calculate new balance
    const newSubscriberBalance = currentBalance - chargeAmount;

    // Deduct from subscriber wallet
    await subscriberWallet.update(
      { balance: newSubscriberBalance },
      { transaction }
    );

    // Create transaction record for subscriber (debit)
    // Note: Admin-defined per-trade charges are platform charges, not credited to strategy owner
    await WalletTransaction.create({
      walletId: subscriberWallet.id,
      type: 'debit',
      amount: chargeAmount,
      description: `Per-trade charge for strategy: ${strategyName}`,
      reference: `PTC-${tradeId}-${strategyId}`,
      balanceAfter: newSubscriberBalance
    }, { transaction });

    await transaction.commit();

    console.log(`💰 Per-trade charge processed: ${chargeAmount} INR from user ${subscriberId} for trade ${tradeId}`);

    return {
      success: true,
      subscriberDeducted: chargeAmount,
      subscriberNewBalance: newSubscriberBalance
    };
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Per-trade charge processing error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Execute Trade Based on Strategy Configuration
 * POST /api/algo-trades/execute
 * 
 * Request Body:
 * {
 *   "strategyId": 123,
 *   "signal": "BUY" | "SELL",
 *   "symbol": "EURUSD" (optional - uses strategy symbol if not provided)
 * }
 */
export const executeStrategyTrade = async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId, signal, symbol: customSymbol } = req.body;

    // Validate input
    if (!strategyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'strategyId is required' 
      });
    }

    if (!signal || !['BUY', 'SELL'].includes(signal.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        error: 'signal must be either BUY or SELL' 
      });
    }

    // Fetch strategy with user verification
    const strategy = await Strategy.findOne({
      where: { id: strategyId, userId }
    });

    if (!strategy) {
      return res.status(404).json({ 
        success: false, 
        error: 'Strategy not found or access denied' 
      });
    }

    // Check if strategy is active
    if (!strategy.isActive) {
      return res.status(400).json({ 
        success: false, 
        error: 'Strategy is not active' 
      });
    }

    // Get trading symbol
    const symbol = customSymbol || strategy.symbol;
    if (!symbol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Symbol is required. Provide in request or set in strategy.' 
      });
    }

    // Parse market risk configuration
    const marketRisk = strategy.marketRisk || {};
    const {
      stopLossType = 'points',
      stopLossValue = 50,
      takeProfitType = 'points',
      takeProfitValue = 100,
      trailingStopLoss = false,
      trailingStopValue = 0,
      riskPercent = 1,
      usePositionSizing = false
    } = marketRisk;

    // Get user's API key for the strategy segment
    const apiKey = await ApiKey.findOne({
      where: { 
        userId,
        segment: strategy.segment,
        broker: 'MT5' // Currently only MT5 supported
      }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: `No MT5 API key found for ${strategy.segment} segment. Please add your MT5 credentials first.` 
      });
    }

    // Validate MT5 credentials
    if (!apiKey.accessToken || !apiKey.appName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid MT5 credentials',
        details: 'Both Access Token and Account ID are required. Please update your MT5 API key.' 
      });
    }

    // Get lots from strategy (default to 0.01 if not specified)
    const volume = strategy.lots || 0.01;

    // Initialize MT5 broker if not already connected
    try {
      const isConnected = await mt5Broker.healthCheck();
      if (!isConnected) {
        await mt5Broker.initialize({
          apiKey: apiKey.accessToken, // MetaAPI JWT token
          accountId: apiKey.appName   // MT5 account ID
        });
      }
    } catch (initError) {
      console.error('MT5 initialization error:', initError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to connect to MT5 broker',
        details: initError.message
      });
    }

    // Get account info for position sizing
    let accountInfo;
    try {
      accountInfo = await mt5Broker.getAccountInfo();
    } catch (accountError) {
      console.error('Get account info error:', accountError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve account information',
        details: accountError.message
      });
    }

    // Calculate position size if enabled
    let calculatedVolume = volume;
    if (usePositionSizing && accountInfo) {
      try {
        const currentPrice = await mt5Broker.getPrice(symbol);
        const slPrice = signal === 'BUY' 
          ? currentPrice.bid - (stopLossValue * 0.0001) // Approximate for points
          : currentPrice.ask + (stopLossValue * 0.0001);
        
        const { CalculationService } = await import('../../algoengine/brokers/mt5/services/CalculationService.js');
        calculatedVolume = CalculationService.calculatePositionSize(
          accountInfo.balance,
          riskPercent,
          currentPrice.bid,
          slPrice
        );
        
        // Round to 2 decimal places and ensure minimum lot size
        calculatedVolume = Math.max(0.01, Math.round(calculatedVolume * 100) / 100);
      } catch (sizeError) {
        console.error('Position sizing error:', sizeError);
        // Continue with default volume if calculation fails
      }
    }

    // Prepare trade parameters
    const tradeParams = {
      symbol: symbol.toUpperCase(),
      type: signal.toUpperCase(),
      volume: calculatedVolume,
      stopLoss: {
        type: stopLossType,
        value: stopLossValue
      },
      takeProfit: {
        type: takeProfitType,
        value: takeProfitValue
      },
      comment: `Strategy: ${strategy.name} (ID: ${strategyId})`
    };

    // Execute trade via MT5 broker
    let tradeResult;
    try {
      console.log(`Executing ${signal} trade for strategy ${strategyId}:`, tradeParams);
      tradeResult = await mt5Broker.placeTrade(tradeParams);
    } catch (tradeError) {
      console.error('Trade execution error:', tradeError);
      
      // Save failed trade to database
      const failedTrade = await Trade.create({
        userId,
        orderId: `FAILED_${Date.now()}`,
        market: strategy.segment,
        symbol: symbol.toUpperCase(),
        type: signal === 'BUY' ? 'Buy' : 'Sell',
        amount: calculatedVolume,
        price: 0,
        status: 'Failed',
        date: new Date(),
        broker: 'MT5',
        brokerType: apiKey.broker,
        strategyId: strategyId,
        // Order-log fields
        signalReceivedAt: new Date(),
        signalPayload: {
          source: 'strategy-execute',
          signal: signal.toUpperCase(),
          symbol: symbol.toUpperCase(),
          strategyId,
          volume: calculatedVolume
        },
        signalSendStatus: 'Failed',
        signalSendError: tradeError?.message,
        filledQuantity: null,
        avgFillPrice: null,
        brokerStatus: 'REJECTED',
        brokerError: tradeError?.message,
        brokerResponse: tradeError?.message,
        brokerResponseJson: {
          error: tradeError?.message,
          name: tradeError?.name,
          stack: tradeError?.stack,
          timestamp: new Date().toISOString()
        }
      });

      console.error(`❌ Trade failed for user ${user.email}:`, tradeError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Trade execution failed',
        message: 'Broker rejected the trade',
        signal: signal.toUpperCase(),
        symbol: symbol.toUpperCase(),
        volume: calculatedVolume,
        strategy: strategy.name,
        broker: 'MT5',
        brokerError: tradeError.message,
        tradeId: failedTrade.id,
        timestamp: new Date().toISOString()
      });
    }

    // Save successful trade to database
    const trade = await Trade.create({
      userId,
      orderId: tradeResult.brokerOrderId || tradeResult.orderId,
      market: strategy.segment,
      symbol: symbol.toUpperCase(),
      type: signal === 'BUY' ? 'Buy' : 'Sell',
      amount: tradeResult.volume,
      price: tradeResult.openPrice,
      currentPrice: tradeResult.openPrice,
      status: tradeResult.status === 'FILLED' ? 'Completed' : 'Pending',
      date: new Date(),
      broker: 'MT5',
      brokerType: apiKey.broker,
      strategyId: strategyId,
      stopLoss: tradeResult.stopLoss,
      takeProfit: tradeResult.takeProfit,
      // Order-log fields
      signalReceivedAt: new Date(),
      signalPayload: {
        source: 'strategy-execute',
        signal: signal.toUpperCase(),
        symbol: symbol.toUpperCase(),
        strategyId,
        volume: calculatedVolume
      },
      signalSendStatus: 'Sent',
      signalSendError: null,
      filledQuantity: tradeResult?.volume ?? calculatedVolume,
      avgFillPrice: tradeResult?.openPrice ?? null,
      brokerStatus: tradeResult?.status || 'UNKNOWN',
      brokerError: null,
      brokerResponse: JSON.stringify({ status: tradeResult?.status || 'UNKNOWN' }),
      brokerResponseJson: {
        ...tradeResult?.brokerResponse,
        executionTime: tradeResult?.executionTime,
        raw: tradeResult,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Trade executed successfully: ${trade.orderId} - ${signal} ${calculatedVolume} ${symbol} @ ${tradeResult.openPrice}`);

    // Emit real-time update
    emitTradeUpdate(userId, trade, 'create');

    // Prepare response
    res.status(201).json({
      success: true,
      message: 'Trade executed successfully',
      data: {
        tradeId: trade.id,
        orderId: trade.orderId,
        symbol: trade.symbol,
        type: trade.type,
        volume: trade.amount,
        openPrice: trade.price,
        stopLoss: tradeResult.stopLoss,
        takeProfit: tradeResult.takeProfit,
        status: trade.status,
        executionTime: tradeResult.executionTime,
        strategy: {
          id: strategy.id,
          name: strategy.name
        },
        broker: {
          name: 'MT5',
          account: accountInfo.broker
        }
      }
    });

  } catch (error) {
    console.error('Execute strategy trade error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

/**
 * Execute Manual Trade with Custom Parameters
 * POST /api/algo-trades/manual
 * 
 * Request Body:
 * {
 *   "symbol": "EURUSD",
 *   "type": "BUY" | "SELL",
 *   "volume": 0.01,
 *   "stopLoss": { "type": "points", "value": 50 },
 *   "takeProfit": { "type": "points", "value": 100 },
 *   "segment": "Forex"
 * }
 */
export const executeManualTrade = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      symbol, 
      type, 
      volume, 
      stopLoss, 
      takeProfit, 
      segment = 'Forex',
      comment 
    } = req.body;

    // Validate required fields
    if (!symbol || !type || !volume) {
      return res.status(400).json({ 
        success: false, 
        error: 'symbol, type, and volume are required' 
      });
    }

    if (!['BUY', 'SELL'].includes(type.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        error: 'type must be either BUY or SELL' 
      });
    }

    // Get user's API key
    const apiKey = await ApiKey.findOne({
      where: { 
        userId,
        segment,
        broker: 'MT5'
      }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: `No MT5 API key found for ${segment} segment` 
      });
    }

    // Initialize MT5 broker
    try {
      const isConnected = await mt5Broker.healthCheck();
      if (!isConnected) {
        await mt5Broker.initialize({
          apiKey: apiKey.apiKey,
          accountId: apiKey.appName
        });
      }
    } catch (initError) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to connect to MT5 broker',
        details: initError.message
      });
    }

    // Prepare trade parameters
    const tradeParams = {
      symbol: symbol.toUpperCase(),
      type: type.toUpperCase(),
      volume: parseFloat(volume),
      stopLoss: stopLoss || { type: 'points', value: 50 },
      takeProfit: takeProfit || { type: 'points', value: 100 },
      comment: comment || `Manual trade by user ${userId}`
    };

    // Execute trade
    const tradeResult = await mt5Broker.placeTrade(tradeParams);

    // Save to database
    const trade = await Trade.create({
      userId,
      orderId: tradeResult.brokerOrderId || tradeResult.orderId,
      market: segment,
      symbol: symbol.toUpperCase(),
      type: type === 'BUY' ? 'Buy' : 'Sell',
      amount: tradeResult.volume,
      price: tradeResult.openPrice,
      currentPrice: tradeResult.openPrice,
      status: tradeResult.status === 'FILLED' ? 'Completed' : 'Pending',
      date: new Date(),
      broker: 'MT5',
      brokerType: apiKey.broker,
      stopLoss: tradeResult.stopLoss,
      takeProfit: tradeResult.takeProfit,
      brokerResponse: JSON.stringify(tradeResult.brokerResponse)
    });

    emitTradeUpdate(userId, trade, 'create');

    res.status(201).json({
      success: true,
      message: 'Manual trade executed successfully',
      data: {
        tradeId: trade.id,
        orderId: trade.orderId,
        symbol: trade.symbol,
        type: trade.type,
        volume: trade.amount,
        openPrice: trade.price,
        stopLoss: tradeResult.stopLoss,
        takeProfit: tradeResult.takeProfit,
        status: trade.status,
        executionTime: tradeResult.executionTime
      }
    });

  } catch (error) {
    console.error('Execute manual trade error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to execute manual trade',
      details: error.message 
    });
  }
};

/**
 * Get Current Price for Symbol
 * GET /api/algo-trades/price/:symbol
 */
export const getSymbolPrice = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { segment = 'Forex' } = req.query;
    const userId = req.user.id;

    // Get user's API key
    const apiKey = await ApiKey.findOne({
      where: { userId, segment, broker: 'MT5' }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: 'No MT5 API key found' 
      });
    }

    // Initialize broker
    const isConnected = await mt5Broker.healthCheck();
    if (!isConnected) {
      await mt5Broker.initialize({
        apiKey: apiKey.apiKey,
        accountId: apiKey.appName
      });
    }

    // Get price
    const price = await mt5Broker.getPrice(symbol.toUpperCase());

    res.json({
      success: true,
      data: price
    });

  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch price',
      details: error.message 
    });
  }
};

/**
 * Close Trade by Order ID
 * POST /api/algo-trades/close/:orderId
 */
export const closeAlgoTrade = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Find trade in database
    const trade = await Trade.findOne({
      where: { orderId, userId }
    });

    if (!trade) {
      return res.status(404).json({ 
        success: false, 
        error: 'Trade not found' 
      });
    }

    // Get API key
    const apiKey = await ApiKey.findOne({
      where: { 
        userId, 
        segment: trade.market,
        broker: 'MT5'
      }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: 'No MT5 API key found' 
      });
    }

    // Initialize broker
    const isConnected = await mt5Broker.healthCheck();
    if (!isConnected) {
      await mt5Broker.initialize({
        apiKey: apiKey.apiKey,
        accountId: apiKey.appName
      });
    }

    // Close trade
    const closeResult = await mt5Broker.closeTrade(orderId);

    // Update database
    await trade.update({
      status: closeResult?.success ? 'Completed' : 'Failed',
      currentPrice: closeResult.closePrice,
      pnl: closeResult.profit,
      pnlPercentage: closeResult.profitPercent,
      brokerResponse: closeResult?.success ? 'Closed successfully' : (closeResult?.error || 'Close failed'),
      brokerResponseJson: {
        source: 'TradingView Close Webhook',
        raw: closeResult,
        timestamp: new Date().toISOString()
      }
    });

    emitTradeUpdate(userId, trade, 'update');

    res.json({
      success: true,
      message: 'Trade closed successfully',
      data: {
        orderId: trade.orderId,
        closePrice: closeResult.closePrice,
        profit: closeResult.profit,
        profitPercent: closeResult.profitPercent
      }
    });

  } catch (error) {
    console.error('Close trade error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to close trade',
      details: error.message 
    });
  }
};

/**
 * Get Open Positions
 * GET /api/algo-trades/positions
 */
export const getOpenPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { segment = 'Forex' } = req.query;

    // Get API key
    const apiKey = await ApiKey.findOne({
      where: { userId, segment, broker: 'MT5' }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: 'No MT5 API key found' 
      });
    }

    // Initialize broker
    const isConnected = await mt5Broker.healthCheck();
    if (!isConnected) {
      await mt5Broker.initialize({
        apiKey: apiKey.apiKey,
        accountId: apiKey.appName
      });
    }

    // Get open positions
    const positions = await mt5Broker.getOpenOrders();

    res.json({
      success: true,
      data: positions,
      count: positions.length
    });

  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch open positions',
      details: error.message 
    });
  }
};

/**
 * Get Account Information
 * GET /api/algo-trades/account
 */
export const getAccountInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { segment = 'Forex' } = req.query;

    // Get API key
    const apiKey = await ApiKey.findOne({
      where: { userId, segment, broker: 'MT5' }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: 'No MT5 API key found' 
      });
    }

    // Initialize broker
    const isConnected = await mt5Broker.healthCheck();
    if (!isConnected) {
      await mt5Broker.initialize({
        apiKey: apiKey.apiKey,
        accountId: apiKey.appName
      });
    }

    // Get account info
    const accountInfo = await mt5Broker.getAccountInfo();

    res.json({
      success: true,
      data: accountInfo
    });

  } catch (error) {
    console.error('Get account info error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch account information',
      details: error.message 
    });
  }
};

/**
 * Get Multiple Symbol Prices (Batch Request)
 * POST /api/algo-trades/prices
 * @body { symbols: string[], segment?: string }
 */
export const getMultipleSymbolPrices = async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbols, segment = 'Forex' } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Symbols array is required',
        example: { symbols: ['EURUSD', 'GBPUSD'], segment: 'Forex' }
      });
    }

    // Get API key
    const apiKey = await ApiKey.findOne({
      where: { userId, segment, broker: 'MT5' }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: 'No MT5 API key found for segment: ' + segment 
      });
    }

    // Initialize broker if needed
    const isConnected = await mt5Broker.healthCheck();
    if (!isConnected) {
      await mt5Broker.initialize({
        apiKey: apiKey.accessToken || apiKey.apiKey,
        accountId: apiKey.appName
      });
    }

    // Fetch prices for all symbols
    const prices = {};
    const errors = {};

    console.log(`📊 Fetching prices for ${symbols.length} symbols:`, symbols);

    for (const symbol of symbols) {
      try {
        const price = await mt5Broker.getPrice(symbol);
        prices[symbol] = {
          bid: price.bid,
          ask: price.ask,
          last: price.last || price.bid,
          spread: price.ask - price.bid,
          time: new Date().toISOString()
        };
        console.log(`✅ Price fetched for ${symbol}:`, prices[symbol]);
      } catch (error) {
        console.error(`❌ Failed to fetch price for ${symbol}:`, error.message);
        errors[symbol] = error.message;
      }
    }

    console.log('📤 Sending price response:', { success: true, symbolCount: Object.keys(prices).length });

    res.json({
      success: true,
      data: prices,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get multiple prices error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch symbol prices',
      details: error.message 
    });
  }
};
/**
 * Execute Trade from TradingView Webhook (Multi-Subscriber)
 * POST /api/algo-trades/webhook
 * 
 * NEW: Uses strategy-level secret. All active subscribers receive trades.
 * 
 * TradingView Webhook Format:
 * {
 *   "secret": "ST123456",    // Strategy's webhook secret (not user secret)
 *   "signal": "BUY" | "SELL" | 0,
 *   "symbol": "EURUSD" (optional)
 * }
 */
export const executeTradingViewWebhook = async (req, res) => {
  try {
    const { secret, signal, symbol: customSymbol } = req.body;
    const signalReceivedAt = new Date();

    // Validate secret
    if (!secret) {
      console.warn('❌ Missing secret key');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        message: 'Strategy webhook secret is required',
        example: { secret: "ST123456", signal: "BUY" }
      });
    }

    // Find strategy by webhook secret
    const strategy = await Strategy.findOne({
      where: { webhookSecret: secret },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!strategy) {
      console.warn(`❌ Invalid webhook secret: ${secret}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication failed',
        message: 'Invalid strategy webhook secret',
        receivedSecret: secret
      });
    }

    // Log webhook receipt
    console.log(`📡 Webhook received from ${req.ip}:`, { 
      strategyId: strategy.id, 
      strategyName: strategy.name,
      strategyOwner: strategy.user?.email,
      signal, 
      symbol: customSymbol 
    });

    // Parse signal: BUY/SELL/buy/sell or numeric (positive=BUY, negative=SELL, 0=CLOSE)
    let parsedSignal;
    let isCloseSignal = false;
    
    if (signal === 0 || signal === '0') {
      isCloseSignal = true;
      parsedSignal = 'CLOSE';
    } else if (typeof signal === 'number') {
      parsedSignal = signal > 0 ? 'BUY' : 'SELL';
    } else if (typeof signal === 'string') {
      const upperSignal = signal.toUpperCase();
      if (['BUY', 'SELL'].includes(upperSignal)) {
        parsedSignal = upperSignal;
      } else {
        // Try to parse as number
        const numSignal = parseFloat(signal);
        if (isNaN(numSignal)) {
          console.warn(`❌ Invalid signal: ${signal}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid signal',
            message: 'signal must be: "BUY", "SELL", positive number (buy), negative number (sell), or 0 (close)',
            received: signal,
            examples: ['BUY', 'SELL', '1', '-1', '0']
          });
        }
        if (numSignal === 0) {
          isCloseSignal = true;
          parsedSignal = 'CLOSE';
        } else {
          parsedSignal = numSignal > 0 ? 'BUY' : 'SELL';
        }
      }
    } else {
      console.warn(`❌ Invalid signal type: ${typeof signal}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid signal',
        message: 'signal must be string or number',
        received: signal
      });
    }

    console.log(`✅ Signal parsed: ${parsedSignal}`);

    // Get strategy owner's userId
    const userId = strategy.userId;
    const strategyId = strategy.id;

    // Check if strategy is active
    if (!strategy.isActive) {
      console.warn(`❌ Strategy ${strategy.name} is inactive`);
      return res.status(400).json({ 
        success: false, 
        error: 'Strategy inactive',
        message: `Strategy "${strategy.name}" is currently disabled`,
        strategyId: strategy.id,
        strategyName: strategy.name,
        isActive: false
      });
    }

    // Get ALL subscribers (active and unpaused subscriptions) for this strategy
    const subscriptions = await StrategySubscription.findAll({
      where: { 
        strategyId,
        isActive: true,
        isPaused: false  // Only get unpaused subscriptions
      },
      include: [{
        model: User,
        as: 'subscriber',
        attributes: ['id', 'name', 'email']
      }]
    });

    console.log(`👥 Found ${subscriptions.length} active subscriptions for strategy ${strategy.name}`);

    // Group subscriptions by userId and keep only one per user (most recent)
    // This prevents duplicate execution if a user has multiple subscriptions to same strategy
    const uniqueSubscriptions = subscriptions.reduce((acc, sub) => {
      const existingSub = acc.find(s => s.userId === sub.userId);
      if (!existingSub) {
        acc.push(sub);
      } else {
        // Keep the more recent subscription (higher ID = more recent)
        if (sub.id > existingSub.id) {
          const index = acc.findIndex(s => s.userId === sub.userId);
          acc[index] = sub;
        }
      }
      return acc;
    }, []);

    if (uniqueSubscriptions.length < subscriptions.length) {
      console.log(`⚠️ Removed ${subscriptions.length - uniqueSubscriptions.length} duplicate subscription(s) for same user(s)`);
    }

    // Execute for: Strategy Owner + All Subscribers
    // Owner is ALWAYS included (will execute in paper/live mode based on strategy settings)
    const subscriberIds = uniqueSubscriptions.map(sub => sub.userId);
    
    // Add owner if not already in subscribers list
    const usersToExecute = subscriberIds.includes(userId) 
      ? subscriberIds 
      : [userId, ...subscriberIds];
    
    const ownerIncluded = usersToExecute.includes(userId);
    console.log(`🎯 Will execute for ${usersToExecute.length} users (Owner: ${ownerIncluded ? 'YES' : 'NO'}, Subscribers: ${subscriberIds.length})`);

    // Handle CLOSE signal - close positions for all users
    if (isCloseSignal) {
      console.log(`🔄 Close signal received - closing positions for ${usersToExecute.length} users`);
      
      const closeResults = [];
      
      for (const targetUserId of usersToExecute) {
        try {
          // First check if user has paper positions to close
          const paperPositions = await PaperPosition.findAll({
            where: {
              userId: targetUserId,
              strategyId,
              status: 'Open'
            }
          });

          let paperClosedCount = 0;
          if (paperPositions.length > 0) {
            console.log(`📝 Found ${paperPositions.length} open paper positions for user ${targetUserId}`);
            
            for (const paperPos of paperPositions) {
              try {
                const closePriceValue = paperPos.currentPrice || paperPos.openPrice;
                const profitValue = paperPos.profit || 0;
                
                await paperPos.update({
                  status: 'Closed',
                  closeTime: new Date(),
                  closePrice: closePriceValue,
                  currentPrice: closePriceValue,
                  realizedProfit: profitValue,
                  profit: profitValue
                });
                await paperPos.reload();
                
                // Update corresponding trade - try by tradeId first, then by orderId
                let paperTrade = null;
                if (paperPos.tradeId) {
                  paperTrade = await Trade.findOne({
                    where: { id: paperPos.tradeId }
                  });
                }
                
                // If not found by tradeId, try by orderId
                if (!paperTrade) {
                  paperTrade = await Trade.findOne({
                    where: { 
                      userId: targetUserId,
                      orderId: paperPos.orderId,
                      strategyId
                    }
                  });
                }
                
                if (paperTrade) {
                  await paperTrade.update({ 
                    status: 'Completed',
                    currentPrice: closePriceValue,
                    pnl: profitValue,
                    pnlPercentage: paperPos.profitPercent || 0
                  });
                  await paperTrade.reload();
                  await redisClient.publishTradeUpdate(targetUserId, paperTrade, 'update');
                  emitTradeUpdate(targetUserId, paperTrade, 'update');
                  console.log(`✅ Updated trade ${paperTrade.id} to Completed`);
                }
                
                emitPaperPositionUpdate(targetUserId, paperPos, 'update');
                console.log(`📝 Closed paper position ${paperPos.id} @ ${closePriceValue}`);
                paperClosedCount++;
              } catch (err) {
                console.error(`Error closing paper position ${paperPos.id}:`, err);
              }
            }
          }

          // Get user's API key for broker connection
          const apiKey = await ApiKey.findOne({
            where: { 
              userId: targetUserId,
              segment: strategy.segment,
              broker: 'MT5'
            },
            attributes: ['id', 'userId', 'segment', 'broker', 'apiName', 'brokerId', 'mpin', 'totp', 
                        'apiKey', 'apiSecret', 'passphrase', 'appName', 'accessToken', 'autologin', 'status'],
            raw: true
          });

          if (!apiKey || !apiKey.accessToken || !apiKey.appName) {
            console.log(`⚠️ No MT5 API key for user ${targetUserId}`);
            
            if (paperClosedCount > 0) {
              closeResults.push({
                userId: targetUserId,
                success: true,
                closedCount: paperClosedCount,
                failedCount: 0,
                message: `Closed ${paperClosedCount} paper positions`
              });
            } else {
              closeResults.push({
                userId: targetUserId,
                success: false,
                error: 'No API key and no paper positions'
              });
            }
            continue;
          }

          // Initialize MT5 broker for THIS USER
          let userBroker;
          try {
            console.log(`🔌 Getting MT5 connection for close signal - user ${targetUserId}, account: ${apiKey.appName}`);
            userBroker = await mt5BrokerPool.getConnection(
              apiKey.accessToken,
              apiKey.appName
            );
          } catch (initError) {
            console.error(`❌ Failed to initialize MT5 broker for user ${targetUserId}:`, initError);
            closeResults.push({
              userId: targetUserId,
              success: false,
              error: 'Connection failed'
            });
            continue;
          }

          // Get all open positions from MT5
          const openPositions = await userBroker.getOpenOrders();
          
          if (!openPositions || openPositions.length === 0) {
            console.log(`ℹ️ No open MT5 positions for user ${targetUserId}`);
            
            if (paperClosedCount > 0) {
              closeResults.push({
                userId: targetUserId,
                success: true,
                closedCount: paperClosedCount,
                failedCount: 0,
                message: `Closed ${paperClosedCount} paper positions (no MT5 positions)`
              });
            } else {
              closeResults.push({
                userId: targetUserId,
                success: false,
                message: 'No open positions in MT5 or paper'
              });
            }
            continue;
          }

          console.log(`📊 Found ${openPositions.length} open positions for user ${targetUserId}`);

          // Close all positions for this strategy's symbol
          const symbolToClose = customSymbol || strategy.symbol;
          let closedCount = 0;
          let failedCount = 0;

          for (const position of openPositions) {
            // Filter by symbol if specified
            if (symbolToClose && position.symbol !== symbolToClose.toUpperCase()) {
              continue;
            }

            try {
              console.log(`🎯 Closing position ${position.id} (${position.symbol} ${position.type})`);
              
              const closeResult = await userBroker.closeTrade(position.id);

              if (closeResult.success) {
                // Find corresponding trade in database and update
                const dbTrade = await Trade.findOne({
                  where: {
                    userId: targetUserId,
                    strategyId,
                    orderId: String(position.id),
                    status: { [Op.or]: ['Pending', 'Open'] }
                  }
                });

                if (dbTrade) {
                  await dbTrade.update({
                    status: 'Completed',
                    currentPrice: closeResult.closePrice || dbTrade.price,
                    pnl: closeResult.profit || 0,
                    pnlPercentage: closeResult.profitPercent || 0,
                    signalReceivedAt,
                    signalPayload: {
                      source: 'TradingView',
                      requestIp: req.ip,
                      strategyId,
                      signal: 'CLOSE',
                      symbol: symbolToClose || position.symbol,
                      raw: req.body
                    },
                    signalSendStatus: 'Sent',
                    signalSendError: null,
                    brokerStatus: 'CLOSED',
                    brokerError: null,
                    brokerResponse: JSON.stringify({ status: 'CLOSED' }),
                    brokerResponseJson: {
                      raw: closeResult,
                      timestamp: new Date().toISOString()
                    }
                  });

                  // Close corresponding paper position
                  const paperPosition = await PaperPosition.findOne({
                    where: {
                      tradeId: dbTrade.id,
                      status: 'Open'
                    }
                  });

                  if (paperPosition) {
                    const closePriceValue = closeResult.closePrice || dbTrade.currentPrice || paperPosition.currentPrice || paperPosition.openPrice;
                    await paperPosition.update({
                      status: 'Closed',
                      closeTime: new Date(),
                      closePrice: closePriceValue,
                      currentPrice: closePriceValue,
                      realizedProfit: closeResult.profit || 0,
                      profit: closeResult.profit || 0,
                      profitPercent: closeResult.profitPercent || 0
                    });
                    await paperPosition.reload();
                    console.log(`📝 Closed paper position ${paperPosition.id} @ ${closePriceValue}`);
                    emitPaperPositionUpdate(targetUserId, paperPosition, 'update');
                  }

                  console.log(`✅ Closed position ${position.id} and updated trade ${dbTrade.id}`);
                  await redisClient.publishTradeUpdate(targetUserId, dbTrade, 'update');
                  emitTradeUpdate(targetUserId, dbTrade, 'update');
                }

                closedCount++;
              } else {
                console.warn(`⚠️ Failed to close position ${position.id}: ${closeResult.error}`);
                failedCount++;
              }
            } catch (closeError) {
              console.error(`❌ Error closing position ${position.id}:`, closeError);
              failedCount++;
            }
          }

          closeResults.push({
            userId: targetUserId,
            success: (closedCount + paperClosedCount) > 0,
            closedCount: closedCount + paperClosedCount,
            failedCount,
            message: `Closed ${closedCount} MT5 + ${paperClosedCount} paper positions, ${failedCount} failed`
          });
          
          // Release broker connection
          mt5BrokerPool.releaseConnection(apiKey.appName);

        } catch (closeError) {
          console.error(`Failed to process close signal for user ${targetUserId}:`, closeError);

          closeResults.push({
            userId: targetUserId,
            success: false,
            error: closeError.message
          });
        }
      }

      // Return summary of close operations
      const successCount = closeResults.filter(r => r.success).length;
      const failCount = closeResults.filter(r => !r.success).length;

      return res.status(200).json({
        success: true,
        message: `Close signal processed for ${closeResults.length} users`,
        webhook: {
          signal: 'CLOSE',
          receivedAt: signalReceivedAt.toISOString(),
          source: 'TradingView'
        },
        strategy: {
          id: strategy.id,
          name: strategy.name
        },
        execution: {
          total: closeResults.length,
          successful: successCount,
          failed: failCount,
          results: closeResults
        }
      });
    }

    // Get trading symbol
    const symbol = customSymbol || strategy.symbol;
    if (!symbol) {
      console.warn(`❌ No symbol for strategy ${strategy.name}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing symbol',
        message: 'Trading symbol is required. Add it to strategy or send in webhook payload.',
        strategyId: strategy.id,
        strategyName: strategy.name
      });
    }

    // Parse market risk configuration
    const marketRisk = strategy.marketRisk || {};
    const {
      stopLossType = 'points',
      stopLossValue = 50,
      takeProfitType = 'points',
      takeProfitValue = 100,
      riskPercent = 1,
      usePositionSizing = false
    } = marketRisk;

    // Execute trades for all subscribed users
    const executionResults = [];
    const paperTrades = [];

    for (const targetUserId of usersToExecute) {
      const isOwner = targetUserId === userId;
      const userSubscription = uniqueSubscriptions.find(sub => sub.userId === targetUserId);
      
      // All users in execution list have subscriptions, use their subscription settings
      const lotsMultiplier = userSubscription?.lots || 1;
      const tradeMode = userSubscription?.tradeMode || 'paper';
      const isPaperMode = tradeMode === 'paper';

      // Log trade mode
      console.log(`📊 Processing user ${targetUserId}: mode=${tradeMode}, isOwner=${isOwner}, lots=${lotsMultiplier}`);

      // Check if user already has an open position for this strategy (different logic for paper vs live)
      let existingPosition = null;
      let existingType = null;

      if (isPaperMode) {
        // For paper mode, check PaperPosition table
        existingPosition = await PaperPosition.findOne({
          where: {
            userId: targetUserId,
            strategyId,
            status: 'Open'
          },
          order: [['id', 'DESC']]
        });
        if (existingPosition) {
          existingType = existingPosition.type; // 'Buy' or 'Sell'
        }
      } else {
        // For live mode, check Trade table
        existingPosition = await Trade.findOne({
          where: {
            userId: targetUserId,
            strategyId,
            status: { [Op.or]: ['Pending', 'Open'] }
          },
          order: [['id', 'DESC']]
        });
        if (existingPosition) {
          existingType = existingPosition.type; // 'Buy' or 'Sell'
        }
      }

      // Check if signal is same as existing position direction
      if (existingPosition && existingType) {
        const newType = parsedSignal === 'BUY' ? 'Buy' : 'Sell';

        if (existingType === newType) {
          // Same direction signal - skip execution
          console.log(`⏭️ Skipping duplicate ${newType} signal for user ${targetUserId} - already in ${existingType} position (${isPaperMode ? 'Paper' : 'Live'})`);
          
          executionResults.push({
            userId: targetUserId,
            success: true,
            action: 'skipped',
            message: `Already in ${existingType} position`,
            existingPositionId: existingPosition.id,
            mode: tradeMode
          });
          
          continue;
        } else {
          // Opposite direction signal - close existing position first, then open new
          console.log(`🔄 Opposite signal detected for user ${targetUserId} - closing ${existingType} before opening ${newType} (${isPaperMode ? 'Paper' : 'Live'})`);
          
          // Close the existing position based on mode
          if (isPaperMode) {
            // Close paper position
            const closePriceValue = existingPosition.currentPrice || existingPosition.openPrice;
            const profitValue = existingPosition.profit || 0;
            
            await existingPosition.update({
              status: 'Closed',
              closeTime: new Date(),
              closePrice: closePriceValue,
              currentPrice: closePriceValue,
              realizedProfit: profitValue,
              metadata: {
                ...existingPosition.metadata,
                closedReason: 'Opposite signal - Position reversed',
                closedBy: 'TradingView Webhook'
              }
            });
            
            console.log(`✅ Closed paper position ${existingPosition.orderId} for user ${targetUserId}`);
            emitPaperPositionUpdate(targetUserId, existingPosition, 'update');
          } else {
            // Close live trade
            await existingPosition.update({
              status: 'Closed',
              currentPrice: existingPosition.price, // Use entry price as close price for now
              metadata: {
                closedReason: 'Opposite signal - Position reversed',
                closedBy: 'TradingView Webhook',
                closedAt: new Date().toISOString()
              }
            });
            
            console.log(`✅ Closed live trade ${existingPosition.orderId} for user ${targetUserId}`);
            emitTradeUpdate(targetUserId, existingPosition, 'update');
          }
        }
      }

      // PAPER MODE: Create paper position with live price for real-time MTM tracking
      if (isPaperMode) {
        const volume = (strategy.lots || 0.01) * lotsMultiplier;
        const tradeType = parsedSignal === 'BUY' ? 'Buy' : 'Sell';
        console.log(`📝 PAPER trade for user ${targetUserId}: ${parsedSignal} ${volume} ${symbol}`);
        
        // DOUBLE CHECK: Close any remaining open positions before creating new one (Race condition safety)
        const anyOpenPositions = await PaperPosition.findAll({
          where: {
            userId: targetUserId,
            strategyId,
            status: 'Open'
          }
        });
        
        if (anyOpenPositions.length > 0) {
          console.log(`⚠️ Found ${anyOpenPositions.length} open position(s) - closing before creating new (race condition safety)`);
          for (const openPos of anyOpenPositions) {
            await openPos.update({
              status: 'Closed',
              closeTime: new Date(),
              closePrice: openPos.currentPrice || openPos.openPrice,
              realizedProfit: openPos.profit || 0,
              metadata: {
                ...openPos.metadata,
                closedReason: 'Auto-closed before new position (duplicate prevention)',
                closedBy: 'System Safety Check'
              }
            });
            emitPaperPositionUpdate(targetUserId, openPos, 'update');
          }
        }
        
        // Get live MT5 price for realistic paper trading
        let openPrice = null;
        try {
          const priceData = await mt5Broker.getPrice(symbol.toUpperCase());
          // Use ask price for Buy, bid price for Sell (like real broker execution)
          if (priceData && typeof priceData === 'object') {
            openPrice = tradeType === 'Buy' ? priceData.ask : priceData.bid;
            // Fallback to last price if ask/bid not available
            if (!openPrice) openPrice = priceData.last;
          } else if (typeof priceData === 'number') {
            openPrice = priceData;
          }
          console.log(`📈 Got live MT5 price for ${symbol}: ${openPrice} (${tradeType})`);
        } catch (priceError) {
          console.log(`⚠️ Could not get live price for ${symbol}, using fallback: ${priceError.message}`);
        }
        
        // Fallback to strategy's symbolValue or default
        if (!openPrice || isNaN(openPrice)) {
          openPrice = parseFloat(strategy.symbolValue) || 100;
        }
        
        // Get SL/TP from strategy's marketRisk if available
        let stopLoss = null;
        let takeProfit = null;
        try {
          const marketRisk = typeof strategy.marketRisk === 'string' 
            ? JSON.parse(strategy.marketRisk) 
            : strategy.marketRisk;
          if (marketRisk) {
            stopLoss = marketRisk.stopLoss || null;
            takeProfit = marketRisk.takeProfit || null;
          }
        } catch (e) {
          console.log('Could not parse marketRisk for SL/TP');
        }
        
        // Generate unique order ID
        const orderId = `PAPER-${Date.now()}-${targetUserId}`;
        
        // Create paper position for live tracking (NO Trade table entry for paper mode)
        const paperPosition = await PaperPosition.create({
          orderId,
          tradeId: null, // Paper positions don't have trade entries
          userId: targetUserId,
          strategyId,
          market: strategy.segment,
          symbol: symbol.toUpperCase(),
          type: tradeType,
          volume,
          openPrice,
          currentPrice: openPrice,
          stopLoss,
          takeProfit,
          profit: 0,
          profitPercent: 0,
          status: 'Open',
          openTime: new Date(),
          metadata: {
            source: 'TradingView_Paper',
            tradeMode: 'paper',
            requestIp: req.ip,
            signal: parsedSignal
          }
        });

        console.log(`📝 Paper position opened for user ${targetUserId}: ${paperPosition.orderId} @ ${openPrice}`);

        // Emit real-time updates - ONLY emit paper position update, not trade update
        emitPaperPositionUpdate(targetUserId, paperPosition, 'create');

        paperTrades.push({
          userId: targetUserId,
          tradeId: null, // No trade entry for paper mode
          paperPositionId: paperPosition.id,
          orderId: paperPosition.orderId,
          volume,
          price: openPrice,
          status: 'open',
          mode: 'paper'
        });
        
        continue; // Skip broker execution for paper trades
      }

      // LIVE MODE: Check for selected brokers first
      let apiKeysToUse = [];
      
      // Check if user has specific brokers selected for this strategy
      const selectedBrokers = await StrategyBroker.findAll({
        where: {
          strategyId,
          isActive: true
        },
        include: [{
          model: ApiKey,
          as: 'apiKey',
          where: { userId: targetUserId, status: 'Active' },
          required: true
        }]
      });

      if (selectedBrokers.length > 0) {
        apiKeysToUse = selectedBrokers.map(sb => sb.apiKey);
        console.log(`🎯 Found ${apiKeysToUse.length} selected broker(s) for user ${targetUserId}`);
      } else {
        // Fallback: Get user's default API key for this segment
        const defaultApiKey = await ApiKey.findOne({
          where: { 
            userId: targetUserId,
            segment: strategy.segment,
            status: 'Active',
            isDefault: true
          },
          attributes: ['id', 'userId', 'segment', 'broker', 'exchangeId', 'accountType', 'apiName', 'brokerId', 'mpin', 'totp', 
                      'apiKey', 'apiSecret', 'passphrase', 'appName', 'accessToken', 'autologin', 'status'],
          raw: true
        });
        
        if (defaultApiKey) {
          apiKeysToUse = [defaultApiKey];
          console.log(`📌 Using default API for user ${targetUserId}: ${defaultApiKey.broker}`);
        } else {
          // Last fallback: Any active API for this segment (MT5 or CCXT)
          const anyActiveKey = await ApiKey.findOne({
            where: { 
              userId: targetUserId,
              segment: strategy.segment,
              status: 'Active'
            },
            attributes: ['id', 'userId', 'segment', 'broker', 'exchangeId', 'accountType', 'apiName', 'brokerId', 'mpin', 'totp', 
                        'apiKey', 'apiSecret', 'passphrase', 'appName', 'accessToken', 'autologin', 'status'],
            raw: true
          });
          
          if (anyActiveKey) {
            apiKeysToUse = [anyActiveKey];
            console.log(`📍 Using first available API for user ${targetUserId}: ${anyActiveKey.broker}`);
          }
        }
      }

      if (apiKeysToUse.length === 0) {
        console.warn(`⚠️ No API key for user ${targetUserId} - ${strategy.segment}`);
        
        // Create trade record with error - broker not connected
        const failedTrade = await Trade.create({
          userId: targetUserId,
          strategyId,
          orderId: `NOBROKER-${Date.now()}-${targetUserId}`,
          market: strategy.segment,
          symbol: symbol.toUpperCase(),
          type: parsedSignal,
          amount: (strategy.lots || 0.01) * lotsMultiplier,
          price: 0,
          currentPrice: 0,
          pnl: 0,
          pnlPercentage: 0,
          status: 'Failed',
          date: new Date(),
          broker: 'MT5',
          brokerType: 'MT5',
          signalReceivedAt,
          signalPayload: {
            source: 'TradingView',
            requestIp: req.ip,
            strategyId,
            signal: parsedSignal,
            symbol: symbol.toUpperCase(),
            raw: req.body
          },
          signalSendStatus: 'Failed',
          signalSendError: 'Broker not connected',
          brokerStatus: 'NOT_CONNECTED',
          brokerError: 'No MT5 API key configured. Please add your broker credentials.',
          brokerResponse: 'Broker not connected - trade not executed'
        });

        executionResults.push({
          userId: targetUserId,
          success: false,
          error: 'Broker not connected',
          tradeId: failedTrade.id
        });

        // Emit to dashboard
        emitTradeUpdate(targetUserId, failedTrade, 'create');
        
        continue;
      }

      // EXECUTE ON ALL SELECTED BROKERS (not just first one)
      console.log(`🎯 Executing trade on ${apiKeysToUse.length} broker(s) for user ${targetUserId}`);
      
      for (const apiKey of apiKeysToUse) {
        console.log(`📍 Broker: ${apiKey.broker} - ${apiKey.apiName || apiKey.appName}`);

      // Determine broker type and validate credentials
      const isMT5 = apiKey.broker === 'MT5' || (!apiKey.exchangeId && apiKey.accessToken);
      const isCCXT = apiKey.exchangeId || (!isMT5 && apiKey.apiKey && apiKey.apiSecret);

      // Validate credentials based on broker type
      if (isMT5 && (!apiKey.accessToken || !apiKey.appName)) {
        console.warn(`⚠️ Invalid MT5 credentials for user ${targetUserId}`);
        
        // Create trade record with error
        const failedTrade = await Trade.create({
          userId: targetUserId,
          strategyId,
          orderId: `INVALIDCRED-${Date.now()}-${targetUserId}`,
          market: strategy.segment,
          symbol: symbol.toUpperCase(),
          type: parsedSignal,
          amount: (strategy.lots || 0.01) * lotsMultiplier,
          price: 0,
          currentPrice: 0,
          pnl: 0,
          pnlPercentage: 0,
          status: 'Failed',
          date: new Date(),
          broker: 'MT5',
          brokerType: 'MT5',
          signalReceivedAt,
          signalPayload: {
            source: 'TradingView',
            requestIp: req.ip,
            strategyId,
            signal: parsedSignal,
            symbol: symbol.toUpperCase(),
            raw: req.body
          },
          signalSendStatus: 'Failed',
          signalSendError: 'Invalid broker credentials',
          brokerStatus: 'INVALID_CREDENTIALS',
          brokerError: 'Access Token and Account ID are required',
          brokerResponse: 'Invalid credentials - trade not executed'
        });

        executionResults.push({
          userId: targetUserId,
          success: false,
          error: 'Invalid credentials',
          tradeId: failedTrade.id
        });

        emitTradeUpdate(targetUserId, failedTrade, 'create');
        
        continue;
      }

      if (isCCXT && (!apiKey.apiKey || !apiKey.apiSecret)) {
        console.warn(`⚠️ Invalid CCXT credentials for user ${targetUserId} on ${apiKey.exchangeId || apiKey.broker}`);
        
        // Create trade record with error
        const failedTrade = await Trade.create({
          userId: targetUserId,
          strategyId,
          orderId: `INVALIDCRED-${Date.now()}-${targetUserId}`,
          market: strategy.segment,
          symbol: symbol.toUpperCase(),
          type: parsedSignal,
          amount: (strategy.lots || 0.01) * lotsMultiplier,
          price: 0,
          currentPrice: 0,
          pnl: 0,
          pnlPercentage: 0,
          status: 'Failed',
          date: new Date(),
          broker: apiKey.exchangeId || apiKey.broker,
          brokerType: 'CCXT',
          signalReceivedAt,
          signalPayload: {
            source: 'TradingView',
            requestIp: req.ip,
            strategyId,
            signal: parsedSignal,
            symbol: symbol.toUpperCase(),
            raw: req.body
          },
          signalSendStatus: 'Failed',
          signalSendError: 'Invalid broker credentials',
          brokerStatus: 'INVALID_CREDENTIALS',
          brokerError: 'API Key and Secret are required',
          brokerResponse: 'Invalid credentials - trade not executed'
        });

        executionResults.push({
          userId: targetUserId,
          success: false,
          error: 'Invalid credentials',
          tradeId: failedTrade.id
        });

        emitTradeUpdate(targetUserId, failedTrade, 'create');
        
        continue;
      }

      // Get volume with lot multiplier
      const volume = (strategy.lots || 0.01) * lotsMultiplier;

      // Execute trade based on broker type
      let tradeResult;
      let userBroker; // For MT5 only

      if (isMT5) {
        // MT5 EXECUTION
        try {
          console.log(`🔌 Getting MT5 connection for user ${targetUserId}, account: ${apiKey.appName}`);
          
          // Use broker pool to get per-user connection with 20s timeout
          const connectionPromise = mt5BrokerPool.getConnection(
            apiKey.accessToken,
            apiKey.appName
          );
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout after 20 seconds')), 20000)
          );
          
          userBroker = await Promise.race([connectionPromise, timeoutPromise]);
          
          console.log(`✅ MT5 connection ready for user ${targetUserId}`);
          
          // Place MT5 trade
          tradeResult = await userBroker.placeTrade({
            symbol: symbol.toUpperCase(),
            type: parsedSignal,
            volume,
            stopLoss: {
              type: stopLossType,
              value: stopLossValue
            },
            takeProfit: {
              type: takeProfitType,
              value: takeProfitValue
            },
            comment: `TradingView: ${strategy.name} (Subscriber: ${targetUserId})`
          });
        } catch (initError) {
          console.error(`❌ MT5 init/trade error for user ${targetUserId}:`, initError.message);
          
          // Detect subscription limit error
          const isSubscriptionLimit = initError.message?.includes('TooManyRequestsError') || 
                                       initError.message?.includes('subscription');
          const errorMessage = isSubscriptionLimit 
            ? 'MT5 subscription limit reached. Please try again in 10 minutes.'
            : 'Failed to connect to broker';
          
          // Create failed trade record
          const failedTrade = await Trade.create({
            userId: targetUserId,
            strategyId,
            orderId: `CONNFAIL-${Date.now()}-${targetUserId}`,
            market: strategy.segment,
            symbol: symbol.toUpperCase(),
            type: parsedSignal,
            amount: volume,
            price: 0,
            currentPrice: 0,
            pnl: 0,
            pnlPercentage: 0,
            status: 'Failed',
            date: new Date(),
            broker: 'MT5',
            brokerType: 'MT5',
            signalReceivedAt,
            signalPayload: {
              source: 'TradingView',
              requestIp: req.ip,
              strategyId,
              signal: parsedSignal,
              symbol: symbol.toUpperCase(),
              raw: req.body
            },
            signalSendStatus: 'Failed',
            signalSendError: errorMessage,
            brokerStatus: 'CONNECTION_FAILED',
            brokerError: initError.message,
            brokerResponse: JSON.stringify({ error: initError.message })
          });

          executionResults.push({
            userId: targetUserId,
            success: false,
            error: isSubscriptionLimit ? 'Subscription limit' : 'Connection failed',
            tradeId: failedTrade.id
          });

          // Publish to Redis
          await redisClient.publishTradeUpdate(targetUserId, failedTrade, 'create');
          emitTradeUpdate(targetUserId, failedTrade, 'create');
          
          continue;
        }
      } else if (isCCXT) {
        // CCXT EXECUTION (Delta, Binance, etc.)
        try {
          console.log(`🔌 Initializing CCXT exchange ${apiKey.exchangeId || apiKey.broker} for user ${targetUserId}`);
          
          const exchange = await exchangeService.getExchangeInstance(
            apiKey.exchangeId || apiKey.broker.toLowerCase(),
            apiKey.apiKey,
            apiKey.apiSecret,
            apiKey.passphrase,
            {
              defaultType: apiKey.accountType || 'spot'
            }
          );
          
          console.log(`✅ CCXT exchange ready for user ${targetUserId}`);
          
          // Convert signal to side (BUY -> buy, SELL -> sell)
          const side = parsedSignal === 'BUY' ? 'buy' : 'sell';
          
          // Place market order via CCXT
          const orderResult = await exchangeService.createMarketOrder(
            exchange,
            symbol.toUpperCase(),
            side,
            volume
          );
          
          if (!orderResult.success) {
            throw new Error(orderResult.error || 'CCXT order failed');
          }
          
          // Convert CCXT response to standard tradeResult format
          tradeResult = {
            success: true,
            brokerOrderId: orderResult.data.id,
            orderId: orderResult.data.id,
            volume: orderResult.data.filled || volume,
            openPrice: orderResult.data.average || orderResult.data.price || 0,
            status: orderResult.data.status === 'closed' ? 'FILLED' : 'PENDING',
            brokerResponse: orderResult.data
          };
          
          console.log(`✅ CCXT order placed: ${orderResult.data.id}`);
        } catch (ccxtError) {
          console.error(`❌ CCXT trade error for user ${targetUserId}:`, ccxtError.message);
          
          // Create failed trade record
          const failedTrade = await Trade.create({
            userId: targetUserId,
            strategyId,
            orderId: `CCXTFAIL-${Date.now()}-${targetUserId}`,
            market: strategy.segment,
            symbol: symbol.toUpperCase(),
            type: parsedSignal,
            amount: volume,
            price: 0,
            currentPrice: 0,
            pnl: 0,
            pnlPercentage: 0,
            status: 'Failed',
            date: new Date(),
            broker: apiKey.exchangeId || apiKey.broker,
            brokerType: 'CCXT',
            signalReceivedAt,
            signalPayload: {
              source: 'TradingView',
              requestIp: req.ip,
              strategyId,
              signal: parsedSignal,
              symbol: symbol.toUpperCase(),
              raw: req.body
            },
            signalSendStatus: 'Failed',
            signalSendError: 'CCXT trade execution failed',
            brokerStatus: 'EXECUTION_FAILED',
            brokerError: ccxtError.message,
            brokerResponse: JSON.stringify({ error: ccxtError.message })
          });

          executionResults.push({
            userId: targetUserId,
            success: false,
            error: 'Trade execution failed',
            tradeId: failedTrade.id
          });

          // Publish to Redis
          await redisClient.publishTradeUpdate(targetUserId, failedTrade, 'create');
          emitTradeUpdate(targetUserId, failedTrade, 'create');
          
          continue;
        }
      }

      // Process successful trade
      try {
        if (tradeResult && tradeResult.success) {
          // For MT5 only: DOUBLE CHECK: Close any remaining open trades before creating new one (Race condition safety)
          if (isMT5 && userBroker) {
            const anyOpenTrades = await Trade.findAll({
              where: {
                userId: targetUserId,
                strategyId,
                status: { [Op.in]: ['Open', 'Pending'] }
              }
            });
            
            if (anyOpenTrades.length > 0) {
              console.log(`⚠️ Found ${anyOpenTrades.length} open trade(s) - closing before creating new (race condition safety)`);
              for (const openTrade of anyOpenTrades) {
                try {
                  const closeResult = await userBroker.closeTrade(openTrade.orderId);
                  await openTrade.update({
                    status: 'Completed',
                    currentPrice: closeResult.closePrice || openTrade.price,
                    pnl: closeResult.profit || 0,
                    pnlPercentage: closeResult.profitPercent || 0,
                    brokerStatus: 'CLOSED',
                    brokerError: null,
                    brokerResponse: JSON.stringify({ status: 'CLOSED', reason: 'Auto-closed (duplicate prevention)' }),
                    brokerResponseJson: {
                      raw: closeResult,
                      reason: 'System Safety Check',
                      timestamp: new Date().toISOString()
                    }
                  });
                  emitTradeUpdate(targetUserId, openTrade, 'update');
                } catch (closeErr) {
                  console.error(`❌ Failed to close trade ${openTrade.orderId}:`, closeErr.message);
                }
              }
            }
          }
          
          // Save successful trade in Trade table
          const trade = await Trade.create({
            userId: targetUserId,
            orderId: tradeResult.brokerOrderId || tradeResult.orderId,
            market: strategy.segment,
            symbol: symbol.toUpperCase(),
            type: parsedSignal === 'BUY' ? 'Buy' : 'Sell',
            amount: tradeResult.volume || volume,
            price: tradeResult.openPrice,
            currentPrice: tradeResult.openPrice,
            status: tradeResult.status === 'FILLED' ? 'Completed' : 'Pending',
            date: new Date(),
            broker: isMT5 ? 'MT5' : (apiKey.exchangeId || apiKey.broker),
            brokerType: isMT5 ? 'MT5' : 'CCXT',
            strategyId,
            signalReceivedAt,
            signalPayload: {
              source: 'TradingView',
              requestIp: req.ip,
              strategyId,
              signal: parsedSignal,
              symbol: symbol.toUpperCase(),
              raw: req.body
            },
            signalSendStatus: 'Sent',
            signalSendError: null,
            filledQuantity: tradeResult?.volume ?? volume,
            avgFillPrice: tradeResult?.openPrice ?? null,
            brokerStatus: tradeResult?.status || 'FILLED',
            brokerError: null,
            brokerResponse: JSON.stringify({ status: tradeResult?.status || 'FILLED' }),
            brokerResponseJson: {
              ...tradeResult?.brokerResponse,
              raw: tradeResult,
              timestamp: new Date().toISOString()
            }
          });

          console.log(`✅ ${isMT5 ? 'MT5' : 'CCXT'} trade executed for user ${targetUserId}: ${trade.orderId}`);
          
          // Process admin-defined per-trade charge for subscribers
          if (!isOwner) {
            const adminCharge = await getAdminPerTradeChargeForStrategy(strategyId);
            if (adminCharge && adminCharge.amount > 0) {
              const chargeResult = await processPerTradeCharge({
                subscriberId: targetUserId,
                ownerId: userId, // strategy owner (not credited, just for logging)
                strategyId,
                tradeId: trade.id,
                chargeAmount: adminCharge.amount,
                strategyName: strategy.name
              });

              if (chargeResult.success && !chargeResult.skipped) {
                console.log(`💰 Admin per-trade charge of ${adminCharge.amount} INR processed for trade ${trade.id}`);
              } else if (!chargeResult.success) {
                console.warn(`⚠️ Per-trade charge failed for trade ${trade.id}: ${chargeResult.error}`);
              }
            }
          }
          
          // Broadcast to Redis and Socket.IO for live trade
          await redisClient.publishTradeUpdate(targetUserId, trade, 'create');
          emitTradeUpdate(targetUserId, trade, 'create');

          executionResults.push({
            userId: targetUserId,
            success: true,
            tradeId: trade.id,
            orderId: trade.orderId,
            mode: 'live'
          });
          
          // Release broker connection back to pool (MT5 only)
          if (isMT5 && userBroker && apiKey.appName) {
            mt5BrokerPool.releaseConnection(apiKey.appName);
          }
          
        } else {
          throw new Error(tradeResult?.error || 'Trade execution failed');
        }
      } catch (tradeError) {
        console.error(`❌ Trade execution failed for user ${targetUserId}:`, tradeError);
        
        // Create failed trade record
        const failedTrade = await Trade.create({
          userId: targetUserId,
          strategyId,
          orderId: `FAILED-${Date.now()}-${targetUserId}`,
          market: strategy.segment,
          symbol: symbol.toUpperCase(),
          type: parsedSignal,
          amount: volume,
          price: 0,
          currentPrice: 0,
          pnl: 0,
          pnlPercentage: 0,
          status: 'Failed',
          date: new Date(),
          broker: isMT5 ? 'MT5' : (apiKey.exchangeId || apiKey.broker),
          brokerType: isMT5 ? 'MT5' : 'CCXT',
          signalReceivedAt,
          signalPayload: {
            source: 'TradingView',
            requestIp: req.ip,
            strategyId,
            signal: parsedSignal,
            symbol: symbol.toUpperCase(),
            raw: req.body
          },
          signalSendStatus: 'Failed',
          signalSendError: tradeError.message,
          brokerStatus: 'REJECTED',
          brokerError: tradeError.message,
          brokerResponse: JSON.stringify({ error: tradeError.message })
        });

        executionResults.push({
          userId: targetUserId,
          success: false,
          error: tradeError.message,
          tradeId: failedTrade.id
        });

        // Broadcast to Redis and Socket.IO
        await redisClient.publishTradeUpdate(targetUserId, failedTrade, 'create');
        emitTradeUpdate(targetUserId, failedTrade, 'create');
        
        // Release broker connection even on error (MT5 only)
        if (isMT5 && apiKey.appName) {
          mt5BrokerPool.releaseConnection(apiKey.appName);
        }
      }
      
      } // END OF BROKER LOOP
    }

    // Return summary of all executions
    const successCount = executionResults.filter(r => r.success).length;
    const failCount = executionResults.filter(r => !r.success).length;
    const paperCount = paperTrades.length;
    const totalProcessed = executionResults.length + paperCount;

    console.log(`📊 Webhook execution summary: ${successCount} live successful, ${paperCount} paper trades, ${failCount} failed out of ${totalProcessed} total`);

    return res.status(201).json({
      success: true,
      message: `Signal processed for ${totalProcessed} users (${successCount} live, ${paperCount} paper)`,
      webhook: {
        signal: parsedSignal,
        receivedAt: signalReceivedAt.toISOString(),
        source: 'TradingView'
      },
      strategy: {
        id: strategy.id,
        name: strategy.name,
        segment: strategy.segment
      },
      execution: {
        total: totalProcessed,
        successful: successCount + paperCount,
        liveTrades: successCount,
        paperTrades: paperCount,
        failed: failCount,
        results: executionResults,
        paper: paperTrades
      }
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Webhook processing failed',
      message: 'An unexpected error occurred while processing the webhook',
      details: error.message,
      timestamp: new Date().toISOString(),
      solution: 'Check webhook payload format and try again'
    });
  }
};
