import { colors, getTheme } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications as useWsNotifications } from '@/hooks/useWebSocket';
import { Notification as ApiNotification, notificationService } from '@/services';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface Notification {
  id: number;
  type: 'ticket' | 'payment' | 'success' | 'info' | 'warning' | 'trade' | 'strategy';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

// Helper to format notification from API
const formatNotification = (n: ApiNotification): Notification => ({
  id: n.id,
  type: (n.type as Notification['type']) || 'info',
  title: n.title,
  message: n.message,
  time: formatTimeAgo(new Date(n.createdAt)),
  read: n.isRead,
});

// Format time ago
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${diffWeeks}w ago`;
};

export default function NotificationsScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const theme = getTheme(isDark);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pagination state for Load More functionality
  const [notificationsVisibleCount, setNotificationsVisibleCount] = useState(10);
  
  // WebSocket real-time notifications
  const wsNotifications = useWsNotifications((newNotif) => {
    // Add new notification to list
    setNotifications(prev => [{
      id: newNotif.id,
      type: (newNotif.type as Notification['type']) || 'info',
      title: newNotif.title,
      message: newNotif.message,
      time: 'Just now',
      read: false,
    }, ...prev]);
  });

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationService.getNotifications({ limit: 50 });
      if (response.success && response.data) {
        setNotifications(response.data.map(formatNotification));
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIconForType = (type: string) => {
    switch (type) {
      case 'ticket':
        return { name: 'chatbubble-ellipses', color: '#6366F1', bg: '#EEF2FF' };
      case 'payment':
        return { name: 'card', color: '#10B981', bg: '#D1FAE5' };
      case 'success':
        return { name: 'checkmark-circle', color: '#10B981', bg: '#D1FAE5' };
      case 'info':
        return { name: 'information-circle', color: '#3B82F6', bg: '#DBEAFE' };
      case 'warning':
        return { name: 'warning', color: '#F59E0B', bg: '#FEF3C7' };
      case 'trade':
        return { name: 'trending-up', color: '#10B981', bg: '#D1FAE5' };
      case 'strategy':
        return { name: 'flash', color: '#6366F1', bg: '#EEF2FF' };
      default:
        return { name: 'notifications', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const clearAll = async () => {
    try {
      await notificationService.clearReadNotifications();
      setNotifications(notifications.filter(n => !n.read));
      setShowModal(false);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
            <Text style={styles.badgeText}>{unreadCount} new</Text>
          </View>
        )}
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={markAllAsRead} style={styles.headerActionBtn}>
            <Ionicons name="checkmark-done" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowModal(true)} style={styles.headerActionBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications List */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No notifications</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              You're all caught up! New notifications will appear here.
            </Text>
          </View>
        ) : (
          <>
          {notifications.slice(0, notificationsVisibleCount).map((notification) => {
            const icon = getIconForType(notification.type);
            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  { 
                    backgroundColor: notification.read 
                      ? theme.surface 
                      : isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                    borderColor: theme.border,
                  }
                ]}
                onPress={() => markAsRead(notification.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name as any} size={24} color={icon.color} />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: theme.text }]}>
                      {notification.title}
                    </Text>
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                  <Text 
                    style={[styles.notificationMessage, { color: theme.textSecondary }]}
                    numberOfLines={2}
                  >
                    {notification.message}
                  </Text>
                  <Text style={[styles.notificationTime, { color: theme.textSecondary }]}>
                    {notification.time}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {/* Load More Button for Notifications */}
          {notifications.length > notificationsVisibleCount && (
            <TouchableOpacity
              style={[styles.loadMoreBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : colors.primary + '15', borderColor: colors.primary }]}
              onPress={() => setNotificationsVisibleCount(prev => prev + 10)}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
            </TouchableOpacity>
          )}
          </>
        )}
      </ScrollView>

      {/* Footer Close Button */}
      {notifications.length > 0 && (
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.closeButton, { borderColor: theme.border }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.closeButtonText, { color: theme.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Options Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomColor: theme.border }]}
              onPress={markAllAsRead}
            >
              <Ionicons name="checkmark-done" size={20} color={theme.text} />
              <Text style={[styles.modalOptionText, { color: theme.text }]}>Mark all as read</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={clearAll}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.modalOptionText, { color: '#EF4444' }]}>Clear all notifications</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 8,
  },
  headerActionBtn: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'android' ? 140 : 100,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 50 : 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  closeButton: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
