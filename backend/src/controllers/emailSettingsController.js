import EmailSettings from '../models/EmailSettings.js';
import emailService from '../utils/emailService.js';
import crypto from 'crypto';

// Get email settings for user
export const getEmailSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let settings = await EmailSettings.findOne({ where: { userId } });
    
    if (!settings) {
      // Create default settings
      settings = await EmailSettings.create({
        userId,
        sendWelcomeEmail: true,
        sendPasswordResetEmail: true,
        sendTradeNotifications: false,
        sendStrategyAlerts: false,
        isActive: false,
      });
    }

    // Mask password for security
    const settingsData = settings.toJSON();
    if (settingsData.smtpPassword) {
      settingsData.smtpPassword = '***' + settingsData.smtpPassword.slice(-4);
    }

    res.json({
      success: true,
      data: settingsData,
    });
  } catch (error) {
    console.error('Get email settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email settings',
    });
  }
};

// Update email settings
export const updateEmailSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      fromEmail,
      fromName,
      sendWelcomeEmail,
      sendPasswordResetEmail,
      sendTradeNotifications,
      sendStrategyAlerts,
      isActive,
    } = req.body;

    let settings = await EmailSettings.findOne({ where: { userId } });
    
    const updateData = {
      sendWelcomeEmail,
      sendPasswordResetEmail,
      sendTradeNotifications,
      sendStrategyAlerts,
      isActive,
    };

    // Only update SMTP settings if provided
    if (smtpHost) updateData.smtpHost = smtpHost;
    if (smtpPort) updateData.smtpPort = smtpPort;
    if (smtpUsername) updateData.smtpUsername = smtpUsername;
    if (smtpPassword && !smtpPassword.startsWith('***')) {
      // Only update password if it's not masked
      updateData.smtpPassword = smtpPassword;
    }
    if (fromEmail) updateData.fromEmail = fromEmail;
    if (fromName) updateData.fromName = fromName;

    if (settings) {
      await settings.update(updateData);
    } else {
      settings = await EmailSettings.create({
        userId,
        ...updateData,
      });
    }

    // Mask password in response
    const settingsData = settings.toJSON();
    if (settingsData.smtpPassword) {
      settingsData.smtpPassword = '***' + settingsData.smtpPassword.slice(-4);
    }

    res.json({
      success: true,
      data: settingsData,
      message: 'Email settings updated successfully',
    });
  } catch (error) {
    console.error('Update email settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update email settings',
    });
  }
};

// Test email connection
export const testEmailConnection = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUsername, smtpPassword } = req.body;

    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      return res.status(400).json({
        success: false,
        error: 'All SMTP fields are required for testing',
      });
    }

    const result = await emailService.testConnection({
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
    });

    res.json(result);
  } catch (error) {
    console.error('Test email connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test email connection',
    });
  }
};

// Send test email
export const sendTestEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { testType = 'welcome' } = req.body;

    const user = req.user;
    
    let result;
    if (testType === 'welcome') {
      result = await emailService.sendWelcomeEmail(userId, user.email || 'test@example.com', user.name || 'Test User');
    } else if (testType === 'passwordReset') {
      const dummyToken = crypto.randomBytes(32).toString('hex');
      result = await emailService.sendPasswordResetEmail(userId, user.email || 'test@example.com', user.name || 'Test User', dummyToken);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid test type. Use "welcome" or "passwordReset"',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
    });
  }
};
