import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { encrypt, decrypt } from './src/utils/encryption.js';

dotenv.config();

/**
 * Test Delta Exchange Connection
 * Replace with actual API credentials
 */
async function testDeltaConnection() {
  console.log('\n🔍 Testing Delta Exchange Connection...\n');

  // REPLACE THESE WITH ACTUAL CREDENTIALS
  const API_KEY = 'YOUR_DELTA_API_KEY';
  const API_SECRET = 'YOUR_DELTA_API_SECRET';

  if (API_KEY === 'YOUR_DELTA_API_KEY') {
    console.log('❌ Please replace API_KEY and API_SECRET with actual Delta Exchange credentials');
    console.log('\nEdit this file: backend/test-delta-connection.js');
    console.log('Lines 13-14: Replace YOUR_DELTA_API_KEY and YOUR_DELTA_API_SECRET');
    return;
  }

  try {
    // Create Delta Exchange instance
    console.log('📡 Creating Delta Exchange instance...');
    const delta = new ccxt.delta({
      apiKey: API_KEY,
      secret: API_SECRET,
      enableRateLimit: true,
      options: {
        defaultType: 'future', // Delta is primarily a derivatives exchange
      },
    });

    console.log('✅ Exchange instance created');
    console.log(`   Name: ${delta.name}`);
    console.log(`   ID: ${delta.id}`);

    // Load markets
    console.log('\n📊 Loading markets...');
    await delta.loadMarkets();
    console.log(`✅ Markets loaded: ${Object.keys(delta.markets).length} symbols`);
    console.log(`   Sample symbols:`, Object.keys(delta.markets).slice(0, 5).join(', '));

    // Test balance fetch
    console.log('\n💰 Fetching account balance...');
    const balance = await delta.fetchBalance();
    console.log('✅ Balance fetched successfully!');
    
    // Display balance
    const currencies = Object.keys(balance.total).filter(curr => balance.total[curr] > 0);
    if (currencies.length > 0) {
      console.log('\n📈 Account Balances:');
      currencies.forEach(curr => {
        console.log(`   ${curr}: ${balance.total[curr]} (Free: ${balance.free[curr]}, Used: ${balance.used[curr]})`);
      });
    } else {
      console.log('   No balances found (account might be empty)');
    }

    // Test encryption/decryption (as used in the app)
    console.log('\n🔐 Testing encryption/decryption...');
    const encryptedKey = encrypt(API_KEY);
    const encryptedSecret = encrypt(API_SECRET);
    console.log(`   Encrypted API Key: ${encryptedKey.substring(0, 50)}...`);
    console.log(`   Encrypted Secret: ${encryptedSecret.substring(0, 50)}...`);

    const decryptedKey = decrypt(encryptedKey);
    const decryptedSecret = decrypt(encryptedSecret);
    
    if (decryptedKey === API_KEY && decryptedSecret === API_SECRET) {
      console.log('✅ Encryption/Decryption working correctly');
    } else {
      console.log('❌ Encryption/Decryption failed!');
      return;
    }

    // Test with encrypted credentials (as the app does)
    console.log('\n🔄 Testing with encrypted credentials...');
    const deltaEncrypted = new ccxt.delta({
      apiKey: decryptedKey,
      secret: decryptedSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'future',
      },
    });

    await deltaEncrypted.loadMarkets();
    const balanceEncrypted = await deltaEncrypted.fetchBalance();
    console.log('✅ Connection successful with encrypted/decrypted credentials!');

    // Test positions (if available)
    if (delta.has.fetchPositions) {
      console.log('\n📍 Fetching positions...');
      try {
        const positions = await delta.fetchPositions();
        console.log(`✅ Positions fetched: ${positions.length} open positions`);
        if (positions.length > 0) {
          console.log('   Sample position:', positions[0].symbol);
        }
      } catch (error) {
        console.log('⚠️  No positions or error:', error.message);
      }
    }

    console.log('\n✅ ALL TESTS PASSED! Delta Exchange is working correctly.');
    console.log('\n📝 Summary:');
    console.log('   - Exchange instance created ✓');
    console.log('   - Markets loaded ✓');
    console.log('   - Balance fetched ✓');
    console.log('   - Encryption/Decryption ✓');
    console.log('   - Ready for production use ✓');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n📋 Error Details:');
    console.error('   Type:', error.constructor.name);
    if (error.message.includes('Invalid API')) {
      console.error('   Cause: Invalid API credentials');
      console.error('   Solution: Check your API Key and Secret');
    } else if (error.message.includes('nonce')) {
      console.error('   Cause: Timestamp/nonce issue');
      console.error('   Solution: Check system time synchronization');
    } else if (error.message.includes('IP')) {
      console.error('   Cause: IP whitelist restriction');
      console.error('   Solution: Add your server IP to Delta Exchange whitelist');
    }
    console.error('\n   Full error:', error);
  }
}

// Run the test
testDeltaConnection();
