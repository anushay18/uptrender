import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { 
  getUserNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  deleteAllRead,
  createNotification,
  broadcastNotification,
  getAllNotifications
} from '../controllers/notificationController.js';
import { 
  createNotificationValidation, 
  broadcastNotificationValidation, 
  idParamValidation,
  paginationValidation
} from '../middleware/validation.js';

const router = express.Router();

// User notification routes
router.get('/', authenticate, paginationValidation, getUserNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.post('/:id/read', authenticate, idParamValidation, markAsRead);
router.post('/mark-all-read', authenticate, markAllAsRead);
router.delete('/:id', authenticate, idParamValidation, deleteNotification);
router.delete('/clear-read', authenticate, deleteAllRead);

// Admin routes
router.post('/admin/create', authenticate, roleCheck(['Admin']), createNotificationValidation, createNotification);
router.post('/admin/broadcast', authenticate, roleCheck(['Admin']), broadcastNotificationValidation, broadcastNotification);
router.get('/admin/all', authenticate, roleCheck(['Admin']), paginationValidation, getAllNotifications);

export default router;
