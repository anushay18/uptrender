import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Charge = sequelize.define('Charge', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  chargeType: {
    type: DataTypes.ENUM('api_key', 'copy_trading_account'),
    allowNull: false,
    unique: true,
    comment: 'Type of charge: api_key for API key addition, copy_trading_account for copy trading account'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Charge amount in rupees'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this charge is currently active'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Description of the charge'
  }
}, {
  tableName: 'charges',
  timestamps: true
});

export default Charge;
