import { Notification, User } from '../models/index.js';
import { Op } from 'sequelize';
import { emitNotification, emitToUsers } from '../config/socket.js';

// Get user's notifications
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, isRead, page = 1, limit = 20 } = req.query;

    const where = { userId };
    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const offset = (page - 1) * limit;

    const notifications = await Notification.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: notifications.rows,
      pagination: {
        total: notifications.count,
        page: parseInt(page),
        pages: Math.ceil(notifications.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Notification.count({
      where: { userId, isRead: false }
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.update({ isRead: true });

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.destroy();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Delete all read notifications
export const deleteAllRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.destroy({
      where: { userId, isRead: true }
    });

    res.json({
      success: true,
      message: `${result} notifications deleted`,
      count: result
    });
  } catch (error) {
    console.error('Delete all read error:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
};

// Create notification (internal/admin use)
export const createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, metadata } = req.body;

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notification = await Notification.create({
      userId,
      type: type || 'Info',
      title,
      message,
      metadata: metadata || {},
      isRead: false
    });

    // Emit real-time notification
    emitNotification(userId, notification);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

// Broadcast notification to all users (admin)
export const broadcastNotification = async (req, res) => {
  try {
    const { type, title, message, metadata, userIds } = req.body;

    // If userIds provided, send to specific users, otherwise all active users
    let targetUserIds = userIds;
    if (!targetUserIds || targetUserIds.length === 0) {
      const users = await User.findAll({
        where: { status: 'Active' },
        attributes: ['id']
      });
      targetUserIds = users.map(u => u.id);
    }

    const notifications = targetUserIds.map(userId => ({
      userId,
      type: type || 'Info',
      title,
      message,
      metadata: metadata || {},
      isRead: false
    }));

    const createdNotifications = await Notification.bulkCreate(notifications);

    // Emit real-time broadcast to all target users
    emitToUsers(targetUserIds, 'notification:new', {
      notification: { type, title, message, metadata },
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: `Notification sent to ${targetUserIds.length} users`,
      count: targetUserIds.length,
      data: createdNotifications
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
};

// Admin: Get all notifications
export const getAllNotifications = async (req, res) => {
  try {
    const { type, isRead, page = 1, limit = 50 } = req.query;

    const where = {};
    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const offset = (page - 1) * limit;

    const notifications = await Notification.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        }
      ]
    });

    res.json({
      success: true,
      data: notifications.rows,
      pagination: {
        total: notifications.count,
        page: parseInt(page),
        pages: Math.ceil(notifications.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};
