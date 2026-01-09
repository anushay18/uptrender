import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Settings = sequelize.define('Settings', {
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
  notifications: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      email: true,
      push: true,
      sms: false,
      tradealerts: true,
      strategyAlerts: true
    }
  },
  security: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      twoFactorAuth: false,
      loginAlerts: true
    }
  },
  preferences: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC'
    }
  }
}, {
  tableName: 'settings',
  timestamps: true
});

export default Settings;
