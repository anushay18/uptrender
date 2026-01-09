import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Trade = sequelize.define('Trade', {
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
  orderId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  market: {
    type: DataTypes.ENUM('Forex', 'Crypto', 'Indian'),
    allowNull: false
  },
  symbol: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Buy', 'Sell'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  currentPrice: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  pnl: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  pnlPercentage: {
    type: DataTypes.DECIMAL(7, 2),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Completed', 'Pending', 'Failed', 'Closed', 'Open'),
    defaultValue: 'Pending',
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  broker: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  brokerType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // --- Order log / execution audit fields ---
  signalReceivedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  signalPayload: {
    type: DataTypes.JSON,
    allowNull: true
  },
  signalSendStatus: {
    type: DataTypes.ENUM('Pending', 'Sent', 'Failed', 'Paper'),
    allowNull: true
  },
  signalSendError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  filledQuantity: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  avgFillPrice: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  brokerStatus: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  brokerError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  strategyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'strategies',
      key: 'id'
    }
  },
  brokerResponse: {
    // Legacy column in DB (TEXT) — kept for backward compatibility
    type: DataTypes.TEXT,
    allowNull: true
  },
  brokerResponseJson: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'trades',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['market'] },
    { fields: ['date'] }
  ]
});

export default Trade;