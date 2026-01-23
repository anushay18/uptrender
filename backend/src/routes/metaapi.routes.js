import express from 'express';
import metaApiRateLimiter from '../utils/MetaApiRateLimiter.js';
import mt5BrokerPool from '../utils/mt5BrokerPool.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Get MetaAPI rate limiter status (admin only)
 * GET /api/metaapi/status
 */
router.get('/status', authenticate, (req, res) => {
  try {
    // Only allow admins to view this
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const rateLimiterStatus = metaApiRateLimiter.getStatus();
    const poolStats = mt5BrokerPool.getStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      rateLimiter: rateLimiterStatus,
      connectionPool: poolStats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get MetaAPI status',
      message: error.message
    });
  }
});

/**
 * Reset rate limiter (admin only, emergency use)
 * POST /api/metaapi/reset
 */
router.post('/reset', authenticate, (req, res) => {
  try {
    // Only allow admins
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    metaApiRateLimiter.reset();

    res.json({
      success: true,
      message: 'MetaAPI rate limiter reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset rate limiter',
      message: error.message
    });
  }
});

export default router;
