import { api, ApiResponse } from './api';
import { ENDPOINTS } from './config';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}

export const notificationService = {
  // Get notifications
  async getNotifications(filters?: NotificationFilters): Promise<ApiResponse<Notification[]>> {
    return await api.get<Notification[]>(ENDPOINTS.NOTIFICATIONS.LIST, filters);
  },

  // Get unread count
  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return await api.get(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
  },

  // Mark notification as read
  async markAsRead(id: number): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
  },

  // Mark all as read
  async markAllAsRead(): Promise<ApiResponse> {
    return await api.post(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },

  // Delete notification
  async deleteNotification(id: number): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.NOTIFICATIONS.DELETE(id));
  },

  // Clear all read notifications
  async clearReadNotifications(): Promise<ApiResponse> {
    return await api.delete(ENDPOINTS.NOTIFICATIONS.CLEAR_READ);
  },
};

export default notificationService;
