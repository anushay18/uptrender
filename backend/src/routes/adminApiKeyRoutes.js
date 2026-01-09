import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllApiKeys,
  getApiKeyById,
  updateApiKey,
  deleteApiKey,
  getApiKeyStats,
  toggleApiKeyStatus
} from '../controllers/adminApiKeyController.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Get all API keys with filters
router.get('/', getAllApiKeys);

// Get API key statistics
router.get('/stats', getApiKeyStats);

// Get API key by ID
router.get('/:id', getApiKeyById);

// Update API key
router.put('/:id', updateApiKey);

// Delete API key
router.delete('/:id', deleteApiKey);

// Toggle API key status/verification
router.post('/:id/toggle-status', toggleApiKeyStatus);

export default router;
