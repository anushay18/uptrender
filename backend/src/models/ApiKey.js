import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ApiKey = sequelize.define('ApiKey', {
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
  segment: {
    type: DataTypes.ENUM('Crypto', 'Forex', 'Indian'),
    allowNull: false
  },
  broker: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  exchangeId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'CCXT exchange identifier (e.g., binance, kucoin)'
  },
  accountType: {
    type: DataTypes.ENUM('spot', 'future', 'swap', 'margin'),
    defaultValue: 'spot',
    comment: 'Account type for the exchange'
  },
  apiName: {
    type: DataTypes.STRING(255),
    allowNull: true  // Changed to true for MT5 compatibility
  },
  brokerId: {
    type: DataTypes.STRING(100),
    allowNull: true  // Changed to true for MT5 compatibility
  },
  mpin: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  totp: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  apiKey: {
    type: DataTypes.STRING(255),
    allowNull: true  // Changed to true for MT5 compatibility
  },
  apiSecret: {
    type: DataTypes.STRING(255),
    allowNull: true  // Changed to true for MT5 compatibility
  },
  passphrase: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // MT5 specific fields
  appName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  accessToken: {
    type: DataTypes.TEXT,  // Changed from STRING(500) to TEXT for MetaAPI JWT tokens
    allowNull: true
  },
  autologin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('Active', 'Pending', 'Inactive'),
    defaultValue: 'Pending'
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Broker account balance'
  },
  lastBalanceUpdate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time balance was fetched from broker'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is the default API for the segment'
  }
}, {
  tableName: 'apikeys',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['segment'] },
    { fields: ['status'] }
  ]
});

export default ApiKey;