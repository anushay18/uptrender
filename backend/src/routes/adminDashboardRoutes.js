import express from 'express';
import { getAdminDashboard } from '../controllers/adminDashboardController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin role
router.get('/', authenticate, authorize('admin'), getAdminDashboard);

export default router;
