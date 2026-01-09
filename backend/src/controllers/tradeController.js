import { Trade, User, Strategy, StrategySubscription, PaperPosition, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { emitTradeUpdate, emitDashboardUpdate } from '../config/socket.js';

// Get all trades for current user (includes both live trades and paper positions)
export const getUserTrades = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, market, page = 1, limit = 10, search } = req.query;

    const where = { userId };
    const paperWhere = { userId };
    
    // Exclude paper trades from Trade table (they should only be in paper_positions)
    where.broker = { [Op.ne]: 'PAPER' };
    
    // Map status for paper positions: Pending/Open -> Open, Completed/Failed -> Closed
    // Paper positions table uses 'Open' and 'Closed' status values
    const mapStatusForPaper = (statusList) => {
      return statusList.map(s => {
        if (s === 'Open' || s === 'Pending') return 'Open';  // Paper positions use 'Open'
        if (s === 'Completed' || s === 'Failed') return 'Closed';  // Paper positions use 'Closed'
        return s;
      }).filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
    };
    
    // Support comma-separated statuses, e.g. status=Completed,Failed
    if (status) {
      const statuses = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      
      if (statuses.length > 1) {
        where.status = { [Op.in]: statuses };
        const paperStatuses = mapStatusForPaper(statuses);
        paperWhere.status = { [Op.in]: paperStatuses };
      } else if (statuses.length === 1) {
        where.status = statuses[0];
        const paperStatuses = mapStatusForPaper(statuses);
        paperWhere.status = paperStatuses[0];
      }
    }
    if (market) {
      where.market = market;
      paperWhere.market = market;
    }
    if (search) {
      where[Op.or] = [
        { symbol: { [Op.like]: `%${search}%` } },
        { orderId: { [Op.like]: `%${search}%` } }
      ];
      paperWhere[Op.or] = [
        { symbol: { [Op.like]: `%${search}%` } }
      ];
    }

    // Fetch both live trades and paper positions
    const [trades, paperPositions] = await Promise.all([
      Trade.findAll({
        where,
        include: [
          {
            model: Strategy,
            as: 'strategy',
            attributes: ['id', 'name', 'symbol']
          }
        ],
        order: [['createdAt', 'DESC']]
      }),
      PaperPosition.findAll({
        where: paperWhere,
        include: [
          {
            model: Strategy,
            as: 'strategy',
            attributes: ['id', 'name', 'symbol']
          }
        ],
        order: [['createdAt', 'DESC']]
      })
    ]);

    console.log(`[TradeController] User ${userId}: Live trades: ${trades.length}, Paper positions: ${paperPositions.length}`);
    if (paperPositions.length > 0) {
      console.log(`[TradeController] Paper positions:`, paperPositions.map(p => ({ id: p.id, symbol: p.symbol, status: p.status })));
    }

    // Mark paper positions with isPaper flag and normalize fields
    const paperTrades = paperPositions.map(p => ({
      id: p.id,
      orderId: p.orderId, // Include orderId for close/modify operations
      userId: p.userId,
      strategyId: p.strategyId,
      strategy: p.strategy,
      symbol: p.symbol,
      market: p.market,
      type: p.type,
      tradeType: p.type,
      amount: p.volume,
      volume: p.volume,
      price: p.openPrice,
      currentPrice: p.closePrice || p.currentPrice, // Use closePrice for closed positions
      status: p.status === 'Open' ? 'Pending' : p.status === 'Closed' ? 'Completed' : p.status,  // Map Open->Pending for UI consistency
      pnl: p.realizedProfit || p.profit, // Use realizedProfit for closed, profit for open
      stopLoss: p.stopLoss, // Include SL/TP for display
      takeProfit: p.takeProfit,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      isPaper: true
    }));

    // Mark live trades
    const liveTrades = trades.map(t => ({
      ...t.toJSON(),
      isPaper: false
    }));

    // Combine and sort by date
    const allTrades = [...liveTrades, ...paperTrades].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    console.log(`[TradeController] Combined trades: ${allTrades.length}, Paper: ${paperTrades.length}, Live: ${liveTrades.length}`);

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedTrades = allTrades.slice(offset, offset + parseInt(limit));

    console.log(`[TradeController] Returning ${paginatedTrades.length} trades to user ${userId}`);
    if (paginatedTrades.length > 0 && paginatedTrades.some(t => t.isPaper)) {
      const paperTrades = paginatedTrades.filter(t => t.isPaper);
      console.log(`[TradeController] Paper trades in response:`, paperTrades.map(t => ({ 
        id: t.id, 
        symbol: t.symbol, 
        price: t.price, 
        status: t.status 
      })));
    }

    res.json({
      success: true,
      data: paginatedTrades,
      pagination: {
        total: allTrades.length,
        page: parseInt(page),
        pages: Math.ceil(allTrades.length / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
};

// Create new trade
export const createTrade = async (req, res) => {
  console.log('Create trade request body:', req.body);
  try {
    const userId = req.user.id;
    const { orderId, market, symbol, type, amount, price, broker, brokerType, date } = req.body;

    // Normalize type
    const normalizedType = type === 'BUY' ? 'Buy' : type === 'SELL' ? 'Sell' : type;

    const trade = await Trade.create({
      userId,
      orderId,
      market,
      symbol,
      type: normalizedType,
      amount,
      price,
      broker,
      brokerType,
      date: date || new Date(),
      status: 'Pending'
    });
    console.log('Created trade for user', userId, 'tradeId', trade.id, 'symbol', trade.symbol, 'market', trade.market);

    // Emit real-time update
    emitTradeUpdate(userId, trade, 'create');
    emitDashboardUpdate(userId, { trades: { new: trade } });

    res.status(201).json({
      success: true,
      message: 'Trade created successfully',
      data: trade
    });
  } catch (error) {
    console.error('Create trade error:', error);
    res.status(500).json({ error: 'Failed to create trade' });
  }
};

// Get trade by ID
export const getTradeById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const trade = await Trade.findOne({
      where: { id, userId }
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    res.json({
      success: true,
      data: trade
    });
  } catch (error) {
    console.error('Get trade error:', error);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
};

// Update trade
export const updateTrade = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    const trade = await Trade.findOne({
      where: { id, userId }
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Don't allow updating certain fields
    delete updateData.userId;
    delete updateData.id;
    delete updateData.createdAt;

    await trade.update(updateData);

    // Emit real-time update
    emitTradeUpdate(userId, trade, 'update');
    emitDashboardUpdate(userId, { trades: { updated: trade } });

    res.json({
      success: true,
      message: 'Trade updated successfully',
      data: trade
    });
  } catch (error) {
    console.error('Update trade error:', error);
    res.status(500).json({ error: 'Failed to update trade' });
  }
};

// Delete trade
export const deleteTrade = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const trade = await Trade.findOne({
      where: { id, userId }
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    await trade.destroy();

    // Emit real-time update
    emitTradeUpdate(userId, { id }, 'delete');
    emitDashboardUpdate(userId, { trades: { deleted: id } });

    res.json({
      success: true,
      message: 'Trade deleted successfully'
    });
  } catch (error) {
    console.error('Delete trade error:', error);
    res.status(500).json({ error: 'Failed to delete trade' });
  }
};

// Get trade statistics
export const getTradeStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalTrades = await Trade.count({ where: { userId } });
    
    const completedTrades = await Trade.count({
      where: { userId, status: 'Completed' }
    });

    const pendingTrades = await Trade.count({
      where: { userId, status: 'Pending' }
    });

    const failedTrades = await Trade.count({
      where: { userId, status: 'Failed' }
    });

    // Calculate total P&L
    const pnlResult = await Trade.findAll({
      where: { userId, status: 'Completed' },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('pnl')), 'totalPnl'],
        [sequelize.fn('AVG', sequelize.col('pnl')), 'avgPnl']
      ],
      raw: true
    });

    const stats = {
      totalTrades,
      completedTrades,
      pendingTrades,
      failedTrades,
      totalPnl: pnlResult[0].totalPnl || 0,
      avgPnl: pnlResult[0].avgPnl || 0
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get trade stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Admin: Get all trades
export const getAllTrades = async (req, res) => {
  try {
    const { status, market, page = 1, limit = 20, search } = req.query;

    const where = {};
    // Support comma-separated statuses, e.g. status=Completed,Failed
    if (status) {
      const statuses = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length > 1) {
        where.status = { [Op.in]: statuses };
      } else if (statuses.length === 1) {
        where.status = statuses[0];
      }
    }
    if (market) where.market = market;
    if (search) {
      where[Op.or] = [
        { symbol: { [Op.like]: `%${search}%` } },
        { orderId: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const trades = await Trade.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }
      ]
    });

    res.json({
      success: true,
      data: trades.rows,
      pagination: {
        total: trades.count,
        page: parseInt(page),
        pages: Math.ceil(trades.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all trades error:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
};

// Admin: Execute trade for all strategy subscribers + owner
export const adminStrategyTrade = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { strategyId, orderId, market, symbol, type, amount, price, broker, brokerType, date } = req.body;

    if (!strategyId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Strategy ID is required' });
    }

    // Get the strategy with owner
    const strategy = await Strategy.findByPk(strategyId, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      transaction
    });

    if (!strategy) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Get all active subscribers
    const subscriptions = await StrategySubscription.findAll({
      where: {
        strategyId,
        isActive: true
      },
      include: [{
        model: User,
        as: 'subscriber',
        attributes: ['id', 'name', 'email']
      }],
      transaction
    });

    // Collect all user IDs (owner + subscribers)
    const userIds = new Set();
    
    // Add strategy owner
    if (strategy.userId) {
      userIds.add(strategy.userId);
    }
    
    // Add all subscribers
    subscriptions.forEach(sub => {
      if (sub.userId) {
        userIds.add(sub.userId);
      }
    });

    const userIdArray = Array.from(userIds);
    console.log(`Admin executing strategy trade for strategy ${strategyId} to ${userIdArray.length} users`);

    // Normalize type
    const normalizedType = type === 'BUY' ? 'Buy' : type === 'SELL' ? 'Sell' : type;

    // Create trades for all users
    const createdTrades = [];
    for (const userId of userIdArray) {
      const trade = await Trade.create({
        userId,
        strategyId,
        orderId: `${orderId}_${userId}`,
        market,
        symbol,
        type: normalizedType,
        amount,
        price,
        broker: broker || 'Admin Strategy Trade',
        brokerType,
        date: date || new Date(),
        status: 'Pending'
      }, { transaction });

      createdTrades.push(trade);

      // Emit real-time update to each user
      emitTradeUpdate(userId, trade, 'create');
      emitDashboardUpdate(userId, { trades: { new: trade } });
    }

    await transaction.commit();

    console.log(`Successfully created ${createdTrades.length} trades for strategy ${strategy.name}`);

    res.status(201).json({
      success: true,
      message: `Trade executed for ${createdTrades.length} users (subscribers + owner)`,
      usersCount: createdTrades.length,
      data: {
        strategy: strategy.name,
        trades: createdTrades.length,
        users: userIdArray
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Admin strategy trade error:', error);
    res.status(500).json({ error: 'Failed to execute strategy trade' });
  }
};

// Admin: Trigger webhook signal for strategy
export const adminWebhookTrigger = async (req, res) => {
  try {
    const { strategyId, signal } = req.body;

    if (!strategyId) {
      return res.status(400).json({ error: 'Strategy ID is required' });
    }

    if (signal === undefined || signal === null) {
      return res.status(400).json({ error: 'Signal is required (1=BUY, 0=SQUARE OFF, -1=SELL)' });
    }

    // Get the strategy
    const strategy = await Strategy.findByPk(strategyId, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    if (!strategy.webhookSecret) {
      return res.status(400).json({ error: 'Strategy does not have a webhook secret configured' });
    }

    // Import and call the webhook handler internally
    const { executeTradingViewWebhook } = await import('./algoTradeController.js');

    // Create a mock request object to call the webhook handler
    const mockReq = {
      body: {
        secret: strategy.webhookSecret,
        signal: signal, // 1, 0, or -1
        symbol: strategy.symbol
      },
      ip: 'admin-panel'
    };

    // Create a mock response object to capture the result
    let webhookResult = null;
    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        webhookResult = { statusCode: this.statusCode, data };
        return this;
      },
      statusCode: 200
    };

    // Call the webhook handler
    await executeTradingViewWebhook(mockReq, mockRes);

    // Return the result from the webhook handler
    if (webhookResult) {
      // Get subscribers count
      const subscriptions = await StrategySubscription.findAll({
        where: { strategyId, isActive: true, isPaused: false }
      });
      const usersCount = subscriptions.length + 1; // +1 for owner

      if (webhookResult.statusCode >= 200 && webhookResult.statusCode < 300) {
        return res.json({
          success: true,
          message: `Signal sent successfully to ${usersCount} users`,
          usersCount,
          signal: signal === 1 ? 'BUY' : signal === -1 ? 'SELL' : 'SQUARE OFF',
          strategy: strategy.name,
          webhookResult: webhookResult.data
        });
      } else {
        return res.status(webhookResult.statusCode).json({
          success: false,
          error: webhookResult.data?.error || 'Failed to execute webhook',
          message: webhookResult.data?.message,
          details: webhookResult.data
        });
      }
    }

    res.status(500).json({ error: 'No response from webhook handler' });
  } catch (error) {
    console.error('Admin webhook trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger webhook signal' });
  }
};
