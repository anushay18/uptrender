import { sequelize as db } from '../config/database.js';
import { QueryTypes } from 'sequelize';
import bcrypt from 'bcryptjs';

class AdminFranchiseController {
  // Get all franchises with their statistics
  async getAllFranchises(req, res) {
    try {
      const { page = 1, limit = 10, search = '', status = '' } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE u.isFranchise = 1';
      const replacements = {};

      if (search) {
        whereClause += ' AND (u.name LIKE :search OR u.email LIKE :search OR u.franchiseName LIKE :search)';
        replacements.search = `%${search}%`;
      }

      if (status) {
        whereClause += ' AND u.franchiseStatus = :status';
        replacements.status = status;
      }

      // Get franchises with statistics
      const franchises = await db.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.franchiseId,
          u.franchiseName,
          u.franchiseCommission,
          u.franchiseStatus,
          u.franchiseJoinedDate,
          u.createdAt,
          COALESCE(COUNT(DISTINCT fu.userId), 0) as totalUsers,
          COALESCE(COUNT(DISTINCT CASE WHEN users2.status = 'Active' THEN fu.userId END), 0) as activeUsers,
          COALESCE(COUNT(DISTINCT t.id), 0) as totalTrades,
          COALESCE(SUM(t.amount * t.price), 0) as totalVolume,
          COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN ABS(t.pnl) ELSE 0 END), 0) as totalRevenue
        FROM users u
        LEFT JOIN franchise_users fu ON u.id = fu.franchiseUserId
        LEFT JOIN users users2 ON fu.userId = users2.id
        LEFT JOIN trades t ON fu.userId = t.userId
        ${whereClause}
        GROUP BY u.id
        ORDER BY u.createdAt DESC
        LIMIT :limit OFFSET :offset
      `, {
        replacements: { ...replacements, limit: parseInt(limit), offset: parseInt(offset) },
        type: QueryTypes.SELECT
      });

      // Get total count
      const [{ total }] = await db.query(`
        SELECT COUNT(*) as total
        FROM users u
        ${whereClause}
      `, {
        replacements,
        type: QueryTypes.SELECT
      });

      res.json({
        success: true,
        data: franchises,
        pagination: {
          total: parseInt(total),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get all franchises error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch franchises',
        error: error.message
      });
    }
  }

  // Get single franchise details with statistics
  async getFranchiseById(req, res) {
    try {
      const { id } = req.params;

      const [franchise] = await db.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.username,
          u.franchiseId,
          u.franchiseName,
          u.franchiseCommission,
          u.franchiseStatus,
          u.franchiseJoinedDate,
          u.address1,
          u.address2,
          u.city,
          u.state,
          u.country,
          u.postalCode,
          u.createdAt,
          u.updatedAt
        FROM users u
        WHERE u.id = :id AND u.isFranchise = 1
      `, {
        replacements: { id },
        type: QueryTypes.SELECT
      });

      if (!franchise) {
        return res.status(404).json({
          success: false,
          message: 'Franchise not found'
        });
      }

      // Get franchise users
      const users = await db.query(`
        SELECT 
          fu.id,
          fu.joinedDate,
          fu.status as memberStatus,
          u.id as userId,
          u.name,
          u.email,
          u.phone,
          u.status,
          u.createdAt
        FROM franchise_users fu
        JOIN users u ON fu.userId = u.id
        WHERE fu.franchiseUserId = :id
        ORDER BY fu.joinedDate DESC
      `, {
        replacements: { id },
        type: QueryTypes.SELECT
      });

      // Get trade statistics
      const [tradeStats] = await db.query(`
        SELECT 
          COUNT(DISTINCT t.id) as totalTrades,
          COALESCE(SUM(t.amount * t.price), 0) as totalVolume,
          COALESCE(SUM(CASE WHEN t.status = 'Completed' AND t.pnl > 0 THEN t.pnl ELSE 0 END), 0) as totalProfit,
          COALESCE(SUM(CASE WHEN t.status = 'Completed' AND t.pnl < 0 THEN ABS(t.pnl) ELSE 0 END), 0) as totalLoss,
          COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN ABS(t.pnl) ELSE 0 END), 0) as totalRevenue
        FROM franchise_users fu
        LEFT JOIN trades t ON fu.userId = t.userId
        WHERE fu.franchiseUserId = :id
      `, {
        replacements: { id },
        type: QueryTypes.SELECT
      });

      // Get monthly statistics
      const monthlyStats = await db.query(`
        SELECT 
          DATE_FORMAT(t.createdAt, '%Y-%m') as month,
          COUNT(t.id) as trades,
          COALESCE(SUM(t.amount * t.price), 0) as volume,
          COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN ABS(t.pnl) ELSE 0 END), 0) as revenue
        FROM franchise_users fu
        LEFT JOIN trades t ON fu.userId = t.userId
        WHERE fu.franchiseUserId = :id
        AND t.createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(t.createdAt, '%Y-%m')
        ORDER BY month DESC
        LIMIT 12
      `, {
        replacements: { id },
        type: QueryTypes.SELECT
      });

      res.json({
        success: true,
        data: {
          franchise,
          users,
          statistics: {
            ...tradeStats,
            monthlyStats
          }
        }
      });
    } catch (error) {
      console.error('Get franchise by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch franchise details',
        error: error.message
      });
    }
  }

  // Create new franchise
  async createFranchise(req, res) {
    try {
      const {
        name,
        email,
        phone,
        username,
        password,
        franchiseName,
        franchiseCommission = 0,
        address1,
        address2,
        city,
        state,
        country,
        postalCode
      } = req.body;

      // Validate required fields
      if (!name || !email || !username || !password || !franchiseName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Check if email or username already exists
      const [existingUser] = await db.query(`
        SELECT id FROM users WHERE email = :email OR username = :username
      `, {
        replacements: { email, username },
        type: QueryTypes.SELECT
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email or username already exists'
        });
      }

      // Generate franchise ID
      const franchiseId = `FRN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Hash password (you should use bcrypt in production)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert franchise user
      const [result] = await db.query(`
        INSERT INTO users (
          name, email, phone, username, password, role, isFranchise,
          franchiseId, franchiseName, franchiseCommission, franchiseStatus,
          franchiseJoinedDate, address1, address2, city, state, country, postalCode,
          status, createdAt, updatedAt
        ) VALUES (
          :name, :email, :phone, :username, :password, 'franchise', 1,
          :franchiseId, :franchiseName, :franchiseCommission, 'Active',
          CURDATE(), :address1, :address2, :city, :state, :country, :postalCode,
          'Active', NOW(), NOW()
        )
      `, {
        replacements: {
          name,
          email,
          phone: phone || null,
          username,
          password: hashedPassword,
          franchiseId,
          franchiseName,
          franchiseCommission: franchiseCommission || 0,
          address1: address1 || null,
          address2: address2 || null,
          city: city || null,
          state: state || null,
          country: country || null,
          postalCode: postalCode || null
        },
        type: QueryTypes.INSERT
      });

      res.status(201).json({
        success: true,
        message: 'Franchise created successfully',
        data: {
          id: result,
          franchiseId,
          name,
          email,
          franchiseName
        }
      });
    } catch (error) {
      console.error('Create franchise error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create franchise',
        error: error.message
      });
    }
  }

  // Update franchise
  async updateFranchise(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        email,
        phone,
        franchiseName,
        franchiseCommission,
        franchiseStatus,
        address1,
        address2,
        city,
        state,
        country,
        postalCode
      } = req.body;

      // Check if franchise exists
      const [franchise] = await db.query(`
        SELECT id FROM users WHERE id = :id AND isFranchise = 1
      `, {
        replacements: { id },
        type: QueryTypes.SELECT
      });

      if (!franchise) {
        return res.status(404).json({
          success: false,
          message: 'Franchise not found'
        });
      }

      // Build update query dynamically
      const updates = [];
      const replacements = { id };

      if (name) { updates.push('name = :name'); replacements.name = name; }
      if (email) { updates.push('email = :email'); replacements.email = email; }
      if (phone !== undefined) { updates.push('phone = :phone'); replacements.phone = phone; }
      if (franchiseName) { updates.push('franchiseName = :franchiseName'); replacements.franchiseName = franchiseName; }
      if (franchiseCommission !== undefined) { updates.push('franchiseCommission = :franchiseCommission'); replacements.franchiseCommission = franchiseCommission; }
      if (franchiseStatus) { updates.push('franchiseStatus = :franchiseStatus'); replacements.franchiseStatus = franchiseStatus; }
      if (address1 !== undefined) { updates.push('address1 = :address1'); replacements.address1 = address1; }
      if (address2 !== undefined) { updates.push('address2 = :address2'); replacements.address2 = address2; }
      if (city !== undefined) { updates.push('city = :city'); replacements.city = city; }
      if (state !== undefined) { updates.push('state = :state'); replacements.state = state; }
      if (country !== undefined) { updates.push('country = :country'); replacements.country = country; }
      if (postalCode !== undefined) { updates.push('postalCode = :postalCode'); replacements.postalCode = postalCode; }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      updates.push('updatedAt = NOW()');

      await db.query(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = :id
      `, {
        replacements,
        type: QueryTypes.UPDATE
      });

      res.json({
        success: true,
        message: 'Franchise updated successfully'
      });
    } catch (error) {
      console.error('Update franchise error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update franchise',
        error: error.message
      });
    }
  }

  // Delete franchise
  async deleteFranchise(req, res) {
    try {
      const { id } = req.params;

      // Check if franchise exists
      const [franchise] = await db.query(`
        SELECT id FROM users WHERE id = :id AND isFranchise = 1
      `, {
        replacements: { id },
        type: QueryTypes.SELECT
      });

      if (!franchise) {
        return res.status(404).json({
          success: false,
          message: 'Franchise not found'
        });
      }

      // Delete franchise (cascade will handle related records)
      await db.query(`
        DELETE FROM users WHERE id = :id
      `, {
        replacements: { id },
        type: QueryTypes.DELETE
      });

      res.json({
        success: true,
        message: 'Franchise deleted successfully'
      });
    } catch (error) {
      console.error('Delete franchise error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete franchise',
        error: error.message
      });
    }
  }

  // Add user to franchise
  async addUserToFranchise(req, res) {
    try {
      const { franchiseId, userId } = req.body;

      if (!franchiseId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Franchise ID and User ID are required'
        });
      }

      // Check if franchise exists
      const [franchise] = await db.query(`
        SELECT id FROM users WHERE id = :franchiseId AND isFranchise = 1
      `, {
        replacements: { franchiseId },
        type: QueryTypes.SELECT
      });

      if (!franchise) {
        return res.status(404).json({
          success: false,
          message: 'Franchise not found'
        });
      }

      // Check if user exists
      const [user] = await db.query(`
        SELECT id FROM users WHERE id = :userId AND role = 'user'
      `, {
        replacements: { userId },
        type: QueryTypes.SELECT
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Add user to franchise
      await db.query(`
        INSERT INTO franchise_users (franchiseUserId, userId, joinedDate, status, createdAt, updatedAt)
        VALUES (:franchiseId, :userId, CURDATE(), 'Active', NOW(), NOW())
        ON DUPLICATE KEY UPDATE status = 'Active', updatedAt = NOW()
      `, {
        replacements: { franchiseId, userId },
        type: QueryTypes.INSERT
      });

      res.json({
        success: true,
        message: 'User added to franchise successfully'
      });
    } catch (error) {
      console.error('Add user to franchise error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add user to franchise',
        error: error.message
      });
    }
  }

  // Remove user from franchise
  async removeUserFromFranchise(req, res) {
    try {
      const { franchiseId, userId } = req.params;

      await db.query(`
        DELETE FROM franchise_users
        WHERE franchiseUserId = :franchiseId AND userId = :userId
      `, {
        replacements: { franchiseId, userId },
        type: QueryTypes.DELETE
      });

      res.json({
        success: true,
        message: 'User removed from franchise successfully'
      });
    } catch (error) {
      console.error('Remove user from franchise error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove user from franchise',
        error: error.message
      });
    }
  }

  // Get franchise dashboard statistics
  async getFranchiseDashboardStats(req, res) {
    try {
      const franchiseId = req.user.id; // Assuming franchise user is logged in

      // Get overall statistics
      const [stats] = await db.query(`
        SELECT 
          COUNT(DISTINCT fu.userId) as totalUsers,
          COUNT(DISTINCT CASE WHEN u.status = 'Active' THEN fu.userId END) as activeUsers,
          COUNT(DISTINCT t.id) as totalTrades,
          COALESCE(SUM(t.amount * t.price), 0) as totalVolume,
          COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN ABS(t.pnl) ELSE 0 END), 0) as totalRevenue,
          COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN ABS(t.pnl) * (SELECT franchiseCommission FROM users WHERE id = :franchiseId) / 100 ELSE 0 END), 0) as totalCommission
        FROM franchise_users fu
        LEFT JOIN users u ON fu.userId = u.id
        LEFT JOIN trades t ON fu.userId = t.userId
        WHERE fu.franchiseUserId = :franchiseId
      `, {
        replacements: { franchiseId },
        type: QueryTypes.SELECT
      });

      // Get recent users
      const recentUsers = await db.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.status,
          fu.joinedDate
        FROM franchise_users fu
        JOIN users u ON fu.userId = u.id
        WHERE fu.franchiseUserId = :franchiseId
        ORDER BY fu.joinedDate DESC
        LIMIT 10
      `, {
        replacements: { franchiseId },
        type: QueryTypes.SELECT
      });

      res.json({
        success: true,
        data: {
          statistics: stats,
          recentUsers
        }
      });
    } catch (error) {
      console.error('Get franchise dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
        error: error.message
      });
    }
  }
}

export default new AdminFranchiseController();
