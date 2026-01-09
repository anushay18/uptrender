# Delta Exchange Connection Test

## Quick Test Steps

### 1. Get Delta Exchange API Credentials
1. Login to https://www.delta.exchange
2. Go to Account Settings → API Management
3. Create new API key with these permissions:
   - Read account balance
   - View positions
   - (Optional) Place orders if you want full trading

### 2. Update Test Script
Edit the file: `backend/test-delta-connection.js`

Replace lines 13-14 with your actual credentials:
```javascript
const API_KEY = 'your_actual_delta_api_key_here';
const API_SECRET = 'your_actual_delta_api_secret_here';
```

### 3. Run the Test
```bash
cd /var/www/dev.uptrender.in-main/backend
node test-delta-connection.js
```

## Expected Output

If successful, you should see:
```
✅ ALL TESTS PASSED! Delta Exchange is working correctly.

📝 Summary:
   - Exchange instance created ✓
   - Markets loaded ✓
   - Balance fetched ✓
   - Encryption/Decryption ✓
   - Ready for production use ✓
```

## Common Issues

### Invalid API Credentials
- Check that you copied the full API key and secret
- Ensure no extra spaces or newlines

### IP Whitelist Error
- Go to Delta Exchange API settings
- Add your server IP to the whitelist

### Nonce/Timestamp Error
- Check system time is synchronized
- Run: `timedatectl status`

## Testing via Web UI

1. **Login to the platform** with Bhavin's account
2. **Go to API Management** page
3. **Click "Add API Connection"**
4. **Select:**
   - Segment: `Crypto`
   - Exchange: `Delta Exchange`
   - Account Type: `Futures/Derivatives`
5. **Enter credentials:**
   - API Name: `Delta - Bhavin Test`
   - API Key: [paste from Delta]
   - API Secret: [paste from Delta]
6. **Click "Test Connection"** button
7. **If successful**, click "Add API"

## Verify in Database

```sql
SELECT id, apiName, broker, exchangeId, segment, status, balance
FROM apikeys 
WHERE broker = 'delta' OR exchangeId = 'delta'
ORDER BY createdAt DESC;
```

## Test Connection via API

```bash
# Get API key ID first
API_KEY_ID=123  # Replace with actual ID

# Test connection
curl -X POST http://localhost:5001/api-keys/$API_KEY_ID/test-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Connection successful! API credentials are valid.",
  "data": {
    "exchange": "Delta Exchange",
    "balanceAvailable": true,
    "currencies": ["USDT", "BTC"]
  }
}
```
