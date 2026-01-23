import { Trade, User, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import centralizedStreamingService from '../services/CentralizedStreamingService.js';
import { calculatePnL } from '../utils/tradingCalculations.js';

// Get all trades (Admin)
export const getAllTrades = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      market,
      type,
      broker,
      startDate,
      endDate,
      sort = '-createdAt' 
    } = req.query;

    const where = {};
    
    // Filters
    if (search) {
      where[Op.or] = [
        { symbol: { [Op.like]: `%${search}%` } },
        { orderId: { [Op.like]: `%${search}%` } },
        { broker: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (status) {
      where.status = status;
    }
    
    if (market) {
      where.market = market;
    }
    
    if (type) {
      where.type = type;
    }
    
    if (broker) {
      where.broker = broker;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    // Sorting
    const order = [];
    if (sort.startsWith('-')) {
      order.push([sort.slice(1), 'DESC']);
    } else {
      order.push([sort, 'ASC']);
    }

    const offset = (page - 1) * limit;

    const trades = await Trade.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'username', 'email']
      }]
    });

    // Return trades with their stored P&L values
    // For open trades, calculate using current prices
    // For completed trades, use the stored pnl from database
    const tradesWithPnL = trades.rows.map(trade => {
      const tradeData = trade.toJSON();
      
      console.log(`[Admin P&L] Trade #${tradeData.id}: symbol=${tradeData.symbol}, status=${tradeData.status}, price=${tradeData.price}, amount=${tradeData.amount}, storedPnl=${tradeData.pnl}`);
      
      if (tradeData.status === 'Open') {
        // For open trades, calculate real-time P&L using streaming prices
        const priceData = centralizedStreamingService.getPrice(tradeData.symbol?.toUpperCase());
        console.log(`[Admin P&L] Trade #${tradeData.id}: priceData=`, priceData ? `bid=${priceData.bid}, ask=${priceData.ask}` : 'null');
        
        let currentPrice = tradeData.currentPrice;
        
        if (priceData) {
          // Use bid for sells, ask for buys (closing price)
          currentPrice = tradeData.type === 'Sell' ? priceData.ask : priceData.bid;
        }
        
        if (currentPrice && tradeData.price && tradeData.amount) {
          const pnlResult = calculatePnL({
            openPrice: parseFloat(tradeData.price),
            currentPrice: parseFloat(currentPrice),
            volume: parseFloat(tradeData.amount),
            type: tradeData.type,
            symbol: tradeData.symbol,
            market: tradeData.market || 'Forex'
          });
          
          console.log(`[Admin P&L] Trade #${tradeData.id}: Calculated pnl=${pnlResult.profit}`);
          
          tradeData.pnl = pnlResult.profit.toFixed(2);
          tradeData.pnlPercentage = pnlResult.profitPercent.toFixed(2);
          tradeData.currentPrice = parseFloat(currentPrice).toFixed(8);
        } else {
          console.log(`[Admin P&L] Trade #${tradeData.id}: Missing data - currentPrice=${currentPrice}, price=${tradeData.price}, amount=${tradeData.amount}`);
          tradeData.pnl = '0.00';
          tradeData.pnlPercentage = '0.00';
        }
      } else {
        // For completed/closed trades, use the stored pnl from database
        // If pnl is not stored, calculate from entry and exit prices
        if (tradeData.pnl !== null && tradeData.pnl !== undefined) {
          // Use stored P&L
          tradeData.pnl = parseFloat(tradeData.pnl).toFixed(2);
          tradeData.pnlPercentage = tradeData.pnlPercentage ? parseFloat(tradeData.pnlPercentage).toFixed(2) : '0.00';
        } else if (tradeData.currentPrice && tradeData.price && tradeData.amount) {
          // Calculate P&L from entry price and exit price (currentPrice)
          const entryPrice = parseFloat(tradeData.price);
          const exitPrice = parseFloat(tradeData.currentPrice);
          const quantity = parseFloat(tradeData.amount);
          
          let pnl = 0;
          if (tradeData.type === 'Buy') {
            pnl = (exitPrice - entryPrice) * quantity;
          } else {
            pnl = (entryPrice - exitPrice) * quantity;
          }
          
          const pnlPercentage = entryPrice > 0 ? ((pnl / (entryPrice * quantity)) * 100) : 0;
          
          tradeData.pnl = pnl.toFixed(2);
          tradeData.pnlPercentage = pnlPercentage.toFixed(2);
        } else {
          tradeData.pnl = '0.00';
          tradeData.pnlPercentage = '0.00';
        }
      }
      
      return tradeData;
    });

    res.json({
      success: true,
      data: {
        trades: tradesWithPnL,
        total: trades.count,
        page: parseInt(page),
        pages: Math.ceil(trades.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all trades error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch trades',
      error: error.message 
    });
  }
};

// Get trade by ID (Admin)
export const getTradeById = async (req, res) => {
  try {
    const { id } = req.params;

    const trade = await Trade.findByPk(id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'username', 'email', 'phone']
      }]
    });

    if (!trade) {
      return res.status(404).json({ 
        success: false,
        message: 'Trade not found' 
      });
    }

    res.json({
      success: true,
      data: trade
    });
  } catch (error) {
    console.error('Get trade by ID error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch trade',
      error: error.message 
    });
  }
};

// Update trade (Admin)
export const updateTrade = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      orderId,
      market,
      symbol,
      type,
      amount,
      price,
      currentPrice,
      pnl,
      pnlPercentage,
      status,
      broker,
      brokerType,
      date
    } = req.body;

    const trade = await Trade.findByPk(id);

    if (!trade) {
      return res.status(404).json({ 
        success: false,
        message: 'Trade not found' 
      });
    }

    // Update fields
    if (orderId !== undefined) trade.orderId = orderId;
    if (market !== undefined) trade.market = market;
    if (symbol !== undefined) trade.symbol = symbol;
    if (type !== undefined) trade.type = type;
    if (amount !== undefined) trade.amount = amount;
    if (price !== undefined) trade.price = price;
    if (currentPrice !== undefined) trade.currentPrice = currentPrice;
    if (pnl !== undefined) trade.pnl = pnl;
    if (pnlPercentage !== undefined) trade.pnlPercentage = pnlPercentage;
    if (status !== undefined) trade.status = status;
    if (broker !== undefined) trade.broker = broker;
    if (brokerType !== undefined) trade.brokerType = brokerType;
    if (date !== undefined) trade.date = date;

    await trade.save();

    res.json({
      success: true,
      message: 'Trade updated successfully',
      data: trade
    });
  } catch (error) {
    console.error('Update trade error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update trade',
      error: error.message 
    });
  }
};

// Delete trade (Admin)
export const deleteTrade = async (req, res) => {
  try {
    const { id } = req.params;

    const trade = await Trade.findByPk(id);

    if (!trade) {
      return res.status(404).json({ 
        success: false,
        message: 'Trade not found' 
      });
    }

    await trade.destroy();

    res.json({
      success: true,
      message: 'Trade deleted successfully'
    });
  } catch (error) {
    console.error('Delete trade error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete trade',
      error: error.message 
    });
  }
};

// Get trade statistics (Admin)
export const getTradeStats = async (req, res) => {
  try {
    const totalTrades = await Trade.count();
    const completedTrades = await Trade.count({ where: { status: 'Completed' } });
    const pendingTrades = await Trade.count({ where: { status: 'Pending' } });
    const failedTrades = await Trade.count({ where: { status: 'Failed' } });
    
    // Trades by market
    const tradesByMarket = await Trade.findAll({
      attributes: [
        'market',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['market']
    });
    
    // Trades by status
    const tradesByStatus = await Trade.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Total P&L
    const pnlStats = await Trade.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('pnl')), 'totalPnl'],
        [sequelize.fn('AVG', sequelize.col('pnl')), 'avgPnl'],
        [sequelize.fn('MAX', sequelize.col('pnl')), 'maxPnl'],
        [sequelize.fn('MIN', sequelize.col('pnl')), 'minPnl']
      ]
    });

    // Recent trades
    const recentTrades = await Trade.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'username']
      }]
    });

    res.json({
      success: true,
      data: {
        total: totalTrades,
        completed: completedTrades,
        pending: pendingTrades,
        failed: failedTrades,
        byMarket: tradesByMarket,
        byStatus: tradesByStatus,
        pnl: pnlStats,
        recent: recentTrades
      }
    });
  } catch (error) {
    console.error('Get trade stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch trade statistics',
      error: error.message 
    });
  }
};
