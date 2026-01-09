import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { getPlatformStats } from '../controllers/dashboardController.js';
import { getUserDashboard } from '../controllers/userDashboardController.js';
import { getAdminDashboard } from '../controllers/adminDashboardController.js';

const router = express.Router();

// Public routes
router.get('/stats', getPlatformStats);

// User dashboard
router.get('/', authenticate, getUserDashboard);

// Admin dashboard
router.get('/admin', authenticate, roleCheck(['Admin']), getAdminDashboard);

export default router;