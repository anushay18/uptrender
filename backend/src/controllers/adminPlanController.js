import AdminPlan from '../models/AdminPlan.js';
import { Op } from 'sequelize';

class AdminPlanController {
  // Get all admin plans
  async getPlans(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        planType = '', 
        isActive = '', 
        isPopular = '' 
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = {};

      // Apply filters
      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      if (planType) {
        whereClause.planType = planType;
      }

      if (isActive !== '') {
        whereClause.isActive = isActive === 'true';
      }

      if (isPopular !== '') {
        whereClause.isPopular = isPopular === 'true';
      }

      const { count, rows: plans } = await AdminPlan.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [
          ['isPopular', 'DESC'],
          ['createdAt', 'DESC']
        ]
      });

      res.json({
        success: true,
        data: plans,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get admin plans error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch plans'
      });
    }
  }

  // Get active public plans (for user pricing page)
  async getPublicPlans(req, res) {
    try {
      const plans = await AdminPlan.getActivePublicPlans();
      
      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Get public plans error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch public plans'
      });
    }
  }

  // Get plan by ID
  async getPlanById(req, res) {
    try {
      const { id } = req.params;
      
      const plan = await AdminPlan.findByPk(id);
      
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }

      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      console.error('Get plan by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch plan'
      });
    }
  }

  // Create new plan
  async createPlan(req, res) {
    try {
      const {
        name,
        description,
        price,
        duration,
        durationType,
        walletBalance,
        features,
        isPopular,
        isActive,
        planType,
        maxStrategies,
        maxTrades,
        apiAccess,
        priority
      } = req.body;

      // Validation
      if (!name || !price || !walletBalance) {
        return res.status(400).json({
          success: false,
          error: 'Name, price, and wallet balance are required'
        });
      }

      // Check if plan name already exists
      const existingPlan = await AdminPlan.findOne({
        where: { name: name.trim() }
      });

      if (existingPlan) {
        return res.status(400).json({
          success: false,
          error: 'Plan name already exists'
        });
      }

      const plan = await AdminPlan.create({
        name: name.trim(),
        description: description?.trim(),
        price: parseFloat(price),
        duration: parseInt(duration) || 30,
        durationType: durationType || 'days',
        walletBalance: parseFloat(walletBalance),
        features: Array.isArray(features) ? features.filter(f => f.trim()) : [],
        isPopular: Boolean(isPopular),
        isActive: Boolean(isActive !== false), // Default to true
        planType: planType || 'basic',
        maxStrategies: maxStrategies ? parseInt(maxStrategies) : null,
        maxTrades: maxTrades ? parseInt(maxTrades) : null,
        apiAccess: Boolean(apiAccess),
        priority: priority || 'standard',
        createdBy: req.user?.id,
        updatedBy: req.user?.id
      });

      res.status(201).json({
        success: true,
        data: plan,
        message: 'Plan created successfully'
      });
    } catch (error) {
      console.error('Create plan error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create plan'
      });
    }
  }

  // Update plan
  async updatePlan(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        price,
        duration,
        durationType,
        walletBalance,
        features,
        isPopular,
        isActive,
        planType,
        maxStrategies,
        maxTrades,
        apiAccess,
        priority
      } = req.body;

      const plan = await AdminPlan.findByPk(id);
      
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }

      // Check if new name conflicts with existing plan
      if (name && name.trim() !== plan.name) {
        const existingPlan = await AdminPlan.findOne({
          where: { 
            name: name.trim(),
            id: { [Op.ne]: id }
          }
        });

        if (existingPlan) {
          return res.status(400).json({
            success: false,
            error: 'Plan name already exists'
          });
        }
      }

      // Update plan
      await plan.update({
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(durationType && { durationType }),
        ...(walletBalance !== undefined && { walletBalance: parseFloat(walletBalance) }),
        ...(features !== undefined && { 
          features: Array.isArray(features) ? features.filter(f => f.trim()) : []
        }),
        ...(isPopular !== undefined && { isPopular: Boolean(isPopular) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(planType && { planType }),
        ...(maxStrategies !== undefined && { 
          maxStrategies: maxStrategies ? parseInt(maxStrategies) : null 
        }),
        ...(maxTrades !== undefined && { 
          maxTrades: maxTrades ? parseInt(maxTrades) : null 
        }),
        ...(apiAccess !== undefined && { apiAccess: Boolean(apiAccess) }),
        ...(priority && { priority }),
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        data: plan,
        message: 'Plan updated successfully'
      });
    } catch (error) {
      console.error('Update plan error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update plan'
      });
    }
  }

  // Delete plan
  async deletePlan(req, res) {
    try {
      const { id } = req.params;
      
      const plan = await AdminPlan.findByPk(id);
      
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }

      // Check if plan has active subscribers
      if (plan.subscribers > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete plan with active subscribers'
        });
      }

      await plan.destroy();

      res.json({
        success: true,
        message: 'Plan deleted successfully'
      });
    } catch (error) {
      console.error('Delete plan error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete plan'
      });
    }
  }

  // Toggle plan status
  async togglePlanStatus(req, res) {
    try {
      const { id } = req.params;
      
      const plan = await AdminPlan.findByPk(id);
      
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }

      await plan.update({
        isActive: !plan.isActive,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        data: plan,
        message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Toggle plan status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle plan status'
      });
    }
  }

  // Get plan statistics
  async getPlanStats(req, res) {
    try {
      const totalPlans = await AdminPlan.count();
      const activePlans = await AdminPlan.count({ where: { isActive: true } });
      const popularPlans = await AdminPlan.count({ where: { isPopular: true } });
      const totalSubscribers = await AdminPlan.sum('subscribers') || 0;

      const plansByType = await AdminPlan.findAll({
        attributes: [
          'planType',
          [AdminPlan.sequelize.fn('COUNT', AdminPlan.sequelize.col('id')), 'count'],
          [AdminPlan.sequelize.fn('SUM', AdminPlan.sequelize.col('subscribers')), 'subscribers']
        ],
        group: 'planType',
        raw: true
      });

      res.json({
        success: true,
        data: {
          totalPlans,
          activePlans,
          popularPlans,
          totalSubscribers,
          plansByType
        }
      });
    } catch (error) {
      console.error('Get plan stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch plan statistics'
      });
    }
  }

  // Bulk update plans
  async bulkUpdatePlans(req, res) {
    try {
      const { plans } = req.body;
      
      if (!Array.isArray(plans) || plans.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plans data'
        });
      }

      const results = [];
      
      for (const planData of plans) {
        try {
          const plan = await AdminPlan.findByPk(planData.id);
          if (plan) {
            await plan.update({
              ...planData,
              updatedBy: req.user?.id
            });
            results.push({ id: planData.id, success: true });
          } else {
            results.push({ id: planData.id, success: false, error: 'Plan not found' });
          }
        } catch (error) {
          results.push({ id: planData.id, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        data: results,
        message: 'Bulk update completed'
      });
    } catch (error) {
      console.error('Bulk update plans error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update plans'
      });
    }
  }
}

export default new AdminPlanController();