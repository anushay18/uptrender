import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/index.js';
import process from 'process';
import redisClient from '../utils/redisClient.js';

let io;

// Initialize Socket.IO
export const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://192.168.1.8:5173',
        'http://localhost:3000',
        process.env.CORS_ORIGIN
      ].filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);
      
      // Get user from database
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'name', 'email', 'role', 'status']
      });

      if (!user || user.status !== 'Active') {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId} (${socket.user.name})`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Join role-based rooms
    socket.join(`role:${socket.userRole}`);

    // If admin, join admin room
    if (socket.userRole === 'Admin') {
      socket.join('admin');
    }

    // Send welcome message
    socket.emit('connected', {
      userId: socket.userId,
      message: 'Connected to real-time server',
      timestamp: new Date().toISOString()
    });

    // Handle joining custom rooms
    socket.on('join:room', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.userId} joined room: ${roomId}`);
    });

    // Handle leaving custom rooms
    socket.on('leave:room', (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.userId} left room: ${roomId}`);
    });

    // Handle trade updates subscription
    socket.on('subscribe:trades', () => {
      socket.join(`trades:${socket.userId}`);
      socket.emit('subscribed', { channel: 'trades' });
    });

    // Handle strategy updates subscription
    socket.on('subscribe:strategies', () => {
      socket.join(`strategies:${socket.userId}`);
      socket.emit('subscribed', { channel: 'strategies' });
    });

    // Handle wallet updates subscription
    socket.on('subscribe:wallet', () => {
      socket.join(`wallet:${socket.userId}`);
      socket.emit('subscribed', { channel: 'wallet' });
    });

    // Handle support ticket updates subscription
    socket.on('subscribe:support', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
      socket.emit('subscribed', { channel: 'support', ticketId });
    });

    // Handle dashboard updates subscription
    socket.on('subscribe:dashboard', () => {
      socket.join(`dashboard:${socket.userId}`);
      socket.emit('subscribed', { channel: 'dashboard' });
    });

    // Handle paper position price updates subscription
    socket.on('subscribe:paper_prices', () => {
      socket.join('paper:prices:all'); // Join global price room
      socket.emit('subscribed', { channel: 'paper_prices' });
      console.log(`User ${socket.userId} subscribed to paper position prices`);
    });

    // Handle paper position MTM updates subscription
    socket.on('subscribe:paper_mtm', () => {
      socket.join(`paper:mtm:${socket.userId}`);
      socket.emit('subscribed', { channel: 'paper_mtm' });
      console.log(`User ${socket.userId} subscribed to paper position MTM`);
    });

    // Handle typing in support tickets
    socket.on('support:typing', (data) => {
      socket.to(`ticket:${data.ticketId}`).emit('support:user_typing', {
        userId: socket.userId,
        userName: socket.user.name,
        ticketId: data.ticketId
      });
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Disconnection handler
    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.userId} (${reason})`);
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
};

/**
 * Setup Redis subscribers to forward updates to Socket.IO clients
 * Call this AFTER Redis is connected
 */
export const setupRedisForSocketIO = async () => {
  try {
    if (!redisClient || !redisClient.isConnected || !redisClient.subscriber) {
      console.warn('⚠️ Redis not connected, skipping subscribers setup');
      return;
    }

    // Subscribe to paper position MTM updates
    await redisClient.subscriber.subscribe('paper:mtm:all', (err) => {
      if (err) {
        console.error('❌ Failed to subscribe to paper:mtm:all:', err);
      } else {
        console.log('✅ Subscribed to Redis channel: paper:mtm:all');
      }
    });

    // Subscribe to price updates
    await redisClient.subscriber.subscribe('price:all', (err) => {
      if (err) {
        console.error('❌ Failed to subscribe to price:all:', err);
      } else {
        console.log('✅ Subscribed to Redis channel: price:all');
      }
    });

    // Handle incoming messages
    redisClient.subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);

        if (channel === 'paper:mtm:all') {
          // Forward paper position MTM to specific user
          if (data.userId && io) {
            io.to(`paper:mtm:${data.userId}`).emit('paper:mtm_update', {
              positionId: data.positionId,
              orderId: data.orderId,
              symbol: data.symbol,
              currentPrice: data.currentPrice,
              profit: data.profit,
              profitPercent: data.profitPercent,
              timestamp: data.timestamp
            });
          }
        } else if (channel === 'price:all') {
          // Broadcast price to all users subscribed to paper prices
          if (io) {
            io.to('paper:prices:all').emit('price:update', {
              symbol: data.symbol,
              bid: data.bid,
              ask: data.ask,
              mid: data.mid,
              timestamp: data.timestamp
            });
          }
        }
      } catch (error) {
        console.error('❌ Error processing Redis message:', error);
      }
    });

    console.log('✅ Redis subscribers setup complete');
  } catch (error) {
    console.error('❌ Error setting up Redis subscribers:', error);
  }
};

// Get Socket.IO instance
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Emit to specific user
export const emitToUser = (userId, event, data) => {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
  } catch (error) {
    console.error('Error emitting to user:', error);
  }
};

// Emit to multiple users
export const emitToUsers = (userIds, event, data) => {
  try {
    const io = getIO();
    userIds.forEach(userId => {
      io.to(`user:${userId}`).emit(event, data);
    });
  } catch (error) {
    console.error('Error emitting to users:', error);
  }
};

// Emit to all admins
export const emitToAdmins = (event, data) => {
  try {
    const io = getIO();
    io.to('admin').emit(event, data);
  } catch (error) {
    console.error('Error emitting to admins:', error);
  }
};

// Emit to all connected users
export const emitToAll = (event, data) => {
  try {
    const io = getIO();
    io.emit(event, data);
  } catch (error) {
    console.error('Error emitting to all:', error);
  }
};

// Emit trade update
export const emitTradeUpdate = (userId, trade, action = 'update') => {
  console.log(`Emit trade update to user ${userId} action=${action} id=${trade?.id}`);
  emitToUser(userId, 'trade:update', {
    action, // 'create', 'update', 'delete'
    trade,
    timestamp: new Date().toISOString()
  });
};

// Emit strategy update
export const emitStrategyUpdate = (userId, strategy, action = 'update') => {
  emitToUser(userId, 'strategy:update', {
    action, // 'create', 'update', 'delete', 'status_change'
    strategy,
    timestamp: new Date().toISOString()
  });
};

// Emit wallet update
export const emitWalletUpdate = (userId, wallet, transaction = null) => {
  emitToUser(userId, 'wallet:update', {
    wallet,
    transaction,
    timestamp: new Date().toISOString()
  });
};

// Emit notification
export const emitNotification = (userId, notification) => {
  emitToUser(userId, 'notification:new', {
    notification,
    timestamp: new Date().toISOString()
  });
};

// Emit support ticket update
export const emitTicketUpdate = (ticketId, ticket, action = 'update') => {
  try {
    const io = getIO();
    io.to(`ticket:${ticketId}`).emit('ticket:update', {
      action, // 'message', 'status_change', 'assigned'
      ticket,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error emitting ticket update:', error);
  }
};

// Emit dashboard update
export const emitDashboardUpdate = (userId, data) => {
  emitToUser(userId, 'dashboard:update', {
    data,
    timestamp: new Date().toISOString()
  });
};

// Emit paper position update
export const emitPaperPositionUpdate = (userId, position, action = 'update') => {
  console.log(`Emit paper position update to user ${userId} action=${action} id=${position?.id}`);
  emitToUser(userId, 'paper_position:update', {
    action, // 'open', 'close', 'modify', 'mtm', 'sl_hit', 'tp_hit'
    position,
    timestamp: new Date().toISOString()
  });
};

// Get online users count
export const getOnlineUsersCount = async () => {
  try {
    const io = getIO();
    const sockets = await io.fetchSockets();
    return sockets.length;
  } catch (error) {
    console.error('Error getting online users count:', error);
    return 0;
  }
};

// Check if user is online
export const isUserOnline = async (userId) => {
  try {
    const io = getIO();
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
  } catch (error) {
    console.error('Error checking user online status:', error);
    return false;
  }
};

export default { initializeSocketIO, getIO, emitToUser, emitToUsers, emitToAdmins, emitToAll };
