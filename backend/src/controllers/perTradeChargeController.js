import { PerTradeCharge, Strategy } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Get per trade charge configuration
 */
export const getPerTradeCharge = async (req, res) => {
  try {
    // Get the single per-trade charge config (we only have one)
    let perTradeCharge = await PerTradeCharge.findOne({
      order: [['id', 'ASC']]
    });

    // If no config exists, create a default one
    if (!perTradeCharge) {
      perTradeCharge = await PerTradeCharge.create({
        amount: 0,
        description: 'Per trade charge for strategies',
        isActive: false,
        strategyIds: []
      });
    }

    res.status(200).json({
      success: true,
      data: perTradeCharge
    });
  } catch (error) {
    console.error('Error fetching per trade charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch per trade charge',
      error: error.message
    });
  }
};

/**
 * Update per trade charge configuration
 */
export const updatePerTradeCharge = async (req, res) => {
  try {
    const { amount, description, isActive, strategyIds } = req.body;

    // Get or create the per-trade charge config
    let perTradeCharge = await PerTradeCharge.findOne({
      order: [['id', 'ASC']]
    });

    if (!perTradeCharge) {
      perTradeCharge = await PerTradeCharge.create({
        amount: amount || 0,
        description: description || 'Per trade charge for strategies',
        isActive: isActive !== undefined ? isActive : false,
        strategyIds: strategyIds || []
      });
    } else {
      // Update existing config
      if (amount !== undefined) perTradeCharge.amount = amount;
      if (description !== undefined) perTradeCharge.description = description;
      if (isActive !== undefined) perTradeCharge.isActive = isActive;
      if (strategyIds !== undefined) perTradeCharge.strategyIds = strategyIds;

      await perTradeCharge.save();
    }

    res.status(200).json({
      success: true,
      message: 'Per trade charge updated successfully',
      data: perTradeCharge
    });
  } catch (error) {
    console.error('Error updating per trade charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update per trade charge',
      error: error.message
    });
  }
};

/**
 * Get all strategies for dropdown selection (both public and private)
 * This is admin-only endpoint
 */
export const getAllStrategiesForDropdown = async (req, res) => {
  try {
    const strategies = await Strategy.findAll({
      attributes: ['id', 'name', 'type', 'segment', 'isActive'],
      order: [['name', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: strategies
    });
  } catch (error) {
    console.error('Error fetching strategies for dropdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch strategies',
      error: error.message
    });
  }
};

/**
 * Check if a strategy has per-trade charge applied (for trade execution)
 */
export const getPerTradeChargeForStrategy = async (strategyId) => {
  try {
    const perTradeCharge = await PerTradeCharge.findOne({
      where: { isActive: true },
      order: [['id', 'ASC']]
    });

    if (!perTradeCharge || !perTradeCharge.strategyIds) {
      return null;
    }

    // Check if the strategy is in the strategyIds array
    const strategyIds = Array.isArray(perTradeCharge.strategyIds) 
      ? perTradeCharge.strategyIds 
      : JSON.parse(perTradeCharge.strategyIds || '[]');

    if (strategyIds.includes(Number(strategyId))) {
      return {
        amount: parseFloat(perTradeCharge.amount),
        description: perTradeCharge.description
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking per trade charge for strategy:', error);
    return null;
  }
};
