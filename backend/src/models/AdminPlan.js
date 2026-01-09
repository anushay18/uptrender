import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AdminPlan = sequelize.define('AdminPlan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    validate: {
      min: 1
    }
  },
  durationType: {
    type: DataTypes.ENUM('days', 'months', 'years'),
    allowNull: false,
    defaultValue: 'days'
  },
  walletBalance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  features: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  isPopular: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  planType: {
    type: DataTypes.ENUM('basic', 'professional', 'enterprise'),
    allowNull: false,
    defaultValue: 'basic'
  },
  maxStrategies: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  maxTrades: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  apiAccess: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'standard', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'standard'
  },
  subscribers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'AdminPlans',
  timestamps: true,
  indexes: [
    {
      name: 'idx_admin_plans_active',
      fields: ['isActive']
    },
    {
      name: 'idx_admin_plans_type',
      fields: ['planType']
    },
    {
      name: 'idx_admin_plans_popular',
      fields: ['isPopular']
    }
  ]
});

// Instance methods
AdminPlan.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Convert price to number for frontend
  if (values.price) {
    values.price = parseFloat(values.price);
  }
  if (values.walletBalance) {
    values.walletBalance = parseFloat(values.walletBalance);
  }
  
  return values;
};

// Class methods
AdminPlan.getActivePublicPlans = function() {
  return this.findAll({
    where: {
      isActive: true
    },
    order: [
      ['isPopular', 'DESC'],
      ['price', 'ASC'],
      ['createdAt', 'DESC']
    ]
  });
};

AdminPlan.getPopularPlans = function() {
  return this.findAll({
    where: {
      isActive: true,
      isPopular: true
    },
    order: [['price', 'ASC']]
  });
};

AdminPlan.getPlansByType = function(planType) {
  return this.findAll({
    where: {
      isActive: true,
      planType: planType
    },
    order: [['price', 'ASC']]
  });
};

export default AdminPlan;