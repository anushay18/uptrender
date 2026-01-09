import express from 'express';
import * as chargeController from '../controllers/chargeController.js';
import * as perTradeChargeController from '../controllers/perTradeChargeController.js';

const router = express.Router();

// Get all charges
router.get('/', chargeController.getAllCharges);

// Get charge by ID
router.get('/:id', chargeController.getChargeById);

// Get charge by type
router.get('/type/:type', chargeController.getChargeByType);

// Create or update charge (upsert)
router.post('/', chargeController.upsertCharge);

// Update charge
router.put('/:id', chargeController.updateCharge);

// Delete charge
router.delete('/:id', chargeController.deleteCharge);

// ========== Per Trade Charge Routes ==========

// Get per trade charge configuration
router.get('/per-trade/config', perTradeChargeController.getPerTradeCharge);

// Update per trade charge configuration
router.post('/per-trade/config', perTradeChargeController.updatePerTradeCharge);

// Get all strategies for dropdown (admin only)
router.get('/per-trade/strategies', perTradeChargeController.getAllStrategiesForDropdown);

export default router;
