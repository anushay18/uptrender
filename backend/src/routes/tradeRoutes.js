import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { 
  getUserTrades, 
  createTrade, 
  getTradeById, 
  updateTrade, 
  deleteTrade, 
  getTradeStats,
  getAllTrades,
  adminStrategyTrade,
  adminWebhookTrigger
} from '../controllers/tradeController.js';
import { 
  createTradeValidation, 
  updateTradeValidation, 
  idParamValidation,
  paginationValidation
} from '../middleware/validation.js';

const router = express.Router();

// User trade routes
router.get('/', authenticate, paginationValidation, getUserTrades);
router.post('/', authenticate, createTradeValidation, createTrade);
router.get('/stats', authenticate, getTradeStats);
router.get('/:id', authenticate, idParamValidation, getTradeById);
router.put('/:id', authenticate, updateTradeValidation, updateTrade);
router.delete('/:id', authenticate, idParamValidation, deleteTrade);

// Admin routes
router.get('/admin/all', authenticate, roleCheck(['Admin']), getAllTrades);
router.post('/admin/strategy-trade', authenticate, roleCheck(['Admin']), adminStrategyTrade);
router.post('/admin/webhook-trigger', authenticate, roleCheck(['Admin']), adminWebhookTrigger);

export default router;