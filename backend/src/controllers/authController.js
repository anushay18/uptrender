import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { emitNotification } from '../config/socket.js';
import { Notification, User } from '../models/index.js';
import emailNotificationHelper from '../utils/emailNotificationHelper.js';
import { generateRefreshToken, generateToken, verifyToken } from '../utils/jwt.js';

// Register new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return res.status(400).json({ error: firstError.msg || 'Please fill all required fields correctly' });
    }

    const { email, password, name, username } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
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

    // Send welcome email (async, don't wait)
    emailNotificationHelper.notifyWelcome(user.id, email, name || username || 'User').catch(err =>
      console.log('[Email] Welcome email failed:', err.message)
    );

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
    res.status(500).json({ error: 'Registration failed. Please try again later' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Please enter valid email and password' });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email address' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect password. Please try again' });
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
    res.status(500).json({ error: 'Unable to login. Please try again later' });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Session expired. Please login again' });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Generate new access token
    const newToken = generateToken({ id: decoded.id, role: decoded.role });

    res.json({ token: newToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Session expired. Please login again' });
  }
};

// Logout
const logout = async (req, res) => {
  // In a real app, you might blacklist the token
  res.json({ message: 'Logged out successfully' });
};

// Google OAuth Login
const googleLogin = async (req, res) => {
  try {
    const { email, name, googleId, avatar } = req.body.credential || req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google login' });
    }

    // Check if user exists
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create new user with Google details
      let baseUsername = email.split('@')[0];
      let username = baseUsername;
      
      // Ensure username is unique by adding random suffix if needed
      let existingUser = await User.findOne({ where: { username } });
      let attempts = 0;
      while (existingUser && attempts < 10) {
        username = `${baseUsername}_${Math.floor(Math.random() * 10000)}`;
        existingUser = await User.findOne({ where: { username } });
        attempts++;
      }
      
      user = await User.create({
        email,
        name: name || baseUsername,
        username,
        password: googleId || `google_${Date.now()}`, // Random password for Google users
        avatar: avatar || null,
        googleId: googleId || null,
        isActive: true,
        role: 'User'
      });

      // Notify admin about new user registration
      const adminUser = await User.findOne({ where: { role: 'Admin' } });
      if (adminUser) {
        const adminNotification = await Notification.create({
          userId: adminUser.id,
          type: 'user',
          title: 'New User Registration via Google',
          message: `${name || baseUsername} has registered via Google.`,
          metadata: {
            newUserId: user.id,
            newUserEmail: email,
            newUserName: name || baseUsername
          },
          isRead: false
        });
        emitNotification(adminUser.id, adminNotification);
      }

      // Send welcome email (async, don't wait)
      emailNotificationHelper.notifyWelcome(user.id, email, name || baseUsername).catch(err =>
        console.log('[Email] Welcome email failed:', err.message)
      );
    } else {
      // Update existing user's Google info if not set
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        await user.save();
      }
      if (!user.avatar && avatar) {
        user.avatar = avatar;
        await user.save();
      }
    }

    // Generate tokens
    const token = generateToken({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, role: user.role });

    res.json({
      message: 'Google login successful',
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Google login failed. Please try again later' });
  }
};

export {
    googleLogin, login, logout, refreshToken, register
};
