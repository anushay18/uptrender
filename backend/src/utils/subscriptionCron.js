import cron from 'node-cron';
import { StrategySubscription } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Subscription Expiry Cron Job
 * Runs daily to check and deactivate expired subscriptions
 */

/**
 * Deactivate expired subscriptions
 */
export const deactivateExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    
    console.log('[Subscription Cron] Checking for expired subscriptions...');
    
    // Find all active subscriptions that have expired
    const expiredSubscriptions = await StrategySubscription.findAll({
      where: {
        isActive: true,
        expiryDate: {
          [Op.lte]: now // expiry date is less than or equal to now
        }
      }
    });

    if (expiredSubscriptions.length === 0) {
      console.log('[Subscription Cron] No expired subscriptions found.');
      return { success: true, count: 0 };
    }

    console.log(`[Subscription Cron] Found ${expiredSubscriptions.length} expired subscriptions. Deactivating...`);

    // Deactivate all expired subscriptions
    const updateResult = await StrategySubscription.update(
      { isActive: false },
      {
        where: {
          isActive: true,
          expiryDate: {
            [Op.lte]: now
          }
        }
      }
    );

    const deactivatedCount = updateResult[0];
    
    console.log(`[Subscription Cron] Successfully deactivated ${deactivatedCount} expired subscriptions.`);
    
    // Log details of deactivated subscriptions
    expiredSubscriptions.forEach(sub => {
      console.log(
        `[Subscription Cron] Deactivated - User: ${sub.userId}, Strategy: ${sub.strategyId}, Expired: ${sub.expiryDate}`
      );
    });

    return { 
      success: true, 
      count: deactivatedCount,
      deactivated: expiredSubscriptions.map(s => ({
        userId: s.userId,
        strategyId: s.strategyId,
        expiryDate: s.expiryDate
      }))
    };
  } catch (error) {
    console.error('[Subscription Cron] Error deactivating expired subscriptions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send expiry warning notifications (7 days before expiry)
 * This can be extended to send emails or in-app notifications
 */
export const sendExpiryWarnings = async () => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);
    
    console.log('[Subscription Cron] Checking for subscriptions expiring soon...');
    
    // Find active subscriptions expiring in the next 7 days
    const expiringSoon = await StrategySubscription.findAll({
      where: {
        isActive: true,
        expiryDate: {
          [Op.gte]: now,
          [Op.lte]: sevenDaysFromNow
        }
      },
      include: [
        { association: 'user', attributes: ['id', 'name', 'email'] },
        { association: 'strategy', attributes: ['id', 'name'] }
      ]
    });

    if (expiringSoon.length === 0) {
      console.log('[Subscription Cron] No subscriptions expiring soon.');
      return { success: true, count: 0 };
    }

    console.log(`[Subscription Cron] Found ${expiringSoon.length} subscriptions expiring soon.`);
    
    // Here you can implement email notifications or in-app notifications
    expiringSoon.forEach(sub => {
      const daysRemaining = Math.ceil((sub.expiryDate - now) / (1000 * 60 * 60 * 24));
      console.log(
        `[Subscription Cron] Warning - User: ${sub.user?.name} (${sub.user?.email}), ` +
        `Strategy: ${sub.strategy?.name}, Expires in ${daysRemaining} days`
      );
      
      // TODO: Send email notification
      // await emailService.sendExpiryWarning(sub.user.email, sub.strategy.name, daysRemaining);
      
      // TODO: Create in-app notification
      // await notificationService.create({ userId: sub.userId, type: 'subscription_expiring', ... });
    });

    return { 
      success: true, 
      count: expiringSoon.length,
      warnings: expiringSoon.map(s => ({
        userId: s.userId,
        strategyId: s.strategyId,
        expiryDate: s.expiryDate,
        daysRemaining: Math.ceil((s.expiryDate - now) / (1000 * 60 * 60 * 24))
      }))
    };
  } catch (error) {
    console.error('[Subscription Cron] Error sending expiry warnings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Initialize cron jobs
 */
export const initializeSubscriptionCronJobs = () => {
  console.log('[Subscription Cron] Initializing cron jobs...');
  
  // Run daily at 2:00 AM to deactivate expired subscriptions
  cron.schedule('0 2 * * *', async () => {
    console.log('[Subscription Cron] Running daily expiry check at 2:00 AM...');
    await deactivateExpiredSubscriptions();
  });

  // Run daily at 9:00 AM to send expiry warnings
  cron.schedule('0 9 * * *', async () => {
    console.log('[Subscription Cron] Running daily expiry warning check at 9:00 AM...');
    await sendExpiryWarnings();
  });

  console.log('[Subscription Cron] Cron jobs initialized successfully.');
  console.log('[Subscription Cron] - Expiry check: Daily at 2:00 AM');
  console.log('[Subscription Cron] - Expiry warnings: Daily at 9:00 AM');
  
  // Run immediately on startup to catch any missed expirations
  console.log('[Subscription Cron] Running initial expiry check...');
  deactivateExpiredSubscriptions();
};

export default {
  deactivateExpiredSubscriptions,
  sendExpiryWarnings,
  initializeSubscriptionCronJobs
};
