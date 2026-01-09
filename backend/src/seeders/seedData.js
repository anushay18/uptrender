import process from 'process';
import { 
  User, 
  Broker, 
  PlansCatalog, 
  Wallet,
  WalletTransaction,
  Settings,
  Strategy,
  Trade,
  Notification,
  SupportTicket,
  Plan,
  sequelize 
} from '../models/index.js';

const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // ============ 1. SEED ADMIN USER ============
      console.log('👤 Creating admin user...');
      // Note: Password will be hashed by User model beforeCreate hook
      
      const [admin] = await User.findOrCreate({
        where: { email: 'admin@algotrading.com' },
        defaults: {
          name: 'System Administrator',
          username: 'admin',
          email: 'admin@algotrading.com',
          phone: '+1234567890',
          password: 'Admin@123', // Plain password - will be hashed by model hook
          role: 'admin',
          status: 'Active',
          currency: 'IND',
          emailVerified: 'Yes',
          phoneVerified: 'Yes',
          clientType: 'Individual',
          kycStatus: 'Verified',
          verified: 'Yes',
          settings: {
            theme: 'dark',
            language: 'en',
            notifications: true
          }
        },
        transaction
      });
      console.log('✅ Admin created:', admin.email);

      // Create admin wallet
      await Wallet.findOrCreate({
        where: { userId: admin.id },
        defaults: {
          userId: admin.id,
          balance: 100000.00,
          currency: 'INR',
          status: 'Active'
        },
        transaction
      });
      console.log('✅ Admin wallet created with ₹1,00,000\n');

      // Create admin settings
      await Settings.findOrCreate({
        where: { userId: admin.id },
        defaults: {
          userId: admin.id,
          notifications: {
            email: true,
            push: true,
            sms: false,
            tradeAlerts: true,
            strategyAlerts: true,
            systemAlerts: true
          },
          security: {
            twoFactorAuth: false,
            sessionTimeout: 3600,
            ipWhitelist: []
          },
          preferences: {
            theme: 'dark',
            language: 'en',
            timezone: 'UTC',
            currency: 'INR',
            dateFormat: 'DD/MM/YYYY'
          }
        },
        transaction
      });
      console.log('✅ Admin settings created\n');

      // ============ 2. SEED BROKERS ============
      console.log('🏢 Creating brokers...');
      const brokers = [
        {
          name: 'Zerodha',
          segment: 'Indian',
          apiBaseUrl: 'https://api.kite.trade',
          status: 'Active',
          logoUrl: 'https://zerodha.com/static/images/logo.svg',
          metadata: {
            description: 'India\'s largest retail broker',
            supportedMarkets: ['NSE', 'BSE', 'MCX', 'NFO'],
            features: ['Equity', 'F&O', 'Commodity', 'Currency']
          }
        },
        {
          name: 'Upstox',
          segment: 'Indian',
          apiBaseUrl: 'https://api.upstox.com',
          status: 'Active',
          logoUrl: 'https://upstox.com/app/themes/upstox/dist/img/logo/logo.svg',
          metadata: {
            description: 'Modern trading and investment platform',
            supportedMarkets: ['NSE', 'BSE', 'MCX'],
            features: ['Equity', 'F&O', 'Commodity', 'Currency']
          }
        },
        {
          name: 'Angel One',
          segment: 'Indian',
          apiBaseUrl: 'https://smartapi.angelbroking.com',
          status: 'Active',
          logoUrl: 'https://www.angelone.in/images/logo.svg',
          metadata: {
            description: 'Full-service broker with SmartAPI',
            supportedMarkets: ['NSE', 'BSE', 'MCX', 'NFO'],
            features: ['Equity', 'F&O', 'Commodity', 'Currency', 'Mutual Funds']
          }
        },
        {
          name: 'Binance',
          segment: 'Crypto',
          apiBaseUrl: 'https://api.binance.com',
          status: 'Active',
          logoUrl: 'https://bin.bnbstatic.com/static/images/common/logo.png',
          metadata: {
            description: 'World\'s largest crypto exchange',
            supportedMarkets: ['Spot', 'Futures', 'Margin'],
            features: ['500+ Cryptocurrencies', 'Spot Trading', 'Futures', 'Staking']
          }
        },
        {
          name: 'Coinbase',
          segment: 'Crypto',
          apiBaseUrl: 'https://api.coinbase.com',
          status: 'Active',
          logoUrl: 'https://www.coinbase.com/img/logo.svg',
          metadata: {
            description: 'Trusted cryptocurrency platform',
            supportedMarkets: ['Spot', 'Pro'],
            features: ['Cryptocurrency Trading', 'Wallet', 'Earn', 'NFT']
          }
        },
        {
          name: 'WazirX',
          segment: 'Crypto',
          apiBaseUrl: 'https://api.wazirx.com',
          status: 'Active',
          logoUrl: 'https://wazirx.com/static/media/logo.svg',
          metadata: {
            description: 'India\'s most trusted crypto exchange',
            supportedMarkets: ['Spot', 'P2P'],
            features: ['100+ Cryptocurrencies', 'INR Deposits', 'P2P Trading']
          }
        },
        {
          name: 'OANDA',
          segment: 'Forex',
          apiBaseUrl: 'https://api-fxtrade.oanda.com',
          status: 'Active',
          logoUrl: 'https://www.oanda.com/rw-en/img/logo.svg',
          metadata: {
            description: 'Leading forex and CFD broker',
            supportedMarkets: ['Forex', 'Indices', 'Commodities'],
            features: ['70+ Currency Pairs', 'MT4/MT5', 'CFDs']
          }
        },
        {
          name: 'FXCM',
          segment: 'Forex',
          apiBaseUrl: 'https://api.fxcm.com',
          status: 'Active',
          logoUrl: 'https://www.fxcm.com/img/logo.svg',
          metadata: {
            description: 'Global forex and CFD broker',
            supportedMarkets: ['Forex', 'Indices', 'Commodities', 'Crypto'],
            features: ['Forex Trading', 'Advanced Charting', 'Copy Trading']
          }
        }
      ];

      for (const broker of brokers) {
        await Broker.findOrCreate({
          where: { name: broker.name },
          defaults: broker,
          transaction
        });
        console.log(`✅ Broker created: ${broker.name} (${broker.segment})`);
      }
      console.log('');

      // ============ 3. SEED PLAN CATALOG ============
      console.log('💎 Creating plan catalog...');
      const plans = [
        {
          code: 'FREE',
          name: 'Free Plan',
          type: 'Free',
          price: 0.00,
          billingCycle: 'Monthly',
          features: [
            '1 API Integration',
            '5 Strategies',
            '100 Trades per month',
            'Basic Support',
            'Email Notifications'
          ],
          limits: {
            apiKeys: 1,
            strategies: 5,
            trades: 100,
            support: 'basic'
          },
          isActive: true
        },
        {
          code: 'BASIC_MONTHLY',
          name: 'Basic Plan (Monthly)',
          type: 'Basic',
          price: 499.00,
          billingCycle: 'Monthly',
          features: [
            '3 API Integrations',
            '20 Strategies',
            'Unlimited Trades',
            'Priority Support',
            'All Notifications',
            'Basic Analytics'
          ],
          limits: {
            apiKeys: 3,
            strategies: 20,
            trades: -1,
            support: 'priority'
          },
          isActive: true
        },
        {
          code: 'BASIC_YEARLY',
          name: 'Basic Plan (Yearly)',
          type: 'Basic',
          price: 4999.00,
          billingCycle: 'Yearly',
          features: [
            '3 API Integrations',
            '20 Strategies',
            'Unlimited Trades',
            'Priority Support',
            'All Notifications',
            'Basic Analytics',
            '2 months free'
          ],
          limits: {
            apiKeys: 3,
            strategies: 20,
            trades: -1,
            support: 'priority'
          },
          isActive: true
        },
        {
          code: 'PRO_MONTHLY',
          name: 'Pro Plan (Monthly)',
          type: 'Pro',
          price: 1999.00,
          billingCycle: 'Monthly',
          features: [
            '10 API Integrations',
            'Unlimited Strategies',
            'Unlimited Trades',
            'Premium Support (24/7)',
            'Advanced Analytics',
            'Custom Indicators',
            'Backtesting',
            'Real-time Alerts'
          ],
          limits: {
            apiKeys: 10,
            strategies: -1,
            trades: -1,
            support: 'premium'
          },
          isActive: true
        },
        {
          code: 'PRO_YEARLY',
          name: 'Pro Plan (Yearly)',
          type: 'Pro',
          price: 19999.00,
          billingCycle: 'Yearly',
          features: [
            '10 API Integrations',
            'Unlimited Strategies',
            'Unlimited Trades',
            'Premium Support (24/7)',
            'Advanced Analytics',
            'Custom Indicators',
            'Backtesting',
            'Real-time Alerts',
            '2 months free'
          ],
          limits: {
            apiKeys: 10,
            strategies: -1,
            trades: -1,
            support: 'premium'
          },
          isActive: true
        },
        {
          code: 'ENTERPRISE',
          name: 'Enterprise Plan',
          type: 'Enterprise',
          price: 49999.00,
          billingCycle: 'Yearly',
          features: [
            'Unlimited API Integrations',
            'Unlimited Strategies',
            'Unlimited Trades',
            'Dedicated Account Manager',
            'White-label Solution',
            'Custom Development',
            'On-premise Deployment',
            'SLA Guarantee',
            'Training & Onboarding'
          ],
          limits: {
            apiKeys: -1,
            strategies: -1,
            trades: -1,
            support: 'dedicated'
          },
          isActive: true
        }
      ];

      for (const plan of plans) {
        await PlansCatalog.findOrCreate({
          where: { code: plan.code },
          defaults: plan,
          transaction
        });
        console.log(`✅ Plan created: ${plan.name} - ₹${plan.price}/${plan.billingCycle}`);
      }
      console.log('');

      // ============ 4. SEED TEST USERS ============
      console.log('👥 Creating test users...');
      
      // User 1: Pro Trader
      const [user1] = await User.findOrCreate({
        where: { email: 'john.trader@example.com' },
        defaults: {
          name: 'John Trader',
          username: 'johntrader',
          email: 'john.trader@example.com',
          phone: '+919876543210',
          password: 'User@123',
          role: 'user',
          status: 'Active',
          currency: 'IND',
          emailVerified: 'Yes',
          phoneVerified: 'Yes',
          clientType: 'Individual',
          kycStatus: 'Verified',
          verified: 'Yes'
        },
        transaction
      });
      console.log('✅ User created: John Trader');

      const user1Wallet = await Wallet.create({
        userId: user1.id,
        balance: 50000.00,
        currency: 'INR',
        status: 'Active'
      }, { transaction });
      console.log('✅ Wallet created for John with ₹50,000');

      await Settings.create({
        userId: user1.id,
        notifications: {
          email: true,
          push: true,
          sms: true,
          tradeAlerts: true,
          strategyAlerts: true,
          systemAlerts: true
        },
        security: {
          twoFactorAuth: true,
          sessionTimeout: 3600,
          ipWhitelist: []
        },
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          dateFormat: 'DD/MM/YYYY'
        }
      }, { transaction });

      // Assign Pro Plan to User 1
      const proPlan = await PlansCatalog.findOne({ where: { code: 'PRO_MONTHLY' }, transaction });
      await Plan.create({
        userId: user1.id,
        name: proPlan.name,
        type: 'Monthly',
        price: proPlan.price,
        totalDays: 30,
        usedDays: 5,
        remainingDays: 25,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true
      }, { transaction });

      // User 2: Basic Trader
      const [user2] = await User.findOrCreate({
        where: { email: 'sarah.investor@example.com' },
        defaults: {
          name: 'Sarah Investor',
          username: 'sarahinvestor',
          email: 'sarah.investor@example.com',
          phone: '+919123456789',
          password: 'User@123',
          role: 'user',
          status: 'Active',
          currency: 'IND',
          emailVerified: 'Yes',
          phoneVerified: 'Yes',
          clientType: 'Individual',
          kycStatus: 'Verified',
          verified: 'Yes'
        },
        transaction
      });
      console.log('✅ User created: Sarah Investor');

      const user2Wallet = await Wallet.create({
        userId: user2.id,
        balance: 25000.00,
        currency: 'INR',
        status: 'Active'
      }, { transaction });
      console.log('✅ Wallet created for Sarah with ₹25,000');

      await Settings.create({
        userId: user2.id,
        notifications: {
          email: true,
          push: false,
          sms: false,
          tradeAlerts: true,
          strategyAlerts: true,
          systemAlerts: false
        },
        security: {
          twoFactorAuth: false,
          sessionTimeout: 7200,
          ipWhitelist: []
        },
        preferences: {
          theme: 'light',
          language: 'en',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          dateFormat: 'DD/MM/YYYY'
        }
      }, { transaction });

      // Assign Basic Plan to User 2
      const basicPlan = await PlansCatalog.findOne({ where: { code: 'BASIC_MONTHLY' }, transaction });
      await Plan.create({
        userId: user2.id,
        name: basicPlan.name,
        type: 'Monthly',
        price: basicPlan.price,
        totalDays: 30,
        usedDays: 10,
        remainingDays: 20,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      }, { transaction });

      // User 3: New Trader (Free Plan)
      const [user3] = await User.findOrCreate({
        where: { email: 'mike.beginner@example.com' },
        defaults: {
          name: 'Mike Beginner',
          username: 'mikebeginner',
          email: 'mike.beginner@example.com',
          phone: '+919988776655',
          password: 'User@123',
          role: 'user',
          status: 'Active',
          currency: 'IND',
          emailVerified: 'Yes',
          phoneVerified: 'No',
          clientType: 'Individual',
          kycStatus: 'Pending',
          verified: 'No'
        },
        transaction
      });
      console.log('✅ User created: Mike Beginner');

      const user3Wallet = await Wallet.create({
        userId: user3.id,
        balance: 10000.00,
        currency: 'INR',
        status: 'Active'
      }, { transaction });
      console.log('✅ Wallet created for Mike with ₹10,000');

      await Settings.create({
        userId: user3.id,
        notifications: {
          email: true,
          push: false,
          sms: false,
          tradeAlerts: false,
          strategyAlerts: false,
          systemAlerts: true
        },
        security: {
          twoFactorAuth: false,
          sessionTimeout: 3600,
          ipWhitelist: []
        },
        preferences: {
          theme: 'light',
          language: 'en',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          dateFormat: 'DD/MM/YYYY'
        }
      }, { transaction });

      // Assign Free Plan to User 3
      const freePlan = await PlansCatalog.findOne({ where: { code: 'FREE' }, transaction });
      await Plan.create({
        userId: user3.id,
        name: freePlan.name,
        type: 'Monthly',
        price: freePlan.price,
        totalDays: 365, // Free plan for 1 year
        usedDays: 15,
        remainingDays: 350,
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Started 15 days ago
        endDate: new Date(Date.now() + 350 * 24 * 60 * 60 * 1000),
        isActive: true
      }, { transaction });
      console.log('');

      // ============ 5. SEED STRATEGIES ============
      console.log('📊 Creating strategies...');
      
      // User 1 Strategies (Pro Trader - 3 strategies)
      const user1Strategies = [
        {
          userId: user1.id,
          name: 'Scalping Master',
          isActive: true,
          type: 'Public',
          madeBy: 'User',
          createdBy: 'John Trader',
          segment: 'Indian',
          capital: 20000.00,
          symbol: 'NIFTY',
          symbolValue: 'NIFTY 50',
          description: 'High-frequency scalping strategy for NIFTY futures'
        },
        {
          userId: user1.id,
          name: 'Swing Trading Pro',
          isActive: true,
          type: 'Private',
          madeBy: 'User',
          createdBy: 'John Trader',
          segment: 'Indian',
          capital: 15000.00,
          symbol: 'BANKNIFTY',
          symbolValue: 'BANK NIFTY',
          description: 'Medium-term swing trading strategy for Bank NIFTY'
        },
        {
          userId: user1.id,
          name: 'Options Spreads',
          isActive: false,
          type: 'Private',
          madeBy: 'User',
          createdBy: 'John Trader',
          segment: 'Indian',
          capital: 10000.00,
          symbol: 'RELIANCE',
          symbolValue: 'RELIANCE',
          description: 'Conservative options spread strategy'
        }
      ];

      for (const strategy of user1Strategies) {
        await Strategy.create(strategy, { transaction });
      }
      console.log(`✅ Created 3 strategies for John Trader`);

      // User 2 Strategies (Basic Trader - 3 strategies)
      const user2Strategies = [
        {
          userId: user2.id,
          name: 'Crypto Momentum',
          isActive: true,
          type: 'Public',
          madeBy: 'User',
          createdBy: 'Sarah Investor',
          segment: 'Crypto',
          capital: 12000.00,
          symbol: 'BTCUSDT',
          symbolValue: 'BTC/USDT',
          description: 'Bitcoin momentum trading strategy'
        },
        {
          userId: user2.id,
          name: 'ETH Long Term',
          isActive: true,
          type: 'Private',
          madeBy: 'User',
          createdBy: 'Sarah Investor',
          segment: 'Crypto',
          capital: 8000.00,
          symbol: 'ETHUSDT',
          symbolValue: 'ETH/USDT',
          description: 'Long-term Ethereum investment strategy'
        },
        {
          userId: user2.id,
          name: 'Safe Diversified',
          isActive: true,
          type: 'Private',
          madeBy: 'User',
          createdBy: 'Sarah Investor',
          segment: 'Indian',
          capital: 5000.00,
          symbol: 'SENSEX',
          symbolValue: 'SENSEX',
          description: 'Diversified portfolio strategy'
        }
      ];

      for (const strategy of user2Strategies) {
        await Strategy.create(strategy, { transaction });
      }
      console.log(`✅ Created 3 strategies for Sarah Investor`);

      // User 3 Strategies (New Trader - 3 strategies)
      const user3Strategies = [
        {
          userId: user3.id,
          name: 'Learning Strategy 1',
          isActive: true,
          type: 'Private',
          madeBy: 'User',
          createdBy: 'Mike Beginner',
          segment: 'Indian',
          capital: 5000.00,
          symbol: 'INFY',
          symbolValue: 'INFOSYS',
          description: 'First experimental strategy'
        },
        {
          userId: user3.id,
          name: 'Test Forex Strategy',
          isActive: false,
          type: 'Private',
          madeBy: 'User',
          createdBy: 'Mike Beginner',
          segment: 'Forex',
          capital: 3000.00,
          symbol: 'EURUSD',
          symbolValue: 'EUR/USD',
          description: 'Testing forex trading waters'
        },
        {
          userId: user3.id,
          name: 'Demo Crypto',
          isActive: true,
          type: 'Private',
          madeBy: 'User',
          createdBy: 'Mike Beginner',
          segment: 'Crypto',
          capital: 2000.00,
          symbol: 'BTCUSDT',
          symbolValue: 'BTC/USDT',
          description: 'Demo cryptocurrency strategy'
        }
      ];

      for (const strategy of user3Strategies) {
        await Strategy.create(strategy, { transaction });
      }
      console.log(`✅ Created 3 strategies for Mike Beginner`);
      console.log('');

      // ============ 6. SEED TRADES ============
      console.log('💹 Creating trades...');
      
      const getRandomOrderId = () => `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const getRandomDate = (daysAgo) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const getDateOnly = (daysAgo) => {
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
      };
      const getBroker = (market) => {
        if (market === 'Indian') return 'Zerodha';
        if (market === 'Crypto') return 'Binance';
        if (market === 'Forex') return 'OANDA';
        return 'Zerodha';
      };

      // User 1 Trades (15 trades - Active trader)
      const user1Trades = [
        // Completed trades with profit
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'NIFTY', type: 'Buy', amount: 50, price: 21500.00, currentPrice: 21680.00, pnl: 900.00, status: 'Completed', date: getDateOnly(5), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(5) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'BANKNIFTY', type: 'Sell', amount: 25, price: 48200.00, currentPrice: 47950.00, pnl: 625.00, status: 'Completed', date: getDateOnly(4), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(4) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'RELIANCE', type: 'Buy', amount: 100, price: 2850.00, currentPrice: 2895.00, pnl: 450.00, status: 'Completed', date: getDateOnly(3), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(3) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'TCS', type: 'Buy', amount: 50, price: 3650.00, currentPrice: 3720.00, pnl: 350.00, status: 'Completed', date: getDateOnly(2), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(2) },
        // Completed trades with loss
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'HDFC', type: 'Buy', amount: 80, price: 1680.00, currentPrice: 1655.00, pnl: -200.00, status: 'Completed', date: getDateOnly(6), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(6) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'ICICI', type: 'Sell', amount: 120, price: 1050.00, currentPrice: 1065.00, pnl: -180.00, status: 'Completed', date: getDateOnly(7), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(7) },
        // Pending trades (was 'Open')
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'NIFTY', type: 'Buy', amount: 75, price: 21600.00, currentPrice: 21650.00, pnl: 375.00, status: 'Pending', date: getDateOnly(0.5), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(0.5) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'BANKNIFTY', type: 'Sell', amount: 40, price: 48100.00, currentPrice: 48050.00, pnl: 200.00, status: 'Pending', date: getDateOnly(0.3), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(0.3) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'INFY', type: 'Buy', amount: 150, price: 1485.00, currentPrice: 1475.00, pnl: -150.00, status: 'Pending', date: getDateOnly(1), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(1) },
        // Pending trades
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'WIPRO', type: 'Buy', amount: 200, price: 485.00, currentPrice: null, pnl: null, status: 'Pending', date: getDateOnly(0.1), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(0.1) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'TATAMOTORS', type: 'Sell', amount: 100, price: 920.00, currentPrice: null, pnl: null, status: 'Pending', date: getDateOnly(0.2), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(0.2) },
        // Failed trades (was 'Cancelled')
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'SBIN', type: 'Buy', amount: 300, price: 625.00, currentPrice: null, pnl: null, status: 'Failed', date: getDateOnly(1.5), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(1.5) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'AXISBANK', type: 'Sell', amount: 150, price: 1085.00, currentPrice: null, pnl: null, status: 'Failed', date: getDateOnly(2.5), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(2.5) },
        // More completed
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'MARUTI', type: 'Buy', amount: 20, price: 11250.00, currentPrice: 11420.00, pnl: 340.00, status: 'Completed', date: getDateOnly(8), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(8) },
        { userId: user1.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'LT', type: 'Buy', amount: 60, price: 3480.00, currentPrice: 3515.00, pnl: 210.00, status: 'Completed', date: getDateOnly(9), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(9) }
      ];

      for (const trade of user1Trades) {
        await Trade.create(trade, { transaction });
      }
      console.log(`✅ Created ${user1Trades.length} trades for John Trader`);

      // User 2 Trades (15 trades - Moderate trader)
      const user2Trades = [
        // Crypto trades - Completed
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'BTCUSDT', type: 'Buy', amount: 0.5, price: 43500.00, currentPrice: 44200.00, pnl: 350.00, status: 'Completed', date: getDateOnly(10), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(10) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'ETHUSDT', type: 'Buy', amount: 3, price: 2280.00, currentPrice: 2350.00, pnl: 210.00, status: 'Completed', date: getDateOnly(8), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(8) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'BNBUSDT', type: 'Sell', amount: 10, price: 335.00, currentPrice: 328.00, pnl: 70.00, status: 'Completed', date: getDateOnly(7), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(7) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'SOLUSDT', type: 'Buy', amount: 20, price: 108.50, currentPrice: 105.20, pnl: -66.00, status: 'Completed', date: getDateOnly(6), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(6) },
        // Indian market trades
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'SENSEX', type: 'Buy', amount: 100, price: 72500.00, currentPrice: 73100.00, pnl: 600.00, status: 'Completed', date: getDateOnly(5), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(5) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'INFY', type: 'Buy', amount: 80, price: 1475.00, currentPrice: 1490.00, pnl: 120.00, status: 'Completed', date: getDateOnly(4), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(4) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'TCS', type: 'Sell', amount: 40, price: 3700.00, currentPrice: 3680.00, pnl: 80.00, status: 'Completed', date: getDateOnly(3), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(3) },
        // Pending trades (was 'Open')
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'BTCUSDT', type: 'Buy', amount: 0.3, price: 44000.00, currentPrice: 44100.00, pnl: 30.00, status: 'Pending', date: getDateOnly(0.8), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(0.8) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'ETHUSDT', type: 'Sell', amount: 2, price: 2340.00, currentPrice: 2320.00, pnl: 40.00, status: 'Pending', date: getDateOnly(0.5), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(0.5) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'RELIANCE', type: 'Buy', amount: 50, price: 2870.00, currentPrice: 2850.00, pnl: -100.00, status: 'Pending', date: getDateOnly(1.2), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(1.2) },
        // Pending
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'ADAUSDT', type: 'Buy', amount: 500, price: 0.62, currentPrice: null, pnl: null, status: 'Pending', date: getDateOnly(0.3), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(0.3) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'HDFC', type: 'Buy', amount: 70, price: 1670.00, currentPrice: null, pnl: null, status: 'Pending', date: getDateOnly(0.4), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(0.4) },
        // Failed (was 'Cancelled')
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'DOTUSDT', type: 'Sell', amount: 100, price: 7.25, currentPrice: null, pnl: null, status: 'Failed', date: getDateOnly(2), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(2) },
        // More completed
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'WIPRO', type: 'Buy', amount: 120, price: 482.00, currentPrice: 488.00, pnl: 72.00, status: 'Completed', date: getDateOnly(11), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(11) },
        { userId: user2.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'XRPUSDT', type: 'Buy', amount: 300, price: 0.58, currentPrice: 0.60, pnl: 60.00, status: 'Completed', date: getDateOnly(12), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(12) }
      ];

      for (const trade of user2Trades) {
        await Trade.create(trade, { transaction });
      }
      console.log(`✅ Created ${user2Trades.length} trades for Sarah Investor`);

      // User 3 Trades (15 trades - New trader)
      const user3Trades = [
        // Mix of small trades for beginner
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'INFY', type: 'Buy', amount: 25, price: 1480.00, currentPrice: 1485.00, pnl: 12.50, status: 'Completed', date: getDateOnly(15), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(15) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'TCS', type: 'Buy', amount: 15, price: 3680.00, currentPrice: 3695.00, pnl: 22.50, status: 'Completed', date: getDateOnly(14), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(14) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'BTCUSDT', type: 'Buy', amount: 0.1, price: 43800.00, currentPrice: 43500.00, pnl: -30.00, status: 'Completed', date: getDateOnly(13), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(13) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'WIPRO', type: 'Buy', amount: 50, price: 485.00, currentPrice: 482.00, pnl: -15.00, status: 'Completed', date: getDateOnly(12), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(12) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Forex', symbol: 'EURUSD', type: 'Buy', amount: 1000, price: 1.0850, currentPrice: 1.0875, pnl: 25.00, status: 'Completed', date: getDateOnly(11), broker: getBroker('Forex'), brokerType: 'Forex', createdAt: getRandomDate(11) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'SBIN', type: 'Buy', amount: 100, price: 628.00, currentPrice: 625.00, pnl: -30.00, status: 'Completed', date: getDateOnly(10), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(10) },
        // Pending trades (was 'Open' - learning phase)
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'INFY', type: 'Buy', amount: 30, price: 1482.00, currentPrice: 1485.00, pnl: 9.00, status: 'Pending', date: getDateOnly(2), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(2) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'ETHUSDT', type: 'Buy', amount: 0.5, price: 2330.00, currentPrice: 2340.00, pnl: 5.00, status: 'Pending', date: getDateOnly(1.5), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(1.5) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'RELIANCE', type: 'Buy', amount: 20, price: 2865.00, currentPrice: 2860.00, pnl: -10.00, status: 'Pending', date: getDateOnly(1), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(1) },
        // Pending
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'HDFC', type: 'Buy', amount: 30, price: 1675.00, currentPrice: null, pnl: null, status: 'Pending', date: getDateOnly(0.5), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(0.5) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'BTCUSDT', type: 'Buy', amount: 0.05, price: 44000.00, currentPrice: null, pnl: null, status: 'Pending', date: getDateOnly(0.3), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(0.3) },
        // Failed (was 'Cancelled' - hesitation)
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Forex', symbol: 'GBPUSD', type: 'Sell', amount: 500, price: 1.2650, currentPrice: null, pnl: null, status: 'Failed', date: getDateOnly(3), broker: getBroker('Forex'), brokerType: 'Forex', createdAt: getRandomDate(3) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'TATAMOTORS', type: 'Buy', amount: 80, price: 925.00, currentPrice: null, pnl: null, status: 'Failed', date: getDateOnly(4), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(4) },
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Crypto', symbol: 'BNBUSDT', type: 'Buy', amount: 2, price: 332.00, currentPrice: null, pnl: null, status: 'Failed', date: getDateOnly(5), broker: getBroker('Crypto'), brokerType: 'Crypto', createdAt: getRandomDate(5) },
        // One more completed
        { userId: user3.id, orderId: getRandomOrderId(), market: 'Indian', symbol: 'ICICI', type: 'Buy', amount: 45, price: 1058.00, currentPrice: 1065.00, pnl: 31.50, status: 'Completed', date: getDateOnly(9), broker: getBroker('Indian'), brokerType: 'Indian', createdAt: getRandomDate(9) }
      ];

      for (const trade of user3Trades) {
        await Trade.create(trade, { transaction });
      }
      console.log(`✅ Created ${user3Trades.length} trades for Mike Beginner`);
      console.log('');

      // ============ 7. SEED WALLET TRANSACTIONS ============
      console.log('💰 Creating wallet transactions...');
      
      // User 1 wallet transactions
      const user1Transactions = [
        { walletId: user1Wallet.id, type: 'credit', amount: 50000.00, description: 'Initial deposit', reference: 'INIT001', balanceAfter: 50000.00, createdAt: getRandomDate(20) },
        { walletId: user1Wallet.id, type: 'debit', amount: 900.00, description: 'Trade profit withdrawn', reference: 'TXN001', balanceAfter: 49100.00, createdAt: getRandomDate(5) },
        { walletId: user1Wallet.id, type: 'credit', amount: 625.00, description: 'Trade profit added', reference: 'TXN002', balanceAfter: 49725.00, createdAt: getRandomDate(4) },
        { walletId: user1Wallet.id, type: 'credit', amount: 450.00, description: 'Trade profit added', reference: 'TXN003', balanceAfter: 50175.00, createdAt: getRandomDate(3) },
        { walletId: user1Wallet.id, type: 'debit', amount: 200.00, description: 'Trade loss deducted', reference: 'TXN004', balanceAfter: 49975.00, createdAt: getRandomDate(6) },
        { walletId: user1Wallet.id, type: 'debit', amount: 1999.00, description: 'Pro plan subscription', reference: 'PLAN001', balanceAfter: 47976.00, createdAt: getRandomDate(1) }
      ];

      for (const txn of user1Transactions) {
        await WalletTransaction.create(txn, { transaction });
      }

      // User 2 wallet transactions
      const user2Transactions = [
        { walletId: user2Wallet.id, type: 'credit', amount: 25000.00, description: 'Initial deposit', reference: 'INIT002', balanceAfter: 25000.00, createdAt: getRandomDate(25) },
        { walletId: user2Wallet.id, type: 'credit', amount: 350.00, description: 'BTC trade profit', reference: 'TXN005', balanceAfter: 25350.00, createdAt: getRandomDate(10) },
        { walletId: user2Wallet.id, type: 'credit', amount: 210.00, description: 'ETH trade profit', reference: 'TXN006', balanceAfter: 25560.00, createdAt: getRandomDate(8) },
        { walletId: user2Wallet.id, type: 'debit', amount: 66.00, description: 'SOL trade loss', reference: 'TXN007', balanceAfter: 25494.00, createdAt: getRandomDate(6) },
        { walletId: user2Wallet.id, type: 'debit', amount: 499.00, description: 'Basic plan subscription', reference: 'PLAN002', balanceAfter: 24995.00, createdAt: getRandomDate(2) }
      ];

      for (const txn of user2Transactions) {
        await WalletTransaction.create(txn, { transaction });
      }

      // User 3 wallet transactions
      const user3Transactions = [
        { walletId: user3Wallet.id, type: 'credit', amount: 10000.00, description: 'Initial deposit', reference: 'INIT003', balanceAfter: 10000.00, createdAt: getRandomDate(30) },
        { walletId: user3Wallet.id, type: 'credit', amount: 12.50, description: 'INFY trade profit', reference: 'TXN008', balanceAfter: 10012.50, createdAt: getRandomDate(15) },
        { walletId: user3Wallet.id, type: 'debit', amount: 30.00, description: 'BTC trade loss', reference: 'TXN009', balanceAfter: 9982.50, createdAt: getRandomDate(13) },
        { walletId: user3Wallet.id, type: 'credit', amount: 22.50, description: 'TCS trade profit', reference: 'TXN010', balanceAfter: 10005.00, createdAt: getRandomDate(14) }
      ];

      for (const txn of user3Transactions) {
        await WalletTransaction.create(txn, { transaction });
      }

      console.log(`✅ Created wallet transactions for all users`);
      console.log('');

      // ============ 8. SEED NOTIFICATIONS ============
      console.log('🔔 Creating notifications...');
      
      const notifications = [
        // User 1 notifications
        { userId: user1.id, type: 'trade', title: 'Trade Executed Successfully', message: 'Your buy order for NIFTY has been executed at ₹21,500', isRead: false, metadata: { tradeId: 1, symbol: 'NIFTY' }, createdAt: getRandomDate(0.5) },
        { userId: user1.id, type: 'strategy', title: 'Strategy Performance Alert', message: 'Your "Scalping Master" strategy has achieved 75% win rate', isRead: false, metadata: { strategyName: 'Scalping Master' }, createdAt: getRandomDate(1) },
        { userId: user1.id, type: 'system', title: 'Welcome to AlgoTrading Pro!', message: 'Thank you for subscribing to Pro plan', isRead: true, metadata: {}, createdAt: getRandomDate(20) },
        { userId: user1.id, type: 'trade', title: 'Trade Completed', message: 'Your BANKNIFTY sell order completed with profit of ₹625', isRead: true, metadata: { tradeId: 2, pnl: 625 }, createdAt: getRandomDate(4) },
        { userId: user1.id, type: 'wallet', title: 'Wallet Updated', message: 'Your wallet balance has been updated. Current balance: ₹47,976', isRead: false, metadata: { balance: 47976 }, createdAt: getRandomDate(1) },
        
        // User 2 notifications
        { userId: user2.id, type: 'trade', title: 'Crypto Trade Alert', message: 'BTC price reached your target. Trade executed at $44,200', isRead: false, metadata: { symbol: 'BTCUSDT', price: 44200 }, createdAt: getRandomDate(0.8) },
        { userId: user2.id, type: 'strategy', title: 'New Strategy Created', message: 'Your "Crypto Momentum" strategy is now active', isRead: true, metadata: { strategyName: 'Crypto Momentum' }, createdAt: getRandomDate(10) },
        { userId: user2.id, type: 'system', title: 'Plan Subscription', message: 'Basic plan activated successfully', isRead: true, metadata: {}, createdAt: getRandomDate(25) },
        { userId: user2.id, type: 'trade', title: 'Trade Update', message: 'Your ETH position is showing positive momentum (+$40)', isRead: false, metadata: { symbol: 'ETHUSDT', pnl: 40 }, createdAt: getRandomDate(0.5) },
        
        // User 3 notifications
        { userId: user3.id, type: 'system', title: 'Welcome to AlgoTrading!', message: 'Start your trading journey with our Free plan', isRead: true, metadata: {}, createdAt: getRandomDate(30) },
        { userId: user3.id, type: 'trade', title: 'First Trade Executed', message: 'Congratulations! Your first trade has been executed successfully', isRead: true, metadata: { tradeId: 1 }, createdAt: getRandomDate(15) },
        { userId: user3.id, type: 'system', title: 'KYC Verification Pending', message: 'Please complete your KYC verification to unlock all features', isRead: false, metadata: {}, createdAt: getRandomDate(5) },
        { userId: user3.id, type: 'strategy', title: 'Strategy Limit Warning', message: 'You have used 3 out of 5 strategies allowed in Free plan', isRead: false, metadata: { used: 3, limit: 5 }, createdAt: getRandomDate(2) },
        { userId: user3.id, type: 'trade', title: 'Trade Pending', message: 'Your buy order for HDFC is pending execution', isRead: false, metadata: { symbol: 'HDFC' }, createdAt: getRandomDate(0.5) }
      ];

      for (const notification of notifications) {
        await Notification.create(notification, { transaction });
      }
      console.log(`✅ Created ${notifications.length} notifications for all users`);
      console.log('');

      // ============ 9. SEED SUPPORT TICKETS ============
      console.log('🎫 Creating support tickets...');
      
      const tickets = [
        {
          ticketNumber: 'TKT001',
          userId: user1.id,
          subject: 'API Integration Issue with Zerodha',
          category: 'Technical',
          priority: 'high',
          status: 'resolved',
          assignedTo: admin.id,
          description: 'Unable to connect my Zerodha account. Getting authentication error.',
          createdAt: getRandomDate(10),
          updatedAt: getRandomDate(9)
        },
        {
          ticketNumber: 'TKT002',
          userId: user1.id,
          subject: 'Request for Custom Indicator',
          category: 'Feature Request',
          priority: 'medium',
          status: 'in-progress',
          assignedTo: admin.id,
          description: 'Would like to have RSI with custom period settings in my strategy.',
          createdAt: getRandomDate(5),
          updatedAt: getRandomDate(3)
        },
        {
          ticketNumber: 'TKT003',
          userId: user2.id,
          subject: 'Billing Query - Upgrade to Pro',
          category: 'Billing',
          priority: 'low',
          status: 'open',
          assignedTo: null,
          description: 'What are the benefits if I upgrade from Basic to Pro plan?',
          createdAt: getRandomDate(2),
          updatedAt: getRandomDate(2)
        },
        {
          ticketNumber: 'TKT004',
          userId: user2.id,
          subject: 'Crypto Trading Bot Setup',
          category: 'General',
          priority: 'medium',
          status: 'resolved',
          assignedTo: admin.id,
          description: 'Need help setting up automated crypto trading bot.',
          createdAt: getRandomDate(15),
          updatedAt: getRandomDate(12)
        },
        {
          ticketNumber: 'TKT005',
          userId: user3.id,
          subject: 'How to Verify KYC?',
          category: 'General',
          priority: 'medium',
          status: 'in-progress',
          assignedTo: admin.id,
          description: 'I want to complete my KYC verification. What documents are required?',
          createdAt: getRandomDate(5),
          updatedAt: getRandomDate(4)
        },
        {
          ticketNumber: 'TKT006',
          userId: user3.id,
          subject: 'Understanding Strategy Parameters',
          category: 'General',
          priority: 'low',
          status: 'open',
          assignedTo: null,
          description: 'Can you explain what capital, symbol and segment mean in strategy creation?',
          createdAt: getRandomDate(1),
          updatedAt: getRandomDate(1)
        },
        {
          ticketNumber: 'TKT007',
          userId: user3.id,
          subject: 'Free Plan Limitations',
          category: 'General',
          priority: 'low',
          status: 'closed',
          assignedTo: admin.id,
          description: 'What are the exact limitations of the free plan?',
          createdAt: getRandomDate(20),
          updatedAt: getRandomDate(18)
        }
      ];

      for (const ticket of tickets) {
        await SupportTicket.create(ticket, { transaction });
      }
      console.log(`✅ Created ${tickets.length} support tickets`);
      console.log('');

      // Commit transaction
      await transaction.commit();
      
      console.log('🎉 Database seeding completed successfully!\n');
      console.log('📝 Seed Summary:');
      console.log('   - 1 Admin user');
      console.log('   - 3 Test users (John, Sarah, Mike)');
      console.log(`   - ${brokers.length} Brokers`);
      console.log(`   - ${plans.length} Plan catalogs`);
      console.log('   - 9 Strategies (3 per user)');
      console.log('   - 45 Trades (15 per user)');
      console.log('   - 15 Wallet transactions');
      console.log(`   - ${notifications.length} Notifications`);
      console.log(`   - ${tickets.length} Support tickets`);
      console.log('\n🔑 Login Credentials:');
      console.log('   Admin:');
      console.log('      Email: admin@algotrading.com');
      console.log('      Password: Admin@123');
      console.log('   Test Users:');
      console.log('      Email: john.trader@example.com');
      console.log('      Email: sarah.investor@example.com');
      console.log('      Email: mike.beginner@example.com');
      console.log('      Password: User@123 (for all test users)');
      console.log('\n⚠️  Please change passwords after first login!\n');

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

// Run seeder
const runSeeder = async () => {
  try {
    await seedData();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

// Execute seeder
runSeeder();

export default seedData;
