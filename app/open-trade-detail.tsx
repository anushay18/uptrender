import { borderRadius, colors, getTheme, shadows, spacing } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { paperPositionService } from '@/services';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Bank,
    ChartLineUp,
    Clock,
    Lightning,
    TrendDown,
    TrendUp,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

// Sample data - in real app this would come from API/state
const POSITION_DATA: Record<string, any> = {
  '1': {
    id: 1,
    symbol: 'BTCUSD',
    type: 'Buy',
    qty: 1.00,
    entryPrice: 87464.95,
    ltp: 88979.55,
    mtm: 1514.60,
    status: 'Open',
    time: 'Dec 25, 03:56 PM',
    strategyName: 'NIFTY Strategies Basket V2',
    broker: 'TT Paper Trading',
    takeProfit: 90000.00,
    stopLoss: 85000.00,
  },
  '2': {
    id: 2,
    symbol: 'BTCUSD',
    type: 'Sell',
    qty: 1.00,
    entryPrice: 86850.65,
    ltp: 88979.55,
    mtm: -2128.90,
    status: 'Open',
    time: 'Dec 23, 08:30 PM',
    strategyName: 'BankNifty Options Strategy',
    broker: 'Zerodha',
    takeProfit: 84000.00,
    stopLoss: 89000.00,
  },
  '3': {
    id: 3,
    symbol: 'EURUSD',
    type: 'Buy',
    qty: 0.5,
    entryPrice: 1.0845,
    ltp: 1.0892,
    mtm: 235.00,
    status: 'Open',
    time: 'Dec 26, 10:15 AM',
    strategyName: 'NIFTY Strategies Basket V2',
    broker: 'TT Paper Trading',
    takeProfit: 1.1000,
    stopLoss: 1.0700,
  },
};

export default function OpenTradeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const [position, setPosition] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch position from API
  const fetchPosition = useCallback(async () => {
    try {
      const positionId = params.id;
      if (!positionId) {
        // Fallback to mock data
        setPosition(POSITION_DATA['1']);
        return;
      }
      
      // Fetch all open positions and find the one we need
      const response = await paperPositionService.getOpenPositions();
      if (response.success && response.data) {
        const pos = response.data.find(p => p.id.toString() === positionId);
        if (pos) {
          setPosition({
            id: pos.id,
            symbol: pos.symbol,
            type: pos.type === 'Buy' ? 'Buy' : 'Sell',
            qty: Number(pos.volume) || 0,
            entryPrice: Number(pos.openPrice) || 0,
            ltp: Number(pos.currentPrice || pos.closePrice || pos.openPrice) || 0,
            mtm: Number(pos.profit) || 0,
            status: pos.status === 'Open' ? 'Open' : 'Closed',
            time: new Date(pos.openTime || pos.createdAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            strategyName: pos.strategy?.name || pos.strategyName || 'Manual Trade',
            broker: 'Paper Trading',
            takeProfit: Number(pos.takeProfit) || 0,
            stopLoss: Number(pos.stopLoss) || 0,
          });
          return;
        }
      }
      
      // Try closed positions
      const historyResponse = await paperPositionService.getPositionHistory();
      if (historyResponse.success && historyResponse.data) {
        const pos = historyResponse.data.find(p => p.id.toString() === positionId);
        if (pos) {
          setPosition({
            id: pos.id,
            symbol: pos.symbol,
            type: pos.type === 'Buy' ? 'Buy' : 'Sell',
            qty: Number(pos.volume) || 0,
            entryPrice: Number(pos.openPrice) || 0,
            ltp: Number(pos.currentPrice || pos.closePrice || pos.openPrice) || 0,
            exitPrice: Number(pos.closePrice || pos.openPrice) || 0,
            mtm: Number(pos.profit || pos.realizedProfit) || 0,
            status: 'Closed',
            time: new Date(pos.closeTime || pos.openTime || pos.createdAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            entryTime: new Date(pos.openTime || pos.createdAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            strategyName: pos.strategy?.name || pos.strategyName || 'Manual Trade',
            broker: 'Paper Trading',
            takeProfit: Number(pos.takeProfit) || 0,
            stopLoss: Number(pos.stopLoss) || 0,
          });
          return;
        }
      }
      
      // Fallback to mock data
      setPosition(POSITION_DATA[positionId] || POSITION_DATA['1']);
    } catch (error) {
      console.error('Error fetching position:', error);
      // Fallback to mock data
      setPosition(POSITION_DATA[params.id || '1']);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchPosition();
  }, [fetchPosition]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Loading position...</Text>
      </View>
    );
  }

  if (!position) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Position not found</Text>
      </View>
    );
  }

  const mtmValue = Number(position.mtm) || 0;
  const profitPercent = ((mtmValue / (position.entryPrice * position.qty)) * 100).toFixed(2);
  const isProfitable = mtmValue >= 0;
  const ltpValue = Number(position.exitPrice || position.ltp) || 0;
  const tpDistance = position.takeProfit && ltpValue > 0 ? Math.abs(((position.takeProfit - ltpValue) / ltpValue) * 100).toFixed(2) : '0.00';
  const slDistance = position.stopLoss && ltpValue > 0 ? Math.abs(((position.stopLoss - ltpValue) / ltpValue) * 100).toFixed(2) : '0.00';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderBottomColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
      }]}>
        <TouchableOpacity 
          style={[styles.backButton, {
            backgroundColor: isDark ? 'rgba(10, 10, 26, 0.6)' : 'rgba(241, 245, 249, 0.8)',
          }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {/* <Text style={[styles.headerTitle, { color: theme.text }]}>Position Detail</Text> */}
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{position.symbol}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* MTM Card */}
        <LinearGradient
          colors={isProfitable 
            ? isDark 
              ? ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.05)']
              : ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.05)']
            : isDark
              ? ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.05)']
              : ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']
          }
          style={[styles.mtmCard, {
            borderColor: isProfitable 
              ? isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'
              : isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
          }]}
        >
          <View style={styles.mtmHeader}>
            <Text style={[styles.mtmLabel, { color: theme.textSecondary }]}>Current P&L</Text>
            <View style={[styles.mtmBadge, {
              backgroundColor: isProfitable ? colors.success + '20' : colors.error + '20',
            }]}>
              {isProfitable ? (
                <TrendUp size={14} color={colors.success} weight="bold" />
              ) : (
                <TrendDown size={14} color={colors.error} weight="bold" />
              )}
              <Text style={[styles.mtmPercentText, { 
                color: isProfitable ? colors.success : colors.error 
              }]}>
                {profitPercent}%
              </Text>
            </View>
          </View>
          <Text style={[styles.mtmValue, { 
            color: isProfitable ? colors.success : colors.error 
          }]}>
            {isProfitable ? '+' : ''}{mtmValue.toFixed(2)} USD
          </Text>
        </LinearGradient>

        {/* Position Info Card */}
        <View style={[styles.card, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Position Information</Text>
            <LinearGradient
              colors={position.type === 'Buy' 
                ? ['rgba(16, 185, 129, 0.25)', 'rgba(16, 185, 129, 0.15)'] 
                : ['rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.15)']}
              style={styles.typeBadge}
            >
              <Text style={[styles.typeBadgeText, { 
                color: position.type === 'Buy' ? colors.success : colors.error 
              }]}>
                {position.type}
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Symbol</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{position.symbol}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Quantity</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{Number(position.qty || 0).toFixed(4)}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Entry Price</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{Number(position.entryPrice || 0).toFixed(4)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  {position.status === 'Closed' ? 'Exit Price' : 'Current Price'}
                </Text>
                <Text style={[styles.infoValue, { color: colors.primary }]}>
                  {Number(position.exitPrice || position.ltp || 0).toFixed(4)}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Status</Text>
                <View style={[styles.statusBadge, {
                  backgroundColor: position.status === 'Closed' ? colors.success + '20' : '#F59E0B' + '20',
                }]}>
                  <Text style={[styles.statusText, { color: position.status === 'Closed' ? colors.success : '#F59E0B' }]}>{position.status}</Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <View style={styles.timeContainer}>
                  <Clock size={12} color={theme.textSecondary} weight="bold" />
                  <Text style={[styles.timeText, { color: theme.textSecondary }]}>{position.time}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* TP/SL Card */}
        <View style={[styles.card, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.lg }]}>
            Take Profit & Stop Loss
          </Text>

          {/* Take Profit */}
          <View style={[styles.tpSlContainer, {
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
            borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.15)',
          }]}>
            <View style={styles.tpSlHeader}>
              <View style={styles.tpSlLabelRow}>
                <View style={[styles.tpSlIcon, { backgroundColor: colors.success + '20' }]}>
                  <TrendUp size={16} color={colors.success} weight="bold" />
                </View>
                <Text style={[styles.tpSlLabel, { color: theme.text }]}>Take Profit</Text>
              </View>
              <Text style={[styles.tpSlDistance, { color: colors.success }]}>+{tpDistance}%</Text>
            </View>
            <Text style={[styles.tpSlValue, { color: colors.success }]}>
              {Number(position.takeProfit || 0).toFixed(4)}
            </Text>
          </View>

          {/* Stop Loss */}
          <View style={[styles.tpSlContainer, {
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
            borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)',
          }]}>
            <View style={styles.tpSlHeader}>
              <View style={styles.tpSlLabelRow}>
                <View style={[styles.tpSlIcon, { backgroundColor: colors.error + '20' }]}>
                  <TrendDown size={16} color={colors.error} weight="bold" />
                </View>
                <Text style={[styles.tpSlLabel, { color: theme.text }]}>Stop Loss</Text>
              </View>
              <Text style={[styles.tpSlDistance, { color: colors.error }]}>-{slDistance}%</Text>
            </View>
            <Text style={[styles.tpSlValue, { color: colors.error }]}>
              {Number(position.stopLoss || 0).toFixed(4)}
            </Text>
          </View>
        </View>

        {/* Strategy & Broker Card */}
        <View style={[styles.card, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.lg }]}>
            Additional Details
          </Text>

          <View style={styles.additionalInfo}>
            <View style={styles.additionalRow}>
              <View style={[styles.additionalIcon, { backgroundColor: colors.primary + '15' }]}>
                <ChartLineUp size={18} color={colors.primary} weight="duotone" />
              </View>
              <View style={styles.additionalContent}>
                <Text style={[styles.additionalLabel, { color: theme.textSecondary }]}>Strategy</Text>
                <Text style={[styles.additionalValue, { color: theme.text }]}>{position.strategyName}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.additionalRow}>
              <View style={[styles.additionalIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
                <Bank size={18} color="#8B5CF6" weight="duotone" />
              </View>
              <View style={styles.additionalContent}>
                <Text style={[styles.additionalLabel, { color: theme.textSecondary }]}>Broker</Text>
                <Text style={[styles.additionalValue, { color: theme.text }]}>{position.broker}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Close Button - Fixed at Bottom (only for open positions) */}
      {position.status !== 'Closed' && (
        <View style={[styles.bottomBar, {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderTopColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <TouchableOpacity style={styles.closeTradeButton}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.closeTradeGradient}
            >
              <Lightning size={18} color="#fff" weight="fill" />
              <Text style={styles.closeTradeText}>Close Position</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft:5
  },
  headerCenter: {
    flex: 1,
    // alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingRight:5
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  mtmCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 2,
  },
  mtmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mtmLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mtmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  mtmPercentText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mtmValue: {
    fontSize:18,
    fontWeight: '800',
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoGrid: {
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  tpSlContainer: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
  },
  tpSlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tpSlLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tpSlIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tpSlLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tpSlDistance: {
    fontSize: 11,
    fontWeight: '700',
  },
  tpSlValue: {
    fontSize:15,
    fontWeight: '800',
  },
  additionalInfo: {
    gap: spacing.md,
  },
  additionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  additionalIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  additionalContent: {
    flex: 1,
  },
  additionalLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  additionalValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 50 : 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'android' ? spacing.lg : spacing.xl + 10,
  },
  closeTradeButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  closeTradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  closeTradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
