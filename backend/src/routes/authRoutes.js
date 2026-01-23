import express from 'express';
import { register, login, refreshToken, logout, googleLogin } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation } from '../middleware/validation.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Routes with rate limiting for security
router.post('/register', registerLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/google', authLimiter, googleLogin); // Google OAuth login
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logout);

export default router;