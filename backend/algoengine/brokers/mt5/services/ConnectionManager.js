/**
 * MT5 MetaAPI Connection Manager
 * Handles connection lifecycle, reconnection logic, and connection pooling
 */

import MetaApi from 'metaapi.cloud-sdk/esm-node';
import { logger } from '../../../utils/logger.js';
import { MT5_CONFIG } from '../config/metaapi.config.js';

class MT5ConnectionManager {
  constructor() {
    this.metaApi = null;
    this.account = null;
    this.connection = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.connectionPool = new Map();
    this.eventEmitter = null;
  }

  /**
   * Initialize MetaAPI connection
   * @param {string} apiKey - MetaAPI API key
   * @returns {Promise<void>}
   */
  async initialize(apiKey) {
    try {
      if (!apiKey) {
        throw new Error('MetaAPI key not provided');
      }

      logger.info('Initializing MT5 MetaAPI connection...');

      // Initialize MetaApi SDK
      this.metaApi = new MetaApi(apiKey);

      logger.info('MetaAPI SDK initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize MetaAPI: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to MT5 account with automatic reconnection
   * @param {string} accountId - MetaAPI account ID
   * @param {Object} options - Connection options
   * @returns {Promise<void>}
   */
  async connect(accountId, options = {}) {
    const maxRetries = options.maxRetries || MT5_CONFIG.connection.maxRetries;
    const retryDelay = options.retryDelay || MT5_CONFIG.connection.retryDelay;

    try {
      if (!this.metaApi) {
        throw new Error('MetaAPI not initialized. Call initialize() first.');
      }

      if (!accountId) {
        throw new Error('Account ID not provided');
      }

      logger.info(`Connecting to MT5 account: ${accountId}`);

      // Get account from MetaAPI
      this.account = await this.metaApi.metatraderAccountApi.getAccount(accountId);

      // Check if account exists and is deployed
      if (!this.account) {
        throw new Error('Account not found');
      }

      logger.info(`Account found: ${this.account.name || accountId}`);

      // Create RPC connection for trading operations
      this.connection = this.account.getRPCConnection();

      // Connect to the account
      await this.connection.connect();

      // Wait for synchronization
      await this.connection.waitSynchronized();

      // Subscribe to events
      this.setupEventListeners();

      this.isConnected = true;
      this.retryCount = 0;

      logger.info('✓ Connected to MT5 account successfully');

      // Start keep-alive ping
      this.startKeepAlive();
    } catch (error) {
      logger.error(`Connection error: ${error.message}`);

      if (this.retryCount < maxRetries) {
        this.retryCount++;
        logger.info(`Retrying connection (${this.retryCount}/${maxRetries})...`);
        await this.sleep(retryDelay);
        return this.connect(accountId, options);
      }

      throw new Error(`Failed to connect after ${maxRetries} retries: ${error.message}`);
    }
  }

  /**
   * Setup event listeners for connection
   * @private
   */
  setupEventListeners() {
    if (!this.connection) return;

    // Setup event listeners if methods are available
    try {
      if (typeof this.connection.addSynchronizationListener === 'function') {
        this.connection.addSynchronizationListener({
          onSynchronizationStarted: () => {
            logger.info('MT5 Synchronization started');
          },
          onAccountInformationUpdated: () => {
            logger.debug('MT5 Account info updated');
          },
          onConnected: () => {
            logger.info('✓ MT5 Connection status: CONNECTED');
            this.isConnected = true;
          },
          onDisconnected: () => {
            logger.warn('⚠ MT5 Connection status: DISCONNECTED');
            this.isConnected = false;
            this.attemptReconnect();
          }
        });
      }
    } catch (error) {
      logger.warn(`Could not setup event listeners: ${error.message}`);
    }
  }

  /**
   * Attempt to reconnect to MT5
  }

  /**
   * Attempt automatic reconnection
   * @private
   */
  async attemptReconnect() {
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries && !this.isConnected) {
      try {
        logger.info(`Attempting reconnection (${retries + 1}/${maxRetries})...`);
        await this.sleep(2000 * (retries + 1)); // Exponential backoff

        if (this.connection) {
          await this.connection.connect();
          await this.connection.waitSynchronized({ timeout: 10000 });
          this.isConnected = true;
          logger.info('✓ Reconnected successfully');
          return;
        }
      } catch (error) {
        logger.warn(`Reconnection attempt ${retries + 1} failed: ${error.message}`);
        retries++;
      }
    }

    if (!this.isConnected) {
      logger.error('Failed to reconnect after maximum retries');
    }
  }

  /**
   * Start keep-alive ping
   * @private
   */
  startKeepAlive() {
    const interval = MT5_CONFIG.connection.keepAliveInterval;
    this.keepAliveTimer = setInterval(async () => {
      try {
        if (this.connection) {
          await this.connection.refreshTerminalState();
        }
      } catch (error) {
        logger.warn(`Keep-alive ping failed: ${error.message}`);
      }
    }, interval);
  }

  /**
   * Stop keep-alive ping
   * @private
   */
  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
  }

  /**
   * Get active connection
   * @returns {Object} MetaAPI connection
   */
  getConnection() {
    if (!this.isConnected) {
      throw new Error('Not connected to MT5. Please connect first.');
    }
    return this.connection;
  }

  /**
   * Get account information
   * @returns {Promise<Object>} Account details
   */
  async getAccountInfo() {
    try {
      if (!this.connection) {
        throw new Error('Not connected to MT5');
      }

      const info = await this.connection.getAccountInformation();
      return {
        broker: info.broker,
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        freeMargin: info.freemargin,
        marginLevel: info.marginlevel,
        currency: info.currency,
        leverage: info.leverage,
        server: info.server,
      };
    } catch (error) {
      logger.error(`Failed to get account info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from MT5
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      this.stopKeepAlive();

      if (this.connection) {
        await this.connection.close();
        logger.info('Disconnected from MT5');
      }

      this.isConnected = false;
      this.connection = null;
      this.account = null;
    } catch (error) {
      logger.error(`Error during disconnect: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnectionActive() {
    return this.isConnected && this.connection !== null;
  }

  /**
   * Wait for connection to be ready
   * @returns {Promise<void>}
   */
  async waitForConnection(timeout = 30000) {
    const startTime = Date.now();

    while (!this.isConnectionActive()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Connection timeout');
      }
      await this.sleep(100);
    }
  }

  /**
   * Sleep utility
   * @private
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const connectionManager = new MT5ConnectionManager();
export default MT5ConnectionManager;
