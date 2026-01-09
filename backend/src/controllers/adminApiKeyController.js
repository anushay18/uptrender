import { ApiKey, Broker, User } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

// Get all API keys (admin)
export const getAllApiKeys = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      broker, 
      segment, 
      status,
      userId 
    } = req.query;

    const where = {};
    
    if (search) {
      where[Op.or] = [
        { brokerName: { [Op.like]: `%${search}%` } },
        { segment: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (broker) where.brokerName = broker;
    if (segment) where.segment = segment;
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const offset = (page - 1) * limit;

    const apiKeys = await ApiKey.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Broker,
          as: 'broker',
          attributes: ['id', 'name', 'segment', 'logoUrl'],
          required: false
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ],
      attributes: { exclude: ['apiKey', 'apiSecret'] }
    });

    res.json({
      success: true,
      data: {
        apiKeys: apiKeys.rows,
        pagination: {
          total: apiKeys.count,
          page: parseInt(page),
          pages: Math.ceil(apiKeys.count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all API keys error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch API keys' });
  }
};

// Get API key by ID (admin)
export const getApiKeyById = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await ApiKey.findByPk(id, {
      include: [
        {
          model: Broker,
          as: 'broker',
          attributes: ['id', 'name', 'segment', 'apiBaseUrl', 'logoUrl']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'phone']
        }
      ],
      attributes: { exclude: ['apiKey', 'apiSecret'] }
    });

    if (!apiKey) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch API key' });
  }
};

// Update API key (admin)
export const updateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const apiKey = await ApiKey.findByPk(id);

    if (!apiKey) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    // Allowed fields for admin update
    const allowedFields = ['status', 'isVerified', 'isDefault', 'additionalData', 'brokerName', 'segment'];
    const filteredData = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    await apiKey.update(filteredData);

    const updatedApiKey = await ApiKey.findByPk(id, {
      include: [
        {
          model: Broker,
          as: 'broker',
          attributes: ['id', 'name', 'segment']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ],
      attributes: { exclude: ['apiKey', 'apiSecret'] }
    });

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: updatedApiKey
    });
  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to update API key' });
  }
};

// Delete API key (admin)
export const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await ApiKey.findByPk(id);

    if (!apiKey) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    await apiKey.destroy();

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete API key' });
  }
};

// Get API keys statistics (admin)
export const getApiKeyStats = async (req, res) => {
  try {
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive,
  SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN isVerified = 1 THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN segment = 'Indian' THEN 1 ELSE 0 END) as indian,
        SUM(CASE WHEN segment = 'Forex' THEN 1 ELSE 0 END) as forex,
        SUM(CASE WHEN segment = 'Crypto' THEN 1 ELSE 0 END) as crypto
      FROM api_keys
    `);

    const brokerStats = await ApiKey.findAll({
      attributes: [
        'brokerName',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['brokerName'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        overview: stats[0],
        topBrokers: brokerStats
      }
    });
  } catch (error) {
    console.error('Get API key stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};

// Toggle API key status (admin)
export const toggleApiKeyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body; // field can be 'status', 'isVerified', 'isDefault'

    const apiKey = await ApiKey.findByPk(id);

    if (!apiKey) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    // Check for open positions before deactivating API key
    if (field === 'status' && apiKey.status === 'Active') {
      const { Trade, PaperPosition, StrategySubscription } = await import('../models/index.js');
      
      // Get all strategies using this API key
      const subscriptions = await StrategySubscription.findAll({
        where: { userId: apiKey.userId }
      });
      
      const strategyIds = subscriptions.map(sub => sub.strategyId);
      
      if (strategyIds.length > 0) {
        const openPositions = await Promise.all([
          Trade.count({
            where: {
              userId: apiKey.userId,
              strategyId: { [Op.in]: strategyIds },
              status: { [Op.in]: ['Open', 'Pending'] }
            }
          }),
          PaperPosition.count({
            where: {
              userId: apiKey.userId,
              strategyId: { [Op.in]: strategyIds },
              status: 'Open'
            }
          })
        ]);

        const totalOpenPositions = openPositions[0] + openPositions[1];
        
        if (totalOpenPositions > 0) {
          return res.status(400).json({
            success: false,
            message: 'Position open h, close kre',
            error: `${totalOpenPositions} open position(s) found. Please close all positions before deactivating API key.`,
            openPositions: totalOpenPositions
          });
        }
      }
    }

    if (field === 'status') {
      apiKey.status = apiKey.status === 'Active' ? 'Inactive' : 'Active';
    } else if (field === 'isVerified') {
      apiKey.isVerified = !apiKey.isVerified;
    } else if (field === 'isDefault') {
      // If setting as default, unset others for same user and segment
      if (!apiKey.isDefault) {
        await ApiKey.update(
          { isDefault: false },
          { where: { userId: apiKey.userId, segment: apiKey.segment } }
        );
      }
      apiKey.isDefault = !apiKey.isDefault;
    }

    await apiKey.save();

    res.json({
      success: true,
      message: `API key ${field} updated successfully`,
      data: apiKey
    });
  } catch (error) {
    console.error('Toggle API key status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update API key' });
  }
};
