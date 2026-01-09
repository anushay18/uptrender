import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST, before any other imports
dotenv.config({ path: join(__dirname, '.env') });

import { createServer } from 'http';
import app from './src/app.js';
import { sequelize } from './src/models/index.js';
import { initializeSocketIO } from './src/config/socket.js';
import redisClient from './src/utils/redisClient.js';
import mt5BrokerPool from './src/utils/mt5BrokerPool.js';
import { initializeSubscriptionCronJobs } from './src/utils/subscriptionCron.js';
import { priceUpdater } from './src/services/PaperPositionPriceUpdater.js';
import process from 'process';

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO with authentication and rooms
const io = initializeSocketIO(server);

// Make io accessible in routes/controllers
app.set('io', io);

// Setup Redis subscribers after Socket.IO is initialized
import { setupRedisForSocketIO } from './src/config/socket.js';

// Database connection and server start
sequelize.authenticate()
  .then(async () => {
    console.log('✅ Database connected successfully');
    
    // Initialize Redis
    const redisConnected = await redisClient.connect();
    if (redisConnected) {
      console.log('✅ Redis connected and ready');
      
      // Setup Redis subscribers for Socket.IO after Redis is connected
      await setupRedisForSocketIO();
    } else {
      console.warn('⚠️ Redis connection failed - continuing without Redis');
    }
    
    // Start MT5 broker pool cleanup timer
    console.log('✅ MT5 Broker Pool initialized');
    
    // Initialize subscription cron jobs
    initializeSubscriptionCronJobs();
    console.log('✅ Subscription expiry cron jobs initialized');
    
    // Start paper position price updater
    priceUpdater.start();
    console.log('✅ Paper position price updater started');
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔌 Socket.IO: Enabled`);
      console.log(`📡 Redis: ${redisConnected ? 'Connected' : 'Disabled'}`);
      console.log(`⚡ MT5 Connection Pool: Active`);
    });
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  
  // Stop paper position price updater
  priceUpdater.stop();
  
  // Disconnect Redis
  await redisClient.disconnect();
  
  // Cleanup MT5 connections
  await mt5BrokerPool.cleanupIdleConnections(true); // Force cleanup all
  
  // Close database
  await sequelize.close();
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});