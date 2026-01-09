import {
  Trade,
  Strategy,
  ApiKey,
  Plan,
  Wallet,
  SupportTicket,
  Notification,
  sequelize,
} from '../models/index.js';
import { Op } from 'sequelize';

/**
 * User Dashboard Controller
 * Handles all user-specific dashboard data
 */
export const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get counts
    const tradesCount = await Trade.count({ where: { userId } });
    const strategiesCount = await Strategy.count({ where: { userId } });
    const apiKeysCount = await ApiKey.count({ where: { userId } });
    const activeStrategies = await Strategy.count({
      where: { userId, isActive: true },
    });

    // Get wallet balance
    const wallet = await Wallet.findOne({ where: { userId } });
    const walletBalance = wallet ? parseFloat(wallet.balance) || 0 : 0;

    // Get active plan
    const activePlan = await Plan.findOne({
      where: { userId, isActive: true },
    });

    // Get recent trades
    const recentTrades = await Trade.findAll({
      where: { userId },
      limit: 5,
      order: [['createdAt', 'DESC']],
    });

    // Get trade statistics
    const tradeStats = await Trade.findAll({
      where: { userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('pnl')), 'totalPL'],
      ],
      group: ['status'],
      raw: true,
    });

    // Get unread notifications count
    const unreadNotifications = await Notification.count({
      where: { userId, isRead: false },
    });

    // Get open tickets count
    const openTickets = await SupportTicket.count({
      where: { userId, status: { [Op.in]: ['Open', 'In Progress'] } },
    });

    res.json({
      success: true,
      data: {
        counts: {
          trades: tradesCount,
          strategies: strategiesCount,
          apiKeys: apiKeysCount,
          activeStrategies,
          unreadNotifications,
          openTickets,
        },
        wallet: {
          balance: walletBalance,
          currency: wallet?.currency || 'INR',
        },
        plan: activePlan
          ? {
              name: activePlan.name,
              type: activePlan.type,
              startDate: activePlan.startDate,
              endDate: activePlan.endDate,
              price: activePlan.price,
              remainingDays: activePlan.remainingDays,
            }
          : null,
        recentTrades,
        tradeStats: tradeStats.reduce((acc, stat) => {
          acc[stat.status.toLowerCase()] = {
            count: parseInt(stat.count, 10) || 0,
            totalPL: parseFloat(stat.totalPL) || 0,
          };
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};
