import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR'
  },
  status: {
    type: DataTypes.ENUM('Active', 'Frozen', 'Closed'),
    defaultValue: 'Active'
  }
}, {
  tableName: 'wallets',
  timestamps: true
});

export default Wallet;
