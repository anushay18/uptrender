/**
 * Parent-Child Trade Execution Controller
 * 
 * Implements the "General and Lieutenants" architecture:
 * - Parent Trade: The signal/strategy decision (BUY/SELL)
 * - Child Trades: Individual broker executions
 * 
 * Each child trade:
 * - Uses its broker's own tick data
 * - Has its own SL/TP tracking
 * - Calculates MTM from its broker's prices
 */

import { Trade, Strategy, User, StrategySubscription, StrategyBroker, ApiKey } from '../models/index.js';
import { mt5Broker } from '../../algoengine/index.js';
import { emitTradeUpdate } from '../config/socket.js';
import { paperTradingService } from '../services/PaperTradingService.js';
import centralizedStreamingService from '../services/CentralizedStreamingService.js';
import positionAggregationService from '../services/PositionAggregationService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper: Get price from centralized streaming ONLY
 * 
 * Architecture:
 * - ALL price data comes from admin-configured CentralizedStreamingService
 * - User brokers are ONLY for trade execution, NOT for data streaming
 * - Supports MetaAPI or Deriv (configured by admin)
 */
const getPrice = (apiKeyId, symbol, segment) => {
  // ALL segments use centralized streaming
  const centralPrice = centralizedStreamingService.getPrice(symbol?.toUpperCase());
  if (centralPrice) return centralPrice;
  
  return null;
};

/**
 * Execute a parent-child trade from webhook
 * Creates one parent (signal) trade and multiple child (execution) trades
 */
export const executeParentChildTrade = async (req, res) => {
  const signalReceivedAt = new Date();
  const parentOrderId = `PARENT-${Date.now()}-${uuidv4().substring(0, 8)}`;
  
  try {
    const { secret, signal, symbol: customSymbol } = req.body;

    // Validate and find strategy
    if (!secret) {
      return res.status(401).json({ 
        success: false, 
        error: 'Strategy webhook secret required'
      });
    }

    const strategy = await Strategy.findOne({
      where: { webhookSecret: secret },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });

    if (!strategy) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid webhook secret'
      });
    }

    // Parse signal
    const parsedSignal = parseSignal(signal);
    if (!parsedSignal.valid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid signal',
        message: parsedSignal.error
      });
    }

    const symbol = customSymbol || strategy.symbol;
    if (!symbol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Trading symbol required'
      });
    }

    console.log(`📡 Parent-Child Trade Signal: ${parsedSignal.type} ${symbol} for Strategy: ${strategy.name}`);

    // Get all active subscribers
    const subscriptions = await StrategySubscription.findAll({
      where: { strategyId: strategy.id, isActive: true, isPaused: false },
      include: [{ model: User, as: 'subscriber', attributes: ['id', 'name', 'email'] }]
    });

    // Include strategy owner if not a subscriber
    const subscriberIds = subscriptions.map(s => s.userId);
    if (!subscriberIds.includes(strategy.userId)) {
      subscriptions.push({
        userId: strategy.userId,
        strategyId: strategy.id,
        lots: strategy.lots || 1,
        tradeMode: strategy.tradeMode || 'paper',
        subscriber: strategy.user,
        isOwner: true
      });
    }

    if (subscriptions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No active subscribers for this strategy'
      });
    }

    // Parse risk settings from strategy
    const marketRisk = strategy.marketRisk || {};
    const riskSettings = {
      stopLossType: marketRisk.stopLossType || 'points',
      stopLossValue: marketRisk.stopLossValue || 50,
      takeProfitType: marketRisk.takeProfitType || 'points',
      takeProfitValue: marketRisk.takeProfitValue || 100
    };

    // Create PARENT trade (signal record)
    const parentTrade = await Trade.create({
      userId: strategy.userId,
      orderId: parentOrderId,
      market: strategy.segment,
      symbol: symbol.toUpperCase(),
      type: parsedSignal.type === 'BUY' ? 'Buy' : 'Sell',
      amount: 0, // Parent has no quantity, children have individual quantities
      price: 0,  // Will be updated with weighted avg from children
      currentPrice: 0,
      status: 'Pending',
      date: new Date(),
      broker: 'SIGNAL',
      brokerType: 'Parent Signal',
      strategyId: strategy.id,
      isParent: true,
      parentTradeId: null,
      signalReceivedAt,
      signalPayload: {
        source: 'TradingView Webhook',
        signal: parsedSignal.type,
        rawSignal: signal,
        symbol,
        requestIp: req.ip,
        subscriberCount: subscriptions.length
      },
      signalSendStatus: 'Pending'
    });

    console.log(`✅ Parent trade created: ${parentOrderId}`);

    // Track execution results
    const executionResults = {
      parentTradeId: parentTrade.id,
      parentOrderId,
      children: [],
      errors: [],
      summary: {
        totalSubscribers: subscriptions.length,
        successCount: 0,
        failCount: 0,
        paperCount: 0,
        liveCount: 0
      }
    };

    // Execute for each subscriber
    for (const subscription of subscriptions) {
      const userId = subscription.userId;
      const userEmail = subscription.subscriber?.email || 'Unknown';
      const lots = subscription.lots || strategy.lots || 0.01;
      const tradeMode = subscription.tradeMode || 'paper';
      const isPaperMode = tradeMode === 'paper';

      console.log(`🔄 Processing subscriber: ${userEmail} (mode: ${tradeMode}, lots: ${lots})`);

      try {
        if (isPaperMode) {
          // PAPER MODE execution
          const result = await executePaperTrade(
            userId,
            parentTrade,
            symbol,
            parsedSignal.type,
            lots,
            strategy,
            riskSettings
          );

          if (result.success) {
            executionResults.children.push(result.childTrade);
            executionResults.summary.successCount++;
            executionResults.summary.paperCount++;
          } else {
            executionResults.errors.push({ userId, userEmail, error: result.error, mode: 'paper' });
            executionResults.summary.failCount++;
          }
        } else {
          // LIVE MODE - Get user's selected brokers for this strategy
          const brokerResults = await executeLiveTrades(
            userId,
            parentTrade,
            symbol,
            parsedSignal.type,
            lots,
            strategy,
            riskSettings
          );

          for (const result of brokerResults) {
            if (result.success) {
              executionResults.children.push(result.childTrade);
              executionResults.summary.successCount++;
              executionResults.summary.liveCount++;
            } else {
              executionResults.errors.push({ 
                userId, 
                userEmail, 
                brokerId: result.apiKeyId,
                error: result.error, 
                mode: 'live' 
              });
              executionResults.summary.failCount++;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Execution failed for ${userEmail}:`, error.message);
        executionResults.errors.push({ userId, userEmail, error: error.message });
        executionResults.summary.failCount++;
      }
    }

    // Update parent trade with aggregated info
    await updateParentTradeFromChildren(parentTrade.id);

    // Emit update for parent trade
    emitTradeUpdate(strategy.userId, parentTrade, 'create');

    // Response
    return res.json({
      success: true,
      message: `Trade signal processed: ${executionResults.summary.successCount}/${executionResults.summary.totalSubscribers} executions successful`,
      data: {
        parentTradeId: parentTrade.id,
        parentOrderId,
        signal: parsedSignal.type,
        symbol,
        strategy: { id: strategy.id, name: strategy.name },
        executions: executionResults.summary,
        children: executionResults.children.map(c => ({
          tradeId: c.id,
          orderId: c.orderId,
          broker: c.broker,
          volume: c.amount,
          price: c.price,
          mode: c.brokerType
        })),
        errors: executionResults.errors
      }
    });

  } catch (error) {
    console.error('❌ Parent-Child execution error:', error);
    return res.status(500).json({
      success: false,
      error: 'Trade execution failed',
      message: error.message
    });
  }
};

/**
 * Execute paper trade (child)
 */
async function executePaperTrade(userId, parentTrade, symbol, signalType, lots, strategy, riskSettings) {
  try {
    // Get current price from centralized streaming (MetaAPI or Deriv)
    let currentPrice = null;
    
    try {
      // ALL price data from centralized streaming (admin-configured)
      const centralPrice = centralizedStreamingService.getPrice(symbol.toUpperCase());
      if (centralPrice?.bid) {
        currentPrice = signalType === 'BUY' ? centralPrice.ask : centralPrice.bid;
        console.log(`📊 Paper trade using centralized price for ${symbol}: ${currentPrice}`);
      }
    } catch (err) {
      console.warn(`⚠️ Could not fetch price for paper trade: ${err.message}`);
    }

    // If still no price, use strategy's symbolValue or reject
    if (!currentPrice) {
      currentPrice = strategy.symbolValue;
      if (!currentPrice || currentPrice <= 0) {
        return { 
          success: false, 
          error: `No price available for ${symbol}. Ensure centralized streaming is running.` 
        };
      }
      console.warn(`⚠️ Using strategy symbolValue as fallback: ${currentPrice}`);
    }

    // Calculate SL/TP
    const { stopLoss, takeProfit } = calculateSlTp(currentPrice, signalType, riskSettings);

    // Create paper position
    const paperResult = await paperTradingService.openPosition({
      userId,
      strategyId: strategy.id,
      symbol: symbol.toUpperCase(),
      market: strategy.segment,
      type: signalType === 'BUY' ? 'Buy' : 'Sell',
      volume: lots,
      openPrice: currentPrice,
      stopLoss,
      takeProfit
    });

    if (!paperResult.success) {
      return { success: false, error: paperResult.error };
    }

    // Create child trade record
    const childOrderId = `PAPER-${Date.now()}-${uuidv4().substring(0, 8)}`;
    
    const childTrade = await Trade.create({
      userId,
      orderId: childOrderId,
      market: strategy.segment,
      symbol: symbol.toUpperCase(),
      type: signalType === 'BUY' ? 'Buy' : 'Sell',
      amount: lots,
      price: currentPrice,
      currentPrice,
      status: 'Open',
      date: new Date(),
      broker: 'PAPER',
      brokerType: 'Paper Trading',
      strategyId: strategy.id,
      isParent: false,
      parentTradeId: parentTrade.id,
      apiKeyId: null,
      stopLoss,
      takeProfit,
      brokerLastPrice: currentPrice,
      lastPriceUpdate: new Date(),
      signalReceivedAt: parentTrade.signalReceivedAt,
      signalSendStatus: 'Paper',
      brokerResponseJson: {
        mode: 'paper',
        paperPositionId: paperResult.position?.id
      }
    });

    // Emit real-time update
    emitTradeUpdate(userId, childTrade, 'create');

    return { 
      success: true, 
      childTrade,
      orderId: childOrderId
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute live trades on all selected brokers for a user
 */
async function executeLiveTrades(userId, parentTrade, symbol, signalType, lots, strategy, riskSettings) {
  const results = [];

  // Get user's selected brokers for this strategy
  const selectedBrokers = await StrategyBroker.findAll({
    where: { strategyId: strategy.id, isActive: true },
    include: [{
      model: ApiKey,
      as: 'apiKey',
      where: { userId, status: 'Active' },
      required: true
    }]
  });

  let apiKeysToUse = selectedBrokers.map(sb => sb.apiKey);

  // Fallback to default broker if none selected
  if (apiKeysToUse.length === 0) {
    const defaultApiKey = await ApiKey.findOne({
      where: { 
        userId,
        segment: strategy.segment,
        status: 'Active',
        isDefault: true
      }
    });
    
    if (defaultApiKey) {
      apiKeysToUse = [defaultApiKey];
    } else {
      // Try any active API key for this segment
      const anyApiKey = await ApiKey.findOne({
        where: { userId, segment: strategy.segment, status: 'Active' }
      });
      if (anyApiKey) {
        apiKeysToUse = [anyApiKey];
      }
    }
  }

  if (apiKeysToUse.length === 0) {
    return [{ 
      success: false, 
      error: 'No valid broker credentials for live trading',
      apiKeyId: null 
    }];
  }

  // Execute on each broker
  for (const apiKey of apiKeysToUse) {
    const result = await executeSingleBrokerTrade(
      userId,
      parentTrade,
      apiKey,
      symbol,
      signalType,
      lots,
      strategy,
      riskSettings
    );
    results.push(result);
  }

  return results;
}

/**
 * Execute trade on a single broker
 */
async function executeSingleBrokerTrade(userId, parentTrade, apiKey, symbol, signalType, lots, strategy, riskSettings) {
  const childOrderId = `${apiKey.broker}-${Date.now()}-${uuidv4().substring(0, 8)}`;

  try {
    // Get price - uses centralized streaming for Forex, CCXT for Crypto
    let currentPrice = 0;
    
    // Try to get price from broker tick stream or centralized streaming
    const tickPrice = getPrice(apiKey.id, symbol, apiKey.segment);
    if (tickPrice) {
      currentPrice = signalType === 'BUY' ? tickPrice.ask : tickPrice.bid;
    }

    // For MT5 trades, also try centralized streaming as primary source
    if (!currentPrice && (apiKey.broker === 'MT5' || apiKey.segment === 'Forex')) {
      const centralPrice = centralizedStreamingService.getPrice(symbol.toUpperCase());
      if (centralPrice?.bid) {
        currentPrice = signalType === 'BUY' ? centralPrice.ask : centralPrice.bid;
        console.log(`📊 Using centralized streaming price for ${symbol}: ${currentPrice}`);
      }
    }

    // Last resort: Direct broker API connection (may hit rate limits)
    if (!currentPrice) {
      if (apiKey.broker === 'MT5' && apiKey.accessToken && apiKey.appName) {
        try {
          console.log(`⚠️ Falling back to direct MT5 connection for price (${symbol})`);
          await mt5Broker.initialize({
            apiKey: apiKey.accessToken,
            accountId: apiKey.appName
          });
          const priceData = await mt5Broker.getPrice(symbol.toUpperCase());
          if (priceData?.bid) {
            currentPrice = signalType === 'BUY' ? priceData.ask : priceData.bid;
          }
        } catch (err) {
          console.warn(`⚠️ MT5 price fetch failed: ${err.message}`);
        }
      }
    }

    if (!currentPrice) {
      return { 
        success: false, 
        error: 'Could not fetch broker price',
        apiKeyId: apiKey.id 
      };
    }

    // Execute trade on broker FIRST to get actual fill price
    let tradeResult;
    
    if (apiKey.broker === 'MT5') {
      tradeResult = await mt5Broker.placeTrade({
        symbol: symbol.toUpperCase(),
        type: signalType,
        volume: lots,
        stopLoss: { type: riskSettings.stopLossType, value: riskSettings.stopLossValue },
        takeProfit: { type: riskSettings.takeProfitType, value: riskSettings.takeProfitValue },
        comment: `Strategy: ${strategy.name}`
      });
    } else if (apiKey.segment === 'Crypto' && apiKey.exchangeId) {
      // CCXT-based execution (REST API for order placement only)
      const { getExchangeInstance, placeOrder } = await import('../services/exchangeService.js');
      const exchange = await getExchangeInstance(
        apiKey.exchangeId,
        apiKey.apiKey,
        apiKey.apiSecret,
        apiKey.passphrase,
        { defaultType: apiKey.accountType || 'spot' }
      );
      
      tradeResult = await placeOrder(
        exchange,
        symbol,
        signalType.toLowerCase(),
        'market',
        lots
      );
    } else {
      return { 
        success: false, 
        error: `Unsupported broker type: ${apiKey.broker}`,
        apiKeyId: apiKey.id 
      };
    }

    // Use ACTUAL broker fill price for SL/TP calculation (not estimated price)
    const actualFillPrice = tradeResult.openPrice || tradeResult.avgFillPrice || currentPrice;
    const filledQty = tradeResult.filledQuantity || tradeResult.volume || lots;
    const requestedQty = lots;
    
    // Determine status based on fill
    let tradeStatus = 'Open';
    if (tradeResult.status === 'FILLED' || filledQty >= requestedQty) {
      tradeStatus = 'Completed';
    } else if (filledQty > 0 && filledQty < requestedQty) {
      tradeStatus = 'Partial'; // Partially filled
    } else if (tradeResult.status === 'PENDING') {
      tradeStatus = 'Pending';
    }
    
    // Calculate broker-specific SL/TP based on RISK (Points or %)
    // This ensures each broker user risks the same % regardless of fill price differences
    const { stopLoss, takeProfit } = calculateSlTp(actualFillPrice, signalType, riskSettings);
    
    console.log(`📊 Broker ${apiKey.broker}: Fill=${actualFillPrice}, Qty=${filledQty}/${requestedQty} (${tradeStatus}), SL=${stopLoss}, TP=${takeProfit}`);

    // Create child trade record
    const childTrade = await Trade.create({
      userId,
      orderId: tradeResult.brokerOrderId || childOrderId,
      market: strategy.segment,
      symbol: symbol.toUpperCase(),
      type: signalType === 'BUY' ? 'Buy' : 'Sell',
      amount: requestedQty, // Requested quantity
      price: actualFillPrice,
      currentPrice: actualFillPrice,
      status: tradeStatus, // 'Completed', 'Partial', 'Pending', or 'Open'
      date: new Date(),
      broker: apiKey.broker,
      brokerType: apiKey.broker,
      strategyId: strategy.id,
      isParent: false,
      parentTradeId: parentTrade.id,
      apiKeyId: apiKey.id,
      stopLoss,
      takeProfit,
      brokerBid: tickPrice?.bid || actualFillPrice,
      brokerAsk: tickPrice?.ask || actualFillPrice,
      brokerLastPrice: actualFillPrice,
      lastPriceUpdate: new Date(),
      signalReceivedAt: parentTrade.signalReceivedAt,
      signalSendStatus: 'Sent',
      filledQuantity: filledQty, // Actual filled quantity
      avgFillPrice: actualFillPrice, // Average fill price
      brokerStatus: tradeResult.status || 'UNKNOWN',
      brokerResponseJson: {
        ...tradeResult,
        broker: apiKey.broker,
        apiKeyId: apiKey.id,
        executionTime: tradeResult.executionTime,
        timestamp: new Date().toISOString(),
        partialFill: filledQty < requestedQty,
        fillRate: ((filledQty / requestedQty) * 100).toFixed(2) + '%'
      }
    });

    // Emit real-time update
    emitTradeUpdate(userId, childTrade, 'create');

    // Note: Broker streaming removed - using centralized streaming for price data
    // Individual broker streams are no longer needed

    return { 
      success: true, 
      childTrade,
      apiKeyId: apiKey.id,
      orderId: childTrade.orderId
    };

  } catch (error) {
    console.error(`❌ Broker execution failed for ${apiKey.broker}:`, error.message);
    return { 
      success: false, 
      error: error.message,
      apiKeyId: apiKey.id 
    };
  }
}

/**
 * Update parent trade with aggregated data from children
 */
async function updateParentTradeFromChildren(parentTradeId) {
  const children = await Trade.findAll({
    where: { parentTradeId, isParent: false }
  });

  if (children.length === 0) return;

  let totalQuantity = 0;
  let totalValue = 0;
  let successCount = 0;
  let failCount = 0;

  for (const child of children) {
    const qty = parseFloat(child.amount) || 0;
    const price = parseFloat(child.price) || 0;
    
    totalQuantity += qty;
    totalValue += qty * price;
    
    if (['Completed', 'Open'].includes(child.status)) {
      successCount++;
    } else if (child.status === 'Failed') {
      failCount++;
    }
  }

  const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  await Trade.update({
    amount: totalQuantity,
    price: avgPrice,
    currentPrice: avgPrice,
    status: successCount > 0 ? 'Open' : 'Failed',
    signalSendStatus: successCount > 0 ? 'Sent' : 'Failed',
    brokerResponseJson: {
      childCount: children.length,
      successCount,
      failCount,
      totalQuantity,
      avgPrice
    }
  }, {
    where: { id: parentTradeId }
  });
}

/**
 * Calculate SL/TP prices
 */
function calculateSlTp(entryPrice, signalType, riskSettings) {
  const { stopLossType, stopLossValue, takeProfitType, takeProfitValue } = riskSettings;
  
  let stopLoss, takeProfit;

  if (stopLossType === 'percentage') {
    const slOffset = entryPrice * (stopLossValue / 100);
    stopLoss = signalType === 'BUY' ? entryPrice - slOffset : entryPrice + slOffset;
  } else {
    // Points/pips
    stopLoss = signalType === 'BUY' ? entryPrice - stopLossValue : entryPrice + stopLossValue;
  }

  if (takeProfitType === 'percentage') {
    const tpOffset = entryPrice * (takeProfitValue / 100);
    takeProfit = signalType === 'BUY' ? entryPrice + tpOffset : entryPrice - tpOffset;
  } else {
    takeProfit = signalType === 'BUY' ? entryPrice + takeProfitValue : entryPrice - takeProfitValue;
  }

  return { stopLoss, takeProfit };
}

/**
 * Parse signal from webhook
 */
function parseSignal(signal) {
  if (signal === 0 || signal === '0') {
    return { valid: true, type: 'CLOSE', isClose: true };
  }

  if (typeof signal === 'number') {
    return { valid: true, type: signal > 0 ? 'BUY' : 'SELL', isClose: false };
  }

  if (typeof signal === 'string') {
    const upper = signal.toUpperCase();
    if (['BUY', 'SELL'].includes(upper)) {
      return { valid: true, type: upper, isClose: false };
    }
    
    const num = parseFloat(signal);
    if (!isNaN(num)) {
      if (num === 0) return { valid: true, type: 'CLOSE', isClose: true };
      return { valid: true, type: num > 0 ? 'BUY' : 'SELL', isClose: false };
    }
  }

  return { 
    valid: false, 
    error: 'Signal must be: BUY, SELL, positive number (buy), negative number (sell), or 0 (close)'
  };
}

export default { executeParentChildTrade };
