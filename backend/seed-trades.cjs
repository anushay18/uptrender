const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize(
  process.env.DB_NAME || 'algo_trading_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
  }
);

// Trade model definition
// Define Trade model matching the actual database schema
const Trade = sequelize.define('Trade', {
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
  orderId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  market: {
    type: DataTypes.ENUM('Forex', 'Crypto', 'Indian'),
    allowNull: false
  },
  symbol: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Buy', 'Sell'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  currentPrice: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  pnl: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  pnlPercentage: {
    type: DataTypes.DECIMAL(7, 2),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Completed', 'Pending', 'Failed'),
    defaultValue: 'Pending',
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  broker: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  brokerType: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'trades',
  timestamps: true
});

// Sample trade data
const sampleTrades = [
  // Open Positions
  {
    orderId: 'ORD001',
    symbol: 'BTCUSD',
    market: 'Crypto',
    type: 'Buy',
    tradeType: 'Buy',
    quantity: 0.5,
    amount: 25000,
    price: 50000,
    entryPrice: 50000,
    currentPrice: 52000,
    pnl: 1000,
    pnlPercentage: 4.00,
    profitLoss: 1000,
    status: 'Open',
    broker: 'Binance',
    userId: 1
  },
  {
    orderId: 'ORD002',
    symbol: 'ETHUSDT',
    market: 'Crypto',
    type: 'Buy',
    tradeType: 'Buy',
    quantity: 10,
    amount: 30000,
    price: 3000,
    entryPrice: 3000,
    currentPrice: 3150,
    pnl: 1500,
    pnlPercentage: 5.00,
    profitLoss: 1500,
    status: 'Open',
    broker: 'Binance',
    userId: 1
  },
  {
    orderId: 'ORD003',
    symbol: 'RELIANCE',
    market: 'Indian',
    type: 'Buy',
    tradeType: 'Buy',
    quantity: 100,
    amount: 280000,
    price: 2800,
    entryPrice: 2800,
    currentPrice: 2750,
    pnl: -5000,
    pnlPercentage: -1.79,
    profitLoss: -5000,
    status: 'Open',
    broker: 'Zerodha',
    userId: 1
  },
  // Completed Trades
  {
    orderId: 'ORD004',
    symbol: 'EURUSD',
    market: 'Forex',
    type: 'Sell',
    tradeType: 'Sell',
    quantity: 100000,
    amount: 100000,
    price: 1.0850,
    entryPrice: 1.0850,
    exitPrice: 1.0820,
    pnl: 300,
    pnlPercentage: 0.28,
    profitLoss: 300,
    status: 'Completed',
    broker: 'MetaTrader',
    userId: 1
  },
  {
    orderId: 'ORD005',
    symbol: 'AAPL',
    market: 'Indian',
    type: 'Buy',
    tradeType: 'Buy',
    quantity: 50,
    amount: 9000,
    price: 180,
    entryPrice: 180,
    exitPrice: 190,
    pnl: 500,
    pnlPercentage: 5.56,
    profitLoss: 500,
    status: 'Completed',
    broker: 'Upstox',
    userId: 1
  },
  // Pending Orders
  {
    orderId: 'ORD006',
    symbol: 'ADAUSDT',
    market: 'Crypto',
    type: 'Buy',
    tradeType: 'Buy',
    quantity: 1000,
    amount: 500,
    price: 0.50,
    pnl: 0,
    pnlPercentage: 0,
    profitLoss: 0,
    status: 'Pending',
    broker: 'Binance',
    userId: 1
  },
  {
    orderId: 'ORD007',
    symbol: 'TCS',
    market: 'Indian',
    type: 'Sell',
    tradeType: 'Sell',
    quantity: 25,
    amount: 87500,
    price: 3500,
    pnl: 0,
    pnlPercentage: 0,
    profitLoss: 0,
    status: 'Pending',
    broker: 'Zerodha',
    userId: 1
  },
  {
    orderId: 'ORD008',
    symbol: 'GBPJPY',
    market: 'Forex',
    type: 'Buy',
    tradeType: 'Buy',
    quantity: 50000,
    amount: 50000,
    price: 188.50,
    pnl: 0,
    pnlPercentage: 0,
    profitLoss: 0,
    status: 'Pending',
    broker: 'MetaTrader',
    userId: 1
  },
  // Additional variety
  {
    orderId: 'ORD009',
    symbol: 'NIFTY',
    market: 'Indian',
    type: 'Buy',
    tradeType: 'Buy',
    quantity: 75,
    amount: 1425000,
    price: 19000,
    entryPrice: 19000,
    currentPrice: 19200,
    pnl: 15000,
    pnlPercentage: 1.05,
    profitLoss: 15000,
    status: 'Open',
    broker: 'Angel One',
    userId: 1
  },
  {
    orderId: 'ORD010',
    symbol: 'DOGEUSDT',
    market: 'Crypto',
    type: 'Sell',
    tradeType: 'Sell',
    quantity: 10000,
    amount: 800,
    price: 0.08,
    entryPrice: 0.08,
    exitPrice: 0.075,
    pnl: 50,
    pnlPercentage: 6.25,
    profitLoss: 50,
    status: 'Completed',
    broker: 'Coinbase',
    userId: 1
  }
];

async function seedTrades() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    await Trade.sync();
    console.log('✅ Trade table synced successfully.');

    const existingTrades = await Trade.count();
    if (existingTrades > 0) {
      console.log(`ℹ️  ${existingTrades} trades already exist. Clearing and re-seeding...`);
      await Trade.destroy({ where: {} });
    }

    await Trade.bulkCreate(sampleTrades);
    console.log('✅ Sample trades seeded successfully!');

    const totalTrades = await Trade.count();
    const openTrades = await Trade.count({ where: { status: 'Open' } });
    const completedTrades = await Trade.count({ where: { status: 'Completed' } });
    const pendingTrades = await Trade.count({ where: { status: 'Pending' } });

    console.log('\n📊 Trade Summary:');
    console.log(`Total Trades: ${totalTrades}`);
    console.log(`Open Positions: ${openTrades}`);
    console.log(`Completed Orders: ${completedTrades}`);
    console.log(`Pending Orders: ${pendingTrades}`);

  } catch (error) {
    console.error('❌ Error seeding trades:', error);
  } finally {
    await sequelize.close();
    console.log('\n✅ Database connection closed.');
  }
}

seedTrades();
