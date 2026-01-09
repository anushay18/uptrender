import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const PlansCatalog = sequelize.define('PlansCatalog', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Free', 'Basic', 'Pro', 'Enterprise'),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  billingCycle: {
    type: DataTypes.ENUM('Monthly', 'Yearly'),
    allowNull: false
  },
  features: {
    type: DataTypes.JSON,
    allowNull: true
  },
  limits: {
    type: DataTypes.JSON,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'planscatalog',
  timestamps: true
});

export default PlansCatalog;
