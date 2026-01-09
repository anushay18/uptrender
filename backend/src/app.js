import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import process from 'process';

// Import middleware
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import tradeRoutes from './routes/tradeRoutes.js';
import strategyRoutes from './routes/strategyRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import adminStrategyRoutes from './routes/adminStrategyRoutes.js';
import adminTradeRoutes from './routes/adminTradeRoutes.js';
import adminApiKeyRoutes from './routes/adminApiKeyRoutes.js';
import adminSupportRoutes from './routes/adminSupportRoutes.js';
import adminFranchiseRoutes from './routes/adminFranchiseRoutes.js';
import adminPlanRoutes from './routes/adminPlans.js';
import userDashboardRoutes from './routes/userDashboardRoutes.js';
import apiKeyRoutes from './routes/apiKeyRoutes.js';
import planRoutes from './routes/planRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import strategySubscriptionRoutes from './routes/strategySubscriptionRoutes.js';
import copyTradingRoutes from './routes/copyTradingRoutes.js';
import adminCopyTradingRoutes from './routes/adminCopyTradingRoutes.js';
import chargeRoutes from './routes/chargeRoutes.js';
import strategyBrokerRoutes from './routes/strategyBrokerRoutes.js';
import emailSettingsRoutes from './routes/emailSettingsRoutes.js';
import paymentGatewaySettingsRoutes from './routes/paymentGatewaySettingsRoutes.js';
import platformSettingsRoutes from './routes/platformSettingsRoutes.js';
import algoTradeRoutes from './routes/algoTradeRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import paperPositionRoutes from './routes/paperPositionRoutes.js';
import exchangeRoutes from './routes/exchangeRoutes.js';

const app = express();

// When deploying behind a proxy (nginx / load balancer) the 'X-Forwarded-*' headers
// (including X-Forwarded-For) are set by the proxy. Express will ignore these
// headers unless `trust proxy` is enabled. If you see errors like:
//   ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
// it means a proxy is setting the header but Express isn't configured to trust it.
// To enable, set the environment variable TRUST_PROXY. Use a boolean value
// ("true"/"false") or a trusted proxy list (e.g. "127.0.0.1,::1" or "loopback").
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv !== undefined) {
  // Allow string values like 'true', '1', 'loopback' or an explicit proxy list
  const trustValue = ['true', '1'].includes(String(trustProxyEnv).toLowerCase()) ? true : trustProxyEnv;
  app.set('trust proxy', trustValue);
  console.log(`Express trust proxy set to: ${trustValue}`);
}

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 requests per minute (very permissive for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development for certain endpoints
    if (process.env.NODE_ENV === 'development') {
      return req.path.includes('/api/');
    }
    return false;
  }
});

// Trust proxy for proper IP detection (needed for rate limiting)
app.set('trust proxy', 1);

// Global middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.1.8:5173',
      'http://localhost:3000', // Alternative dev port
      'http://localhost:4000', // Production frontend port
      'https://app.uptrender.in', // Production domain with SSL
      'http://app.uptrender.in',  // Production domain without SSL
      'https://uptrender.in',     // Root domain with SSL
      'http://uptrender.in',      // Root domain without SSL
      'https://dev.uptrender.in', // Dev domain with SSL
      'http://dev.uptrender.in'   // Dev domain without SSL
    ];

    // Add CORS_ORIGIN from environment (can be comma-separated)
    if (process.env.CORS_ORIGIN) {
      const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
      allowedOrigins.push(...envOrigins);
    }

    const uniqueOrigins = [...new Set(allowedOrigins)].filter(Boolean);

    console.log('CORS check - Origin:', origin, 'Allowed:', uniqueOrigins.includes(origin));
    
    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id']
}));
app.use(morgan('combined')); // Logging
app.use(limiter); // Rate limiting
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files from uploads directory
app.use('/uploads', express.static('./uploads'));

// Health check
const healthCheck = (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
};

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);
app.head('/api/health', healthCheck);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/strategies', adminStrategyRoutes);
app.use('/api/admin/trades', adminTradeRoutes);
app.use('/api/admin/api-keys', adminApiKeyRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use('/api/admin/franchise', adminFranchiseRoutes);
app.use('/api/admin/plans', adminPlanRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/algo-trades', (req, res, next) => {
  console.log(`[DEBUG] Algo-trade request: ${req.method} ${req.path}`);
  next();
}, algoTradeRoutes);
app.use('/api/strategies/subscriptions', strategySubscriptionRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/strategy-brokers', strategyBrokerRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/copy-trading', copyTradingRoutes);
app.use('/api/admin/copy-trading', adminCopyTradingRoutes);
app.use('/api/admin/charges', chargeRoutes);
app.use('/api/email-settings', emailSettingsRoutes);
app.use('/api/payment-gateway', paymentGatewaySettingsRoutes);
// Note: Razorpay webhook route is inside paymentRoutes with raw body parser
app.use('/api/payments', paymentRoutes);
app.use('/api/platform-settings', platformSettingsRoutes);
app.use('/api/paper-positions', paperPositionRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard/admin', adminDashboardRoutes);
app.use('/api/dashboard/user', userDashboardRoutes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;