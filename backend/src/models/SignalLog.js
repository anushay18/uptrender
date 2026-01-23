import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SignalLog = sequelize.define('SignalLog', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  strategyId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false
  },
  segment: {
    type: DataTypes.ENUM('Indian', 'Forex', 'Crypto'),
    allowNull: false
  },
  canonicalSymbol: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  signal: {
    type: DataTypes.TINYINT,
    allowNull: false,
    comment: '1 = BUY, -1 = SELL, 0 = SQUARE OFF'
  },
  signalId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  payloadHash: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  payload: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'admin'
  },
  usersNotified: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of users notified'
  },
  tradesExecuted: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of trades executed'
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  receivedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'signal_logs',
  timestamps: false,
  indexes: [
    {
      fields: ['strategyId']
    },
    {
      fields: ['receivedAt']
    },
    {
      fields: ['signal']
    }
  ]
});

export default SignalLog;
