import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllTrades,
  getTradeById,
  updateTrade,
  deleteTrade,
  getTradeStats
} from '../controllers/adminTradeController.js';

const router = express.Router();

// All routes require authentication and admin authorization
router.use(authenticate);
router.use(authorize('admin'));

// Get trade statistics
router.get('/stats', getTradeStats);

// Get all trades
router.get('/', getAllTrades);

// Get trade by ID
router.get('/:id', getTradeById);

// Update trade
router.put('/:id', updateTrade);

// Delete trade
router.delete('/:id', deleteTrade);

export default router;
