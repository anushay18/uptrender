import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  walletId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'Wallets',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'rejected', 'failed'),
    allowNull: false,
    defaultValue: 'completed',
    comment: 'Transaction status - pending for manual verification payments'
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Payment method used - razorpay, upi, crypto, admin'
  }
}, {
  tableName: 'wallettransactions',
  timestamps: true,
  updatedAt: false
});

export default WalletTransaction;
