import { sequelize, Strategy, Trade, User } from '../models/index.js';

// Serve aggregate platform statistics for the marketing/public dashboard
export const getPlatformStats = async (req, res) => {
  try {
    const [totalUsers, totalStrategies, totalTrades, plStats] = await Promise.all([
      User.count({ where: { status: 'Active' } }),
      Strategy.count({ where: { isPublic: true } }),
      Trade.count(),
      Trade.findOne({
        attributes: [[sequelize.fn('SUM', sequelize.col('profitLoss')), 'totalPL']],
      }),
    ]);

    res.json({
      success: true,
      data: {
        users: totalUsers,
        strategies: totalStrategies,
        trades: totalTrades,
        totalProfitLoss: Number(plStats?.get('totalPL') || 0),
      },
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
};
