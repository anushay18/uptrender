import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationData, PaperPositionUpdate, PriceMTMUpdate, StrategyUpdate, TradeUpdate, WalletUpdate, WS_EVENTS, wsService } from '../services/websocket';

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

  useEffect(() => {
    wsService.subscribePaperPrices();
    wsService.subscribePaperMTM();

    const handlePositionUpdate = (data: PaperPositionUpdate) => {
      setPositions(prev => {
        const newMap = new Map(prev);
        if (data.type === 'closed') {
          newMap.delete(data.position.id);
        } else {
          newMap.set(data.position.id, data.position);
        }
        return newMap;
      });
      onUpdate?.(data);
    };

    const handleMTMUpdate = (data: PriceMTMUpdate) => {
      setPositions(prev => {
        const newMap = new Map(prev);
        data.positions.forEach(pos => {
          const existing = newMap.get(pos.id);
          if (existing) {
            newMap.set(pos.id, {
              ...existing,
              currentPrice: pos.currentPrice,
              profit: pos.profit,
              profitPercent: pos.profitPercent,
            });
          }
        });
        return newMap;
      });
    };

    wsService.on(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
    wsService.on(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);

    return () => {
      wsService.off(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
      wsService.off(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);
    };
  }, [onUpdate]);

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
