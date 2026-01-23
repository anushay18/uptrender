import emailService from './emailService.js';
import { User, EmailSettings } from '../models/index.js';

/**
 * Email Notification Helper
 * Provides easy-to-use methods for sending email notifications throughout the app
 */
class EmailNotificationHelper {
  
  /**
   * Check if user has email notifications enabled for a specific type
   */
  async isNotificationEnabled(userId, notificationType) {
    try {
      const settings = await EmailSettings.findOne({ where: { userId } });
      if (!settings) return true; // Default to enabled if no settings
      
      switch (notificationType) {
        case 'trade':
          return settings.sendTradeNotifications !== false;
        case 'strategy':
          return settings.sendStrategyAlerts !== false;
        case 'ticket':
          return settings.sendTicketUpdates !== false;
        case 'marketplace':
          return settings.sendMarketplaceUpdates !== false;
        case 'subscription':
          return settings.sendSubscriptionAlerts !== false;
        default:
          return true;
      }
    } catch (error) {
      console.error('[EmailNotification] Error checking notification settings:', error);
      return true; // Default to enabled on error
    }
  }
  
  /**
   * Send trade opened notification
   */
  async notifyTradeOpened(userId, tradeData) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.email) {
        console.log('[EmailNotification] User not found or no email:', userId);
        return { success: false, message: 'User not found' };
      }

      // Check if trade notifications are enabled
      if (!(await this.isNotificationEnabled(userId, 'trade'))) {
        console.log('[EmailNotification] Trade notifications disabled for user:', userId);
        return { success: false, message: 'Notifications disabled' };
      }

      return await emailService.sendTradeOpenedEmail(user.email, user.name || 'Trader', tradeData);
    } catch (error) {
      console.error('[EmailNotification] Error sending trade opened email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send trade closed notification
   */
  async notifyTradeClosed(userId, tradeData) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.email) {
        console.log('[EmailNotification] User not found or no email:', userId);
        return { success: false, message: 'User not found' };
      }

      // Check if trade notifications are enabled
      if (!(await this.isNotificationEnabled(userId, 'trade'))) {
        console.log('[EmailNotification] Trade notifications disabled for user:', userId);
        return { success: false, message: 'Notifications disabled' };
      }

      return await emailService.sendTradeClosedEmail(user.email, user.name || 'Trader', tradeData);
    } catch (error) {
      console.error('[EmailNotification] Error sending trade closed email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send strategy signal notification
   */
  async notifyStrategySignal(userId, signalData) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.email) {
        console.log('[EmailNotification] User not found or no email:', userId);
        return { success: false, message: 'User not found' };
      }

      // Check if strategy notifications are enabled
      if (!(await this.isNotificationEnabled(userId, 'strategy'))) {
        console.log('[EmailNotification] Strategy notifications disabled for user:', userId);
        return { success: false, message: 'Notifications disabled' };
      }

      return await emailService.sendStrategySignalEmail(user.email, user.name || 'Trader', signalData);
    } catch (error) {
      console.error('[EmailNotification] Error sending strategy signal email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send subscription confirmation
   */
  async notifySubscription(userId, subscriptionData) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.email) {
        console.log('[EmailNotification] User not found or no email:', userId);
        return { success: false, message: 'User not found' };
      }

      // Check if subscription notifications are enabled
      if (!(await this.isNotificationEnabled(userId, 'subscription'))) {
        console.log('[EmailNotification] Subscription notifications disabled for user:', userId);
        return { success: false, message: 'Notifications disabled' };
      }

      return await emailService.sendSubscriptionEmail(user.email, user.name || 'Trader', subscriptionData);
    } catch (error) {
      console.error('[EmailNotification] Error sending subscription email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send ticket created notification
   */
  async notifyTicketCreated(userId, ticketData) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.email) {
        console.log('[EmailNotification] User not found or no email:', userId);
        return { success: false, message: 'User not found' };
      }

      // Check if ticket notifications are enabled
      if (!(await this.isNotificationEnabled(userId, 'ticket'))) {
        console.log('[EmailNotification] Ticket notifications disabled for user:', userId);
        return { success: false, message: 'Notifications disabled' };
      }

      return await emailService.sendTicketCreatedEmail(user.email, user.name || 'User', ticketData);
    } catch (error) {
      console.error('[EmailNotification] Error sending ticket created email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send ticket update notification
   */
  async notifyTicketUpdate(userId, ticketData) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.email) {
        console.log('[EmailNotification] User not found or no email:', userId);
        return { success: false, message: 'User not found' };
      }

      // Check if ticket notifications are enabled
      if (!(await this.isNotificationEnabled(userId, 'ticket'))) {
        console.log('[EmailNotification] Ticket notifications disabled for user:', userId);
        return { success: false, message: 'Notifications disabled' };
      }

      return await emailService.sendTicketUpdateEmail(user.email, user.name || 'User', ticketData);
    } catch (error) {
      console.error('[EmailNotification] Error sending ticket update email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send new marketplace strategy notification to all users who opted in
   */
  async notifyNewMarketplaceStrategy(strategyData) {
    try {
      // Get all active users
      const users = await User.findAll({
        where: { isActive: true },
        attributes: ['id', 'email', 'name']
      });

      const results = [];
      for (const user of users) {
        if (user.email) {
          // Check if marketplace notifications are enabled for this user
          if (await this.isNotificationEnabled(user.id, 'marketplace')) {
            const result = await emailService.sendNewMarketplaceStrategyEmail(
              user.email, 
              user.name || 'Trader', 
              strategyData
            );
            results.push({ userId: user.id, ...result });
          }
        }
      }

      console.log(`[EmailNotification] Sent marketplace notification to ${results.length} users`);
      return { success: true, sentCount: results.length };
    } catch (error) {
      console.error('[EmailNotification] Error sending marketplace strategy emails:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email to new user
   */
  async notifyWelcome(userId, userEmail, userName) {
    try {
      return await emailService.sendWelcomeEmail(userId, userEmail, userName);
    } catch (error) {
      console.error('[EmailNotification] Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send subscription expiry warning
   */
  async notifySubscriptionExpiry(userEmail, strategyName, daysRemaining) {
    try {
      return await emailService.sendExpiryWarning(userEmail, strategyName, daysRemaining);
    } catch (error) {
      console.error('[EmailNotification] Error sending expiry warning email:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new EmailNotificationHelper();
