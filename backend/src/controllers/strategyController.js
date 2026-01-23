import { Strategy, User, Trade, StrategySubscription, PaperPosition, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { emitStrategyUpdate, emitDashboardUpdate } from '../config/socket.js';
import emailNotificationHelper from '../utils/emailNotificationHelper.js';

// Helper function to calculate strategy performance from trades and paper positions
const calculateStrategyPerformance = async (strategyId, capital) => {
  try {
    // Get PnL from live trades
    const [tradePnl] = await sequelize.query(`
      SELECT COALESCE(SUM(pnl), 0) as totalPnl 
      FROM trades 
      WHERE strategyId = ? AND status IN ('Completed', 'Closed')
    `, { replacements: [strategyId], type: sequelize.QueryTypes.SELECT });

    // Get PnL from paper positions (both open and closed)
    const [paperPnl] = await sequelize.query(`
      SELECT COALESCE(SUM(profit), 0) as totalPnl 
      FROM paper_positions 
      WHERE strategyId = ?
    `, { replacements: [strategyId], type: sequelize.QueryTypes.SELECT });

    const totalPnl = (Number(tradePnl?.totalPnl) || 0) + (Number(paperPnl?.totalPnl) || 0);
    const capitalValue = Number(capital) || 10000;
    
    // Calculate performance as percentage of capital
    const performance = (totalPnl / capitalValue) * 100;
    
    return {
      performance: Math.round(performance * 100) / 100, // Round to 2 decimal places
      totalPnl: Math.round(totalPnl * 100) / 100
    };
  } catch (error) {
    console.error(`Error calculating performance for strategy ${strategyId}:`, error);
    return { performance: 0, totalPnl: 0 };
  }
};

// Get user's strategies
export const getUserStrategies = async (req, res) => {
  try {
    const userId = req.user.id;
    const { segment, isActive, page = 1, limit = 10, search } = req.query;

    const where = { userId };
    if (segment) where.segment = segment;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const strategies = await Strategy.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { include: ['webhookSecret'] }, // Include webhookSecret in response
      include: [{
        model: StrategySubscription,
        as: 'subscriptions',
        where: { userId }, // Get owner's subscription
        required: false,
        attributes: ['id', 'tradeMode', 'lots']
      }]
    });

    // Calculate performance for each strategy
    const strategiesWithPerformance = await Promise.all(
      strategies.rows.map(async (strategy) => {
        const strategyData = strategy.toJSON();
        const perfData = await calculateStrategyPerformance(strategyData.id, strategyData.capital);
        strategyData.performance = perfData.performance;
        strategyData.totalPnl = perfData.totalPnl;
        
        // If owner has a subscription, use its tradeMode and subscriptionId
        if (strategyData.subscriptions && strategyData.subscriptions.length > 0) {
          strategyData.tradeMode = strategyData.subscriptions[0].tradeMode;
          strategyData.subscriptionId = strategyData.subscriptions[0].id;
          strategyData.lots = strategyData.subscriptions[0].lots;
        }
        delete strategyData.subscriptions; // Remove the subscriptions array from response
        
        return strategyData;
      })
    );

    res.json({
      success: true,
      data: strategiesWithPerformance,
      pagination: {
        total: strategies.count,
        page: parseInt(page),
        pages: Math.ceil(strategies.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get strategies error:', error);
    res.status(500).json({ error: 'Unable to load strategies. Please refresh the page' });
  }
};

// Create strategy
export const createStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, segment, capital, symbol, symbolValue, legs, 
      description, type, madeBy, price,
      marketRisk, legMode
    } = req.body;

    // Get user's name for createdBy field
    const user = await User.findByPk(userId, { attributes: ['name'] });
    const createdByName = user ? user.name : 'Unknown User';

    const strategy = await Strategy.create({
      userId,
      name,
      segment,
      capital,
      symbol,
      symbolValue,
      legs: legs || 1,
      legMode: legMode || 'multi',
      description,
      marketRisk: marketRisk || null,
      type: type || 'Private',
      madeBy: madeBy || 'User',
      createdBy: createdByName,
      isActive: true,
      isRunning: false,
      isPublic: type === 'Public',
      isFavorite: false,
      price: price || null,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 1 month from now
    });

    // Auto-create subscription for owner in PAPER mode by default
    // This allows owner to receive signals in paper mode immediately
    // Owner can switch to live mode later
    try {
      const { StrategySubscription } = await import('../models/index.js');
      
      const subscription = await StrategySubscription.create({
        userId: userId,
        strategyId: strategy.id,
        lots: 0.01,
        isActive: true,
        isPaused: false,
        tradeMode: 'paper', // Default to paper mode for safety
        subscribedAt: new Date(),
        expiryDate: null // Owner's subscription never expires
      });
      
      console.log(`✅ Auto-created paper mode subscription for owner (userId: ${userId}, strategyId: ${strategy.id})`);
    } catch (subError) {
      // If subscription creation fails (e.g., duplicate), log but don't fail strategy creation
      console.warn(`⚠️ Failed to auto-create subscription for owner:`, subError.message);
    }

    // Emit real-time update
    emitStrategyUpdate(userId, strategy, 'create');
    emitDashboardUpdate(userId, { strategies: { new: strategy } });

    res.status(201).json({
      success: true,
      message: 'Strategy created successfully',
      data: strategy
    });
  } catch (error) {
    console.error('Create strategy error:', error);
    res.status(500).json({ error: 'Unable to create strategy. Please check your inputs and try again' });
  }
};

// Get strategy by ID
export const getStrategyById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const strategy = await Strategy.findOne({
      where: { id, userId },
      attributes: { include: ['webhookSecret'] } // Ensure webhookSecret is included
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    res.json({
      success: true,
      data: strategy
    });
  } catch (error) {
    console.error('Get strategy error:', error);
    res.status(500).json({ error: 'Unable to load strategy details. Please try again' });
  }
};

// Update strategy
export const updateStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[updateStrategy] userId:', userId);
    console.log('[updateStrategy] strategyId:', id);
    console.log('[updateStrategy] updateData:', JSON.stringify(updateData, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const strategy = await Strategy.findOne({
      where: { id, userId }
    });

    if (!strategy) {
      console.log('[updateStrategy] ❌ Strategy not found');
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Check for open positions if trying to pause strategy or change critical settings
    if (updateData.isPaused !== undefined && updateData.isPaused !== strategy.isPaused) {
      console.log(`🔍 [STRATEGY UPDATE VALIDATION] Checking open positions for strategy ${id}, isPaused change: ${strategy.isPaused} -> ${updateData.isPaused}`);
      
      const { Trade, PaperPosition } = await import('../models/index.js');
      
      const openPositions = await Promise.all([
        Trade.count({
          where: {
            strategyId: id,
            status: { [Op.in]: ['Open', 'Pending'] }
          }
        }),
        PaperPosition.count({
          where: {
            strategyId: id,
            status: 'Open'
          }
        })
      ]);

      const totalOpenPositions = openPositions[0] + openPositions[1];
      console.log(`🔍 [STRATEGY UPDATE VALIDATION] Found ${openPositions[0]} open trades, ${openPositions[1]} paper positions = ${totalOpenPositions} total`);
      
      if (totalOpenPositions > 0 && updateData.isPaused) {
        console.log(`❌ [STRATEGY UPDATE VALIDATION] BLOCKED - ${totalOpenPositions} positions open`);
        return res.status(400).json({
          success: false,
          error: 'Position open h, close kre',
          message: `${totalOpenPositions} open position(s) found. Please close all positions before pausing strategy.`,
          openPositions: totalOpenPositions
        });
      }
      console.log(`✅ [STRATEGY UPDATE VALIDATION] PASSED - No open positions or resuming strategy`);
    }

    // Don't allow updating certain fields
    delete updateData.userId;
    delete updateData.id;
    delete updateData.createdAt;

    console.log('[updateStrategy] Attempting to update with:', JSON.stringify(updateData, null, 2));
    await strategy.update(updateData);

    // If lots is being updated, also update the owner's subscription
    if (updateData.lots !== undefined) {
      const { StrategySubscription } = await import('../models/index.js');
      const ownerSubscription = await StrategySubscription.findOne({
        where: {
          userId,
          strategyId: id
        }
      });
      
      if (ownerSubscription) {
        await ownerSubscription.update({ lots: updateData.lots });
        console.log(`[updateStrategy] ✅ Also updated owner's subscription lots to ${updateData.lots}`);
      }
    }

    console.log('[updateStrategy] ✅ Update successful');
    res.json({
      success: true,
      message: 'Strategy updated successfully',
      data: strategy
    });
  } catch (error) {
    console.error('[updateStrategy] ❌ Update strategy error:', error);
    console.error('[updateStrategy] Error name:', error.name);
    console.error('[updateStrategy] Error message:', error.message);
    
    // Check if it's a Sequelize validation error
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      }));
      console.error('[updateStrategy] Validation errors:', JSON.stringify(validationErrors, null, 2));
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    res.status(500).json({ error: 'Unable to update strategy. Please check your inputs and try again' });
  }
};

// Delete strategy
export const deleteStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const strategy = await Strategy.findOne({
      where: { id, userId }
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    await strategy.destroy();

    res.json({
      success: true,
      message: 'Strategy deleted successfully'
    });
  } catch (error) {
    console.error('Delete strategy error:', error);
    res.status(500).json({ error: 'Unable to delete strategy. Please try again' });
  }
};

// Toggle strategy running status
export const toggleStrategyRunning = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const strategy = await Strategy.findOne({
      where: { id, userId }
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    await strategy.update({
      isRunning: !strategy.isRunning,
      lastUpdated: new Date().toISOString()
    });

    // Emit real-time update for status change
    emitStrategyUpdate(userId, strategy, 'status_change');
    emitDashboardUpdate(userId, { strategies: { statusChanged: strategy } });

    res.json({
      success: true,
      message: `Strategy ${strategy.isRunning ? 'started' : 'stopped'} successfully`,
      data: strategy
    });
  } catch (error) {
    console.error('Toggle strategy error:', error);
    res.status(500).json({ error: 'Unable to change strategy status. Please try again' });
  }
};

// Start strategy
export const startStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const strategy = await Strategy.findOne({ where: { id, userId } });
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    await strategy.update({ isRunning: true, lastUpdated: new Date().toISOString() });
    emitStrategyUpdate(userId, strategy, 'started');
    emitDashboardUpdate(userId, { strategies: { statusChanged: strategy } });
    res.json({ success: true, message: 'Strategy started successfully', data: strategy });
  } catch (error) {
    console.error('Start strategy error:', error);
    res.status(500).json({ error: 'Unable to start strategy. Please try again' });
  }
};

// Stop strategy
export const stopStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const strategy = await Strategy.findOne({ where: { id, userId } });
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    await strategy.update({ isRunning: false, lastUpdated: new Date().toISOString() });
    emitStrategyUpdate(userId, strategy, 'stopped');
    emitDashboardUpdate(userId, { strategies: { statusChanged: strategy } });
    res.json({ success: true, message: 'Strategy stopped successfully', data: strategy });
  } catch (error) {
    console.error('Stop strategy error:', error);
    res.status(500).json({ error: 'Unable to stop strategy. Please try again' });
  }
};

// Activate strategy (make public)
export const activateStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const strategy = await Strategy.findOne({ 
      where: { id, userId },
      include: [{ model: User, as: 'user', attributes: ['id', 'name'] }]
    });
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    await strategy.update({ 
      isPublic: true, 
      type: 'Public',
      isActive: true, 
      lastUpdated: new Date().toISOString() 
    });

    // Notify all users who have enabled marketplace notifications about new public strategy
    // This sends emails to users who have opted in for marketplace updates
    emailNotificationHelper.notifyNewMarketplaceStrategy({
      name: strategy.name,
      creatorName: strategy.user?.name || 'Strategy Creator',
      price: strategy.price || 0,
      segment: strategy.segment,
      id: strategy.id
    }).catch(err => console.error('Failed to send marketplace notification:', err));

    res.json({ success: true, message: 'Strategy activated successfully', data: strategy });
  } catch (error) {
    console.error('Activate strategy error:', error);
    res.status(500).json({ error: 'Unable to publish strategy. Please try again' });
  }
};

// Deactivate strategy (make private)
export const deactivateStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const strategy = await Strategy.findOne({ where: { id, userId } });
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    await strategy.update({ 
      isPublic: false, 
      type: 'Private',
      lastUpdated: new Date().toISOString() 
    });
    res.json({ success: true, message: 'Strategy deactivated successfully', data: strategy });
  } catch (error) {
    console.error('Deactivate strategy error:', error);
    res.status(500).json({ error: 'Unable to make strategy private. Please try again' });
  }
};

// Toggle favorite status
export const toggleFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const strategy = await Strategy.findOne({
      where: { id, userId }
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    await strategy.update({
      isFavorite: !strategy.isFavorite
    });

    res.json({
      success: true,
      message: `Strategy ${strategy.isFavorite ? 'added to' : 'removed from'} favorites`,
      data: strategy
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Unable to update favorites. Please try again' });
  }
};

// Check if strategy has open positions
export const checkStrategyOpenPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const strategy = await Strategy.findOne({
      where: { id, userId }
    });

    if (!strategy) {
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }

    const { Trade, PaperPosition } = await import('../models/index.js');
    
    const openPositions = await Promise.all([
      Trade.count({
        where: {
          userId,
          strategyId: id,
          status: { [Op.in]: ['Open', 'Pending'] }
        }
      }),
      PaperPosition.count({
        where: {
          userId,
          strategyId: id,
          status: 'Open'
        }
      })
    ]);

    const totalOpenPositions = openPositions[0] + openPositions[1];

    res.json({
      success: true,
      data: {
        hasOpenPositions: totalOpenPositions > 0,
        openPositions: totalOpenPositions,
        livePositions: openPositions[0],
        paperPositions: openPositions[1]
      }
    });
  } catch (error) {
    console.error('Check strategy open positions error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to check open positions. Please try again',
      message: error.message
    });
  }
};

// Get marketplace (public strategies)
export const getMarketplaceStrategies = async (req, res) => {
  try {
    const userId = req.user?.id; // Get current user ID
    const { segment, page = 1, limit, search } = req.query;

    // Build where clause - show ALL public strategies (from all users including current user)
    const where = { 
      isPublic: 1
    };
    
    // Do NOT exclude current user's strategies - marketplace shows all public strategies
    
    if (segment && segment !== 'all') {
      where.segment = segment;
    }
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = limit ? (page - 1) * limit : 0;

    console.log('=== MARKETPLACE QUERY ===');
    console.log('User ID:', userId);
    console.log('Where clause:', JSON.stringify(where, null, 2));

    const queryOptions = {
      where,
      order: [['createdAt', 'DESC']], // Changed from performance to createdAt
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'username', 'email'],
          required: false
        }
      ]
    };

    // Only apply limit and offset if limit is specified
    if (limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = offset;
    }

    const strategies = await Strategy.findAndCountAll(queryOptions);

    console.log(`Found ${strategies.count} marketplace strategies`);
    console.log('Strategy details:', strategies.rows.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      isPublic: s.isPublic,
      userId: s.userId,
      userName: s.user?.name
    })));

    // Calculate real-time performance for each strategy
    const strategiesWithPerformance = await Promise.all(
      strategies.rows.map(async (strategy) => {
        try {
          const strategyData = strategy.toJSON();
          const capital = Number(strategyData.capital) || 10000;

          // Fetch completed/closed trades
          const liveTrades = await Trade.findAll({
            where: { 
              strategyId: strategy.id,
              status: { [Op.in]: ['Completed', 'Closed'] }
            },
            attributes: ['pnl']
          });

          // Fetch ALL paper positions (both open and closed for real-time performance)
          const paperPositions = await PaperPosition.findAll({
            where: { 
              strategyId: strategy.id
            },
            attributes: ['profit', 'status']
          });

          // Calculate total P&L
          const livePnl = liveTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
          const paperPnl = paperPositions.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);
          const totalPnl = livePnl + paperPnl;

          // Calculate performance percentage
          const performance = capital > 0 ? (totalPnl / capital) * 100 : 0;

          strategyData.performance = Number(performance.toFixed(2));
          strategyData.totalPnl = Number(totalPnl.toFixed(2));
          strategyData.tradeCount = liveTrades.length + paperPositions.length;
          return strategyData;
        } catch (err) {
          console.error(`Error calculating performance for strategy ${strategy.id}:`, err);
          return strategy.toJSON();
        }
      })
    );

    res.json({
      success: true,
      data: strategiesWithPerformance,
      pagination: limit ? {
        total: strategies.count,
        page: parseInt(page),
        pages: Math.ceil(strategies.count / parseInt(limit)),
        limit: parseInt(limit)
      } : {
        total: strategies.count,
        page: 1,
        pages: 1,
        limit: strategies.count
      }
    });
  } catch (error) {
    console.error('Get marketplace error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Unable to load marketplace. Please refresh the page',
      message: error.message 
    });
  }
};

// Admin: Get all strategies
export const getAllStrategies = async (req, res) => {
  try {
    const { segment, page = 1, limit = 20, search, includeSecrets } = req.query;

    const where = {};
    if (segment) where.segment = segment;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    // Include webhookSecret if requested
    const attributes = includeSecrets === 'true' 
      ? { include: ['webhookSecret'] }
      : { exclude: ['webhookSecret'] };

    const strategies = await Strategy.findAndCountAll({
      where,
      attributes,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        },
        {
          model: StrategySubscription,
          as: 'subscriptions',
          attributes: ['id'],
          where: { isActive: true },
          required: false
        }
      ]
    });

    // Add subscription count and performance to each strategy
    const strategiesWithCount = await Promise.all(
      strategies.rows.map(async (strategy) => {
        const strategyData = strategy.toJSON();
        strategyData.subscriptionCount = strategyData.subscriptions ? strategyData.subscriptions.length : 0;
        // Determine visibility from type or isPublic
        strategyData.visibility = strategyData.type === 'Public' || strategyData.isPublic ? 'Public' : 'Private';
        delete strategyData.subscriptions; // Remove full subscription data
        
        // Calculate performance
        const perfData = await calculateStrategyPerformance(strategyData.id, strategyData.capital);
        strategyData.performance = perfData.performance;
        strategyData.totalPnl = perfData.totalPnl;
        
        return strategyData;
      })
    );

    res.json({
      success: true,
      data: strategiesWithCount,
      pagination: {
        total: strategies.count,
        page: parseInt(page),
        pages: Math.ceil(strategies.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all strategies error:', error);
    res.status(500).json({ error: 'Unable to load strategies. Please refresh the page' });
  }
};

// Debug: Get all public strategies (without user filter)
export const debugPublicStrategies = async (req, res) => {
  try {
    const strategies = await Strategy.findAll({
      where: {
        [Op.or]: [
          { type: 'Public' },
          { isPublic: true }
        ]
      },
      attributes: ['id', 'name', 'type', 'isPublic', 'userId', 'segment'],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name']
      }]
    });
    
    res.json({
      success: true,
      count: strategies.length,
      data: strategies
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generate code from manual rules
export const generateStrategyCode = async (req, res) => {
  try {
    const { rules, config } = req.body;

    if (!rules || !config) {
      return res.status(400).json({ error: 'Rules and config are required' });
    }

    // Generate Python code from rules
    let code = `# Auto-generated Trading Strategy
# Generated on: ${new Date().toISOString()}

def initialize(context):
    """
    Initialize your strategy
    """
    context.stocks = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK']
    context.portfolio_target = {}
    context.position_size = ${rules.riskManagement?.maxPositionSize ? rules.riskManagement.maxPositionSize / 100 : 0.1}

    # Risk management settings
    context.stop_loss_pct = ${rules.riskManagement?.stopLoss ? rules.riskManagement.stopLoss / 100 : 0.02}
    context.take_profit_pct = ${rules.riskManagement?.takeProfit ? rules.riskManagement.takeProfit / 100 : 0.05}
    context.max_drawdown_pct = ${rules.riskManagement?.maxDrawdown ? rules.riskManagement.maxDrawdown / 100 : 0.1}

def handle_data(context, data):
    """
    Main strategy logic - called every trading period
    """
    for stock in context.stocks:
        try:
            price = data.current(stock, 'price')
            volume = data.current(stock, 'volume')

            # Apply filters
            if volume < ${rules.filters?.volume || 100000}:
                continue
            if price < ${rules.filters?.price?.min || 100} or price > ${rules.filters?.price?.max || 5000}:
                continue

            # Calculate indicators
`;

    // Add indicator calculations
    const indicators = new Set();
    if (rules.entryConditions) {
      rules.entryConditions.forEach(rule => {
        if (rule.indicator === 'SMA') {
          indicators.add(`sma_${rule.period}`);
          code += `            sma_${rule.period} = data.history(stock, 'price', ${rule.period}).mean()\n`;
        } else if (rule.indicator === 'EMA') {
          indicators.add(`ema_${rule.period}`);
          code += `            ema_${rule.period} = data.history(stock, 'price', ${rule.period}, 'ema').iloc[-1]\n`;
        } else if (rule.indicator === 'RSI') {
          indicators.add(`rsi_${rule.period}`);
          code += `            rsi_${rule.period} = data.history(stock, 'price', ${rule.period}, 'rsi').iloc[-1]\n`;
        }
      });
    }

    if (rules.exitConditions) {
      rules.exitConditions.forEach(rule => {
        if (rule.indicator === 'SMA') {
          indicators.add(`sma_${rule.period}`);
          code += `            sma_${rule.period} = data.history(stock, 'price', ${rule.period}).mean()\n`;
        } else if (rule.indicator === 'EMA') {
          indicators.add(`ema_${rule.period}`);
          code += `            ema_${rule.period} = data.history(stock, 'price', ${rule.period}, 'ema').iloc[-1]\n`;
        } else if (rule.indicator === 'RSI') {
          indicators.add(`rsi_${rule.period}`);
          code += `            rsi_${rule.period} = data.history(stock, 'price', ${rule.period}, 'rsi').iloc[-1]\n`;
        }
      });
    }

    code += `
            # Entry conditions
            entry_signal = False
`;

    if (rules.entryConditions) {
      rules.entryConditions.forEach((condition, index) => {
        code += `            # Entry condition ${index + 1}: ${condition.indicator}\n`;
        if (condition.indicator === 'SMA' && condition.comparison === 'crosses_above') {
          const targetSMA = condition.value.replace('SMA_', '');
          code += `            if sma_${condition.period} > sma_${targetSMA} and data.history(stock, 'price', ${condition.period}).iloc[-2] <= data.history(stock, 'price', ${targetSMA}).iloc[-2]:
                entry_signal = True\n`;
        } else if (condition.comparison === 'greater_than') {
          code += `            if sma_${condition.period} > ${condition.value}:
                entry_signal = True\n`;
        } else if (condition.comparison === 'less_than') {
          code += `            if sma_${condition.period} < ${condition.value}:
                entry_signal = True\n`;
        }
      });
    }

    code += `
            # Exit conditions
            exit_signal = False
`;

    if (rules.exitConditions) {
      rules.exitConditions.forEach((condition, index) => {
        code += `            # Exit condition ${index + 1}: ${condition.indicator}\n`;
        if (condition.indicator === 'SMA' && condition.comparison === 'crosses_below') {
          const targetSMA = condition.value.replace('SMA_', '');
          code += `            if sma_${condition.period} < sma_${targetSMA} and data.history(stock, 'price', ${condition.period}).iloc[-2] >= data.history(stock, 'price', ${targetSMA}).iloc[-2]:
                exit_signal = True\n`;
        } else if (condition.comparison === 'greater_than') {
          code += `            if sma_${condition.period} > ${condition.value}:
                exit_signal = True\n`;
        } else if (condition.comparison === 'less_than') {
          code += `            if sma_${condition.period} < ${condition.value}:
                exit_signal = True\n`;
        }
      });
    }

    code += `
            # Execute trades
            current_position = context.portfolio.positions.get(stock, 0)

            if entry_signal and current_position == 0:
                # Buy signal
                order_target_percent(stock, context.position_size)
            elif exit_signal and current_position > 0:
                # Sell signal
                order_target_percent(stock, 0)

        except Exception as e:
            # Skip this stock if there's an error
            continue

def before_trading_start(context, data):
    """
    Called before each trading day
    """
    pass

def after_trading_end(context, data):
    """
    Called after each trading day
    """
    pass
`;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.json({
      success: true,
      data: {
        code,
        message: 'Code generated successfully'
      }
    });
  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({ error: 'Unable to generate code. Please try again' });
  }
};

// Validate strategy code
export const validateStrategyCode = async (req, res) => {
  try {
    const { code, language = 'python' } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Mock code validation - in production, you would use actual Python/R code validation
    const errors = [];
    const warnings = [];

    // Basic validation checks
    if (!code.includes('def initialize')) {
      errors.push({
        line: 1,
        message: 'initialize function is required',
        severity: 'error'
      });
    }

    if (!code.includes('def handle_data')) {
      errors.push({
        line: 1,
        message: 'handle_data function is required',
        severity: 'error'
      });
    }

    // Check for common issues
    if (code.includes('print(')) {
      warnings.push({
        line: 1,
        message: 'Consider using logging instead of print statements',
        severity: 'warning'
      });
    }

    const isValid = errors.length === 0;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.json({
      success: true,
      data: {
        isValid,
        errors,
        warnings,
        message: isValid ? 'Code validation successful' : 'Code validation failed'
      }
    });
  } catch (error) {
    console.error('Code validation error:', error);
    res.status(500).json({ error: 'Unable to validate code. Please try again' });
  }
};

// Run backtest
export const runBacktest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      code, 
      config, 
      backtestParams = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        benchmark: 'NIFTY50',
        frequency: 'daily'
      }
    } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Strategy code is required' });
    }

    // Simulate backtest processing time
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock backtest results - in production, you would run actual backtesting
    const mockResults = {
      totalReturn: Math.random() * 30 - 5, // -5% to 25%
      annualizedReturn: Math.random() * 25 - 2, // -2% to 23%
      sharpeRatio: Math.random() * 2 + 0.5, // 0.5 to 2.5
      maxDrawdown: -(Math.random() * 20 + 5), // -5% to -25%
      winRate: Math.random() * 40 + 45, // 45% to 85%
      trades: Math.floor(Math.random() * 200 + 50), // 50 to 250 trades
      profitFactor: Math.random() * 2 + 0.5, // 0.5 to 2.5
      performance: generateMockPerformanceData(backtestParams.startDate, backtestParams.endDate),
      trades: generateMockTrades(),
      startDate: backtestParams.startDate,
      endDate: backtestParams.endDate,
      benchmark: backtestParams.benchmark
    };

    res.json({
      success: true,
      data: mockResults,
      message: 'Backtest completed successfully'
    });
  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({ error: 'Unable to run backtest. Please try again' });
  }
};

// Deploy strategy
export const deployStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name,
      description,
      code, 
      config, 
      backtestResults,
      isPublic = false
    } = req.body;

    if (!name || !code || !backtestResults) {
      return res.status(400).json({ 
        error: 'Strategy name, code, and backtest results are required' 
      });
    }

    // Create the strategy in database
    const strategy = await Strategy.create({
      userId,
      name,
      description: description || '',
      segment: config?.segment || 'Indian',
      capital: config?.capital || 100000,
      legs: 1,
      symbol: config?.symbol || 'NIFTY',
      type: isPublic ? 'Public' : 'Private',
      isPublic,
      isActive: true,
      status: 'deployed',
      code,
      backtestResults: JSON.stringify(backtestResults),
      config: JSON.stringify(config),
      totalReturn: backtestResults.totalReturn || 0,
      sharpeRatio: backtestResults.sharpeRatio || 0,
      maxDrawdown: backtestResults.maxDrawdown || 0,
      winRate: backtestResults.winRate || 0
    });

    // Auto-create subscription for owner in PAPER mode by default
    try {
      const { StrategySubscription } = await import('../models/index.js');
      
      const subscription = await StrategySubscription.create({
        userId: userId,
        strategyId: strategy.id,
        lots: 1,
        isActive: true,
        isPaused: false,
        tradeMode: 'paper',
        subscribedAt: new Date(),
        expiryDate: null
      });
      
      console.log(`✅ Auto-created paper mode subscription for AI strategy owner (userId: ${userId}, strategyId: ${strategy.id})`);
    } catch (subError) {
      console.warn(`⚠️ Failed to auto-create subscription for AI strategy owner:`, subError.message);
    }

    // Emit real-time update
    emitStrategyUpdate(userId, {
      type: 'STRATEGY_DEPLOYED',
      strategy: {
        id: strategy.id,
        name: strategy.name,
        status: 'deployed'
      }
    });

    res.json({
      success: true,
      data: strategy,
      message: 'Strategy deployed successfully'
    });
  } catch (error) {
    console.error('Deploy strategy error:', error);
    res.status(500).json({ error: 'Unable to deploy strategy. Please try again' });
  }
};

// Save draft
export const saveDraft = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name,
      description,
      code, 
      config,
      draftId
    } = req.body;

    let strategy;
    
    if (draftId) {
      // Update existing draft
      strategy = await Strategy.findOne({
        where: { id: draftId, userId, status: 'draft' }
      });
      
      if (!strategy) {
        return res.status(404).json({ error: 'Draft not found' });
      }
      
      await strategy.update({
        name: name || strategy.name,
        description: description || strategy.description,
        code: code || strategy.code,
        config: JSON.stringify(config || JSON.parse(strategy.config || '{}'))
      });
    } else {
      // Create new draft
      strategy = await Strategy.create({
        userId,
        name: name || 'Untitled Strategy',
        description: description || '',
        segment: config?.segment || 'Indian',
        capital: config?.capital || 100000,
        legs: 1,
        symbol: config?.symbol || 'NIFTY',
        type: 'Private',
        isPublic: false,
        isActive: false,
        status: 'draft',
        code: code || '',
        config: JSON.stringify(config || {})
      });
    }

    res.json({
      success: true,
      data: strategy,
      message: 'Draft saved successfully'
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Unable to save draft. Please try again' });
  }
};

// Get user drafts
export const getUserDrafts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const drafts = await Strategy.findAndCountAll({
      where: { 
        userId,
        status: 'draft'
      },
      limit: parseInt(limit),
      offset,
      order: [['updatedAt', 'DESC']]
    });

    res.json({
      success: true,
      data: drafts.rows,
      pagination: {
        total: drafts.count,
        page: parseInt(page),
        pages: Math.ceil(drafts.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: 'Unable to load drafts. Please refresh the page' });
  }
};

// Helper functions for mock data
function generateMockPerformanceData(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const data = [];
  const initialValue = 100000;
  let currentValue = initialValue;

  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const randomChange = (Math.random() - 0.5) * 0.1; // ±5% monthly change
    currentValue *= (1 + randomChange);
    
    data.push({
      date: d.toISOString().split('T')[0],
      value: Math.round(currentValue)
    });
  }

  return data;
}

function generateMockTrades() {
  const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'];
  const trades = [];
  
  for (let i = 0; i < 10; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const action = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const quantity = Math.floor(Math.random() * 100) + 10;
    const price = Math.floor(Math.random() * 1000) + 1000;
    const pnl = (Math.random() - 0.5) * 5000;
    
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    
    trades.push({
      date: date.toISOString().split('T')[0],
      symbol,
      action,
      quantity,
      price,
      pnl: Math.round(pnl)
    });
  }
  
  return trades;
}

// Get public strategy trades + stats (visible if public or owned by user)
export const getStrategyPublicStats = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    const { id } = req.params;
    const { limit = 50 } = req.query;

    console.log(`[getStrategyPublicStats] Fetching stats for strategy ID: ${id}, requester: ${requesterId}`);

    const strategy = await Strategy.findByPk(id);
    console.log(`[getStrategyPublicStats] Strategy found:`, strategy ? { id: strategy.id, name: strategy.name, isPublic: strategy.isPublic, userId: strategy.userId } : 'NOT FOUND');
    
    if (!strategy) {
      console.log(`[getStrategyPublicStats] Strategy ${id} not found in database`);
      return res.status(404).json({ success: false, message: 'Strategy not found' });
    }

    const isOwner = requesterId && Number(strategy.userId) === Number(requesterId);
    console.log(`[getStrategyPublicStats] isPublic: ${strategy.isPublic}, isOwner: ${isOwner}`);
    
    if (!strategy.isPublic && !isOwner) {
      console.log(`[getStrategyPublicStats] Access denied: strategy is private and user is not owner`);
      return res.status(403).json({ success: false, message: 'Not authorized to view this strategy details' });
    }

    // Fetch both live trades and paper positions (exclude Failed trades)
    const liveTrades = await Trade.findAll({
      where: { 
        strategyId: id,
        status: { [Op.ne]: 'Failed' }  // Exclude failed trades
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit) || 50,
      attributes: [
        'id', 'symbol', 'type', 'amount', 'price', 'currentPrice', 'avgFillPrice', 'pnl', 'pnlPercentage', 'status', 'createdAt', 'updatedAt'
      ]
    });

    const paperPositions = await PaperPosition.findAll({
      where: { strategyId: id },
      order: [['openTime', 'DESC']],
      limit: parseInt(limit) || 50,
      attributes: [
        'id', 'symbol', 'type', 'volume', 'openPrice', 'currentPrice', 'closePrice', 'profit', 'profitPercent', 'status', 'openTime', 'closeTime', 'createdAt', 'updatedAt'
      ]
    });

    console.log(`[getStrategyPublicStats] Found ${liveTrades.length} live trades and ${paperPositions.length} paper positions for strategy ${id}`);
    console.log(`[getStrategyPublicStats] Paper positions sample:`, paperPositions.length > 0 ? paperPositions.slice(0, 2).map(p => ({ id: p.id, symbol: p.symbol, status: p.status, strategyId: p.strategyId })) : 'NONE');

    const toNumber = (v) => (v == null ? 0 : Number(v));

    // Normalize paper positions to match trade structure
    const normalizedPaperTrades = paperPositions.map(p => {
      const isClosed = ['Closed', 'TP_Hit', 'SL_Hit'].includes(p.status);
      const actualProfit = isClosed && p.profit != null ? toNumber(p.profit) : 
                          (isClosed && p.closePrice ? 
                            (toNumber(p.closePrice) - toNumber(p.openPrice)) * toNumber(p.volume) * (p.type === 'Buy' ? 1 : -1) : 
                            toNumber(p.profit));
      
      return {
        id: p.id,
        symbol: p.symbol,
        type: p.type,
        amount: p.volume,
        price: p.openPrice,
        currentPrice: isClosed ? (p.closePrice || p.currentPrice) : p.currentPrice,
        pnl: actualProfit,
        pnlPercentage: p.profitPercent,
        status: isClosed ? 'Completed' : 'Pending',
        createdAt: p.openTime || p.createdAt,
        updatedAt: p.closeTime || p.updatedAt,
        tradeMode: 'paper'
      };
    });

    // Add tradeMode to live trades
    const normalizedLiveTrades = liveTrades.map(t => {
      // For closed trades, use avgFillPrice or currentPrice as entry, and currentPrice or avgFillPrice as exit
      // Prefer avgFillPrice for entry since it's the actual filled price
      const entryPrice = toNumber(t.avgFillPrice) || toNumber(t.price);
      const isClosed = ['Closed', 'Completed'].includes(t.status);
      const exitPrice = isClosed ? toNumber(t.currentPrice) : 0;
      
      return {
        id: t.id,
        symbol: t.symbol,
        type: t.type,
        amount: t.amount,
        price: entryPrice,  // Use avgFillPrice if available, otherwise price
        currentPrice: exitPrice,  // Only show exit price for closed/completed trades
        pnl: t.pnl,
        pnlPercentage: t.pnlPercentage,
        status: t.status,  // Return actual status
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        tradeMode: 'live'
      };
    });

    // Combine both and sort by date
    const trades = [...normalizedLiveTrades, ...normalizedPaperTrades].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Consider both "Completed" and "Closed" as finished trades
    const completed = trades.filter(t => ['Completed', 'Closed'].includes(t.status));
    const pnlValues = completed.map(t => toNumber(t.pnl)).filter(v => v !== 0); // Filter out zero P&L
    const wins = pnlValues.filter(v => v > 0);
    const losses = pnlValues.filter(v => v < 0);

    const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
    const totalTrades = trades.length;
    const completedTrades = completed.length;
    const totalPnl = sum(pnlValues);
    const avgPnl = completedTrades ? totalPnl / completedTrades : 0;
    const winRate = completedTrades ? (wins.length / completedTrades) * 100 : 0;
    const grossProfit = sum(wins);
    const grossLoss = Math.abs(sum(losses));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

    // Calculate average win/loss percentages
    const avgWinPct = wins.length > 0 ? (sum(wins) / wins.length / (Number(strategy.capital) || 100000)) * 100 : 0;
    const avgLossPct = losses.length > 0 ? (Math.abs(sum(losses)) / losses.length / (Number(strategy.capital) || 100000)) * 100 : 0;

    // Calculate monthly returns from trades
    const monthlyReturnsMap = {};
    const capital = Number(strategy.capital) || 100000;
    
    completed.forEach(trade => {
      const date = new Date(trade.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyReturnsMap[monthKey]) {
        monthlyReturnsMap[monthKey] = { 
          monthKey, 
          monthLabel, 
          pnl: 0, 
          trades: 0 
        };
      }
      monthlyReturnsMap[monthKey].pnl += toNumber(trade.pnl);
      monthlyReturnsMap[monthKey].trades += 1;
    });

    // Convert to array and calculate percentages
    const monthlyReturns = Object.values(monthlyReturnsMap)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey)) // Most recent first
      .slice(0, 6) // Last 6 months
      .map(m => ({
        month: m.monthLabel,
        return: capital > 0 ? ((m.pnl / capital) * 100).toFixed(1) : '0.0',
        pnl: m.pnl,
        trades: m.trades
      }));

    // Naive equity curve and max drawdown over completed trades (ordered oldest->newest)
    const equity = [];
    let cum = 0;
    [...completed].reverse().forEach(t => {
      cum += toNumber(t.pnl);
      equity.push(cum);
    });
    let peak = -Infinity;
    let maxDD = 0;
    equity.forEach(v => {
      peak = Math.max(peak, v);
      maxDD = Math.min(maxDD, v - peak);
    });
    const maxDrawdown = maxDD;

    const stats = {
      totalTrades,
      completedTrades,
      winTrades: wins.length,
      lossTrades: losses.length,
      winRate,
      totalPnl,
      avgPnl,
      avgWinPct,
      avgLossPct,
      profitFactor: Number.isFinite(profitFactor) ? profitFactor : null,
      maxDrawdown,
      monthlyReturns,
    };

    console.log(`[getStrategyPublicStats] Computed stats:`, stats);

    // Only include sensitive data if owner
    const data = {
      stats,
      trades,
      isOwner  // Let frontend know if user is owner
    };

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get strategy public stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch strategy details', error: error.message });
  }
};
