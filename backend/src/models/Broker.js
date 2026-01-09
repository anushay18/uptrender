import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Broker = sequelize.define('Broker', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  segment: {
    type: DataTypes.ENUM('Crypto', 'Forex', 'Indian'),
    allowNull: false
  },
  apiBaseUrl: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active'
  },
  logoUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'brokers',
  timestamps: true
});

export default Broker;
