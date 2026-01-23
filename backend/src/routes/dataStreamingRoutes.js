/**
 * Data Streaming Routes
 * 
 * Admin-only routes for managing centralized data streaming.
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getStreamingSettings,
  updateStreamingSettings,
  startStreaming,
  stopStreaming,
  restartStreaming,
  getStreamingStatus,
  testConnection,
  addSymbol,
  removeSymbol,
  getPrice,
  getAllPrices
} from '../controllers/dataStreamingController.js';

const router = express.Router();

// Middleware to require admin role
const requireAdmin = authorize('admin');

// All routes require authentication
router.use(authenticate);

// Admin-only routes for settings management
router.get('/settings', requireAdmin, getStreamingSettings);
router.put('/settings', requireAdmin, updateStreamingSettings);

// Streaming control (admin only)
router.post('/start', requireAdmin, startStreaming);
router.post('/stop', requireAdmin, stopStreaming);
router.post('/restart', requireAdmin, restartStreaming);
router.post('/test-connection', requireAdmin, testConnection);

// Symbol management (admin only)
router.post('/symbols', requireAdmin, addSymbol);
router.delete('/symbols/:symbol', requireAdmin, removeSymbol);

// Status and prices (authenticated users can access)
router.get('/status', getStreamingStatus);
router.get('/prices', getAllPrices);
router.get('/prices/:symbol', getPrice);

export default router;
