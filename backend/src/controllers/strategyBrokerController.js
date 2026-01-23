import { Strategy, ApiKey, StrategyBroker, sequelize } from '../models/index.js';
import { Op } from 'sequelize';

// Get all brokers for a strategy
export const getStrategyBrokers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId } = req.params;

    // Verify strategy belongs to user
    const strategy = await Strategy.findOne({
      where: { id: strategyId, userId }
    });

    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        error: 'Strategy not found or access denied' 
      });
    }

    // Get all brokers associated with this strategy
    const strategyBrokers = await StrategyBroker.findAll({
      where: { strategyId },
      include: [
        {
          model: ApiKey,
          as: 'apiKey',
          attributes: ['id', 'broker', 'apiName', 'segment', 'status', 'brokerId']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const brokers = strategyBrokers.map(sb => ({
      id: sb.id,
      strategyBrokerId: sb.id,
      apiKeyId: sb.apiKeyId,
      isActive: sb.isActive,
      broker: sb.apiKey?.broker,
      apiName: sb.apiKey?.apiName,
      segment: sb.apiKey?.segment,
      status: sb.apiKey?.status,
      brokerId: sb.apiKey?.brokerId,
      createdAt: sb.createdAt
    }));

    res.json({
      success: true,
      data: brokers,
      total: brokers.length
    });
  } catch (error) {
    console.error('Get strategy brokers error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch strategy brokers' 
    });
  }
};

// Add broker to strategy
export const addBrokerToStrategy = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { strategyId } = req.params;
    const { apiKeyId } = req.body;

    if (!apiKeyId) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        error: 'API Key ID is required' 
      });
    }

    // Verify strategy belongs to user
    const strategy = await Strategy.findOne({
      where: { id: strategyId, userId },
      transaction
    });

    if (!strategy) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        error: 'Strategy not found or access denied' 
      });
    }

    // Verify API key belongs to user
    const apiKey = await ApiKey.findOne({
      where: { id: apiKeyId, userId },
      transaction
    });

    if (!apiKey) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        error: 'API key not found or access denied' 
      });
    }

    // Check if broker is already added to strategy
    const existing = await StrategyBroker.findOne({
      where: { strategyId, apiKeyId },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        error: 'This broker is already added to the strategy' 
      });
    }

    // Create the association
    const strategyBroker = await StrategyBroker.create({
      strategyId,
      apiKeyId,
      isActive: true
    }, { transaction });

    await transaction.commit();

    // Fetch the complete data
    const result = await StrategyBroker.findOne({
      where: { id: strategyBroker.id },
      include: [
        {
          model: ApiKey,
          as: 'apiKey',
          attributes: ['id', 'broker', 'apiName', 'segment', 'status', 'brokerId']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Broker added to strategy successfully',
      data: {
        id: result.id,
        strategyBrokerId: result.id,
        apiKeyId: result.apiKeyId,
        isActive: result.isActive,
        broker: result.apiKey?.broker,
        apiName: result.apiKey?.apiName,
        segment: result.apiKey?.segment,
        status: result.apiKey?.status,
        brokerId: result.apiKey?.brokerId,
        createdAt: result.createdAt
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Add broker to strategy error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add broker to strategy' 
    });
  }
};

// Remove broker from strategy
export const removeBrokerFromStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId, strategyBrokerId } = req.params;

    // Verify strategy belongs to user
    const strategy = await Strategy.findOne({
      where: { id: strategyId, userId }
    });

    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        error: 'Strategy not found or access denied' 
      });
    }

    // Find and delete the association
    const strategyBroker = await StrategyBroker.findOne({
      where: { 
        id: strategyBrokerId,
        strategyId 
      }
    });

    if (!strategyBroker) {
      return res.status(404).json({ 
        success: false,
        error: 'Broker association not found' 
      });
    }

    await strategyBroker.destroy();

    res.json({
      success: true,
      message: 'Broker removed from strategy successfully'
    });
  } catch (error) {
    console.error('Remove broker from strategy error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove broker from strategy' 
    });
  }
};

// Toggle broker active status for a strategy
export const toggleStrategyBrokerStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { strategyId, strategyBrokerId } = req.params;

    // Verify strategy belongs to user
    const strategy = await Strategy.findOne({
      where: { id: strategyId, userId }
    });

    if (!strategy) {
      return res.status(404).json({ 
        success: false,
        error: 'Strategy not found or access denied' 
      });
    }

    // Find the association
    const strategyBroker = await StrategyBroker.findOne({
      where: { 
        id: strategyBrokerId,
        strategyId 
      }
    });

    if (!strategyBroker) {
      return res.status(404).json({ 
        success: false,
        error: 'Broker association not found' 
      });
    }

    const newActiveState = !strategyBroker.isActive;
    
    // Check for open positions before deactivating broker (only when deactivating)
    if (!newActiveState) {
      console.log(`🔍 [BROKER STATUS VALIDATION] Checking open positions for user ${userId}, strategy ${strategyId}`);
      const { Trade, PaperPosition } = await import('../models/index.js');
      
      const openPositions = await Promise.all([
        Trade.count({
          where: {
            userId,
            strategyId,
            status: { [Op.in]: ['Open', 'Pending'] }
          }
        }),
        PaperPosition.count({
          where: {
            userId,
            strategyId,
            status: 'Open'
          }
        })
      ]);

      const totalOpenPositions = openPositions[0] + openPositions[1];
      console.log(`🔍 [BROKER STATUS VALIDATION] Found ${openPositions[0]} open trades, ${openPositions[1]} paper positions = ${totalOpenPositions} total`);
      
      if (totalOpenPositions > 0) {
        console.log(`❌ [BROKER STATUS VALIDATION] BLOCKED - ${totalOpenPositions} positions open`);
        return res.status(400).json({
          success: false,
          error: 'Close position',
          message: `Close position`,
          openPositions: totalOpenPositions
        });
      }
      console.log(`✅ [BROKER STATUS VALIDATION] PASSED - No open positions`);
    }

    // Toggle status
    strategyBroker.isActive = newActiveState;
    await strategyBroker.save();

    res.json({
      success: true,
      message: `Broker ${strategyBroker.isActive ? 'activated' : 'deactivated'} for strategy`,
      data: {
        id: strategyBroker.id,
        isActive: strategyBroker.isActive
      }
    });
  } catch (error) {
    console.error('Toggle strategy broker status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to toggle broker status' 
    });
  }
};

// Add multiple brokers to strategy at once
export const addMultipleBrokersToStrategy = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { strategyId } = req.params;
    const { apiKeyIds } = req.body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[addMultipleBrokersToStrategy] userId:', userId);
    console.log('[addMultipleBrokersToStrategy] strategyId:', strategyId);
    console.log('[addMultipleBrokersToStrategy] Request body:', JSON.stringify(req.body));
    console.log('[addMultipleBrokersToStrategy] apiKeyIds:', apiKeyIds);
    console.log('[addMultipleBrokersToStrategy] apiKeyIds type:', typeof apiKeyIds);
    console.log('[addMultipleBrokersToStrategy] apiKeyIds isArray:', Array.isArray(apiKeyIds));
    console.log('[addMultipleBrokersToStrategy] apiKeyIds length:', apiKeyIds?.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!apiKeyIds || !Array.isArray(apiKeyIds)) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        error: 'API Key IDs array is required',
        received: { apiKeyIds, type: typeof apiKeyIds, isArray: Array.isArray(apiKeyIds) }
      });
    }

    // Allow empty array to remove all brokers
    if (apiKeyIds.length === 0) {
      console.log('[addMultipleBrokersToStrategy] Empty array - removing all brokers');
      
      // Verify strategy belongs to user
      const strategy = await Strategy.findOne({
        where: { id: strategyId, userId },
        transaction
      });

      if (!strategy) {
        await transaction.rollback();
        return res.status(404).json({ 
          success: false,
          error: 'Strategy not found or access denied' 
        });
      }

      // Remove all existing associations
      await StrategyBroker.destroy({
        where: { strategyId },
        transaction
      });

      await transaction.commit();

      return res.json({
        success: true,
        message: 'All brokers removed from strategy',
        data: { count: 0 }
      });
    }

    // Verify strategy belongs to user
    const strategy = await Strategy.findOne({
      where: { id: strategyId, userId },
      transaction
    });

    if (!strategy) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        error: 'Strategy not found or access denied' 
      });
    }

    // Verify all API keys belong to user
    const apiKeys = await ApiKey.findAll({
      where: { 
        id: { [Op.in]: apiKeyIds },
        userId 
      },
      transaction
    });

    console.log('[addMultipleBrokersToStrategy] Found apiKeys:', apiKeys.length);
    console.log('[addMultipleBrokersToStrategy] apiKeys IDs:', apiKeys.map(k => k.id));
    console.log('[addMultipleBrokersToStrategy] Requested apiKeyIds:', apiKeyIds);

    if (apiKeys.length !== apiKeyIds.length) {
      await transaction.rollback();
      const foundIds = apiKeys.map(k => k.id);
      const missingIds = apiKeyIds.filter(id => !foundIds.includes(id));
      console.log('[addMultipleBrokersToStrategy] ❌ Missing API Key IDs:', missingIds);
      return res.status(400).json({ 
        success: false,
        error: 'Some API keys not found or access denied',
        details: {
          requested: apiKeyIds,
          found: foundIds,
          missing: missingIds
        }
      });
    }

    // Remove existing associations
    await StrategyBroker.destroy({
      where: { strategyId },
      transaction
    });

    // Create new associations
    const strategyBrokers = await Promise.all(
      apiKeyIds.map(apiKeyId =>
        StrategyBroker.create({
          strategyId,
          apiKeyId,
          isActive: true
        }, { transaction })
      )
    );

    await transaction.commit();

    res.json({
      success: true,
      message: `${strategyBrokers.length} broker(s) added to strategy successfully`,
      data: {
        count: strategyBrokers.length
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Add multiple brokers to strategy error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add brokers to strategy' 
    });
  }
};
