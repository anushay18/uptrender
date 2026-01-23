import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationData, PaperPositionUpdate, StrategyUpdate, TradeUpdate, WalletUpdate, WS_EVENTS, wsService } from '../services/websocket';

// Hook for WebSocket connection status
export function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(wsService.isConnected());

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    wsService.on(WS_EVENTS.CONNECTED, handleConnect);
    wsService.on(WS_EVENTS.DISCONNECTED, handleDisconnect);

    return () => {
      wsService.off(WS_EVENTS.CONNECTED, handleConnect);
      wsService.off(WS_EVENTS.DISCONNECTED, handleDisconnect);
    };
  }, []);

  const connect = useCallback(() => {
    wsService.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsService.disconnect();
  }, []);

  return { isConnected, connect, disconnect };
}

// Hook for trade updates
export function useTradeUpdates(onUpdate?: (data: TradeUpdate) => void) {
  const [lastUpdate, setLastUpdate] = useState<TradeUpdate | null>(null);

  useEffect(() => {
    wsService.subscribeTrades();

    const handleUpdate = (data: TradeUpdate) => {
      setLastUpdate(data);
      onUpdate?.(data);
    };

    wsService.on(WS_EVENTS.TRADE_UPDATE, handleUpdate);

    return () => {
      wsService.off(WS_EVENTS.TRADE_UPDATE, handleUpdate);
    };
  }, [onUpdate]);

  return lastUpdate;
}

// Hook for strategy updates
export function useStrategyUpdates(onUpdate?: (data: StrategyUpdate) => void) {
  const [lastUpdate, setLastUpdate] = useState<StrategyUpdate | null>(null);

  useEffect(() => {
    wsService.subscribeStrategies();

    const handleUpdate = (data: StrategyUpdate) => {
      setLastUpdate(data);
      onUpdate?.(data);
    };

    wsService.on(WS_EVENTS.STRATEGY_UPDATE, handleUpdate);

    return () => {
      wsService.off(WS_EVENTS.STRATEGY_UPDATE, handleUpdate);
    };
  }, [onUpdate]);

  return lastUpdate;
}

// Hook for wallet updates
export function useWalletUpdates(onUpdate?: (data: WalletUpdate) => void) {
  const [balance, setBalance] = useState<number | null>(null);
  const [lastTransaction, setLastTransaction] = useState<any>(null);

  useEffect(() => {
    wsService.subscribeWallet();

    const handleUpdate = (data: WalletUpdate) => {
      setBalance(data.balance);
      if (data.transaction) {
        setLastTransaction(data.transaction);
      }
      onUpdate?.(data);
    };

    wsService.on(WS_EVENTS.WALLET_UPDATE, handleUpdate);

    return () => {
      wsService.off(WS_EVENTS.WALLET_UPDATE, handleUpdate);
    };
  }, [onUpdate]);

  return { balance, lastTransaction };
}

// Hook for notifications
export function useNotifications(onNewNotification?: (data: NotificationData) => void) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleNotification = (data: NotificationData) => {
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);
      onNewNotification?.(data);
    };

    wsService.on(WS_EVENTS.NOTIFICATION, handleNotification);

    return () => {
      wsService.off(WS_EVENTS.NOTIFICATION, handleNotification);
    };
  }, [onNewNotification]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, clearNotifications, markAsRead };
}

// Hook for paper position updates (real-time MTM)
export function usePaperPositionUpdates(onUpdate?: (data: PaperPositionUpdate) => void) {
  const [positions, setPositions] = useState<Map<number, any>>(new Map());
  const onUpdateRef = useRef(onUpdate);
  
  // Keep the ref up to date with the latest callback
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    console.log('🔌 [Hook] usePaperPositionUpdates effect mounted');
    
    // Ensure subscriptions are active. If socket is not yet connected,
    // subscribe once connection is established to avoid missed events.
    const ensureSubscriptions = () => {
      const isConnected = wsService.isConnected();
      console.log('🔌 [Hook] ensureSubscriptions called, wsService.isConnected:', isConnected);
      if (isConnected) {
        console.log('✅ [Hook] Socket connected, subscribing to paper_prices and paper_mtm');
        wsService.subscribePaperPrices();
        wsService.subscribePaperMTM();
      } else {
        console.log('⚠️ [Hook] Socket NOT connected, subscriptions will happen after connection');
      }
    };

    // Try immediately (in case already connected)
    ensureSubscriptions();
    
    // Also subscribe when connection establishes
    const handleConnected = () => {
      console.log('✅ [Hook] WebSocket CONNECTED event received, re-subscribing...');
      ensureSubscriptions();
    };
    wsService.on(WS_EVENTS.CONNECTED, handleConnected);
    
    // CRITICAL: If socket is already connected when hook mounts but we missed the event,
    // we need to ensure we're subscribed. Check again after a short delay.
    const delayedCheck = setTimeout(() => {
      const isConnected = wsService.isConnected();
      console.log('🔌 [Hook] Delayed check (1s): socket connected:', isConnected);
      if (isConnected) {
        console.log('✅ [Hook] Delayed check: socket connected, ensuring subscriptions');
        ensureSubscriptions();
      }
    }, 1000);

    const handlePositionUpdate = (data: any) => {
      console.log('🔔 [Hook] RAW position update received:', JSON.stringify(data, null, 2));
      
      // Map backend action to frontend type
      // Backend sends: action = 'open', 'close', 'modify', 'mtm', 'sl_hit', 'tp_hit'
      // Frontend expects: type = 'opened', 'closed', 'modified', 'mtm_update', 'sl_hit', 'tp_hit'
      const actionToTypeMap: { [key: string]: string } = {
        'open': 'opened',
        'close': 'closed',
        'modify': 'modified',
        'mtm': 'mtm_update',
        'update': 'mtm_update',
        'sl_hit': 'sl_hit',
        'tp_hit': 'tp_hit',
        'create': 'opened',
      };
      
      const action = data.action || data.type;
      const type = actionToTypeMap[action] || action || 'mtm_update';
      
      console.log('🔔 [Hook] Position update mapped: action:', action, '-> type:', type, 'positionId:', data.position?.id, 'currentPrice:', data.position?.currentPrice, 'profit:', data.position?.profit);
      
      const normalizedData: PaperPositionUpdate = {
        type: type as any,
        position: {
          ...data.position,
          id: data.position?.id !== undefined ? Number(data.position.id) : data.position?.id,
        },
      };
      
      console.log('✅ [Hook] Normalized data:', JSON.stringify(normalizedData, null, 2));
      
      setPositions(prev => {
        const newMap = new Map(prev);
        const posId = data.position?.id !== undefined ? Number(data.position.id) : data.position?.id;
        if (type === 'closed' || type === 'sl_hit' || type === 'tp_hit') {
          newMap.delete(posId);
        } else if (posId !== undefined) {
          newMap.set(posId, { ...data.position, id: posId });
        }
        return newMap;
      });
      onUpdateRef.current?.(normalizedData);
    };

    const handleMTMUpdate = (data: any) => {
      console.log('💹 [Hook] RAW MTM update received:', JSON.stringify(data, null, 2));
      
      setPositions(prev => {
        const newMap = new Map(prev);
        let updatedCount = 0;

        // Support both shapes: { positions: [...] } and single update with positionId
        if (data && Array.isArray(data.positions)) {
          console.log(`💹 [Hook] Processing batch MTM update for ${data.positions.length} positions`);
          data.positions.forEach(pos => {
            const pid = pos.id !== undefined ? Number(pos.id) : pos.id;
            const existing = newMap.get(pid);
            if (existing) {
              const oldPrice = existing.currentPrice;
              const newPrice = pos.currentPrice;
              newMap.set(pid, {
                ...existing,
                currentPrice: pos.currentPrice,
                profit: pos.profit,
                profitPercent: pos.profitPercent,
              });
              updatedCount++;
              if (oldPrice !== newPrice) {
                console.log(`✨ [Hook] Position ${pid} price changed: ${oldPrice} -> ${newPrice}`);
              }
            } else {
              console.log(`⚠️ [Hook] Position ${pid} not found in map`);
            }
          });
          console.log(`✅ [Hook] Batch MTM update complete: ${updatedCount} positions updated`);
        } else if (data && (data.positionId || (data.position && data.position.id))) {
          console.log('💹 [Hook] Processing single MTM update');
          const idRaw = data.positionId ?? data.position?.id;
          const id = idRaw !== undefined ? Number(idRaw) : idRaw;
          const existing = newMap.get(id);
          if (existing) {
            const oldPrice = existing.currentPrice;
            const newPrice = data.currentPrice ?? data.position?.currentPrice ?? existing.currentPrice;
            newMap.set(id, {
              ...existing,
              currentPrice: newPrice,
              profit: data.profit ?? data.position?.profit ?? existing.profit,
              profitPercent: data.profitPercent ?? data.position?.profitPercent ?? existing.profitPercent,
            });
            if (oldPrice !== newPrice) {
              console.log(`✨ [Hook] Single position ${id} price changed: ${oldPrice} -> ${newPrice}`);
            }
          } else {
            console.log(`⚠️ [Hook] Position ${id} not found in map`);
          }
        } else {
          console.log('⚠️ [Hook] MTM update data format not recognized:', data);
        }

        return newMap;
      });
    };

    wsService.on(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
    wsService.on(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);

    return () => {
      clearTimeout(delayedCheck);
      wsService.off(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
      wsService.off(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);
      wsService.off(WS_EVENTS.CONNECTED, handleConnected);
    };
  }, []); // Empty dependency array - effect runs once, callback ref handles updates

  return Array.from(positions.values());
}

// Hook for real-time price updates
export function usePriceUpdates(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (symbols.length === 0) return;

    const handlePriceUpdate = (data: { symbol: string; price: number }) => {
      if (symbols.includes(data.symbol)) {
        setPrices(prev => {
          const newMap = new Map(prev);
          newMap.set(data.symbol, data.price);
          return newMap;
        });
      }
    };

    wsService.on(WS_EVENTS.PRICE_UPDATE, handlePriceUpdate);

    return () => {
      wsService.off(WS_EVENTS.PRICE_UPDATE, handlePriceUpdate);
    };
  }, [symbols]);

  const getPrice = useCallback((symbol: string) => prices.get(symbol), [prices]);

  return { prices: Object.fromEntries(prices), getPrice };
}

// Hook for dashboard updates
export function useDashboardUpdates(onUpdate?: (data: any) => void) {
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    wsService.subscribeDashboard();

    const handleUpdate = (data: any) => {
      setDashboardData(data);
      onUpdate?.(data);
    };

    wsService.on(WS_EVENTS.DASHBOARD_UPDATE, handleUpdate);

    return () => {
      wsService.off(WS_EVENTS.DASHBOARD_UPDATE, handleUpdate);
    };
  }, [onUpdate]);

  return dashboardData;
}

// Hook for support ticket updates
export function useSupportUpdates(ticketId?: number, onUpdate?: (data: any) => void) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ticketId) {
      wsService.subscribeSupport(ticketId);
    }

    const handleUpdate = (data: any) => {
      if (data.ticketId === ticketId || !ticketId) {
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
        onUpdate?.(data);
      }
    };

    const handleTyping = (data: { ticketId: number; userId: number }) => {
      if (data.ticketId === ticketId) {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    };

    wsService.on(WS_EVENTS.SUPPORT_UPDATE, handleUpdate);
    wsService.on(WS_EVENTS.SUPPORT_USER_TYPING, handleTyping);

    return () => {
      wsService.off(WS_EVENTS.SUPPORT_UPDATE, handleUpdate);
      wsService.off(WS_EVENTS.SUPPORT_USER_TYPING, handleTyping);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [ticketId, onUpdate]);

  const sendTypingIndicator = useCallback(() => {
    if (ticketId) {
      wsService.sendTypingIndicator(ticketId);
    }
  }, [ticketId]);

  return { messages, isTyping, sendTypingIndicator };
}

// Combined hook for all real-time data
export function useRealTimeData() {
  const connection = useWebSocketConnection();
  const notifications = useNotifications();
  const wallet = useWalletUpdates();
  const dashboard = useDashboardUpdates();

  return {
    ...connection,
    notifications,
    wallet,
    dashboard,
  };
}
