import { Strategy, User, StrategySubscription, sequelize } from '../models/index.js';
import { Op } from 'sequelize';

// Get all strategies (Admin)
export const getAllStrategies = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      segment, 
      isActive, 
      isPublic,
      isRunning,
      sort = '-createdAt' 
    } = req.query;

    const where = {};
    
    // Filters
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { symbol: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (segment) {
      where.segment = segment;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }
    
    if (isRunning !== undefined) {
      where.isRunning = isRunning === 'true';
    }

    // Sorting
    const order = [];
    if (sort.startsWith('-')) {
      order.push([sort.slice(1), 'DESC']);
    } else {
      order.push([sort, 'ASC']);
    }

    const offset = (page - 1) * limit;

    const strategies = await Strategy.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'username']
      }]
    });

    res.json({
      success: true,
      data: {
        strategies: strategies.rows,
        total: strategies.count,
        page: parseInt(page),
        pages: Math.ceil(strategies.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all strategies error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch strategies',
      error: error.message 
    });
  }
};

// Get strategy by ID (Admin)
export const getStrategyById = async (req, res) => {
  try {
    const { id } = req.params;

    const strategy = await Strategy.findByPk(id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'username', 'phone']
      }]
    });

    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        message: 'Strategy not found' 
      });
    }

    res.json({
      success: true,
      data: strategy
    });
  } catch (error) {
    console.error('Get strategy by ID error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch strategy',
      error: error.message 
    });
  }
};

// Update strategy (Admin)
export const updateStrategy = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      segment, 
      capital, 
      symbol, 
      symbolValue, 
      legs, 
      description, 
      type,
      isActive,
      isPublic,
      isRunning
    } = req.body;

    const strategy = await Strategy.findByPk(id);

    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        message: 'Strategy not found' 
      });
    }

    // Update fields
    if (name !== undefined) strategy.name = name;
    if (segment !== undefined) strategy.segment = segment;
    if (capital !== undefined) strategy.capital = capital;
    if (symbol !== undefined) strategy.symbol = symbol;
    if (symbolValue !== undefined) strategy.symbolValue = symbolValue;
    if (legs !== undefined) strategy.legs = legs;
    if (description !== undefined) strategy.description = description;
    if (type !== undefined) strategy.type = type;
    if (isActive !== undefined) strategy.isActive = isActive;
    if (isPublic !== undefined) strategy.isPublic = isPublic;
    if (isRunning !== undefined) strategy.isRunning = isRunning;

    await strategy.save();

    res.json({
      success: true,
      message: 'Strategy updated successfully',
      data: strategy
    });
  } catch (error) {
    console.error('Update strategy error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update strategy',
      error: error.message 
    });
  }
};

// Delete strategy (Admin)
export const deleteStrategy = async (req, res) => {
  try {
    const { id } = req.params;

    const strategy = await Strategy.findByPk(id);

    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        message: 'Strategy not found' 
      });
    }

    await strategy.destroy();

    res.json({
      success: true,
      message: 'Strategy deleted successfully'
    });
  } catch (error) {
    console.error('Delete strategy error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete strategy',
      error: error.message 
    });
  }
};

// Toggle strategy status (Admin)
export const toggleStrategyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body; // field can be 'isActive', 'isPublic', or 'isRunning'

    const strategy = await Strategy.findByPk(id);

    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        message: 'Strategy not found' 
      });
    }

    // Toggle the specified field
    if (field === 'isActive') {
      strategy.isActive = !strategy.isActive;
    } else if (field === 'isPublic') {
      strategy.isPublic = !strategy.isPublic;
    } else if (field === 'isRunning') {
      strategy.isRunning = !strategy.isRunning;
    } else {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid field specified' 
      });
    }

    await strategy.save();

    res.json({
      success: true,
      message: `Strategy ${field} toggled successfully`,
      data: strategy
    });
  } catch (error) {
    console.error('Toggle strategy status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to toggle strategy status',
      error: error.message 
    });
  }
};

// Get strategy statistics (Admin)
export const getStrategyStats = async (req, res) => {
  try {
    const totalStrategies = await Strategy.count();
    const activeStrategies = await Strategy.count({ where: { isActive: true } });
    const publicStrategies = await Strategy.count({ where: { isPublic: true } });
    const runningStrategies = await Strategy.count({ where: { isRunning: true } });
    
    // Strategies by segment
    const strategiesBySegment = await Strategy.findAll({
      attributes: [
        'segment',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['segment']
    });

    // Recent strategies
    const recentStrategies = await Strategy.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.json({
      success: true,
      data: {
        total: totalStrategies,
        active: activeStrategies,
        public: publicStrategies,
        running: runningStrategies,
        bySegment: strategiesBySegment,
        recent: recentStrategies
      }
    });
  } catch (error) {
    console.error('Get strategy stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch strategy statistics',
      error: error.message 
    });
  }
};

// Get strategy subscribers (Admin)
export const getStrategySubscribers = async (req, res) => {
  try {
    const { id } = req.params;

    const strategy = await Strategy.findByPk(id);
    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        message: 'Strategy not found' 
      });
    }

    const subscriptions = await StrategySubscription.findAll({
      where: { strategyId: id },
      include: [{
        model: User,
        as: 'subscriber',
        attributes: ['id', 'name', 'email', 'phone', 'avatar']
      }],
      order: [['subscribedAt', 'DESC']]
    });

    res.json({
      success: true,
      data: subscriptions.map(sub => ({
        id: sub.id,
        userId: sub.userId,
        user: sub.subscriber,
        lots: sub.lots,
        isActive: sub.isActive,
        isPaused: sub.isPaused,
        tradeMode: sub.tradeMode,
        subscribedAt: sub.subscribedAt,
        expiryDate: sub.expiryDate
      })),
      total: subscriptions.length
    });
  } catch (error) {
    console.error('Get strategy subscribers error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch strategy subscribers',
      error: error.message 
    });
  }
};

// Toggle subscription status (Admin)
export const toggleSubscriptionStatus = async (req, res) => {
  try {
    const { id, subscriptionId } = req.params;
    const { action } = req.body; // 'pause', 'resume', or 'cancel'

    const subscription = await StrategySubscription.findOne({
      where: { id: subscriptionId, strategyId: id }
    });

    if (!subscription) {
      return res.status(404).json({ 
        success: false,
        message: 'Subscription not found' 
      });
    }

    if (action === 'pause') {
      subscription.isPaused = true;
    } else if (action === 'resume') {
      subscription.isPaused = false;
    } else if (action === 'cancel') {
      subscription.isActive = false;
    } else if (action === 'activate') {
      subscription.isActive = true;
      subscription.isPaused = false;
    } else {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid action. Use pause, resume, cancel, or activate' 
      });
    }

    await subscription.save();

    res.json({
      success: true,
      message: `Subscription ${action}d successfully`,
      data: subscription
    });
  } catch (error) {
    console.error('Toggle subscription status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update subscription status',
      error: error.message 
    });
  }
};
