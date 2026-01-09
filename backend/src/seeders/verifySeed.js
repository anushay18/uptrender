import process from 'process';
import { 
  User, 
  Broker, 
  PlansCatalog, 
  Wallet,
  Settings,
  sequelize 
} from '../models/index.js';

const verifySeededData = async () => {
  try {
    console.log('🔍 Verifying seeded data...\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check admin user
    const admin = await User.findOne({ 
      where: { email: 'admin@algotrading.com' } 
    });
    console.log('👤 Admin User:', admin ? '✅ Found' : '❌ Not found');
    if (admin) {
      console.log(`   - Name: ${admin.name}`);
      console.log(`   - Email: ${admin.email}`);
      console.log(`   - Role: ${admin.role}`);
      console.log(`   - Status: ${admin.status}\n`);
    }

    // Check admin wallet
    if (admin) {
      const wallet = await Wallet.findOne({ where: { userId: admin.id } });
      console.log('💰 Admin Wallet:', wallet ? '✅ Found' : '❌ Not found');
      if (wallet) {
        console.log(`   - Balance: ₹${wallet.balance}`);
        console.log(`   - Currency: ${wallet.currency}`);
        console.log(`   - Status: ${wallet.status}\n`);
      }
    }

    // Check brokers
    const brokers = await Broker.findAll();
    console.log(`🏢 Brokers: ${brokers.length} found`);
    if (brokers.length > 0) {
      brokers.forEach(broker => {
        console.log(`   - ${broker.name} (${broker.segment})`);
      });
      console.log('');
    }

    // Check plan catalog
    const plans = await PlansCatalog.findAll({ order: [['price', 'ASC']] });
    console.log(`💎 Plan Catalog: ${plans.length} found`);
    if (plans.length > 0) {
      plans.forEach(plan => {
        console.log(`   - ${plan.name}: ₹${plan.price}/${plan.billingCycle}`);
      });
      console.log('');
    }

    // Summary
    console.log('📊 Summary:');
    console.log(`   - Admin Users: ${admin ? 1 : 0}`);
    console.log(`   - Brokers: ${brokers.length}`);
    console.log(`   - Plans: ${plans.length}`);
    console.log(`   - Wallets: ${admin && await Wallet.count({ where: { userId: admin.id } })}`);
    console.log('\n✅ Verification complete!\n');

    if (admin && brokers.length > 0 && plans.length > 0) {
      console.log('🎉 All seed data is present and ready to use!');
      console.log('\n🔑 Login Credentials:');
      console.log('   Email: admin@algotrading.com');
      console.log('   Password: Admin@123\n');
    } else {
      console.log('⚠️  Some seed data is missing. Run: npm run seed\n');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

verifySeededData();
