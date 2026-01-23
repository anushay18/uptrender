/**
 * MetaAPI Rate Limiter and Connection Manager
 * Prevents HTTP 429 errors by implementing:
 * - Global rate limiting across all MetaAPI requests
 * - Connection pooling with max limits
 * - Exponential backoff for failed connections
 * - Request queuing to prevent connection storms
 */

class MetaApiRateLimiter {
  constructor() {
    // Rate limiting configuration
    this.maxConcurrentConnections = 5; // Max 5 concurrent MetaAPI connections
    this.maxRequestsPerMinute = 30; // Limit requests to 30/minute
    this.requestQueue = [];
    this.activeConnections = 0;
    this.requestTimestamps = [];
    
    // Exponential backoff configuration
    this.backoffDelays = [1000, 2000, 5000, 10000, 30000]; // ms
    this.failureCount = new Map(); // accountId -> failure count
    this.lastFailure = new Map(); // accountId -> timestamp
    this.blockedUntil = new Map(); // accountId -> timestamp when unblocked
    
    // Connection tracking
    this.pendingConnections = new Set();
    this.activeConnectionIds = new Set();
    
    // Global rate limit cooldown
    this.rateLimitedUntil = null;
    this.globalBackoffDelay = 0;
    
    console.log('✅ MetaAPI Rate Limiter initialized');
  }

  /**
   * Check if we're currently rate limited
   */
  isRateLimited() {
    if (this.rateLimitedUntil && Date.now() < this.rateLimitedUntil) {
      return true;
    }
    
    // Check if we've exceeded requests per minute
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    return this.requestTimestamps.length >= this.maxRequestsPerMinute;
  }

  /**
   * Check if a specific account is blocked
   */
  isAccountBlocked(accountId) {
    const blockedUntil = this.blockedUntil.get(accountId);
    if (blockedUntil && Date.now() < blockedUntil) {
      const remainingSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
      return remainingSeconds;
    }
    this.blockedUntil.delete(accountId);
    return 0;
  }

  /**
   * Record a rate limit error and apply global backoff
   */
  recordRateLimitError(accountId = null) {
    console.warn('⚠️ MetaAPI rate limit (429) detected - applying global backoff');
    
    // Apply global rate limit for 60 seconds
    this.rateLimitedUntil = Date.now() + 60000;
    this.globalBackoffDelay = Math.min((this.globalBackoffDelay || 5000) * 2, 120000);
    
    // If specific account, also block it
    if (accountId) {
      this.recordFailure(accountId);
    }
  }

  /**
   * Record a connection failure for an account
   */
  recordFailure(accountId) {
    const failures = (this.failureCount.get(accountId) || 0) + 1;
    this.failureCount.set(accountId, failures);
    this.lastFailure.set(accountId, Date.now());
    
    // Calculate backoff delay based on failure count
    const backoffIndex = Math.min(failures - 1, this.backoffDelays.length - 1);
    const backoffDelay = this.backoffDelays[backoffIndex];
    
    // Block account until backoff period expires
    this.blockedUntil.set(accountId, Date.now() + backoffDelay);
    
    console.warn(`⚠️ Account ${accountId} blocked for ${backoffDelay}ms (failure #${failures})`);
  }

  /**
   * Record a successful connection
   */
  recordSuccess(accountId) {
    // Reset failure count on success
    this.failureCount.delete(accountId);
    this.lastFailure.delete(accountId);
    this.blockedUntil.delete(accountId);
    
    // Reduce global backoff on success
    if (this.globalBackoffDelay > 0) {
      this.globalBackoffDelay = Math.max(this.globalBackoffDelay / 2, 0);
    }
  }

  /**
   * Request permission to create a connection
   * Returns a promise that resolves when connection can proceed
   */
  async requestConnection(accountId) {
    // Check if account is blocked
    const blockedSeconds = this.isAccountBlocked(accountId);
    if (blockedSeconds > 0) {
      throw new Error(`Account ${accountId} is blocked for ${blockedSeconds} more seconds due to previous failures`);
    }
    
    // Check global rate limit
    if (this.isRateLimited()) {
      const waitTime = this.rateLimitedUntil ? this.rateLimitedUntil - Date.now() : 5000;
      console.warn(`⏳ Rate limited - waiting ${Math.ceil(waitTime / 1000)}s before connecting ${accountId}`);
      await this.sleep(waitTime);
    }
    
    // Wait for available connection slot
    while (this.activeConnections >= this.maxConcurrentConnections) {
      console.log(`⏳ Max connections (${this.maxConcurrentConnections}) reached - waiting for slot...`);
      await this.sleep(1000);
    }
    
    // Track this connection
    this.activeConnections++;
    this.activeConnectionIds.add(accountId);
    this.requestTimestamps.push(Date.now());
    
    console.log(`✅ Connection slot granted for ${accountId} (${this.activeConnections}/${this.maxConcurrentConnections})`);
  }

  /**
   * Release a connection slot
   */
  releaseConnection(accountId) {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    this.activeConnectionIds.delete(accountId);
    console.log(`🔓 Connection slot released for ${accountId} (${this.activeConnections}/${this.maxConcurrentConnections})`);
  }

  /**
   * Throttle a request to respect rate limits
   */
  async throttleRequest() {
    // Remove old timestamps
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    // Wait if at request limit
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = 60000 - (Date.now() - oldestRequest);
      if (waitTime > 0) {
        console.log(`⏳ Request limit reached - waiting ${Math.ceil(waitTime / 1000)}s`);
        await this.sleep(waitTime);
      }
    }
    
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Check if we should skip a connection attempt due to rate limiting
   */
  shouldSkipConnection(accountId) {
    // Skip if globally rate limited
    if (this.isRateLimited()) {
      return true;
    }
    
    // Skip if account is blocked
    if (this.isAccountBlocked(accountId) > 0) {
      return true;
    }
    
    // Skip if already connecting
    if (this.pendingConnections.has(accountId)) {
      return true;
    }
    
    return false;
  }

  /**
   * Mark connection as pending
   */
  markPending(accountId) {
    this.pendingConnections.add(accountId);
  }

  /**
   * Mark connection as complete
   */
  markComplete(accountId) {
    this.pendingConnections.delete(accountId);
  }

  /**
   * Get current rate limiter status
   */
  getStatus() {
    return {
      activeConnections: this.activeConnections,
      maxConnections: this.maxConcurrentConnections,
      requestsLastMinute: this.requestTimestamps.length,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      isRateLimited: this.isRateLimited(),
      rateLimitedUntil: this.rateLimitedUntil,
      blockedAccounts: Array.from(this.blockedUntil.entries()).map(([id, until]) => ({
        accountId: id,
        unblocksIn: Math.ceil((until - Date.now()) / 1000)
      })).filter(a => a.unblocksIn > 0),
      pendingConnections: Array.from(this.pendingConnections)
    };
  }

  /**
   * Reset all rate limiting (for emergency use)
   */
  reset() {
    this.rateLimitedUntil = null;
    this.globalBackoffDelay = 0;
    this.failureCount.clear();
    this.lastFailure.clear();
    this.blockedUntil.clear();
    this.requestTimestamps = [];
    console.log('🔄 MetaAPI rate limiter reset');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const metaApiRateLimiter = new MetaApiRateLimiter();
export default metaApiRateLimiter;
