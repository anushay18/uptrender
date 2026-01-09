import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const CopyTradingAccount = sequelize.define('CopyTradingAccount', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'user_id',
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('master', 'child'),
    allowNull: false,
  },
  broker: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  apiKey: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'api_key',
  },
  secretKey: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'secret_key',
  },
  masterAccountId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'master_account_id',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'copy_trading_accounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'name'],
      name: 'unique_user_account_name',
    },
    {
      fields: ['user_id'],
      name: 'idx_user_id',
    },
    {
      fields: ['type'],
      name: 'idx_type',
    },
    {
      fields: ['is_active'],
      name: 'idx_is_active',
    },
    {
      fields: ['master_account_id'],
      name: 'idx_master_account_id',
    },
  ],
});

export default CopyTradingAccount;