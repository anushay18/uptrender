import express from 'express';
import adminPlanController from '../controllers/adminPlanController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';

const router = express.Router();

// Public routes (for user pricing page)
router.get('/public', adminPlanController.getPublicPlans);

// Admin routes (require authentication and admin role)
router.use(authenticate);
router.use(roleCheck(['Admin']));

// Admin plan management routes
router.get('/', adminPlanController.getPlans);
router.get('/stats', adminPlanController.getPlanStats);
router.get('/:id', adminPlanController.getPlanById);
router.post('/', adminPlanController.createPlan);
router.put('/:id', adminPlanController.updatePlan);
router.delete('/:id', adminPlanController.deletePlan);
router.patch('/:id/toggle-status', adminPlanController.togglePlanStatus);
router.patch('/bulk-update', adminPlanController.bulkUpdatePlans);

export default router;