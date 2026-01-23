import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'user', 'franchise'),
    defaultValue: 'user',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active',
    allowNull: false
  },
  // Franchise fields
  isFranchise: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this user is a franchise owner'
  },
  franchiseId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Unique franchise identifier'
  },
  parentFranchiseId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: 'Parent franchise user ID for sub-franchises'
  },
  franchiseName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Display name for the franchise'
  },
  franchiseCommission: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Commission percentage for franchise'
  },
  franchiseStatus: {
    type: DataTypes.ENUM('Active', 'Inactive', 'Suspended'),
    allowNull: true,
    comment: 'Status of franchise account'
  },
  franchiseJoinedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Date when user became a franchise'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'IND'
  },
  emailVerified: {
    type: DataTypes.ENUM('Yes', 'No'),
    defaultValue: 'No'
  },
  phoneVerified: {
    type: DataTypes.ENUM('Yes', 'No'),
    defaultValue: 'No'
  },
  referralCode: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: true
  },
  referralLink: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  referredBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  joinedBy: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  clientId: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: true
  },
  clientType: {
    type: DataTypes.ENUM('Individual', 'Organization'),
    defaultValue: 'Individual'
  },
  organizationName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  incorporationNumber: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  taxId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  gstNumber: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  panNumber: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  address1: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  address2: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  postalCode: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  contactPhone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  contactEmail: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  kycStatus: {
    type: DataTypes.ENUM('Verified', 'Pending', 'Rejected'),
    defaultValue: 'Pending'
  },
  kycLevel: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  documents: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  verified: {
    type: DataTypes.ENUM('Yes', 'No'),
    defaultValue: 'No'
  },
  avatar: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  googleId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    comment: 'Google OAuth user ID'
  },
  webhookSecret: {
    type: DataTypes.STRING(6),
    allowNull: true,
    unique: true
  },
  passwordChangedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when password was last changed'
  },
  settings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  // Notification preferences
  whatsappNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'WhatsApp number for notifications'
  },
  telegramId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Telegram ID for notifications'
  },
  notifyTradingAlerts: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Receive trading alerts notifications'
  },
  notifyTransactionAlerts: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Receive transaction alerts notifications'
  },
  notifyGeneralNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Receive general notifications'
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
      // Auto-generate 6-digit alphanumeric webhook secret
      if (!user.webhookSecret) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let secret = '';
        for (let i = 0; i < 6; i++) {
          secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        user.webhookSecret = secret;
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

export default User;