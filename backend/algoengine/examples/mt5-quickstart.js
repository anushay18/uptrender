/**
 * AlgoEngine MT5 - Quick Start Example
 * Demonstrates how to use the MT5 broker module
 * 
 * Usage: node examples/mt5-quickstart.js
 */

import { mt5Broker } from '../brokers/mt5/index.js';
import { logger } from '../utils/logger.js';

async function main() {
  try {
    logger.info('=== MT5 AlgoEngine Quick Start ===\n');

    // Step 1: Initialize broker connection
    logger.info('[STEP 1] Initializing MT5 connection...');
    await mt5Broker.initialize({
      apiKey: process.env.METAAPI_KEY,
      accountId: process.env.METAAPI_ACCOUNT_ID,
    });

    // Step 2: Get account information
    logger.info('[STEP 2] Getting account information...');
    const accountInfo = await mt5Broker.getAccountInfo();
    logger.info(`Account Info: ${JSON.stringify(accountInfo, null, 2)}`);

    // Step 3: Get current price
    logger.info('[STEP 3] Getting current price for EURUSD...');
    const price = await mt5Broker.getPrice('EURUSD');
    logger.info(`EURUSD Price: ${JSON.stringify(price, null, 2)}`);

    // Step 4: Get candle data
    logger.info('[STEP 4] Getting H1 candle data...');
    const candles = await mt5Broker.getCandles('EURUSD', 'H1', 10);
    logger.info(`Last candle: Open: ${candles[candles.length - 1].open}, Close: ${candles[candles.length - 1].close}`);

    // Step 5: Subscribe to price updates
    logger.info('[STEP 5] Subscribing to real-time price updates...');
    const subscriptionId = mt5Broker.subscribeToPrices('EURUSD', (priceData) => {
      logger.info(`✓ Price Update: ${priceData.symbol} Bid: ${priceData.bid} Ask: ${priceData.ask}`);
    });

    // Wait for a few price updates
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 6: Place a trade (DEMO ONLY - adjust parameters as needed)
    logger.info('[STEP 6] Placing a demo trade...');
    const tradeResult = await mt5Broker.placeTrade({
      symbol: 'EURUSD',
      type: 'BUY',
      volume: 0.1,
      orderType: 'market',
      stopLoss: { type: 'points', value: 50 },
      takeProfit: { type: 'points', value: 100 },
      comment: 'Demo Trade',
    });

    if (tradeResult.success) {
      logger.info(`✓ Trade placed: ${JSON.stringify(tradeResult, null, 2)}`);

      // Step 7: Get open orders
      logger.info('[STEP 7] Getting open orders...');
      const orders = await mt5Broker.getOpenOrders();
      logger.info(`Open Orders: ${JSON.stringify(orders, null, 2)}`);

      // Step 8: Modify trade (change SL/TP)
      logger.info('[STEP 8] Modifying trade SL/TP...');
      const modifyResult = await mt5Broker.modifyTrade(tradeResult.orderId, {
        stopLoss: 1.19500,
        takeProfit: 1.20800,
      });
      logger.info(`Modification result: ${JSON.stringify(modifyResult, null, 2)}`);

      // Step 9: Close trade
      logger.info('[STEP 9] Closing trade...');
      const closeResult = await mt5Broker.closeTrade(tradeResult.orderId);
      logger.info(`Close result: ${JSON.stringify(closeResult, null, 2)}`);
    } else {
      logger.warn(`Trade placement failed: ${tradeResult.error}`);
    }

    // Step 10: Get trade history
    logger.info('[STEP 10] Getting trade history...');
    const history = await mt5Broker.getTradeHistory({ limit: 5 });
    logger.info(`Trade History: ${JSON.stringify(history, null, 2)}`);

    // Unsubscribe
    mt5Broker.unsubscribeFromPrices(subscriptionId);

    // Step 11: Broker status
    logger.info('[STEP 11] Broker status:');
    logger.info(`Status: ${JSON.stringify(mt5Broker.getStatus(), null, 2)}`);

    // Disconnect
    logger.info('\n[FINAL] Disconnecting...');
    await mt5Broker.disconnect();

    logger.info('✓ Example completed successfully!\n');
  } catch (error) {
    logger.error(`Example failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run
main();
