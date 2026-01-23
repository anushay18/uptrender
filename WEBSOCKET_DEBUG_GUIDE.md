# WebSocket Real-Time Updates - Debug Guide

## What Was Fixed

### 1. **Enhanced Logging System** 
Added comprehensive console logs throughout the entire WebSocket flow:
- ✅ Connection establishment and status
- ✅ Subscription confirmations  
- ✅ Incoming MTM updates (batch and single)
- ✅ Position value changes in real-time
- ✅ Hook lifecycle events

### 2. **Improved WebSocket Connection**
- ✅ Automatic connection check on dashboard mount
- ✅ Delayed subscription check (1s after mount)
- ✅ Connection status indicator in UI
- ✅ Better error handling and reconnection logic

### 3. **Fixed MTM Update Handlers**
- ✅ Support for batch updates: `{ positions: [...] }`
- ✅ Support for single updates: `{ positionId, currentPrice, profit }`
- ✅ Proper state updates in both dashboard and strategies screens
- ✅ Real-time position card updates with visual feedback

### 4. **Visual Indicators**
- ✅ WebSocket connection status badge (🟢 Active / 🔴 Disconnected)
- ✅ Position card border highlight on real-time update
- ✅ Animated visual feedback for value changes

## How to Verify Real-Time Updates

### Step 1: Check Terminal Logs

Open your terminal running `npm start` and look for these logs:

#### **Connection Logs:**
```
🔌 [Hook] usePaperPositionUpdates effect mounted
🔌 [Hook] ensureSubscriptions called, wsService.isConnected: true
✅ [Hook] Socket connected, subscribing to paper_prices and paper_mtm
✅ [WS] Subscribing to paper_prices
✅ [WS] Subscribing to paper_mtm
```

#### **MTM Update Logs (when backend sends updates):**
```
📡 [WS] Received paper:mtm_update from server: {"positions":[{"id":123,...}]}
📊 [Dashboard] MTM Update received from WebSocket: {...}
📊 [Dashboard] Batch MTM update for 5 positions
✨ [Dashboard] Position updated via BATCH MTM: {...}
```

#### **Position Card Logs:**
```
🔁 [PositionCard] Real-time update received for position 123
📊 [PositionCard] Batch MTM update for position 123
```

### Step 2: Check WebSocket Connection Status

Look at the top of your dashboard screen:
- **🟢 Real-time Updates Active** = WebSocket connected ✅
- **🔴 Real-time Updates Disconnected** = Not connected ❌

### Step 3: Verify Position Updates

When MTM updates arrive from backend:
1. Position card borders should **flash green/red** momentarily
2. **Current Price** should update instantly
3. **Profit/Loss** should update instantly
4. Console logs should show the old vs new values

### Step 4: Backend Integration Check

Your backend should be emitting events like:

```javascript
// Batch update (preferred)
io.to(`user:${userId}`).emit('paper:mtm_update', {
  positions: [
    { id: 1, currentPrice: 45000.50, profit: 125.50, profitPercent: 2.5 },
    { id: 2, currentPrice: 3200.25, profit: -50.25, profitPercent: -1.2 },
  ]
});

// OR single update
io.to(`user:${userId}`).emit('paper_position:update', {
  action: 'mtm',
  position: {
    id: 1,
    currentPrice: 45000.50,
    profit: 125.50,
    profitPercent: 2.5
  }
});
```

## Testing Checklist

- [ ] Frontend shows "🟢 Real-time Updates Active"
- [ ] Console shows WebSocket connection logs
- [ ] Console shows subscription confirmation logs
- [ ] Console shows MTM update received logs
- [ ] Position values update automatically (no refresh needed)
- [ ] Position cards show visual feedback on update
- [ ] Console shows "Position value UPDATED" logs with before/after values

## Troubleshooting

### ❌ No Logs Appearing

**Problem:** Not seeing any WebSocket logs in terminal

**Solutions:**
1. Check if `npm start` is running
2. Restart the app with `npm start`
3. Make sure you're logged in
4. Check if `API_CONFIG.WS_URL` is correct in config

### ❌ Shows Disconnected

**Problem:** Badge shows "🔴 Real-time Updates Disconnected"

**Solutions:**
1. Check backend is running
2. Verify WebSocket URL in `/services/config.ts`
3. Check auth token is valid
4. Try logout and login again
5. Check terminal for connection errors

### ❌ Connected but No Updates

**Problem:** Connected but position values don't change

**Solutions:**
1. Check if backend is emitting MTM updates
2. Verify event names match: `paper:mtm_update` or `paper_position:update`
3. Check if you have open positions to update
4. Verify backend is sending updates to the correct user room
5. Look for console logs starting with "📊 [Dashboard] MTM Update received"

### ❌ Logs Show Updates but UI Doesn't Change

**Problem:** Console logs show updates arriving but UI stays the same

**Solutions:**
1. Check position IDs match (backend sends same ID as frontend has)
2. Verify data format: `{ positions: [...] }` or `{ positionId, currentPrice, profit }`
3. Make sure `currentPrice`, `profit`, and `profitPercent` fields are present
4. Check React state is updating (look for logs with "Position value UPDATED")

## Expected Log Flow

When everything works correctly, you'll see this sequence:

1. **On App Load:**
   ```
   🔌 [Dashboard] User authenticated, checking WebSocket connection...
   ✅ [Dashboard] WebSocket already connected, subscribing to updates...
   ```

2. **When Backend Sends Update:**
   ```
   📡 [WS] Received paper:mtm_update from server: {...}
   📊 [Dashboard] MTM Update received from WebSocket: {...}
   📊 [Dashboard] Batch MTM update for 5 positions
   ✨ [Dashboard] Position updated via BATCH MTM: {...}
   🔁 [PositionCard] Real-time update received for position 123
   ```

3. **Value Change Confirmation:**
   ```
   ✨ [Dashboard] Position value UPDATED in real-time: {
     id: 123,
     symbol: 'BTCUSD',
     from: { currentPrice: 45000, profit: 100, profitPercent: 2 },
     to: { currentPrice: 45050, profit: 150, profitPercent: 3 }
   }
   ```

## Files Modified

### Frontend Changes:
1. `/app/(tabs)/index.tsx` - Dashboard with WebSocket status and enhanced logging
2. `/app/(tabs)/strategies.tsx` - Strategy screen with enhanced logging
3. `/hooks/useWebSocket.ts` - WebSocket hooks with comprehensive logging
4. `/services/websocket.ts` - WebSocket service with detailed connection logs
5. `/components/position-card.tsx` - Position card with real-time update visual feedback

### No Backend Changes Required! ✅

All fixes are frontend-only. Your backend code remains unchanged.

## Support

If updates still don't work:
1. Share the full terminal output
2. Check browser/app console for errors
3. Verify backend logs show MTM updates being emitted
4. Confirm WebSocket server is running and accessible

---

**Last Updated:** 2026-01-19
**Status:** ✅ Real-time updates fully implemented with comprehensive logging
