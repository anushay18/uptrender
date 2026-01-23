import { body, param, query, validationResult } from 'express-validator';

// Validation error handler
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Auth validations
export const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3-50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username can only contain letters, numbers, dots, underscore and hyphen'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  body('password')
    .notEmpty().withMessage('Password is required'),
  validate
];

// Trade validations
export const createTradeValidation = [
  body('orderId')
    .notEmpty().withMessage('Order ID is required')
    .isString().withMessage('Order ID must be a string'),
  body('market')
    .isIn(['Forex', 'Crypto', 'Indian']).withMessage('Market must be Forex, Crypto, or Indian'),
  body('symbol')
    .notEmpty().withMessage('Symbol is required')
    .isString().withMessage('Symbol must be a string'),
  body('type')
    .isIn(['Buy', 'Sell', 'BUY', 'SELL']).withMessage('Type must be Buy, Sell, BUY, or SELL'),
  body('amount')
    .isFloat({ min: 0.00000001 }).withMessage('Amount must be a positive number'),
  body('price')
    .isFloat({ min: 0.00000001 }).withMessage('Price must be a positive number'),
  body('broker')
    .notEmpty().withMessage('Broker is required')
    .isString().withMessage('Broker must be a string'),
  body('brokerType')
    .optional()
    .isString().withMessage('Broker type must be a string'),
  body('date')
    .optional(),
  validate
];

export const updateTradeValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid trade ID'),
  body('market')
    .optional()
    .isString().withMessage('Market must be a string'),
  body('symbol')
    .optional()
    .isString().withMessage('Symbol must be a string'),
  body('entryPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Entry price must be a positive number'),
  body('exitPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Exit price must be a positive number'),
  body('quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('status')
    .optional()
    .isIn(['Pending', 'Completed', 'Failed', 'Cancelled']).withMessage('Invalid status'),
  validate
];

// Strategy validations
export const createStrategyValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Strategy name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3-100 characters'),
  body('segment')
    .notEmpty().withMessage('Segment is required')
    .isIn(['Crypto', 'Forex', 'Indian']).withMessage('Invalid segment'),
  body('capital')
    .optional()
    .isFloat({ min: 0 }).withMessage('Capital must be a positive number'),
  body('symbol')
    .optional()
    .isString().withMessage('Symbol must be a string'),
  body('legs')
    .optional()
    .isInt({ min: 1, max: 10 }).withMessage('Legs must be between 1-10'),
  body('lots')
    .optional()
    .isFloat({ min: 0.01, max: 1000 }).withMessage('Lots must be between 0.01-1000'),
  body('expiryDate')
    .optional()
    .isISO8601().withMessage('Invalid expiry date format'),
  body('type')
    .optional()
    .isIn(['Public', 'Private']).withMessage('Type must be Public or Private'),
  body('marketRisk')
    .optional()
    .custom((value) => {
      if (value === null) return true;
      const isObject = typeof value === 'object' && !Array.isArray(value);
      if (!isObject) throw new Error('marketRisk must be an object');
      return true;
    }),
  body('marketRisk')
    .optional()
    .custom((value) => {
      if (value === null) return true;
      const isObject = typeof value === 'object' && !Array.isArray(value);
      if (!isObject) throw new Error('marketRisk must be an object');
      return true;
    }),
  validate
];

export const updateStrategyValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3-100 characters'),
  body('segment')
    .optional()
    .isIn(['Crypto', 'Forex', 'Indian']).withMessage('Invalid segment'),
  body('capital')
    .optional()
    .isFloat({ min: 0 }).withMessage('Capital must be a positive number'),
  body('symbol')
    .optional()
    .isString().withMessage('Symbol must be a string'),
  body('legs')
    .optional()
    .isInt({ min: 1, max: 10 }).withMessage('Legs must be between 1-10'),
  body('lots')
    .optional()
    .isFloat({ min: 0.01, max: 1000 }).withMessage('Lots must be between 0.01-1000'),
  body('expiryDate')
    .optional()
    .isISO8601().withMessage('Invalid expiry date format'),
  body('type')
    .optional()
    .isIn(['Public', 'Private']).withMessage('Type must be Public or Private'),
  body('isActive')
    .optional()
    .toBoolean()
    .isBoolean().withMessage('isActive must be boolean'),
  body('isPublic')
    .optional()
    .toBoolean()
    .isBoolean().withMessage('isPublic must be boolean'),
  body('isPaused')
    .optional()
    .toBoolean()
    .isBoolean().withMessage('isPaused must be boolean'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  validate
];

// Strategy Subscription validations
export const subscribeToStrategyValidation = [
  body('strategyId')
    .notEmpty().withMessage('Strategy ID is required')
    .isInt({ min: 1 }).withMessage('Strategy ID must be a valid positive integer'),
  body('lots')
    .optional()
    .isFloat({ min: 0.01, max: 1000 }).withMessage('Lots must be between 0.01-1000'),
  validate
];

// API Key validations
export const createApiKeyValidation = [
  body('brokerId')
    .optional()
    .isInt({ min: 1 }).withMessage('Invalid broker ID'),
  body('segment')
    .notEmpty().withMessage('Segment is required')
    .isIn(['Crypto', 'Forex', 'Indian']).withMessage('Invalid segment'),
  body('apiKey')
    .trim()
    .notEmpty().withMessage('API key is required')
    .isLength({ min: 10 }).withMessage('API key seems too short'),
  body('apiSecret')
    .trim()
    .notEmpty().withMessage('API secret is required')
    .isLength({ min: 10 }).withMessage('API secret seems too short'),
  validate
];

// Wallet validations
export const addFundsValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Description too long'),
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Reference too long'),
  validate
];

export const withdrawFundsValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Description too long'),
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Reference too long'),
  validate
];

// Support ticket validations
export const createTicketValidation = [
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required')
    .isLength({ min: 5, max: 200 }).withMessage('Subject must be between 5-200 characters'),
  body('category')
    .optional()
    .isIn(['Technical', 'Billing', 'General', 'Feature Request']).withMessage('Invalid category'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  validate
];

export const addMessageValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid ticket ID'),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 5000 }).withMessage('Message must be between 1-5000 characters'),
  validate
];

// Notification validations
export const createNotificationValidation = [
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('type')
    .optional()
    .isIn(['Info', 'Warning', 'Error', 'Success']).withMessage('Invalid notification type'),
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1-200 characters'),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1-1000 characters'),
  validate
];

export const broadcastNotificationValidation = [
  body('type')
    .optional()
    .isIn(['Info', 'Warning', 'Error', 'Success']).withMessage('Invalid notification type'),
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1-200 characters'),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1-1000 characters'),
  body('userIds')
    .optional()
    .isArray().withMessage('User IDs must be an array')
    .custom((value) => {
      if (value && !value.every(id => Number.isInteger(id) && id > 0)) {
        throw new Error('All user IDs must be positive integers');
      }
      return true;
    }),
  validate
];

// Plan validations
export const subscribeToPlanValidation = [
  body('planId')
    .notEmpty().withMessage('Plan ID is required')
    .isInt({ min: 1 }).withMessage('Invalid plan ID'),
  body('billingCycle')
    .optional()
    .isIn(['Monthly', 'Yearly']).withMessage('Billing cycle must be Monthly or Yearly'),
  validate
];

export const createPlanCatalogValidation = [
  body('code')
    .trim()
    .notEmpty().withMessage('Plan code is required')
    .isLength({ min: 2, max: 50 }).withMessage('Code must be between 2-50 characters')
    .matches(/^[A-Z0-9_]+$/).withMessage('Code must be uppercase letters, numbers and underscores only'),
  body('name')
    .trim()
    .notEmpty().withMessage('Plan name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3-100 characters'),
  body('type')
    .notEmpty().withMessage('Plan type is required')
    .isIn(['Free', 'Basic', 'Pro', 'Enterprise']).withMessage('Invalid plan type'),
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('billingCycle')
    .notEmpty().withMessage('Billing cycle is required')
    .isIn(['Monthly', 'Yearly']).withMessage('Billing cycle must be Monthly or Yearly'),
  validate
];

// Pagination validations
export const paginationValidation = [
  query('page')
    .optional()
    .toInt()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .toInt()
    .isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1-1000'),
  validate
];

// ID parameter validation
export const idParamValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid ID parameter'),
  validate
];

// User ID parameter validation
export const userIdParamValidation = [
  param('userId')
    .isInt({ min: 1 }).withMessage('Invalid user ID parameter'),
  validate
];

// Admin transfer validation
export const adminTransferValidation = [
  param('userId')
    .isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('amount')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
    .toFloat(),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 }).withMessage('Description too long'),
  validate
];

// Paper Position Validations
export const openPaperPositionValidation = [
  body('symbol')
    .trim()
    .notEmpty().withMessage('Symbol is required')
    .isString().withMessage('Symbol must be a string')
    .isLength({ max: 50 }).withMessage('Symbol too long'),
  body('type')
    .isIn(['Buy', 'Sell', 'BUY', 'SELL']).withMessage('Type must be Buy or Sell'),
  body('volume')
    .isFloat({ min: 0.00000001, max: 10000 }).withMessage('Volume must be between 0.00000001 and 10000'),
  body('price')
    .optional()
    .isFloat({ min: 0.00000001 }).withMessage('Price must be a positive number'),
  body('market')
    .optional()
    .isIn(['Forex', 'Crypto', 'Indian']).withMessage('Market must be Forex, Crypto, or Indian'),
  body('stopLoss')
    .optional()
    .isFloat({ min: 0 }).withMessage('Stop loss must be a positive number'),
  body('takeProfit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Take profit must be a positive number'),
  body('stopLossType')
    .optional()
    .isIn(['price', 'points', 'percentage']).withMessage('Invalid stop loss type'),
  body('takeProfitType')
    .optional()
    .isIn(['price', 'points', 'percentage']).withMessage('Invalid take profit type'),
  validate
];

export const modifyPositionValidation = [
  param('orderId')
    .notEmpty().withMessage('Order ID is required'),
  body('stopLoss')
    .optional()
    .isFloat({ min: 0 }).withMessage('Stop loss must be a positive number or 0'),
  body('takeProfit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Take profit must be a positive number or 0'),
  body('stopLossType')
    .optional()
    .isIn(['price', 'points', 'percentage']).withMessage('Invalid stop loss type'),
  body('takeProfitType')
    .optional()
    .isIn(['price', 'points', 'percentage']).withMessage('Invalid take profit type'),
  validate
];

// Webhook Validations
export const webhookValidation = [
  body('secret')
    .trim()
    .notEmpty().withMessage('Webhook secret is required')
    .isString().withMessage('Secret must be a string')
    .isLength({ min: 4, max: 100 }).withMessage('Invalid secret length'),
  body('signal')
    .optional()
    .isIn(['BUY', 'SELL', 'Buy', 'Sell', 'CLOSE', 'Close']).withMessage('Invalid signal'),
  body('action')
    .optional()
    .isIn(['BUY', 'SELL', 'Buy', 'Sell', 'CLOSE', 'Close']).withMessage('Invalid action'),
  body('symbol')
    .optional()
    .isString().withMessage('Symbol must be a string')
    .isLength({ max: 50 }).withMessage('Symbol too long'),
  body('volume')
    .optional()
    .isFloat({ min: 0.00000001, max: 10000 }).withMessage('Volume must be valid'),
  validate
];

// Input sanitization helper - removes dangerous characters
export const sanitizeSearchQuery = (value) => {
  if (!value) return value;
  // Remove SQL injection patterns
  return value.replace(/['"%;\\]/g, '');
};

// Search query validation with sanitization
export const searchValidation = [
  query('search')
    .optional()
    .isString().withMessage('Search must be a string')
    .customSanitizer(sanitizeSearchQuery)
    .isLength({ max: 100 }).withMessage('Search query too long'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validate
];

export default {
  validate,
  registerValidation,
  loginValidation,
  createTradeValidation,
  updateTradeValidation,
  createStrategyValidation,
  updateStrategyValidation,
  subscribeToStrategyValidation,
  createApiKeyValidation,
  addFundsValidation,
  withdrawFundsValidation,
  createTicketValidation,
  addMessageValidation,
  createNotificationValidation,
  broadcastNotificationValidation,
  subscribeToPlanValidation,
  createPlanCatalogValidation,
  paginationValidation,
  idParamValidation,
  userIdParamValidation,
  adminTransferValidation,
  openPaperPositionValidation,
  modifyPositionValidation,
  webhookValidation,
  searchValidation,
  sanitizeSearchQuery
};
