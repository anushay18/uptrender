import dotenv from 'dotenv';
dotenv.config();

import UserFavorite from './src/models/UserFavorite.js';
import { sequelize } from './src/config/database.js';

async function syncDatabase() {
  try {
    console.log('Syncing UserFavorite table...');
    await UserFavorite.sync({ alter: true });
    console.log('✅ UserFavorite table synced successfully');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing table:', error);
    process.exit(1);
  }
}

syncDatabase();
