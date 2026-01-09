import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { User, Notification } from '../models/index.js';
import { generateToken, generateRefreshToken, verifyToken } from '../utils/jwt.js';
import { emitNotification } from '../config/socket.js';

// Register new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, username } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      email,
      password, // Will be hashed by model hook
      name,
      username
    });

    // Generate tokens
  const token = generateToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id, role: user.role });

    // Notify admin about new user registration
    const adminUser = await User.findOne({ where: { role: 'Admin' } });
    if (adminUser) {
      const adminNotification = await Notification.create({
        userId: adminUser.id,
        type: 'user',
        title: 'New User Registration',
        message: `${name || username || email} has registered on the platform.`,
        metadata: {
          newUserId: user.id,
          newUserEmail: email,
          newUserName: name || username
        },
        isRead: false
      });
      emitNotification(adminUser.id, adminNotification);
    }

    res.status(201).json({
      message: 'User registered successfully',
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
  const token = generateToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id, role: user.role });

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Generate new access token
    const newToken = generateToken({ id: decoded.id, role: decoded.role });

    res.json({ token: newToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// Logout
const logout = async (req, res) => {
  // In a real app, you might blacklist the token
  res.json({ message: 'Logged out successfully' });
};

export {
  register,
  login,
  refreshToken,
  logout
};