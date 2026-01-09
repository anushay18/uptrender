import { colors, getTheme } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { useSupportUpdates } from '@/hooks/useWebSocket';
import { supportService } from '@/services';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowsClockwise,
  CaretDown,
  CheckCircle,
  ClipboardText,
  Clock,
  DotsThree,
  Plus,
  Warning,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export const options = {
  headerShown: false,
};

const CATEGORY_OPTIONS = [
  'General Inquiry',
  'Technical Issue',
  'Billing & Payments',
  'Account Issues',
  'Trading Support',
  'API Support',
  'Feature Request',
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

export default function SupportScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const theme = getTheme(isDark);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showTicketDetailModal, setShowTicketDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('General Inquiry');
  const [newTicketPriority, setNewTicketPriority] = useState('medium');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Pagination state for Load More functionality
  const [ticketsVisibleCount, setTicketsVisibleCount] = useState(6);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  // Real-time updates for tickets
  useSupportUpdates(undefined, (updatedTicket: any) => {
    setTickets(prev => {
      const exists = prev.find(t => t.id === `#TKT${String(updatedTicket.id).padStart(3, '0')}`);
      if (exists) {
        return prev.map(t => 
          t.id === `#TKT${String(updatedTicket.id).padStart(3, '0')}`
            ? formatTicket(updatedTicket)
            : t
        );
      }
      return [formatTicket(updatedTicket), ...prev];
    });
  });

  // Format API ticket to UI format
  const formatTicket = (t: any) => ({
    id: `#TKT${String(t.id).padStart(3, '0')}`,
    subject: t.subject,
    description: t.description?.substring(0, 40) + '...',
    fullDescription: t.description,
    category: t.category || 'General Inquiry',
    priority: t.priority || 'medium',
    status: t.status,
    created: formatTimeAgo(t.createdAt),
    messages: t.messages || [],
  });

  // Format time ago
  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 60) return 'about ' + Math.floor(days / 30) + ' months ago';
    if (days > 30) return 'about a month ago';
    if (days > 1) return days + ' days ago';
    if (days === 1) return 'yesterday';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 1) return hours + ' hours ago';
    return 'just now';
  };

  // Fetch tickets from API
  const fetchTickets = useCallback(async () => {
    try {
      const response = await supportService.getTickets();
      if (response.success && response.data && response.data.length > 0) {
        setTickets(response.data.map(formatTicket));
      } else if (!response.success) {
        console.warn('Failed to fetch tickets:', response.error);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in-progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTickets();
  }, [fetchTickets]);

  const handleViewTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setShowTicketDetailModal(true);
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }
    try {
      const response = await supportService.createTicket({
        subject: newTicketSubject,
        description: newTicketDescription,
        category: newTicketCategory as 'General' | 'Technical' | 'Billing' | 'Feature Request',
        priority: newTicketPriority as 'low' | 'medium' | 'high' | 'urgent',
      });
      
      if (response.data) {
        const newTicket = formatTicket(response.data);
        setTickets([newTicket, ...tickets]);
      }
      
      setShowNewTicketModal(false);
      setNewTicketSubject('');
      setNewTicketDescription('');
      setNewTicketCategory('General Inquiry');
      setNewTicketPriority('medium');
      Alert.alert('Success', 'Support ticket created successfully');
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', error.message || 'Failed to create ticket. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return theme.textSecondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#F59E0B';
      case 'in-progress': return '#3B82F6';
      case 'resolved': return '#10B981';
      case 'closed': return '#6B7280';
      default: return theme.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Support Center Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            {/* <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Support Center</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Create and manage your support tickets
              </Text>
            </View> */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.refreshButton, { borderColor: theme.border }]}
                onPress={handleRefresh}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <ArrowsClockwise size={16} color={colors.primary} weight="bold" />
                )}
                <Text style={[styles.refreshButtonText, { color: colors.primary, marginLeft: 8 }]}>{isRefreshing ? 'Refreshing' : 'Refresh'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.newTicketButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowNewTicketModal(true)}
              >
                <Plus size={16} color="#fff" weight="bold" />
                <Text style={styles.newTicketButtonText}>New Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <ClipboardText size={20} color={colors.primary} weight="duotone" />
              </View>
              <View style={styles.statContent}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Tickets</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total}</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Warning size={20} color="#EF4444" weight="duotone" />
              </View>
              <View style={styles.statContent}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Open Tickets</Text>
                <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.open}</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Clock size={20} color="#F59E0B" weight="duotone" />
              </View>
              <View style={styles.statContent}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>In Progress</Text>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.inProgress}</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <CheckCircle size={20} color="#10B981" weight="duotone" />
              </View>
              <View style={styles.statContent}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Resolved</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.resolved}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tickets List */}
        <View style={styles.section}>
          <Text style={[styles.tableTitle, { color: theme.text }]}>My Support Tickets</Text>
          
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Loading tickets...</Text>
            </View>
          ) : tickets.length === 0 ? (
            <View style={[styles.emptyStateContainer, { backgroundColor: theme.surface, borderColor: theme.border, padding: 24 }]}>
              <ClipboardText size={48} color={theme.textSecondary} weight="duotone" />
              <Text style={[styles.emptyStateTitle, { color: theme.text, marginTop: 12 }]}>No Support Tickets</Text>
              <Text style={[styles.emptyStateText, { color: theme.textSecondary, marginTop: 6 }]}>You have no support tickets yet. Create a new ticket if you need help.</Text>
              <TouchableOpacity
                style={[styles.newTicketButton, { marginTop: 12, backgroundColor: colors.primary }]}
                onPress={() => setShowNewTicketModal(true)}
              >
                <Plus size={16} color="#fff" weight="bold" />
                <Text style={styles.newTicketButtonText}>New Ticket</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {tickets.slice(0, ticketsVisibleCount).map((ticket) => (
                <View 
                  key={ticket.id}
                  style={[styles.ticketCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={styles.ticketCardHeader}>
                    <Text style={[styles.ticketId, { color: colors.primary }]}>{ticket.id}</Text>
                    <TouchableOpacity onPress={() => handleViewTicket(ticket)}>
                      <DotsThree size={20} color={theme.textSecondary} weight="bold" />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={[styles.ticketSubject, { color: theme.text }]}>
                    {ticket.subject}
                  </Text>
                  <Text style={[styles.ticketDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                    {ticket.description}
                  </Text>
                  
                  <View style={styles.ticketCardFooter}>
                    <View style={styles.ticketCardBadges}>
                      <View style={[styles.categoryBadge, { borderColor: theme.border }]}>
                        <Text style={[styles.categoryText, { color: theme.text }]}>{ticket.category}</Text>
                      </View>
                      <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(ticket.priority)}20` }]}>
                        <Text style={[styles.priorityText, { color: getPriorityColor(ticket.priority) }]}>
                          {ticket.priority}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(ticket.status)}20` }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                          {ticket.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.createdText, { color: theme.textSecondary }]}>
                      {ticket.created}
                    </Text>
                  </View>
                </View>
              ))}
              {tickets.length > ticketsVisibleCount && (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, { borderColor: colors.primary }]}
                  onPress={() => setTicketsVisibleCount(prev => prev + 10)}
                >
                  <ArrowsClockwise size={16} color={colors.primary} weight="bold" />
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                    Load More 
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* New Ticket Modal */}
      <Modal
        visible={showNewTicketModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewTicketModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Ticket</Text>

            <View style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Subject *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={newTicketSubject}
                  onChangeText={setNewTicketSubject}
                  placeholder="Brief description of your issue"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={newTicketDescription}
                  onChangeText={setNewTicketDescription}
                  placeholder="Provide detailed information about your issue"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={{ color: theme.text }}>{newTicketCategory}</Text>
                  <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
                {showCategoryDropdown && (
                  <ScrollView style={[styles.dropdownList, { 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface, 
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border,
                    shadowOpacity: isDark ? 0.4 : 0.15,
                  }]}>
                    {CATEGORY_OPTIONS.map((option, index) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.dropdownItem,
                          { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                          index === CATEGORY_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                        ]}
                        onPress={() => {
                          setNewTicketCategory(option);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        <Text style={{ color: theme.text }}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Priority</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowPriorityDropdown(!showPriorityDropdown)}
                >
                  <Text style={{ color: theme.text, textTransform: 'capitalize' }}>{newTicketPriority}</Text>
                  <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
                {showPriorityDropdown && (
                  <ScrollView style={[styles.dropdownList, { 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface, 
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border,
                    shadowOpacity: isDark ? 0.4 : 0.15,
                  }]}>
                    {PRIORITY_OPTIONS.map((option, index) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.dropdownItem,
                          { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                          index === PRIORITY_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                        ]}
                        onPress={() => {
                          setNewTicketPriority(option);
                          setShowPriorityDropdown(false);
                        }}
                      >
                        <Text style={{ color: theme.text, textTransform: 'capitalize' }}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.primary }]}
                onPress={() => setShowNewTicketModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateTicket}
              >
                <Text style={styles.createButtonText}>Create Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ticket Detail Modal */}
      <Modal
        visible={showTicketDetailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTicketDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: theme.surface }]}>
            {selectedTicket && (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailIconWrapper}>
                    <ClipboardText size={32} color={colors.primary} weight="duotone" />
                  </View>
                  <View style={styles.detailHeaderText}>
                    <Text style={[styles.detailTicketId, { color: theme.text }]}>
                      Ticket {selectedTicket.id}
                    </Text>
                    <Text style={[styles.detailTicketSubject, { color: theme.text }]}>
                      {selectedTicket.subject}
                    </Text>
                  </View>
                  <View style={[styles.detailStatusBadge, { backgroundColor: `${getStatusColor(selectedTicket.status)}20` }]}>
                    <Text style={[styles.detailStatusText, { color: getStatusColor(selectedTicket.status) }]}>
                      {selectedTicket.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailGrid}>
                  <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
                    <Text style={[styles.detailCardLabel, { color: theme.textSecondary }]}>Category</Text>
                    <Text style={[styles.detailCardValue, { color: theme.text }]}>{selectedTicket.category}</Text>
                  </View>
                  <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
                    <Text style={[styles.detailCardLabel, { color: theme.textSecondary }]}>Priority</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(selectedTicket.priority)}20` }]}>
                      <Text style={[styles.priorityText, { color: getPriorityColor(selectedTicket.priority) }]}>
                        {selectedTicket.priority}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
                    <Text style={[styles.detailCardLabel, { color: theme.textSecondary }]}>Created</Text>
                    <Text style={[styles.detailCardValue, { color: theme.text }]}>{selectedTicket.created}</Text>
                  </View>
                  <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
                    <Text style={[styles.detailCardLabel, { color: theme.textSecondary }]}>Last Updated</Text>
                    <Text style={[styles.detailCardValue, { color: theme.text }]}>21 days ago</Text>
                  </View>
                </View>

                <View style={styles.detailMessageSection}>
                  <Text style={[styles.detailMessageTitle, { color: theme.text }]}>Original Message</Text>
                  <View style={[styles.detailMessageBox, { backgroundColor: theme.background }]}>
                    <Text style={[styles.detailMessageText, { color: theme.text }]}>
                      {selectedTicket.description}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.detailCancelButton, { borderColor: colors.primary }]}
                  onPress={() => setShowTicketDetailModal(false)}
                >
                  <Text style={[styles.detailCancelText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  newTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  newTicketButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  ticketCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketId: {
    fontSize: 14,
    fontWeight: '700',
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  ticketDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  ticketCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketCardBadges: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  createdText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalForm: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
    position: 'relative',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {},
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownButton: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 56,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 260,
    zIndex: 999,
    elevation: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 200, 200, 0.3)',
  },
  detailModalContent: {
    width: '95%',
    maxWidth: 600,
    borderRadius: 20,
    padding: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 12,
  },
  detailIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeaderText: {
    flex: 1,
  },
  detailTicketId: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailTicketSubject: {
    fontSize: 15,
    fontWeight: '400',
  },
  detailStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  detailCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
  },
  detailCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  detailCardValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailMessageSection: {
    marginBottom: 24,
  },
  detailMessageTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailMessageBox: {
    padding: 16,
    borderRadius: 12,
  },
  detailMessageText: {
    fontSize: 14,
    lineHeight: 22,
  },
  detailCancelButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailCancelText: {
    fontSize: 16,
    fontWeight: '700',
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
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
