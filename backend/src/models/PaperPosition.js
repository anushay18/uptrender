import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const PaperPosition = sequelize.define('PaperPosition', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  strategyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'strategies',
      key: 'id'
    }
  },
  orderId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  symbol: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  market: {
    type: DataTypes.ENUM('Forex', 'Crypto', 'Indian'),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Buy', 'Sell'),
    allowNull: false
  },
  volume: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  openPrice: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  currentPrice: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  stopLoss: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  takeProfit: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  stopLossType: {
    type: DataTypes.ENUM('price', 'points', 'percentage'),
    defaultValue: 'points'
  },
  takeProfitType: {
    type: DataTypes.ENUM('price', 'points', 'percentage'),
    defaultValue: 'points'
  },
  profit: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  profitPercent: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('Open', 'Closed', 'SL_Hit', 'TP_Hit'),
    defaultValue: 'Open'
  },
  openTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  closeTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  closePrice: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  realizedProfit: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'paper_positions',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['symbol'] },
    { fields: ['strategyId'] }
  ]
});

export default PaperPosition;
