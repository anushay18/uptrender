import { Wallet, WalletTransaction, User, Notification, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { emitWalletUpdate, emitDashboardUpdate, emitNotification } from '../config/socket.js';

// Get user's wallet
export const getUserWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    let wallet = await Wallet.findOne({
      where: { userId }
    });

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      });
    }

    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
};

// Get wallet transactions
export const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, page = 1, limit = 10 } = req.query;

    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const where = { walletId: wallet.id };
    if (type) where.type = type;

    const offset = (page - 1) * limit;

    const transactions = await WalletTransaction.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: transactions.rows,
      pagination: {
        total: transactions.count,
        page: parseInt(page),
        pages: Math.ceil(transactions.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// Add funds (credit)
export const addFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, description, reference } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    let wallet = await Wallet.findOne({ where: { userId } });

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      });
    }

    if (wallet.status !== 'Active') {
      return res.status(400).json({ error: 'Wallet is not active' });
    }

    // Use transaction to ensure atomicity
    const result = await sequelize.transaction(async (t) => {
      // Update wallet balance
      const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
      await wallet.update({ balance: newBalance }, { transaction: t });

      // Create transaction record
      const transaction = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'Credit',
        amount,
        description: description || 'Funds added',
        reference,
        balanceAfter: newBalance
      }, { transaction: t });

      return { wallet, transaction };
    });

    // Emit real-time wallet update
    emitWalletUpdate(userId, result.wallet, result.transaction);
    emitDashboardUpdate(userId, { wallet: { balance: result.wallet.balance } });

    // Create notification for fund addition
    const notification = await Notification.create({
      userId,
      type: 'wallet',
      title: 'Funds Added',
      message: `₹${parseFloat(amount).toFixed(2)} has been credited to your wallet. New balance: ₹${result.wallet.balance.toFixed(2)}`,
      metadata: {
        transactionId: result.transaction.id,
        amount: amount,
        type: 'credit',
        link: '/user/wallet'
      },
      isRead: false
    });
    emitNotification(userId, notification);

    res.json({
      success: true,
      message: 'Funds added successfully',
      data: result
    });
  } catch (error) {
    console.error('Add funds error:', error);
    res.status(500).json({ error: 'Failed to add funds' });
  }
};

// Withdraw funds (debit)
export const withdrawFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, description, reference } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (wallet.status !== 'Active') {
      return res.status(400).json({ error: 'Wallet is not active' });
    }

    if (parseFloat(wallet.balance) < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Use transaction to ensure atomicity
    const result = await sequelize.transaction(async (t) => {
      // Update wallet balance
      const newBalance = parseFloat(wallet.balance) - parseFloat(amount);
      await wallet.update({ balance: newBalance }, { transaction: t });

      // Create transaction record
      const transaction = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'Debit',
        amount,
        description: description || 'Funds withdrawn',
        reference,
        balanceAfter: newBalance
      }, { transaction: t });

      return { wallet, transaction };
    });

    // Emit real-time wallet update
    emitWalletUpdate(userId, result.wallet, result.transaction);
    emitDashboardUpdate(userId, { wallet: { balance: result.wallet.balance } });

    // Create notification for withdrawal
    const notification = await Notification.create({
      userId,
      type: 'wallet',
      title: 'Funds Withdrawn',
      message: `₹${parseFloat(amount).toFixed(2)} has been debited from your wallet. New balance: ₹${result.wallet.balance.toFixed(2)}`,
      metadata: {
        transactionId: result.transaction.id,
        amount: amount,
        type: 'debit',
        link: '/user/wallet'
      },
      isRead: false
    });
    emitNotification(userId, notification);

    res.json({
      success: true,
      message: 'Funds withdrawn successfully',
      data: result
    });
  } catch (error) {
    console.error('Withdraw funds error:', error);
    res.status(500).json({ error: 'Failed to withdraw funds' });
  }
};

// Get wallet statistics
export const getWalletStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const stats = await WalletTransaction.findAll({
      where: { walletId: wallet.id },
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['type']
    });

    const totalTransactions = await WalletTransaction.count({
      where: { walletId: wallet.id }
    });

    const recentTransactions = await WalletTransaction.findAll({
      where: { walletId: wallet.id },
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        currency: wallet.currency,
        status: wallet.status,
        totalTransactions,
        stats: stats.reduce((acc, stat) => {
          acc[stat.type.toLowerCase()] = {
            count: parseInt(stat.dataValues.count),
            total: parseFloat(stat.dataValues.total) || 0
          };
          return acc;
        }, {}),
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Get wallet stats error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet statistics' });
  }
};

// Freeze wallet (admin/security)
export const freezeWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    await wallet.update({ status: 'Frozen' });

    res.json({
      success: true,
      message: 'Wallet frozen successfully',
      data: wallet
    });
  } catch (error) {
    console.error('Freeze wallet error:', error);
    res.status(500).json({ error: 'Failed to freeze wallet' });
  }
};

// Unfreeze wallet (admin)
export const unfreezeWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    await wallet.update({ status: 'Active' });

    res.json({
      success: true,
      message: 'Wallet unfrozen successfully',
      data: wallet
    });
  } catch (error) {
    console.error('Unfreeze wallet error:', error);
    res.status(500).json({ error: 'Failed to unfreeze wallet' });
  }
};

// Admin: Get all wallets
export const getAllWallets = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const wallets = await Wallet.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['balance', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }
      ]
    });

    // Get total balance across all wallets
    const totalBalance = await Wallet.sum('balance', { where });

    res.json({
      success: true,
      data: wallets.rows,
      pagination: {
        total: wallets.count,
        page: parseInt(page),
        pages: Math.ceil(wallets.count / limit),
        limit: parseInt(limit)
      },
      summary: {
        totalBalance: totalBalance || 0
      }
    });
  } catch (error) {
    console.error('Get all wallets error:', error);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
};

// Admin transfer funds to user
export const adminTransferFunds = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const adminId = req.user.id;
    const { userId } = req.params;
    const { amount, description = 'Admin wallet transfer' } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get admin wallet
    let adminWallet = await Wallet.findOne({
      where: { userId: adminId },
      transaction
    });

    if (!adminWallet) {
      adminWallet = await Wallet.create({
        userId: adminId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      }, { transaction });
    }

    // Check admin balance
    if (adminWallet.balance < amount) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Insufficient balance in admin wallet',
        adminBalance: adminWallet.balance,
        required: amount
      });
    }

    // Get or create user wallet
    let userWallet = await Wallet.findOne({
      where: { userId },
      transaction
    });

    if (!userWallet) {
      userWallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      }, { transaction });
    }

    // Update balances
    await adminWallet.update({
      balance: parseFloat(adminWallet.balance) - parseFloat(amount)
    }, { transaction });

    await userWallet.update({
      balance: parseFloat(userWallet.balance) + parseFloat(amount)
    }, { transaction });

    // Create admin debit transaction
    await WalletTransaction.create({
      walletId: adminWallet.id,
      type: 'DEBIT',
      amount: parseFloat(amount),
      description: `${description} (Transfer to user ID: ${userId})`,
      reference: `ADMIN_TRANSFER_${Date.now()}`,
      status: 'COMPLETED'
    }, { transaction });

    // Create user credit transaction
    await WalletTransaction.create({
      walletId: userWallet.id,
      type: 'CREDIT',
      amount: parseFloat(amount),
      description: `${description} (From admin)`,
      reference: `ADMIN_TRANSFER_${Date.now()}`,
      status: 'COMPLETED'
    }, { transaction });

    // Create notification for user
    await Notification.create({
      userId: userId,
      title: 'Wallet Credit',
      message: `₹${amount} has been credited to your wallet by admin`,
      type: 'wallet_credit',
      data: { amount }
    }, { transaction });

    await transaction.commit();

    // Emit real-time updates
    emitWalletUpdate(adminId, {
      balance: adminWallet.balance - amount,
      lastTransaction: { type: 'DEBIT', amount }
    });

    emitWalletUpdate(userId, {
      balance: userWallet.balance + parseFloat(amount),
      lastTransaction: { type: 'CREDIT', amount }
    });

    emitNotification(userId, {
      title: 'Wallet Credit',
      message: `₹${amount} credited by admin`,
      type: 'wallet_credit'
    });

    res.json({
      success: true,
      message: 'Funds transferred successfully',
      data: {
        adminBalance: parseFloat(adminWallet.balance) - parseFloat(amount),
        userBalance: parseFloat(userWallet.balance) + parseFloat(amount),
        transferAmount: parseFloat(amount)
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Admin transfer funds error:', error);
    res.status(500).json({ error: 'Failed to transfer funds' });
  }
};
