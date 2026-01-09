#!/bin/bash

# Delta Exchange Trade Test via API
# Requires: Bhavin's JWT token and Delta API Key ID

echo "═══════════════════════════════════════════════════════"
echo "  Delta Exchange BTC Trade via API"
echo "═══════════════════════════════════════════════════════"
echo ""

# Configuration
BASE_URL="http://localhost:5001"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"
API_KEY_ID="YOUR_DELTA_API_KEY_ID"  # From apikeys table

# Trade parameters
SYMBOL="BTC/USDT"
SIDE="buy"           # buy or sell
AMOUNT="0.001"       # BTC amount (small for testing)
TYPE="market"        # market or limit
PRICE=""             # Only for limit orders

# Check if configured
if [ "$JWT_TOKEN" = "YOUR_JWT_TOKEN_HERE" ]; then
    echo "❌ Please configure the script first!"
    echo ""
    echo "Edit this file and set:"
    echo "  - JWT_TOKEN (get from login)"
    echo "  - API_KEY_ID (from database apikeys table)"
    echo ""
    exit 1
fi

echo "📋 Configuration:"
echo "   API Key ID: $API_KEY_ID"
echo "   Symbol: $SYMBOL"
echo "   Side: $SIDE"
echo "   Type: $TYPE"
echo "   Amount: $AMOUNT BTC"
echo ""

# Step 1: Test API key connection
echo "🔍 Testing API key connection..."
CONN_TEST=$(curl -s -X POST "$BASE_URL/api-keys/$API_KEY_ID/test-connection" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "$CONN_TEST" | python3 -m json.tool 2>/dev/null || echo "$CONN_TEST"

if echo "$CONN_TEST" | grep -q '"success":true'; then
    echo "✅ API key connection successful!"
else
    echo "❌ API key connection failed!"
    exit 1
fi
echo ""

# Step 2: Get current balance
echo "💰 Fetching account balance..."
BALANCE=$(curl -s -X POST "$BASE_URL/exchanges/balance" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"exchangeId\": \"delta\",
    \"apiKeyId\": $API_KEY_ID,
    \"accountType\": \"future\"
  }")

echo "$BALANCE" | python3 -m json.tool 2>/dev/null || echo "$BALANCE"
echo ""

# Step 3: Get current price
echo "💹 Fetching current BTC price..."
TICKER=$(curl -s -X POST "$BASE_URL/exchanges/ticker" \
  -H "Content-Type: application/json" \
  -d "{
    \"exchangeId\": \"delta\",
    \"symbol\": \"$SYMBOL\"
  }")

echo "$TICKER" | python3 -m json.tool 2>/dev/null || echo "$TICKER"
echo ""

# Step 4: Place order
echo "⚠️  Ready to place order..."
echo "Press Enter to continue or Ctrl+C to cancel..."
read

echo "📤 Placing $TYPE $SIDE order for $AMOUNT BTC..."

if [ "$TYPE" = "market" ]; then
    ORDER=$(curl -s -X POST "$BASE_URL/exchanges/market-order" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"exchangeId\": \"delta\",
        \"apiKeyId\": $API_KEY_ID,
        \"symbol\": \"$SYMBOL\",
        \"side\": \"$SIDE\",
        \"amount\": $AMOUNT,
        \"accountType\": \"future\"
      }")
else
    ORDER=$(curl -s -X POST "$BASE_URL/exchanges/limit-order" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"exchangeId\": \"delta\",
        \"apiKeyId\": $API_KEY_ID,
        \"symbol\": \"$SYMBOL\",
        \"side\": \"$SIDE\",
        \"amount\": $AMOUNT,
        \"price\": $PRICE,
        \"accountType\": \"future\"
      }")
fi

echo ""
echo "📋 Order Response:"
echo "$ORDER" | python3 -m json.tool 2>/dev/null || echo "$ORDER"
echo ""

if echo "$ORDER" | grep -q '"success":true'; then
    echo "✅ Order placed successfully!"
else
    echo "❌ Order placement failed!"
fi
