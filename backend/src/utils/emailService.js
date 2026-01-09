import nodemailer from 'nodemailer';
import EmailSettings from '../models/EmailSettings.js';

class EmailService {
  async getTransporter(userId) {
    const settings = await EmailSettings.findOne({ where: { userId, isActive: true } });
    
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

  async sendWelcomeEmail(userId, userEmail, userName) {
    try {
      const settings = await EmailSettings.findOne({ where: { userId } });
      
      if (settings && !settings.sendWelcomeEmail) {
        console.log('Welcome email disabled for user:', userId);
        return { success: false, message: 'Welcome email is disabled' };
      }

      const transporter = await this.getTransporter(userId);
      const fromEmail = settings?.fromEmail || process.env.SMTP_FROM_EMAIL || 'noreply@uptrender.in';
      const fromName = settings?.fromName || process.env.SMTP_FROM_NAME || 'UpTrender';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: 'Welcome to UpTrender!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1976d2;">Welcome to UpTrender, ${userName}!</h2>
            <p>Thank you for joining our platform. We're excited to have you on board!</p>
            <p>You can now start trading and exploring our features:</p>
            <ul>
              <li>Create and manage trading strategies</li>
              <li>Execute trades across multiple markets</li>
              <li>Track your portfolio performance</li>
              <li>Access advanced analytics</li>
            </ul>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br>The UpTrender Team</p>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Welcome email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(userId, userEmail, userName, resetToken) {
    try {
      const settings = await EmailSettings.findOne({ where: { userId } });
      
      if (settings && !settings.sendPasswordResetEmail) {
        console.log('Password reset email disabled for user:', userId);
        return { success: false, message: 'Password reset email is disabled' };
      }

      const transporter = await this.getTransporter(userId);
      const fromEmail = settings?.fromEmail || process.env.SMTP_FROM_EMAIL || 'noreply@uptrender.in';
      const fromName = settings?.fromName || process.env.SMTP_FROM_NAME || 'UpTrender';
      
      const resetUrl = `${process.env.FRONTEND_URL || 'https://dev.uptrender.in'}/auth/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1976d2;">Password Reset Request</h2>
            <p>Hi ${userName},</p>
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
            <p>Best regards,<br>The UpTrender Team</p>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async testConnection(smtpConfig) {
    try {
      const transporter = nodemailer.createTransporter({
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
}

export default new EmailService();
