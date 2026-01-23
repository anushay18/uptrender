import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';
import { 
  executeStrategyTrade,
  executeManualTrade,
  getSymbolPrice,
  closeAlgoTrade,
  getOpenPositions,
  getAccountInfo,
  executeTradingViewWebhook,
  getMultipleSymbolPrices,
  syncBrokerPositions
} from '../controllers/algoTradeController.js';

const router = express.Router();

/**
 * @route   POST /api/algo-trades/webhook
 * @desc    Execute trade from TradingView webhook (NO AUTH - uses secret key)
 * @access  Public (with secret validation)
 * @body    { secret: string, strategyId: number, userId: number, signal: "BUY"|"SELL", symbol?: string }
 */
router.post('/webhook', webhookLimiter, executeTradingViewWebhook);

/**
 * @route   POST /api/algo-trades/execute
 * @desc    Execute trade based on strategy configuration
 * @access  Private
 * @body    { strategyId: number, signal: "BUY"|"SELL", symbol?: string }
 */
router.post('/execute', authenticate, executeStrategyTrade);

/**
 * @route   POST /api/algo-trades/manual
 * @desc    Execute manual trade with custom parameters
 * @access  Private
 * @body    { symbol, type, volume, stopLoss, takeProfit, segment }
 */
router.post('/manual', authenticate, executeManualTrade);

/**
 * @route   GET /api/algo-trades/price/:symbol
 * @desc    Get current price for a symbol
 * @access  Private
 * @query   segment (optional, default: Forex)
 */
router.get('/price/:symbol', authenticate, getSymbolPrice);

/**
 * @route   POST /api/algo-trades/prices
 * @desc    Get current prices for multiple symbols (batch request)
 * @access  Private
 * @body    { symbols: string[], segment?: string }
 */
router.post('/prices', authenticate, getMultipleSymbolPrices);

/**
 * @route   POST /api/algo-trades/close/:orderId
 * @desc    Close an open trade
 * @access  Private
 */
router.post('/close/:orderId', authenticate, closeAlgoTrade);

/**
 * @route   GET /api/algo-trades/positions
 * @desc    Get all open positions
 * @access  Private
 * @query   segment (optional, default: Forex)
 */
router.get('/positions', authenticate, getOpenPositions);

/**
 * @route   GET /api/algo-trades/account
 * @desc    Get MT5 account information
 * @access  Private
 * @query   segment (optional, default: Forex)
 */
router.get('/account', authenticate, getAccountInfo);

/**
 * @route   POST /api/algo-trades/sync-positions
 * @desc    Sync positions from broker - detect broker-closed positions
 * @access  Private
 * @body    { segment?: string }
 */
router.post('/sync-positions', authenticate, syncBrokerPositions);

console.log('✅ AlgoTrade routes loaded');

export default router;

