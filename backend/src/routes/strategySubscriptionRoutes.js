import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  subscribeToStrategy,
  unsubscribeFromStrategy,
  updateSubscription,
  getUserSubscriptions,
  getSubscriptionById,
  processExpiredSubscriptions,
  renewSubscription,
  toggleSubscriptionPause,
  setSubscriptionTradeMode,
  getSubscriptionBrokers,
  updateSubscriptionBrokers,
  checkSubscriptionOpenPositions
} from '../controllers/strategySubscriptionController.js';
import {
  idParamValidation,
  paginationValidation,
  subscribeToStrategyValidation
} from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Subscribe to a strategy
router.post('/subscribe', subscribeToStrategyValidation, subscribeToStrategy);

// Renew subscription (extend by 30 days)
router.post('/:id/renew', idParamValidation, renewSubscription);

// Toggle pause/resume for a subscription
router.put('/:id/toggle-pause', idParamValidation, toggleSubscriptionPause);

// Set trade mode (paper/live) for a subscription
router.put('/:id/trade-mode', idParamValidation, setSubscriptionTradeMode);

// Get user's brokers for a subscription
router.get('/:id/brokers', idParamValidation, getSubscriptionBrokers);

// Update selected brokers for a subscription
router.put('/:id/brokers', idParamValidation, updateSubscriptionBrokers);

// Unsubscribe from a strategy
router.delete('/:id', idParamValidation, unsubscribeFromStrategy);

// Update subscription (only lots)
router.put('/:id', idParamValidation, updateSubscription);

// Toggle pause state for subscription
router.put('/:id/toggle-pause', idParamValidation, toggleSubscriptionPause);

// Set trade mode for subscription
router.put('/:id/trade-mode', idParamValidation, setSubscriptionTradeMode);

// Get available brokers for subscription
router.get('/:id/brokers', idParamValidation, getSubscriptionBrokers);

// Update selected brokers for subscription
router.put('/:id/brokers', idParamValidation, updateSubscriptionBrokers);

// Get user's subscriptions
router.get('/', paginationValidation, getUserSubscriptions);

// Check if subscription has open positions
router.get('/:id/check-positions', idParamValidation, checkSubscriptionOpenPositions);

// Get subscription by ID
router.get('/:id', idParamValidation, getSubscriptionById);

// Admin endpoint to manually process expired subscriptions
router.post('/admin/process-expired', authorize('admin'), processExpiredSubscriptions);

export default router;