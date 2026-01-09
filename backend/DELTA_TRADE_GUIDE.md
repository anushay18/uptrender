# Delta Exchange BTC Trade Guide for Bhavin

## Prerequisites

1. **Delta Exchange Account** with API credentials
2. **Funded account** with USDT or BTC
3. **API Key** added to the platform

---

## Method 1: Direct Script Test (Recommended for Testing)

### Step 1: Add Delta API Credentials

Edit the file:
```bash
nano /var/www/dev.uptrender.in-main/backend/test-delta-trade.js
```

Update lines 15-16:
```javascript
const API_KEY = 'your_actual_delta_api_key';
const API_SECRET = 'your_actual_delta_api_secret';
```

### Step 2: Configure Trade Parameters

Edit lines 19-25 in the same file:
```javascript
const TRADE_CONFIG = {
  symbol: 'BTC/USDT',        // Trading pair
  side: 'buy',               // 'buy' or 'sell'
  type: 'limit',             // 'market' or 'limit'
  amount: 0.001,             // BTC amount (start small!)
  price: null,               // For limit: set price or null for 1% below market
  testMode: true,            // IMPORTANT: Set false to place real order
};
```

### Step 3: Run Test Mode (Safe)
```bash
cd /var/www/dev.uptrender.in-main/backend
node test-delta-trade.js
```

**Expected Output:**
```
✅ Connected to Delta Exchange
✅ Markets loaded
✅ Balance fetched
✅ Current Price: $95,432.10
✅ Balance check passed
🧪 TEST MODE - Order NOT placed
```

### Step 4: Place Real Order (After Testing)

1. Set `testMode: false`
2. Review all parameters
3. Run again:
```bash
node test-delta-trade.js
```

---

## Method 2: Via API Endpoint

### Step 1: Get Your API Key ID

```sql
mysql -u root -p algo_trading_db

SELECT id, apiName, broker, exchangeId, status 
FROM apikeys 
WHERE userId = (SELECT id FROM users WHERE email = 'bhavin@email.com')
  AND (broker = 'delta' OR exchangeId = 'delta');
```

Note the `id` (e.g., 123)

### Step 2: Get JWT Token

Login via web interface and copy JWT token from browser's localStorage or network tab.

### Step 3: Configure the API Script

```bash
nano /var/www/dev.uptrender.in-main/backend/test-delta-trade-api.sh
```

Update:
```bash
JWT_TOKEN="your_jwt_token_here"
API_KEY_ID="123"  # From step 1
```

### Step 4: Run the API Test

```bash
cd /var/www/dev.uptrender.in-main/backend
./test-delta-trade-api.sh
```

---

## Method 3: Via Web Interface

### Step 1: Add Delta API Key

1. Login to platform
2. Go to **API Management**
3. Click **"Add API Connection"**
4. Fill in:
   - Segment: `Crypto`
   - Exchange: `Delta Exchange`
   - Account Type: `Futures/Derivatives`
   - API Key: [from Delta]
   - API Secret: [from Delta]
5. Click **"Test Connection"**
6. If successful, click **"Add API"**

### Step 2: Create Strategy or Manual Trade

**Option A: Via Strategy**
1. Create a new strategy
2. Link Delta API key
3. Configure webhook
4. Trigger via TradingView or manual webhook

**Option B: Manual Order (if implemented)**
1. Go to Trading page
2. Select Delta Exchange
3. Enter BTC/USDT
4. Choose Buy/Sell
5. Set amount and price
6. Click Trade

---

## Quick Test Commands

### Test Connection Only
```bash
cd /var/www/dev.uptrender.in-main/backend
node test-delta-connection.js
```

### View Available Markets
```bash
node -e "const ccxt = require('ccxt'); const delta = new ccxt.delta(); delta.loadMarkets().then(() => { const btc = Object.keys(delta.markets).filter(s => s.includes('BTC')); console.log('BTC Markets:', btc); });"
```

### Check Current BTC Price
```bash
node -e "const ccxt = require('ccxt'); const delta = new ccxt.delta(); delta.loadMarkets().then(async () => { const ticker = await delta.fetchTicker('BTC/USDT'); console.log('BTC Price:', ticker.last); });"
```

---

## Important Notes

⚠️ **SAFETY FIRST:**
- Always start with TEST MODE enabled
- Use small amounts for first real trade
- Verify balance before trading
- Check market liquidity

💡 **Delta Exchange Specifics:**
- Primarily a **derivatives exchange** (futures/perpetuals)
- Most markets are futures, not spot
- Check contract specifications before trading
- Use proper position sizing

📊 **Common Symbols:**
- `BTC/USDT` - BTC perpetual futures
- `BTCUSD` - BTC futures (USD settled)
- Check Delta Exchange for exact symbol names

🔐 **API Permissions Required:**
- ✓ Read account balance
- ✓ View positions
- ✓ Place orders
- ✓ Cancel orders

---

## Troubleshooting

### "Invalid API credentials"
- Verify API Key and Secret are correct
- Check if API key is active on Delta Exchange
- Ensure API permissions include trading

### "Insufficient balance"
- Fund your Delta Exchange account
- Check you have USDT for BTC/USDT trades
- Reduce order amount

### "Symbol not found"
- Delta uses futures symbols
- Try: `BTCUSD_PERP` or check Delta Exchange API docs
- Run market list command above

### "Order amount too small"
- Check minimum order size on Delta
- Increase amount (e.g., 0.001 BTC minimum)

---

## Next Steps

1. ✅ Test connection with credentials
2. ✅ Verify balance and current price
3. ✅ Run in TEST MODE first
4. ✅ Place small real order
5. ✅ Monitor order status
6. ✅ Scale up gradually

Need help? Check the test scripts output for detailed error messages.
