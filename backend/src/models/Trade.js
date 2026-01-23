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
  // Parent-Child Architecture for multi-broker execution
  parentTradeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'trades',
      key: 'id'
    },
    comment: 'Reference to parent trade for multi-broker execution'
  },
  isParent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'True if this is a parent/signal trade, false for child/execution trades'
  },
  apiKeyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'apikeys',
      key: 'id'
    },
    comment: 'Reference to the broker API key used for this trade'
  },
  // Broker-specific price tracking
  brokerBid: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true,
    comment: 'Current bid price from THIS broker'
  },
  brokerAsk: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true,
    comment: 'Current ask price from THIS broker'
  },
  brokerLastPrice: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true,
    comment: 'Last traded price from THIS broker'
  },
  lastPriceUpdate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp of last price update from broker'
  },
  // Per-broker stop loss and take profit
  stopLoss: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true,
    comment: 'Stop loss price for this specific broker execution'
  },
  takeProfit: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true,
    comment: 'Take profit price for this specific broker execution'
  },
  slTriggered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether stop loss was triggered for this broker'
  },
  tpTriggered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether take profit was triggered for this broker'
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
    { fields: ['date'] },
    { fields: ['parentTradeId'] },
    { fields: ['apiKeyId'] },
    { fields: ['strategyId', 'userId'] }
  ]
});

export default Trade;