import { colors } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { paperPositionService, tradeService } from '@/services';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

type DateRangeType = 'Today' | 'Week' | 'Month' | 'Year' | 'Custom';
type TabType = 'positions' | 'orders';

const MARKET_OPTIONS = ['Forex', 'Crypto', 'Indian'];
const BROKER_OPTIONS = [
  'Paper Trading',
  'MetaTrader 5',
  'FXCM',
  'IG Markets',
  'OANDA',
  'Binance',
  'Coinbase Pro',
  'KuCoin',
  'Kraken',
  'Zerodha',
  'Upstox',
  'Angel One',
  'ICICI Direct',
  'Delta Exchange',
];

export default function OrderHistoryScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeType>('Month');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showMarketFilter, setShowMarketFilter] = useState(false);
  const [showBrokerFilter, setShowBrokerFilter] = useState(false);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  
  // API Data States
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tradeStats, setTradeStats] = useState({
    totalTrades: 0,
    completedTrades: 0,
    pendingTrades: 0,
    failedTrades: 0,
    totalPnl: 0,
  });
  
  // Pagination states for Load More functionality
  const [positionsVisibleCount, setPositionsVisibleCount] = useState(6);
  const [ordersVisibleCount, setOrdersVisibleCount] = useState(6);

  // Calculate date range based on selection
  const getDateRange = useCallback(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    
    switch (selectedDateRange) {
      case 'Today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Set end to end of today (start of tomorrow)
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'Week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'Month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'Year':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'Custom':
        // Parse custom dates (DD/MM/YYYY format)
        const startParts = startDate.split('/');
        const endParts = endDate.split('/');
        if (startParts.length === 3 && endParts.length === 3) {
          start = new Date(parseInt(startParts[2]), parseInt(startParts[1]) - 1, parseInt(startParts[0]));
          // Add 1 day to end date to include the entire end day
          end = new Date(parseInt(endParts[2]), parseInt(endParts[1]) - 1, parseInt(endParts[0]) + 1);
        } else {
          start = new Date(now);
          start.setMonth(start.getMonth() - 1);
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        }
        break;
      default:
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [selectedDateRange, startDate, endDate]);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      const dateRange = getDateRange();
      
      // Build filters for API
      const filters: any = {
        limit: 100,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };
      
      // Add market filter if selected
      if (selectedMarkets.length === 1) {
        filters.market = selectedMarkets[0];
      }
      
      // Fetch from BOTH paper positions AND real trades
      const [openRes, historyRes, tradesRes] = await Promise.all([
        paperPositionService.getOpenPositions(filters),
        paperPositionService.getPositionHistory(filters),
        tradeService.getTrades(filters),
      ]);
      
      // Format open positions
      let mappedOpenPositions: any[] = [];
      if (openRes.success && openRes.data) {
        mappedOpenPositions = openRes.data.map((p: any) => ({
          id: String(p.id),
          strategyName: p.strategy?.name || p.strategyName || '-',
          symbol: p.symbol,
          market: p.market || 'Forex',
          type: p.type,
          volume: p.volume || 1,
          avgPrice: p.openPrice,
          mtm: p.profit || 0,
          date: new Date(p.openTime).toLocaleDateString(),
          broker: p.broker || 'Paper Trading',
          status: p.status,
          rawDate: p.openTime,
        }));
        setOpenPositions(mappedOpenPositions);
      }
      
      // Format historical paper orders (Completed/Closed orders)
      const paperOrders: any[] = [];
      if (historyRes.success && historyRes.data) {
        console.log('📊 [OrderHistory] Raw paper history data:', historyRes.data);
        historyRes.data.forEach((p: any) => {
          const orderDate = p.closeTime || p.openTime || p.createdAt || new Date().toISOString();
          paperOrders.push({
            id: `paper-${p.id}`,
            originalId: String(p.id),
            source: 'paper',
            market: p.market || 'Forex',
            symbol: p.symbol,
            type: p.type,
            amount: Number(p.volume ?? 1),
            entry: Number(p.openPrice ?? 0),
            current: Number(p.closePrice ?? p.currentPrice ?? 0),
            pnl: Number(p.realizedProfit ?? p.profit ?? 0),
            pnlPercent: Number(p.profitPercent ?? 0),
            status: p.status === 'Closed' ? 'Completed' : p.status,
            broker: p.broker || 'Paper Trading',
            date: new Date(orderDate).toLocaleDateString(),
            time: new Date(orderDate).toLocaleTimeString(),
            rawDate: orderDate,
            strategyName: p.strategy?.name || p.strategyName || '-',
          });
        });
      }
      
      // Format real trades - ONLY include Failed/non-paper orders to avoid duplicates
      // Paper completed orders are already in paperOrders from /paper-positions/history
      const realTrades: any[] = [];
      if (tradesRes.success && tradesRes.data) {
        console.log('📊 [OrderHistory] Raw trades data:', tradesRes.data);
        tradesRes.data.forEach((t: any) => {
          // Skip if this is a paper trade that's already covered by paper-positions
          // Only include Failed trades or real broker trades (not paper)
          const isPaperTrade = t.broker === 'Paper Trading' || t.broker === 'paper' || !t.broker;
          const isFailed = t.status === 'Failed';
          
          // Include if: it's a Failed trade OR it's a real broker trade (not paper)
          if (isFailed || (!isPaperTrade && t.status !== 'Closed' && t.status !== 'Completed')) {
            const orderDate = t.createdAt || t.date || new Date().toISOString();
            realTrades.push({
              id: `trade-${t.id}`,
              originalId: String(t.id),
              source: 'trade',
              market: t.market || 'Forex',
              symbol: t.symbol,
              type: t.type,
              amount: Number(t.amount ?? t.volume ?? 1),
              entry: Number(t.price ?? t.openPrice ?? 0),
              current: Number(t.currentPrice ?? t.closePrice ?? t.price ?? 0),
              pnl: Number(t.pnl ?? t.profit ?? 0),
              pnlPercent: Number(t.pnlPercentage ?? t.profitPercent ?? 0),
              status: t.status,
              broker: t.broker || 'Unknown',
              date: new Date(orderDate).toLocaleDateString(),
              time: new Date(orderDate).toLocaleTimeString(),
              rawDate: orderDate,
              strategyName: t.strategyName || t.strategy?.name || '-',
            });
          }
        });
      }
      
      // Combine both sources - no duplicates since we filtered realTrades
      const allOrders = [...paperOrders, ...realTrades];
      console.log('📊 [OrderHistory] Combined orders:', allOrders.length, 'Paper:', paperOrders.length, 'Trades:', realTrades.length);
      setOrders(allOrders);
      
      // Calculate stats from all data
      const openData = openRes.success && openRes.data ? openRes.data : [];
      const historyData = historyRes.success && historyRes.data ? historyRes.data : [];
      const tradesData = tradesRes.success && tradesRes.data ? tradesRes.data : [];

      // Count completed from paper positions
      const paperCompletedCount = historyData.filter((p: any) =>
        p.status === 'Closed' || p.status === 'TP_Hit' || p.status === 'Completed'
      ).length;

      // Count failed from real trades only (not paper)
      const tradeFailedCount = tradesData.filter((t: any) =>
        t.status === 'Failed'
      ).length;

      // Pending should count open positions that match current market/broker filters
      const pendingCount = mappedOpenPositions.filter((p: any) => {
        const matchesMarket = selectedMarkets.length === 0 || selectedMarkets.includes(p.market);
        const matchesBroker = selectedBrokers.length === 0 || selectedBrokers.includes(p.broker);
        const isOpen = p.status === 'Open';
        return matchesMarket && matchesBroker && isOpen;
      }).length;

      // Calculate total P&L from both sources
      const paperPnl = historyData.reduce((sum: number, p: any) => {
        const val = Number(p.realizedProfit ?? p.profit ?? 0);
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0);

      const tradePnl = tradesData.reduce((sum: number, t: any) => {
        const val = Number(t.pnl ?? t.profit ?? 0);
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0);

      // Total orders = completed paper orders + failed real trades + pending open positions
      const totalOrderCount = paperCompletedCount + tradeFailedCount + pendingCount;

      setTradeStats({
        totalTrades: totalOrderCount,
        completedTrades: paperCompletedCount,
        pendingTrades: pendingCount,
        failedTrades: tradeFailedCount,
        totalPnl: paperPnl + tradePnl,
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getDateRange, selectedMarkets, selectedBrokers]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const theme = {
    bg: isDark ? '#0a0a0f' : '#f8f9fc',
    cardBg: isDark ? 'rgba(30,30,58,0.8)' : '#fff',
    text: isDark ? '#fff' : '#1f2937',
    textSecondary: isDark ? '#a1a1aa' : '#6b7280',
    titleColor: isDark ? '#818cf8' : '#5B7FFF',
    borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.08)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  };

  const totalPnlValue = Number(tradeStats.totalPnl);
  const stats = [
    { label: 'Total Orders', value: tradeStats.totalTrades, icon: 'grid', color: '#5B7FFF' },
    { label: 'Completed', value: tradeStats.completedTrades, icon: 'checkmark-circle', color: theme.success },
    { label: 'Pending', value: tradeStats.pendingTrades, icon: 'hourglass', color: theme.warning },
    { label: 'Failed', value: tradeStats.failedTrades, icon: 'close-circle', color: theme.danger },
    { label: 'Total P&L', value: Number.isFinite(totalPnlValue) ? `$${totalPnlValue.toFixed(2)}` : '$0.00', icon: 'trending-up', color: totalPnlValue >= 0 ? theme.success : theme.danger, isAmount: true },
  ];

  const dateRanges: DateRangeType[] = ['Today', 'Week', 'Month', 'Year', 'Custom'];

  const handleExport = () => {
    console.log('Export orders');
  };

  const handleDateRangeSelect = (range: DateRangeType) => {
    setSelectedDateRange(range);
    if (range === 'Custom') {
      setShowCustomDateRange(true);
    } else {
      setShowCustomDateRange(false);
    }
  };

  const toggleMarket = (market: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(market) ? prev.filter((m) => m !== market) : [...prev, market]
    );
  };

  const toggleBroker = (broker: string) => {
    setSelectedBrokers((prev) =>
      prev.includes(broker) ? prev.filter((b) => b !== broker) : [...prev, broker]
    );
  };

  const handleResetFilters = () => {
    setSelectedMarkets([]);
    setSelectedBrokers([]);
    setSearchQuery('');
    setSelectedDateRange('Month');
    setShowCustomDateRange(false);
    setStartDate('');
    setEndDate('');
  };

  const handleApplyCustomDate = () => {
    // Trigger re-fetch with custom date range
    fetchOrders();
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const getPnlColor = (pnl: number) => {
    return pnl >= 0 ? theme.success : theme.danger;
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || '';
    if (normalizedStatus === 'completed' || normalizedStatus === 'closed' || normalizedStatus === 'tp_hit') {
      return theme.success;
    }
    if (normalizedStatus === 'failed' || normalizedStatus === 'sl_hit') {
      return theme.danger;
    }
    if (normalizedStatus === 'pending' || normalizedStatus === 'open') {
      return theme.warning;
    }
    return theme.titleColor;
  };

  const formatNumber = (value: any, digits = 2, currency = '') => {
    const n = Number(value);
    return Number.isFinite(n) ? `${currency}${n.toFixed(digits)}` : '-';
  };

  const formatAmount = (value: any, digits = 2) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : '-';
  };

  const formatSignedPnl = (value: any, digits = 2, currency = '') => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const sign = n >= 0 ? '+' : '-';
    return `${sign}${currency}${Math.abs(n).toFixed(digits)}`;
  };

  // Compute date range for client-side filtering
  const _dateRange = getDateRange();
  const _startTime = new Date(_dateRange.startDate).getTime();
  const _endTime = new Date(_dateRange.endDate).getTime();

  // Filter orders based on search, markets, brokers and date
  const filteredOrders = orders.filter((order) => {
    // Search filter
    const matchesSearch = !searchQuery || 
      order.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.strategyName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Market filter
    const matchesMarket = selectedMarkets.length === 0 || selectedMarkets.includes(order.market);
    
    // Broker filter
    const matchesBroker = selectedBrokers.length === 0 || selectedBrokers.includes(order.broker);

    // Date filter using rawDate - be lenient: if date is invalid, include the order
    let matchesDate = true;
    if (order.rawDate) {
      const itemTime = new Date(order.rawDate).getTime();
      if (Number.isFinite(itemTime)) {
        matchesDate = itemTime >= _startTime && itemTime < _endTime;
      }
    }
    
    return matchesSearch && matchesMarket && matchesBroker && matchesDate;
  });

  console.log('📊 [OrderHistory] Total orders:', orders.length, 'Filtered orders:', filteredOrders.length);

  // Filter open positions
  const filteredPositions = openPositions.filter((position) => {
    const matchesSearch = !searchQuery || 
      position.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      position.strategyName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMarket = selectedMarkets.length === 0 || selectedMarkets.includes(position.market);
    const matchesBroker = selectedBrokers.length === 0 || selectedBrokers.includes(position.broker);
    
    return matchesSearch && matchesMarket && matchesBroker;
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#5B7FFF" />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.bg }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Order History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#5B7FFF" />
        }
      >
        {/* Stats Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScrollContainer}
          contentContainerStyle={styles.statsScrollContent}
        >
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}20` }]}>
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
              </View>
              <View style={styles.statInfo}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {stat.isAmount ? stat.value : stat.value}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Date Range</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateRangeScroll}
            contentContainerStyle={styles.dateRangeContent}
          >
            {dateRanges.map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.dateRangeBtn,
                  {
                    backgroundColor: selectedDateRange === range ? theme.titleColor : theme.inputBg,
                    borderColor: selectedDateRange === range ? theme.titleColor : theme.borderColor,
                  },
                ]}
                onPress={() => handleDateRangeSelect(range)}
              >
                <Ionicons
                  name={range === 'Today' ? 'today' : range === 'Week' ? 'calendar' : range === 'Month' ? 'calendar' : range === 'Year' ? 'calendar' : 'calendar-sharp'}
                  size={16}
                  color={selectedDateRange === range ? '#fff' : theme.text}
                />
                <Text
                  style={[
                    styles.dateRangeBtnText,
                    { color: selectedDateRange === range ? '#fff' : theme.text },
                  ]}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Custom Date Range */}
        {showCustomDateRange && (
          <View style={styles.customDateContainer}>
            <View style={styles.dateInputRow}>
              <View style={styles.dateInputGroup}>
                <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Start Date</Text>
                <View style={[styles.dateInput, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <TextInput
                    style={[styles.dateInputText, { color: theme.text }]}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="01/01/2025"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <Ionicons name="calendar" size={20} color={theme.textSecondary} />
                </View>
              </View>

              <Text style={[styles.dateToText, { color: theme.text }]}>to</Text>

              <View style={styles.dateInputGroup}>
                <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>End Date</Text>
                <View style={[styles.dateInput, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <TextInput
                    style={[styles.dateInputText, { color: theme.text }]}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="01/01/2026"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <Ionicons name="calendar" size={20} color={theme.textSecondary} />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.applyBtn, { backgroundColor: theme.titleColor }]}
                onPress={handleApplyCustomDate}
              >
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search and Filters */}
        <View style={styles.searchFilterContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search orders..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterBtn, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}
              onPress={() => setShowMarketFilter(true)}
            >
              <Ionicons name="funnel" size={16} color={theme.text} />
              <Text style={[styles.filterBtnText, { color: theme.text }]}>Market ({selectedMarkets.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterBtn, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}
              onPress={() => setShowBrokerFilter(true)}
            >
              <Ionicons name="funnel" size={16} color={theme.text} />
              <Text style={[styles.filterBtnText, { color: theme.text }]}>Broker ({selectedBrokers.length})</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.resetBtn, styles.glassyButton, { backgroundColor: Platform.OS === 'android' ? '#dbeafe' : colors.primary + '15', borderColor: Platform.OS === 'android' ? '#dbeafe' : colors.primary + '30' }]}
              onPress={handleResetFilters}
            >
              <Ionicons name="refresh" size={16} color="#3b82f6" />
              <Text style={[styles.resetBtnText, { color: '#3b82f6' }]}>Reset Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtn, styles.glassyButton, { backgroundColor: Platform.OS === 'android' ? '#dbeafe' : colors.primary + '15', borderColor: Platform.OS === 'android' ? '#dbeafe' : colors.primary + '30' }]}
              onPress={handleExport}
            >
              <Ionicons name="download" size={18} color="#5B7FFF" />
              <Text style={[styles.exportBtnText, { color: '#5B7FFF' }]}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Orders Header (left-aligned title with underline) */}
        <View style={styles.ordersHeaderContainer}>
          <Text style={[styles.ordersHeaderTitle, { color: colors.primary }]}>Orders ({filteredOrders.length})</Text>
          <View style={[styles.ordersHeaderUnderline, { backgroundColor: colors.primary }]} />
        </View>

        {/* Content Area */}
        <View style={[styles.contentArea, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          {activeTab === 'positions' ? (
            /* Positions Tab Content */
            <View style={styles.ordersList}>
              {filteredPositions.length > 0 ? (
                <>
                {filteredPositions.slice(0, positionsVisibleCount).map((position) => (
                  <View key={position.id} style={[styles.orderCard, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                    {/* Top Row: Strategy, Symbol, Market, Type */}
                    <View style={styles.orderCardTop}>
                      <Text style={[styles.orderId, { color: theme.textSecondary }]}>{position.strategyName}</Text>
                      <View style={[styles.marketBadge, { borderColor: theme.titleColor }]}>
                        <Text style={[styles.marketText, { color: theme.titleColor }]}>{position.market}</Text>
                      </View>
                      <Text style={[styles.orderSymbol, { color: theme.text }]}>{position.symbol}</Text>
                      <View style={styles.typeContainer}>
                        <Ionicons 
                          name={position.type === 'Buy' ? 'trending-up' : 'trending-down'} 
                          size={14} 
                          color={position.type === 'Buy' ? theme.success : theme.danger} 
                        />
                        <Text style={[styles.typeText, { color: position.type === 'Buy' ? theme.success : theme.danger }]}>
                          {position.type}
                        </Text>
                      </View>
                    </View>

                    {/* Middle Row: Volume, Avg Price, MTM */}
                    <View style={styles.orderCardMiddle}>
                      <View style={styles.orderDataCol}>
                        <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>Volume</Text>
                        <Text style={[styles.orderValue, { color: theme.text }]}>{formatAmount(position.volume, 2)}</Text>
                      </View>
                      <View style={styles.orderDataCol}>
                        <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>Avg Price</Text>
                        <Text style={[styles.orderValue, { color: theme.text }]}>{formatNumber(position.avgPrice, 2, '$')}</Text>
                      </View>
                      <View style={styles.orderDataCol}>
                        <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>MTM</Text>
                        <Text style={[styles.orderValue, { color: getPnlColor(position.mtm) }]}>
                          {formatSignedPnl(position.mtm, 2, '$')}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom Row: Broker, Date, Action */}
                    <View style={styles.orderCardBottom}>
                      <View style={[styles.statusBadge, { backgroundColor: `${theme.titleColor}20` }]}>
                        <Text style={[styles.statusText, { color: theme.titleColor }]}>{position.broker}</Text>
                      </View>
                      <View style={styles.dateContainer}>
                        <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
                        <Text style={[styles.dateText, { color: theme.textSecondary }]}>{position.date}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.viewBtn, { backgroundColor: `${theme.titleColor}20` }]}
                        onPress={() => handleViewOrder(position)}
                      >
                        <Ionicons name="eye" size={16} color={theme.titleColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {/* Load More Button for Positions */}
                {filteredPositions.length > positionsVisibleCount && (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : colors.primary + '15', borderColor: colors.primary }]}
                    onPress={() => setPositionsVisibleCount(prev => prev + 10)}
                  >
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
                  </TouchableOpacity>
                )}
                </>
              ) : (
                <View style={[styles.emptyState, { borderColor: theme.borderColor }]}>
                  <Ionicons name="briefcase-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                    No open positions found.{'\n'}Your active trades will appear here.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* Orders Tab Content */
            <View style={styles.ordersList}>
              {filteredOrders.length > 0 ? (
                <>
                {filteredOrders.slice(0, ordersVisibleCount).map((order) => (
                  <View key={order.id} style={[styles.orderCard, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                    {/* Top Row: ID, Market, Symbol, Type */}
                    <View style={styles.orderCardTop}>
                      <Text style={[styles.orderId, { color: theme.textSecondary }]}>#{order.id}</Text>
                      <View style={[styles.marketBadge, { borderColor: theme.titleColor }]}>
                        <Text style={[styles.marketText, { color: theme.titleColor }]}>{order.market}</Text>
                      </View>
                      <Text style={[styles.orderSymbol, { color: theme.text }]}>{order.symbol}</Text>
                      <View style={styles.typeContainer}>
                        <Ionicons 
                          name={order.type === 'Buy' ? 'trending-up' : 'trending-down'} 
                          size={14} 
                          color={order.type === 'Buy' ? theme.success : theme.danger} 
                        />
                        <Text style={[styles.typeText, { color: order.type === 'Buy' ? theme.success : theme.danger }]}>
                          {order.type}
                        </Text>
                      </View>
                    </View>

                    {/* Middle Row: Amount, Entry, Current */}
                    <View style={styles.orderCardMiddle}>
                      <View style={styles.orderDataCol}>
                        <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>Amount</Text>
                        <Text style={[styles.orderValue, { color: theme.text }]}>{formatAmount(order.amount, 2)}</Text>
                      </View>
                      <View style={styles.orderDataCol}>
                        <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>Entry</Text>
                        <Text style={[styles.orderValue, { color: theme.text }]}>{formatNumber(order.entry, 2, '$')}</Text>
                      </View>
                      <View style={styles.orderDataCol}>
                        <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>Current</Text>
                        <Text style={[styles.orderValue, { color: theme.text }]}>{formatNumber(order.current, 2, '$')}</Text>
                      </View>
                    </View>

                    {/* Bottom Row: P&L, Status, Date, Action */}
                    <View style={styles.orderCardBottom}>
                      <View style={styles.pnlContainer}>
                        <Text style={[styles.pnlValue, { color: getPnlColor(order.pnl) }]}>
                          {formatSignedPnl(order.pnl, 2, '$')}
                        </Text>
                        <Text style={[styles.pnlPercent, { color: getPnlColor(order.pnl) }]}> 
                          ({Number.isFinite(Number(order.pnlPercent)) ? `${Number(order.pnlPercent).toFixed(2)}%` : '-'})
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status}</Text>
                      </View>
                      <View style={styles.dateContainer}>
                        <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
                        <Text style={[styles.dateText, { color: theme.textSecondary }]}>{order.date}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.viewBtn, { backgroundColor: `${theme.titleColor}20` }]}
                        onPress={() => handleViewOrder(order)}
                      >
                        <Ionicons name="eye" size={16} color={theme.titleColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {/* Load More Button for Orders */}
                {filteredOrders.length > ordersVisibleCount && (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : colors.primary + '15', borderColor: colors.primary }]}
                    onPress={() => setOrdersVisibleCount(prev => prev + 10)}
                  >
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
                  </TouchableOpacity>
                )}
                </>
              ) : (
                <View style={[styles.emptyState, { borderColor: theme.borderColor }]}>
                  <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                    No orders found matching your filters.{'\n'}Try adjusting your search or filters.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Market Filter Modal */}
      <Modal
        visible={showMarketFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMarketFilter(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMarketFilter(false)}
        >
          <View
            style={[styles.filterDropdown, { 
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.cardBg, 
              borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.borderColor,
              shadowOpacity: isDark ? 0.4 : 0.15,
            }]}
            onStartShouldSetResponder={() => true}
          >
            {MARKET_OPTIONS.map((market, index) => (
              <TouchableOpacity
                key={market}
                style={[
                  styles.dropdownItem, 
                  { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : theme.borderColor },
                  index === MARKET_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => toggleMarket(market)}
              >
                <View style={[styles.checkbox, { borderColor: theme.borderColor }]}>
                  {selectedMarkets.includes(market) && (
                    <Ionicons name="checkmark" size={18} color={theme.titleColor} />
                  )}
                </View>
                <Text style={[styles.dropdownItemText, { color: theme.text }]}>{market}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Broker Filter Modal */}
      <Modal
        visible={showBrokerFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBrokerFilter(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBrokerFilter(false)}
        >
          <View
            style={[styles.filterDropdown, styles.brokerDropdown, { 
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.cardBg, 
              borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.borderColor,
              shadowOpacity: isDark ? 0.4 : 0.15,
            }]}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {BROKER_OPTIONS.map((broker, index) => (
                <TouchableOpacity
                  key={broker}
                  style={[
                    styles.dropdownItem, 
                    { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : theme.borderColor },
                    index === BROKER_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => toggleBroker(broker)}
                >
                  <View style={[styles.checkbox, { borderColor: theme.borderColor }]}>
                    {selectedBrokers.includes(broker) && (
                      <Ionicons name="checkmark" size={18} color={theme.titleColor} />
                    )}
                  </View>
                  <Text style={[styles.dropdownItemText, { color: theme.text }]}>{broker}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Order Detail Modal */}
      <Modal
        visible={showOrderDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOrderDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModal, { backgroundColor: theme.cardBg }]}>
            {selectedOrder && (
              <>
                {/* Modal Header */}
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderLeft}>
                    <View style={[styles.detailIconWrapper, { backgroundColor: `${theme.titleColor}20` }]}>
                      <Ionicons 
                        name={selectedOrder.type === 'Buy' ? 'trending-up' : 'trending-down'} 
                        size={24} 
                        color={selectedOrder.type === 'Buy' ? theme.success : theme.danger} 
                      />
                    </View>
                    <View>
                      <Text style={[styles.detailSymbol, { color: theme.text }]}>{selectedOrder.symbol}</Text>
                      <Text style={[styles.detailTradeId, { color: theme.textSecondary }]}>Trade ID: {selectedOrder.id}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowOrderDetail(false)}>
                    <Ionicons name="close" size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Status Badges */}
                <View style={styles.detailBadges}>
                  <View style={[styles.detailBadge, { backgroundColor: `${theme.success}20` }]}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                    <Text style={[styles.detailBadgeText, { color: theme.success }]}>{selectedOrder.status}</Text>
                  </View>
                  <View style={[styles.detailBadge, { backgroundColor: selectedOrder.type === 'Buy' ? `${theme.success}20` : `${theme.danger}20` }]}>
                    <Text style={[styles.detailBadgeText, { color: selectedOrder.type === 'Buy' ? theme.success : theme.danger }]}>{selectedOrder.type}</Text>
                  </View>
                  <View style={[styles.detailBadge, { borderColor: theme.titleColor, borderWidth: 1, backgroundColor: 'transparent' }]}>
                    <Text style={[styles.detailBadgeText, { color: theme.titleColor }]}>{selectedOrder.market}</Text>
                  </View>
                  <View style={[styles.detailBadge, { borderColor: theme.textSecondary, borderWidth: 1, backgroundColor: 'transparent' }]}>
                    <Ionicons name="business" size={12} color={theme.textSecondary} />
                    <Text style={[styles.detailBadgeText, { color: theme.textSecondary }]}>{selectedOrder.broker}</Text>
                  </View>
                </View>

                {/* Trade Information */}
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Trade Information</Text>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailRowIcon}>
                        <Ionicons name="pricetag" size={16} color={theme.titleColor} />
                      </View>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Symbol</Text>
                      <Text style={[styles.detailValue, { color: theme.titleColor }]}>{selectedOrder.symbol}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailRowIcon}>
                        <Ionicons name="trending-up" size={16} color={selectedOrder.type === 'Buy' ? theme.success : theme.danger} />
                      </View>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Type</Text>
                      <Text style={[styles.detailValue, { color: selectedOrder.type === 'Buy' ? theme.success : theme.danger }]}>{selectedOrder.type}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailRowIcon}>
                        <Ionicons name="layers" size={16} color={theme.textSecondary} />
                      </View>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Quantity</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>{formatAmount(selectedOrder.amount, 8)} units</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailRowIcon}>
                        <Ionicons name="cash" size={16} color={theme.textSecondary} />
                      </View>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Entry Price</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>{formatNumber(selectedOrder.entry, 2, '₹')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailRowIcon}>
                        <Ionicons name="cash-outline" size={16} color={theme.textSecondary} />
                      </View>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Current Price</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>{formatNumber(selectedOrder.current, 2, '₹')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailRowIcon}>
                        <Ionicons name="calendar" size={16} color={theme.textSecondary} />
                      </View>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Trade Date</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>{selectedOrder.date}, {selectedOrder.time}</Text>
                    </View>
                  </View>
                </View>

                {/* Profit & Loss */}
                <View style={[styles.detailSection, { borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 16 }]}>
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Profit & Loss</Text>
                  <View style={styles.pnlRow}>
                    <View style={styles.pnlItem}>
                      <Text style={[styles.pnlLabel, { color: theme.textSecondary }]}>Total P&L</Text>
                      <Text style={[styles.pnlAmount, { color: getPnlColor(selectedOrder.pnl) }]}>
                        {formatSignedPnl(selectedOrder.pnl, 2, '₹')}
                      </Text>
                    </View>
                    <View style={styles.pnlItem}>
                      <Text style={[styles.pnlLabel, { color: theme.textSecondary }]}>P&L Percentage</Text>
                      <View style={styles.pnlPercentRow}>
                        <Ionicons 
                          name={selectedOrder.pnl >= 0 ? 'trending-up' : 'trending-down'} 
                          size={16} 
                          color={getPnlColor(selectedOrder.pnl)} 
                        />
                        <Text style={[styles.pnlPercent, { color: getPnlColor(selectedOrder.pnl) }]}> 
                          {Number.isFinite(Number(selectedOrder.pnlPercent)) ? `${Number(selectedOrder.pnlPercent).toFixed(2)}%` : '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Close Button */}
                <TouchableOpacity 
                  style={[styles.closeBtn, { backgroundColor: theme.titleColor }]}
                  onPress={() => setShowOrderDetail(false)}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  statsScrollContainer: {
    paddingVertical: 16,
  },
  statsScrollContent: {
    paddingHorizontal: 16,
    gap:6,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap:10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  dateRangeContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  dateRangeScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  dateRangeContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateRangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateRangeBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchFilterContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
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
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical:3,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  glassyButton: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical:7,
    borderRadius: 20,
  },
  exportBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customDateContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateInputText: {
    flex: 1,
    fontSize: 14,
  },
  dateToText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
  },
  applyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 1,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterDropdown: {
    width: '80%',
    maxWidth: 400,
    maxHeight: 300,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  brokerDropdown: {
    maxHeight: 500,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical:8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassyTab: {
    borderWidth: 1,
    shadowColor: '#53bfe0ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ordersHeaderContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  ordersHeaderTitle: {
    fontSize:15,
    fontWeight: '600',
  },
  ordersHeaderUnderline: {
    height:3,
    width: 140,
    borderRadius: 4,
    marginTop: 6,
  },
  titleContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleBox: {
    paddingBottom: 12,
    borderBottomWidth: 2,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  titleSubtext: {
    fontSize: 11,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 16,
  },
  tab: {
    flex: 1,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  tabSubtext: {
    fontSize: 11,
  },
  contentArea: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    margin: 20,
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Order Cards
  ordersList: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  orderId: {
    fontSize: 12,
    fontWeight: '600',
  },
  marketBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  marketText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderSymbol: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderCardMiddle: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  orderDataCol: {
    flex: 1,
  },
  orderLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  orderValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pnlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pnlValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pnlPercent: {
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dateText: {
    fontSize: 11,
  },
  viewBtn: {
    width: 25,
    height: 25,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft:4,
  },
  // Positions
  positionsList: {
    padding: 16,
  },
  positionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  positionRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  positionCol: {
    flex: 1,
  },
  positionLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  positionValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  positionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  positionDate: {
    fontSize: 12,
  },
  // Detail Modal
  detailModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailSymbol: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailTradeId: {
    fontSize: 12,
  },
  detailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailGrid: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRowIcon: {
    width: 24,
    marginRight: 8,
  },
  detailLabel: {
    flex: 1,
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  pnlRow: {
    flexDirection: 'row',
    gap: 20,
  },
  pnlItem: {
    flex: 1,
  },
  pnlLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  pnlAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  pnlPercentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  closeBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
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
