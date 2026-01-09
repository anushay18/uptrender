import express from 'express';
import adminFranchiseController from '../controllers/adminFranchiseController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Franchise CRUD routes
router.get('/franchises', adminFranchiseController.getAllFranchises);
router.get('/franchises/:id', adminFranchiseController.getFranchiseById);
router.post('/franchises', adminFranchiseController.createFranchise);
router.put('/franchises/:id', adminFranchiseController.updateFranchise);
router.delete('/franchises/:id', adminFranchiseController.deleteFranchise);

// Franchise user management
router.post('/franchises/users', adminFranchiseController.addUserToFranchise);
router.delete('/franchises/:franchiseId/users/:userId', adminFranchiseController.removeUserFromFranchise);

// Franchise dashboard (for franchise users)
router.get('/franchise/dashboard', adminFranchiseController.getFranchiseDashboardStats);

export default router;
