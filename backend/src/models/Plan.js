import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Plan = sequelize.define('Plan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Monthly', 'Yearly'),
    defaultValue: 'Monthly'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  usedDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  remainingDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'plans',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['isActive'] }
  ]
});

export default Plan;