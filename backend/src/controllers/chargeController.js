import { Charge } from '../models/index.js';

/**
 * Get all charges
 */
export const getAllCharges = async (req, res) => {
  try {
    const charges = await Charge.findAll({
      order: [['chargeType', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: charges
    });
  } catch (error) {
    console.error('Error fetching charges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch charges',
      error: error.message
    });
  }
};

/**
 * Get a specific charge by ID
 */
export const getChargeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const charge = await Charge.findByPk(id);
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found'
      });
    }

    res.status(200).json({
      success: true,
      data: charge
    });
  } catch (error) {
    console.error('Error fetching charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch charge',
      error: error.message
    });
  }
};

/**
 * Get charge by type
 */
export const getChargeByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    const charge = await Charge.findOne({
      where: { chargeType: type }
    });
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found for this type'
      });
    }

    res.status(200).json({
      success: true,
      data: charge
    });
  } catch (error) {
    console.error('Error fetching charge by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch charge',
      error: error.message
    });
  }
};

/**
 * Create or update a charge
 */
export const upsertCharge = async (req, res) => {
  try {
    const { chargeType, amount, isActive, description } = req.body;

    if (!chargeType || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'chargeType and amount are required'
      });
    }

    const [charge, created] = await Charge.upsert({
      chargeType,
      amount,
      isActive: isActive !== undefined ? isActive : true,
      description
    }, {
      returning: true
    });

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Charge created successfully' : 'Charge updated successfully',
      data: charge
    });
  } catch (error) {
    console.error('Error upserting charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save charge',
      error: error.message
    });
  }
};

/**
 * Update a charge
 */
export const updateCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, isActive, description } = req.body;

    const charge = await Charge.findByPk(id);
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found'
      });
    }

    if (amount !== undefined) charge.amount = amount;
    if (isActive !== undefined) charge.isActive = isActive;
    if (description !== undefined) charge.description = description;

    await charge.save();

    res.status(200).json({
      success: true,
      message: 'Charge updated successfully',
      data: charge
    });
  } catch (error) {
    console.error('Error updating charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update charge',
      error: error.message
    });
  }
};

/**
 * Delete a charge
 */
export const deleteCharge = async (req, res) => {
  try {
    const { id } = req.params;

    const charge = await Charge.findByPk(id);
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Charge not found'
      });
    }

    await charge.destroy();

    res.status(200).json({
      success: true,
      message: 'Charge deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting charge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete charge',
      error: error.message
    });
  }
};
