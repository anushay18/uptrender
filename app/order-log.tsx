import { useTheme } from '@/context/ThemeContext';
import { tradeService } from '@/services';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

type OrderStatus = 'All Orders' | 'Executed' | 'Pending' | 'Rejected';

export default function OrderLogScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const tradeId = params.id as string;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('All Orders');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [orderExecutions, setOrderExecutions] = useState<any[]>([]);
  const [tradeDetails, setTradeDetails] = useState<any>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const theme = {
    bg: isDark ? '#0a0a0f' : '#f8f9fc',
    cardBg: isDark ? 'rgba(30,30,58,0.8)' : '#fff',
    text: isDark ? '#fff' : '#1f2937',
    textSecondary: isDark ? '#a1a1aa' : '#6b7280',
    titleColor: isDark ? '#818cf8' : '#5B7FFF',
    borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.08)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
  };

  // Fetch trades from API
  const fetchTrades = useCallback(async () => {
    try {
      if (tradeId) {
        // Fetch specific trade details
        const response = await tradeService.getTradeById(parseInt(tradeId));
        if (response.success && response.data) {
          const t = response.data;
          setTradeDetails({
            symbol: t.symbol,
            strategy: t.strategyName || '',
            type: t.type,
            filledQty: t.amount || 1,
            avgFillPrice: t.price || 0,
            entryPrice: t.price || 0,
            exitPrice: t.currentPrice || 0,
            status: t.status,
            signalReceived: new Date(t.signalReceivedAt || t.createdAt).toLocaleString(),
            payload: JSON.stringify(t.signalPayload || {}),
            brokerResult: t.status,
            brokerError: t.brokerResponseJson?.error || '—',
            brokerResponse: JSON.stringify(t.brokerResponseJson || {}),
            mtm: t.pnl || 0,
            created: new Date(t.createdAt).toLocaleString(),
            lastUpdated: new Date(t.updatedAt).toLocaleString(),
            tradeId: String(t.id),
          });
        }
      } else {
        // Fetch all trades (no limit - get everything)
        const response = await tradeService.getTrades({ limit: 100 });
        if (response.success && response.data) {
          setOrderExecutions(response.data.map((t: any) => {
            // Map backend status to frontend display values
            let displayStatus = 'UNKNOWN';
            if (t.status === 'Completed') displayStatus = 'EXECUTED';
            else if (t.status === 'Pending' || t.status === 'Open') displayStatus = 'OPEN';
            else if (t.status === 'Failed' || t.status === 'Rejected') displayStatus = 'REJECTED';
            else if (t.status === 'Closed') displayStatus = 'EXECUTED';
            else displayStatus = t.status?.toUpperCase() || 'UNKNOWN';

            // Extract broker response - prioritize error messages for failed orders
            let brokerMsg = 'N/A';
            if (displayStatus === 'REJECTED') {
              // For rejected orders, prioritize error messages
              if (t.brokerError) {
                brokerMsg = t.brokerError;
              } else if (t.brokerResponseJson) {
                if (typeof t.brokerResponseJson === 'string') {
                  brokerMsg = t.brokerResponseJson;
                } else if (t.brokerResponseJson.error) {
                  brokerMsg = t.brokerResponseJson.error;
                } else if (t.brokerResponseJson.message) {
                  brokerMsg = t.brokerResponseJson.message;
                } else {
                  brokerMsg = JSON.stringify(t.brokerResponseJson);
                }
              } else if (t.brokerResponse) {
                brokerMsg = t.brokerResponse;
              } else {
                brokerMsg = 'Order rejected';
              }
            } else if (t.brokerResponseJson) {
              if (typeof t.brokerResponseJson === 'string') {
                brokerMsg = t.brokerResponseJson;
              } else if (t.brokerResponseJson.message) {
                brokerMsg = t.brokerResponseJson.message;
              } else if (t.brokerResponseJson.status) {
                brokerMsg = t.brokerResponseJson.status;
              } else {
                brokerMsg = JSON.stringify(t.brokerResponseJson);
              }
            } else if (t.brokerResponse) {
              brokerMsg = t.brokerResponse;
            } else if (displayStatus === 'EXECUTED') {
              brokerMsg = 'Order executed successfully';
            } else if (displayStatus === 'OPEN') {
              brokerMsg = 'Order pending';
            }

            return {
              id: String(t.id),
              symbol: t.symbol,
              side: t.type,
              qty: t.amount || 1,
              orderId: t.orderId || '—',
              status: displayStatus,
              fillPrice: t.price,
              brokerResponse: brokerMsg,
              brokerResponseRaw: t.brokerResponseJson || t.brokerResponse || null,
              timestamp: new Date(t.createdAt).toLocaleString(),
              fillQty: t.amount || '—',
              avgFillPrice: t.price || '—',
            };
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
      // No fallback - show error state in UI
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setVisibleCount(10); // Reset to showing 10 orders on refresh
    }
  }, [tradeId]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTrades();
  }, [fetchTrades]);

  // If tradeId is provided, show trade details
  if (tradeId && (tradeDetails || TRADE_DETAILS[tradeId])) {
    const trade = tradeDetails || TRADE_DETAILS[tradeId];
    
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Trade Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#5B7FFF" />
          }
        >
          {/* Symbol & Strategy */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SYMBOL & STRATEGY</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>{trade.symbol}</Text>
          </View>

          {/* Trade Type */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TRADE TYPE</Text>
            <View style={[styles.typeBadge, { 
              backgroundColor: trade.type === 'Buy' ? '#10B98120' : '#EF444420'
            }]}>
              <Text style={[styles.typeBadgeText, { 
                color: trade.type === 'Buy' ? '#10B981' : '#EF4444'
              }]}>{trade.type}</Text>
            </View>
          </View>

          {/* Execution Summary */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>EXECUTION SUMMARY</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>FILLED QTY</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{trade.filledQty.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>AVG FILL PRICE</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>₹{trade.avgFillPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>ENTRY PRICE</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>₹{trade.entryPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>EXIT PRICE</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>₹{trade.exitPrice.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Status */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>STATUS</Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: trade.status === 'Completed' ? '#10B98120' : '#94A3B820'
            }]}>
              <Text style={[styles.statusBadgeText, { 
                color: trade.status === 'Completed' ? '#10B981' : '#94A3B8'
              }]}>{trade.status}</Text>
            </View>
          </View>

          {/* Signal Received */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SIGNAL RECEIVED</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>Time: {trade.signalReceived}</Text>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>Payload:</Text>
            <View style={[styles.codeBlock, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f3f4f6' }]}>
              <Text style={[styles.codeText, { color: theme.text }]}>{trade.payload}</Text>
            </View>
          </View>

          {/* Broker Response */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>BROKER RESPONSE</Text>
            <View style={styles.brokerResponseRow}>
              <Text style={[styles.brokerLabel, { color: theme.textSecondary }]}>Result:</Text>
              <Text style={[styles.brokerValue, { color: theme.text }]}>{trade.brokerResult}</Text>
            </View>
            <View style={styles.brokerResponseRow}>
              <Text style={[styles.brokerLabel, { color: theme.textSecondary }]}>Error:</Text>
              <Text style={[styles.brokerValue, { color: theme.text }]}>{trade.brokerError}</Text>
            </View>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>Raw Response:</Text>
            <View style={[styles.codeBlock, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f3f4f6' }]}>
              <Text style={[styles.codeText, { color: theme.text }]}>{trade.brokerResponse}</Text>
            </View>
          </View>

          {/* Profit & Loss */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PROFIT & LOSS</Text>
            <Text style={[styles.mtmValue, { color: trade.mtm >= 0 ? '#10B981' : '#EF4444' }]}>
              {trade.mtm >= 0 ? '+' : ''}₹{trade.mtm.toFixed(2)}
            </Text>
          </View>

          {/* Timeline */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TIMELINE</Text>
            <View style={styles.timelineRow}>
              <Text style={[styles.timelineLabel, { color: theme.textSecondary }]}>Created:</Text>
              <Text style={[styles.timelineValue, { color: theme.text }]}>{trade.created}</Text>
            </View>
            <View style={styles.timelineRow}>
              <Text style={[styles.timelineLabel, { color: theme.textSecondary }]}>Last Updated:</Text>
              <Text style={[styles.timelineValue, { color: theme.text }]}>{trade.lastUpdated}</Text>
            </View>
          </View>

          {/* Trade ID */}
          <View style={[styles.detailSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TRADE ID</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>{trade.tradeId}</Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeButtonBottom}
            onPress={() => router.back()}
          >
            <LinearGradient
              colors={['#5B7FFF', '#4C68E8']}
              style={styles.closeButtonGradient}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Default order log view
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  // Use API data only
  const ordersData = orderExecutions;
  
  const filteredOrders = ordersData.filter(order => {
    if (selectedStatus !== 'All Orders' && order.status.toLowerCase() !== selectedStatus.toLowerCase()) {
      return false;
    }
    if (searchQuery) {
      return order.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
             order.orderId.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });
  
  const stats = [
    { label: 'Total Orders', value: ordersData.length, icon: 'document-text', color: '#5B7FFF' },
    { label: 'Executed', value: ordersData.filter(o => o.status === 'EXECUTED' || o.status === 'COMPLETED').length, icon: 'checkmark-circle', color: '#10B981' },
    { label: 'Pending', value: ordersData.filter(o => o.status === 'PENDING' || o.status === 'OPEN').length, icon: 'time', color: '#F59E0B' },
    { label: 'Rejected', value: ordersData.filter(o => o.status === 'REJECTED' || o.status === 'FAILED').length, icon: 'close-circle', color: '#EF4444' },
  ];
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXECUTED': 
      case 'COMPLETED': return '#10B981';
      case 'PENDING':
      case 'OPEN': return '#F59E0B';
      case 'REJECTED': 
      case 'FAILED': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Display orders with pagination
  const displayOrders = filteredOrders.slice(0, visibleCount);
  const hasMoreOrders = filteredOrders.length > visibleCount;
  
  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  const statusOptions: OrderStatus[] = ['All Orders', 'Executed', 'Pending', 'Rejected'];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Order Log</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#5B7FFF"
            colors={['#5B7FFF']}
          />
        }
      >
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <Ionicons name={isRefreshing ? "sync" : "refresh"} size={18} color={theme.titleColor} />
            <Text style={[styles.actionBtnText, { color: theme.titleColor }]}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Ionicons name="download-outline" size={18} color={theme.titleColor} />
            <Text style={[styles.actionBtnText, { color: theme.titleColor }]}>Export Log</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}20` }]}>
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Search and Filter */}
        <View style={styles.searchFilterContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by symbol or order ID..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={() => setShowStatusDropdown(true)}
          >
            <Ionicons name="filter" size={20} color={theme.titleColor} />
            <Text style={[styles.filterBtnText, { color: theme.titleColor }]}>
              Status: {selectedStatus}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order List Section */}
        <View style={[styles.orderListSection, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.orderListHeader}>
            <Ionicons name="document-text" size={24} color={theme.text} />
            <Text style={[styles.orderListTitle, { color: theme.text }]}>Order Execution Log ({filteredOrders.length})</Text>
          </View>
          <Text style={[styles.orderListSubtitle, { color: theme.textSecondary }]}>
            Real-time broker responses and order execution details
          </Text>

          {/* Loading State */}
          {isLoading && displayOrders.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#5B7FFF" />
              <Text style={[{ color: theme.textSecondary, marginTop: 12 }]}>Loading orders...</Text>
            </View>
          ) : displayOrders.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
              <Text style={[{ color: theme.textSecondary, marginTop: 12, fontSize: 16 }]}>No orders found</Text>
            </View>
          ) : (
            <View style={styles.orderCardsContainer}>
              {displayOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const fillPriceNum = typeof order.fillPrice === 'number' ? order.fillPrice : Number(order.fillPrice);
                const hasFillPrice = Number.isFinite(fillPriceNum);
                return (
                  <View key={order.id} style={[styles.orderCard, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                    {/* Order Header */}
                    <TouchableOpacity 
                      style={styles.orderCardHeader}
                      onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      <View style={styles.orderHeaderLeft}>
                        <Text style={[styles.orderSymbol, { color: theme.text }]}>
                          {order.symbol} - {order.side}
                        </Text>
                        <Text style={[styles.orderQty, { color: theme.textSecondary }]}>
                          Qty: {order.qty} @ {hasFillPrice ? fillPriceNum.toFixed(2) : '—'}
                        </Text>
                        <Text style={[styles.orderIdText, { color: theme.textSecondary }]}>
                          Order ID: {order.orderId}
                        </Text>
                      </View>
                      <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={20} 
                        color={theme.textSecondary} 
                      />
                    </TouchableOpacity>

                    {/* Order Info Row */}
                    <View style={styles.orderInfoRow}>
                      <View style={styles.orderInfoColumn}>
                        <Text style={[styles.orderInfoLabel, { color: theme.textSecondary }]}>Execution Status</Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
                          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                            {order.status}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.orderInfoColumn}>
                        <Text style={[styles.orderInfoLabel, { color: theme.textSecondary }]}>Broker Response</Text>
                        <Text style={[styles.brokerResponseText, { color: theme.text }]} numberOfLines={2}>
                          {order.brokerResponse}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom Row: Fill and Timestamp */}
                    <View style={styles.orderBottomRow}>
                      <View style={styles.fillContainer}>
                        {hasFillPrice && (
                          <Text style={[styles.fillPriceText, { color: getStatusColor(order.status) }]}>
                            Fill: {fillPriceNum.toFixed(2)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.timestampContainer}>
                        <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
                          {order.timestamp.split(' ')[0]} {order.timestamp.split(' ')[1]}
                        </Text>
                      </View>
                    </View>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <View style={[styles.expandedSection, { borderTopColor: theme.borderColor }]}>
                        {/* Execution Summary */}
                        <View style={styles.summarySection}>
                          <Text style={[styles.summaryTitle, { color: theme.textSecondary }]}>EXECUTION SUMMARY</Text>
                          <View style={styles.summaryGrid}>
                            <View style={styles.summaryItem}>
                              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Symbol:</Text>
                              <Text style={[styles.summaryValue, { color: theme.text }]}>{order.symbol}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Side:</Text>
                              <Text style={[styles.summaryValue, { color: theme.text }]}>{order.side}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Order ID:</Text>
                              <Text style={[styles.summaryValue, { color: theme.text }]}>{order.orderId}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Status:</Text>
                              <Text style={[styles.summaryValue, { color: theme.text }]}>Completed</Text>
                            </View>
                            <View style={styles.summaryItem}>
                              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Fill Qty:</Text>
                              <Text style={[styles.summaryValue, { color: theme.text }]}>{order.fillQty}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Avg Fill Price:</Text>
                              <Text style={[styles.summaryValue, { color: theme.text }]}>
                                {typeof order.avgFillPrice === 'number' ? order.avgFillPrice.toFixed(2) : order.avgFillPrice}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Broker Response */}
                        <View style={styles.brokerSection}>
                          <Text style={[styles.summaryTitle, { color: theme.textSecondary }]}>BROKER RESPONSE</Text>
                          {/* Try to render structured fields if available */}
                          {(() => {
                            const raw = order.brokerResponseRaw;
                            let parsed: any = null;
                            if (raw && typeof raw === 'string') {
                              try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
                            } else {
                              parsed = raw;
                            }

                            if (parsed && typeof parsed === 'object') {
                              return (
                                <View>
                                  {parsed.status !== undefined && (
                                    <View style={styles.brokerItem}>
                                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>status</Text>
                                      <Text style={[styles.summaryValue, { color: theme.text }]}>{String(parsed.status)}</Text>
                                    </View>
                                  )}
                                  {parsed.message !== undefined && (
                                    <View style={styles.brokerItem}>
                                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>message</Text>
                                      <Text style={[styles.summaryValue, { color: theme.text }]}>{String(parsed.message)}</Text>
                                    </View>
                                  )}
                                  {parsed.orderId !== undefined && (
                                    <View style={styles.brokerItem}>
                                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>orderId</Text>
                                      <Text style={[styles.summaryValue, { color: theme.text }]}>{String(parsed.orderId)}</Text>
                                    </View>
                                  )}
                                  {parsed.error !== undefined && (
                                    <View style={{ marginTop: 12 }}>
                                      <View style={styles.warningBox}>
                                        <Text style={[styles.warningText, { color: '#b91c1c' }]}>{String(parsed.error)}</Text>
                                      </View>
                                    </View>
                                  )}
                                </View>
                              );
                            }

                            // If parsed is a string or we only have a friendly brokerResponse, show it
                            return (
                              <View>
                                <Text style={[styles.summaryValue, { color: theme.text }]} numberOfLines={3}>{order.brokerResponse}</Text>
                                {order.status === 'REJECTED' && order.brokerResponse && (
                                  <View style={{ marginTop: 12 }}>
                                    <View style={styles.warningBox}>
                                      <Text style={[styles.warningText, { color: '#b91c1c' }]}>{order.brokerResponse}</Text>
                                    </View>
                                  </View>
                                )}
                              </View>
                            );
                          })()}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              
              {/* Load More Button */}
              {hasMoreOrders && (
                <TouchableOpacity 
                  style={[styles.loadMoreBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  onPress={handleLoadMore}
                >
                  <Text style={[styles.loadMoreText, { color: theme.titleColor }]}>Load More</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.titleColor} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Status Dropdown Modal */}
      <Modal
        visible={showStatusDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusDropdown(false)}
        >
          <View style={[styles.dropdownContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            {statusOptions.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: theme.borderColor },
                  selectedStatus === status && { backgroundColor: `${theme.titleColor}20` },
                ]}
                onPress={() => {
                  setSelectedStatus(status);
                  setShowStatusDropdown(false);
                }}
              >
                <Text style={[styles.dropdownItemText, { color: theme.text }]}>{status}</Text>
                {selectedStatus === status && (
                  <Ionicons name="checkmark" size={20} color={theme.titleColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  backButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  // Trade Details Styles
  detailSection: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    width: '47%',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  codeBlock: {
    padding: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  codeText: {
    fontSize:10,
    fontFamily: 'monospace',
    lineHeight:8,
  },
  brokerResponseRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  brokerLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 60,
  },
  brokerValue: {
    fontSize: 12,
    flex: 1,
  },
  mtmValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 100,
  },
  timelineValue: {
    fontSize: 12,
  },
  closeButtonBottom: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Existing styles
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
  },
  searchFilterContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 4 : 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderListSection: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  orderListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  orderListTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  orderListSubtitle: {
    fontSize: 13,
    marginBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateDesc: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  orderCardsContainer: {
    marginTop: 16,
  },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderSymbol: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  orderQty: {
    fontSize: 12,
    marginBottom: 2,
  },
  orderIdText: {
    fontSize: 11,
  },
  orderInfoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  orderInfoColumn: {
    flex: 1,
  },
  orderInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  brokerResponseText: {
    fontSize: 10,
    lineHeight: 12,
  },
  orderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  fillContainer: {
    flex: 1,
  },
  fillPriceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestampText: {
    fontSize: 11,
  },
  expandedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  brokerSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  brokerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
