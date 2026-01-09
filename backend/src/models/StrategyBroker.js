import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const StrategyBroker = sequelize.define('StrategyBroker', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  strategyId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'strategies',
      key: 'id'
    }
  },
  apiKeyId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'apikeys',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'strategy_brokers',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['strategyId', 'apiKeyId'],
      name: 'unique_strategy_apikey'
    },
    {
      fields: ['strategyId'],
      name: 'idx_strategyId'
    },
    {
      fields: ['apiKeyId'],
      name: 'idx_apiKeyId'
    },
    {
      fields: ['strategyId', 'isActive'],
      name: 'idx_strategy_broker_active'
    }
  ]
});

export default StrategyBroker;
