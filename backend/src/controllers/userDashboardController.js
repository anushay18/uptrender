import {
  Trade,
  Strategy,
  ApiKey,
  Plan,
  Wallet,
  SupportTicket,
  Notification,
  PaperPosition,
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

    // Get today's date range (start of day to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayFilter = { [Op.gte]: today };

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

    // Get trade statistics from both trades and paper positions (TODAY ONLY)
    const tradeStats = await Trade.findAll({
      where: { 
        userId, 
        broker: { [Op.ne]: 'PAPER' },
        createdAt: todayFilter
      },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('pnl')), 'totalPL'],
      ],
      group: ['status'],
      raw: true,
    });

    // Get paper position statistics (TODAY ONLY)
    const paperStats = await PaperPosition.findAll({
      where: { 
        userId,
        createdAt: todayFilter
      },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('realizedProfit')), 'totalPL'],
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
        tradeStats: (() => {
          // Combine trade stats and paper stats
          const combined = {};
          
          // Process live trade stats
          tradeStats.forEach(stat => {
            const key = stat.status.toLowerCase();
            combined[key] = {
              count: parseInt(stat.count, 10) || 0,
              totalPL: parseFloat(stat.totalPL) || 0,
            };
          });
          
          // Process paper position stats (map Closed->completed, Open->open)
          paperStats.forEach(stat => {
            const originalKey = stat.status;
            const key = originalKey === 'Closed' ? 'completed' : originalKey.toLowerCase();
            
            if (!combined[key]) {
              combined[key] = { count: 0, totalPL: 0 };
            }
            combined[key].count += parseInt(stat.count, 10) || 0;
            combined[key].totalPL += parseFloat(stat.totalPL) || 0;
          });
          
          return combined;
        })(),
      },
    });
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({ error: 'Unable to load dashboard. Please refresh the page' });
  }
};
