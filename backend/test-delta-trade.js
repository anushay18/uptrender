import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { encrypt, decrypt } from './src/utils/encryption.js';

dotenv.config();

/**
 * Test Delta Exchange BTC Trade for Bhavin
 * IMPORTANT: This uses REAL MONEY - Use with caution!
 */
async function testDeltaTrade() {
  console.log('\n🚀 Delta Exchange BTC Trade Test\n');
  console.log('⚠️  WARNING: This will place a REAL order if credentials are valid!\n');

  // ===== REPLACE WITH BHAVIN'S ACTUAL DELTA CREDENTIALS =====
  const API_KEY = 'YOUR_DELTA_API_KEY';
  const API_SECRET = 'YOUR_DELTA_API_SECRET';
  // ===========================================================

  // Trade parameters (ADJUST AS NEEDED)
  const TRADE_CONFIG = {
    symbol: 'BTC/USDT',        // Trading pair
    side: 'buy',               // 'buy' or 'sell'
    type: 'limit',             // 'market' or 'limit'
    amount: 0.001,             // BTC amount (very small for testing)
    price: null,               // For limit orders (null for market orders)
    testMode: true,            // Set to false to place real order
  };

  if (API_KEY === 'YOUR_DELTA_API_KEY') {
    console.log('❌ Please update the script with actual Delta Exchange credentials\n');
    console.log('Edit: backend/test-delta-trade.js');
    console.log('Lines 15-16: Add your Delta API Key and Secret\n');
    console.log('Also review TRADE_CONFIG (lines 19-25) before running!\n');
    return;
  }

  try {
    // Step 1: Create Delta Exchange instance
    console.log('📡 Connecting to Delta Exchange...');
    const delta = new ccxt.delta({
      apiKey: API_KEY,
      secret: API_SECRET,
      enableRateLimit: true,
      options: {
        defaultType: 'future', // Delta is primarily derivatives
      },
    });

    console.log('✅ Connected to Delta Exchange');

    // Step 2: Load markets
    console.log('\n📊 Loading markets...');
    await delta.loadMarkets();
    console.log(`✅ ${Object.keys(delta.markets).length} markets loaded`);

    // Step 3: Check if symbol exists
    if (!delta.markets[TRADE_CONFIG.symbol]) {
      console.log(`\n❌ Symbol ${TRADE_CONFIG.symbol} not found!`);
      console.log('\n📋 Available BTC markets on Delta:');
      const btcMarkets = Object.keys(delta.markets).filter(s => s.includes('BTC')).slice(0, 10);
      btcMarkets.forEach(market => {
        console.log(`   - ${market}`);
      });
      return;
    }

    const market = delta.markets[TRADE_CONFIG.symbol];
    console.log(`\n📈 Market Info: ${TRADE_CONFIG.symbol}`);
    console.log(`   Type: ${market.type}`);
    console.log(`   Active: ${market.active}`);
    console.log(`   Limits: Min ${market.limits.amount?.min || 'N/A'}, Max ${market.limits.amount?.max || 'N/A'}`);

    // Step 4: Get current balance
    console.log('\n💰 Fetching account balance...');
    const balance = await delta.fetchBalance();
    console.log('✅ Balance fetched');
    
    const currencies = Object.keys(balance.total).filter(curr => balance.total[curr] > 0);
    if (currencies.length > 0) {
      console.log('\n📊 Available Balances:');
      currencies.forEach(curr => {
        console.log(`   ${curr}: ${balance.total[curr]} (Free: ${balance.free[curr]})`);
      });
    } else {
      console.log('⚠️  No balance found - account might be empty');
    }

    // Step 5: Get current price
    console.log(`\n💹 Fetching current price for ${TRADE_CONFIG.symbol}...`);
    const ticker = await delta.fetchTicker(TRADE_CONFIG.symbol);
    const currentPrice = ticker.last;
    console.log(`✅ Current Price: $${currentPrice}`);
    console.log(`   Bid: $${ticker.bid} | Ask: $${ticker.ask}`);
    console.log(`   24h Change: ${ticker.percentage?.toFixed(2)}%`);

    // Step 6: Calculate order details
    const orderPrice = TRADE_CONFIG.type === 'limit' 
      ? (TRADE_CONFIG.price || currentPrice * 0.99) // 1% below market for limit buy
      : currentPrice;

    const orderValue = TRADE_CONFIG.amount * orderPrice;

    console.log('\n📝 Order Details:');
    console.log(`   Symbol: ${TRADE_CONFIG.symbol}`);
    console.log(`   Side: ${TRADE_CONFIG.side.toUpperCase()}`);
    console.log(`   Type: ${TRADE_CONFIG.type.toUpperCase()}`);
    console.log(`   Amount: ${TRADE_CONFIG.amount} BTC`);
    console.log(`   Price: $${orderPrice.toFixed(2)}`);
    console.log(`   Total Value: $${orderValue.toFixed(2)}`);

    // Step 7: Validate balance for buy order
    if (TRADE_CONFIG.side === 'buy') {
      const requiredUSDT = orderValue;
      const availableUSDT = balance.free['USDT'] || 0;
      
      if (availableUSDT < requiredUSDT) {
        console.log(`\n⚠️  Insufficient balance!`);
        console.log(`   Required: ${requiredUSDT.toFixed(2)} USDT`);
        console.log(`   Available: ${availableUSDT.toFixed(2)} USDT`);
        console.log('\n   Please fund your account or reduce the order amount.');
        return;
      }
      console.log(`\n✅ Balance check passed (${availableUSDT.toFixed(2)} USDT available)`);
    }

    // Step 8: Place order (or test mode)
    if (TRADE_CONFIG.testMode) {
      console.log('\n🧪 TEST MODE - Order NOT placed');
      console.log('✅ Validation completed successfully');
      console.log('\n📋 To place real order:');
      console.log('   1. Set testMode: false in TRADE_CONFIG');
      console.log('   2. Re-run the script');
      console.log('\n⚠️  Make sure you review all parameters before trading with real money!');
    } else {
      console.log('\n⚠️  PLACING REAL ORDER...');
      console.log('Press Ctrl+C within 5 seconds to cancel...');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      let order;
      if (TRADE_CONFIG.type === 'market') {
        console.log('📤 Placing market order...');
        order = await delta.createMarketOrder(
          TRADE_CONFIG.symbol,
          TRADE_CONFIG.side,
          TRADE_CONFIG.amount
        );
      } else {
        console.log('📤 Placing limit order...');
        order = await delta.createLimitOrder(
          TRADE_CONFIG.symbol,
          TRADE_CONFIG.side,
          TRADE_CONFIG.amount,
          orderPrice
        );
      }

      console.log('\n✅ ORDER PLACED SUCCESSFULLY!\n');
      console.log('📋 Order Details:');
      console.log(`   Order ID: ${order.id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Symbol: ${order.symbol}`);
      console.log(`   Type: ${order.type}`);
      console.log(`   Side: ${order.side}`);
      console.log(`   Amount: ${order.amount}`);
      console.log(`   Price: ${order.price || 'Market'}`);
      console.log(`   Filled: ${order.filled || 0}`);
      console.log(`   Remaining: ${order.remaining || order.amount}`);
      console.log(`   Timestamp: ${new Date(order.timestamp).toLocaleString()}`);

      // Show order in exchange format
      console.log('\n📄 Raw Order Response:');
      console.log(JSON.stringify(order, null, 2));
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('Invalid API')) {
      console.error('\n💡 Possible cause: Invalid API credentials');
      console.error('   Solution: Verify your API Key and Secret');
    } else if (error.message.includes('Insufficient')) {
      console.error('\n💡 Possible cause: Insufficient balance');
      console.error('   Solution: Fund your account or reduce order size');
    } else if (error.message.includes('symbol')) {
      console.error('\n💡 Possible cause: Invalid trading pair');
      console.error('   Solution: Check available markets on Delta Exchange');
    } else if (error.message.includes('amount')) {
      console.error('\n💡 Possible cause: Order amount too small or too large');
      console.error('   Solution: Check market limits');
    }
    
    console.error('\n📋 Full error details:');
    console.error(error);
  }
}

// Run the test
console.log('═══════════════════════════════════════════════════════════');
console.log('  DELTA EXCHANGE BTC TRADE TEST');
console.log('  ⚠️  WARNING: USE WITH REAL CREDENTIALS = REAL MONEY!');
console.log('═══════════════════════════════════════════════════════════\n');

testDeltaTrade();
