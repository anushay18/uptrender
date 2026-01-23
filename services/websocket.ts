import { API_CONFIG, STORAGE_KEYS } from './config';
import { secureStorage } from './storage';

/**
 * WebSocket Service for Real-time Updates
 * Connects to backend with automatic reconnection and HTTP polling fallback
 * 
 * Similar architecture to previous working project:
 * - Native WebSocket connection
 * - Exponential backoff reconnection with jitter
 * - Heartbeat/ping mechanism
 * - HTTP polling fallback when WebSocket unavailable
 */

// WebSocket message type
export type WebSocketMessage = {
  type: string;
  data?: unknown;
  timestamp?: number;
};

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

type WebSocketListener = (message: WebSocketMessage) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Number.POSITIVE_INFINITY;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private generalListeners: Set<WebSocketListener> = new Set();
  private isConnecting = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private authToken: string | null = null;
  private intentionalDisconnect = false;
  
  // HTTP Polling fallback
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private isPollingMode = false;
  private pollingDelay = 5000;
  private lastPollData: { [key: string]: any } = {};

  // Production WebSocket URL
  private readonly PRODUCTION_WS_URL = 'wss://app.uptrender.in/ws';

  constructor() {
    console.log('[WebSocket] Service initialized');
  }

  /**
   * Get WebSocket URL - converts http/https to ws/wss
   */
  private getWebSocketUrl(): string {
    const baseUrl = API_CONFIG.WS_URL || API_CONFIG.BASE_URL;
    
    // Convert http/https to ws/wss
    let wsUrl = baseUrl.replace(/^http/, 'ws');
    
    // Ensure /ws path for WebSocket endpoint
    if (!wsUrl.endsWith('/ws')) {
      wsUrl = wsUrl.replace(/\/$/, '') + '/ws';
    }
    
    console.log('[WebSocket] Using URL:', wsUrl);
    return wsUrl;
  }

  /**
   * Set authentication token
   */
  async setAuthToken(token: string | null): Promise<void> {
    this.authToken = token;
    // If already connected, send auth message
    if (this.socket?.readyState === WebSocket.OPEN && token) {
      this.send({ type: 'authenticate', token });
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    console.log('[WebSocket] connect() called, readyState:', this.socket?.readyState, 'isConnecting:', this.isConnecting);
    
    // If already in polling mode, ensure polling is running
    if (this.isPollingMode) {
      console.log('[WebSocket] Already in polling mode');
      this.startPolling();
      return;
    }

    if (this.isConnecting || this.socket?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    // Reset intentional disconnect flag
    this.intentionalDisconnect = false;
    this.isConnecting = true;

    try {
      // Get auth token
      if (!this.authToken) {
        this.authToken = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      }

      if (!this.authToken) {
        console.log('[WebSocket] No auth token available');
        this.isConnecting = false;
        return;
      }

      const url = this.getWebSocketUrl();
      
      // Add token as query param for initial auth
      const urlWithToken = `${url}?token=${encodeURIComponent(this.authToken)}`;

      console.log('[WebSocket] Connecting to:', url);

      this.socket = new WebSocket(urlWithToken);

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.socket?.readyState !== WebSocket.OPEN) {
          console.log('[WebSocket] Connection timeout, switching to polling');
          this.socket?.close();
          this.switchToPollingMode();
        }
      }, 10000);

      this.socket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[WebSocket] ✅ Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Send authentication
        if (this.authToken) {
          this.send({ type: 'authenticate', token: this.authToken });
        }

        // Start heartbeat
        this.startHeartbeat();

        // Notify listeners
        this.emit(WS_EVENTS.CONNECTED, { url });
        this.notifyGeneralListeners({ type: WS_EVENTS.CONNECTED, data: { url } });
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          // Log non-ping/pong messages
          if (message.type !== 'pong' && message.type !== 'ping') {
            console.log('[WebSocket] 📨 Received:', message.type);
          }
          
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.socket.onerror = (evt) => {
        try {
          const e: any = evt;
          const safe = {
            message: e?.message ?? undefined,
            type: e?._type ?? e?.type ?? undefined,
            url: e?.target?.url ?? e?.currentTarget?.url ?? undefined,
          };

            // Redact token from URL if present
            const redactUrl = (u?: string) => {
              if (!u) return u;
              try {
                return u.replace(/([?&]token=)[^&]+/, '$1<redacted>');
              } catch {
                return u;
              }
            };

            const safeForLog = {
              message: safe.message,
              type: safe.type,
              url: redactUrl(safe.url),
            };

            // Detailed logging only in development; use console.log to avoid platform-specific console.error issues
            // @ts-ignore - __DEV__ is a RN global
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              try {
                const s = JSON.stringify(safeForLog);
                try { console.log('[WebSocket] Error event:', s); } catch {}
              } catch (stringifyErr) {
                try { console.log('[WebSocket] Error event (fallback):', safeForLog.message || safeForLog.type || safeForLog.url); } catch {}
              }
            } else {
              // Minimal production-safe log
              try { console.log('[WebSocket] WebSocket connection error'); } catch {}
            }
        } catch (logErr) {
          try {
            console.log('[WebSocket] Error (unserializable):', String(evt));
          } catch {}
        }

        this.isConnecting = false;
        this.emit(WS_EVENTS.ERROR, { error: 'WebSocket connection error' });
        this.notifyGeneralListeners({ type: WS_EVENTS.ERROR, data: { message: 'WebSocket connection error' } });
      };

      this.socket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        
        this.emit(WS_EVENTS.DISCONNECTED, { code: event.code, reason: event.reason });
        this.notifyGeneralListeners({ type: WS_EVENTS.DISCONNECTED, data: { code: event.code, reason: event.reason } });

        // Only reconnect if not intentional
        if (!this.intentionalDisconnect) {
          this.attemptReconnect();
        } else {
          console.log('[WebSocket] Intentional disconnect, not reconnecting');
        }
      };

    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    const { type, data } = message;

    switch (type) {
      case 'connected':
        console.log('[WebSocket] Server confirmed connection');
        break;

      case 'pong':
        // Heartbeat acknowledged
        break;

      case WS_EVENTS.TRADE_UPDATE:
        this.emit(WS_EVENTS.TRADE_UPDATE, data);
        break;

      case WS_EVENTS.STRATEGY_UPDATE:
        this.emit(WS_EVENTS.STRATEGY_UPDATE, data);
        break;

      case WS_EVENTS.WALLET_UPDATE:
        this.emit(WS_EVENTS.WALLET_UPDATE, data);
        break;

      case WS_EVENTS.NOTIFICATION:
      case 'notification':
        this.emit(WS_EVENTS.NOTIFICATION, data);
        break;

      case WS_EVENTS.SUPPORT_UPDATE:
        this.emit(WS_EVENTS.SUPPORT_UPDATE, data);
        break;

      case WS_EVENTS.DASHBOARD_UPDATE:
        this.emit(WS_EVENTS.DASHBOARD_UPDATE, data);
        break;

      case WS_EVENTS.PAPER_POSITION_UPDATE:
        this.emit(WS_EVENTS.PAPER_POSITION_UPDATE, data);
        break;

      case WS_EVENTS.PAPER_MTM_UPDATE:
        this.emit(WS_EVENTS.PAPER_MTM_UPDATE, data);
        break;

      case WS_EVENTS.PRICE_UPDATE:
        this.emit(WS_EVENTS.PRICE_UPDATE, data);
        break;

      case WS_EVENTS.SUPPORT_USER_TYPING:
        this.emit(WS_EVENTS.SUPPORT_USER_TYPING, data);
        break;

      case 'subscribed':
        console.log('[WebSocket] Subscribed to:', data);
        break;

      case 'error':
        console.error('[WebSocket] Server error:', data);
        this.emit(WS_EVENTS.ERROR, data);
        break;

      default:
        // Forward unknown messages to general listeners
        console.log('[WebSocket] Unknown message type:', type);
    }

    // Always notify general listeners
    this.notifyGeneralListeners(message);
  }

  /**
   * Switch to HTTP polling mode when WebSocket fails
   */
  private switchToPollingMode(): void {
    console.log('[WebSocket] 🔄 Switching to HTTP polling mode');
    this.isPollingMode = true;
    this.isConnecting = false;
    
    // Close socket if exists
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // Ignore
      }
      this.socket = null;
    }
    
    // Start polling
    this.startPolling();
    
    // Emit connected event so app works normally
    this.emit(WS_EVENTS.CONNECTED);
    this.notifyGeneralListeners({ type: WS_EVENTS.CONNECTED, data: { mode: 'polling' } });
    
    console.log('[WebSocket] ✅ HTTP polling mode activated');
  }

  /**
   * Start HTTP polling for updates
   */
  private async startPolling(): Promise<void> {
    if (this.pollingInterval) {
      return;
    }

    console.log('[WebSocket] Starting HTTP polling, interval:', this.pollingDelay, 'ms');
    
    // Initial poll
    await this.pollForUpdates();
    
    // Set up interval
    this.pollingInterval = setInterval(async () => {
      await this.pollForUpdates();
    }, this.pollingDelay);
  }

  /**
   * Stop HTTP polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[WebSocket] HTTP polling stopped');
    }
  }

  /**
   * Poll backend APIs for updates
   */
  private async pollForUpdates(): Promise<void> {
    try {
      const token = this.authToken || await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Poll dashboard
      try {
        const res = await fetch(`${API_CONFIG.API_URL}/dashboard`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (JSON.stringify(data) !== JSON.stringify(this.lastPollData.dashboard)) {
            this.lastPollData.dashboard = data;
            this.emit(WS_EVENTS.DASHBOARD_UPDATE, data);
            this.notifyGeneralListeners({ type: WS_EVENTS.DASHBOARD_UPDATE, data });
          }
        }
      } catch (e) { /* Silent fail */ }

      // Poll wallet
      try {
        const res = await fetch(`${API_CONFIG.API_URL}/wallet`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (JSON.stringify(data) !== JSON.stringify(this.lastPollData.wallet)) {
            this.lastPollData.wallet = data;
            this.emit(WS_EVENTS.WALLET_UPDATE, { balance: data.balance });
            this.notifyGeneralListeners({ type: WS_EVENTS.WALLET_UPDATE, data: { balance: data.balance } });
          }
        }
      } catch (e) { /* Silent fail */ }

      // Poll paper positions
      try {
        const res = await fetch(`${API_CONFIG.API_URL}/paper-positions`, { headers });
        if (res.ok) {
          const data = await res.json();

          // Normalize positions array from multiple possible response shapes
          let positionsArray: any[] | null = null;
          if (Array.isArray(data)) {
            positionsArray = data;
          } else if (Array.isArray(data.positions)) {
            positionsArray = data.positions;
          } else if (Array.isArray(data.data)) {
            positionsArray = data.data;
          }

          // Only proceed if we have positions
          if (positionsArray && JSON.stringify(positionsArray) !== JSON.stringify(this.lastPollData.positions)) {
            this.lastPollData.positions = positionsArray;
            positionsArray.forEach((pos: any) => {
              // Normalize position fields if backend uses different keys
              const normalized = {
                ...pos,
                id: pos.id ?? pos.positionId ?? pos.position_id,
                currentPrice: pos.currentPrice ?? pos.current_price ?? pos.ltp ?? pos.lastPrice ?? pos.last,
                profit: pos.profit ?? pos.pnl ?? pos.unrealizedPnl ?? pos.unrealized_pnl,
                profitPercent: pos.profitPercent ?? pos.profit_percent ?? pos.pnlPercentage,
              };
              this.emit(WS_EVENTS.PAPER_POSITION_UPDATE, { type: 'mtm_update', position: normalized });
            });
          }
        }
      } catch (e) { /* Silent fail */ }

      // Poll notifications
      try {
        const res = await fetch(`${API_CONFIG.API_URL}/notifications?limit=5`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (JSON.stringify(data) !== JSON.stringify(this.lastPollData.notifications)) {
            const oldNotifs = this.lastPollData.notifications?.notifications || [];
            this.lastPollData.notifications = data;
            if (Array.isArray(data.notifications)) {
              data.notifications.forEach((notif: any) => {
                const isNew = !oldNotifs.find((old: any) => old.id === notif.id);
                if (isNew) {
                  this.emit(WS_EVENTS.NOTIFICATION, notif);
                  this.notifyGeneralListeners({ type: WS_EVENTS.NOTIFICATION, data: notif });
                }
              });
            }
          }
        }
      } catch (e) { /* Silent fail */ }

    } catch (error) {
      console.error('[WebSocket] Polling error:', error);
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      console.log('[WebSocket] Reconnect already scheduled');
      return;
    }

    this.reconnectAttempts++;

    // After 3 failed attempts, switch to polling
    if (this.reconnectAttempts >= 3) {
      console.log('[WebSocket] Max reconnect attempts, switching to polling');
      this.switchToPollingMode();
      return;
    }

    // Exponential backoff with jitter
    const base = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const delay = base + jitter;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send message through WebSocket
   */
  send(data: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else if (!this.isPollingMode) {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }

  /**
   * Event emitter methods
   */
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[WebSocket] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  private notifyGeneralListeners(message: WebSocketMessage): void {
    this.generalListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[WebSocket] General listener error:', error);
      }
    });
  }

  /**
   * Add general message listener
   */
  addListener(listener: WebSocketListener): () => void {
    this.generalListeners.add(listener);
    return () => this.generalListeners.delete(listener);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.generalListeners.clear();
    }
  }

  // Subscribe methods
  subscribeTrades(): void {
    if (this.isPollingMode) {
      console.log('[WebSocket] subscribeTrades - polling mode active');
      return;
    }
    console.log('[WebSocket] 🔔 Subscribing to trades');
    this.send({ type: WS_EVENTS.SUBSCRIBE_TRADES });
  }

  subscribeStrategies(): void {
    if (this.isPollingMode) return;
    console.log('[WebSocket] 🔔 Subscribing to strategies');
    this.send({ type: WS_EVENTS.SUBSCRIBE_STRATEGIES });
  }

  subscribeWallet(): void {
    if (this.isPollingMode) return;
    console.log('[WebSocket] 🔔 Subscribing to wallet');
    this.send({ type: WS_EVENTS.SUBSCRIBE_WALLET });
  }

  subscribeSupport(ticketId: number): void {
    if (this.isPollingMode) return;
    console.log('[WebSocket] 🔔 Subscribing to support ticket:', ticketId);
    this.send({ type: WS_EVENTS.SUBSCRIBE_SUPPORT, ticketId });
  }

  subscribeDashboard(): void {
    if (this.isPollingMode) return;
    console.log('[WebSocket] 🔔 Subscribing to dashboard');
    this.send({ type: WS_EVENTS.SUBSCRIBE_DASHBOARD });
  }

  subscribePaperPrices(): void {
    if (this.isPollingMode) return;
    console.log('[WebSocket] 🔔 Subscribing to paper prices');
    this.send({ type: WS_EVENTS.SUBSCRIBE_PAPER_PRICES });
  }

  subscribePaperMTM(): void {
    if (this.isPollingMode) return;
    console.log('[WebSocket] 🔔 Subscribing to paper MTM');
    this.send({ type: WS_EVENTS.SUBSCRIBE_PAPER_MTM });
  }

  sendTypingIndicator(ticketId: number): void {
    if (this.isPollingMode) return;
    this.send({ type: WS_EVENTS.SUPPORT_TYPING, ticketId });
  }

  joinRoom(room: string): void {
    if (this.isPollingMode) return;
    this.send({ type: WS_EVENTS.JOIN_ROOM, room });
  }

  leaveRoom(room: string): void {
    if (this.isPollingMode) return;
    this.send({ type: WS_EVENTS.LEAVE_ROOM, room });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting intentionally');
    this.intentionalDisconnect = true;
    this.stopHeartbeat();
    this.stopPolling();
    this.isPollingMode = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    
    this.removeAllListeners();
  }

  /**
   * Check if connected (either WebSocket or polling mode)
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN || this.isPollingMode;
  }

  /**
   * Check if in polling mode
   */
  isInPollingMode(): boolean {
    return this.isPollingMode;
  }

  /**
   * Get connection state
   */
  getState(): string {
    if (this.isPollingMode) return 'polling';
    if (!this.socket) return 'not_initialized';
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }
}

// Singleton instance
export const wsService = new WebSocketService();

// Debug interface
if (typeof window !== 'undefined') {
  (window as any).__websocket_debug = wsService;
}

export default wsService;
