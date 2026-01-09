import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SupportMessage = sequelize.define('SupportMessage', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  ticketId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'SupportTickets',
      key: 'id'
    }
  },
  authorId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  attachments: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'supportmessages',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['ticketId'] }
  ]
});

export default SupportMessage;
