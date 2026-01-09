import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const PlatformSettings = sequelize.define('platform_settings', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Platform logo file path or URL'
  },
  logo_alt_text: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: 'Platform Logo',
    comment: 'Alt text for logo accessibility'
  },
  logo_link_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL when logo is clicked'
  },
  favicon_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Platform favicon file path or URL'
  },
  platform_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: 'Uptrender',
    comment: 'Platform name displayed in title'
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
  tableName: 'platform_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default PlatformSettings;
