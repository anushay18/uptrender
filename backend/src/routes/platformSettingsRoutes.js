import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getPlatformSettings,
  updatePlatformSettings,
  uploadLogo,
  removeLogo
} from '../controllers/platformSettingsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';

const router = express.Router();

// Ensure logos directory exists
const logosDir = path.join(process.cwd(), 'uploads', 'logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
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

// Public route - get platform settings (no auth required)
router.get('/', getPlatformSettings);

// Admin routes
router.put('/', authenticate, roleCheck(['Admin']), updatePlatformSettings);
router.post('/upload-logo', authenticate, roleCheck(['Admin']), upload.single('logo'), uploadLogo);
router.delete('/remove-logo', authenticate, roleCheck(['Admin']), removeLogo);

export default router;
