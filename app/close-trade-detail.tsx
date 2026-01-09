import { borderRadius, colors, getTheme, shadows, spacing } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { paperPositionService, tradeService } from '@/services';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    TrendDown,
    TrendUp,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function CloseTradeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const [trade, setTrade] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch trade details from API
  const fetchTradeDetails = useCallback(async () => {
    try {
      const tradeId = params.id;
      if (!tradeId) {
        setIsLoading(false);
        return;
      }
      
      console.log('Fetching trade details for ID:', tradeId);
      const response = await tradeService.getTradeById(parseInt(tradeId));
      console.log('Trade response:', response);
      if (response.success && response.data) {
        setTrade(response.data);
      } else {
        // Fallback to paper positions for completed trades
        console.log('Trade not found, trying paper positions for ID:', tradeId);
        const paperResp = await paperPositionService.getPositionById(parseInt(tradeId));
        console.log('Paper position response:', paperResp);
        if (paperResp.success && paperResp.data) {
          // Map paper position fields to trade-like format
          const pos = paperResp.data as any;
          setTrade({
            ...pos,
            filledQuantity: pos.volume,
            avgFillPrice: pos.openPrice,
            openPrice: pos.openPrice,
            closePrice: pos.closePrice || pos.currentPrice,
            profit: pos.profit || pos.realizedProfit,
            pnl: pos.profit || pos.realizedProfit,
            strategyName: pos.strategy?.name || pos.strategyName,
            status: pos.status === 'Closed' || pos.status === 'SL_Hit' || pos.status === 'TP_Hit' ? 'Completed' : pos.status,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching trade details:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchTradeDetails();
  }, [fetchTradeDetails]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTradeDetails();
  }, [fetchTradeDetails]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Loading trade details...</Text>
      </View>
    );
  }

  if (!trade) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.text }}>Trade not found</Text>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profit = Number(trade.profit || trade.pnl || 0);
  const isProfitable = profit >= 0;

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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Trade Details</Text>
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
        {/* Symbol & Strategy Section */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SYMBOL & STRATEGY</Text>
          <Text style={[styles.symbolText, { color: theme.text }]}>{trade.symbol}</Text>
          <Text style={[styles.strategyText, { color: theme.textSecondary }]}>
            Strategy: {trade.strategyName || trade.strategy?.name || 'Manual Trade'}
          </Text>
        </View>

        {/* Trade Type */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TRADE TYPE</Text>
          <LinearGradient
            colors={trade.type === 'Buy' 
              ? ['rgba(16, 185, 129, 0.25)', 'rgba(16, 185, 129, 0.15)'] 
              : ['rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.15)']}
            style={styles.typeBadge}
          >
            <Text style={[styles.typeBadgeText, { 
              color: trade.type === 'Buy' ? colors.success : colors.error 
            }]}>
              {trade.type}
            </Text>
          </LinearGradient>
        </View>

        {/* Execution Summary */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>EXECUTION SUMMARY</Text>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>FILLED QTY</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {Number(trade.filledQuantity || trade.amount || trade.volume || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>AVG FILL PRICE</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  ₹{Number(trade.avgFillPrice || trade.price || 0).toFixed(2)}
                </Text>
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>ENTRY PRICE</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  ₹{Number(trade.openPrice || trade.price || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>EXIT PRICE</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  ₹{Number(trade.closePrice || trade.currentPrice || 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Status */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>STATUS</Text>
          <LinearGradient
            colors={trade.status === 'Completed' || trade.status === 'Closed'
              ? ['rgba(16, 185, 129, 0.25)', 'rgba(16, 185, 129, 0.15)']
              : ['rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.15)']}
            style={styles.statusBadge}
          >
            <Text style={[styles.statusBadgeText, { 
              color: trade.status === 'Completed' || trade.status === 'Closed' ? colors.success : colors.error 
            }]}>
              {trade.status}
            </Text>
          </LinearGradient>
        </View>

        {/* Signal Received */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SIGNAL RECEIVED</Text>
          
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: theme.text }]}>Time: </Text>
            <Text style={[styles.timeValue, { color: theme.textSecondary }]}>
              {new Date(trade.signalReceivedAt || trade.openTime || trade.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          
          {trade.signalPayload && (
            <>
              <Text style={[styles.payloadLabel, { color: theme.text, marginTop: spacing.md }]}>Payload:</Text>
              <View style={[styles.codeBlock, {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)',
              }]}>
                <Text style={[styles.codeText, { color: theme.textSecondary }]}>
                  {typeof trade.signalPayload === 'string' ? trade.signalPayload : JSON.stringify(trade.signalPayload, null, 2)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Broker Response */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>BROKER RESPONSE</Text>
          
          <View style={styles.responseItem}>
            <Text style={[styles.responseLabel, { color: theme.text }]}>Result: </Text>
            <Text style={[styles.responseValue, { color: theme.textSecondary }]}>
              {trade.brokerResponseJson?.result || trade.brokerStatus || 'NOT_CONNECTED'}
            </Text>
          </View>
          
          {(trade.brokerResponseJson?.error || trade.signalSendError) && (
            <View style={styles.responseItem}>
              <Text style={[styles.responseLabel, { color: theme.text }]}>Error: </Text>
              <Text style={[styles.responseValue, { color: colors.error }]}>
                {trade.brokerResponseJson?.error || trade.signalSendError}
              </Text>
            </View>
          )}
          
          {trade.brokerResponseJson?.rawResponse && (
            <>
              <Text style={[styles.payloadLabel, { color: theme.text, marginTop: spacing.md }]}>Raw Response:</Text>
              <View style={[styles.codeBlock, {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)',
              }]}>
                <Text style={[styles.codeText, { color: theme.textSecondary }]}>
                  {trade.brokerResponseJson?.rawResponse}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Profit & Loss */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PROFIT & LOSS</Text>
          <View style={styles.pnlRow}>
            {isProfitable ? (
              <TrendUp size={20} color={colors.success} weight="bold" />
            ) : (
              <TrendDown size={20} color={colors.error} weight="bold" />
            )}
            <Text style={[styles.pnlValue, { color: isProfitable ? colors.success : colors.error }]}>
              {isProfitable ? '+' : ''}₹{profit.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TIMELINE</Text>
          
          <View style={styles.timelineItem}>
            <Text style={[styles.timelineLabel, { color: theme.text }]}>Created: </Text>
            <Text style={[styles.timelineValue, { color: theme.textSecondary }]}>
              {new Date(trade.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          
          <View style={styles.timelineItem}>
            <Text style={[styles.timelineLabel, { color: theme.text }]}>Last Updated: </Text>
            <Text style={[styles.timelineValue, { color: theme.textSecondary }]}>
              {new Date(trade.updatedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Trade ID */}
        <View style={[styles.section, {
          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TRADE ID</Text>
          <Text style={[styles.tradeId, { color: theme.text }]}>{trade.id}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingLeft: 5
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  section: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadows.sm,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  symbolText: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  strategyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryGrid: {
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  payloadLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  codeBlock: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  responseItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  responseValue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pnlValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  tradeId: {
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
});
