import { borderRadius, colors, getTheme, spacing, typography } from '@/constants/styles';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { authService, walletService } from '@/services';
import { API_CONFIG } from '@/services/config';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
    Camera,
    CaretDown,
    CaretRight,
    ClipboardText,
    Clock,
    Code,
    CreditCard,
    Info,
    Question,
    SignOut,
    TrendDown,
    TrendUp,
    User,
    X
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// LazyImage: small local component to show placeholder + fade-in when image loads
function LazyImage({ uri, style, initials }: { uri?: string | null; style?: any; initials?: string }) {
  const [loaded, setLoaded] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!uri) return;
    setLoaded(false);
    opacity.setValue(0);
  }, [uri]);

  const onLoad = () => {
    setLoaded(true);
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  };

  // If no URI, show initials avatar immediately without loading indicator
  if (!uri) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }]}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 24 }}>{initials || 'U'}</Text>
      </View>
    );
  }

  return (
    <View style={[{ justifyContent: 'center', alignItems: 'center' }, style]}>
      {!loaded && (
        <View style={[StyleSheet.flatten(style), { position: 'absolute', justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
      <Animated.Image source={{ uri }} onLoad={onLoad} style={[style, { opacity }]} />
    </View>
  );
}

// Billing History Data
const BILLING_HISTORY = [
  { date: '4 Jan 2026, 05:10 pm', desc: 'Subscription to strategy: XAUUSD Sniper', type: 'Debit', amount: '-₹1000.00', balance: '₹43825.00' },
  { date: '4 Jan 2026, 02:53 pm', desc: 'API key addition charge - test\nRef: api_key_176751B594978', type: 'Debit', amount: '-₹100.00', balance: '₹44825.00' },
  { date: '2 Jan 2026, 03:14 pm', desc: 'UPI Payment - Pending Verification (UTR: 456781dfghj)\nRef: 45678ldfghj', type: 'Credit', amount: '+₹20.00', balance: '₹44925.00' },
  { date: '2 Jan 2026, 03:05 pm', desc: 'Razorpay payment\nRef: pay_Ryk97weqAlqdb', type: 'Credit', amount: '+₹50.00', balance: '₹44925.00' },
  { date: '2 Jan 2026, 02:48 pm', desc: 'UPI Payment - Approved (UTR: 3456789fde4567)\nRef: 3456789fde4567', type: 'Credit', amount: '+₹50.00', balance: '₹44875.00' },
  { date: '23 Dec 2025, 06:43 pm', desc: 'API key addition charge - rese\nRef: api_key_1766495613397', type: 'Debit', amount: '-₹100.00', balance: '₹44825.00' },
  { date: '23 Dec 2025, 06:07 pm', desc: 'Subscription to strategy: forex test', type: 'Debit', amount: '-₹1000.00', balance: '₹44925.00' },
  { date: '23 Dec 2025, 04:41 pm', desc: 'Subscription to strategy: forex test', type: 'Debit', amount: '-₹1000.00', balance: '₹45925.00' },
  { date: '22 Dec 2025, 06:36 pm', desc: 'Subscription to strategy: forex test', type: 'Debit', amount: '-₹1000.00', balance: '₹46925.00' },
  { date: '20 Dec 2025, 05:42 pm', desc: 'Subscription to strategy: fgfdgfdggrfd', type: 'Debit', amount: '-₹500.00', balance: '₹47925.00' },
];

export default function MoreScreen() {
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const theme = getTheme(isDark);
  const [billingHistory, setBillingHistory] = useState(BILLING_HISTORY);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch user profile on mount to get avatar
  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await authService.getProfile();
      if (response.success && response.data?.avatar) {
        const avatarUrl = response.data.avatar.startsWith('http') 
          ? response.data.avatar 
          : `${API_CONFIG.BASE_URL}${response.data.avatar}`;
        setProfileImage(avatarUrl);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Fetch billing history from API
  const fetchBillingHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await walletService.getTransactions();
      if (response.data && response.data.length > 0) {
        setBillingHistory(response.data.map((t: any) => ({
          date: new Date(t.createdAt).toLocaleString(),
          desc: t.description || t.type,
          type: t.type === 'credit' ? 'Credit' : 'Debit',
          amount: `${t.type === 'credit' ? '+' : '-'}₹${Math.abs(t.amount).toFixed(2)}`,
          balance: `₹${t.balance?.toFixed(2) || '0.00'}`,
        })));
      }
    } catch (error) {
      console.error('Error fetching billing history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (showBillingHistory) {
      fetchBillingHistory();
    }
  }, [showBillingHistory, fetchBillingHistory]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBillingHistory();
  }, [fetchBillingHistory]);

  const handleLogout = async () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        },
      ],
    );
  };

  // Get user initials
  const getUserInitial = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const menuItems = [
    { 
      icon: User, 
      title: 'My Account', 
      subtitle: 'Profile Information, Invoices, Subscriptions',
      route: '/my-account',
      action: null,
      color: colors.primary
    },
    { 
      icon: ClipboardText, 
      title: 'Order Log', 
      subtitle: 'Monitor your order executions, broker responses, and trading activity logs.',
      route: '/order-log',
      action: null,
      color: colors.primary
    },
    { 
      icon: Code, 
      title: 'API Details', 
      subtitle: 'Manage your API keys and credentials',
      route: '/api-details',
      action: null,
      color: colors.primary
    },
    { 
      icon: Clock, 
      title: 'Order History', 
      subtitle: 'View past trading history and performance',
      route: '/order-history',
      action: null,
      color: colors.primary
    },
    { 
      icon: CreditCard, 
      title: 'Plan & Bill', 
      subtitle: 'Manage subscriptions and billing',
      route: '/plan-billing',
      action: null,
      color: colors.primary
    },
    { 
      icon: Question, 
      title: 'Support', 
      subtitle: 'Get help, submit support tickets, and access help resources',
      route: '/support',
      action: null,
      color: colors.primary
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <SignOut size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
            <LazyImage uri={profileImage || user?.avatar} style={styles.profileImage} initials={getUserInitial()} />
            <View style={[styles.cameraIconContainer, { backgroundColor: colors.primary }]}>
              <Camera size={14} color="#fff" weight="fill" />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>{user?.name || 'User'}</Text>
            <Text style={[styles.profileEmail, { color: colors.primary }]}>{user?.email || 'user@email.com'}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <TouchableOpacity 
                key={index}
                style={[styles.menuItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => {
                  if (item.route) {
                    router.push(item.route as any);
                  } else if (item.action) {
                    (item.action as () => void)();
                  }
                }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.color + '12' }]}>
                  <IconComponent size={22} color={item.color} weight="duotone" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <CaretRight size={20} color={theme.textTertiary} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: Platform.OS === 'android' ? 80 : 100 }} />
      </ScrollView>

      {/* Billing History Modal */}
      <Modal
        visible={showBillingHistory}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBillingHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.billingHistoryModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Billing History</Text>
              <TouchableOpacity onPress={() => setShowBillingHistory(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.billingHistoryContent} showsVerticalScrollIndicator={false}>
              {/* Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: theme.surfaceSecondary }]}>
                <Text style={[styles.tableHeaderCell, styles.dateColumn, { color: theme.text }]}>Date</Text>
                <Text style={[styles.tableHeaderCell, styles.descColumn, { color: theme.text }]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.typeColumn, { color: theme.text }]}>Type</Text>
                <Text style={[styles.tableHeaderCell, styles.amountColumn, { color: theme.text }]}>Amount</Text>
                <Text style={[styles.tableHeaderCell, styles.balanceColumn, { color: theme.text }]}>Balance</Text>
              </View>

              {/* Table Rows */}
              {BILLING_HISTORY.map((row, index) => (
                <View key={index} style={[styles.tableRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.tableCell, styles.dateColumn, { color: theme.textSecondary }]}>{row.date}</Text>
                  <Text style={[styles.tableCell, styles.descColumn, { color: theme.text }]}>{row.desc}</Text>
                  <View style={styles.typeColumn}>
                    <View style={[styles.typeBadge, { backgroundColor: row.type === 'Credit' ? colors.success + '20' : colors.error + '20' }]}>
                      {row.type === 'Credit' ? (
                        <TrendUp size={14} color={colors.success} weight="bold" />
                      ) : (
                        <TrendDown size={14} color={colors.error} weight="bold" />
                      )}
                      <Text style={[styles.typeBadgeText, { color: row.type === 'Credit' ? colors.success : colors.error }]}>{row.type}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tableCell, styles.amountColumn, { color: row.type === 'Credit' ? colors.success : colors.error }]}>{row.amount}</Text>
                  <Text style={[styles.tableCell, styles.balanceColumn, { color: theme.text }]}>{row.balance}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Pagination */}
            <View style={[styles.pagination, { borderTopColor: theme.border }]}>
              <Text style={[styles.paginationText, { color: theme.textSecondary }]}>Rows per page:</Text>
              <TouchableOpacity style={styles.paginationDropdown}>
                <Text style={[styles.paginationValue, { color: theme.text }]}>10</Text>
                <CaretDown size={16} color={theme.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.paginationText, { color: theme.textSecondary }]}>1-10 of 25</Text>
              <View style={styles.paginationButtons}>
                <TouchableOpacity style={styles.paginationButton}>
                  <Text style={[styles.paginationArrow, { color: theme.textSecondary }]}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.paginationButton}>
                  <Text style={[styles.paginationArrow, { color: theme.textSecondary }]}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Method Modal */}
      <Modal
        visible={showPaymentMethod}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentMethod(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.paymentMethodModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <CreditCard size={24} color={theme.text} />
                <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Payment Method</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPaymentMethod(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.paymentMethodContent} showsVerticalScrollIndicator={false}>
              {/* Info Banner */}
              <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15' }]}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + '30' }]}>
                  <Info size={20} color={colors.primary} />
                </View>
                <Text style={[styles.infoBannerText, { color: colors.primary }]}>
                  Your payment information is encrypted and securely stored.
                </Text>
              </View>

              {/* Form Fields - First Row */}
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                    placeholder="Card Number"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                    placeholder="Cardholder Name"
                    placeholderTextColor={theme.textTertiary}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formField, { width: 70 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                    placeholder="M..."
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.formField, { width: 70 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                    placeholder="Y..."
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>

              {/* Form Fields - Second Row */}
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                    placeholder="CVV"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="numeric"
                    maxLength={3}
                    secureTextEntry
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                    placeholder="Billing ZIP Code"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.formCancelButton, { borderColor: colors.primary }]}
                  onPress={() => setShowPaymentMethod(false)}
                >
                  <Text style={[styles.formCancelButtonText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formSaveButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.formSaveButtonText}>Save Payment Method</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Funds Modal */}
      <Modal
        visible={showAddFunds}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddFunds(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.addFundsModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <CreditCard size={24} color={colors.primary} />
                <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Add Funds via Razorpay</Text>
                <View style={styles.testModeBadge}>
                  <Text style={styles.testModeText}>Test Mode</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowAddFunds(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.addFundsContent}>
              {/* Info Banner */}
              <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15' }]}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + '30' }]}>
                  <Info size={20} color={colors.primary} />
                </View>
                <Text style={[styles.infoBannerText, { color: colors.primary }]}>
                  You will be redirected to Razorpay secure payment gateway to complete the transaction.
                </Text>
              </View>

              {/* Amount Input */}
              <View style={styles.amountSection}>
                <Text style={[styles.amountLabel, { color: theme.text }]}>Amount (₹)</Text>
                <TextInput
                  style={[styles.amountInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                  placeholder="Enter the amount you want to add to your wallet"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="numeric"
                  value={addFundsAmount}
                  onChangeText={setAddFundsAmount}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.addFundsActions}>
                <TouchableOpacity 
                  style={[styles.addFundsCancelButton, { borderColor: colors.primary }]}
                  onPress={() => setShowAddFunds(false)}
                >
                  <Text style={[styles.addFundsCancelText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.addFundsPayButton, { backgroundColor: addFundsAmount ? colors.primary : theme.surfaceSecondary }]}
                  disabled={!addFundsAmount}
                >
                  <CreditCard size={20} color={addFundsAmount ? '#fff' : theme.textTertiary} weight="duotone" />
                  <Text style={[styles.addFundsPayText, { color: addFundsAmount ? '#fff' : theme.textTertiary }]}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            </View>
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  headerTitle: {
    ...typography.h2,
  },
  logoutButton: {
    padding: spacing.sm,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  profileImageContainer: {
    marginRight: spacing.lg,
    position: 'relative',
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...typography.h3,
    marginBottom: 4,
  },
  profileEmail: {
    ...typography.bodySmall,
  },
  menuContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    ...typography.labelLarge,
    marginBottom: 2,
  },
  menuSubtitle: {
    ...typography.caption,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    ...typography.h3,
    fontSize: 20,
  },
  cancelText: {
    ...typography.labelLarge,
    fontSize: 16,
  },
  // Billing History Modal
  billingHistoryModal: {
    width: '95%',
    maxHeight: '85%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  billingHistoryContent: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tableHeaderCell: {
    ...typography.labelMedium,
    fontWeight: '700',
  },
  dateColumn: {
    width: 100,
  },
  descColumn: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  typeColumn: {
    width: 80,
  },
  amountColumn: {
    width: 80,
    textAlign: 'right',
  },
  balanceColumn: {
    width: 90,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableCell: {
    ...typography.bodySmall,
    fontSize: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  paginationText: {
    ...typography.bodySmall,
  },
  paginationDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paginationValue: {
    ...typography.bodySmall,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paginationButton: {
    padding: spacing.sm,
  },
  paginationArrow: {
    fontSize: 20,
  },
  // Payment Method Modal
  paymentMethodModal: {
    width: '94%',
    maxHeight: '80%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  paymentMethodContent: {
    padding: spacing.xl,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBannerText: {
    ...typography.bodySmall,
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  formField: {
    gap: spacing.xs,
  },
  formInput: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...typography.bodyMedium,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  formCancelButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  formCancelButtonText: {
    ...typography.labelLarge,
  },
  formSaveButton: {
    flex: 2,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  formSaveButtonText: {
    ...typography.labelLarge,
    color: '#fff',
  },
  // Add Funds Modal
  addFundsModal: {
    width: '94%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  testModeBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  testModeText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
  },
  addFundsContent: {
    padding: spacing.xl,
  },
  amountSection: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  amountLabel: {
    ...typography.h3,
    fontSize: 18,
  },
  amountInput: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...typography.bodyMedium,
  },
  addFundsActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addFundsCancelButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  addFundsCancelText: {
    ...typography.labelLarge,
  },
  addFundsPayButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
  },
  addFundsPayText: {
    ...typography.labelLarge,
  },
});
