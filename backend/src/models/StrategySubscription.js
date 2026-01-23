import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const StrategySubscription = sequelize.define('StrategySubscription', {
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
  strategyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Strategies',
      key: 'id'
    }
  },
  lots: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.01,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPaused: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'When true, trades are not executed for this subscription'
  },
  tradeMode: {
    type: DataTypes.ENUM('paper', 'live'),
    defaultValue: 'paper',
    allowNull: true
  },
  subscribedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when subscription expires (typically 30 days from subscription)'
  }
}, {
  tableName: 'StrategySubscriptions',
  timestamps: true,
  createdAt: 'subscribedAt',
  updatedAt: 'updatedAt',
  indexes: [
    { fields: ['userId'] },
    { fields: ['strategyId'] },
    { fields: ['isActive'] },
    { fields: ['isPaused'] },
    { fields: ['tradeMode'] },
    { fields: ['expiryDate'] },
    { unique: true, fields: ['userId', 'strategyId'] }
  ]
});

export default StrategySubscription;