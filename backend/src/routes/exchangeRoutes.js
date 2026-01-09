import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/roleCheck.js';
import * as exchangeController from '../controllers/exchangeController.js';

const router = Router();

/**
 * Exchange Routes - Universal CCXT Integration
 * 
 * Public Routes (no auth required):
 * - GET /supported - Get all 100+ supported exchanges
 * - GET /popular - Get popular/recommended exchanges
 * - GET /info/:exchangeId - Get exchange capabilities
 * - GET /password-required/:exchangeId - Check if passphrase needed
 * - GET /symbols/:exchangeId - Get trading symbols
 * - POST /ticker - Get ticker for a symbol
 * - POST /ohlcv - Get candlestick data
 * 
 * Private Routes (auth required):
 * - POST /balance - Fetch account balance
 * - POST /orders/market - Create market order
 * - POST /orders/limit - Create limit order
 * - POST /orders/cancel - Cancel an order
 * - POST /orders/open - Fetch open orders
 * - POST /positions - Fetch positions (futures)
 * - POST /test-connection - Test API key connection
 */

// ==================== PUBLIC ROUTES ====================

// Get all supported exchanges (100+)
router.get('/supported', exchangeController.getSupportedExchanges);

// Get popular/recommended exchanges
router.get('/popular', exchangeController.getPopularExchanges);

// Get exchange info and capabilities
router.get('/info/:exchangeId', exchangeController.getExchangeInfo);

// Check if exchange requires passphrase
router.get('/password-required/:exchangeId', exchangeController.checkPasswordRequired);

// Get trading symbols for an exchange
router.get('/symbols/:exchangeId', exchangeController.getSymbols);

// Fetch ticker (public data)
router.post('/ticker', exchangeController.fetchTicker);

// Fetch OHLCV candlestick data (public data)
router.post('/ohlcv', exchangeController.fetchOHLCV);

// ==================== PRIVATE ROUTES (Requires Auth) ====================

// Test connection with API keys
router.post('/test-connection', authenticate, exchangeController.testConnection);

// Fetch account balance
router.post('/balance', authenticate, exchangeController.fetchBalance);

// Create market order
router.post('/orders/market', authenticate, exchangeController.createMarketOrder);

// Create limit order
router.post('/orders/limit', authenticate, exchangeController.createLimitOrder);

// Cancel order
router.post('/orders/cancel', authenticate, exchangeController.cancelOrder);

// Fetch open orders
router.post('/orders/open', authenticate, exchangeController.fetchOpenOrders);

// Fetch positions (futures/margin)
router.post('/positions', authenticate, exchangeController.fetchPositions);

export default router;
