import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { 
  getUserPlan, 
  getAvailablePlans, 
  subscribeToPlan, 
  cancelUserPlan, 
  toggleAutoRenew,
  getAllPlans,
  createPlanCatalog,
  updatePlanCatalog,
  deletePlanCatalog
} from '../controllers/planController.js';
import { 
  subscribeToPlanValidation, 
  createPlanCatalogValidation, 
  idParamValidation,
  paginationValidation
} from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.get('/available', paginationValidation, getAvailablePlans);
router.get('/catalog', async (req, res) => {
  try {
    // Import AdminPlan model
    const { default: AdminPlan } = await import('../models/AdminPlan.js');
    
    const plans = await AdminPlan.getActivePublicPlans();
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Get plan catalog error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plan catalog'
    });
  }
});

// User plan routes
router.get('/my-plan', authenticate, getUserPlan);
router.get('/current', authenticate, getUserPlan); // Alias for my-plan
router.post('/subscribe', authenticate, subscribeToPlanValidation, subscribeToPlan);
router.post('/cancel', authenticate, cancelUserPlan);
router.post('/toggle-auto-renew', authenticate, toggleAutoRenew);

// Admin routes
router.get('/admin/all', authenticate, roleCheck(['Admin']), paginationValidation, getAllPlans);
router.post('/admin/catalog', authenticate, roleCheck(['Admin']), createPlanCatalogValidation, createPlanCatalog);
router.put('/admin/catalog/:id', authenticate, roleCheck(['Admin']), idParamValidation, createPlanCatalogValidation, updatePlanCatalog);
router.delete('/admin/catalog/:id', authenticate, roleCheck(['Admin']), idParamValidation, deletePlanCatalog);

export default router;
