import { ApiKey, Broker, Charge, Wallet, WalletTransaction, sequelize } from '../models/index.js';
import { Op } from 'sequelize';

// Get user's API keys
export const getUserApiKeys = async (req, res) => {
  try {
    const userId = req.user.id;
    const { segment, status, page = 1, limit = 10 } = req.query;

    const where = { userId };
    if (segment) where.segment = segment;
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const apiKeys = await ApiKey.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['apiKey', 'apiSecret'] } // Don't send actual keys
    });

    // Map fields for frontend compatibility
    const mappedApiKeys = apiKeys.rows.map(apiKey => {
      const data = apiKey.toJSON();
      return {
        ...data,
        brokerName: data.broker, // Map broker to brokerName for frontend
        isActive: data.status === 'Active', // Map status to boolean isActive
        autoLogin: data.autologin || false // Ensure autoLogin is boolean
      };
    });

    res.json({
      success: true,
      data: mappedApiKeys,
      pagination: {
        total: apiKeys.count,
        page: parseInt(page),
        pages: Math.ceil(apiKeys.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
};

export const createApiKey = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { 
      segment, broker, apiName, brokerId, mpin, totp, 
      apiKey, apiSecret, passphrase, autoLogin, isDefault,
      // CCXT exchange specific fields
      exchangeId, accountType,
      // MT5 specific fields
      appName, accessToken
    } = req.body;

    // Validate required fields based on broker type
    const isMT5 = broker === 'MT5';
    const isCrypto = segment === 'Crypto';
    
    // Common validation for all brokers
    if (!segment || !broker) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Missing required fields: segment, broker' 
      });
    }
    
    if (isMT5) {
      // MT5 validation - apiName is optional
      if (!appName || !accessToken) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'App Name and Access Token are required for MT5' 
        });
      }
    } else if (isCrypto) {
      // Crypto exchange validation - exchangeId and API key/secret required
      if (!apiKey || !apiSecret) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'API Key and API Secret are required for crypto exchanges' 
        });
      }
    } else {
      // Indian brokers validation - all fields required
      if (!apiName || !apiKey || !apiSecret) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'API Name, API Key and API Secret are required' 
        });
      }
    }

    // Check for API key charge
    const charge = await Charge.findOne({
      where: { chargeType: 'api_key', isActive: true }
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
          error: `Insufficient wallet balance. ₹${charge.amount} required to add API key.`,
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
        description: `API key addition charge - ${apiName}`,
        reference: `api_key_${Date.now()}`,
        status: 'completed'
      }, { transaction });
    }

    // If isDefault is true, unset other default APIs in the same segment
    if (isDefault) {
      await ApiKey.update(
        { isDefault: false },
        { 
          where: { 
            userId, 
            segment,
            isDefault: true 
          },
          transaction 
        }
      );
    }

    const newApiKey = await ApiKey.create({
      userId,
      segment,
      broker,
      exchangeId: exchangeId || null,
      accountType: accountType || 'spot',
      apiName,
      brokerId: brokerId || null,
      mpin: mpin || null,
      totp: totp || null,
      apiKey: apiKey || null,
      apiSecret: apiSecret || null,
      passphrase: passphrase || null,
      // MT5 specific fields
      appName: appName || null,
      accessToken: accessToken || null,
      autologin: autoLogin || false,
      isDefault: isDefault || false,
      status: 'Active'
    }, { transaction });

    await transaction.commit();

    // Don't return actual keys in response and map fields for frontend
    const response = newApiKey.toJSON();
    delete response.apiKey;
    delete response.apiSecret;
    
    // Map fields for frontend compatibility
    const mappedResponse = {
      ...response,
      brokerName: response.broker,
      isActive: response.status === 'Active',
      autoLogin: response.autologin || false
    };

    res.status(201).json({
      success: true,
      message: charge && charge.amount > 0 
        ? `API key created successfully. ₹${charge.amount} deducted from wallet.`
        : 'API key created successfully',
      data: mappedResponse,
      chargeDeducted: charge ? parseFloat(charge.amount) : 0
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Create API key error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      sql: error.sql,
      parameters: error.parameters
    });
    res.status(500).json({ 
      error: 'Failed to create API key',
      details: error.message 
    });
  }
};

// Get API key by ID (with actual keys for verification)
export const getApiKeyById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      where: { id, userId },
      include: [
        {
          model: Broker,
          as: 'broker',
          attributes: ['id', 'name', 'segment', 'apiBaseUrl']
        }
      ]
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({ error: 'Failed to fetch API key' });
  }
};

// Update API key
export const updateApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    const apiKey = await ApiKey.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // If setting as default, unset other defaults for this segment
    if (updateData.isDefault) {
      await ApiKey.update(
        { isDefault: false },
        { where: { userId, segment: apiKey.segment, id: { [Op.ne]: id } } }
      );
    }

    // Map frontend fields to database fields
    if ('isActive' in updateData) {
      updateData.status = updateData.isActive ? 'Active' : 'Inactive';
      delete updateData.isActive;
    }
    if ('autoLogin' in updateData) {
      updateData.autologin = updateData.autoLogin;
      delete updateData.autoLogin;
    }
    
    // Don't allow updating certain fields
    delete updateData.userId;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.brokerName; // This is computed from broker field

    await apiKey.update(updateData);

    // Don't return actual keys and map fields for frontend
    const response = apiKey.toJSON();
    delete response.apiKey;
    delete response.apiSecret;
    
    // Map fields for frontend compatibility
    const mappedResponse = {
      ...response,
      brokerName: response.broker,
      isActive: response.status === 'Active',
      autoLogin: response.autologin || false
    };

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: mappedResponse
    });
  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
};

// Delete API key
export const deleteApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await apiKey.destroy();

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
};

// Verify API key
export const verifyApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    let isValid = false;
    let balance = 0;
    let verificationError = null;

    // Verify based on broker type
    if (apiKey.broker === 'MT5' && apiKey.accessToken && apiKey.appName) {
      try {
        console.log(`🔍 Verifying MT5 API for user ${userId}, appName: ${apiKey.appName}`);
        
        // Import MT5 broker pool
        const mt5BrokerPool = (await import('../utils/mt5BrokerPool.js')).default;
        
        // Get MT5 connection
        const mt5Broker = await mt5BrokerPool.getConnection(
          apiKey.accessToken,
          apiKey.appName
        );
        
        // Fetch account info to verify and get balance
        const accountInfo = await mt5Broker.getAccountInfo();
        console.log(`📊 MT5 Account Info:`, accountInfo);
        
        if (accountInfo && accountInfo.balance !== undefined) {
          isValid = true;
          balance = parseFloat(accountInfo.balance) || 0;
          console.log(`✅ MT5 API verified for user ${userId}, balance: $${balance}`);
        } else {
          console.log(`⚠️ MT5 API verification failed - no balance data`);
        }
        
        // Release connection
        mt5BrokerPool.releaseConnection(apiKey.appName);
        
      } catch (error) {
        console.error('MT5 verification error:', error);
        verificationError = error.message;
        isValid = false;
      }
    } else if (apiKey.exchangeId && apiKey.apiKey && apiKey.apiSecret) {
      // For CCXT exchanges
      try {
        console.log(`🔍 Verifying ${apiKey.exchangeId} API for user ${userId}`);
        
        const ccxt = await import('ccxt');
        const ExchangeClass = ccxt[apiKey.exchangeId];
        
        if (!ExchangeClass) {
          throw new Error(`Exchange ${apiKey.exchangeId} not supported`);
        }
        
        const exchange = new ExchangeClass({
          apiKey: apiKey.apiKey,
          secret: apiKey.apiSecret,
          ...(apiKey.passphrase && { password: apiKey.passphrase })
        });
        
        // Fetch balance to verify
        const balanceData = await exchange.fetchBalance();
        console.log(`📊 ${apiKey.exchangeId} Balance Data:`, balanceData.total);
        
        if (balanceData && balanceData.total) {
          isValid = true;
          // Get balance from various currencies (prioritize stablecoins and major currencies)
          balance = balanceData.total['USDT'] || 
                   balanceData.total['USD'] || 
                   balanceData.total['USDC'] ||
                   balanceData.total['INR'] ||  // For Indian exchanges like Delta, WazirX, CoinDCX
                   balanceData.total['BTC'] || 
                   balanceData.total['ETH'] || 
                   0;
          
          // If still 0, get the first non-zero balance
          if (balance === 0) {
            const currencies = Object.keys(balanceData.total);
            for (const currency of currencies) {
              if (balanceData.total[currency] > 0) {
                balance = balanceData.total[currency];
                console.log(`📊 Using ${currency} balance: ${balance}`);
                break;
              }
            }
          }
          
          console.log(`✅ ${apiKey.exchangeId} API verified for user ${userId}, balance: ${balance}`);
        } else {
          console.log(`⚠️ ${apiKey.exchangeId} API verification failed - no balance data`);
        }
        
      } catch (error) {
        console.error('CCXT verification error:', error);
        verificationError = error.message;
        isValid = false;
      }
    } else {
      verificationError = 'Missing required credentials for verification';
    }

    // Update API key with verification status and balance
    await apiKey.update({
      status: isValid ? 'Active' : 'Inactive',
      autologin: isValid ? true : apiKey.autologin, // Enable autologin if verified successfully
      balance: isValid ? balance : 0,
      lastBalanceUpdate: isValid ? new Date() : null
    });

    console.log(`💾 Updated API key ${id} - Status: ${isValid ? 'Active' : 'Inactive'}, Balance: $${balance}`);

    res.json({
      success: isValid,
      message: isValid ? 'API key verified successfully' : `Verification failed: ${verificationError}`,
      data: {
        status: apiKey.status,
        balance: isValid ? balance : 0,
        autologin: apiKey.autologin,
        lastBalanceUpdate: apiKey.lastBalanceUpdate
      }
    });
  } catch (error) {
    console.error('Verify API key error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify API key',
      details: error.message 
    });
  }
};

// Set default API key for segment
export const setDefaultApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Unset other defaults for this segment
    await ApiKey.update(
      { isDefault: false },
      { where: { userId, segment: apiKey.segment, id: { [Op.ne]: id } } }
    );

    // Set this one as default
    await apiKey.update({ isDefault: true });

    res.json({
      success: true,
      message: 'Default API key set successfully',
      data: apiKey
    });
  } catch (error) {
    console.error('Set default API key error:', error);
    res.status(500).json({ error: 'Failed to set default API key' });
  }
};

// Admin: Get all API keys
export const getAllApiKeys = async (req, res) => {
  try {
    const { segment, status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (segment) where.segment = segment;
    if (status) where.status = status;

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
          attributes: ['id', 'name', 'segment']
        }
      ],
      attributes: { exclude: ['apiKey', 'apiSecret'] }
    });

    res.json({
      success: true,
      data: apiKeys.rows,
      pagination: {
        total: apiKeys.count,
        page: parseInt(page),
        pages: Math.ceil(apiKeys.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all API keys error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
};

// Refresh balance for a specific API key
export const refreshBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      return res.status(404).json({ 
        success: false,
        error: 'API key not found' 
      });
    }

    let balance = 0;
    let error = null;

    try {
      if (apiKey.segment === 'Crypto' && apiKey.exchangeId) {
        console.log(`🔄 Refreshing balance for ${apiKey.exchangeId} API (ID: ${id})`);
        
        // Use exchangeService to get exchange instance
        const exchangeService = await import('../services/exchangeService.js');
        
        // Get the exchange instance with plain API keys
        const exchange = await exchangeService.getExchangeInstance(
          apiKey.exchangeId,
          apiKey.apiKey,      // Plain text API key
          apiKey.apiSecret,   // Plain text API secret
          apiKey.passphrase,  // Plain text passphrase (if any)
          { defaultType: apiKey.accountType || 'spot' }
        );
        
        // Fetch balance using the service
        const balanceResult = await exchangeService.fetchBalance(exchange);
        console.log(`📊 ${apiKey.exchangeId} Balance Result:`, balanceResult);
        
        if (balanceResult.success && balanceResult.data) {
          // Get balance from the returned data
          const currencies = Object.keys(balanceResult.data);
          
          // Priority order for currencies
          const priorityCurrencies = ['USDT', 'USD', 'USDC', 'INR', 'BTC', 'ETH'];
          
          for (const currency of priorityCurrencies) {
            if (balanceResult.data[currency] && balanceResult.data[currency].total > 0) {
              balance = balanceResult.data[currency].total;
              console.log(`📊 Using ${currency} balance: ${balance}`);
              break;
            }
          }
          
          // If still 0, get the first non-zero balance
          if (balance === 0 && currencies.length > 0) {
            for (const currency of currencies) {
              if (balanceResult.data[currency].total > 0) {
                balance = balanceResult.data[currency].total;
                console.log(`📊 Using ${currency} balance: ${balance}`);
                break;
              }
            }
          }
          
          console.log(`✅ Balance refreshed: ${balance}`);
        } else {
          error = balanceResult.error || 'Failed to fetch balance';
        }
      } else if (apiKey.segment === 'Forex' && apiKey.appName && apiKey.accessToken) {
        // MT5 balance refresh logic (existing)
        const { MetaApi } = await import('metaapi.cloud-sdk');
        const metaApiToken = process.env.METAAPI_TOKEN;
        
        if (!metaApiToken) {
          throw new Error('MetaAPI token not configured');
        }
        
        const api = new MetaApi(metaApiToken);
        const account = await api.metatraderAccountApi.getAccount(apiKey.appName);
        
        if (!account) {
          throw new Error('MetaAPI account not found');
        }
        
        await account.deploy();
        await account.waitDeployed();
        
        const connection = account.getRPCConnection();
        await connection.connect();
        await connection.waitSynchronized();
        
        const accountInfo = await connection.getAccountInformation();
        balance = parseFloat(accountInfo.balance) || 0;
        
        console.log(`✅ MT5 balance refreshed: ${balance}`);
      }
    } catch (err) {
      console.error('Balance refresh error:', err);
      error = err.message;
    }

    // Only update balance if there was no error
    if (!error) {
      await apiKey.update({
        balance: balance,
        lastBalanceUpdate: new Date()
      });
    }

    // Return appropriate response
    if (error) {
      return res.status(400).json({
        success: false,
        error: error,
        message: `Failed to refresh balance: ${error}`
      });
    }

    res.json({
      success: true,
      message: 'Balance refreshed successfully',
      data: {
        balance: balance,
        lastBalanceUpdate: apiKey.lastBalanceUpdate
      }
    });
  } catch (error) {
    console.error('Refresh balance error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to refresh balance',
      details: error.message 
    });
  }
};

// Test API connection
export const testApiConnection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Fetch the API key
    const apiKey = await ApiKey.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    let testResult = null;

    // Test based on segment
    if (apiKey.segment === 'Crypto') {
      // Import exchange service dynamically
      const exchangeService = await import('../services/exchangeService.js');
      
      // Get exchange instance
      const exchange = await exchangeService.getExchangeInstance(
        apiKey.exchangeId || apiKey.broker,
        apiKey.apiKey,
        apiKey.apiSecret,
        apiKey.passphrase,
        { defaultType: apiKey.accountType || 'spot' }
      );

      // Try to fetch balance as a test
      const balanceResult = await exchangeService.fetchBalance(exchange);
      
      if (balanceResult.success) {
        testResult = {
          success: true,
          message: 'Connection successful! API credentials are valid.',
          data: {
            exchange: exchange.name,
            balanceAvailable: Object.keys(balanceResult.data).length > 0,
            currencies: Object.keys(balanceResult.data).slice(0, 5)
          }
        };
      } else {
        testResult = {
          success: false,
          message: balanceResult.error || 'Failed to connect to exchange'
        };
      }
    } else if (apiKey.segment === 'Forex' && apiKey.broker === 'MT5') {
      // Test MT5 connection
      const mt5BrokerPool = await import('../utils/mt5BrokerPool.js');
      const pool = mt5BrokerPool.default;

      try {
        const broker = await pool.getConnection(apiKey.accessToken, apiKey.appName);
        const accountInfo = await broker.getAccountInfo();
        
        pool.releaseConnection(apiKey.appName);

        testResult = {
          success: true,
          message: 'MT5 connection successful!',
          data: {
            broker: accountInfo.broker,
            balance: accountInfo.balance,
            currency: accountInfo.currency,
            leverage: accountInfo.leverage
          }
        };
      } catch (error) {
        testResult = {
          success: false,
          message: `MT5 connection failed: ${error.message}`
        };
      }
    } else if (apiKey.segment === 'Indian') {
      // For Indian brokers, we'll do a basic validation
      // In a real implementation, you would call the broker's API to verify
      if (apiKey.apiKey && apiKey.apiSecret) {
        testResult = {
          success: true,
          message: 'API credentials found. Full validation requires broker API integration.',
          data: {
            broker: apiKey.broker,
            segment: apiKey.segment,
            note: 'Test connection for Indian brokers will be implemented based on specific broker APIs'
          }
        };
      } else {
        testResult = {
          success: false,
          message: 'Missing API credentials'
        };
      }
    } else {
      testResult = {
        success: false,
        message: 'Connection test not available for this broker type'
      };
    }

    res.json(testResult);
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error.message
    });
  }
};
