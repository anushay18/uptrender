import { sequelize } from '../config/database.js';

// Import all models
import User from './User.js';
import Trade from './Trade.js';
import Strategy from './Strategy.js';
import ApiKey from './ApiKey.js';
import Plan from './Plan.js';
import UsageStat from './UsageStat.js';
import Broker from './Broker.js';
import Wallet from './Wallet.js';
import WalletTransaction from './WalletTransaction.js';
import Notification from './Notification.js';
import ActivityLog from './ActivityLog.js';
import Settings from './Settings.js';
import SupportTicket from './SupportTicket.js';
import SupportMessage from './SupportMessage.js';
import PlansCatalog from './PlansCatalog.js';
import AdminPlan from './AdminPlan.js';
import StrategySubscription from './StrategySubscription.js';
import CopyTradingAccount from './CopyTradingAccount.js';
import Charge from './Charge.js';
import PerTradeCharge from './PerTradeCharge.js';
import StrategyBroker from './StrategyBroker.js';
import EmailSettings from './EmailSettings.js';
import PaymentGatewaySettings from './PaymentGatewaySettings.js';
import PlatformSettings from './PlatformSettings.js';
import PaperPosition from './PaperPosition.js';
import UserFavorite from './UserFavorite.js';

// ========== User Associations ==========
User.hasMany(Trade, { foreignKey: 'userId', as: 'trades', onDelete: 'CASCADE' });
Trade.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Strategy, { foreignKey: 'userId', as: 'strategies', onDelete: 'CASCADE' });
Strategy.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ApiKey, { foreignKey: 'userId', as: 'apiKeys', onDelete: 'CASCADE' });
ApiKey.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Plan, { foreignKey: 'userId', as: 'plans', onDelete: 'CASCADE' });
Plan.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(UsageStat, { foreignKey: 'userId', as: 'usageStats', onDelete: 'CASCADE' });
UsageStat.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet', onDelete: 'CASCADE' });
Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activityLogs', onDelete: 'SET NULL' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(Settings, { foreignKey: 'userId', as: 'userSettings', onDelete: 'CASCADE' });
Settings.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(SupportTicket, { foreignKey: 'userId', as: 'tickets', onDelete: 'CASCADE' });
SupportTicket.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(SupportTicket, { foreignKey: 'assignedTo', as: 'assignedTickets', onDelete: 'SET NULL' });
SupportTicket.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });

User.hasMany(SupportMessage, { foreignKey: 'authorId', as: 'messages', onDelete: 'CASCADE' });
SupportMessage.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

// ========== Trade-Strategy Associations ==========
Strategy.hasMany(Trade, { foreignKey: 'strategyId', as: 'trades', onDelete: 'SET NULL' });
Trade.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });

// ========== Plan Associations ==========
// REMOVED: Plans table does not have planId foreign key to PlansCatalog in database
// Plan.belongsTo(PlansCatalog, { foreignKey: 'planId', as: 'planDetails' });
// PlansCatalog.hasMany(Plan, { foreignKey: 'planId', as: 'subscriptions' });

// ========== Wallet Associations ==========
Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', as: 'transactions', onDelete: 'CASCADE' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

// ========== Support Ticket Associations ==========
SupportTicket.hasMany(SupportMessage, { foreignKey: 'ticketId', as: 'messages', onDelete: 'CASCADE' });
SupportMessage.belongsTo(SupportTicket, { foreignKey: 'ticketId', as: 'ticket' });

// Sync database (DISABLED by default - use migrations in production)
// Uncomment only for initial development
// if (process.env.NODE_ENV === 'development') {
//   sequelize.sync({ alter: false })
//     .then(() => console.log('Database synced'))
//     .catch(err => console.error('Database sync error:', err));
// }

User.hasMany(StrategySubscription, { foreignKey: 'userId', as: 'strategySubscriptions', onDelete: 'CASCADE' });
StrategySubscription.belongsTo(User, { foreignKey: 'userId', as: 'subscriber' });

Strategy.hasMany(StrategySubscription, { foreignKey: 'strategyId', as: 'subscriptions', onDelete: 'CASCADE' });
StrategySubscription.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });

User.hasMany(CopyTradingAccount, { foreignKey: 'userId', as: 'copyTradingAccounts', onDelete: 'CASCADE' });
CopyTradingAccount.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

// ========== Strategy-Broker Associations ==========
Strategy.belongsToMany(ApiKey, { 
  through: StrategyBroker, 
  foreignKey: 'strategyId', 
  otherKey: 'apiKeyId',
  as: 'brokers',
  onDelete: 'CASCADE' 
});

ApiKey.belongsToMany(Strategy, { 
  through: StrategyBroker, 
  foreignKey: 'apiKeyId', 
  otherKey: 'strategyId',
  as: 'strategies',
  onDelete: 'CASCADE' 
});

StrategyBroker.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });
StrategyBroker.belongsTo(ApiKey, { foreignKey: 'apiKeyId', as: 'apiKey' });
Strategy.hasMany(StrategyBroker, { foreignKey: 'strategyId', as: 'strategyBrokers', onDelete: 'CASCADE' });
ApiKey.hasMany(StrategyBroker, { foreignKey: 'apiKeyId', as: 'strategyBrokers', onDelete: 'CASCADE' });

// ========== Paper Position Associations ==========
User.hasMany(PaperPosition, { foreignKey: 'userId', as: 'paperPositions', onDelete: 'CASCADE' });
PaperPosition.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Strategy.hasMany(PaperPosition, { foreignKey: 'strategyId', as: 'paperPositions', onDelete: 'SET NULL' });
PaperPosition.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });

// ========== User Favorites Associations ==========
User.hasMany(UserFavorite, { foreignKey: 'userId', as: 'favorites', onDelete: 'CASCADE' });
UserFavorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Strategy.hasMany(UserFavorite, { foreignKey: 'strategyId', as: 'favoritedBy', onDelete: 'CASCADE' });
UserFavorite.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });

export {
  sequelize,
  User,
  Trade,
  Strategy,
  ApiKey,
  Plan,
  UsageStat,
  Broker,
  Wallet,
  WalletTransaction,
  Notification,
  ActivityLog,
  Settings,
  SupportTicket,
  SupportMessage,
  PlansCatalog,
  AdminPlan,
  StrategySubscription,
  CopyTradingAccount,
  Charge,
  PerTradeCharge,
  StrategyBroker,
  EmailSettings,
  PaymentGatewaySettings,
  PlatformSettings,
  PaperPosition,
  UserFavorite
};