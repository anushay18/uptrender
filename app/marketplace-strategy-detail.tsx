import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { strategyService, walletService } from '@/services';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, CheckCircle, CurrencyDollar, X } from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarketplaceStrategyDetailScreen() {
  const router = useRouter();
  const { id, name, author, isOwn, price: priceParam, segment: segmentParam, capital: capitalParam } = useLocalSearchParams<{ 
    id: string; 
    name: string; 
    author: string; 
    isOwn?: string;
    price?: string;
    segment?: string;
    capital?: string;
  }>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { openSubscribe } = useLocalSearchParams<{ id?: string; name?: string; author?: string; isOwn?: string; openSubscribe?: string }>();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  
  // Subscription state
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [strategyData, setStrategyData] = useState<any>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(true);

  useEffect(() => {
    if (openSubscribe === 'true') setShowSubscribeModal(true);
  }, [openSubscribe]);

  // Fetch strategy data and wallet balance
  const fetchData = useCallback(async () => {
    setIsLoadingStrategy(true);
    try {
      // For marketplace strategies (isOwn !== 'true'), we might not be able to fetch via getStrategyById
      // So we'll rely on query params and try to fetch, but not fail if it returns 404
      const [strategyRes, walletRes] = await Promise.all([
        id ? strategyService.getStrategyById(parseInt(id)).catch(() => ({ success: false, data: null })) : Promise.resolve({ success: false, data: null }),
        walletService.getWallet(),
      ]);
      
      console.log('📊 [Marketplace Detail] Strategy Response:', JSON.stringify(strategyRes, null, 2));
      console.log('📊 [Marketplace Detail] Query params - capital:', capitalParam);
      
      if (strategyRes.success && strategyRes.data) {
        console.log('📊 [Marketplace Detail] Strategy Capital from API:', strategyRes.data.capital);
        setStrategyData(strategyRes.data);
      } else if (!strategyRes.success && isOwn !== 'true') {
        // For marketplace strategies we may not have access to getStrategyById
        // Create a minimal data object from query params
        console.log('📊 [Marketplace Detail] Using query params for marketplace strategy');
        setStrategyData({
          name: decodeURIComponent(name || 'Strategy'),
          segment: segmentParam,
          price: parseFloat(priceParam || '0'),
          capital: Number(capitalParam) || 0,
        });
      }
      
      if (walletRes.success && walletRes.data) {
        // Wallet API may return data as an object or a numeric balance directly.
        const raw = walletRes.data;
        let bal = 0;
        if (typeof raw === 'number') bal = raw;
        else if (raw && typeof raw === 'object') bal = raw.balance ?? (raw as any).currentBalance ?? 0;
        else bal = Number(raw) || 0;
        setWalletBalance(Number(bal) || 0);
      }
    } catch (error) {
      console.error('Failed to fetch strategy data:', error);
    } finally {
      setIsLoadingStrategy(false);
    }
  }, [id, name, priceParam, segmentParam, isOwn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get price and other details
  const strategyPrice = strategyData?.price || parseFloat(priceParam || '0') || 0;
  const strategyName = strategyData?.name || decodeURIComponent(name || 'Strategy');
  const strategySegment = strategyData?.segment || segmentParam || 'Forex';
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  // Handle subscribe
  const handleSubscribe = async () => {
    if (!id) {
      Alert.alert('Error', 'Strategy ID is missing');
      return;
    }

    // Check wallet balance
    if (strategyPrice > 0 && walletBalance < strategyPrice) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₹${strategyPrice} to subscribe. Your current balance is ₹${walletBalance.toFixed(2)}. Please add funds to your wallet.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubscribing(true);
    try {
      const result = await strategyService.subscribe(parseInt(id), { lots: 1 });
      
      if (result.success) {
        setShowSubscribeModal(false);
        Alert.alert(
          'Subscribed Successfully!',
          strategyPrice > 0 
            ? `₹${strategyPrice} has been deducted from your wallet. You now have access to "${strategyName}" until ${expiryDate.toLocaleDateString('en-IN')}.`
            : `You now have access to "${strategyName}" until ${expiryDate.toLocaleDateString('en-IN')}.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Subscription Failed', result.error || 'Unable to subscribe. Please try again.');
      }
    } catch (error: any) {
      console.error('Subscribe error:', error);
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const theme = {
    bg: isDark ? '#050510' : '#F8FAFC',
    cardBg: isDark ? '#0a0a1a' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0a0a1a',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#1a1a35' : '#E2E8F0',
    primary: '#2563EB',
    success: '#10B981',
    error: '#EF4444',
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {strategyName}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Metrics Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsScrollContent}
          style={styles.metricsScroll}
        >
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              ₹{Number(strategyData?.capital || capitalParam || 0).toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Capital</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.success }]}>0%</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Return</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.text }]}>0</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Trades</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.error }]}>0%</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Max Drawdown</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.success }]}>0%</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Win Rate</Text>
          </View>
        </ScrollView>

        {/* Performance Metrics Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Performance Metrics</Text>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricItemLabel, { color: theme.primary }]}>Annualized Return</Text>
                <Text style={[styles.metricItemValue, { color: theme.text }]}>0%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricItemLabel, { color: theme.primary }]}>Total Trades</Text>
                <Text style={[styles.metricItemValue, { color: theme.text }]}>0</Text>
              </View>
            </View>
            
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricItemLabel, { color: theme.text }]}>Win/Loss</Text>
                <Text style={[styles.metricItemValue, { color: theme.text }]}>0 Wins / 0 losses</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricItemLabel, { color: theme.primary }]}>Profit Factor</Text>
                <Text style={[styles.metricItemValue, { color: theme.text }]}>0</Text>
              </View>
            </View>
            
            <View style={styles.metricRow}>
              <View style={[styles.metricItem, { flex: 1 }]}>
                <Text style={[styles.metricItemLabel, { color: theme.text }]}>Average Win/Loss</Text>
                <View style={styles.winLossRow}>
                  <Text style={[styles.metricItemValue, { color: theme.success }]}>+0.0%</Text>
                  <Text style={[styles.metricItemValue, { color: theme.text }]}> / </Text>
                  <Text style={[styles.metricItemValue, { color: theme.error }]}>-0.0%</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Monthly Returns Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Monthly Returns</Text>
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No trade history available</Text>
          </View>
        </View>

        {/* Recent Trades Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Trades</Text>
          
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No trades found for this strategy</Text>
          </View>
        </View>

        {/* Footer Buttons - Inside ScrollView on Android */}
        {Platform.OS === 'android' && isOwn !== 'true' && (
          <View style={[styles.footerInline, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
            <TouchableOpacity 
              style={[styles.closeButton, { borderColor: theme.primary }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.closeButtonText, { color: theme.primary }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.subscribeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowSubscribeModal(true)}
            >
              <Text style={styles.subscribeButtonText}>Subscribe</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer Buttons - Fixed on iOS only */}
      {Platform.OS === 'ios' && isOwn !== 'true' && (
        <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.closeButton, { borderColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.closeButtonText, { color: theme.primary }]}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.subscribeButton, { backgroundColor: theme.primary }]}
            onPress={() => setShowSubscribeModal(true)}
          >
            <Text style={styles.subscribeButtonText}>Subscribe</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Subscription Modal */}
      <Modal
        visible={showSubscribeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubscribeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Subscription</Text>
              <Text style={[styles.modalStrategyName, { color: theme.textSecondary }]}>{strategyName}</Text>
              
              {/* Tags */}
              <View style={styles.modalTags}>
                <View style={[styles.modalTag, { borderColor: theme.primary }]}>
                  <Text style={[styles.modalTagText, { color: theme.primary }]}>{strategySegment}</Text>
                </View>
                <View style={[styles.modalTag, { borderColor: theme.primary }]}>
                  <Text style={[styles.modalTagText, { color: theme.primary }]}>Public</Text>
                </View>
                {strategyData?.stats?.winRate !== undefined && (
                  <View style={[styles.modalTag, { borderColor: theme.success }]}>
                    <Text style={[styles.modalTagText, { color: theme.success }]}>+{strategyData.stats.winRate}%</Text>
                  </View>
                )}
              </View>

              {/* Subscription Details */}
              <Text style={[styles.subscriptionDetailsTitle, { color: theme.text }]}>Subscription Details</Text>
              
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <CurrencyDollar size={20} color={theme.textSecondary} weight="bold" />
                </View>
                <Text style={[styles.detailLabel, { color: theme.text }]}>Subscription Fee</Text>
                <Text style={[styles.detailValue, { color: strategyPrice > 0 ? theme.text : theme.success }]}>
                  {strategyPrice > 0 ? `₹${strategyPrice}` : 'FREE'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Calendar size={20} color={theme.textSecondary} weight="bold" />
                </View>
                <Text style={[styles.detailLabel, { color: theme.text }]}>Access Duration</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>30 Days</Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <CheckCircle size={20} color={theme.textSecondary} weight="bold" />
                </View>
                <Text style={[styles.detailLabel, { color: theme.text }]}>Expires On</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              </View>

              {/* Wallet Balance Info */}
              {strategyPrice > 0 && (
                <View style={[styles.walletInfoBox, { 
                  backgroundColor: walletBalance >= strategyPrice 
                    ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#D1FAE5')
                    : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2')
                }]}>
                  <View style={styles.walletInfoRow}>
                    <Text style={[styles.walletInfoLabel, { color: theme.textSecondary }]}>Wallet Balance:</Text>
                    <Text style={[styles.walletInfoValue, { 
                      color: walletBalance >= strategyPrice ? theme.success : theme.error 
                    }]}>₹{walletBalance.toFixed(2)}</Text>
                  </View>
                  {walletBalance < strategyPrice && (
                    <Text style={[styles.walletWarning, { color: theme.error }]}>
                      Insufficient balance. Need ₹{(strategyPrice - walletBalance).toFixed(2)} more.
                    </Text>
                  )}
                </View>
              )}

              {/* What You Get Section */}
              <View style={[styles.whatYouGetBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#D1FAE5' }]}>
                <View style={styles.whatYouGetHeader}>
                  <CheckCircle size={20} color={theme.success} weight="fill" />
                  <Text style={[styles.whatYouGetTitle, { color: theme.success }]}>What You Get</Text>
                </View>
                <View style={styles.bulletList}>
                  <Text style={[styles.bulletItem, { color: theme.success }]}>• 30 days of strategy access</Text>
                  <Text style={[styles.bulletItem, { color: theme.success }]}>• Automatic trade execution</Text>
                  <Text style={[styles.bulletItem, { color: theme.success }]}>• Real-time signal updates</Text>
                  <Text style={[styles.bulletItem, { color: theme.success }]}>• Auto-renewal option</Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowSubscribeModal(false)}
                disabled={isSubscribing}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubscribeBtn, { 
                  backgroundColor: isSubscribing || (strategyPrice > 0 && walletBalance < strategyPrice) 
                    ? (isDark ? '#1a1a35' : '#E2E8F0') 
                    : theme.primary 
                }]}
                onPress={handleSubscribe}
                disabled={isSubscribing || (strategyPrice > 0 && walletBalance < strategyPrice)}
              >
                {isSubscribing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={18} color="#fff" weight="fill" />
                    <Text style={styles.modalSubscribeText}>
                      {strategyPrice > 0 ? `Pay ₹${strategyPrice}` : 'Subscribe Now'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1 
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    letterSpacing: -0.3,
    flex: 1,
  },
  closeBtn: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },
  metricsScroll: {
    marginBottom: 16,
  },
  metricsScrollContent: {
    paddingRight: 16,
    gap: 12,
  },
  metricCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricValue: {
    fontSize:17,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  metricsGrid: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metricItem: {
    flex: 1,
  },
  metricItemLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricItemValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  winLossRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tableEmptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 6,
  },
  footerInline: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    marginTop: 16,
  },
  closeButton: {
    flex: 0.48,
    marginHorizontal:8,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  subscribeButton: {
    flex: 0.48,
    marginHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(16,24,40,0.06)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalStrategyName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  modalTags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  modalTag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  modalTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subscriptionDetailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'flex-start',
  },
  detailIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  whatYouGetBox: {
    borderRadius: 12,
    padding: 18,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#E8FFFB',
  },
  walletInfoBox: {
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  walletInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  walletInfoValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  walletWarning: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  whatYouGetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  whatYouGetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'android' ? 20 : 0,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalSubscribeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  modalSubscribeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

});


