import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * DataStreamingSettings Model
 * 
 * Stores admin-configured MetaAPI credentials for centralized data streaming.
 * This replaces per-broker data streaming to avoid rate limits.
 * 
 * Architecture:
 * - Admin configures ONE MetaAPI account for data streaming
 * - System gets tick data from this single source
 * - Data is broadcast to all users via Redis pub/sub
 * - User brokers are only used for trade execution, not data
 */
const DataStreamingSettings = sequelize.define('data_streaming_settings', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // Data Provider Selection
  data_provider: {
    type: DataTypes.ENUM('metaapi', 'deriv'),
    defaultValue: 'metaapi',
    comment: 'Which data provider to use: metaapi (MT5) or deriv (free WebSocket)'
  },
  // MetaAPI Credentials
  metaapi_token: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'MetaAPI API token for data streaming'
  },
  metaapi_account_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'MetaAPI account ID for price feed'
  },
  // Deriv Settings
  deriv_app_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: '1089',
    comment: 'Deriv WebSocket App ID (optional, defaults to 1089)'
  },
  // Connection Status
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether data streaming is enabled'
  },
  connection_status: {
    type: DataTypes.ENUM('disconnected', 'connecting', 'connected', 'error'),
    defaultValue: 'disconnected',
    comment: 'Current connection status'
  },
  last_connected_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last successful connection timestamp'
  },
  last_error: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Last error message if any'
  },
  // Symbols to stream
  symbols: {
    type: DataTypes.JSON,
    defaultValue: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'],
    comment: 'List of symbols to stream prices for'
  },
  // Streaming Statistics
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      totalPriceUpdates: 0,
      lastPriceUpdate: null,
      subscribersCount: 0,
      uptime: 0
    },
    comment: 'Streaming statistics'
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
  tableName: 'data_streaming_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default DataStreamingSettings;
