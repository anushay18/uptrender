import { Wallet, WalletTransaction, Notification, User, sequelize } from '../models/index.js';
import PaymentGatewaySettings from '../models/PaymentGatewaySettings.js';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { emitWalletUpdate, emitDashboardUpdate, emitNotification } from '../config/socket.js';

// Helper function to get admin wallet and deduct funds
const deductFromAdminWallet = async (amount, userId, paymentMethod, reference, t) => {
  // Get admin user (first admin)
  const adminUser = await User.findOne({ where: { role: 'Admin' }, transaction: t });
  if (!adminUser) {
    console.log('No admin user found for wallet deduction');
    return null;
  }

  // Get or create admin wallet
  let adminWallet = await Wallet.findOne({ where: { userId: adminUser.id }, transaction: t });
  if (!adminWallet) {
    adminWallet = await Wallet.create({
      userId: adminUser.id,
      balance: 0,
      currency: 'INR',
      status: 'Active'
    }, { transaction: t });
  }

  // Get user info for description
  const user = await User.findByPk(userId, { transaction: t });
  const userName = user?.fullName || `User ID: ${userId}`;

  // Deduct from admin wallet
  const newAdminBalance = parseFloat(adminWallet.balance) - parseFloat(amount);
  await adminWallet.update({ balance: newAdminBalance }, { transaction: t });

  // Create admin debit transaction
  const adminTransaction = await WalletTransaction.create({
    walletId: adminWallet.id,
    type: 'debit',
    amount: parseFloat(amount),
    description: `${paymentMethod.toUpperCase()} payment by ${userName}`,
    reference: reference,
    status: 'completed',
    paymentMethod: paymentMethod,
    balanceAfter: newAdminBalance
  }, { transaction: t });

  // Emit admin wallet update
  emitWalletUpdate(adminUser.id, adminWallet, adminTransaction);
  emitDashboardUpdate(adminUser.id, { wallet: { balance: newAdminBalance } });

  // Create notification for admin about user payment
  const adminNotification = await Notification.create({
    userId: adminUser.id,
    type: 'payment',
    title: 'New Payment Received',
    message: `${userName} added Rs.${parseFloat(amount).toFixed(2)} to wallet via ${paymentMethod.toUpperCase()}`,
    metadata: {
      payerUserId: userId,
      payerName: userName,
      amount: amount,
      paymentMethod: paymentMethod,
      reference: reference
    },
    isRead: false
  }, { transaction: t });
  emitNotification(adminUser.id, adminNotification);

  return { adminWallet, adminTransaction, adminUser };
};

// Razorpay Webhook Handler
export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookBody = JSON.stringify(req.body);

    // Get webhook secret from settings
    const settings = await PaymentGatewaySettings.findOne();

    if (!settings || !settings.webhook_secret) {
      console.error('Razorpay webhook secret not configured');
      return res.status(400).json({
        success: false,
        message: 'Webhook secret not configured'
      });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', settings.webhook_secret)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Process webhook event
    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`Razorpay webhook received: ${event}`);

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity);
        break;
      
      case 'order.paid':
        await handleOrderPaid(payload.order.entity, payload.payment.entity);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
};

// Handle payment captured event
async function handlePaymentCaptured(payment) {
  try {
    const userId = payment.notes?.userId;
    if (!userId) {
      console.error('User ID not found in payment notes');
      return;
    }

    const amount = payment.amount / 100; // Convert from paise to rupees

    // Check if transaction already exists
    const existingTransaction = await WalletTransaction.findOne({
      where: { reference: payment.id }
    });

    if (existingTransaction) {
      console.log(`Transaction already processed: ${payment.id}`);
      return;
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      });
    }

    // Use transaction to ensure atomicity
    const result = await sequelize.transaction(async (t) => {
      const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
      await wallet.update({ balance: newBalance }, { transaction: t });

      const transaction = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'credit',
        amount,
        description: 'Razorpay payment (webhook)',
        reference: payment.id,
        balanceAfter: newBalance,
        status: 'completed',
        paymentMethod: 'razorpay'
      }, { transaction: t });

      return { wallet, transaction };
    });

    // Emit real-time updates
    emitWalletUpdate(userId, result.wallet, result.transaction);
    emitDashboardUpdate(userId, { wallet: { balance: result.wallet.balance } });

    // Create notification
    const notification = await Notification.create({
      userId,
      type: 'wallet',
      title: 'Payment Successful',
      message: `₹${parseFloat(amount).toFixed(2)} has been credited to your wallet.`,
      metadata: {
        transactionId: result.transaction.id,
        paymentId: payment.id,
        amount: amount,
        type: 'razorpay_webhook'
      },
      isRead: false
    });
    emitNotification(userId, notification);

    console.log(`Payment captured successfully: ${payment.id}`);
  } catch (error) {
    console.error('Error handling payment.captured:', error);
  }
}

// Handle payment failed event
async function handlePaymentFailed(payment) {
  try {
    const userId = payment.notes?.userId;
    if (!userId) {
      return;
    }

    // Create notification about failed payment
    const notification = await Notification.create({
      userId,
      type: 'wallet',
      title: 'Payment Failed',
      message: `Your payment of ₹${(payment.amount / 100).toFixed(2)} has failed. Please try again.`,
      metadata: {
        paymentId: payment.id,
        amount: payment.amount / 100,
        type: 'razorpay_failed',
        errorCode: payment.error_code,
        errorDescription: payment.error_description
      },
      isRead: false
    });
    emitNotification(userId, notification);

    console.log(`Payment failed: ${payment.id}`);
  } catch (error) {
    console.error('Error handling payment.failed:', error);
  }
}

// Handle order paid event
async function handleOrderPaid(order, payment) {
  try {
    console.log(`Order paid: ${order.id}, Payment: ${payment.id}`);
    // This is typically handled by payment.captured event
    // Can be used for additional order-level processing if needed
  } catch (error) {
    console.error('Error handling order.paid:', error);
  }
}

// Create Razorpay order
export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Get active payment gateway settings
    const settings = await PaymentGatewaySettings.findOne({
      where: { is_active: true }
    });

    if (!settings || !settings.razorpay_key_id || !settings.razorpay_key_secret) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay payment gateway is not configured'
      });
    }

    // Import Razorpay dynamically
    const Razorpay = (await import('razorpay')).default;

    const razorpay = new Razorpay({
      key_id: settings.razorpay_key_id,
      key_secret: settings.razorpay_key_secret
    });

    // Create order (amount in paise for INR)
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `wallet_${userId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        type: 'wallet_credit'
      }
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: amount,
        currency: order.currency,
        keyId: settings.razorpay_key_id
      }
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
};

// Verify Razorpay payment and add funds
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment details'
      });
    }

    // Get active payment gateway settings
    const settings = await PaymentGatewaySettings.findOne({
      where: { is_active: true }
    });

    if (!settings || !settings.razorpay_key_secret) {
      return res.status(400).json({
        success: false,
        message: 'Payment gateway configuration error'
      });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', settings.razorpay_key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Add funds to wallet
    let wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      });
    }

    // Use transaction to ensure atomicity
    const result = await sequelize.transaction(async (t) => {
      const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
      await wallet.update({ balance: newBalance }, { transaction: t });

      const transaction = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'credit',
        amount,
        description: 'Razorpay payment',
        reference: razorpay_payment_id,
        balanceAfter: newBalance,
        status: 'completed',
        paymentMethod: 'razorpay'
      }, { transaction: t });

      // Deduct from admin wallet
      await deductFromAdminWallet(amount, userId, 'razorpay', razorpay_payment_id, t);

      return { wallet, transaction };
    });

    // Emit real-time updates
    emitWalletUpdate(userId, result.wallet, result.transaction);
    emitDashboardUpdate(userId, { wallet: { balance: result.wallet.balance } });

    // Create notification
    const notification = await Notification.create({
      userId,
      type: 'wallet',
      title: 'Payment Successful',
      message: `₹${parseFloat(amount).toFixed(2)} has been credited to your wallet via Razorpay.`,
      metadata: {
        transactionId: result.transaction.id,
        paymentId: razorpay_payment_id,
        amount: amount,
        type: 'razorpay'
      },
      isRead: false
    });
    emitNotification(userId, notification);

    res.json({
      success: true,
      message: 'Payment verified and funds added successfully',
      data: {
        balance: result.wallet.balance,
        transaction: result.transaction
      }
    });
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// Submit UPI payment (manual verification - stores pending payment)
export const submitUpiPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, utr_number, transaction_date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!utr_number) {
      return res.status(400).json({
        success: false,
        message: 'UTR number is required for UPI payments'
      });
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      });
    }

    // Create pending transaction (admin will verify and approve)
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'credit',
      amount,
      description: `UPI Payment - Pending Verification (UTR: ${utr_number})`,
      reference: utr_number,
      status: 'pending',
      paymentMethod: 'upi',
      balanceAfter: wallet.balance // Balance not updated yet
    });

    // Create notification for user
    await Notification.create({
      userId,
      type: 'wallet',
      title: 'UPI Payment Submitted',
      message: `Your UPI payment of Rs.${parseFloat(amount).toFixed(2)} has been submitted for verification.`,
      metadata: {
        transactionId: transaction.id,
        utr: utr_number,
        amount: amount,
        type: 'upi_pending'
      },
      isRead: false
    });

    // Get user name for admin notification
    const user = await User.findByPk(userId);
    const userName = user?.fullName || user?.name || `User ID: ${userId}`;

    // Get admin user and create notification for admin
    const adminUser = await User.findOne({ where: { role: 'Admin' } });
    if (adminUser) {
      const adminNotification = await Notification.create({
        userId: adminUser.id,
        type: 'payment',
        title: 'New UPI Payment Request',
        message: `${userName} submitted Rs.${parseFloat(amount).toFixed(2)} UPI payment (UTR: ${utr_number}). Verification required.`,
        metadata: {
          payerUserId: userId,
          payerName: userName,
          amount: amount,
          utr: utr_number,
          transactionId: transaction.id,
          paymentMethod: 'upi'
        },
        isRead: false
      });
      emitNotification(adminUser.id, adminNotification);
    }

    res.json({
      success: true,
      message: 'UPI payment submitted for verification. Funds will be credited once verified by admin.',
      data: {
        transactionId: transaction.id,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error submitting UPI payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit UPI payment',
      error: error.message
    });
  }
};

// Submit MetaMask/Crypto payment (manual verification)
export const submitCryptoPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, tx_hash, network, token, inr_equivalent } = req.body;

    if (!inr_equivalent || inr_equivalent <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid INR equivalent amount'
      });
    }

    if (!tx_hash) {
      return res.status(400).json({
        success: false,
        message: 'Transaction hash is required for crypto payments'
      });
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      });
    }

    // Create pending transaction (admin will verify and approve)
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'credit',
      amount: inr_equivalent,
      description: `Crypto Payment - Pending Verification (${amount} ${token} on ${network}, TX: ${tx_hash})`,
      reference: tx_hash,
      status: 'pending',
      paymentMethod: 'crypto',
      balanceAfter: wallet.balance // Balance not updated yet
    });

    // Create notification for user
    await Notification.create({
      userId,
      type: 'wallet',
      title: 'Crypto Payment Submitted',
      message: `Your crypto payment of ${amount} ${token} (Rs.${parseFloat(inr_equivalent).toFixed(2)}) has been submitted for verification.`,
      metadata: {
        transactionId: transaction.id,
        txHash: tx_hash,
        network,
        token,
        amount,
        inrEquivalent: inr_equivalent,
        type: 'crypto_pending'
      },
      isRead: false
    });

    // Get user name for admin notification
    const user = await User.findByPk(userId);
    const userName = user?.fullName || user?.name || `User ID: ${userId}`;

    // Get admin user and create notification for admin
    const adminUser = await User.findOne({ where: { role: 'Admin' } });
    if (adminUser) {
      const adminNotification = await Notification.create({
        userId: adminUser.id,
        type: 'payment',
        title: 'New Crypto Payment Request',
        message: `${userName} submitted ${amount} ${token} (Rs.${parseFloat(inr_equivalent).toFixed(2)}) crypto payment. Verification required.`,
        metadata: {
          payerUserId: userId,
          payerName: userName,
          cryptoAmount: amount,
          token: token,
          network: network,
          inrAmount: inr_equivalent,
          txHash: tx_hash,
          transactionId: transaction.id,
          paymentMethod: 'crypto'
        },
        isRead: false
      });
      emitNotification(adminUser.id, adminNotification);
    }

    res.json({
      success: true,
      message: 'Crypto payment submitted for verification. Funds will be credited once verified by admin.',
      data: {
        transactionId: transaction.id,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error submitting crypto payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit crypto payment',
      error: error.message
    });
  }
};

// Admin: Approve pending payment
export const approvePendingPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await WalletTransaction.findByPk(transactionId, {
      include: [{
        model: Wallet,
        as: 'wallet'
      }]
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not pending'
      });
    }

    const wallet = transaction.wallet;
    const userId = wallet.userId;

    // Update balance and transaction
    const result = await sequelize.transaction(async (t) => {
      const newBalance = parseFloat(wallet.balance) + parseFloat(transaction.amount);
      await wallet.update({ balance: newBalance }, { transaction: t });

      await transaction.update({
        status: 'completed',
        balanceAfter: newBalance,
        description: transaction.description.replace('Pending Verification', 'Approved')
      }, { transaction: t });

      // Deduct from admin wallet
      await deductFromAdminWallet(
        transaction.amount,
        userId,
        transaction.paymentMethod || 'upi',
        transaction.reference,
        t
      );

      return { wallet, transaction };
    });

    // Emit real-time updates
    emitWalletUpdate(userId, result.wallet, result.transaction);
    emitDashboardUpdate(userId, { wallet: { balance: result.wallet.balance } });

    // Create notification
    const notification = await Notification.create({
      userId,
      type: 'wallet',
      title: 'Payment Approved',
      message: `Your payment of ₹${parseFloat(transaction.amount).toFixed(2)} has been approved and credited.`,
      metadata: {
        transactionId: transaction.id,
        amount: transaction.amount,
        type: 'payment_approved'
      },
      isRead: false
    });
    emitNotification(userId, notification);

    res.json({
      success: true,
      message: 'Payment approved and funds credited',
      data: result
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve payment',
      error: error.message
    });
  }
};

// Admin: Reject pending payment
export const rejectPendingPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await WalletTransaction.findByPk(transactionId, {
      include: [{
        model: Wallet,
        as: 'wallet'
      }]
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not pending'
      });
    }

    const wallet = transaction.wallet;
    const userId = wallet.userId;

    // Update transaction status
    await transaction.update({
      status: 'rejected',
      description: `${transaction.description} - REJECTED: ${reason || 'No reason provided'}`
    });

    // Create notification
    const notification = await Notification.create({
      userId,
      type: 'wallet',
      title: 'Payment Rejected',
      message: `Your payment of ₹${parseFloat(transaction.amount).toFixed(2)} was rejected. Reason: ${reason || 'Contact support for details'}`,
      metadata: {
        transactionId: transaction.id,
        amount: transaction.amount,
        reason,
        type: 'payment_rejected'
      },
      isRead: false
    });
    emitNotification(userId, notification);

    res.json({
      success: true,
      message: 'Payment rejected',
      data: transaction
    });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject payment',
      error: error.message
    });
  }
};

// Admin: Get pending payments
export const getPendingPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const transactions = await WalletTransaction.findAndCountAll({
      where: { status: 'pending' },
      include: [{
        model: Wallet,
        as: 'wallet',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: transactions.rows,
      pagination: {
        total: transactions.count,
        page: parseInt(page),
        pages: Math.ceil(transactions.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending payments',
      error: error.message
    });
  }
};

// Admin: Get all payment transactions (Razorpay, UPI, Crypto)
export const getAllPaymentTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const transactions = await WalletTransaction.findAndCountAll({
      where: {
        paymentMethod: ['razorpay', 'upi', 'crypto', 'metamask']
      },
      include: [{
        model: Wallet,
        as: 'wallet',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: transactions.rows,
      pagination: {
        total: transactions.count,
        page: parseInt(page),
        pages: Math.ceil(transactions.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all payment transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment transactions',
      error: error.message
    });
  }
};

// Network RPC URLs for blockchain verification
const NETWORK_RPC_URLS = {
  ethereum: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Public Infura key
  sepolia: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  polygon: 'https://polygon-rpc.com',
  bsc: 'https://bsc-dataseed.binance.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
};

// Verify crypto transaction on blockchain
export const verifyCryptoTransaction = async (req, res) => {
  try {
    const { tx_hash, network, expected_recipient, expected_amount } = req.body;

    if (!tx_hash) {
      return res.status(400).json({
        success: false,
        message: 'Transaction hash is required'
      });
    }

    const networkKey = network?.toLowerCase() || 'ethereum';
    const rpcUrl = NETWORK_RPC_URLS[networkKey];

    if (!rpcUrl) {
      return res.status(400).json({
        success: false,
        message: `Unsupported network: ${network}. Supported networks: ${Object.keys(NETWORK_RPC_URLS).join(', ')}`
      });
    }

    // Create provider for the network
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(tx_hash);

    if (!receipt) {
      // Transaction might be pending, try to get the transaction
      const tx = await provider.getTransaction(tx_hash);
      
      if (!tx) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found on the blockchain. Please verify the transaction hash and network.',
          verified: false
        });
      }

      // Transaction exists but not yet mined
      return res.json({
        success: true,
        verified: false,
        status: 'pending',
        message: 'Transaction is pending confirmation',
        data: {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          network: networkKey
        }
      });
    }

    // Transaction is mined
    const isSuccess = receipt.status === 1;

    // Get full transaction details
    const tx = await provider.getTransaction(tx_hash);
    const valueInEther = ethers.formatEther(tx.value);

    // Get block timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : null;

    // Verify recipient if expected
    let recipientMatch = true;
    if (expected_recipient) {
      recipientMatch = tx.to?.toLowerCase() === expected_recipient.toLowerCase();
    }

    // Verify amount if expected (with some tolerance for gas)
    let amountMatch = true;
    if (expected_amount) {
      const expectedWei = ethers.parseEther(expected_amount.toString());
      // Allow 0.1% tolerance
      const tolerance = expectedWei / 1000n;
      amountMatch = tx.value >= (expectedWei - tolerance);
    }

    const verified = isSuccess && recipientMatch && amountMatch;

    res.json({
      success: true,
      verified,
      message: verified ? 'Transaction verified successfully' : 'Transaction found but verification conditions not met',
      data: {
        hash: tx_hash,
        status: isSuccess ? 'confirmed' : 'failed',
        from: tx.from,
        to: tx.to,
        value: valueInEther,
        network: networkKey,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations || 'N/A',
        timestamp,
        gasUsed: receipt.gasUsed.toString(),
        recipientMatch: expected_recipient ? recipientMatch : null,
        amountMatch: expected_amount ? amountMatch : null
      }
    });

  } catch (error) {
    console.error('Error verifying crypto transaction:', error);
    
    // Handle specific ethers errors
    if (error.code === 'INVALID_ARGUMENT') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction hash format',
        verified: false
      });
    }

    if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to blockchain network. Please try again.',
        verified: false
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to verify transaction',
      error: error.message,
      verified: false
    });
  }
};

// Submit and auto-verify crypto payment
export const submitAndVerifyCryptoPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, tx_hash, network, token, inr_equivalent, user_address } = req.body;

    if (!inr_equivalent || inr_equivalent <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid INR equivalent amount'
      });
    }

    if (!tx_hash) {
      return res.status(400).json({
        success: false,
        message: 'Transaction hash is required'
      });
    }

    // Get payment settings to check merchant wallet
    const settings = await PaymentGatewaySettings.findOne({
      where: { isActive: true }
    });

    const merchantWallet = settings?.wallet_address;

    // Verify transaction on blockchain
    let verificationResult = null;
    const networkKey = network?.toLowerCase() || 'ethereum';
    const rpcUrl = NETWORK_RPC_URLS[networkKey];

    if (rpcUrl && merchantWallet) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const receipt = await provider.getTransactionReceipt(tx_hash);
        
        if (receipt) {
          const tx = await provider.getTransaction(tx_hash);
          const recipientMatch = tx.to?.toLowerCase() === merchantWallet.toLowerCase();
          
          verificationResult = {
            verified: receipt.status === 1 && recipientMatch,
            status: receipt.status === 1 ? 'confirmed' : 'failed',
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value),
            recipientMatch
          };
        }
      } catch (verifyError) {
        console.log('Blockchain verification failed:', verifyError.message);
        verificationResult = { verified: false, error: verifyError.message };
      }
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'INR',
        status: 'Active'
      });
    }

    // Determine transaction status based on verification
    const txStatus = verificationResult?.verified ? 'verified_pending_admin' : 'pending';
    const statusNote = verificationResult?.verified 
      ? 'Blockchain verified - awaiting admin approval' 
      : 'Pending manual verification';

    // Create transaction record
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'credit',
      amount: inr_equivalent,
      description: `Crypto Payment - ${statusNote} (${amount} ${token} on ${network}, TX: ${tx_hash})`,
      reference: tx_hash,
      status: txStatus,
      paymentMethod: 'crypto',
      balanceAfter: wallet.balance // Balance not updated yet
    });

    // Create notification
    await Notification.create({
      userId,
      type: 'wallet',
      title: verificationResult?.verified ? 'Crypto Payment Verified' : 'Crypto Payment Submitted',
      message: verificationResult?.verified 
        ? `Your crypto payment of ${amount} ${token} (₹${parseFloat(inr_equivalent).toFixed(2)}) has been verified on the blockchain. Awaiting admin approval.`
        : `Your crypto payment of ${amount} ${token} (₹${parseFloat(inr_equivalent).toFixed(2)}) has been submitted for verification.`,
      metadata: {
        transactionId: transaction.id,
        txHash: tx_hash,
        network,
        token,
        amount,
        inrEquivalent: inr_equivalent,
        userAddress: user_address,
        type: 'crypto_pending',
        blockchainVerified: verificationResult?.verified || false,
        verificationDetails: verificationResult
      },
      isRead: false
    });

    res.json({
      success: true,
      message: verificationResult?.verified 
        ? 'Payment verified on blockchain! Awaiting admin approval for fund credit.'
        : 'Crypto payment submitted for verification. Funds will be credited once verified by admin.',
      data: {
        transactionId: transaction.id,
        status: txStatus,
        blockchainVerified: verificationResult?.verified || false,
        verificationDetails: verificationResult
      }
    });
  } catch (error) {
    console.error('Error submitting crypto payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit crypto payment',
      error: error.message
    });
  }
};
