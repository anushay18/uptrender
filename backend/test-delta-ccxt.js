import ccxt from 'ccxt';

const apiKey = 'CCydtYXU37ytYArROs3lYJzGHo7tLB';
const apiSecret = 'KQv0DKbUyQosaaemeAJBW9r3DuQ1LcX92lVBatlDMHWMMcLx8mqYx31mMObZ';

console.log('Testing Delta Exchange with CCXT...');
console.log('API Key:', apiKey.substring(0, 10) + '...');
console.log('API Secret length:', apiSecret.length);

try {
  const exchange = new ccxt.delta({
    apiKey: apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    urls: {
      api: {
        public: 'https://api.india.delta.exchange',
        private: 'https://api.india.delta.exchange',
      },
    },
    options: {
      defaultType: 'future',
    },
  });

  console.log('\n✅ Exchange instance created');
  console.log('Exchange ID:', exchange.id);
  console.log('Exchange name:', exchange.name);
  
  console.log('\n📡 Fetching balance...');
  const balance = await exchange.fetchBalance();
  
  console.log('\n✅ SUCCESS! Balance fetched:');
  console.log(JSON.stringify(balance, null, 2));
  
} catch (error) {
  console.error('\n❌ CCXT Error:');
  console.error('Message:', error.message);
  console.error('Name:', error.name);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
}

process.exit(0);
