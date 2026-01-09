import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const UserFavorite = sequelize.define('UserFavorite', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  strategyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'strategies',
      key: 'id'
    }
  }
}, {
  tableName: 'user_favorites',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'strategyId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['strategyId']
    }
  ]
});

export default UserFavorite;
