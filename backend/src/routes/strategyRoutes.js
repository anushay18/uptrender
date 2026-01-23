import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { 
  getUserStrategies, 
  createStrategy, 
  getStrategyById, 
  updateStrategy, 
  deleteStrategy,
  toggleStrategyRunning,
  startStrategy,
  stopStrategy,
  activateStrategy,
  deactivateStrategy,
  toggleFavorite,
  getMarketplaceStrategies,
  getAllStrategies,
  debugPublicStrategies,
  validateStrategyCode,
  runBacktest,
  deployStrategy,
  saveDraft,
  getUserDrafts,
  generateStrategyCode,
  getStrategyPublicStats,
  checkStrategyOpenPositions
} from '../controllers/strategyController.js';
import { 
  createStrategyValidation,
  updateStrategyValidation,
  idParamValidation,
  paginationValidation
} from '../middleware/validation.js';

const router = express.Router();

// Marketplace route (requires authentication to filter user's own strategies)
router.get('/marketplace', authenticate, paginationValidation, getMarketplaceStrategies);

// Strategy Builder routes
router.post('/validate-code', authenticate, validateStrategyCode);
router.post('/generate-code', authenticate, generateStrategyCode);
router.post('/backtest', authenticate, runBacktest);
router.post('/deploy', authenticate, deployStrategy);
router.post('/save-draft', authenticate, saveDraft);
router.get('/drafts', authenticate, getUserDrafts);

// User strategy routes
router.get('/', authenticate, paginationValidation, getUserStrategies);
router.post('/', authenticate, createStrategyValidation, createStrategy);
// Public stats for a strategy (auth required; visible if public or owned) - MUST come before /:id
router.get('/:id/stats', authenticate, idParamValidation, getStrategyPublicStats);
// Check if strategy has open positions
router.get('/:id/check-positions', authenticate, idParamValidation, checkStrategyOpenPositions);
// Generic strategy routes
router.get('/:id', authenticate, idParamValidation, getStrategyById);
router.put('/:id', authenticate, idParamValidation, updateStrategyValidation, updateStrategy);
router.delete('/:id', authenticate, idParamValidation, deleteStrategy);
router.post('/:id/toggle-running', authenticate, idParamValidation, toggleStrategyRunning);
router.post('/:id/toggle-favorite', authenticate, idParamValidation, toggleFavorite);
router.post('/:id/start', authenticate, idParamValidation, startStrategy);
router.post('/:id/stop', authenticate, idParamValidation, stopStrategy);
router.post('/:id/activate', authenticate, idParamValidation, activateStrategy);
router.post('/:id/deactivate', authenticate, idParamValidation, deactivateStrategy);

// Admin routes
router.get('/admin/all', authenticate, roleCheck(['Admin']), getAllStrategies);

// Debug route - remove in production
router.get('/debug/public', debugPublicStrategies);

export default router;