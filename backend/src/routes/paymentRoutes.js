import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  submitUpiPayment,
  submitCryptoPayment,
  approvePendingPayment,
  rejectPendingPayment,
  getPendingPayments,
  getAllPaymentTransactions,
  razorpayWebhook,
  verifyCryptoTransaction,
  submitAndVerifyCryptoPayment
} from '../controllers/paymentController.js';

const router = express.Router();

// Razorpay webhook (no authentication - Razorpay calls this)
// This route receives webhook events from Razorpay with signature verification
router.post('/razorpay-webhook', razorpayWebhook);

// User payment routes
router.post('/razorpay/create-order', authenticate, createRazorpayOrder);
router.post('/razorpay/verify', authenticate, verifyRazorpayPayment);
router.post('/upi/submit', authenticate, submitUpiPayment);
router.post('/crypto/submit', authenticate, submitCryptoPayment);

// MetaMask/Crypto blockchain verification routes
router.post('/crypto/verify', authenticate, verifyCryptoTransaction);
router.post('/crypto/submit-with-verify', authenticate, submitAndVerifyCryptoPayment);

// Admin routes for payment management
router.get('/admin/pending', authenticate, roleCheck(['Admin']), getPendingPayments);
router.get('/admin/all-transactions', authenticate, roleCheck(['Admin']), getAllPaymentTransactions);
router.post('/admin/:transactionId/approve', authenticate, roleCheck(['Admin']), approvePendingPayment);
router.post('/admin/:transactionId/reject', authenticate, roleCheck(['Admin']), rejectPendingPayment);

export default router;
