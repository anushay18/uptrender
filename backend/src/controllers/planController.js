import { Plan, User } from '../models/index.js';
import { Op } from 'sequelize';

// Get user's plan
export const getUserPlan = async (req, res) => {
  try {
    const userId = req.user.id;

    const plan = await Plan.findOne({
      where: { userId, isActive: true },
      attributes: ['id', 'name', 'type', 'price', 'totalDays', 'usedDays', 'remainingDays', 'startDate', 'endDate', 'isActive', 'createdAt', 'updatedAt']
    });

    if (!plan) {
      return res.json({
        success: true,
        data: null,
        message: 'No active plan found'
      });
    }

    // Calculate days dynamically
    const startDate = new Date(plan.startDate);
    const endDate = new Date(plan.endDate);
    const today = new Date();
    
    // Calculate total days between start and end
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // Calculate used days from start to today
    const usedDays = Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)));
    
    // Calculate remaining days
    const remainingDays = Math.max(0, totalDays - usedDays);

    // Update the plan with calculated values
    await plan.update({
      totalDays,
      usedDays: Math.min(usedDays, totalDays),
      remainingDays
    });

    // Return updated plan data
    const updatedPlan = await Plan.findOne({
      where: { id: plan.id },
      attributes: ['id', 'name', 'type', 'price', 'totalDays', 'usedDays', 'remainingDays', 'startDate', 'endDate', 'isActive', 'createdAt', 'updatedAt']
    });

    res.json({
      success: true,
      data: updatedPlan
    });
  } catch (error) {
    console.error('Get user plan error:', error);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
};

// Get available plans (catalog)
export const getAvailablePlans = async (req, res) => {
  try {
    const { type } = req.query;

    const where = { isActive: true };
    if (type) where.type = type;

    // Get distinct plan types and prices from existing plans
    const plans = await Plan.findAll({
      where,
      attributes: ['name', 'type', 'price'],
      group: ['name', 'type', 'price'],
      order: [['price', 'ASC']]
    });

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Get available plans error:', error);
    res.status(500).json({ error: 'Failed to fetch available plans' });
  }
};

// Subscribe to a plan
export const subscribeToPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId, billingCycle = 'Monthly' } = req.body;

    // Get plan details
    const planCatalog = await PlansCatalog.findByPk(planId);
    if (!planCatalog) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!planCatalog.isActive) {
      return res.status(400).json({ error: 'Plan is not available' });
    }

    // Cancel any existing active plans
    await Plan.update(
      { status: 'Cancelled', endDate: new Date() },
      { where: { userId, status: 'Active' } }
    );

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === 'Yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create new plan subscription
    const plan = await Plan.create({
      userId,
      planId,
      startDate,
      endDate,
      billingCycle,
      status: 'Active',
      autoRenew: true
    });

    // Get full details with catalog info
    const fullPlan = await Plan.findByPk(plan.id, {
      include: [
        {
          model: PlansCatalog,
          as: 'planDetails'
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Plan subscribed successfully',
      data: fullPlan
    });
  } catch (error) {
    console.error('Subscribe to plan error:', error);
    res.status(500).json({ error: 'Failed to subscribe to plan' });
  }
};

// Cancel user's plan
export const cancelUserPlan = async (req, res) => {
  try {
    const userId = req.user.id;

    const plan = await Plan.findOne({
      where: { userId, status: 'Active' }
    });

    if (!plan) {
      return res.status(404).json({ error: 'No active plan found' });
    }

    await plan.update({
      status: 'Cancelled',
      autoRenew: false
    });

    res.json({
      success: true,
      message: 'Plan cancelled successfully',
      data: plan
    });
  } catch (error) {
    console.error('Cancel plan error:', error);
    res.status(500).json({ error: 'Failed to cancel plan' });
  }
};

// Toggle auto-renew
export const toggleAutoRenew = async (req, res) => {
  try {
    const userId = req.user.id;

    const plan = await Plan.findOne({
      where: { userId, status: 'Active' }
    });

    if (!plan) {
      return res.status(404).json({ error: 'No active plan found' });
    }

    await plan.update({
      autoRenew: !plan.autoRenew
    });

    res.json({
      success: true,
      message: `Auto-renew ${plan.autoRenew ? 'enabled' : 'disabled'} successfully`,
      data: plan
    });
  } catch (error) {
    console.error('Toggle auto-renew error:', error);
    res.status(500).json({ error: 'Failed to toggle auto-renew' });
  }
};

// Admin: Get all plans
export const getAllPlans = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const plans = await Plan.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        },
        {
          model: PlansCatalog,
          as: 'planDetails',
          attributes: ['name', 'code', 'type', 'price']
        }
      ]
    });

    res.json({
      success: true,
      data: plans.rows,
      pagination: {
        total: plans.count,
        page: parseInt(page),
        pages: Math.ceil(plans.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

// Admin: Create plan catalog entry
export const createPlanCatalog = async (req, res) => {
  try {
    const { 
      code, name, type, price, billingCycle, 
      features, limits, description, isActive 
    } = req.body;

    // Check if code already exists
    const existing = await PlansCatalog.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({ error: 'Plan code already exists' });
    }

    const planCatalog = await PlansCatalog.create({
      code,
      name,
      type,
      price,
      billingCycle,
      features: features || [],
      limits: limits || {},
      description,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'Plan catalog created successfully',
      data: planCatalog
    });
  } catch (error) {
    console.error('Create plan catalog error:', error);
    res.status(500).json({ error: 'Failed to create plan catalog' });
  }
};

// Admin: Update plan catalog
export const updatePlanCatalog = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const planCatalog = await PlansCatalog.findByPk(id);
    if (!planCatalog) {
      return res.status(404).json({ error: 'Plan catalog not found' });
    }

    // Don't allow updating code or id
    delete updateData.id;
    delete updateData.createdAt;

    await planCatalog.update(updateData);

    res.json({
      success: true,
      message: 'Plan catalog updated successfully',
      data: planCatalog
    });
  } catch (error) {
    console.error('Update plan catalog error:', error);
    res.status(500).json({ error: 'Failed to update plan catalog' });
  }
};

// Admin: Delete plan catalog
export const deletePlanCatalog = async (req, res) => {
  try {
    const { id } = req.params;

    const planCatalog = await PlansCatalog.findByPk(id);
    if (!planCatalog) {
      return res.status(404).json({ error: 'Plan catalog not found' });
    }

    // Check if any active plans are using this
    const activePlans = await Plan.count({
      where: { planId: id, status: 'Active' }
    });

    if (activePlans > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete plan with active subscriptions',
        activePlans 
      });
    }

    await planCatalog.destroy();

    res.json({
      success: true,
      message: 'Plan catalog deleted successfully'
    });
  } catch (error) {
    console.error('Delete plan catalog error:', error);
    res.status(500).json({ error: 'Failed to delete plan catalog' });
  }
};
