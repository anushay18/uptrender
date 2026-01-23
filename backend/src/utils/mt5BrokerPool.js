import metaApiRateLimiter from './MetaApiRateLimiter.js';

/**
 * MT5 Broker Connection Pool - Singleton Pattern
 * Reuses connections to avoid MetaAPI subscription limit (25 max)
 * 
 * IMPORTANT: MetaAPI has a limit of 25 concurrent subscriptions.
 * This pool helps manage connections efficiently.
 * 
 * NOW WITH RATE LIMITING: Prevents HTTP 429 errors by throttling connections
 */
class MT5BrokerPool {
  constructor() {
    this.connections = new Map(); // Map<accountId, {broker, lastUsed, inUse, status}>
    this.invalidAccounts = new Set(); // Track accounts that failed to deploy/connect
    this.maxIdleTime = 5 * 60 * 1000; // 5 minutes (increased to reduce churn)
    this.maxConnections = 5; // Reduced to 5 to stay well under MetaAPI limit
    this.connectionTimeout = 45000; // 45 seconds timeout (increased)
    this.pendingConnections = new Map(); // Prevent duplicate connection attempts
    
    // Cleanup idle connections every 2 minutes (reduced frequency)
    setInterval(() => this.cleanupIdleConnections(), 120 * 1000);
  }

  /**
   * Dynamically import MT5Broker class
   */
  async _createMT5Broker() {
    const MT5BrokerClass = (await import('../../algoengine/brokers/mt5/index.js')).default;
    return new MT5BrokerClass();
  }

  /**
   * Check if account is known to be invalid (not deployed, etc.)
   */
  isInvalidAccount(accountId) {
    return this.invalidAccounts.has(accountId);
  }

  /**
   * Mark account as invalid (to skip future connection attempts)
   */
  markAccountInvalid(accountId, reason) {
    this.invalidAccounts.add(accountId);
    console.warn(`⚠️ MT5 account ${accountId} marked invalid: ${reason}`);
  }

  /**
   * Get or create MT5 broker connection with improved error handling and rate limiting
   */
  async getConnection(apiKey, accountId) {
    const connectionKey = `${accountId}`;
    
    // Check rate limiter first
    if (metaApiRateLimiter.shouldSkipConnection(connectionKey)) {
      const status = metaApiRateLimiter.getStatus();
      console.log(`⏭️ Skipping connection to ${accountId} due to rate limiting`);
      return null;
    }
    
    // Skip if account is known to be invalid
    if (this.invalidAccounts.has(connectionKey)) {
      console.log(`⏭️ Skipping invalid MT5 account: ${accountId}`);
      return null;
    }

    // Return existing connection if available and not errored
    if (this.connections.has(connectionKey)) {
      const conn = this.connections.get(connectionKey);
      if (conn.status === 'connected') {
        conn.lastUsed = Date.now();
        conn.inUse = true;
        console.log(`♻️ Reusing existing connection for ${accountId}`);
        return conn.broker;
      } else if (conn.status === 'error') {
        // Clean up errored connection
        this.connections.delete(connectionKey);
      }
    }

    // Prevent duplicate connection attempts
    if (this.pendingConnections.has(connectionKey)) {
      console.log(`⏳ Connection already pending for ${accountId}`);
      return this.pendingConnections.get(connectionKey);
    }

    // Check connection limit - don't create more if at limit
    if (this.connections.size >= this.maxConnections) {
      console.log(`⚠️ Connection limit reached (${this.connections.size}/${this.maxConnections}), cleaning up...`);
      await this.cleanupIdleConnections(true);
      if (this.connections.size >= this.maxConnections) {
        console.warn(`⚠️ MT5 connection limit still at max after cleanup. Cannot connect ${accountId}`);
        return null;
      }
    }

    // Create new MT5Broker instance with rate limiting and timeout
    const connectionPromise = this._createConnectionWithTimeout(apiKey, accountId, connectionKey);
    this.pendingConnections.set(connectionKey, connectionPromise);

    try {
      const result = await connectionPromise;
      return result;
    } finally {
      this.pendingConnections.delete(connectionKey);
    }
  }

  /**
   * Create connection with timeout to prevent hanging
   */
  async _createConnectionWithTimeout(apiKey, accountId, connectionKey) {
    // Request permission from rate limiter
    try {
      await metaApiRateLimiter.requestConnection(connectionKey);
    } catch (error) {
      console.warn(`⚠️ Rate limiter blocked connection to ${accountId}: ${error.message}`);
      return null;
    }

    metaApiRateLimiter.markPending(connectionKey);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout);
    });

    const connectionPromise = this._createConnection(apiKey, accountId, connectionKey);

    try {
      const result = await Promise.race([connectionPromise, timeoutPromise]);
      metaApiRateLimiter.recordSuccess(connectionKey);
      metaApiRateLimiter.releaseConnection(connectionKey);
      return result;
    } catch (error) {
      metaApiRateLimiter.releaseConnection(connectionKey);
      
      // Handle specific MetaAPI errors
      if (error.message?.includes('deploy') || error.message?.includes('no accounts deployed')) {
        this.markAccountInvalid(connectionKey, 'Account not deployed');
        metaApiRateLimiter.recordFailure(connectionKey);
      } else if (error.message?.includes('subscription') || error.status === 429 || error.message?.includes('429')) {
        console.warn(`⚠️ MetaAPI rate limit hit for ${accountId}`);
        metaApiRateLimiter.recordRateLimitError(connectionKey);
      } else if (error.message?.includes('timeout')) {
        console.warn(`⏰ Connection timeout for ${accountId}`);
        metaApiRateLimiter.recordFailure(connectionKey);
      } else {
        metaApiRateLimiter.recordFailure(connectionKey);
      }
      
      return null;
    } finally {
      metaApiRateLimiter.markComplete(connectionKey);
    }
  }

  /**
   * Internal: Create the actual connection
   */
  async _createConnection(apiKey, accountId, connectionKey) {
    console.log(`🔌 Creating MT5 connection for ${accountId}...`);
    const broker = await this._createMT5Broker();
    
    try {
      await broker.initialize({
        apiKey,
        accountId
      });

      // Store connection
      this.connections.set(connectionKey, {
        broker,
        lastUsed: Date.now(),
        inUse: true,
        accountId,
        status: 'connected'
      });

      console.log(`✅ MT5 connection established for ${accountId}`);
      return broker;
    } catch (error) {
      console.error(`❌ Failed to connect MT5 ${accountId}:`, error.message);
      throw error;
    }
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(accountId) {
    const connectionKey = `${accountId}`;
    if (this.connections.has(connectionKey)) {
      const conn = this.connections.get(connectionKey);
      conn.inUse = false;
      conn.lastUsed = Date.now();
      console.log(`🔓 Released MT5 connection for ${accountId}`);
    }
  }

  /**
   * Cleanup idle connections
   */
  async cleanupIdleConnections(force = false) {
    const now = Date.now();
    const toRemove = [];

    for (const [key, conn] of this.connections.entries()) {
      const idleTime = now - conn.lastUsed;
      const shouldRemove = force ? !conn.inUse : (idleTime > this.maxIdleTime && !conn.inUse);

      if (shouldRemove) {
        toRemove.push(key);
        try {
          // Disconnect from MetaAPI
          if (conn.broker && typeof conn.broker.disconnect === 'function') {
            await conn.broker.disconnect();
          }
          console.log(`🧹 Cleaned up idle connection: ${conn.accountId}`);
        } catch (error) {
          console.error(`Error disconnecting ${conn.accountId}:`, error);
        }
      }
    }

    toRemove.forEach(key => this.connections.delete(key));
    
    if (toRemove.length > 0) {
      console.log(`🧹 Cleaned up ${toRemove.length} idle MT5 connections`);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const stats = {
      total: this.connections.size,
      inUse: 0,
      idle: 0
    };

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        stats.inUse++;
      } else {
        stats.idle++;
      }
    }

    return stats;
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll() {
    console.log(`🔌 Disconnecting all ${this.connections.size} MT5 connections...`);
    
    for (const [key, conn] of this.connections.entries()) {
      try {
        if (conn.broker && typeof conn.broker.disconnect === 'function') {
          await conn.broker.disconnect();
        }
      } catch (error) {
        console.error(`Error disconnecting ${conn.accountId}:`, error);
      }
    }
    
    this.connections.clear();
    console.log(`✅ All MT5 connections disconnected`);
  }
}

// Export singleton instance
export default new MT5BrokerPool();
