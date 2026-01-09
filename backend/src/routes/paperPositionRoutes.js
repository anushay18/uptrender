/**
 * Paper Position Routes
 * Routes for paper trading position management
 */

import express from 'express';
import {
  getOpenPositions,
  getPositionHistory,
  getStats,
  openPosition,
  closePosition,
  modifyPosition,
  closeAllPositions,
  updatePrices
} from '../controllers/paperPositionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/roleCheck.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get open paper positions
router.get('/', getOpenPositions);

// Get paper position history
router.get('/history', getPositionHistory);

// Get paper trading statistics
router.get('/stats', getStats);

// Open a new paper position
router.post('/open', openPosition);

// Close all open positions
router.post('/close-all', closeAllPositions);

// Close a specific position
router.post('/:orderId/close', closePosition);

// Modify a position (SL/TP)
router.put('/:orderId', modifyPosition);

// Update prices (internal/admin)
router.post('/update-prices', isAdmin, updatePrices);

export default router;
