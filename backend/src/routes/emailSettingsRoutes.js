import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  getEmailSettings,
  updateEmailSettings,
  testEmailConnection,
  sendTestEmail,
} from '../controllers/emailSettingsController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get email settings
router.get('/', getEmailSettings);

// Update email settings
router.put('/', updateEmailSettings);

// Test SMTP connection
router.post('/test-connection', testEmailConnection);

// Send test email
router.post('/send-test', sendTestEmail);

export default router;
