/**
 * Symbol Registry Service
 * 
 * Centralized service for symbol classification and data source determination.
 * Determines whether a symbol should use CCXT or MT5 for price streaming
 * based on the BROKER TYPE (not symbol type).
 * 
 * ARCHITECTURE PRINCIPLES:
 * ========================
 * 1. BROKER-BASED STREAMING (NOT SYMBOL-BASED)
 *    - If position is on MT5 broker → Use MT5 (even for BTCUSD)
 *    - If position is on CCXT exchange → Use CCXT
 *    - This ensures prices sync between broker dashboard and our dashboard
 * 
 * 2. SYMBOL DETECTION (for fallback only)
 *    - When no broker info is available, use symbol patterns to determine
 *    - Crypto symbols → Try CCXT fallback
 *    - Forex/other symbols → Try MT5 fallback
 */

// Crypto symbol patterns - comprehensive list
const CRYPTO_PATTERNS = {
  // Major cryptocurrencies
  majors: ['BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'BNB', 'ADA', 'DOT', 'LINK', 'XLM'],
  // Popular altcoins
  altcoins: ['DOGE', 'SOL', 'AVAX', 'MATIC', 'UNI', 'AAVE', 'ATOM', 'NEAR', 'APT', 'ARB'],
  // DeFi tokens
  defi: ['SUSHI', 'COMP', 'MKR', 'SNX', 'YFI', 'CRV', '1INCH', 'BAL'],
  // Meme coins
  meme: ['SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF'],
  // Stablecoins (used as base)
  stablecoins: ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD'],
  // Layer 2 and others
  others: ['OP', 'IMX', 'FTM', 'ALGO', 'VET', 'HBAR', 'FIL', 'ICP', 'ETC', 'XMR', 'ZEC']
};

// Flatten all crypto patterns into a single array
const ALL_CRYPTO_TOKENS = Object.values(CRYPTO_PATTERNS).flat();

// Crypto symbol regex for quick detection
const CRYPTO_SYMBOLS_REGEX = new RegExp(ALL_CRYPTO_TOKENS.join('|'), 'i');

// Forex pair patterns
const FOREX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD'];
const FOREX_PAIRS_REGEX = /^(EUR|GBP|AUD|NZD|USD|CHF|CAD|JPY)(EUR|GBP|AUD|NZD|USD|CHF|CAD|JPY)$/i;

// Commodities
const COMMODITIES = ['XAU', 'XAG', 'OIL', 'UKOIL', 'NATGAS'];

// Indices
const INDICES = ['US30', 'US500', 'NAS100', 'UK100', 'DE30', 'JP225', 'HK50', 'AU200'];

class SymbolRegistry {
  constructor() {
    this.customMappings = new Map();
    this.symbolCache = new Map();
  }

  /**
   * Check if a symbol is a cryptocurrency
   * Used for FALLBACK detection when no broker info is available
   */
  isCryptoSymbol(symbol) {
    if (!symbol) return false;
    
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    if (this.symbolCache.has(`crypto:${upperSymbol}`)) {
      return this.symbolCache.get(`crypto:${upperSymbol}`);
    }
    
    // Check custom mappings
    if (this.customMappings.has(upperSymbol)) {
      return this.customMappings.get(upperSymbol) === 'crypto';
    }
    
    // Check if it's a known crypto pattern
    const isCrypto = CRYPTO_SYMBOLS_REGEX.test(upperSymbol) && 
                     !this.isForexPair(upperSymbol) &&
                     !this.isCommodity(upperSymbol) &&
                     !this.isIndex(upperSymbol);
    
    // Cache result
    this.symbolCache.set(`crypto:${upperSymbol}`, isCrypto);
    
    return isCrypto;
  }

  /**
   * Check if a symbol is a forex pair
   */
  isForexPair(symbol) {
    if (!symbol) return false;
    const upperSymbol = symbol.toUpperCase().replace(/[^A-Z]/g, '');
    return FOREX_PAIRS_REGEX.test(upperSymbol);
  }

  /**
   * Check if a symbol is a commodity
   */
  isCommodity(symbol) {
    if (!symbol) return false;
    const upperSymbol = symbol.toUpperCase();
    return COMMODITIES.some(c => upperSymbol.includes(c));
  }

  /**
   * Check if a symbol is an index
   */
  isIndex(symbol) {
    if (!symbol) return false;
    const upperSymbol = symbol.toUpperCase();
    return INDICES.some(i => upperSymbol.includes(i));
  }

  /**
   * Determine the data source for a position
   * IMPORTANT: This is BROKER-BASED, not symbol-based
   * 
   * @param {Object} options
   * @param {string} options.symbol - Trading symbol
   * @param {string} options.market - Market segment (Forex, Crypto, Indian)
   * @param {Object} options.apiKey - API key object (if available)
   * @returns {string} 'mt5' | 'ccxt' | 'public'
   */
  getDataSource({ symbol, market, apiKey }) {
    // If API key is provided, use broker type (NOT symbol type)
    if (apiKey) {
      // MT5 broker - use MT5 even for crypto symbols like BTCUSD
      if (apiKey.broker === 'MT5' || 
          (apiKey.accessToken && apiKey.appName && !apiKey.exchangeId)) {
        return 'mt5';
      }
      
      // CCXT exchange
      if (apiKey.exchangeId && apiKey.apiKey && apiKey.apiSecret) {
        return 'ccxt';
      }
    }
    
    // No API key - use symbol/market detection for fallback
    if (market === 'Crypto' || this.isCryptoSymbol(symbol)) {
      return 'ccxt'; // Will use global crypto API or public exchange
    }
    
    if (market === 'Forex' || market === 'Indian' || 
        this.isForexPair(symbol) || this.isCommodity(symbol) || this.isIndex(symbol)) {
      return 'mt5';
    }
    
    // Default to public for unknown symbols (likely crypto)
    return 'public';
  }

  /**
   * Get the market type for a symbol
   * Used when market is not explicitly provided
   */
  getMarketType(symbol) {
    if (this.isCryptoSymbol(symbol)) return 'Crypto';
    if (this.isForexPair(symbol) || this.isCommodity(symbol) || this.isIndex(symbol)) return 'Forex';
    return 'Unknown';
  }

  /**
   * Add custom symbol mapping
   * Useful for edge cases or platform-specific symbols
   */
  addCustomMapping(symbol, type) {
    this.customMappings.set(symbol.toUpperCase(), type);
    // Clear cache for this symbol
    this.symbolCache.delete(`crypto:${symbol.toUpperCase()}`);
  }

  /**
   * Convert symbol format for specific exchanges
   * e.g., BTCUSD → BTC/USDT for Binance
   */
  convertSymbolForExchange(symbol, exchangeId) {
    const upperSymbol = symbol.toUpperCase();
    
    if (exchangeId === 'binance') {
      // Convert BTCUSD to BTC/USDT format
      if (upperSymbol.endsWith('USD') && !upperSymbol.includes('/')) {
        return upperSymbol.replace('USD', '/USDT');
      }
      // Convert BTCUSDT to BTC/USDT format
      if (upperSymbol.endsWith('USDT') && !upperSymbol.includes('/')) {
        return `${upperSymbol.slice(0, -4)}/USDT`;
      }
    }
    
    if (exchangeId === 'delta') {
      // Delta uses BTCUSD format
      if (upperSymbol.includes('/')) {
        return upperSymbol.replace('/', '').replace('USDT', 'USD');
      }
    }
    
    return symbol;
  }

  /**
   * Get all supported crypto tokens
   */
  getAllCryptoTokens() {
    return [...ALL_CRYPTO_TOKENS];
  }

  /**
   * Clear symbol cache
   */
  clearCache() {
    this.symbolCache.clear();
  }
}

// Export singleton instance
const symbolRegistry = new SymbolRegistry();
export default symbolRegistry;
export { SymbolRegistry, CRYPTO_PATTERNS, FOREX_CURRENCIES, COMMODITIES, INDICES };
