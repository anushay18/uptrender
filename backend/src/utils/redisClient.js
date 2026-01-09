import Redis from 'ioredis';

/**
 * Redis Client for Pub/Sub and Caching
 */
class RedisClient {
  constructor() {
    this.publisher = null;
    this.subscriber = null;
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connections
   */
  async connect() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3
      };

      // Main client for general operations
      this.client = new Redis(redisConfig);
      
      // Publisher for broadcasting events
      this.publisher = new Redis(redisConfig);
      
      // Subscriber for receiving events
      this.subscriber = new Redis(redisConfig);

      this.client.on('connect', () => {
        console.log('✅ Redis client connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis client error:', err);
        this.isConnected = false;
      });

      this.publisher.on('connect', () => {
        console.log('✅ Redis publisher connected');
      });

      this.subscriber.on('connect', () => {
        console.log('✅ Redis subscriber connected');
      });

      // Wait for connections
      await Promise.all([
        this.client.ping(),
        this.publisher.ping(),
        this.subscriber.ping()
      ]);

      console.log('✅ All Redis connections established');
      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Publish trade update to Redis channel
   */
  async publishTradeUpdate(userId, trade, action = 'create') {
    if (!this.isConnected || !this.publisher) {
      console.warn('⚠️ Redis not connected, skipping publish');
      return false;
    }

    try {
      const message = JSON.stringify({
        userId,
        trade: {
          id: trade.id,
          orderId: trade.orderId,
          symbol: trade.symbol,
          type: trade.type,
          amount: trade.amount,
          price: trade.price,
          status: trade.status,
          strategyId: trade.strategyId,
          createdAt: trade.createdAt
        },
        action,
        timestamp: new Date().toISOString()
      });

      await this.publisher.publish(`trade:updates:${userId}`, message);
      await this.publisher.publish('trade:updates:all', message); // Broadcast to all
      
      console.log(`📡 Published trade update to Redis for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis publish error:', error);
      return false;
    }
  }

  /**
   * Subscribe to trade updates for a user
   */
  subscribeToTradeUpdates(userId, callback) {
    if (!this.isConnected || !this.subscriber) {
      console.warn('⚠️ Redis not connected, cannot subscribe');
      return;
    }

    const channel = `trade:updates:${userId}`;
    
    this.subscriber.subscribe(channel, (err, count) => {
      if (err) {
        console.error(`❌ Failed to subscribe to ${channel}:`, err);
      } else {
        console.log(`✅ Subscribed to ${channel} (${count} channels)`);
      }
    });

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          console.error('❌ Error parsing Redis message:', error);
        }
      }
    });
  }

  /**
   * Cache data with expiry
   */
  async cache(key, value, expirySeconds = 300) {
    if (!this.isConnected || !this.client) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, expirySeconds, serialized);
      return true;
    } catch (error) {
      console.error('❌ Redis cache error:', error);
      return false;
    }
  }

  /**
   * Get cached data
   */
  async getCache(key) {
    if (!this.isConnected || !this.client) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Redis get cache error:', error);
      return null;
    }
  }

  /**
   * Delete cache
   */
  async deleteCache(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('❌ Redis delete cache error:', error);
      return false;
    }
  }

  /**
   * Publish paper position MTM update to Redis
   */
  async publishPaperPositionMTM(userId, position, mtmData) {
    if (!this.isConnected || !this.publisher) {
      return false;
    }

    try {
      const message = JSON.stringify({
        userId,
        positionId: position.id,
        orderId: position.orderId,
        symbol: position.symbol,
        currentPrice: mtmData.currentPrice,
        profit: mtmData.profit,
        profitPercent: mtmData.profitPercent,
        timestamp: new Date().toISOString()
      });

      // Publish to user-specific channel
      await this.publisher.publish(`paper:mtm:${userId}`, message);
      
      // Publish to global channel
      await this.publisher.publish('paper:mtm:all', message);
      
      return true;
    } catch (error) {
      console.error('❌ Redis publish paper MTM error:', error);
      return false;
    }
  }

  /**
   * Publish live price update for a symbol
   */
  async publishPriceUpdate(symbol, priceData) {
    if (!this.isConnected || !this.publisher) {
      return false;
    }

    try {
      const message = JSON.stringify({
        symbol: symbol.toUpperCase(),
        bid: priceData.bid,
        ask: priceData.ask,
        mid: priceData.mid,
        timestamp: new Date().toISOString()
      });

      // Publish to symbol-specific channel
      await this.publisher.publish(`price:${symbol.toUpperCase()}`, message);
      
      // Publish to global price channel
      await this.publisher.publish('price:all', message);
      
      return true;
    } catch (error) {
      console.error('❌ Redis publish price error:', error);
      return false;
    }
  }

  /**
   * Disconnect all Redis connections
   */
  async disconnect() {
    try {
      if (this.client) await this.client.quit();
      if (this.publisher) await this.publisher.quit();
      if (this.subscriber) await this.subscriber.quit();
      
      this.isConnected = false;
      console.log('✅ Redis connections closed');
    } catch (error) {
      console.error('❌ Error disconnecting Redis:', error);
    }
  }
}

// Export singleton instance
export default new RedisClient();
