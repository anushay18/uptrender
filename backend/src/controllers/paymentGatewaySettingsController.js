import PaymentGatewaySettings from '../models/PaymentGatewaySettings.js';
import path from 'path';
import fs from 'fs';

// Get payment gateway settings
export const getPaymentGatewaySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let settings = await PaymentGatewaySettings.findOne({
      where: { user_id: userId }
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await PaymentGatewaySettings.create({
        user_id: userId,
        gateway_name: 'razorpay',
        is_test_mode: true,
        is_active: false,
        supported_currencies: 'INR'
      });
    }

    // Mask sensitive data
    const settingsData = settings.toJSON();
    if (settingsData.razorpay_key_secret) {
      const secret = settingsData.razorpay_key_secret;
      settingsData.razorpay_key_secret = '***' + secret.slice(-4);
    }

    res.json({
      success: true,
      data: settingsData
    });
  } catch (error) {
    console.error('Error fetching payment gateway settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment gateway settings',
      error: error.message
    });
  }
};

// Update payment gateway settings
export const updatePaymentGatewaySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      razorpay_key_id,
      razorpay_key_secret,
      is_test_mode,
      is_active,
      webhook_secret,
      supported_currencies,
      upi_enabled,
      upi_id,
      upi_name,
      upi_qr_code,
      metamask_enabled,
      wallet_address,
      supported_networks,
      supported_tokens
    } = req.body;

    let settings = await PaymentGatewaySettings.findOne({
      where: { user_id: userId }
    });

    const updateData = {
      gateway_name: 'razorpay'
    };

    if (razorpay_key_id !== undefined) {
      updateData.razorpay_key_id = razorpay_key_id;
    }

    // Only update secret if it's not the masked value
    if (razorpay_key_secret && !razorpay_key_secret.startsWith('***')) {
      updateData.razorpay_key_secret = razorpay_key_secret;
    }

    if (is_test_mode !== undefined) {
      updateData.is_test_mode = is_test_mode;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    if (webhook_secret !== undefined) {
      updateData.webhook_secret = webhook_secret;
    }

    if (supported_currencies !== undefined) {
      updateData.supported_currencies = supported_currencies;
    }

    // UPI settings
    if (upi_enabled !== undefined) {
      updateData.upi_enabled = upi_enabled;
    }
    if (upi_id !== undefined) {
      updateData.upi_id = upi_id;
    }
    if (upi_name !== undefined) {
      updateData.upi_name = upi_name;
    }
    if (upi_qr_code !== undefined) {
      updateData.upi_qr_code = upi_qr_code;
    }

    // MetaMask/Crypto settings
    if (metamask_enabled !== undefined) {
      updateData.metamask_enabled = metamask_enabled;
    }
    if (wallet_address !== undefined) {
      updateData.wallet_address = wallet_address;
    }
    if (supported_networks !== undefined) {
      updateData.supported_networks = supported_networks;
    }
    if (supported_tokens !== undefined) {
      updateData.supported_tokens = supported_tokens;
    }

    if (settings) {
      await settings.update(updateData);
    } else {
      settings = await PaymentGatewaySettings.create({
        user_id: userId,
        ...updateData
      });
    }

    // Mask sensitive data in response
    const settingsData = settings.toJSON();
    if (settingsData.razorpay_key_secret) {
      const secret = settingsData.razorpay_key_secret;
      settingsData.razorpay_key_secret = '***' + secret.slice(-4);
    }

    res.json({
      success: true,
      message: 'Payment gateway settings updated successfully',
      data: settingsData
    });
  } catch (error) {
    console.error('Error updating payment gateway settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment gateway settings',
      error: error.message
    });
  }
};

// Get active payment gateway settings (for users)
export const getActivePaymentGateway = async (req, res) => {
  try {
    // Find payment configuration - get any settings
    // Prioritize records where at least one payment method is enabled
    let settings = await PaymentGatewaySettings.findOne({
      attributes: [
        'id', 
        'gateway_name', 
        'razorpay_key_id', 
        'is_test_mode', 
        'supported_currencies',
        'is_active',
        // UPI fields
        'upi_enabled',
        'upi_id',
        'upi_name',
        'upi_qr_code',
        // MetaMask fields
        'metamask_enabled',
        'wallet_address',
        'supported_networks',
        'supported_tokens'
      ],
      order: [['id', 'DESC']] // Get the most recent configuration
    });

    console.log('getActivePaymentGateway - Raw settings from DB:', settings ? {
      id: settings.id,
      is_active: settings.is_active,
      upi_enabled: settings.upi_enabled,
      upi_id: settings.upi_id,
      metamask_enabled: settings.metamask_enabled,
      razorpay_key_id: settings.razorpay_key_id ? 'SET' : 'NOT SET'
    } : 'NO SETTINGS FOUND');

    if (!settings) {
      console.log('getActivePaymentGateway: No payment settings found in database');
      return res.json({
        success: true,
        data: {
          razorpay_enabled: false,
          upi_enabled: false,
          metamask_enabled: false,
          message: 'No payment gateway configured by admin'
        }
      });
    }

    // Check if any payment method is available
    const razorpayEnabled = settings.is_active && settings.razorpay_key_id ? true : false;
    const upiEnabled = settings.upi_enabled && settings.upi_id ? true : false;
    const metamaskEnabled = settings.metamask_enabled && settings.wallet_address ? true : false;

    console.log('getActivePaymentGateway - Computed values:', {
      razorpayEnabled,
      upiEnabled,
      metamaskEnabled
    });

    // Return payment methods available to users
    res.json({
      success: true,
      data: {
        // Razorpay
        razorpay_enabled: razorpayEnabled,
        razorpay_key_id: razorpayEnabled ? settings.razorpay_key_id : null,
        is_test_mode: settings.is_test_mode,
        supported_currencies: settings.supported_currencies,
        // UPI
        upi_enabled: upiEnabled,
        upi_id: upiEnabled ? settings.upi_id : null,
        upi_name: upiEnabled ? settings.upi_name : null,
        upi_qr_code: upiEnabled ? settings.upi_qr_code : null,
        // MetaMask
        metamask_enabled: metamaskEnabled,
        wallet_address: metamaskEnabled ? settings.wallet_address : null,
        supported_networks: metamaskEnabled ? settings.supported_networks : null,
        supported_tokens: metamaskEnabled ? settings.supported_tokens : null
      }
    });
  } catch (error) {
    console.error('Error fetching active payment gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment gateway',
      error: error.message
    });
  }
};

// Test Razorpay connection
export const testRazorpayConnection = async (req, res) => {
  try {
    const { razorpay_key_id, razorpay_key_secret } = req.body;

    if (!razorpay_key_id || !razorpay_key_secret) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay Key ID and Secret are required'
      });
    }

    // Import Razorpay dynamically
    const Razorpay = (await import('razorpay')).default;

    const instance = new Razorpay({
      key_id: razorpay_key_id,
      key_secret: razorpay_key_secret
    });

    // Test by fetching payment methods
    await instance.payments.all({ count: 1 });

    res.json({
      success: true,
      message: 'Razorpay connection successful'
    });
  } catch (error) {
    console.error('Razorpay connection test failed:', error);
    res.status(400).json({
      success: false,
      message: 'Razorpay connection failed',
      error: error.message
    });
  }
};

// Upload UPI QR Code
export const uploadUpiQrCode = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    let settings = await PaymentGatewaySettings.findOne({
      where: { user_id: userId }
    });

    const qrCodeUrl = `/uploads/qr-codes/${req.file.filename}`;

    if (settings) {
      // Delete old QR code if exists
      if (settings.upi_qr_code && settings.upi_qr_code.startsWith('/uploads/')) {
        const oldQrPath = path.join(process.cwd(), settings.upi_qr_code);
        if (fs.existsSync(oldQrPath)) {
          fs.unlinkSync(oldQrPath);
        }
      }

      await settings.update({ upi_qr_code: qrCodeUrl });
    } else {
      settings = await PaymentGatewaySettings.create({
        user_id: userId,
        gateway_name: 'razorpay',
        is_test_mode: true,
        is_active: false,
        supported_currencies: 'INR',
        upi_qr_code: qrCodeUrl
      });
    }

    res.json({
      success: true,
      message: 'UPI QR code uploaded successfully',
      data: {
        upi_qr_code: qrCodeUrl
      }
    });
  } catch (error) {
    console.error('Error uploading UPI QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload UPI QR code',
      error: error.message
    });
  }
};
