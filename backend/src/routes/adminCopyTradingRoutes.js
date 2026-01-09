import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { getAllCopyTradingUsers } from '../controllers/adminCopyTradingController.js';
import { paginationValidation } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(roleCheck(['Admin']));

// GET /api/admin/copy-trading/users
router.get('/users', paginationValidation, getAllCopyTradingUsers);

export default router;
