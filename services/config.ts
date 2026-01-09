// API Configuration
// By default point to the deployed backend. If you need local testing,
// uncomment the local URLs below and comment the deployed URLs.
const DEFAULT_API_URL = 'https://app.uptrender.in';
const DEFAULT_WS_URL = 'wss://app.uptrender.in';

// Local development (example):
// const DEFAULT_API_URL = 'http://192.168.1.13:4001';
// const DEFAULT_WS_URL = 'ws://192.168.1.13:4001';

export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL,
  API_URL: process.env.EXPO_PUBLIC_API_URL ? `${process.env.EXPO_PUBLIC_API_URL}/api` : `${DEFAULT_API_URL}/api`,
  WS_URL: process.env.EXPO_PUBLIC_WS_URL || DEFAULT_WS_URL,
  TIMEOUT: 30000,
};

// Storage Keys for AsyncStorage/SecureStore
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  THEME: 'theme',
  ONBOARDING_COMPLETE: 'onboardingComplete',
};

export const ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  
  // User
  USER: {
    PROFILE: '/users/profile',
    AVATAR: '/users/avatar',
    CHANGE_PASSWORD: '/users/change-password',
    WEBHOOK_SECRET: '/users/webhook-secret',
  },
  
  // Dashboard
  DASHBOARD: {
    STATS: '/dashboard/stats',
    USER: '/dashboard',
    ADMIN: '/dashboard/admin',
  },
  
  // Trades
  TRADES: {
    LIST: '/trades',
    STATS: '/trades/stats',
    BY_ID: (id: number) => `/trades/${id}`,
  },
  
  // Algo Trades
  ALGO_TRADES: {
    EXECUTE: '/algo-trades/execute',
    MANUAL: '/algo-trades/manual',
    POSITIONS: '/algo-trades/positions',
    CLOSE: (id: number) => `/algo-trades/${id}/close`,
    PRICE: (symbol: string) => `/algo-trades/price/${symbol}`,
    PRICES: '/algo-trades/prices',
    ACCOUNT: '/algo-trades/account',
  },
  
  // Strategies
  STRATEGIES: {
    LIST: '/strategies',
    MARKETPLACE: '/strategies/marketplace',
    BY_ID: (id: number) => `/strategies/${id}`,
    STATS: (id: number) => `/strategies/${id}/stats`,
    TOGGLE_RUNNING: (id: number) => `/strategies/${id}/toggle-running`,
    TOGGLE_FAVORITE: (id: number) => `/strategies/${id}/toggle-favorite`,
    START: (id: number) => `/strategies/${id}/start`,
    STOP: (id: number) => `/strategies/${id}/stop`,
    ACTIVATE: (id: number) => `/strategies/${id}/activate`,
    DEACTIVATE: (id: number) => `/strategies/${id}/deactivate`,
    DRAFTS: '/strategies/drafts',
    SAVE_DRAFT: '/strategies/save-draft',
    VALIDATE: '/strategies/validate',
    GENERATE_CODE: '/strategies/generate-code',
    BACKTEST: '/strategies/backtest',
    DEPLOY: '/strategies/deploy',
  },
  
  // Strategy Subscriptions
  SUBSCRIPTIONS: {
    LIST: '/strategies/subscriptions',
    BY_ID: (id: number) => `/strategies/subscriptions/${id}`,
    SUBSCRIBE: (strategyId: number) => `/strategies/subscriptions/${strategyId}/subscribe`,
    UNSUBSCRIBE: (id: number) => `/strategies/subscriptions/${id}/unsubscribe`,
    RENEW: (id: number) => `/strategies/subscriptions/${id}/renew`,
    PAUSE: (id: number) => `/strategies/subscriptions/${id}/toggle-pause`,
    SET_MODE: (id: number) => `/strategies/subscriptions/${id}/trade-mode`,
    BROKERS: (id: number) => `/strategies/subscriptions/${id}/brokers`,
    CHECK_POSITIONS: (id: number) => `/strategies/subscriptions/${id}/check-positions`,
    UPDATE: (id: number) => `/strategies/subscriptions/${id}`,
  },
  
  // Strategy Brokers
  STRATEGY_BROKERS: {
    LIST: (strategyId: number) => `/strategy-brokers/${strategyId}`,
    ADD: (strategyId: number) => `/strategy-brokers/${strategyId}`,
    BULK_ADD: (strategyId: number) => `/strategy-brokers/${strategyId}/bulk`,
    REMOVE: (id: number) => `/strategy-brokers/${id}`,
    TOGGLE: (id: number) => `/strategy-brokers/${id}/toggle`,
  },
  
  // API Keys
  API_KEYS: {
    LIST: '/api-keys',
    BY_ID: (id: number) => `/api-keys/${id}`,
    VERIFY: (id: number) => `/api-keys/${id}/verify`,
    REFRESH_BALANCE: (id: number) => `/api-keys/${id}/refresh-balance`,
    SET_DEFAULT: (id: number) => `/api-keys/${id}/set-default`,
    TEST: (id: number) => `/api-keys/${id}/test`,
  },
  
  // Plans
  PLANS: {
    AVAILABLE: '/plans/available',
    CATALOG: '/plans/catalog',
    MY_PLAN: '/plans/my-plan',
    CURRENT: '/plans/current',
    SUBSCRIBE: (planId: number) => `/plans/${planId}/subscribe`,
    CANCEL: '/plans/cancel',
    TOGGLE_AUTO_RENEW: '/plans/toggle-auto-renew',
  },
  
  // Wallet
  WALLET: {
    GET: '/wallet',
    TRANSACTIONS: '/wallet/transactions',
    STATS: '/wallet/stats',
    ADD_FUNDS: '/wallet/add-funds',
    WITHDRAW: '/wallet/withdraw',
  },
  
  // Copy Trading
  COPY_TRADING: {
    LIST: '/copy-trading',
    STATISTICS: '/copy-trading/statistics',
    BY_ID: (id: number) => `/copy-trading/${id}`,
    TEST: (id: number) => `/copy-trading/${id}/test`,
    TOGGLE: (id: number) => `/copy-trading/${id}/toggle`,
  },
  
  // Paper Positions
  PAPER_POSITIONS: {
    LIST: '/paper-positions',
    HISTORY: '/paper-positions/history',
    STATS: '/paper-positions/stats',
    OPEN: '/paper-positions/open',
    CLOSE: (id: number) => `/paper-positions/${id}/close`,
    CLOSE_ALL: (strategyId: number) => `/paper-positions/strategy/${strategyId}/close-all`,
    MODIFY: (id: number) => `/paper-positions/${id}`,
  },
  
  // Exchanges
  EXCHANGES: {
    SUPPORTED: '/exchanges/supported',
    POPULAR: '/exchanges/popular',
    INFO: (id: string) => `/exchanges/${id}`,
    REQUIRES_PASSPHRASE: (id: string) => `/exchanges/${id}/requires-passphrase`,
    SYMBOLS: (id: string) => `/exchanges/${id}/symbols`,
    TICKER: '/exchanges/ticker',
    OHLCV: '/exchanges/ohlcv',
    TEST: (id: string) => `/exchanges/${id}/test`,
    BALANCE: (id: string) => `/exchanges/${id}/balance`,
    MARKET_ORDER: (id: string) => `/exchanges/${id}/market-order`,
    LIMIT_ORDER: (id: string) => `/exchanges/${id}/limit-order`,
    CANCEL_ORDER: '/exchanges/orders/cancel',
    OPEN_ORDERS: '/exchanges/orders/open',
    POSITIONS: '/exchanges/positions',
  },
  
  // Payments
  PAYMENTS: {
    CREATE_RAZORPAY: '/payments/razorpay/create-order',
    VERIFY_RAZORPAY: '/payments/razorpay/verify',
    SUBMIT_UPI: '/payments/upi/submit',
    SUBMIT_CRYPTO: '/payments/crypto/submit',
    VERIFY_CRYPTO: '/payments/crypto/verify',
    SUBMIT_VERIFY_CRYPTO: '/payments/crypto/submit-verify',
  },
  
  // Support
  SUPPORT: {
    LIST: '/support',
    BY_ID: (id: number) => `/support/${id}`,
    ADD_MESSAGE: (id: number) => `/support/${id}/message`,
    CLOSE: (id: number) => `/support/${id}/close`,
  },
  
  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_READ: (id: number) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
    DELETE: (id: number) => `/notifications/${id}`,
    CLEAR_READ: '/notifications/clear-read',
  },
  
  // Platform Settings
  PLATFORM: {
    SETTINGS: '/platform-settings',
  },
};
