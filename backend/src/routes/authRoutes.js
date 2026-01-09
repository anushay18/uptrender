import express from 'express';
import { register, login, refreshToken, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation } from '../middleware/validation.js';

const router = express.Router();

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logout);

export default router;