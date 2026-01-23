import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import {
  getSignalLogs,
  createSignalLog,
  getSignalLogStats
} from '../controllers/signalLogController.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(roleCheck(['Admin']));

// Get signal logs with pagination and filters
router.get('/', getSignalLogs);

// Get signal log stats
router.get('/stats', getSignalLogStats);

// Create signal log (can be called when sending signals)
router.post('/', createSignalLog);

export default router;
