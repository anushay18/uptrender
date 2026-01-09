import express from 'express';
import { getUserDashboard } from '../controllers/userDashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// User dashboard route
router.get('/', authenticate, getUserDashboard);

export default router;
