import nodemailer from 'nodemailer';
import EmailSettings from '../models/EmailSettings.js';

class EmailService {
  // Email templates base style
  getBaseTemplate(content, title = 'UpTrender Notification') {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f8; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">📈 UpTrender</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Your Smart Trading Platform</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="color: #6c757d; margin: 0; font-size: 12px;">
                      © ${new Date().getFullYear()} UpTrender. All rights reserved.
                    </p>
                    <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 12px;">
                      You received this email because you have notifications enabled in your account settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  async getTransporter(userId = null) {
    let settings = null;
    
    if (userId) {
      settings = await EmailSettings.findOne({ where: { userId, isActive: true } });
    }
    
    // If no user settings, try to get admin/system settings
    if (!settings) {
      settings = await EmailSettings.findOne({ where: { isActive: true }, order: [['id', 'ASC']] });
    }
    
    if (!settings || !settings.smtpHost) {
      // Return default/env-based transporter
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // Return user-configured transporter
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
    });
  }

  async getEmailConfig(userId = null) {
    let settings = null;
    
    if (userId) {
      settings = await EmailSettings.findOne({ where: { userId } });
    }
    
    if (!settings) {
      settings = await EmailSettings.findOne({ where: { isActive: true }, order: [['id', 'ASC']] });
    }
    
    return {
      fromEmail: settings?.fromEmail || process.env.SMTP_FROM_EMAIL || 'noreply@uptrender.in',
      fromName: settings?.fromName || process.env.SMTP_FROM_NAME || 'UpTrender',
      settings
    };
  }

  // ===================== WELCOME EMAIL =====================
  async sendWelcomeEmail(userId, userEmail, userName) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig(userId);
      
      if (settings && !settings.sendWelcomeEmail) {
        console.log('Welcome email disabled');
        return { success: false, message: 'Welcome email is disabled' };
      }

      const transporter = await this.getTransporter(userId);
      
      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Welcome to UpTrender, ${userName}! 🎉</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Thank you for joining our platform. We're thrilled to have you on board!</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #333; margin: 0 0 15px 0;">🚀 Get Started:</h3>
          <ul style="color: #555; margin: 0; padding-left: 20px; line-height: 2;">
            <li>Create and manage trading strategies</li>
            <li>Execute trades across Crypto, Forex & Indian markets</li>
            <li>Track your portfolio performance in real-time</li>
            <li>Access advanced analytics and insights</li>
            <li>Subscribe to profitable strategies in the marketplace</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.uptrender.in'}/user/dashboard" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        
        <p style="color: #555; font-size: 14px;">If you have any questions, our support team is always ready to help!</p>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: '🎉 Welcome to UpTrender - Your Trading Journey Begins!',
        html: this.getBaseTemplate(content, 'Welcome to UpTrender'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Welcome email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== PASSWORD RESET EMAIL =====================
  async sendPasswordResetEmail(userId, userEmail, userName, resetToken) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig(userId);
      
      if (settings && !settings.sendPasswordResetEmail) {
        return { success: false, message: 'Password reset email is disabled' };
      }

      const transporter = await this.getTransporter(userId);
      const resetUrl = `${process.env.FRONTEND_URL || 'https://app.uptrender.in'}/auth/reset-password?token=${resetToken}`;

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Password Reset Request 🔐</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <div style="background-color: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #856404; margin: 0; font-size: 14px;">⚠️ This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: '🔐 Password Reset Request - UpTrender',
        html: this.getBaseTemplate(content, 'Password Reset'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== TRADE OPENED EMAIL =====================
  async sendTradeOpenedEmail(userEmail, userName, tradeData) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendTradeNotifications) {
        return { success: false, message: 'Trade notifications disabled' };
      }

      const transporter = await this.getTransporter();
      
      const typeColor = tradeData.type?.toLowerCase() === 'buy' ? '#28a745' : '#dc3545';
      const typeIcon = tradeData.type?.toLowerCase() === 'buy' ? '📈' : '📉';

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Trade Opened ${typeIcon}</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">A new trade has been executed on your account:</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Trade ID</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">#${tradeData.id || 'N/A'}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Symbol</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${tradeData.symbol}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Type</td>
              <td style="font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right; color: ${typeColor};">${tradeData.type?.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Quantity</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${tradeData.quantity || tradeData.amount}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Entry Price</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">₹${parseFloat(tradeData.price || tradeData.entryPrice || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #666;">Market</td>
              <td style="color: #333; font-weight: 600; text-align: right;">${tradeData.market || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #555; font-size: 14px;">Time: ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `${typeIcon} Trade Opened: ${tradeData.type?.toUpperCase()} ${tradeData.symbol}`,
        html: this.getBaseTemplate(content, 'Trade Opened'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Trade opened email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending trade opened email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== TRADE CLOSED EMAIL =====================
  async sendTradeClosedEmail(userEmail, userName, tradeData) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendTradeNotifications) {
        return { success: false, message: 'Trade notifications disabled' };
      }

      const transporter = await this.getTransporter();
      
      const pnl = parseFloat(tradeData.pnl || 0);
      const pnlColor = pnl >= 0 ? '#28a745' : '#dc3545';
      const pnlIcon = pnl >= 0 ? '✅' : '❌';

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Trade Closed ${pnlIcon}</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Your trade has been closed:</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Trade ID</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">#${tradeData.id || 'N/A'}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Symbol</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${tradeData.symbol}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Entry Price</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">₹${parseFloat(tradeData.entryPrice || tradeData.price || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Exit Price</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">₹${parseFloat(tradeData.exitPrice || tradeData.currentPrice || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef; font-weight: 600;">P&L</td>
              <td style="font-weight: 700; border-bottom: 1px solid #e9ecef; text-align: right; color: ${pnlColor}; font-size: 16px;">
                ${pnl >= 0 ? '+' : ''}₹${pnl.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style="color: #666;">Status</td>
              <td style="color: #333; font-weight: 600; text-align: right;">${tradeData.status || 'Completed'}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #555; font-size: 14px;">Closed at: ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `${pnlIcon} Trade Closed: ${tradeData.symbol} | P&L: ${pnl >= 0 ? '+' : ''}₹${pnl.toFixed(2)}`,
        html: this.getBaseTemplate(content, 'Trade Closed'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Trade closed email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending trade closed email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== STRATEGY SIGNAL EMAIL =====================
  async sendStrategySignalEmail(userEmail, userName, signalData) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendStrategyAlerts) {
        return { success: false, message: 'Strategy alerts disabled' };
      }

      const transporter = await this.getTransporter();
      
      const signalColor = signalData.action?.toLowerCase() === 'buy' ? '#28a745' : '#dc3545';
      const signalIcon = signalData.action?.toLowerCase() === 'buy' ? '🟢' : '🔴';

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Strategy Signal ${signalIcon}</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">A new signal has been generated by your strategy:</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Strategy</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${signalData.strategyName}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Symbol</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${signalData.symbol}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Action</td>
              <td style="font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right; color: ${signalColor};">${signalData.action?.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="color: #666;">Price</td>
              <td style="color: #333; font-weight: 600; text-align: right;">₹${parseFloat(signalData.price || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #555; font-size: 14px;">Signal Time: ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `${signalIcon} Strategy Signal: ${signalData.action?.toUpperCase()} ${signalData.symbol}`,
        html: this.getBaseTemplate(content, 'Strategy Signal'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Strategy signal email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending strategy signal email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== STRATEGY SUBSCRIPTION EMAIL =====================
  async sendSubscriptionEmail(userEmail, userName, subscriptionData) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendSubscriptionAlerts) {
        return { success: false, message: 'Subscription alerts disabled' };
      }

      const transporter = await this.getTransporter();

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Strategy Subscription Confirmed 🎯</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">You have successfully subscribed to a new strategy:</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Strategy Name</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${subscriptionData.strategyName}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Creator</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${subscriptionData.creatorName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Plan</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${subscriptionData.plan || 'Standard'}</td>
            </tr>
            <tr>
              <td style="color: #666;">Valid Until</td>
              <td style="color: #333; font-weight: 600; text-align: right;">${subscriptionData.expiresAt ? new Date(subscriptionData.expiresAt).toLocaleDateString('en-IN') : 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.uptrender.in'}/user/strategies" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
            View Strategy
          </a>
        </div>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `🎯 Subscription Confirmed: ${subscriptionData.strategyName}`,
        html: this.getBaseTemplate(content, 'Strategy Subscription'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Subscription email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending subscription email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== NEW MARKETPLACE STRATEGY EMAIL =====================
  async sendNewMarketplaceStrategyEmail(userEmail, userName, strategyData) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendMarketplaceUpdates) {
        return { success: false, message: 'Marketplace updates disabled' };
      }

      const transporter = await this.getTransporter();

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">New Strategy in Marketplace 🆕</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">A new strategy has been published in the marketplace:</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #333; margin: 0 0 15px 0;">${strategyData.name}</h3>
          <p style="color: #555; font-size: 14px; margin: 0 0 15px 0;">${strategyData.description || 'No description available'}</p>
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Market</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${strategyData.market}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Risk Level</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${strategyData.riskLevel || 'Medium'}</td>
            </tr>
            <tr>
              <td style="color: #666;">Creator</td>
              <td style="color: #333; font-weight: 600; text-align: right;">${strategyData.creatorName || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.uptrender.in'}/user/marketplace" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
            View in Marketplace
          </a>
        </div>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `🆕 New Strategy: ${strategyData.name} - UpTrender Marketplace`,
        html: this.getBaseTemplate(content, 'New Marketplace Strategy'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('New marketplace strategy email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending new marketplace strategy email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== TICKET UPDATE EMAIL =====================
  async sendTicketUpdateEmail(userEmail, userName, ticketData) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendTicketUpdates) {
        return { success: false, message: 'Ticket updates disabled' };
      }

      const transporter = await this.getTransporter();
      
      const statusColors = {
        open: '#17a2b8',
        'in-progress': '#ffc107',
        resolved: '#28a745',
        closed: '#6c757d'
      };
      const statusColor = statusColors[ticketData.status?.toLowerCase()] || '#6c757d';

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Ticket Update 🎫</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">There's an update on your support ticket:</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Ticket ID</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">#${ticketData.id}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Subject</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${ticketData.subject}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Status</td>
              <td style="font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">
                <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                  ${ticketData.status?.toUpperCase()}
                </span>
              </td>
            </tr>
          </table>
        </div>
        
        ${ticketData.message ? `
          <div style="background-color: #e3f2fd; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #1565c0; margin: 0 0 10px 0; font-weight: 600;">Latest Response:</p>
            <p style="color: #333; margin: 0; font-size: 14px;">${ticketData.message}</p>
          </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.uptrender.in'}/user/support" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
            View Ticket
          </a>
        </div>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `🎫 Ticket #${ticketData.id} Updated: ${ticketData.subject}`,
        html: this.getBaseTemplate(content, 'Ticket Update'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Ticket update email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending ticket update email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== NEW TICKET CREATED EMAIL =====================
  async sendTicketCreatedEmail(userEmail, userName, ticketData) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendTicketUpdates) {
        return { success: false, message: 'Ticket updates disabled' };
      }

      const transporter = await this.getTransporter();

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Support Ticket Created 🎫</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Your support ticket has been created successfully. Our team will respond as soon as possible.</p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Ticket ID</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">#${ticketData.id}</td>
            </tr>
            <tr>
              <td style="color: #666; border-bottom: 1px solid #e9ecef;">Subject</td>
              <td style="color: #333; font-weight: 600; border-bottom: 1px solid #e9ecef; text-align: right;">${ticketData.subject}</td>
            </tr>
            <tr>
              <td style="color: #666;">Priority</td>
              <td style="color: #333; font-weight: 600; text-align: right;">${ticketData.priority || 'Normal'}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #555; font-size: 14px;">We typically respond within 24 hours. You'll receive an email when there's an update.</p>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `🎫 Ticket Created: #${ticketData.id} - ${ticketData.subject}`,
        html: this.getBaseTemplate(content, 'Ticket Created'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Ticket created email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending ticket created email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== SUBSCRIPTION EXPIRY WARNING =====================
  async sendExpiryWarning(userEmail, strategyName, daysRemaining) {
    try {
      const { fromEmail, fromName, settings } = await this.getEmailConfig();
      
      if (settings && !settings.sendSubscriptionAlerts) {
        return { success: false, message: 'Subscription alerts disabled' };
      }

      const transporter = await this.getTransporter();

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Subscription Expiring Soon ⚠️</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">Your subscription to <strong>${strategyName}</strong> will expire in <strong>${daysRemaining} days</strong>.</p>
        
        <div style="background-color: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #856404; margin: 0; font-size: 14px;">Don't miss out on profitable trading signals! Renew your subscription to continue receiving alerts.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.uptrender.in'}/user/subscriptions" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
            Renew Subscription
          </a>
        </div>
      `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: `⚠️ Subscription Expiring: ${strategyName} - ${daysRemaining} days left`,
        html: this.getBaseTemplate(content, 'Subscription Expiring'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Expiry warning email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending expiry warning email:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== TEST CONNECTION =====================
  async testConnection(smtpConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.smtpHost,
        port: smtpConfig.smtpPort,
        secure: smtpConfig.smtpPort === 465,
        auth: {
          user: smtpConfig.smtpUsername,
          pass: smtpConfig.smtpPassword,
        },
      });

      await transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== SEND TEST EMAIL =====================
  async sendTestEmail(toEmail, fromConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host: fromConfig.smtpHost,
        port: fromConfig.smtpPort,
        secure: fromConfig.smtpPort === 465,
        auth: {
          user: fromConfig.smtpUsername,
          pass: fromConfig.smtpPassword,
        },
      });

      const content = `
        <h2 style="color: #333; margin: 0 0 20px 0;">Test Email 🧪</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">This is a test email from UpTrender.</p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">If you received this email, your SMTP settings are configured correctly!</p>
        
        <div style="background-color: #d4edda; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #155724; margin: 0; font-size: 14px;">✅ SMTP Connection Verified</p>
        </div>
        
        <p style="color: #555; font-size: 14px;">Sent at: ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>
      `;

      const mailOptions = {
        from: `"${fromConfig.fromName || 'UpTrender'}" <${fromConfig.fromEmail || fromConfig.smtpUsername}>`,
        to: toEmail,
        subject: '🧪 Test Email - UpTrender SMTP Configuration',
        html: this.getBaseTemplate(content, 'Test Email'),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Test email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending test email:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();
