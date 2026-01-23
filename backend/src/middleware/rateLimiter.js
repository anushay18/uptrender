/**
 * Rate Limiting Middleware
 * Industry-standard rate limiting for API security
 * 
 * Protects against:
 * - Brute force attacks on login/register
 * - DDoS on webhook endpoints
 * - API abuse
 */

import rateLimit from 'express-rate-limit';

/**
 * Standard API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind a proxy, otherwise use IP
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * 20 attempts per 5 minutes per IP (more lenient for development)
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 20, // 10 in prod, 20 in dev
  message: {
    success: false,
    error: 'Too many login attempts. Please wait 5 minutes before trying again.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * Registration rate limiter
 * 3 registrations per hour per IP (production)
 * 10 registrations per hour per IP (development)
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 3 : 10, // More lenient in dev
  message: {
    success: false,
    error: 'Too many accounts created. Please try again in an hour.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for localhost in development
    const isDev = process.env.NODE_ENV !== 'production';
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    return isDev && isLocalhost;
  }
});

/**
 * Webhook rate limiter
 * 60 requests per minute per IP (for TradingView webhooks)
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Webhook rate limit exceeded. Please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  }
});

/**
 * Password reset rate limiter
 * 3 attempts per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  }
});

/**
 * Sensitive operations rate limiter (wallet, API keys)
 * 10 requests per 5 minutes per user
 */
export const sensitiveOpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    success: false,
    error: 'Too many sensitive operations. Please wait.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id?.toString() || req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  }
});

export default {
  standardLimiter,
  authLimiter,
  registerLimiter,
  webhookLimiter,
  passwordResetLimiter,
  sensitiveOpLimiter
};
