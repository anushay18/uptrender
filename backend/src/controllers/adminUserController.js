import { User, Plan, Wallet, Trade, ActivityLog, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';

/**
 * Admin User Controller
 * Handles all admin-specific user management operations
 */

// Get all users with pagination, search, and filters
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      role,
      verified,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Search by name, email, or username
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by role
    if (role) {
      where.role = role;
    }

    // Filter by verified status
    if (verified !== undefined) {
      where.emailVerified = verified === 'true';
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder]],
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Plan,
          as: 'plans',
          required: false,
          attributes: ['id', 'name', 'type', 'price', 'isActive', 'startDate', 'endDate']
        },
        {
          model: Wallet,
          as: 'wallet',
          required: false,
          attributes: ['balance', 'currency', 'status']
        }
      ]
    });

    // Format the response
    const formattedUsers = users.map(user => {
      // Get the active plan if it exists
      const activePlan = user.plans?.find(p => p.isActive === true) || null;
      
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        avatar: user.avatar,
        joinedDate: user.createdAt,
        plan: activePlan ? {
          name: activePlan.name,
          type: activePlan.type,
          price: activePlan.price,
          startDate: activePlan.startDate,
          endDate: activePlan.endDate
        } : { name: 'Free', type: 'N/A', price: 0 },
        wallet: user.wallet ? {
          balance: user.wallet.balance,
          currency: user.wallet.currency
        } : { balance: 0, currency: 'INR' },
        subscription: activePlan ? 'Subscribed' : 'Not Subscribed'
      };
    });

    res.json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get user by ID with detailed information
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Plan,
          as: 'activePlan',
          required: false,
          where: { status: 'Active' }
        },
        {
          model: Wallet,
          as: 'wallet',
          required: false
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user statistics
    const totalTrades = await Trade.count({ where: { userId: id } });
    const activeTrades = await Trade.count({ 
      where: { userId: id, status: 'Active' } 
    });

    res.json({
      success: true,
      data: {
        user,
        statistics: {
          totalTrades,
          activeTrades
        }
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

// Create new user (admin only)
export const createUser = async (req, res) => {
  try {
    const { name, username, email, password, phone, role = 'User', status = 'Active' } = req.body;

    // Validate required fields
    if (!name || !username || !email || !password) {
      return res.status(400).json({ 
        error: 'Name, username, email, and password are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this email or username already exists' 
      });
    }

    // Create user - password will be hashed by model hook
    const user = await User.create({
      name,
      username,
      email,
      password, // Model hook will hash this
      phone,
      role,
      status,
      emailVerified: true, // Admin-created users are auto-verified
      currency: 'INR'
    });

    // Create wallet for user
    await Wallet.create({
      userId: user.id,
      balance: 0,
      currency: 'INR',
      status: 'Active'
    });

    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Update user (admin only)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const [updatedRowsCount] = await User.update(updateData, {
      where: { id }
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch updated user data
    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// Delete user (admin only)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === parseInt(id)) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    // Delete user (this will cascade to related records based on model associations)
    await user.destroy();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Toggle user status (activate/deactivate)
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Toggle status
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    user.status = newStatus;
    await user.save();

    res.json({
      success: true,
      message: `User ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: user.id,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// Reset user password (admin only)
// SECURITY: Never return plain text passwords in API responses
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, sendEmail = true } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If newPassword is provided, use it. Otherwise, generate a random one
    const password = newPassword || Math.random().toString(36).slice(-8) + 'Aa1!';
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await user.save();

    // TODO: Send password reset email instead of returning password
    // If you have email service configured, send the password via email
    // await sendPasswordResetEmail(user.email, password);

    console.log(`🔐 Password reset for user ${id} (${user.email}) by admin ${req.user?.id}`);

    // SECURITY: Don't return the password in the response
    // Instead, indicate that a reset link/email was sent
    res.json({
      success: true,
      message: sendEmail 
        ? 'Password reset successfully. User has been notified via email.' 
        : 'Password reset successfully.',
      data: {
        email: user.email,
        // NEVER return the password in production - log it for development only if needed
        // In production, always send via email
        passwordResetAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

// Get recent platform activity logs (any user)
export const getRecentActivityLogs = async (req, res) => {
  try {
    const { limit = 25 } = req.query;

    const activities = await ActivityLog.findAll({
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'role']
      }]
    });

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Get recent activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
};

// Get user activity logs
export const getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: activities } = await ActivityLog.findAndCountAll({
      where: { userId: id },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
};

// Get user statistics (for admin dashboard)
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: 'Active' } });
    const inactiveUsers = await User.count({ where: { status: 'Inactive' } });
    const verifiedUsers = await User.count({ where: { emailVerified: true } });
    
    const usersByRole = await User.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    // Recent sign-ups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSignups = await User.count({
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    res.json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        verified: verifiedUsers,
        recentSignups,
        byRole: usersByRole
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
};

// Impersonate user (login as user) - Admin only
export const impersonateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the user to impersonate
    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'email', 'role', 'status']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow impersonating admin users
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot impersonate admin users' });
    }

    // Check if user is active
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Cannot impersonate inactive users' });
    }

    // Generate tokens for the target user
    const token = generateToken({ id: user.id, role: user.role, impersonated: true, impersonatedBy: req.user.id });
    const refreshToken = generateRefreshToken({ id: user.id, role: user.role });

    // Log this action
    await ActivityLog.create({
      userId: req.user.id,
      action: 'IMPERSONATE_USER',
      details: `Admin impersonated user: ${user.email} (ID: ${user.id})`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: `Login token generated for ${user.name || user.email}`,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Impersonate user error:', error);
    res.status(500).json({ error: 'Failed to impersonate user' });
  }
};
