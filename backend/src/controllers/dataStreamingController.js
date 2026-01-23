/**
 * Data Streaming Settings Controller
 * 
 * Admin-only endpoints for managing centralized data streaming configuration.
 */

import { DataStreamingSettings } from '../models/index.js';
import centralizedStreamingService from '../services/CentralizedStreamingService.js';

/**
 * Get current streaming settings
 */
export const getStreamingSettings = async (req, res) => {
  try {
    let settings = await DataStreamingSettings.findByPk(1);
    
    // Create default settings if not exists
    if (!settings) {
      settings = await DataStreamingSettings.create({
        id: 1,
        is_active: false,
        connection_status: 'disconnected',
        symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD']
      });
    }
    
    // Get live status from service
    const liveStatus = centralizedStreamingService.getStatus();
    
    res.json({
      success: true,
      data: {
        settings: {
          id: settings.id,
          isActive: settings.is_active,
          connectionStatus: settings.connection_status,
          lastConnectedAt: settings.last_connected_at,
          lastError: settings.last_error,
          symbols: settings.symbols || [],
          stats: settings.stats || {},
          // Provider settings
          dataProvider: settings.data_provider || 'metaapi',
          // MetaAPI - Mask the token for security
          hasMetaApiToken: !!settings.metaapi_token,
          metaApiAccountId: settings.metaapi_account_id,
          // Deriv
          derivAppId: settings.deriv_app_id
        },
        liveStatus
      }
    });
  } catch (error) {
    console.error('Get streaming settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch streaming settings'
    });
  }
};

/**
 * Update streaming settings
 */
export const updateStreamingSettings = async (req, res) => {
  try {
    const { 
      metaapiToken, 
      metaapiAccountId, 
      isActive, 
      symbols,
      dataProvider,
      derivAppId
    } = req.body;
    
    let settings = await DataStreamingSettings.findByPk(1);
    
    if (!settings) {
      settings = await DataStreamingSettings.create({ id: 1 });
    }
    
    // Build update object
    const updateData = {};
    
    if (dataProvider !== undefined) {
      updateData.data_provider = dataProvider;
    }
    
    if (metaapiToken !== undefined) {
      updateData.metaapi_token = metaapiToken;
    }
    
    if (metaapiAccountId !== undefined) {
      updateData.metaapi_account_id = metaapiAccountId;
    }
    
    if (derivAppId !== undefined) {
      updateData.deriv_app_id = derivAppId;
    }
    
    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }
    
    if (symbols !== undefined && Array.isArray(symbols)) {
      updateData.symbols = symbols;
    }
    
    await settings.update(updateData);
    
    // Reload settings in service
    await centralizedStreamingService.reloadSettings();
    
    res.json({
      success: true,
      message: 'Streaming settings updated successfully',
      data: {
        isActive: settings.is_active,
        connectionStatus: settings.connection_status,
        symbols: settings.symbols,
        dataProvider: settings.data_provider || 'metaapi',
        hasMetaApiToken: !!settings.metaapi_token,
        metaApiAccountId: settings.metaapi_account_id,
        derivAppId: settings.deriv_app_id
      }
    });
  } catch (error) {
    console.error('Update streaming settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update streaming settings'
    });
  }
};

/**
 * Start/Connect streaming service
 */
export const startStreaming = async (req, res) => {
  try {
    // First enable streaming in settings
    const settings = await DataStreamingSettings.findByPk(1);
    
    if (!settings) {
      return res.status(400).json({
        success: false,
        error: 'Streaming settings not configured'
      });
    }
    
    const provider = settings.data_provider || 'metaapi';
    
    // Check credentials based on provider
    if (provider === 'deriv') {
      // Deriv uses free API, just need app_id (optional, defaults to 1089)
      console.log('📡 Starting Deriv streaming provider');
    } else {
      // MetaAPI requires credentials
      if (!settings.metaapi_token || !settings.metaapi_account_id) {
        return res.status(400).json({
          success: false,
          error: 'MetaAPI credentials not configured. Please add API token and account ID first.'
        });
      }
    }
    
    // Enable streaming
    await settings.update({ is_active: true });
    
    // Initialize/restart the service
    const result = await centralizedStreamingService.initialize();
    
    res.json({
      success: result.success,
      message: result.message,
      data: centralizedStreamingService.getStatus()
    });
  } catch (error) {
    console.error('Start streaming error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start streaming: ' + error.message
    });
  }
};

/**
 * Stop/Disconnect streaming service
 */
export const stopStreaming = async (req, res) => {
  try {
    // Disable streaming in settings
    const settings = await DataStreamingSettings.findByPk(1);
    if (settings) {
      await settings.update({ is_active: false });
    }
    
    // Stop the service
    await centralizedStreamingService.stop();
    
    res.json({
      success: true,
      message: 'Streaming service stopped',
      data: centralizedStreamingService.getStatus()
    });
  } catch (error) {
    console.error('Stop streaming error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop streaming'
    });
  }
};

/**
 * Restart streaming service
 */
export const restartStreaming = async (req, res) => {
  try {
    await centralizedStreamingService.restart();
    
    res.json({
      success: true,
      message: 'Streaming service restarted',
      data: centralizedStreamingService.getStatus()
    });
  } catch (error) {
    console.error('Restart streaming error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart streaming: ' + error.message
    });
  }
};
/**
 * Test connection for selected provider
 */
export const testConnection = async (req, res) => {
  try {
    const { metaapi_token, metaapi_account_id, provider, deriv_app_id } = req.body;
    const settings = await DataStreamingSettings.findByPk(1);
    
    const selectedProvider = provider || settings?.data_provider || 'metaapi';
    
    if (selectedProvider === 'deriv') {
      // Test Deriv connection
      const appId = deriv_app_id || settings?.deriv_app_id || '1089';
      
      const testResult = await centralizedStreamingService.testConnection({
        provider: 'deriv',
        derivAppId: appId
      });
      
      if (testResult.success) {
        res.json({
          success: true,
          message: 'Deriv connection test successful',
          data: testResult
        });
      } else {
        res.status(400).json({
          success: false,
          error: testResult.error || 'Deriv connection test failed'
        });
      }
    } else {
      // Test MetaAPI connection
      const tokenToUse = metaapi_token || settings?.metaapi_token;
      const accountIdToUse = metaapi_account_id || settings?.metaapi_account_id;
      
      if (!tokenToUse || !accountIdToUse) {
        return res.status(400).json({
          success: false,
          error: 'MetaAPI credentials not configured'
        });
      }
      
      const testResult = await centralizedStreamingService.testConnection({
        provider: 'metaapi',
        metaApiToken: tokenToUse,
        metaApiAccountId: accountIdToUse
      });
      
      if (testResult.success) {
        res.json({
          success: true,
          message: 'MetaAPI connection test successful',
          data: {
            accountId: settings?.metaapi_account_id,
            ...testResult
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: testResult.error || 'MetaAPI connection test failed'
        });
      }
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connection: ' + error.message
    });
  }
};
/**
 * Get streaming status
 */
export const getStreamingStatus = async (req, res) => {
  try {
    const status = centralizedStreamingService.getStatus();
    const prices = centralizedStreamingService.getAllPrices();
    
    res.json({
      success: true,
      data: {
        ...status,
        prices
      }
    });
  } catch (error) {
    console.error('Get streaming status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get streaming status'
    });
  }
};

/**
 * Add symbol to streaming
 */
export const addSymbol = async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
    }
    
    await centralizedStreamingService.addSymbol(symbol);
    
    res.json({
      success: true,
      message: `Symbol ${symbol.toUpperCase()} added successfully`,
      data: {
        symbols: centralizedStreamingService.getStatus().symbols
      }
    });
  } catch (error) {
    console.error('Add symbol error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add symbol: ' + error.message
    });
  }
};

/**
 * Remove symbol from streaming
 */
export const removeSymbol = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
    }
    
    await centralizedStreamingService.removeSymbol(symbol);
    
    res.json({
      success: true,
      message: `Symbol ${symbol.toUpperCase()} removed successfully`,
      data: {
        symbols: centralizedStreamingService.getStatus().symbols
      }
    });
  } catch (error) {
    console.error('Remove symbol error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove symbol: ' + error.message
    });
  }
};

/**
 * Get current price for a symbol
 */
export const getPrice = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
    }
    
    const price = centralizedStreamingService.getPrice(symbol);
    
    if (!price) {
      return res.status(404).json({
        success: false,
        error: `Price not available for ${symbol.toUpperCase()}`
      });
    }
    
    res.json({
      success: true,
      data: price
    });
  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get price'
    });
  }
};

/**
 * Get all current prices
 */
export const getAllPrices = async (req, res) => {
  try {
    const prices = centralizedStreamingService.getAllPrices();
    
    res.json({
      success: true,
      data: {
        prices,
        count: Object.keys(prices).length,
        lastUpdate: centralizedStreamingService.getStatus().stats?.lastPriceUpdate
      }
    });
  } catch (error) {
    console.error('Get all prices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prices'
    });
  }
};
