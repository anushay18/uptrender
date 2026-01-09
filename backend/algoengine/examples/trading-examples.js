/**
 * MT5 Trade Placement Examples
 * Different strategies and scenarios
 */

import { mt5Broker } from '../brokers/mt5/index.js';
import { logger } from '../utils/logger.js';
import { CalculationService } from '../brokers/mt5/services/CalculationService.js';

/**
 * Example 1: Simple Market Order
 */
export async function exampleSimpleMarketOrder() {
  logger.info('=== Example 1: Simple Market Order ===');

  const tradeResult = await mt5Broker.placeTrade({
    symbol: 'EURUSD',
    type: 'BUY',
    volume: 1.0,
    orderType: 'market',
    stopLoss: { type: 'points', value: 50 },
    takeProfit: { type: 'points', value: 100 },
  });

  logger.info(`Result: ${JSON.stringify(tradeResult, null, 2)}`);
  return tradeResult;
}

/**
 * Example 2: Limit Order with Percentage Risk Management
 */
export async function exampleLimitOrderWithRisk() {
  logger.info('=== Example 2: Limit Order with Percentage Risk Management ===');

  const tradeResult = await mt5Broker.placeTrade({
    symbol: 'GBPUSD',
    type: 'SELL',
    volume: 2.0,
    orderType: 'limit',
    entryPrice: 1.27500,
    stopLoss: { type: 'percentage', value: 1.5 },
    takeProfit: { type: 'percentage', value: 3.0 },
    comment: 'Risk Management Example',
  });

  logger.info(`Result: ${JSON.stringify(tradeResult, null, 2)}`);
  return tradeResult;
}

/**
 * Example 3: Fixed Price SL/TP
 */
export async function exampleFixedPriceOrder() {
  logger.info('=== Example 3: Fixed Price SL/TP ===');

  const tradeResult = await mt5Broker.placeTrade({
    symbol: 'USDJPY',
    type: 'BUY',
    volume: 1.5,
    orderType: 'market',
    stopLoss: { type: 'fixed_price', value: 149.500 },
    takeProfit: { type: 'fixed_price', value: 150.500 },
  });

  logger.info(`Result: ${JSON.stringify(tradeResult, null, 2)}`);
  return tradeResult;
}

/**
 * Example 4: Position Size Based on Risk
 */
export async function examplePositionSizingByRisk() {
  logger.info('=== Example 4: Position Sizing by Risk ===');

  // Get account info
  const accountInfo = await mt5Broker.getAccountInfo();
  logger.info(`Account Balance: $${accountInfo.balance}`);

  // Get current price
  const price = await mt5Broker.getPrice('EURUSD');
  const entryPrice = price.ask;
  const slPrice = entryPrice - 0.0050; // 50 points

  // Calculate position size for 2% risk
  const positionSize = CalculationService.calculatePositionSize(
    accountInfo.balance,
    2, // 2% risk
    entryPrice,
    slPrice
  );

  logger.info(`Calculated position size: ${positionSize} lots for 2% risk`);

  const tradeResult = await mt5Broker.placeTrade({
    symbol: 'EURUSD',
    type: 'BUY',
    volume: positionSize,
    orderType: 'market',
    stopLoss: { type: 'fixed_price', value: slPrice },
    takeProfit: { type: 'points', value: 100 },
  });

  logger.info(`Result: ${JSON.stringify(tradeResult, null, 2)}`);
  return tradeResult;
}

/**
 * Example 5: Batch Trading (Multiple Orders)
 */
export async function exampleBatchTrades() {
  logger.info('=== Example 5: Batch Trading ===');

  const trades = [
    {
      symbol: 'EURUSD',
      type: 'BUY',
      volume: 1.0,
      orderType: 'market',
      stopLoss: { type: 'points', value: 50 },
      takeProfit: { type: 'points', value: 100 },
      comment: 'Batch Trade 1',
    },
    {
      symbol: 'GBPUSD',
      type: 'BUY',
      volume: 1.5,
      orderType: 'market',
      stopLoss: { type: 'points', value: 50 },
      takeProfit: { type: 'points', value: 100 },
      comment: 'Batch Trade 2',
    },
    {
      symbol: 'USDJPY',
      type: 'SELL',
      volume: 2.0,
      orderType: 'market',
      stopLoss: { type: 'points', value: 50 },
      takeProfit: { type: 'points', value: 100 },
      comment: 'Batch Trade 3',
    },
  ];

  const results = await mt5Broker.placeBatchTrades(trades);

  logger.info(`Batch Results:`);
  results.forEach((result, idx) => {
    logger.info(`Trade ${idx + 1}: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
  });

  return results;
}

/**
 * Example 6: Trade Management (Modify and Close)
 */
export async function exampleTradeManagement() {
  logger.info('=== Example 6: Trade Management ===');

  // Place initial trade
  const tradeResult = await mt5Broker.placeTrade({
    symbol: 'EURUSD',
    type: 'BUY',
    volume: 1.0,
    orderType: 'market',
    stopLoss: { type: 'points', value: 50 },
    takeProfit: { type: 'points', value: 100 },
  });

  if (!tradeResult.success) {
    logger.error('Failed to place trade');
    return;
  }

  logger.info(`Trade placed: ${tradeResult.orderId}`);

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Modify SL/TP
  const modifyResult = await mt5Broker.modifyTrade(tradeResult.orderId, {
    stopLoss: 1.19500,
    takeProfit: 1.20800,
  });

  logger.info(`Modification result: ${JSON.stringify(modifyResult, null, 2)}`);

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Close trade
  const closeResult = await mt5Broker.closeTrade(tradeResult.orderId);
  logger.info(`Close result: ${JSON.stringify(closeResult, null, 2)}`);
}

/**
 * Example 7: Real-time Price Monitoring
 */
export async function examplePriceMonitoring() {
  logger.info('=== Example 7: Real-time Price Monitoring ===');

  let priceUpdates = 0;

  const subscriptionId = mt5Broker.subscribeToPrices('EURUSD', (priceData) => {
    priceUpdates++;
    logger.info(`Price Update #${priceUpdates}: Bid: ${priceData.bid.toFixed(5)}, Ask: ${priceData.ask.toFixed(5)}, Spread: ${priceData.spread.toFixed(5)}`);

    // Stop after 10 updates
    if (priceUpdates >= 10) {
      mt5Broker.unsubscribeFromPrices(subscriptionId);
    }
  });

  // Wait for updates
  await new Promise((resolve) => setTimeout(resolve, 15000));
}

/**
 * Example 8: Technical Analysis with Candle Data
 */
export async function exampleTechnicalAnalysis() {
  logger.info('=== Example 8: Technical Analysis ===');

  // Get candle data
  const candles = await mt5Broker.getCandles('EURUSD', 'H1', 100);
  logger.info(`Retrieved ${candles.length} candles`);

  // Get closes for analysis
  const closes = candles.map((c) => c.close);

  // Calculate SMA (20 period)
  const smaValues = CalculationService.calculateSMA(closes, 20);
  const lastSMA = smaValues[smaValues.length - 1];
  logger.info(`SMA(20): ${lastSMA.toFixed(5)}`);

  // Calculate EMA (12 period)
  const emaValues = CalculationService.calculateEMA(closes, 12);
  const lastEMA = emaValues[emaValues.length - 1];
  logger.info(`EMA(12): ${lastEMA.toFixed(5)}`);

  // Calculate RSI (14 period)
  const rsiValues = CalculationService.calculateRSI(closes, 14);
  const lastRSI = rsiValues[rsiValues.length - 1];
  logger.info(`RSI(14): ${lastRSI.toFixed(2)}`);

  // Place trade based on signal
  if (lastRSI < 30) {
    logger.info('⚠ RSI < 30: Oversold - Consider BUY signal');
  } else if (lastRSI > 70) {
    logger.info('⚠ RSI > 70: Overbought - Consider SELL signal');
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    logger.info('Starting MT5 Trading Examples\n');

    // Initialize
    await mt5Broker.initialize({
      apiKey: process.env.METAAPI_KEY,
      accountId: process.env.METAAPI_ACCOUNT_ID,
    });

    // Run examples
    await exampleSimpleMarketOrder();
    logger.info('\n');

    await exampleLimitOrderWithRisk();
    logger.info('\n');

    await exampleFixedPriceOrder();
    logger.info('\n');

    await examplePositionSizingByRisk();
    logger.info('\n');

    // Note: Only run batch if you want multiple trades
    // await exampleBatchTrades();
    // logger.info('\n');

    await exampleTradeManagement();
    logger.info('\n');

    await examplePriceMonitoring();
    logger.info('\n');

    await exampleTechnicalAnalysis();
    logger.info('\n');

    // Disconnect
    await mt5Broker.disconnect();

    logger.info('✓ All examples completed');
  } catch (error) {
    logger.error(`Example error: ${error.message}`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
