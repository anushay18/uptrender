import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const PerTradeCharge = sequelize.define('PerTradeCharge', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Per trade charge amount in rupees'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Description of the per trade charge'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this per trade charge is active'
  },
  strategyIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of strategy IDs this charge applies to'
  }
}, {
  tableName: 'per_trade_charges',
  timestamps: true
});

export default PerTradeCharge;
