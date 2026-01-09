/**
 * MT5 Calculation Service
 * Handles SL/TP calculations, PnL computation, and risk calculations
 */

import { logger } from '../../../utils/logger.js';
import { SL_TYPES, TP_TYPES } from '../config/metaapi.config.js';

export class CalculationService {
  /**
   * Calculate stop loss price
   * @param {number} entryPrice - Entry price
   * @param {Object} slConfig - SL configuration { type, value }
   * @param {string} orderType - 'BUY' or 'SELL'
   * @param {Object} symbolSpecs - Symbol specifications
   * @returns {number} Stop loss price
   */
  static calculateStopLoss(entryPrice, slConfig, orderType, symbolSpecs) {
    if (!slConfig || !slConfig.value) {
      return null;
    }

    const { type, value } = slConfig;
    let slPrice;

    switch (type) {
      case SL_TYPES.POINTS:
        // SL is in points
        slPrice = orderType === 'BUY'
          ? entryPrice - (value * symbolSpecs.point)
          : entryPrice + (value * symbolSpecs.point);
        break;

      case SL_TYPES.PERCENTAGE:
        // SL is percentage from entry
        const percentLoss = (entryPrice * value) / 100;
        slPrice = orderType === 'BUY'
          ? entryPrice - percentLoss
          : entryPrice + percentLoss;
        break;

      case SL_TYPES.FIXED_PRICE:
        // SL is absolute price
        slPrice = value;
        break;

      default:
        slPrice = null;
    }

    return slPrice ? parseFloat(slPrice.toFixed(symbolSpecs.digits)) : null;
  }

  /**
   * Calculate take profit price
   * @param {number} entryPrice - Entry price
   * @param {Object} tpConfig - TP configuration { type, value }
   * @param {string} orderType - 'BUY' or 'SELL'
   * @param {Object} symbolSpecs - Symbol specifications
   * @returns {number} Take profit price
   */
  static calculateTakeProfit(entryPrice, tpConfig, orderType, symbolSpecs) {
    if (!tpConfig || !tpConfig.value) {
      return null;
    }

    const { type, value } = tpConfig;
    let tpPrice;

    switch (type) {
      case TP_TYPES.POINTS:
        // TP is in points
        tpPrice = orderType === 'BUY'
          ? entryPrice + (value * symbolSpecs.point)
          : entryPrice - (value * symbolSpecs.point);
        break;

      case TP_TYPES.PERCENTAGE:
        // TP is percentage gain from entry
        const percentGain = (entryPrice * value) / 100;
        tpPrice = orderType === 'BUY'
          ? entryPrice + percentGain
          : entryPrice - percentGain;
        break;

      case TP_TYPES.FIXED_PRICE:
        // TP is absolute price
        tpPrice = value;
        break;

      default:
        tpPrice = null;
    }

    return tpPrice ? parseFloat(tpPrice.toFixed(symbolSpecs.digits)) : null;
  }

  /**
   * Calculate profit/loss
   * @param {number} entryPrice - Entry price
   * @param {number} exitPrice - Exit price
   * @param {number} volume - Trade volume
   * @param {string} orderType - 'BUY' or 'SELL'
   * @returns {Object} { pnl, pnlPercent, pnlPoints }
   */
  static calculatePnL(entryPrice, exitPrice, volume, orderType) {
    if (!entryPrice || !exitPrice || !volume) {
      return { pnl: 0, pnlPercent: 0, pnlPoints: 0 };
    }

    let pnlPoints;
    let pnl;

    if (orderType === 'BUY') {
      pnlPoints = exitPrice - entryPrice;
      pnl = pnlPoints * volume * 100; // Assuming 1 lot = base unit
    } else {
      pnlPoints = entryPrice - exitPrice;
      pnl = pnlPoints * volume * 100;
    }

    const pnlPercent = ((pnl / (entryPrice * volume * 100)) * 100).toFixed(2);

    return {
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPercent: parseFloat(pnlPercent),
      pnlPoints: parseFloat(pnlPoints.toFixed(4)),
    };
  }

  /**
   * Calculate risk/reward ratio
   * @param {number} entryPrice - Entry price
   * @param {number} slPrice - Stop loss price
   * @param {number} tpPrice - Take profit price
   * @param {string} orderType - 'BUY' or 'SELL'
   * @returns {number} Risk/Reward ratio
   */
  static calculateRiskRewardRatio(entryPrice, slPrice, tpPrice, orderType) {
    if (!entryPrice || !slPrice || !tpPrice) {
      return 0;
    }

    let risk, reward;

    if (orderType === 'BUY') {
      risk = Math.abs(entryPrice - slPrice);
      reward = Math.abs(tpPrice - entryPrice);
    } else {
      risk = Math.abs(slPrice - entryPrice);
      reward = Math.abs(entryPrice - tpPrice);
    }

    if (risk === 0) return 0;
    return parseFloat((reward / risk).toFixed(2));
  }

  /**
   * Calculate required margin
   * @param {number} volume - Trade volume
   * @param {number} price - Current price
   * @param {number} leverage - Account leverage
   * @returns {number} Required margin
   */
  static calculateRequiredMargin(volume, price, leverage) {
    if (!volume || !price || !leverage) {
      return 0;
    }

    const notional = volume * price * 100; // For standard lot
    return parseFloat((notional / leverage).toFixed(2));
  }

  /**
   * Calculate position size based on risk
   * @param {number} accountBalance - Account balance
   * @param {number} riskPercent - Risk percentage (0-100)
   * @param {number} entryPrice - Entry price
   * @param {number} slPrice - Stop loss price
   * @returns {number} Recommended position size
   */
  static calculatePositionSize(accountBalance, riskPercent, entryPrice, slPrice) {
    if (!accountBalance || riskPercent <= 0 || !entryPrice || !slPrice) {
      return 0;
    }

    const riskAmount = (accountBalance * riskPercent) / 100;
    const riskPerPoint = Math.abs(entryPrice - slPrice);

    if (riskPerPoint === 0) return 0;

    const positionSize = riskAmount / riskPerPoint;
    return parseFloat(positionSize.toFixed(2));
  }

  /**
   * Validate trade parameters before execution
   * @param {Object} params - Trade parameters
   * @param {Object} accountInfo - Account information
   * @returns {Object} { valid: boolean, errors: [] }
   */
  static validateTradeParams(params, accountInfo) {
    const errors = [];

    // Validate volume
    if (!params.volume || params.volume <= 0) {
      errors.push('Volume must be greater than 0');
    }

    // Validate SL and TP
    if (params.slPrice && params.tpPrice) {
      if (params.orderType === 'BUY') {
        if (params.slPrice >= params.entryPrice) {
          errors.push('SL must be below entry price for BUY orders');
        }
        if (params.tpPrice <= params.entryPrice) {
          errors.push('TP must be above entry price for BUY orders');
        }
      } else {
        if (params.slPrice <= params.entryPrice) {
          errors.push('SL must be above entry price for SELL orders');
        }
        if (params.tpPrice >= params.entryPrice) {
          errors.push('TP must be below entry price for SELL orders');
        }
      }
    }

    // Validate margin
    if (accountInfo && accountInfo.freeMargin > 0) {
      const requiredMargin = this.calculateRequiredMargin(
        params.volume,
        params.entryPrice,
        accountInfo.leverage || 100
      );

      if (requiredMargin > accountInfo.freeMargin) {
        errors.push(`Insufficient margin. Required: ${requiredMargin}, Available: ${accountInfo.freeMargin}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Format price for display
   * @param {number} price - Price to format
   * @param {number} digits - Decimal places
   * @returns {string} Formatted price
   */
  static formatPrice(price, digits = 4) {
    if (!price && price !== 0) return 'N/A';
    return price.toFixed(digits);
  }
}

export default CalculationService;
