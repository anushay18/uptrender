import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
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
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active',
    allowNull: false
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
  webhookSecret: {
    type: DataTypes.STRING(6),
    allowNull: true,
    unique: true
  },
  settings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
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