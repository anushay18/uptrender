# AlgoEngine - Complete Project Structure

```
backend/
└── algoengine/                          # Main AlgoEngine module
    ├── README.md                        # AlgoEngine documentation
    ├── DEPENDENCIES.json                # Required npm packages
    │
    ├── brokers/                         # Broker integrations
    │   └── mt5/                         # MT5 Broker (PRIMARY)
    │       ├── index.js                 # MT5Broker main class
    │       │
    │       ├── config/
    │       │   └── metaapi.config.js    # MT5 configuration
    │       │       ├── Account settings
    │       │       ├── Connection params
    │       │       ├── Trading settings
    │       │       ├── Fastest mode config
    │       │       ├── Risk management
    │       │       ├── Market data settings
    │       │       ├── Logging config
    │       │       ├── Performance optimization
    │       │       └── Symbol definitions
    │       │
    │       ├── services/
    │       │   ├── index.js             # Service exports
    │       │   │
    │       │   ├── ConnectionManager.js # Connection lifecycle
    │       │   │   ├── initialize()
    │       │   │   ├── connect()
    │       │   │   ├── disconnect()
    │       │   │   ├── getAccountInfo()
    │       │   │   ├── isConnectionActive()
    │       │   │   ├── waitForConnection()
    │       │   │   └── Automatic reconnection
    │       │   │
    │       │   ├── TradeService.js      # FASTEST MODE Trade Execution
    │       │   │   ├── placeTrade()     # Single order (700ms avg)
    │       │   │   ├── placeBatchTrades() # Multiple orders parallel
    │       │   │   ├── closeTrade()     # Exit position
    │       │   │   ├── modifyTrade()    # Update SL/TP
    │       │   │   ├── getOpenOrders()  # Get positions
    │       │   │   ├── getTradeHistory() # Past trades
    │       │   │   └── Performance metrics
    │       │   │
    │       │   ├── MarketDataService.js # Real-time data
    │       │   │   ├── subscribeToPrices() # Live updates
    │       │   │   ├── getCurrentPrice()
    │       │   │   ├── getCandles()
    │       │   │   ├── getMultiTimeframeData()
    │       │   │   ├── calculateIndicator()
    │       │   │   │   ├── SMA
    │       │   │   │   ├── EMA
    │       │   │   │   ├── RSI
    │       │   │   │   ├── MACD
    │       │   │   │   └── Bollinger Bands
    │       │   │   └── Price caching
    │       │   │
    │       │   └── CalculationService.js # Risk & Math
    │       │       ├── calculateStopLoss()
    │       │       ├── calculateTakeProfit()
    │       │       ├── calculatePnL()
    │       │       ├── calculateRiskRewardRatio()
    │       │       ├── calculateRequiredMargin()
    │       │       ├── calculatePositionSize()
    │       │       └── validateTradeParams()
    │       │
    │       └── utils/
    │           ├── validation.js        # Input validation
    │           └── helpers.js           # Utility functions
    │
    ├── core/                            # Core engine logic
    │   ├── StrategyEngine.js            # Strategy execution
    │   ├── RiskManager.js               # Risk management
    │   ├── EventEmitter.js              # Event system
    │   └── StateManager.js              # State tracking
    │
    ├── strategies/                      # Strategy implementations
    │   ├── BaseStrategy.js              # Abstract strategy
    │   ├── MovingAverage.js             # MA-based strategy
    │   ├── RSI.js                       # RSI-based strategy
    │   ├── MACD.js                      # MACD-based strategy
    │   ├── Scalping.js                  # Scalping strategy
    │   ├── TrendFollowing.js            # Trend strategy
    │   └── custom/                      # Custom strategies
    │       └── UserStrategy.js
    │
    ├── utils/
    │   ├── logger.js                    # Unified logging
    │   │   ├── debug(), info(), warn(), error()
    │   │   ├── File + Console logging
    │   │   ├── Log rotation
    │   │   └── Log levels
    │   │
    │   ├── cache.js                     # Caching layer
    │   │   ├── Price cache
    │   │   ├── Candle cache
    │   │   └── TTL management
    │   │
    │   ├── validators.js                # Input validation
    │   ├── formatters.js                # Data formatting
    │   ├── helpers.js                   # Helper functions
    │   └── constants.js                 # Constants
    │
    ├── examples/
    │   ├── mt5-quickstart.js            # Step-by-step guide
    │   │   ├── Initialize connection
    │   │   ├── Get account info
    │   │   ├── Get prices
    │   │   ├── Subscribe to updates
    │   │   ├── Place trade
    │   │   ├── Manage trade
    │   │   └── Close trade
    │   │
    │   ├── trading-examples.js          # Trading scenarios
    │   │   ├── Simple market order
    │   │   ├── Limit order with risk
    │   │   ├── Fixed price SL/TP
    │   │   ├── Position sizing by risk
    │   │   ├── Batch trading
    │   │   ├── Trade management
    │   │   ├── Price monitoring
    │   │   └── Technical analysis
    │   │
    │   └── advanced/
    │       ├── multi-strategy.js        # Multiple strategies
    │       ├── hedging.js               # Hedge positions
    │       └── portfolio.js             # Portfolio management
    │
    └── logs/                            # Generated log files
        ├── algoengine.log               # All logs
        ├── algoengine-debug.log
        ├── algoengine-info.log
        ├── algoengine-warn.log
        └── algoengine-error.log
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Application                      │
│                  (Backend Controllers)                   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴───────────┬────────────┐
        │                        │            │
┌───────▼────────┐  ┌────────────▼──┐  ┌─────▼─────────┐
│  Trade Service │  │  Market Data  │  │  Connection   │
│    (Fastest)   │  │    Service    │  │    Manager    │
└───────┬────────┘  └────────┬──────┘  └─────┬─────────┘
        │                    │               │
        │                    │               │
        │          ┌─────────▼──────┐        │
        │          │ Calculation    │        │
        │          │    Service     │        │
        │          └────────────────┘        │
        │                                    │
        └────────────────┬────────────────────┘
                         │
        ┌────────────────▼────────────────┐
        │    MetaAPI SDK (metaapi.js)    │
        │     Connection Pool (5 conn)    │
        └────────────────┬────────────────┘
                         │
        ┌────────────────▼────────────────┐
        │     MT5 Broker Server           │
        │  (MetaAPI Cloud Infrastructure) │
        └────────────────┬────────────────┘
                         │
        ┌────────────────▼────────────────┐
        │     MT5 Terminal / Account      │
        │   (Live Trading / Demo)         │
        └─────────────────────────────────┘
```

## Trade Execution Timeline (FASTEST MODE)

```
T0: User submits trade parameters
    ↓
T+50ms: Validate parameters
    ↓
T+100ms: Get symbol specifications
    ↓
T+150ms: Calculate SL/TP prices
    ↓
T+200ms: Create order object
    ↓
T+250-500ms: Send to MetaAPI
    ↓
T+500-700ms: Broker confirmation
    ↓
T+700-1000ms: Return to user
    ↓
Total Execution Time: 700ms - 1 second
```

## Configuration Hierarchy

```
Environment Variables (.env)
    ↓
MT5_CONFIG (metaapi.config.js)
    ├── Account settings
    ├── Connection settings
    ├── Trading settings
    │   └── FASTEST MODE
    │       ├── skipVerification
    │       ├── synchronous
    │       ├── executionTimeout
    │       ├── preferMarketOrders
    │       └── slippage
    ├── Risk management
    ├── Market data settings
    ├── Logging settings
    └── Optimization settings
```

## Error Handling Flow

```
Trade Placement Request
    ↓
Validation → ❌ Return validation error
    ↓
Connection Check → ❌ Return connection error
    ↓
MetaAPI Call → ❌ Return broker error
    ↓
Success → ✓ Return order details
    ↓
Store in Database
    ↓
Emit WebSocket update
    ↓
Log transaction
```

## Key Components Summary

| Component | Purpose | Key Methods |
|-----------|---------|------------|
| **MT5ConnectionManager** | Manage MT5 connection | initialize, connect, disconnect, getAccountInfo |
| **TradeService (FASTEST)** | Execute trades fast | placeTrade, placeBatchTrades, closeTrade, modifyTrade |
| **MarketDataService** | Real-time data | subscribeToPrices, getCandles, calculateIndicator |
| **CalculationService** | Math & Risk | calculateSL/TP, calculatePnL, validateParams |
| **Logger** | Unified logging | debug, info, warn, error |

## Deployment Considerations

```
Pre-deployment:
  ├── Set MetaAPI credentials
  ├── Configure log directory
  ├── Set log level
  ├── Configure risk limits
  └── Test with demo account

Post-deployment:
  ├── Monitor logs
  ├── Track execution times
  ├── Monitor error rates
  ├── Check account health
  └── Validate P&L reporting
```

---

**Document Version:** 1.0  
**Status:** Complete  
**Last Updated:** December 21, 2025
