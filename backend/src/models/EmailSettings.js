import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const EmailSettings = sequelize.define('EmailSettings', {
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
  smtpHost: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'smtp_host',
  },
  smtpPort: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 587,
    field: 'smtp_port',
  },
  smtpUsername: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'smtp_username',
  },
  smtpPassword: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'smtp_password',
  },
  fromEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'from_email',
  },
  fromName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'from_name',
  },
  // Email notification toggles
  sendWelcomeEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'send_welcome_email',
  },
  sendPasswordResetEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'send_password_reset_email',
  },
  sendTradeNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'send_trade_notifications',
  },
  sendStrategyAlerts: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'send_strategy_alerts',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  tableName: 'email_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id'],
      name: 'unique_user_email_settings',
    },
  ],
});

export default EmailSettings;
