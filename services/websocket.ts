import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from './config';
import { secureStorage, STORAGE_KEYS } from './storage';

// Simple EventEmitter for React Native
class EventEmitter {
  private events: { [key: string]: Array<(...args: any[]) => void> } = {};
  private maxListeners = 10;

  setMaxListeners(n: number): void {
    this.maxListeners = n;
  }

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}

// WebSocket Events
export const WS_EVENTS = {
  // Connection
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnect',
  ERROR: 'error',
  RECONNECT: 'reconnect',
  
  // Subscribe events (client -> server)
  SUBSCRIBE_TRADES: 'subscribe:trades',
  SUBSCRIBE_STRATEGIES: 'subscribe:strategies',
  SUBSCRIBE_WALLET: 'subscribe:wallet',
  SUBSCRIBE_SUPPORT: 'subscribe:support',
  SUBSCRIBE_DASHBOARD: 'subscribe:dashboard',
  SUBSCRIBE_PAPER_PRICES: 'subscribe:paper_prices',
  SUBSCRIBE_PAPER_MTM: 'subscribe:paper_mtm',
  JOIN_ROOM: 'join:room',
  LEAVE_ROOM: 'leave:room',
  
  // Update events (server -> client)
  TRADE_UPDATE: 'trade:update',
  STRATEGY_UPDATE: 'strategy:update',
  WALLET_UPDATE: 'wallet:update',
  NOTIFICATION: 'notification:new',
  SUPPORT_UPDATE: 'support:update',
  DASHBOARD_UPDATE: 'dashboard:update',
  PAPER_POSITION_UPDATE: 'paper_position:update',
  PAPER_MTM_UPDATE: 'paper:mtm_update',
  PRICE_UPDATE: 'price:update',
  
  // Typing indicators
  SUPPORT_TYPING: 'support:typing',
  SUPPORT_USER_TYPING: 'support:user_typing',
  
  // Health check
  PING: 'ping',
  PONG: 'pong',
};

export type TradeUpdateType = 'created' | 'updated' | 'closed' | 'deleted';
export type PositionUpdateType = 'opened' | 'closed' | 'modified' | 'mtm_update' | 'sl_hit' | 'tp_hit';

export interface TradeUpdate {
  type: TradeUpdateType;
  trade: any;
}

export interface StrategyUpdate {
  type: string;
  strategy: any;
}

export interface WalletUpdate {
  balance: number;
  transaction?: any;
}

export interface NotificationData {
  id: number;
  type: string;
  title: string;
  message: string;
  metadata?: any;
}

export interface PaperPositionUpdate {
  type: PositionUpdateType;
  position: any;
}

export interface PriceMTMUpdate {
  positions: Array<{
    id: number;
    currentPrice: number;
    profit: number;
    profitPercent: number;
  }>;
}

class WebSocketService extends EventEmitter {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const token = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      if (!token) {
        console.log('No auth token available for WebSocket connection');
        this.isConnecting = false;
        return;
      }

      this.socket = io(API_CONFIG.WS_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 20000,
      });

      this.setupEventListeners();
      this.isConnecting = false;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.emit(WS_EVENTS.CONNECTED);
    });

    this.socket.on('connected', (data: { userId: number; socketId: string }) => {
      console.log('Server confirmed connection:', data);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('WebSocket disconnected:', reason);
      this.stopPingInterval();
      this.emit(WS_EVENTS.DISCONNECTED, reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error);
      this.emit(WS_EVENTS.ERROR, error);
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.emit(WS_EVENTS.RECONNECT, attemptNumber);
    });

    // Trade updates
    this.socket.on(WS_EVENTS.TRADE_UPDATE, (data: TradeUpdate) => {
      this.emit(WS_EVENTS.TRADE_UPDATE, data);
    });

    // Strategy updates
    this.socket.on(WS_EVENTS.STRATEGY_UPDATE, (data: StrategyUpdate) => {
      this.emit(WS_EVENTS.STRATEGY_UPDATE, data);
    });

    // Wallet updates
    this.socket.on(WS_EVENTS.WALLET_UPDATE, (data: WalletUpdate) => {
      this.emit(WS_EVENTS.WALLET_UPDATE, data);
    });

    // Notifications
    this.socket.on(WS_EVENTS.NOTIFICATION, (data: NotificationData) => {
      this.emit(WS_EVENTS.NOTIFICATION, data);
    });

    // Support updates
    this.socket.on(WS_EVENTS.SUPPORT_UPDATE, (data: any) => {
      this.emit(WS_EVENTS.SUPPORT_UPDATE, data);
    });

    // Dashboard updates
    this.socket.on(WS_EVENTS.DASHBOARD_UPDATE, (data: any) => {
      this.emit(WS_EVENTS.DASHBOARD_UPDATE, data);
    });

    // Paper position updates
    this.socket.on(WS_EVENTS.PAPER_POSITION_UPDATE, (data: PaperPositionUpdate) => {
      this.emit(WS_EVENTS.PAPER_POSITION_UPDATE, data);
    });

    // Paper MTM updates
    this.socket.on(WS_EVENTS.PAPER_MTM_UPDATE, (data: PriceMTMUpdate) => {
      this.emit(WS_EVENTS.PAPER_MTM_UPDATE, data);
    });

    // Price updates
    this.socket.on(WS_EVENTS.PRICE_UPDATE, (data: any) => {
      this.emit(WS_EVENTS.PRICE_UPDATE, data);
    });

    // Typing indicators
    this.socket.on(WS_EVENTS.SUPPORT_USER_TYPING, (data: any) => {
      this.emit(WS_EVENTS.SUPPORT_USER_TYPING, data);
    });

    // Pong response
    this.socket.on('pong', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp;
      this.emit(WS_EVENTS.PONG, { latency });
    });

    // Subscription confirmations
    this.socket.on('subscribed', (data: { room: string }) => {
      console.log('Subscribed to room:', data.room);
    });
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Subscribe methods
  subscribeTrades(): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_TRADES);
  }

  subscribeStrategies(): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_STRATEGIES);
  }

  subscribeWallet(): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_WALLET);
  }

  subscribeSupport(ticketId: number): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_SUPPORT, { ticketId });
  }

  subscribeDashboard(): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_DASHBOARD);
  }

  subscribePaperPrices(): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_PAPER_PRICES);
  }

  subscribePaperMTM(): void {
    this.socket?.emit(WS_EVENTS.SUBSCRIBE_PAPER_MTM);
  }

  // Typing indicator
  sendTypingIndicator(ticketId: number): void {
    this.socket?.emit(WS_EVENTS.SUPPORT_TYPING, { ticketId });
  }

  // Join/Leave custom rooms
  joinRoom(room: string): void {
    this.socket?.emit(WS_EVENTS.JOIN_ROOM, { room });
  }

  leaveRoom(room: string): void {
    this.socket?.emit(WS_EVENTS.LEAVE_ROOM, { room });
  }

  disconnect(): void {
    this.stopPingInterval();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.removeAllListeners();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
export default wsService;
