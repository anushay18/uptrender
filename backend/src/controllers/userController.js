import { User } from '../models/index.js';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import crypto from 'crypto';

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: {
        exclude: ['password'] // Don't send password in response
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Format the response to match frontend expectations
    const profileData = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      status: user.status,
      currency: user.currency,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      password: '********', // Mask password
      passwordChangedAt: user.passwordChangedAt || null,
      referralCode: user.referralCode || '',
      referralLink: user.referralLink || '',
      referredBy: user.referredBy || '',
      joinedBy: user.joinedBy ? user.joinedBy.toISOString().split('T')[0] : '',
      clientId: user.clientId || '',
      clientType: user.clientType,
      organizationName: user.organizationName || '',
      incorporationNumber: user.incorporationNumber || '',
      taxId: user.taxId || '',
      gstNumber: user.gstNumber || '',
      panNumber: user.panNumber || '',
      address1: user.address1 || '',
      address2: user.address2 || '',
      city: user.city || '',
      state: user.state || '',
      country: user.country || '',
      postalCode: user.postalCode || '',
      contactPhone: user.contactPhone || '',
      contactEmail: user.contactEmail || '',
      kycStatus: user.kycStatus,
      kycLevel: user.kycLevel || '',
      documents: user.documents || '',
      verified: user.verified,
      avatar: user.avatar || '',
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      data: profileData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Unable to load your profile. Please refresh the page' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Find and update user
    const [updatedRowsCount] = await User.update(updateData, {
      where: { id: userId }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch updated user data
    const updatedUser = await User.findByPk(userId, {
      attributes: {
        exclude: ['password']
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Unable to update your profile. Please try again' });
  }
};

// Upload avatar
const uploadAvatarController = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Generate avatar URL (relative path from uploads directory)
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update user avatar in database
    await User.update(
      { avatar: avatarUrl },
      { where: { id: userId } }
    );

    // Get updated user data
    const updatedUser = await User.findByPk(userId, {
      attributes: {
        exclude: ['password']
      }
    });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatarUrl: avatarUrl,
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    
    // Clean up uploaded file if database update fails
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Unable to upload avatar. Please try a smaller image'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get user with password
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and passwordChangedAt timestamp
    await User.update(
      { 
        password: hashedPassword,
        passwordChangedAt: new Date()
      },
      { where: { id: userId } }
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Unable to change password. Please try again' });
  }
};

// Get user's webhook secret
const getWebhookSecret = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'webhookSecret']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new secret if not exists
    if (!user.webhookSecret) {
      const newSecret = crypto.randomBytes(32).toString('hex');
      await user.update({ webhookSecret: newSecret });
      return res.json({
        success: true,
        webhookSecret: newSecret,
        message: 'New webhook secret generated'
      });
    }

    res.json({
      success: true,
      webhookSecret: user.webhookSecret
    });
  } catch (error) {
    console.error('Get webhook secret error:', error);
    res.status(500).json({ error: 'Unable to retrieve webhook secret. Please try again' });
  }
};

// Regenerate webhook secret
const regenerateWebhookSecret = async (req, res) => {
  try {
    const userId = req.user.id;

    const newSecret = crypto.randomBytes(32).toString('hex');
    
    await User.update(
      { webhookSecret: newSecret },
      { where: { id: userId } }
    );

    res.json({
      success: true,
      webhookSecret: newSecret,
      message: 'Webhook secret regenerated successfully'
    });
  } catch (error) {
    console.error('Regenerate webhook secret error:', error);
    res.status(500).json({ error: 'Unable to regenerate webhook secret. Please try again' });
  }
};

export {
  getProfile,
  updateProfile,
  uploadAvatarController as uploadAvatar,
  changePassword,
  getWebhookSecret,
  regenerateWebhookSecret
};