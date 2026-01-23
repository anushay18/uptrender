/**
 * PositionAggregationService
 * 
 * Handles aggregation and drill-down logic for parent-child trade architecture.
 * Provides:
 * - Aggregated strategy-level positions (for clean UI)
 * - Drill-down broker-level positions (for detailed view)
 * - Real-time MTM calculation per broker using broker's own tick data
 */

import { Trade, Strategy, ApiKey, User } from '../models/index.js';
import { Op } from 'sequelize';
import centralizedStreamingService from './CentralizedStreamingService.js';
import { calculatePnL, getContractSize } from '../utils/tradingCalculations.js';

class PositionAggregationService {
  constructor() {
    this.mtmCache = new Map();
  }

  /**
   * Get aggregated positions by strategy for a user
   * Returns top-level view with total quantity, weighted avg price, and total P&L
   * 
   * @param {number} userId 
   * @param {Object} filters - { status, market, strategyId }
   * @returns {Promise<Object[]>} Aggregated positions
   */
  async getAggregatedPositions(userId, filters = {}) {
    try {
      const where = { 
        userId,
        status: { [Op.in]: ['Pending', 'Open'] }
      };

      if (filters.market) {
        where.market = filters.market;
      }

      if (filters.strategyId) {
        where.strategyId = filters.strategyId;
      }

      // Get all open child trades (not parent trades)
      const trades = await Trade.findAll({
        where: {
          ...where,
          isParent: false // Only get child/execution trades
        },
        include: [
          {
            model: Strategy,
            as: 'strategy',
            attributes: ['id', 'name', 'symbol', 'segment']
          },
          {
            model: ApiKey,
            as: 'apiKey',
            attributes: ['id', 'broker', 'apiName', 'segment']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Also get legacy trades without parent-child relationship
      const legacyTrades = await Trade.findAll({
        where: {
          ...where,
          parentTradeId: null,
          isParent: false
        },
        include: [
          {
            model: Strategy,
            as: 'strategy',
            attributes: ['id', 'name', 'symbol', 'segment']
          },
          {
            model: ApiKey,
            as: 'apiKey',
            attributes: ['id', 'broker', 'apiName', 'segment']
          }
        ]
      });

      // Combine trades
      const allTrades = [...trades, ...legacyTrades];

      // Group by strategy + symbol
      const aggregated = this._aggregateByStrategy(allTrades);

      return aggregated;
    } catch (error) {
      console.error('PositionAggregationService error:', error);
      throw error;
    }
  }

  /**
   * Get drill-down positions for a specific strategy
   * Shows individual broker executions with their own prices and MTM
   * 
   * @param {number} userId 
   * @param {number} strategyId 
   * @param {string} symbol 
   * @returns {Promise<Object>}
   */
  async getDrillDownPositions(userId, strategyId, symbol) {
    try {
      const trades = await Trade.findAll({
        where: {
          userId,
          strategyId,
          symbol,
          status: { [Op.in]: ['Pending', 'Open'] },
          isParent: false
        },
        include: [
          {
            model: ApiKey,
            as: 'apiKey',
            attributes: ['id', 'broker', 'apiName', 'segment', 'exchangeId']
          },
          {
            model: Strategy,
            as: 'strategy',
            attributes: ['id', 'name']
          }
        ],
        order: [['apiKeyId', 'ASC'], ['createdAt', 'DESC']]
      });

      // Group by broker (apiKeyId)
      const brokerPositions = {};
      
      for (const trade of trades) {
        const apiKeyId = trade.apiKeyId || 'unknown';
        const brokerName = trade.apiKey?.broker || trade.broker;
        
        if (!brokerPositions[apiKeyId]) {
          brokerPositions[apiKeyId] = {
            apiKeyId,
            broker: brokerName,
            apiName: trade.apiKey?.apiName || brokerName,
            segment: trade.apiKey?.segment || trade.market,
            trades: [],
            totalQuantity: 0,
            totalValue: 0,
            avgEntryPrice: 0,
            currentPrice: 0,
            mtm: 0,
            stopLoss: null,
            takeProfit: null
          };
        }

        const position = brokerPositions[apiKeyId];
        const quantity = parseFloat(trade.amount) || 0;
        const price = parseFloat(trade.price) || 0;

        position.trades.push(trade);
        position.totalQuantity += quantity;
        position.totalValue += quantity * price;

        // Get current price from broker's tick stream
        const brokerPrice = this._getBrokerPrice(apiKeyId, symbol, trade);
        
        // Calculate broker-specific MTM
        const tradeMtm = this._calculateMTM(trade, brokerPrice);
        position.mtm += tradeMtm;

        // Track SL/TP (use first trade's values)
        if (position.stopLoss === null && trade.stopLoss) {
          position.stopLoss = parseFloat(trade.stopLoss);
        }
        if (position.takeProfit === null && trade.takeProfit) {
          position.takeProfit = parseFloat(trade.takeProfit);
        }

        position.currentPrice = brokerPrice;
      }

      // Calculate weighted average for each broker
      for (const position of Object.values(brokerPositions)) {
        if (position.totalQuantity > 0) {
          position.avgEntryPrice = position.totalValue / position.totalQuantity;
        }
      }

      return {
        strategyId,
        symbol,
        brokers: Object.values(brokerPositions),
        totalBrokers: Object.keys(brokerPositions).length
      };
    } catch (error) {
      console.error('getDrillDownPositions error:', error);
      throw error;
    }
  }

  /**
   * Get child trades for a parent trade
   * @param {number} parentTradeId 
   * @returns {Promise<Object[]>}
   */
  async getChildTrades(parentTradeId) {
    const trades = await Trade.findAll({
      where: { parentTradeId },
      include: [
        {
          model: ApiKey,
          as: 'apiKey',
          attributes: ['id', 'broker', 'apiName', 'segment']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    return trades.map(trade => {
      const brokerPrice = this._getBrokerPrice(trade.apiKeyId, trade.symbol, trade);
      return {
        ...trade.toJSON(),
        currentPrice: brokerPrice,
        mtm: this._calculateMTM(trade, brokerPrice)
      };
    });
  }

  /**
   * Aggregate trades by strategy
   * @private
   */
  _aggregateByStrategy(trades) {
    const strategyMap = new Map();

    for (const trade of trades) {
      const strategyId = trade.strategyId || 'no-strategy';
      const symbol = trade.symbol;
      const key = `${strategyId}:${symbol}`;

      if (!strategyMap.has(key)) {
        strategyMap.set(key, {
          strategyId: trade.strategyId,
          strategyName: trade.strategy?.name || 'Manual Trade',
          symbol,
          market: trade.market,
          type: trade.type,
          totalQuantity: 0,
          totalValue: 0,
          avgEntryPrice: 0,
          currentPrice: 0,
          totalMtm: 0,
          brokerCount: 0,
          brokers: new Set(),
          trades: [],
          lastUpdate: null
        });
      }

      const agg = strategyMap.get(key);
      const quantity = parseFloat(trade.amount) || 0;
      const price = parseFloat(trade.price) || 0;

      agg.totalQuantity += quantity;
      agg.totalValue += quantity * price;
      agg.trades.push(trade);

      // Track unique brokers
      const brokerId = trade.apiKeyId || trade.broker;
      agg.brokers.add(brokerId);

      // Get broker-specific price and MTM
      const brokerPrice = this._getBrokerPrice(trade.apiKeyId, symbol, trade);
      agg.totalMtm += this._calculateMTM(trade, brokerPrice);

      // Update current price (weighted by quantity)
      if (brokerPrice > 0) {
        agg.currentPrice = (agg.currentPrice * (agg.totalQuantity - quantity) + brokerPrice * quantity) / agg.totalQuantity;
      }
    }

    // Finalize aggregations
    const result = [];
    for (const [key, agg] of strategyMap.entries()) {
      if (agg.totalQuantity > 0) {
        agg.avgEntryPrice = agg.totalValue / agg.totalQuantity;
      }
      agg.brokerCount = agg.brokers.size;
      agg.brokers = Array.from(agg.brokers);
      
      // Calculate overall P&L percentage
      if (agg.avgEntryPrice > 0) {
        agg.pnlPercentage = ((agg.currentPrice - agg.avgEntryPrice) / agg.avgEntryPrice) * 100;
        if (agg.type === 'Sell') {
          agg.pnlPercentage = -agg.pnlPercentage;
        }
      }

      result.push(agg);
    }

    return result;
  }

  /**
   * Get price from CentralizedStreamingService (admin-configured)
   * 
   * Architecture:
   * - ALL price data comes from admin-configured CentralizedStreamingService
   * - User brokers are ONLY for trade execution, NOT for data streaming
   * - Supports MetaAPI or Deriv (configured by admin)
   * @private
   */
  _getBrokerPrice(apiKeyId, symbol, trade) {
    // ALL segments use centralized streaming from admin panel
    const centralPrice = centralizedStreamingService.getPrice(symbol?.toUpperCase());
    if (centralPrice) {
      return parseFloat(centralPrice.last || centralPrice.bid);
    }

    // Fall back to trade's stored broker price
    if (trade.brokerLastPrice) {
      return parseFloat(trade.brokerLastPrice);
    }

    // Fall back to trade's current price
    if (trade.currentPrice) {
      return parseFloat(trade.currentPrice);
    }

    // Last resort: use entry price
    return parseFloat(trade.price) || 0;
  }

  /**
   * Calculate MTM for a trade using broker-specific price
   * @private
   */
  _calculateMTM(trade, currentPrice) {
    const entryPrice = parseFloat(trade.price) || 0;
    const quantity = parseFloat(trade.amount) || 0;
    const market = trade.market || 'Indian';
    const symbol = (trade.symbol || '').toUpperCase();

    if (!entryPrice || !quantity || !currentPrice) {
      return 0;
    }

    let priceDiff;
    if (trade.type === 'Buy') {
      priceDiff = currentPrice - entryPrice;
    } else {
      priceDiff = entryPrice - currentPrice;
    }

    // Market-specific multipliers
    const isCrypto = market === 'Crypto' || 
                     ['BTC', 'ETH', 'XRP', 'LTC', 'DOGE', 'SOL'].some(c => symbol.includes(c));

    if (isCrypto) {
      return priceDiff * quantity;
    } else if (symbol.includes('XAU')) {
      // Gold (XAUUSD): 1 lot = 100 oz
      return priceDiff * quantity * 100;
    } else if (symbol.includes('XAG')) {
      // Silver (XAGUSD): 1 lot = 5,000 oz
      return priceDiff * quantity * 5000;
    } else if (market === 'Forex') {
      // Forex currency pairs: 1 lot = 100,000 units
      const contractSize = 100000;
      return priceDiff * quantity * contractSize;
    } else {
      // Indian markets: simple calculation
      return priceDiff * quantity;
    }
  }

  /**
   * Update broker prices for a user's positions
   * Called when new tick data arrives
   * @param {number} apiKeyId 
   * @param {string} symbol 
   * @param {Object} price 
   */
  async updateBrokerPrice(apiKeyId, symbol, price) {
    try {
      // Update all open trades for this broker + symbol
      await Trade.update(
        {
          brokerBid: price.bid,
          brokerAsk: price.ask,
          brokerLastPrice: price.last || price.bid,
          lastPriceUpdate: new Date()
        },
        {
          where: {
            apiKeyId,
            symbol,
            status: { [Op.in]: ['Pending', 'Open'] }
          }
        }
      );
    } catch (error) {
      console.warn(`Failed to update broker price for ${symbol}:`, error.message);
    }
  }

  /**
   * Check and trigger SL/TP for broker positions
   * EXECUTES close orders on broker when SL/TP is hit
   * @param {number} apiKeyId 
   * @param {string} symbol 
   * @param {Object} price 
   */
  async checkSlTpTriggers(apiKeyId, symbol, price) {
    try {
      const currentPrice = parseFloat(price.last || price.bid);
      
      // Get open trades with SL/TP for this broker + symbol
      const trades = await Trade.findAll({
        where: {
          apiKeyId,
          symbol,
          status: { [Op.in]: ['Pending', 'Open'] },
          [Op.or]: [
            { stopLoss: { [Op.ne]: null } },
            { takeProfit: { [Op.ne]: null } }
          ]
        },
        include: [
          {
            model: ApiKey,
            as: 'apiKey',
            attributes: ['id', 'broker', 'exchangeId', 'apiKey', 'apiSecret', 'passphrase', 'accessToken', 'appName', 'segment']
          }
        ]
      });

      for (const trade of trades) {
        const sl = trade.stopLoss ? parseFloat(trade.stopLoss) : null;
        const tp = trade.takeProfit ? parseFloat(trade.takeProfit) : null;

        // Check SL trigger
        if (sl && !trade.slTriggered) {
          const slTriggered = trade.type === 'Buy' 
            ? currentPrice <= sl 
            : currentPrice >= sl;
          
          if (slTriggered) {
            console.log(`🛑 SL TRIGGERED for trade ${trade.id} on broker ${apiKeyId}: ${currentPrice} <= ${sl}`);
            
            // Execute close order on broker
            await this._executeCloseOrder(trade, currentPrice, 'SL');
          }
        }

        // Check TP trigger
        if (tp && !trade.tpTriggered) {
          const tpTriggered = trade.type === 'Buy' 
            ? currentPrice >= tp 
            : currentPrice <= tp;
          
          if (tpTriggered) {
            console.log(`🎯 TP TRIGGERED for trade ${trade.id} on broker ${apiKeyId}: ${currentPrice} >= ${tp}`);
            
            // Execute close order on broker
            await this._executeCloseOrder(trade, currentPrice, 'TP');
          }
        }
      }
    } catch (error) {
      console.error('checkSlTpTriggers error:', error.message);
    }
  }

  /**
   * Execute close order on broker when SL/TP triggers
   * @private
   */
  async _executeCloseOrder(trade, closePrice, triggerType) {
    try {
      const apiKey = trade.apiKey;
      if (!apiKey) {
        console.error(`❌ No API key found for trade ${trade.id}`);
        return;
      }

      let closeResult;

      // MT5 Broker
      if (apiKey.broker === 'MT5' && apiKey.accessToken && apiKey.appName) {
        const { mt5Broker } = await import('../../algoengine/index.js');
        await mt5Broker.initialize({
          apiKey: apiKey.accessToken,
          accountId: apiKey.appName
        });
        
        closeResult = await mt5Broker.closeTrade({
          orderId: trade.orderId,
          volume: parseFloat(trade.amount)
        });
      }
      // CCXT Crypto Exchanges
      else if (apiKey.segment === 'Crypto' && apiKey.exchangeId) {
        const { getExchangeInstance, createMarketOrder } = await import('../services/exchangeService.js');
        const exchange = await getExchangeInstance(
          apiKey.exchangeId,
          apiKey.apiKey,
          apiKey.apiSecret,
          apiKey.passphrase
        );
        
        // Close position by placing opposite order
        const closeType = trade.type === 'Buy' ? 'sell' : 'buy';
        closeResult = await createMarketOrder(
          exchange,
          trade.symbol,
          closeType,
          parseFloat(trade.amount)
        );
      }
      // Paper Trading
      else if (apiKey.broker === 'PAPER' || !apiKey) {
        const { paperTradingService } = await import('../services/PaperTradingService.js');
        // closePosition expects (orderId, closePrice)
        closeResult = await paperTradingService.closePosition(trade.orderId, closePrice);
      }
      else {
        console.warn(`⚠️ Unsupported broker for close: ${apiKey.broker}`);
        return;
      }

      // Calculate final P&L using unified calculation
      const entryPrice = parseFloat(trade.price);
      const quantity = parseFloat(trade.amount);
      const market = trade.market || apiKey?.segment || 'Forex';
      
      const { profit: pnl, profitPercent: pnlPercentage } = calculatePnL({
        openPrice: entryPrice,
        currentPrice: closePrice,
        volume: quantity,
        type: trade.type,
        symbol: trade.symbol,
        market
      });

      // Update trade record
      await trade.update({
        status: 'Closed',
        currentPrice: closePrice,
        pnl,
        pnlPercentage,
        slTriggered: triggerType === 'SL',
        tpTriggered: triggerType === 'TP',
        brokerResponseJson: {
          ...trade.brokerResponseJson,
          closeReason: triggerType,
          closePrice,
          closeTime: new Date().toISOString(),
          closeOrderResult: closeResult
        }
      });

      console.log(`✅ ${triggerType} executed: Trade ${trade.id} closed at ${closePrice}, P&L: ${pnl} (${pnlPercentage}%)`);

      // Emit socket update
      const { emitTradeUpdate } = await import('../config/socket.js');
      emitTradeUpdate(trade.userId, trade, 'update');

    } catch (error) {
      console.error(`❌ Failed to execute close order for trade ${trade.id}:`, error.message);
      
      // Mark as trigger attempted but failed
      await trade.update({
        brokerError: `${triggerType} trigger failed: ${error.message}`,
        slTriggered: triggerType === 'SL' ? true : trade.slTriggered,
        tpTriggered: triggerType === 'TP' ? true : trade.tpTriggered
      });
    }
  }
}

const positionAggregationService = new PositionAggregationService();
export default positionAggregationService;
export { PositionAggregationService };
