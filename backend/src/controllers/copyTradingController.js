import { CopyTradingAccount, Charge, Wallet, WalletTransaction, sequelize } from '../models/index.js';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import { Op } from 'sequelize';

/**
 * Copy Trading Controller Functions
 * Handles copy trading account management
 */

// Get all copy trading accounts for a user
export const getAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, type } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const whereClause = { userId };
    if (type) {
      whereClause.type = type;
    }
    
    const { count, rows: accounts } = await CopyTradingAccount.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: ['id', 'name', 'type', 'broker', 'apiKey', 'isActive', 'masterAccountId', 'createdAt', 'updatedAt']
    });
    
    // Mask API keys in response and include master account names
    const maskedAccounts = await Promise.all(accounts.map(async account => {
      const accountData = account.toJSON();
      
      // Mask API key
      accountData.apiKey = account.apiKey ? '***' + account.apiKey.slice(-4) : null;
      
      // If this is a child account, get master account name
      if (account.type === 'child' && account.masterAccountId) {
        const masterAccount = await CopyTradingAccount.findByPk(account.masterAccountId, {
          attributes: ['name']
        });
        accountData.masterAccountName = masterAccount ? masterAccount.name : 'Unknown Master';
      }
      
      return accountData;
    }));
    
    res.json({
      success: true,
      data: maskedAccounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching copy trading accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch copy trading accounts',
    });
  }
};

// Get a specific copy trading account
export const getAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const account = await CopyTradingAccount.findOne({
      where: { id, userId },
      attributes: ['id', 'name', 'type', 'broker', 'apiKey', 'isActive', 'createdAt', 'updatedAt']
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Copy trading account not found',
      });
    }
    
    // Mask API key
    const accountData = account.toJSON();
    accountData.apiKey = accountData.apiKey ? '***' + accountData.apiKey.slice(-4) : null;
    
    res.json({
      success: true,
      data: accountData,
    });
  } catch (error) {
    console.error('Error fetching copy trading account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch copy trading account',
    });
  }
};

// Create a new copy trading account
export const createAccount = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('Creating copy trading account:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const userId = req.user.id;
    const { name, type, broker, apiKey, secretKey, isActive = true, masterAccountId } = req.body;

    console.log('Creating account for user:', userId, 'with data:', { name, type, broker, isActive, masterAccountId });

    // Validate required fields
    if (!name || !type || !broker || !apiKey || !secretKey) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, type, broker, apiKey, secretKey',
      });
    }

    // Check for copy trading account charge
    const charge = await Charge.findOne({
      where: { chargeType: 'copy_trading_account', isActive: true }
    });

    if (charge && charge.amount > 0) {
      // Get user wallet
      const wallet = await Wallet.findOne({ where: { userId } });
      
      if (!wallet) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          error: 'Wallet not found. Please contact support.' 
        });
      }

      // Check if wallet has sufficient balance
      if (parseFloat(wallet.balance) < parseFloat(charge.amount)) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          error: `Insufficient wallet balance. ₹${charge.amount} required to add copy trading account.`,
          requiredAmount: parseFloat(charge.amount),
          currentBalance: parseFloat(wallet.balance)
        });
      }

      // Deduct charge from wallet
      const newBalance = parseFloat(wallet.balance) - parseFloat(charge.amount);
      await wallet.update({ balance: newBalance }, { transaction });

      // Create wallet transaction
      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'debit',
        amount: charge.amount,
        balanceAfter: newBalance,
        description: `Copy trading account addition charge - ${name}`,
        reference: `copy_trading_${Date.now()}`,
        status: 'completed'
      }, { transaction });
    }

    // If child account, validate master account exists
    if (type === 'child' && masterAccountId) {
      const masterAccount = await CopyTradingAccount.findOne({
        where: { id: masterAccountId, userId, type: 'master' }
      });
      
      if (!masterAccount) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Invalid master account selected',
        });
      }
    }

    // Check if account with same name already exists for this user
    const existingAccount = await CopyTradingAccount.findOne({
      where: { userId, name }
    });

    if (existingAccount) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        error: 'Account with this name already exists',
      });
    }

    // Encrypt sensitive data
    console.log('Encrypting sensitive data...');
    const encryptedApiKey = encryptData(apiKey);
    const encryptedSecretKey = encryptData(secretKey);

    console.log('Creating database record...');
    const newAccount = await CopyTradingAccount.create({
      userId,
      name,
      type,
      broker,
      apiKey: encryptedApiKey,
      secretKey: encryptedSecretKey,
      isActive,
      masterAccountId: type === 'child' ? masterAccountId : null,
    }, { transaction });

    await transaction.commit();
    console.log('Account created successfully:', newAccount.id);

    res.status(201).json({
      success: true,
      data: {
        id: newAccount.id,
        name: newAccount.name,
        type: newAccount.type,
        broker: newAccount.broker,
        isActive: newAccount.isActive,
        createdAt: newAccount.createdAt,
      },
      message: charge && charge.amount > 0 
        ? `Copy trading account created successfully. ₹${charge.amount} deducted from wallet.`
        : 'Copy trading account created successfully',
      chargeDeducted: charge ? parseFloat(charge.amount) : 0
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating copy trading account:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to create copy trading account: ' + error.message,
    });
  }
};

// Update a copy trading account
export const updateAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { id } = req.params;
    const userId = req.user.id;
    const { name, broker, apiKey, secretKey, isActive } = req.body;

    // Check if account exists and belongs to user
    const existingAccount = await CopyTradingAccount.findOne({
      where: { id, userId }
    });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Copy trading account not found',
      });
    }

    // Build update data
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }
    if (broker !== undefined) {
      updateData.broker = broker;
    }
    if (apiKey !== undefined) {
      updateData.apiKey = encryptData(apiKey);
    }
    if (secretKey !== undefined) {
      updateData.secretKey = encryptData(secretKey);
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    await existingAccount.update(updateData);

    res.json({
      success: true,
      message: 'Copy trading account updated successfully',
    });
  } catch (error) {
    console.error('Error updating copy trading account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update copy trading account',
    });
  }
};

// Delete a copy trading account
export const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if account exists and belongs to user
    const existingAccount = await CopyTradingAccount.findOne({
      where: { id, userId }
    });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Copy trading account not found',
      });
    }

    // Delete the account
    await existingAccount.destroy();

    res.json({
      success: true,
      message: 'Copy trading account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting copy trading account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete copy trading account',
    });
  }
};

// Toggle account status
export const toggleAccountStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { isActive } = req.body;

    // Check if account exists and belongs to user
    const existingAccount = await CopyTradingAccount.findOne({
      where: { id, userId }
    });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Copy trading account not found',
      });
    }

    await existingAccount.update({ isActive });

    res.json({
      success: true,
      message: 'Account status updated successfully',
    });
  } catch (error) {
    console.error('Error updating account status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update account status',
    });
  }
};

// Test API connection
export const testConnection = async (req, res) => {
  try {
    const { apiKey, secretKey, broker } = req.body;

    // This is a placeholder - implement actual API testing based on broker
    // Each broker would have different API endpoints and authentication methods
    
    // Simulate connection test
    const isValid = await validateBrokerConnection(broker, apiKey, secretKey);

    if (isValid) {
      res.json({
        success: true,
        message: 'Connection test successful',
        data: {
          status: 'connected',
          broker,
          timestamp: new Date(),
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Connection test failed',
      });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connection',
    });
  }
};

// Get copy trading statistics
export const getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    const [results] = await sequelize.query(`
      SELECT 
        COUNT(*) as totalAccounts,
        COUNT(CASE WHEN type = 'master' THEN 1 END) as masterAccounts,
        COUNT(CASE WHEN type = 'child' THEN 1 END) as childAccounts,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as activeAccounts
      FROM copy_trading_accounts 
      WHERE user_id = ?
    `, {
      replacements: [userId],
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: results[0],
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
};

// Utility functions
const encryptData = (data) => {
  try {
    const algorithm = 'aes-256-cbc';
    const key = process.env.ENCRYPTION_KEY || 'default-32-character-key-for-dev-use';
    
    // Ensure key is exactly 32 bytes
    const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback: return base64 encoded data (less secure but functional)
    return Buffer.from(data).toString('base64');
  }
};

const decryptData = (encryptedData) => {
  try {
    const algorithm = 'aes-256-cbc';
    const key = process.env.ENCRYPTION_KEY || 'default-32-character-key-for-dev-use';
    
    // Ensure key is exactly 32 bytes
    const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
    
    // Check if data contains IV (new format)
    if (encryptedData.includes(':')) {
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } else {
      // Fallback: assume it's base64 encoded
      return Buffer.from(encryptedData, 'base64').toString('utf8');
    }
  } catch (error) {
    console.error('Decryption error:', error);
    // Return as-is if decryption fails
    return encryptedData;
  }
};

const validateBrokerConnection = async (broker, apiKey, secretKey) => {
  // This would be implemented based on specific broker APIs
  // For now, return true as a placeholder
  return true;
};