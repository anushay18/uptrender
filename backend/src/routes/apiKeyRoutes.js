import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { 
  getUserApiKeys, 
  createApiKey, 
  getApiKeyById, 
  updateApiKey, 
  deleteApiKey,
  verifyApiKey,
  setDefaultApiKey,
  getAllApiKeys,
  refreshBalance,
  testApiConnection
} from '../controllers/apiKeyController.js';

const router = express.Router();

// User API key routes
router.get('/', authenticate, getUserApiKeys);
router.post('/', authenticate, createApiKey);
router.get('/:id', authenticate, getApiKeyById);
router.put('/:id', authenticate, updateApiKey);
router.delete('/:id', authenticate, deleteApiKey);
router.post('/:id/verify', authenticate, verifyApiKey);
router.post('/:id/refresh-balance', authenticate, refreshBalance);
router.post('/:id/set-default', authenticate, setDefaultApiKey);
router.post('/:id/test-connection', authenticate, testApiConnection);

// Admin routes
router.get('/admin/all', authenticate, roleCheck(['Admin']), getAllApiKeys);

export default router;
