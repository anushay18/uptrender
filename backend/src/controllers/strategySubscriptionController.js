import { StrategySubscription, Strategy, User, Wallet, WalletTransaction, ApiKey, StrategyBroker } from '../models/index.js';
import { sequelize } from '../config/database.js';

/**
 * Subscribe to a strategy
 */
export const subscribeToStrategy = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { strategyId, lots = 1 } = req.body;

    // Check if strategy exists and is public
    const strategy = await Strategy.findByPk(strategyId);
    if (!strategy) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }

    if (!strategy.isPublic) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Cannot subscribe to private strategy' });
    }

    // Check if user is trying to subscribe to their own strategy
    if (strategy.userId === userId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Cannot subscribe to your own strategy' });
    }

    // Check if already subscribed
    const existingSubscription = await StrategySubscription.findOne({
      where: { userId, strategyId }
    });

    if (existingSubscription) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Already subscribed to this strategy' });
    }

    // Check price and wallet balance
    const price = parseFloat(strategy.price) || 0;
    
    if (price > 0) {
      // Get user's wallet
      const wallet = await Wallet.findOne({
        where: { userId },
        transaction
      });

      if (!wallet) {
        await transaction.rollback();
        return res.status(400).json({ success: false, error: 'Wallet not found' });
      }

      const currentBalance = parseFloat(wallet.balance) || 0;
      
      if (currentBalance < price) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient balance. Required: ₹${price}, Available: ₹${currentBalance}` 
        });
      }

      // Deduct amount from wallet
      await wallet.update({
        balance: currentBalance - price
      }, { transaction });

      // Create wallet transaction record
      await WalletTransaction.create({
        userId,
        walletId: wallet.id,
        type: 'debit',
        amount: price,
        description: `Subscription to strategy: ${strategy.name}`,
        status: 'completed',
        balanceBefore: currentBalance,
        balanceAfter: currentBalance - price
      }, { transaction });
    }

    // Calculate expiry date (30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // Create subscription
    const subscription = await StrategySubscription.create({
      userId,
      strategyId,
      lots: parseInt(lots) || 1,
      isActive: true,
      expiryDate
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: price > 0 
        ? `Successfully subscribed! ₹${price} deducted from wallet. Access granted until ${expiryDate.toLocaleDateString('en-IN')}`
        : `Successfully subscribed to strategy. Access granted until ${expiryDate.toLocaleDateString('en-IN')}`,
      data: subscription
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Subscribe to strategy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to strategy',
      message: error.message
    });
  }
};

/**
 * Unsubscribe from a strategy
 */
export const unsubscribeFromStrategy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const subscription = await StrategySubscription.findOne({
      where: { id, userId }
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    // Check for open positions before unsubscribing
    console.log(`🔍 [UNSUBSCRIBE VALIDATION] Checking open positions for user ${userId}, strategy ${subscription.strategyId}`);
    const { Trade, PaperPosition } = await import('../models/index.js');
    const { Op } = await import('sequelize');
    
    const openPositions = await Promise.all([
      Trade.count({
        where: {
          userId,
          strategyId: subscription.strategyId,
          status: { [Op.in]: ['Open', 'Pending'] }
        }
      }),
      PaperPosition.count({
        where: {
          userId,
          strategyId: subscription.strategyId,
          status: 'Open'
        }
      })
    ]);

    const totalOpenPositions = openPositions[0] + openPositions[1];
    console.log(`🔍 [UNSUBSCRIBE VALIDATION] Found ${openPositions[0]} open trades, ${openPositions[1]} paper positions = ${totalOpenPositions} total`);
    
    if (totalOpenPositions > 0) {
      console.log(`❌ [UNSUBSCRIBE VALIDATION] BLOCKED - ${totalOpenPositions} positions open`);
      return res.status(400).json({
        success: false,
        error: 'Close position',
        message: `Close position`,
        openPositions: totalOpenPositions
      });
    }
    console.log(`✅ [UNSUBSCRIBE VALIDATION] PASSED - No open positions`);

    await subscription.destroy();

    res.json({
      success: true,
      message: 'Successfully unsubscribed from strategy'
    });
  } catch (error) {
    console.error('Unsubscribe from strategy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from strategy',
      message: error.message
    });
  }
};

/**
 * Update subscription (only lots can be updated)
 */
export const updateSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { lots, isActive, tradeMode } = req.body;

    const subscription = await StrategySubscription.findOne({
      where: { id, userId }
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const updates = {};
    if (typeof lots !== 'undefined') {
      updates.lots = parseInt(lots) || 1;
    }
    if (typeof isActive !== 'undefined') {
      updates.isActive = !!isActive;
    }
    if (typeof tradeMode !== 'undefined' && ['paper', 'live'].includes(tradeMode)) {
      updates.tradeMode = tradeMode;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    await subscription.update(updates);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription',
      message: error.message
    });
  }
};

/**
 * Get user's subscriptions
 */
export const getUserSubscriptions = async (req, res) => {
  console.log('getUserSubscriptions called');
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    console.log('Get subscriptions for user:', userId, 'page:', page, 'limit:', limit);

    const offset = (page - 1) * limit;

    console.log('StrategySubscription model:', !!StrategySubscription);
    console.log('Strategy model:', !!Strategy);
    console.log('User model:', !!User);

    const subscriptions = await StrategySubscription.findAndCountAll({
      where: { userId, isActive: true },
      limit: parseInt(limit),
      offset,
      order: [['subscribedAt', 'DESC']],
      include: [
        {
          model: Strategy,
          as: 'strategy',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'username']
            }
          ]
        }
      ]
    });

    console.log('Found subscriptions:', subscriptions.count);

    res.json({
      success: true,
      data: subscriptions.rows,
      pagination: {
        total: subscriptions.count,
        page: page,
        pages: Math.ceil(subscriptions.count / limit),
        limit: limit
      }
    });
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions',
      message: error.message,
      details: error.errors ? error.errors.map(e => e.message) : undefined
    });
  }
};

/**
 * Check if subscription has open positions
 */
export const checkSubscriptionOpenPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const subscription = await StrategySubscription.findOne({
      where: { id, userId }
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const { Trade, PaperPosition } = await import('../models/index.js');
    const { Op } = await import('sequelize');
    
    const openPositions = await Promise.all([
      Trade.count({
        where: {
          userId,
          strategyId: subscription.strategyId,
          status: { [Op.in]: ['Open', 'Pending'] }
        }
      }),
      PaperPosition.count({
        where: {
          userId,
          strategyId: subscription.strategyId,
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
    console.error('Check open positions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check open positions',
      message: error.message
    });
  }
};

/**
 * Get subscription by ID
 */
export const getSubscriptionById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const subscription = await StrategySubscription.findOne({
      where: { id, userId },
      include: [
        {
          model: Strategy,
          as: 'strategy',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'username']
            }
          ]
        }
      ]
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
      message: error.message
    });
  }
};

/**
 * Process expired subscriptions (Admin endpoint)
 * Manually trigger the expiry check
 */
export const processExpiredSubscriptions = async (req, res) => {
  try {
    const { deactivateExpiredSubscriptions } = await import('../utils/subscriptionCron.js');
    const result = await deactivateExpiredSubscriptions();
    
    res.json({
      success: true,
      message: `Processed expired subscriptions. ${result.count || 0} deactivated.`,
      data: result
    });
  } catch (error) {
    console.error('Process expired subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process expired subscriptions',
      message: error.message
    });
  }
};

/**
 * Renew subscription (extends expiry by 30 days)
 */
export const renewSubscription = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find subscription
    const subscription = await StrategySubscription.findOne({
      where: { id, userId },
      include: [{ model: Strategy, as: 'strategy' }]
    });

    if (!subscription) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const strategy = subscription.strategy;
    const price = parseFloat(strategy.price) || 0;

    // Check wallet balance if strategy has a price
    if (price > 0) {
      const wallet = await Wallet.findOne({
        where: { userId },
        transaction
      });

      if (!wallet) {
        await transaction.rollback();
        return res.status(400).json({ success: false, error: 'Wallet not found' });
      }

      const currentBalance = parseFloat(wallet.balance) || 0;
      
      if (currentBalance < price) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient balance. Required: ₹${price}, Available: ₹${currentBalance}` 
        });
      }

      // Deduct amount from wallet
      await wallet.update({
        balance: currentBalance - price
      }, { transaction });

      // Create wallet transaction record
      await WalletTransaction.create({
        userId,
        walletId: wallet.id,
        type: 'debit',
        amount: price,
        description: `Renewal of strategy: ${strategy.name}`,
        status: 'completed',
        balanceBefore: currentBalance,
        balanceAfter: currentBalance - price
      }, { transaction });
    }

    // Extend expiry by 30 days from current expiry or from now if already expired
    const currentExpiry = subscription.expiryDate ? new Date(subscription.expiryDate) : new Date();
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiryDate = new Date(baseDate);
    newExpiryDate.setDate(newExpiryDate.getDate() + 30);

    // Update subscription
    await subscription.update({
      expiryDate: newExpiryDate,
      isActive: true
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: price > 0 
        ? `Subscription renewed! ₹${price} deducted. Access extended until ${newExpiryDate.toLocaleDateString('en-IN')}`
        : `Subscription renewed! Access extended until ${newExpiryDate.toLocaleDateString('en-IN')}`,
      data: {
        subscriptionId: subscription.id,
        newExpiryDate
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Renew subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to renew subscription',
      message: error.message
    });
  }
};

/**
 * Toggle pause/resume for a subscription
 * PUT /api/subscriptions/:id/toggle-pause
 */
export const toggleSubscriptionPause = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const subscription = await StrategySubscription.findOne({
      where: { id, userId },
      include: [{ model: Strategy, as: 'strategy', attributes: ['name'] }]
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const newPausedState = !subscription.isPaused;
    
    // Check for open positions before pausing (only when pausing, not resuming)
    if (newPausedState) {
      console.log(`🔍 [PAUSE VALIDATION] Checking open positions for user ${userId}, strategy ${subscription.strategyId}`);
      const { Trade, PaperPosition } = await import('../models/index.js');
      const { Op } = await import('sequelize');
      
      const openPositions = await Promise.all([
        Trade.count({
          where: {
            userId,
            strategyId: subscription.strategyId,
            status: { [Op.in]: ['Open', 'Pending'] }
          }
        }),
        PaperPosition.count({
          where: {
            userId,
            strategyId: subscription.strategyId,
            status: 'Open'
          }
        })
      ]);

      const totalOpenPositions = openPositions[0] + openPositions[1];
      console.log(`🔍 [PAUSE VALIDATION] Found ${openPositions[0]} open trades, ${openPositions[1]} paper positions = ${totalOpenPositions} total`);
      
      if (totalOpenPositions > 0) {
        console.log(`❌ [PAUSE VALIDATION] BLOCKED - ${totalOpenPositions} positions open`);
        return res.status(400).json({
          success: false,
          error: 'Close position',
          message: `Close position`,
          openPositions: totalOpenPositions
        });
      }
      console.log(`✅ [PAUSE VALIDATION] PASSED - No open positions`);
    }

    await subscription.update({ isPaused: newPausedState });

    res.json({
      success: true,
      message: newPausedState 
        ? `Strategy "${subscription.strategy?.name}" paused. No trades will be executed.`
        : `Strategy "${subscription.strategy?.name}" resumed. Trades will now be executed.`,
      data: {
        subscriptionId: subscription.id,
        isPaused: newPausedState
      }
    });
  } catch (error) {
    console.error('Toggle subscription pause error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle pause state',
      message: error.message
    });
  }
};

/**
 * Set trade mode for a subscription (paper/live)
 * PUT /api/subscriptions/:id/trade-mode
 */
export const setSubscriptionTradeMode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { tradeMode } = req.body;

    if (!tradeMode || !['paper', 'live'].includes(tradeMode)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid trade mode. Must be "paper" or "live"' 
      });
    }

    const subscription = await StrategySubscription.findOne({
      where: { id, userId },
      include: [{ model: Strategy, as: 'strategy', attributes: ['name'] }]
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    // Check for open positions before changing trade mode
    console.log(`🔍 [TRADE MODE VALIDATION] Checking open positions for user ${userId}, strategy ${subscription.strategyId}, changing from ${subscription.tradeMode} to ${tradeMode}`);
    const { Trade, PaperPosition } = await import('../models/index.js');
    const { Op } = await import('sequelize');
    
    const openPositions = await Promise.all([
      Trade.count({
        where: {
          userId,
          strategyId: subscription.strategyId,
          status: { [Op.in]: ['Open', 'Pending'] }
        }
      }),
      PaperPosition.count({
        where: {
          userId,
          strategyId: subscription.strategyId,
          status: 'Open'
        }
      })
    ]);

    const totalOpenPositions = openPositions[0] + openPositions[1];
    console.log(`🔍 [TRADE MODE VALIDATION] Found ${openPositions[0]} open trades, ${openPositions[1]} paper positions = ${totalOpenPositions} total`);
    
    if (totalOpenPositions > 0) {
      console.log(`❌ [TRADE MODE VALIDATION] BLOCKED - ${totalOpenPositions} positions open`);
      return res.status(400).json({
        success: false,
        error: 'Close position',
        message: `Close position`,
        openPositions: totalOpenPositions
      });
    }
    console.log(`✅ [TRADE MODE VALIDATION] PASSED - No open positions`);

    await subscription.update({ tradeMode });

    res.json({
      success: true,
      message: tradeMode === 'live' 
        ? `Strategy "${subscription.strategy?.name}" set to LIVE mode. Trades will be sent to broker.`
        : `Strategy "${subscription.strategy?.name}" set to PAPER mode. Trades will be logged but not sent to broker.`,
      data: {
        subscriptionId: subscription.id,
        tradeMode
      }
    });
  } catch (error) {
    console.error('Set trade mode error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set trade mode',
      message: error.message
    });
  }
};

/**
 * Get user's brokers (API keys) for a subscription
 * GET /api/subscriptions/:id/brokers
 */
export const getSubscriptionBrokers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const subscription = await StrategySubscription.findOne({
      where: { id, userId }
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    // Get user's API keys (brokers)
    const apiKeys = await ApiKey.findAll({
      where: { userId },
      attributes: ['id', 'broker', 'apiName', 'appName', 'segment', 'status', 'isDefault']
    });

    // Get selected brokers for this strategy
    const selectedBrokers = await StrategyBroker.findAll({
      where: {
        strategyId: subscription.strategyId,
        isActive: true
      },
      include: [{
        model: ApiKey,
        as: 'apiKey',
        where: { userId },
        attributes: ['id'],
        required: true
      }]
    });

    const selectedBrokerIds = selectedBrokers.map(sb => sb.apiKeyId);

    // Format response with selection status
    const brokersWithSelection = apiKeys.map(apiKey => ({
      id: apiKey.id,
      broker: apiKey.broker,
      accountName: apiKey.apiName || apiKey.appName,
      segment: apiKey.segment,
      isActive: apiKey.status === 'Active',
      isConnected: apiKey.status === 'Active',
      isDefault: apiKey.isDefault || false,
      isSelected: selectedBrokerIds.includes(apiKey.id)
    }));

    res.json({
      success: true,
      data: brokersWithSelection
    });
  } catch (error) {
    console.error('Get subscription brokers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brokers',
      message: error.message
    });
  }
};

/**
 * Update selected brokers for a subscription
 * PUT /api/subscriptions/:id/brokers
 */
export const updateSubscriptionBrokers = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { brokerIds } = req.body; // Array of API key IDs to select

    if (!Array.isArray(brokerIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'brokerIds must be an array of API key IDs' 
      });
    }

    const subscription = await StrategySubscription.findOne({
      where: { id, userId }
    });

    if (!subscription) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const strategyId = subscription.strategyId;

    // Verify that all provided broker IDs belong to this user
    const validApiKeys = await ApiKey.findAll({
      where: { id: brokerIds, userId },
      attributes: ['id'],
      transaction
    });

    const validIds = validApiKeys.map(ak => ak.id);
    const invalidIds = brokerIds.filter(id => !validIds.includes(id));

    if (invalidIds.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Some broker IDs are invalid or do not belong to you',
        invalidIds
      });
    }

    // Deactivate all existing broker selections for this user's strategy
    await StrategyBroker.update(
      { isActive: false },
      { 
        where: { 
          strategyId,
          apiKeyId: await ApiKey.findAll({ 
            where: { userId }, 
            attributes: ['id'],
            raw: true
          }).then(keys => keys.map(k => k.id))
        },
        transaction 
      }
    );

    // Create or update broker selections
    for (const apiKeyId of validIds) {
      const [strategyBroker, created] = await StrategyBroker.findOrCreate({
        where: { strategyId, apiKeyId },
        defaults: { isActive: true },
        transaction
      });

      if (!created) {
        await strategyBroker.update({ isActive: true }, { transaction });
      }
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `${validIds.length} broker(s) selected for this strategy`,
      data: {
        subscriptionId: subscription.id,
        selectedBrokerIds: validIds
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Update subscription brokers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update brokers',
      message: error.message
    });
  }
};