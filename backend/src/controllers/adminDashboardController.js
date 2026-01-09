import {
  User,
  Trade,
  Strategy,
  Plan,
  Wallet,
  SupportTicket,
  sequelize,
} from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Admin Dashboard Controller
 * Handles all admin-specific dashboard data
 */
export const getAdminDashboard = async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: 'Active' } });
    const verifiedUsers = await User.count({ where: { emailVerified: true } });

    const usersByRole = await User.findAll({
      attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['role'],
    });

    // Get trade statistics
    const totalTrades = await Trade.count();
    const tradesByStatus = await Trade.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('pnl')), 'totalPL'],
      ],
      group: ['status'],
    });

    // Get strategy statistics
    const totalStrategies = await Strategy.count();
    const activeStrategies = await Strategy.count({ where: { isActive: true } });
    const runningStrategies = await Strategy.count({ where: { isRunning: true } });
    const publicStrategies = await Strategy.count({ where: { isPublic: true } });

    // Get plan statistics
    const planStats = await Plan.findAll({
      where: { isActive: true },
      attributes: ['type', 'price'],
    });

    const plansByType = planStats.reduce((acc, plan) => {
      const type = plan.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Get wallet statistics
    const totalBalance = (await Wallet.sum('balance')) || 0;
    const activeWallets = await Wallet.count({ where: { status: 'Active' } });

    // Get support ticket statistics
    const totalTickets = await SupportTicket.count();
    const ticketsByStatus = await SupportTicket.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
    });

    const ticketsByPriority = await SupportTicket.findAll({
      where: { status: { [Op.in]: ['Open', 'In Progress'] } },
      attributes: ['priority', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['priority'],
    });

    // Get recent activity
    const recentUsers = await User.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'role', 'createdAt'],
    });

    const recentTrades = await Trade.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'username'],
        },
      ],
    });

    // Revenue estimation (from active plans)
    const monthlyRevenue = planStats.reduce((sum, plan) => {
      const price = parseFloat(plan.price || 0);
      if (plan.type === 'Monthly') {
        return sum + price;
      }
      if (plan.type === 'Yearly') {
        return sum + price / 12;
      }
      return sum;
    }, 0);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          verified: verifiedUsers,
          byRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = parseInt(item.dataValues.count, 10);
            return acc;
          }, {}),
        },
        trades: {
          total: totalTrades,
          byStatus: tradesByStatus.reduce((acc, stat) => {
            acc[stat.status.toLowerCase()] = {
              count: parseInt(stat.dataValues.count, 10),
              totalPL: parseFloat(stat.dataValues.totalPL) || 0,
            };
            return acc;
          }, {}),
        },
        strategies: {
          total: totalStrategies,
          active: activeStrategies,
          running: runningStrategies,
          public: publicStrategies,
        },
        plans: {
          active: planStats.length,
          byType: plansByType,
          estimatedMonthlyRevenue: monthlyRevenue.toFixed(2),
        },
        wallets: {
          total: activeWallets,
          totalBalance: totalBalance.toFixed(2),
        },
        support: {
          total: totalTickets,
          byStatus: ticketsByStatus.reduce((acc, item) => {
            acc[item.status.toLowerCase()] = parseInt(item.dataValues.count, 10);
            return acc;
          }, {}),
          byPriority: ticketsByPriority.reduce((acc, item) => {
            acc[item.priority.toLowerCase()] = parseInt(item.dataValues.count, 10);
            return acc;
          }, {}),
        },
        recentActivity: {
          users: recentUsers,
          trades: recentTrades,
        },
      },
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch admin dashboard data' });
  }
};
