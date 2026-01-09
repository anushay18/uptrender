/**
 * MT5 Broker Connection Pool - Singleton Pattern
 * Reuses connections to avoid MetaAPI subscription limit
 */
class MT5BrokerPool {
  constructor() {
    this.connections = new Map(); // Map<accountId, {broker, lastUsed, inUse}>
    this.maxIdleTime = 5 * 60 * 1000; // 5 minutes
    this.maxConnections = 20; // Keep under MetaAPI limit
    
    // Cleanup idle connections every 2 minutes
    setInterval(() => this.cleanupIdleConnections(), 2 * 60 * 1000);
  }

  /**
   * Dynamically import MT5Broker class
   */
  async _createMT5Broker() {
    const MT5BrokerClass = (await import('../../algoengine/brokers/mt5/index.js')).default;
    return new MT5BrokerClass();
  }

  /**
   * Get or create MT5 broker connection
   */
  async getConnection(apiKey, accountId) {
    const connectionKey = `${accountId}`;
    
    // Return existing connection if available
    if (this.connections.has(connectionKey)) {
      const conn = this.connections.get(connectionKey);
      conn.lastUsed = Date.now();
      conn.inUse = true;
      console.log(`♻️ Reusing MT5 connection for ${accountId}`);
      return conn.broker;
    }

    // Check connection limit
    if (this.connections.size >= this.maxConnections) {
      await this.cleanupIdleConnections(true); // Force cleanup
    }

    // Create new MT5Broker instance
    console.log(`🔌 Creating new MT5 connection for ${accountId}`);
    const broker = await this._createMT5Broker();
    
    try {
      // Initialize with user's credentials
      await broker.initialize({
        apiKey,
        accountId
      });

      // Store connection
      this.connections.set(connectionKey, {
        broker,
        lastUsed: Date.now(),
        inUse: true,
        accountId
      });

      console.log(`✅ MT5 connection established for ${accountId}`);
      return broker;
    } catch (error) {
      console.error(`❌ Failed to create MT5 connection for ${accountId}:`, error.message);
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
