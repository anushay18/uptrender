import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const UsageStat = sequelize.define('UsageStat', {
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
  userAccountsCurrent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  userAccountsLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 1000
  },
  apiIntegrationsCurrent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  apiIntegrationsLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 200
  },
  tradingStrategiesCurrent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  tradingStrategiesLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 300
  }
}, {
  tableName: 'usagestats',
  timestamps: true,
  indexes: [
    { fields: ['userId'] }
  ]
});

export default UsageStat;