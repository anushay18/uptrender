import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  getUserActivity,
  getUserStats,
  getRecentActivityLogs,
  impersonateUser
} from '../controllers/adminUserController.js';
import { idParamValidation, paginationValidation } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Get all users with pagination, search, and filters
router.get('/', paginationValidation, getAllUsers);

// Get user statistics
router.get('/stats', getUserStats);

// Recent activity logs across all users (must be before :id routes)
router.get('/activity/recent', getRecentActivityLogs);

// Get specific user by ID
router.get('/:id', idParamValidation, getUserById);

// Create new user
router.post('/', createUser);

// Update user
router.put('/:id', idParamValidation, updateUser);

// Delete user
router.delete('/:id', idParamValidation, deleteUser);

// Toggle user status (activate/deactivate)
router.put('/:id/toggle-status', idParamValidation, toggleUserStatus);

// Reset user password
router.post('/:id/reset-password', idParamValidation, resetUserPassword);

// Impersonate user (login as user)
router.post('/:id/impersonate', idParamValidation, impersonateUser);

// Get user activity logs
router.get('/:id/activity', idParamValidation, getUserActivity);

export default router;
