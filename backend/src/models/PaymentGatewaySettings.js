import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const PaymentGatewaySettings = sequelize.define('payment_gateway_settings', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
    comment: 'Admin user ID who configured these settings'
  },
  gateway_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'razorpay',
    comment: 'Payment gateway name (razorpay, stripe, etc.)'
  },
  razorpay_key_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Razorpay API Key ID'
  },
  razorpay_key_secret: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Razorpay API Key Secret (encrypted)'
  },
  is_test_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether gateway is in test/sandbox mode'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether payment gateway is enabled'
  },
  webhook_secret: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Webhook secret for payment notifications'
  },
  supported_currencies: {
    type: DataTypes.STRING(255),
    defaultValue: 'INR',
    comment: 'Comma-separated list of supported currencies'
  },
  // UPI Configuration
  upi_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether UPI payment is enabled'
  },
  upi_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Primary UPI ID for receiving payments'
  },
  upi_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Name associated with UPI ID'
  },
  upi_qr_code: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'UPI QR code image URL or base64'
  },
  // MetaMask/Crypto Configuration
  metamask_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether MetaMask/crypto payment is enabled'
  },
  wallet_address: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Primary crypto wallet address'
  },
  supported_networks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array of supported blockchain networks'
  },
  supported_tokens: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array of supported cryptocurrency tokens'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'payment_gateway_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default PaymentGatewaySettings;
