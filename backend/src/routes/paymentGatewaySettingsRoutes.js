import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getPaymentGatewaySettings,
  updatePaymentGatewaySettings,
  getActivePaymentGateway,
  testRazorpayConnection,
  uploadUpiQrCode
} from '../controllers/paymentGatewaySettingsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';

const router = express.Router();

// Multer configuration for UPI QR code upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/qr-codes';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upi-qr-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|svg|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, SVG, WEBP) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: fileFilter
});

// Admin routes
router.get('/', authenticate, roleCheck(['Admin']), getPaymentGatewaySettings);
router.put('/', authenticate, roleCheck(['Admin']), updatePaymentGatewaySettings);
router.post('/test-connection', authenticate, roleCheck(['Admin']), testRazorpayConnection);
router.post('/upload-qr-code', authenticate, roleCheck(['Admin']), upload.single('qrCode'), uploadUpiQrCode);

// User route to get active payment gateway
router.get('/active', authenticate, getActivePaymentGateway);

export default router;
