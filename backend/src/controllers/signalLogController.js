import { SignalLog, Strategy } from '../models/index.js';
import { Op } from 'sequelize';

// Get signal logs with pagination and filters
export const getSignalLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      strategyId,
      signal,
      startDate,
      endDate,
      quickFilter // today, yesterday, last7days, last30days
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Strategy filter
    if (strategyId) {
      where.strategyId = strategyId;
    }

    // Signal type filter
    if (signal !== undefined && signal !== '') {
      where.signal = parseInt(signal);
    }

    // Date range filter
    let dateRange = {};
    
    if (quickFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (quickFilter) {
        case 'today':
          dateRange = {
            [Op.gte]: today
          };
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          dateRange = {
            [Op.gte]: yesterday,
            [Op.lt]: today
          };
          break;
        case 'last7days':
          const last7days = new Date(today);
          last7days.setDate(last7days.getDate() - 7);
          dateRange = {
            [Op.gte]: last7days
          };
          break;
        case 'last30days':
          const last30days = new Date(today);
          last30days.setDate(last30days.getDate() - 30);
          dateRange = {
            [Op.gte]: last30days
          };
          break;
      }
    } else if (startDate || endDate) {
      if (startDate) {
        dateRange[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateRange[Op.lte] = end;
      }
    }

    if (Object.keys(dateRange).length > 0) {
      where.receivedAt = dateRange;
    }

    console.log('[getSignalLogs] Query filters:', JSON.stringify(where, null, 2));

    const { count, rows } = await SignalLog.findAndCountAll({
      where,
      include: [
        {
          model: Strategy,
          as: 'strategy',
          attributes: ['id', 'name', 'segment']
        }
      ],
      order: [['receivedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get signal logs error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch signal logs' 
    });
  }
};

// Create a signal log entry
export const createSignalLog = async (req, res) => {
  try {
    const {
      strategyId,
      segment,
      canonicalSymbol,
      signal,
      signalId,
      payloadHash,
      payload,
      source = 'admin',
      usersNotified = 0,
      tradesExecuted = 0,
      success = true,
      errorMessage
    } = req.body;

    const signalLog = await SignalLog.create({
      strategyId,
      segment,
      canonicalSymbol,
      signal,
      signalId,
      payloadHash,
      payload: payload ? JSON.stringify(payload) : null,
      source,
      usersNotified,
      tradesExecuted,
      success,
      errorMessage
    });

    res.status(201).json({
      success: true,
      message: 'Signal log created successfully',
      data: signalLog
    });
  } catch (error) {
    console.error('Create signal log error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create signal log' 
    });
  }
};

// Get signal log stats
export const getSignalLogStats = async (req, res) => {
  try {
    const { quickFilter = 'today' } = req.query;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let dateRange = { [Op.gte]: today };
    
    if (quickFilter === 'last7days') {
      const last7days = new Date(today);
      last7days.setDate(last7days.getDate() - 7);
      dateRange = { [Op.gte]: last7days };
    } else if (quickFilter === 'last30days') {
      const last30days = new Date(today);
      last30days.setDate(last30days.getDate() - 30);
      dateRange = { [Op.gte]: last30days };
    }

    const totalSignals = await SignalLog.count({
      where: { receivedAt: dateRange }
    });

    const buySignals = await SignalLog.count({
      where: { 
        signal: 1,
        receivedAt: dateRange 
      }
    });

    const sellSignals = await SignalLog.count({
      where: { 
        signal: -1,
        receivedAt: dateRange 
      }
    });

    const squareOffSignals = await SignalLog.count({
      where: { 
        signal: 0,
        receivedAt: dateRange 
      }
    });

    const successfulSignals = await SignalLog.count({
      where: { 
        success: true,
        receivedAt: dateRange 
      }
    });

    res.json({
      success: true,
      data: {
        total: totalSignals,
        buy: buySignals,
        sell: sellSignals,
        squareOff: squareOffSignals,
        successful: successfulSignals,
        failed: totalSignals - successfulSignals
      }
    });
  } catch (error) {
    console.error('Get signal log stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch signal stats' 
    });
  }
};
