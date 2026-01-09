import express from 'express';
import {
  getStrategyBrokers,
  addBrokerToStrategy,
  removeBrokerFromStrategy,
  toggleStrategyBrokerStatus,
  addMultipleBrokersToStrategy
} from '../controllers/strategyBrokerController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all brokers for a strategy
router.get('/:strategyId/brokers', getStrategyBrokers);

// Add a broker to a strategy
router.post('/:strategyId/brokers', addBrokerToStrategy);

// Add multiple brokers to a strategy (replaces existing)
router.post('/:strategyId/brokers/bulk', addMultipleBrokersToStrategy);

// Remove a broker from a strategy
router.delete('/:strategyId/brokers/:strategyBrokerId', removeBrokerFromStrategy);

// Toggle broker status for a strategy
router.patch('/:strategyId/brokers/:strategyBrokerId/toggle', toggleStrategyBrokerStatus);

export default router;
