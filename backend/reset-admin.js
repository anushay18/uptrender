import process from 'process';
import { User, Wallet, Settings, sequelize } from './src/models/index.js';

async function resetAdmin() {
  try {
    console.log('🔄 Resetting admin user...\n');

    // Delete existing admin and related data
    const admin = await User.findOne({ where: { email: 'admin@algotrading.com' } });
    
    if (admin) {
      console.log('🗑️  Deleting existing admin user and related data...');
      
      // Delete wallet
      await Wallet.destroy({ where: { userId: admin.id } });
      console.log('   - Wallet deleted');
      
      // Delete settings
      await Settings.destroy({ where: { userId: admin.id } });
      console.log('   - Settings deleted');
      
      // Delete user
      await User.destroy({ where: { id: admin.id } });
      console.log('   - User deleted\n');
    }

    // Create new admin user (model hook will hash the password)
    console.log('✨ Creating new admin user...');
    const newAdmin = await User.create({
      name: 'System Administrator',
      username: 'admin',
      email: 'admin@algotrading.com',
      phone: '+1234567890',
      password: 'Admin@123', // Will be hashed by beforeCreate hook
      role: 'admin',
      status: 'Active',
      currency: 'IND',
      emailVerified: 'Yes',
      phoneVerified: 'Yes',
      clientType: 'Individual',
      kycStatus: 'Verified',
      verified: 'Yes'
    });
    console.log('✅ Admin user created:', newAdmin.email);

    // Create wallet
    const wallet = await Wallet.create({
      userId: newAdmin.id,
      balance: 100000.00,
      currency: 'INR',
      status: 'Active'
    });
    console.log('✅ Admin wallet created: ₹', wallet.balance);

    // Create settings
    await Settings.create({
      userId: newAdmin.id,
      theme: 'dark',
      language: 'en',
      timezone: 'Asia/Kolkata',
      notifications: true,
      emailNotifications: true,
      smsNotifications: false,
      twoFactorAuth: false
    });
    console.log('✅ Admin settings created\n');

    console.log('🎉 Admin reset complete!\n');
    console.log('🔑 Login Credentials:');
    console.log('   Email: admin@algotrading.com');
    console.log('   Password: Admin@123');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

resetAdmin();
