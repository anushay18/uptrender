// COMPLETE REPLACEMENT FOR executeTradingViewWebhook FUNCTION
// This implements multi-subscriber execution for strategy webhooks

import { Trade, Strategy, User, StrategySubscription, StrategyBroker, ApiKey, SignalLog, PerTradeCharge, Wallet, WalletTransaction, Notification } from '../models/index.js';
import { mt5Broker } from '../../algoengine/index.js';
import { emitTradeUpdate } from '../config/socket.js';
import { paperTradingService } from '../services/PaperTradingService.js';

/**
 * Process per-trade charge for a user (both owner and subscriber)
 * Deducts the configured per-trade charge from the user's wallet
 * Applies to ALL users executing live trades on configured strategies
 */
const processPerTradeChargeForSubscriber = async ({ subscriberId, ownerId, strategyId, strategyName, tradeId }) => {
  try {
    // Charge applies to everyone (owner and subscribers) for live trades

    // Check if there's an active per-trade charge config
    const perTradeCharge = await PerTradeCharge.findOne({
      where: { isActive: true },
      order: [['id', 'ASC']]
    });

    if (!perTradeCharge || !perTradeCharge.strategyIds) {
      return { success: true, skipped: true, reason: 'No active per-trade charge configuration' };
    }

    // Check if strategy is in the list of strategies with per-trade charge
    const strategyIds = Array.isArray(perTradeCharge.strategyIds) 
      ? perTradeCharge.strategyIds 
      : JSON.parse(perTradeCharge.strategyIds || '[]');

    if (!strategyIds.includes(Number(strategyId))) {
      return { success: true, skipped: true, reason: 'Strategy not configured for per-trade charge' };
    }

    const chargeAmount = parseFloat(perTradeCharge.amount);
    if (!chargeAmount || chargeAmount <= 0) {
      return { success: true, skipped: true, reason: 'Charge amount is zero or invalid' };
    }

    // Get subscriber wallet
    const wallet = await Wallet.findOne({
      where: { userId: subscriberId, status: 'Active' }
    });

    if (!wallet) {
      console.warn(`⚠️ No active wallet found for user ${subscriberId}`);
      return { success: false, error: 'No active wallet found' };
    }

    const currentBalance = parseFloat(wallet.balance) || 0;

    if (currentBalance < chargeAmount) {
      console.warn(`⚠️ Insufficient balance for per-trade charge: User ${subscriberId} has ₹${currentBalance}, needs ₹${chargeAmount}`);
      // Still allow the trade, just log the warning
      return { 
        success: false, 
        error: 'Insufficient balance',
        currentBalance,
        chargeAmount
      };
    }

    // Deduct charge
    const newBalance = currentBalance - chargeAmount;
    await wallet.update({ balance: newBalance });

    // Create transaction record
    await WalletTransaction.create({
      walletId: wallet.id,
      type: 'debit',
      amount: chargeAmount,
      description: `Per-trade charge for strategy: ${strategyName}`,
      reference: `PTC-${tradeId}-${strategyId}`,
      balanceAfter: newBalance
    });

    // Create notification
    await Notification.create({
      userId: subscriberId,
      type: 'transaction',
      title: 'Per-Trade Charge Deducted',
      message: `₹${chargeAmount} has been deducted from your wallet for trade execution in strategy: ${strategyName}`,
      data: {
        tradeId,
        strategyId,
        amount: chargeAmount,
        type: 'per_trade_charge'
      },
      isRead: false
    });

    console.log(`💰 Per-trade charge of ₹${chargeAmount} deducted from user ${subscriberId} for trade ${tradeId}`);
    
    return {
      success: true,
      chargeAmount,
      newBalance
    };
  } catch (error) {
    console.error(`❌ Error processing per-trade charge for user ${subscriberId}:`, error.message);
    // Don't fail the trade if charge processing fails
    return { success: false, error: error.message };
  }
};

/**
 * Execute Trade from TradingView Webhook (Multi-Subscriber)
 * POST /api/algo-trades/webhook
 * 
 * NEW: Uses strategy-level secret. All active subscribers receive trades.
 * 
 * TradingView Webhook Format:
 * {
 *   "secret": "ST123456",    // Strategy's webhook secret (not user secret)
 *   "signal": "BUY" | "SELL" | 0,
 *   "symbol": "EURUSD" (optional)
 * }
 */
export const executeTradingViewWebhook_NEW = async (req, res) => {
  try {
    const { secret, signal, symbol: customSymbol } = req.body;
    const signalReceivedAt = new Date();

    // Validate secret
    if (!secret) {
      console.warn('❌ Missing secret key');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        message: 'Strategy webhook secret is required',
        example: { secret: "ST123456", signal: "BUY" }
      });
    }

    // Find strategy by webhook secret
    const strategy = await Strategy.findOne({
      where: { webhookSecret: secret },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!strategy) {
      console.warn(`❌ Invalid webhook secret: ${secret}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication failed',
        message: 'Invalid strategy webhook secret',
        receivedSecret: secret
      });
    }

    // Log webhook receipt
    console.log(`📡 Webhook received from ${req.ip}:`, { 
      strategyId: strategy.id, 
      strategyName: strategy.name,
      strategyOwner: strategy.user?.email,
      signal, 
      symbol: customSymbol 
    });

    // Parse signal: BUY/SELL/buy/sell or numeric (positive=BUY, negative=SELL, 0=CLOSE)
    let parsedSignal;
    let isCloseSignal = false;
    
    if (signal === 0 || signal === '0') {
      isCloseSignal = true;
      parsedSignal = 'CLOSE';
    } else if (typeof signal === 'number') {
      parsedSignal = signal > 0 ? 'BUY' : 'SELL';
    } else if (typeof signal === 'string') {
      const upperSignal = signal.toUpperCase();
      if (['BUY', 'SELL'].includes(upperSignal)) {
        parsedSignal = upperSignal;
      } else {
        // Try to parse as number
        const numSignal = parseFloat(signal);
        if (isNaN(numSignal)) {
          console.warn(`❌ Invalid signal: ${signal}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid signal',
            message: 'signal must be: "BUY", "SELL", positive number (buy), negative number (sell), or 0 (close)',
            received: signal,
            examples: ['BUY', 'SELL', '1', '-1', '0']
          });
        }
        if (numSignal === 0) {
          isCloseSignal = true;
          parsedSignal = 'CLOSE';
        } else {
          parsedSignal = numSignal > 0 ? 'BUY' : 'SELL';
        }
      }
    } else {
      console.warn(`❌ Invalid signal type: ${typeof signal}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid signal',
        message: 'signal must be string or number',
        received: signal
      });
    }

    console.log(`✅ Signal parsed: ${parsedSignal}`);

    // Check if strategy is active
    if (!strategy.isActive) {
      console.warn(`❌ Strategy ${strategy.name} is inactive`);
      return res.status(400).json({ 
        success: false, 
        error: 'Strategy inactive',
        message: `Strategy "${strategy.name}" is currently disabled`,
        strategyId: strategy.id,
        strategyName: strategy.name
      });
    }

    // Get trading symbol
    const symbol = customSymbol || strategy.symbol;
    if (!symbol) {
      console.warn(`❌ No symbol for strategy ${strategy.name}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing symbol',
        message: 'Trading symbol is required',
        strategyId: strategy.id,
        strategyName: strategy.name
      });
    }

    // Get all active AND unpaused subscribers for this strategy (including owner)
    const subscriptions = await StrategySubscription.findAll({
      where: {
        strategyId: strategy.id,
        isActive: true,
        isPaused: false  // Only get unpaused subscriptions
      },
      include: [
        {
          model: User,
          as: 'subscriber',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Also include strategy owner if not already a subscriber (owner is never paused)
    const subscriberUserIds = subscriptions.map(sub => sub.userId);
    if (!subscriberUserIds.includes(strategy.userId)) {
      // Add strategy owner as a subscriber
      const owner = await User.findByPk(strategy.userId, {
        attributes: ['id', 'name', 'email']
      });
      
      if (owner) {
        subscriptions.push({
          userId: owner.id,
          strategyId: strategy.id,
          lots: strategy.lots || 1,
          isActive: true,
          isPaused: false,
          tradeMode: strategy.tradeMode || 'paper',
          subscriber: owner,
          isOwner: true  // Flag to identify owner
        });
      }
    }

    if (subscriptions.length === 0) {
      console.warn(`❌ No active subscribers for strategy ${strategy.name}`);
      return res.status(400).json({ 
        success: false, 
        error: 'No active subscribers',
        message: `Strategy "${strategy.name}" has no active subscribers`,
        strategyId: strategy.id
      });
    }

    console.log(`📊 Found ${subscriptions.length} active subscriber(s) for strategy "${strategy.name}"`);

    // Parse market risk configuration
    const marketRisk = strategy.marketRisk || {};
    const {
      stopLossType = 'points',
      stopLossValue = 50,
      takeProfitType = 'points',
      takeProfitValue = 100
    } = marketRisk;

    // Execute trades for all subscribers
    const tradeResults = [];
    const errors = [];
    const paperTrades = [];

    for (const subscription of subscriptions) {
      const userId = subscription.userId;
      const userEmail = subscription.subscriber?.email || 'Unknown';
      const lots = subscription.lots || strategy.lots || 0.01;
      const tradeMode = subscription.tradeMode || 'paper';
      const isPaperMode = tradeMode === 'paper';

      console.log(`🔄 Processing trade for user: ${userEmail} (lots: ${lots}, mode: ${tradeMode})`);

      try {
        // For PAPER mode, create proper paper position with live price and SL/TP
        if (isPaperMode) {
          console.log(`📝 PAPER trade for ${userEmail}: ${parsedSignal} ${lots} ${symbol}`);
          
          // ========== CLOSE OPPOSITE PAPER POSITIONS FIRST ==========
          const existingPaperTrades = await Trade.findAll({
            where: {
              userId,
              symbol: symbol.toUpperCase(),
              status: 'Open',
              broker: 'PAPER'
            }
          });

          console.log(`🔍 [PAPER WEBHOOK] Found ${existingPaperTrades.length} existing open paper trade(s) for ${symbol.toUpperCase()}`);

          for (const existingPaperTrade of existingPaperTrades) {
            const existingType = existingPaperTrade.type;
            const newType = parsedSignal === 'BUY' ? 'Buy' : 'Sell';

            console.log(`🔍 [PAPER WEBHOOK] Existing: ${existingType}, New: ${newType}, Should close: ${existingType !== newType}`);

            if (existingType !== newType) {
              console.log(`🔄 [PAPER WEBHOOK] Closing opposite paper position: ${existingPaperTrade.orderId}`);
              
              try {
                // Close paper position
                const paperPositionId = existingPaperTrade.signalPayload?.paperPositionId;
                if (paperPositionId) {
                  await paperTradingService.closePosition(paperPositionId, existingPaperTrade.currentPrice);
                }

                // Update trade status
                await existingPaperTrade.update({
                  status: 'Completed',
                  closedAt: new Date(),
                  closedReason: 'Opposite signal - Position reversed (paper)'
                });

                emitTradeUpdate(userId, existingPaperTrade, 'update');
                console.log(`✅ [PAPER WEBHOOK] Closed opposite paper position`);
              } catch (closeError) {
                console.error(`❌ [PAPER WEBHOOK] Failed to close opposite paper position:`, closeError.message);
              }
            } else {
              console.log(`ℹ️ [PAPER WEBHOOK] Same direction - keeping existing paper position ${existingPaperTrade.orderId}`);
            }
          }
          
          // ========== NOW OPEN NEW PAPER POSITION ==========
          // Get live price from MT5 (use admin's default connection or cached price)
          let currentPrice = strategy.symbolValue || 100;
          
          try {
            // Try to get live price from MT5
            const adminApiKey = await ApiKey.findOne({
              where: { 
                segment: strategy.segment,
                broker: 'MT5',
                isActive: true
              },
              limit: 1
            });
            
            if (adminApiKey && adminApiKey.accessToken && adminApiKey.appName) {
              const isConnected = await mt5Broker.healthCheck().catch(() => false);
              if (!isConnected) {
                await mt5Broker.initialize({
                  apiKey: adminApiKey.accessToken,
                  accountId: adminApiKey.appName
                });
              }
              const priceData = await mt5Broker.getPrice(symbol.toUpperCase());
              if (priceData && priceData.bid) {
                currentPrice = parsedSignal === 'BUY' ? priceData.ask : priceData.bid;
              }
            }
          } catch (priceError) {
            console.warn(`⚠️ Could not fetch live price for paper trade: ${priceError.message}`);
          }
          
          // Open paper position with proper SL/TP
          const paperResult = await paperTradingService.openPosition({
            userId,
            strategyId: strategy.id,
            symbol: symbol.toUpperCase(),
            market: strategy.segment,
            type: parsedSignal === 'BUY' ? 'Buy' : 'Sell',
            volume: lots,
            openPrice: currentPrice,
            stopLossType,
            stopLossValue,
            takeProfitType,
            takeProfitValue,
            metadata: {
              source: 'TradingView Webhook',
              requestIp: req.ip,
              strategySecret: secret,
              signal: parsedSignal,
              raw: req.body
            }
          });

          if (paperResult.success) {
            console.log(`📝 Paper position opened for ${userEmail}: ${paperResult.orderId} @ ${currentPrice}`);

            // Also log to trades table for history
            const paperTrade = await Trade.create({
              userId,
              orderId: paperResult.orderId,
              market: strategy.segment,
              symbol: symbol.toUpperCase(),
              type: parsedSignal === 'BUY' ? 'Buy' : 'Sell',
              amount: lots,
              price: currentPrice,
              currentPrice: currentPrice,
              status: 'Open',
              date: new Date(),
              broker: 'PAPER',
              brokerType: 'Paper Trading',
              strategyId: strategy.id,
              signalReceivedAt,
              signalPayload: {
                source: 'TradingView Webhook (Paper)',
                requestIp: req.ip,
                strategySecret: secret,
                signal: parsedSignal,
                symbol: symbol.toUpperCase(),
                tradeMode: 'paper',
                paperPositionId: paperResult.position?.id,
                stopLoss: paperResult.stopLoss,
                takeProfit: paperResult.takeProfit,
                raw: req.body
              },
              signalSendStatus: 'Paper',
              filledQuantity: lots,
              avgFillPrice: currentPrice,
              brokerStatus: 'PAPER_OPEN',
              brokerResponse: JSON.stringify({ 
                status: 'PAPER_OPEN', 
                mode: 'paper',
                stopLoss: paperResult.stopLoss,
                takeProfit: paperResult.takeProfit
              }),
              brokerResponseJson: {
                mode: 'paper',
                paperPositionId: paperResult.position?.id,
                stopLoss: paperResult.stopLoss,
                takeProfit: paperResult.takeProfit,
                executionTime: 0,
                timestamp: new Date().toISOString()
              }
            });

            // Emit real-time update
            emitTradeUpdate(userId, paperTrade, 'create');

            // NOTE: No per-trade charge for paper trades - only live trades are charged

            paperTrades.push({
              userId,
              userEmail,
              tradeId: paperTrade.id,
              orderId: paperResult.orderId,
              paperPositionId: paperResult.position?.id,
              volume: lots,
              openPrice: currentPrice,
              stopLoss: paperResult.stopLoss,
              takeProfit: paperResult.takeProfit,
              status: 'open',
              mode: 'paper'
            });
          } else {
            console.error(`❌ Paper position failed for ${userEmail}: ${paperResult.error}`);
            errors.push({
              userId,
              userEmail,
              error: paperResult.error,
              mode: 'paper'
            });
          }
          
          continue; // Skip broker execution for paper trades
        }

        // LIVE mode - Check selected brokers for this strategy/user
        const selectedBrokers = await StrategyBroker.findAll({
          where: {
            strategyId: strategy.id,
            isActive: true
          },
          include: [{
            model: ApiKey,
            as: 'apiKey',
            where: { userId, isActive: true },
            required: true
          }]
        });

        // If no specific brokers selected, fallback to any active broker for this user
        let apiKeysToUse = selectedBrokers.map(sb => sb.apiKey);
        
        if (apiKeysToUse.length === 0) {
          // Fallback: Get user's default MT5 API key
          const defaultApiKey = await ApiKey.findOne({
            where: { 
              userId,
              segment: strategy.segment,
              broker: 'MT5',
              isActive: true
            }
          });
          
          if (defaultApiKey) {
            apiKeysToUse = [defaultApiKey];
          }
        }

        if (apiKeysToUse.length === 0) {
          console.warn(`⚠️  User ${userEmail} has no valid MT5 credentials for LIVE trading - skipping`);
          errors.push({
            userId,
            userEmail,
            error: 'No valid MT5 credentials configured for live trading'
          });
          continue;
        }

        // Execute trade on each selected broker
        for (const apiKey of apiKeysToUse) {
          if (!apiKey.accessToken || !apiKey.appName) {
            console.warn(`⚠️  Skipping incomplete API key for ${userEmail}`);
            continue;
          }

          // Initialize MT5 broker for this user
          try {
            await mt5Broker.initialize({
              apiKey: apiKey.accessToken,
              accountId: apiKey.appName
            });
          } catch (initError) {
            console.error(`❌ MT5 init failed for ${userEmail}:`, initError.message);
            errors.push({
              userId,
              userEmail,
              brokerId: apiKey.id,
              error: `MT5 connection failed: ${initError.message}`
            });
            continue;
          }

          // ========== CLOSE OPPOSITE POSITIONS FIRST ==========
          // Check for existing open positions for this symbol
          const existingOpenTrades = await Trade.findAll({
            where: {
              userId,
              symbol: symbol.toUpperCase(),
              status: 'Open',
              broker: 'MT5'
            }
          });

          console.log(`🔍 [WEBHOOK] Found ${existingOpenTrades.length} existing open MT5 trade(s) for ${symbol.toUpperCase()}`);

          // Close opposite direction positions
          for (const existingTrade of existingOpenTrades) {
            const existingType = existingTrade.type; // 'Buy' or 'Sell'
            const newType = parsedSignal === 'BUY' ? 'Buy' : 'Sell';

            console.log(`🔍 [WEBHOOK] Existing: ${existingType}, New: ${newType}, Should close: ${existingType !== newType}`);

            // If opposite direction, close it
            if (existingType !== newType) {
              console.log(`🔄 [WEBHOOK] Closing opposite position: ${existingTrade.orderId} (${existingType} → ${newType})`);
              
              try {
                // Close on broker
                const closeResult = await mt5Broker.closeTrade(existingTrade.orderId);
                
                // Update database
                await existingTrade.update({
                  status: 'Completed',
                  closedAt: new Date(),
                  closedReason: 'Opposite signal - Position reversed',
                  currentPrice: closeResult.closePrice || existingTrade.currentPrice || existingTrade.price,
                  profit: closeResult.profit || 0,
                  profitPercent: closeResult.profitPercent || 0
                });

                // Emit update
                emitTradeUpdate(userId, existingTrade, 'update');
                
                console.log(`✅ [WEBHOOK] Closed opposite position ${existingTrade.orderId}`);
              } catch (closeError) {
                console.error(`❌ [WEBHOOK] Failed to close opposite position ${existingTrade.orderId}:`, closeError.message);
                // Continue anyway to open new position
              }
            } else {
              console.log(`ℹ️ [WEBHOOK] Same direction - keeping existing position ${existingTrade.orderId}`);
            }
          }

          // ========== NOW PLACE NEW TRADE ==========
          // Prepare trade parameters
          const tradeParams = {
            symbol: symbol.toUpperCase(),
            type: parsedSignal,
            volume: lots,
            stopLoss: {
              type: stopLossType,
              value: stopLossValue
            },
            takeProfit: {
              type: takeProfitType,
              value: takeProfitValue
            },
            comment: `TradingView: ${strategy.name} (${strategy.id})`
          };

          // Execute trade
          const tradeResult = await mt5Broker.placeTrade(tradeParams);

          // Save trade to database
          const trade = await Trade.create({
            userId,
            orderId: tradeResult.brokerOrderId || tradeResult.orderId,
            market: strategy.segment,
            symbol: symbol.toUpperCase(),
            type: parsedSignal === 'BUY' ? 'Buy' : 'Sell',
            amount: tradeResult.volume,
            price: tradeResult.openPrice,
            currentPrice: tradeResult.openPrice,
            status: tradeResult.status === 'FILLED' ? 'Open' : 'Pending',
            date: new Date(),
            broker: 'MT5',
            brokerType: apiKey.broker,
            strategyId: strategy.id,
            signalReceivedAt,
            signalPayload: {
              source: 'TradingView Webhook (Live)',
              requestIp: req.ip,
              strategySecret: secret,
              signal: parsedSignal,
              symbol: symbol.toUpperCase(),
              tradeMode: 'live',
              brokerId: apiKey.id,
              raw: req.body
            },
            signalSendStatus: 'Sent',
            filledQuantity: tradeResult.volume,
            avgFillPrice: tradeResult.openPrice,
            brokerStatus: tradeResult.status || 'UNKNOWN',
            brokerResponse: JSON.stringify({ status: tradeResult.status }),
            brokerResponseJson: {
              ...tradeResult.brokerResponse,
              executionTime: tradeResult.executionTime,
              timestamp: new Date().toISOString()
            }
          });

          console.log(`✅ LIVE Trade executed for ${userEmail}: ${trade.orderId} - ${parsedSignal} ${lots} ${symbol} @ ${tradeResult.openPrice}`);

          // Emit real-time update
          emitTradeUpdate(userId, trade, 'create');

          // Process per-trade charge for subscriber (owner is exempt)
          const chargeResult = await processPerTradeChargeForSubscriber({
            subscriberId: userId,
            ownerId: strategy.userId,
            strategyId: strategy.id,
            strategyName: strategy.name,
            tradeId: trade.id
          });
          
          if (chargeResult.success && !chargeResult.skipped) {
            console.log(`💰 Per-trade charge processed for live trade: ₹${chargeResult.chargeAmount}`);
          }

          tradeResults.push({
            userId,
            userEmail,
            tradeId: trade.id,
            orderId: trade.orderId,
            brokerId: apiKey.id,
            volume: lots,
            openPrice: tradeResult.openPrice,
            status: 'success',
            mode: 'live',
            chargeDeducted: chargeResult.success && !chargeResult.skipped ? chargeResult.chargeAmount : 0
          });
        }

      } catch (error) {
        console.error(`❌ Trade failed for ${userEmail}:`, error.message);
        errors.push({
          userId,
          userEmail,
          error: error.message
        });
      }
    }

    // Send response
    const successCount = tradeResults.length + paperTrades.length;
    const failCount = errors.length;
    const totalCount = subscriptions.length;

    // ========== CREATE SIGNAL LOG ENTRY ==========
    try {
      const signalValue = isCloseSignal ? 0 : (parsedSignal === 'BUY' ? 1 : -1);
      
      await SignalLog.create({
        strategyId: strategy.id,
        segment: strategy.segment,
        canonicalSymbol: symbol.toUpperCase(),
        signal: signalValue,
        signalId: `${strategy.id}-${Date.now()}`,
        payloadHash: null,
        payload: JSON.stringify(req.body),
        source: 'webhook',
        usersNotified: totalCount,
        tradesExecuted: successCount,
        success: successCount > 0,
        errorMessage: errors.length > 0 ? JSON.stringify(errors) : null,
        receivedAt: signalReceivedAt
      });

      console.log(`📝 Signal log created for strategy ${strategy.name}: ${parsedSignal} signal to ${totalCount} users`);
    } catch (logError) {
      console.error('❌ Failed to create signal log:', logError);
      // Don't fail the entire request if logging fails
    }
    // ==========================================

    res.status(successCount > 0 ? 201 : 500).json({
      success: successCount > 0,
      message: `${successCount}/${totalCount} trades processed (${tradeResults.length} live, ${paperTrades.length} paper)`,
      webhook: {
        signal: parsedSignal,
        receivedAt: signalReceivedAt.toISOString(),
        source: 'TradingView'
      },
      strategy: {
        id: strategy.id,
        name: strategy.name,
        segment: strategy.segment,
        symbol: symbol.toUpperCase()
      },
      execution: {
        total: totalCount,
        successful: successCount,
        failed: failCount
      },
      trades: tradeResults,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Webhook processing failed',
      message: 'An unexpected error occurred while processing the webhook',
      details: error.message,
      timestamp: new Date().toISOString(),
      solution: 'Check webhook payload format and try again'
    });
  }
};
