import express from 'express';
import { body } from 'express-validator';
import * as copyTradingController from '../controllers/copyTradingController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Copy Trading Routes
 * All routes require authentication
 */

// Validation middleware
const validateAccount = [
  body('name')
    .notEmpty()
    .withMessage('Account name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Account name must be between 2 and 50 characters'),
  body('type')
    .isIn(['master', 'child'])
    .withMessage('Account type must be either master or child'),
  body('broker')
    .notEmpty()
    .withMessage('Broker is required')
    .isLength({ min: 2, max: 30 })
    .withMessage('Broker name must be between 2 and 30 characters'),
  body('apiKey')
    .notEmpty()
    .withMessage('API Key is required')
    .isLength({ min: 5 })
    .withMessage('API Key must be at least 5 characters long'),
  body('secretKey')
    .notEmpty()
    .withMessage('Secret Key is required')
    .isLength({ min: 5 })
    .withMessage('Secret Key must be at least 5 characters long'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const validateAccountUpdate = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Account name must be between 2 and 50 characters'),
  body('broker')
    .optional()
    .isLength({ min: 2, max: 30 })
    .withMessage('Broker name must be between 2 and 30 characters'),
  body('apiKey')
    .optional()
    .isLength({ min: 10 })
    .withMessage('API Key must be at least 10 characters long'),
  body('secretKey')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Secret Key must be at least 10 characters long'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const validateToggleStatus = [
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const validateTestConnection = [
  body('apiKey')
    .notEmpty()
    .withMessage('API Key is required'),
  body('secretKey')
    .notEmpty()
    .withMessage('Secret Key is required'),
  body('broker')
    .notEmpty()
    .withMessage('Broker is required'),
];

/**
 * @route   GET /api/copy-trading
 * @desc    Get all copy trading accounts for authenticated user
 * @access  Private
 */
router.get('/', authenticate, copyTradingController.getAccounts);

/**
 * @route   GET /api/copy-trading/statistics
 * @desc    Get copy trading statistics for authenticated user
 * @access  Private
 */
router.get('/statistics', authenticate, copyTradingController.getStatistics);

/**
 * @route   GET /api/copy-trading/:id
 * @desc    Get a specific copy trading account
 * @access  Private
 */
router.get('/:id', authenticate, copyTradingController.getAccount);

/**
 * @route   POST /api/copy-trading
 * @desc    Create a new copy trading account
 * @access  Private
 */
router.post('/', authenticate, validateAccount, copyTradingController.createAccount);

/**
 * @route   POST /api/copy-trading/test-connection
 * @desc    Test API connection for copy trading
 * @access  Private
 */
router.post('/test-connection', authenticate, validateTestConnection, copyTradingController.testConnection);

/**
 * @route   PUT /api/copy-trading/:id
 * @desc    Update a copy trading account
 * @access  Private
 */
router.put('/:id', authenticate, validateAccountUpdate, copyTradingController.updateAccount);

/**
 * @route   PATCH /api/copy-trading/:id/toggle-status
 * @desc    Toggle account status (active/inactive)
 * @access  Private
 */
router.patch('/:id/toggle-status', authenticate, validateToggleStatus, copyTradingController.toggleAccountStatus);

/**
 * @route   DELETE /api/copy-trading/:id
 * @desc    Delete a copy trading account
 * @access  Private
 */
router.delete('/:id', authenticate, copyTradingController.deleteAccount);

export default router;