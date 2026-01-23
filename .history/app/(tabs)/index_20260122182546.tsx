import { borderRadius, colors, getTheme, shadows, spacing, typography } from '@/constants/styles';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications, usePaperPositionUpdates, useWalletUpdates } from '@/hooks/useWebSocket';
import { notificationService, PaperPosition, paperPositionService, strategyService, tradeService, walletService } from '@/services';
import { WS_EVENTS, wsService } from '@/services/websocket';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowClockwise,
  ArrowSquareOut,
  Bell,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Gear,
  Info,
  Lightning,
  Moon,
  Rocket,
  SlidersHorizontal,
  Storefront,
  Sun,
  TrendUp,
  UserPlus,
  Wallet,
  X,
  XCircle
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

const ITEMS = [
  { 
    id: '2', 
    title: 'Create Wizard', 
    description: 'Set up your strategy wizard',
    status: 'Pending', 
    icon: Gear, 
    color: colors.primary, 
    completion: 0,
    route: '/(tabs)/explore'
  },
  { 
    id: '1', 
    title: 'Marketplace', 
    description: 'Browse and subscribe to strategies',
    status: 'Pending', 
    icon: Storefront, 
    color: '#10b981', 
    completion: 60,
    route: '/(tabs)/strategies?tab=2'
  },
  { 
    id: '3', 
    title: 'Broker Setup', 
    description: 'Connect your trading broker',
    status: 'Completed', 
    icon: UserPlus, 
    color: '#06b6d4', 
    completion: 100,
    route: '/api-details'
  },
];

// Initial empty arrays - data will be loaded from API
const INITIAL_POSITIONS: PaperPosition[] = [];

const SEGMENT_OPTIONS = ['All Segments', 'Indian', 'Crypto', 'Forex'];
const CLOSE_OPTIONS = ['Close All', 'Close Profit', 'Close Loss'];

export default function HomeScreen() {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const theme = getTheme(isDark);
  const [isConnected, setIsConnected] = useState<boolean>(wsService.isConnected());

  useEffect(() => {
    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);
    wsService.on(WS_EVENTS.CONNECTED, handleConnected);
    wsService.on(WS_EVENTS.DISCONNECTED, handleDisconnected);
    return () => {
      wsService.off(WS_EVENTS.CONNECTED, handleConnected);
      wsService.off(WS_EVENTS.DISCONNECTED, handleDisconnected);
    };
  }, []);
  
  // UI State
  const [selectedSegment, setSelectedSegment] = useState('All Segments');
  const [selectedClose, setSelectedClose] = useState('Close All');
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false);
  const [showCloseDropdown, setShowCloseDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [showSLTPModal, setShowSLTPModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const sltpIdRef = useRef<number | string | null>(null);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [slType, setSlType] = useState<'points' | 'percentage' | 'price'>('points');
  const [tpType, setTpType] = useState<'points' | 'percentage' | 'price'>('points');
  
  // Data State
  const [openPositions, setOpenPositions] = useState<PaperPosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalPnl: 0, openCount: 0, closedCount: 0 });
  const [walletBalance, setWalletBalance] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStrategies, setHasStrategies] = useState(false);
  
  // Pagination State
  const [displayLimit, setDisplayLimit] = useState(6);
  const [hasMoreOpen, setHasMoreOpen] = useState(false);
  const [hasMoreClosed, setHasMoreClosed] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSubscriptions, setHasSubscriptions] = useState(false);
  const [showQuickSetup, setShowQuickSetup] = useState(true);
  
  
  // Real-time updates via WebSocket
  const realTimePositions = usePaperPositionUpdates((update) => {
    console.log('🔄 [Dashboard] Real-time position update received:', {
      type: update.type,
      positionId: update.position?.id,
      currentPrice: update.position?.currentPrice,
      profit: update.position?.profit,
      profitPercent: update.position?.profitPercent,
      timestamp: new Date().toISOString()
    });
    
    // Handle position updates in real-time
    if (update.type === 'opened') {
      console.log('✅ [Dashboard] New position opened, adding to list');
      setOpenPositions(prev => [update.position, ...prev]);
    } else if (update.type === 'closed' || update.type === 'sl_hit' || update.type === 'tp_hit') {
      console.log('🔒 [Dashboard] Position closed, moving to closed list');
      setOpenPositions(prev => prev.filter(p => p.id !== update.position.id));
      setClosedPositions(prev => [{ ...update.position }, ...prev]);
    } else if (update.type === 'mtm_update' || update.type === 'modified') {
      console.log('💹 [Dashboard] MTM update or modification, updating position values');
      // Update position with new MTM values in real-time
      setOpenPositions(prev => prev.map(p => {
        if (String(p.id) !== String(update.position.id)) return p;
        const newP = {
          ...p,
          currentPrice: update.position.currentPrice ?? p.currentPrice,
          profit: update.position.profit ?? p.profit,
          profitPercent: update.position.profitPercent ?? p.profitPercent,
          stopLoss: update.position.stopLoss ?? p.stopLoss,
          takeProfit: update.position.takeProfit ?? p.takeProfit,
        };
        if (newP.currentPrice !== p.currentPrice || newP.profit !== p.profit || newP.profitPercent !== p.profitPercent) {
          console.log('✨ [Dashboard] Position value UPDATED in real-time:', {
            id: p.id,
            symbol: p.symbol,
            from: { currentPrice: p.currentPrice, profit: p.profit, profitPercent: p.profitPercent },
            to: { currentPrice: newP.currentPrice, profit: newP.profit, profitPercent: newP.profitPercent }
          });
        }
        return newP;
      }));
    }
  });
  
  const walletUpdates = useWalletUpdates((update) => {
    setWalletBalance(update.balance);
  });
  
  const notificationUpdates = useNotifications();
  
  // Listen for MTM updates (from Redis via WebSocket) to update positions in real-time
  useEffect(() => {
    const handleMTMUpdate = (data: any) => {
      console.log('📊 [Dashboard] MTM Update received from WebSocket:', JSON.stringify(data, null, 2));
      
      // Handle batch updates (array of positions)
      if (data.positions && Array.isArray(data.positions)) {
        console.log(`📊 [Dashboard] Batch MTM update for ${data.positions.length} positions`);
        setOpenPositions(prev => prev.map(p => {
          const update = data.positions.find((pos: any) => String(pos.id) === String(p.id));
          if (!update) return p;
          
          const newP = {
            ...p,
            currentPrice: update.currentPrice ?? p.currentPrice,
            profit: update.profit ?? p.profit,
            profitPercent: update.profitPercent ?? p.profitPercent,
          };
          
          if (newP.currentPrice !== p.currentPrice || newP.profit !== p.profit) {
            console.log('✨ [Dashboard] Position updated via BATCH MTM:', {
              id: p.id,
              symbol: p.symbol,
              oldPrice: p.currentPrice,
              newPrice: newP.currentPrice,
              oldProfit: p.profit,
              newProfit: newP.profit
            });
          }
          return newP;
        }));
      }
      // Handle single position update
      else if (data.positionId && data.currentPrice !== undefined) {
        console.log('📊 [Dashboard] Single position MTM update');
        setOpenPositions(prev => prev.map(p => {
          if (String(p.id) !== String(data.positionId)) return p;
          const newP = {
            ...p,
            currentPrice: data.currentPrice,
            profit: data.profit ?? p.profit,
            profitPercent: data.profitPercent ?? p.profitPercent,
          };
          if (newP.currentPrice !== p.currentPrice || newP.profit !== p.profit || newP.profitPercent !== p.profitPercent) {
            console.log('✨ [Dashboard] Position value CHANGED via MTM:', {
              id: p.id,
              symbol: p.symbol,
              from: { currentPrice: p.currentPrice, profit: p.profit, profitPercent: p.profitPercent },
              to: { currentPrice: newP.currentPrice, profit: newP.profit, profitPercent: newP.profitPercent }
            });
          }
          return newP;
        }));
      }
    };
    
    wsService.on(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);
    
    return () => {
      wsService.off(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);
    };
  }, []);
  
  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch all data in parallel
      const [positionsRes, historyRes, statsRes, walletRes, notifCountRes, strategiesRes, subscriptionsRes] = await Promise.all([
        paperPositionService.getOpenPositions({ limit: 100 }),
        tradeService.getTrades({ status: 'Completed,Failed', limit: 100 }),
        paperPositionService.getStats(),
        walletService.getWallet(),
        notificationService.getUnreadCount(),
        strategyService.getStrategies({ limit: 1 }),
        strategyService.getSubscriptions(),
      ]);
      
      if (positionsRes.success && positionsRes.data) {
        console.log('Open positions received:', positionsRes.data.length);
        setOpenPositions(positionsRes.data);
        setHasMoreOpen(positionsRes.data.length >= 100);
      }
      
      if (historyRes.success && historyRes.data) {
        console.log('Closed positions received:', historyRes.data.length);
        console.log('First 3 closed positions:', historyRes.data.slice(0, 3).map((p: any) => ({ id: p.id, symbol: p.symbol, status: p.status })));
        // Map Trade data to position-like format for UI compatibility
        const mappedClosedPositions = historyRes.data.map((trade: any) => ({
          ...trade,
          volume: trade.amount || trade.volume || 0,
          openPrice: trade.price || trade.openPrice || 0,
          profit: trade.pnl || trade.profit || 0,
          profitPercent: trade.pnlPercentage || trade.profitPercent || 0,
          openTime: trade.signalReceivedAt || trade.createdAt,
          closeTime: trade.updatedAt,
          closePrice: trade.currentPrice || trade.closePrice || 0,
          strategyName: trade.strategyName || trade.strategy?.name,
        }));
        setClosedPositions(mappedClosedPositions);
        setHasMoreClosed(historyRes.data.length >= 100);
      }
      
      if (statsRes.success && statsRes.data && statsRes.data.stats) {
        const backendStats = statsRes.data.stats;
        console.log('Stats API response:', JSON.stringify(statsRes.data, null, 2));
        console.log('Backend stats:', backendStats);
        console.log('totalProfit:', backendStats.totalProfit);
        console.log('openProfit:', backendStats.openProfit);
        const calculatedPnl = (backendStats.totalProfit || 0) + (backendStats.openProfit || 0);
        console.log('Calculated P&L:', calculatedPnl);
        setStats({
          totalPnl: calculatedPnl,
          openCount: backendStats.openPositions || 0,
          closedCount: backendStats.totalTrades || 0,
        });
      } else {
        console.log('Stats API failed or invalid:', statsRes);
      }
      
      if (walletRes.success && walletRes.data) {
        setWalletBalance(walletRes.data.balance);
      }
      
      if (notifCountRes.success && notifCountRes.data) {
        setUnreadNotifications(notifCountRes.data.count);
      }
      
      // Check if user has strategies or subscriptions
      const hasUserStrategies = strategiesRes.success && strategiesRes.data && strategiesRes.data.length > 0;
      const hasUserSubscriptions = subscriptionsRes.success && subscriptionsRes.data && subscriptionsRes.data.length > 0;
      
      setHasStrategies(hasUserStrategies || false);
      setHasSubscriptions(hasUserSubscriptions || false);
      setShowQuickSetup(!hasUserStrategies && !hasUserSubscriptions);
      setDisplayLimit(6); // Reset display limit on refresh
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    if (isAuthenticated) {
      console.log('🔌 [Dashboard] User authenticated, checking WebSocket connection...');
      const isConnected = wsService.isConnected();
      console.log('🔌 [Dashboard] WebSocket connected:', isConnected);
      
      if (!isConnected) {
        console.log('⚠️ [Dashboard] WebSocket not connected, attempting to connect...');
        wsService.connect().then(() => {
          console.log('✅ [Dashboard] WebSocket connection initiated');
        }).catch((err) => {
          console.error('❌ [Dashboard] WebSocket connection failed:', err);
        });
      } else {
        console.log('✅ [Dashboard] WebSocket already connected, subscribing to updates...');
        wsService.subscribePaperPrices();
        wsService.subscribePaperMTM();
      }
      
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchData]);
  
  // Update notification count from WebSocket
  useEffect(() => {
    setUnreadNotifications(notificationUpdates.unreadCount);
  }, [notificationUpdates.unreadCount]);
  
  // Update wallet from WebSocket
  useEffect(() => {
    if (walletUpdates.balance !== null) {
      setWalletBalance(walletUpdates.balance);
    }
  }, [walletUpdates.balance]);
  
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);
  
  // Close position handler
  const handleClosePosition = async (positionId: number) => {
    Alert.alert(
      'Close Position',
      'Are you sure you want to close this position?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
              onPress: async () => {
            try {
              const result = await paperPositionService.closePosition(positionId);
              if (result.success) {
                // Position will be updated via WebSocket, but also update locally
                setOpenPositions(prev => prev.filter(p => p.id !== positionId));
                      if (result.data) {
                      setClosedPositions(prev => [result.data!, ...prev]);
                    }
              } else {
                Alert.alert('Error', result.error || 'Failed to close position');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to close position');
            }
          },
        },
      ]
    );
  };
  
  // Modify SL/TP handler
  const handleSaveSLTP = async () => {
    if (!selectedPosition) return;
    
    try {
      let finalStopLoss = undefined;
      let finalTakeProfit = undefined;
      
      // Calculate final values based on type
      if (stopLoss) {
        const slValue = parseFloat(stopLoss);
        if (slType === 'points') {
          finalStopLoss = selectedPosition.entryPrice - slValue;
        } else if (slType === 'percentage') {
          finalStopLoss = selectedPosition.entryPrice * (1 - slValue / 100);
        } else {
          finalStopLoss = slValue;
        }
      }
      
      if (takeProfit) {
        const tpValue = parseFloat(takeProfit);
        if (tpType === 'points') {
          finalTakeProfit = selectedPosition.entryPrice + tpValue;
        } else if (tpType === 'percentage') {
          finalTakeProfit = selectedPosition.entryPrice * (1 + tpValue / 100);
        } else {
          finalTakeProfit = tpValue;
        }
      }
      
      const result = await paperPositionService.modifyPosition(selectedPosition.id, {
        stopLoss: finalStopLoss,
        takeProfit: finalTakeProfit,
      });
      
      if (result.success) {
        setShowSLTPModal(false);
        setStopLoss('');
        setTakeProfit('');
        // Update local state
        setOpenPositions(prev => prev.map(p => 
          p.id === selectedPosition.id ? { ...p, stopLoss: finalStopLoss, takeProfit: finalTakeProfit } : p
        ));
        Alert.alert('Success', 'Stop Loss and Take Profit updated successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to update SL/TP');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update SL/TP');
    }
  };
  
  // Close position from SL/TP modal
  const handleClosePositionFromModal = async () => {
    if (!selectedPosition) return;
    
    Alert.alert(
      'Close Position',
      `Are you sure you want to close this ${selectedPosition.symbol} position?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await paperPositionService.closePosition(selectedPosition.id);
              if (result.success) {
                setShowSLTPModal(false);
                setOpenPositions(prev => prev.filter(p => p.id !== selectedPosition.id));
                fetchData(); // Refresh all data
                Alert.alert('Success', 'Position closed successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to close position');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to close position');
            }
          },
        },
      ]
    );
  };
  
  // Computed stats for display
  // Compute today's closed positions (after 12am)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayClosed = closedPositions.filter(p => {
    const closeTime = p.closeTime || p.updatedAt || p.createdAt;
    if (!closeTime) return false;
    const positionCloseDate = new Date(closeTime);
    return positionCloseDate >= todayStart;
  });
  const todayClosedCount = todayClosed.length;
  
  // Use totalPnl from API stats (matches web dashboard)
  const totalPnl = stats.totalPnl || 0;
  
  const STATS = [
    { 
      label: 'P&L', 
      value: `$${Number(totalPnl).toFixed(2)}`, 
      icon: TrendUp, 
      color: totalPnl >= 0 ? '#10b981' : '#ef4444', 
    },
    { 
      label: 'Active', 
      value: openPositions.length.toString(), 
      icon: CheckCircle, 
      color: colors.primary, 
    },
    { 
      label: 'Closed', 
      value: todayClosedCount.toString(), 
      icon: XCircle, 
      color: '#06b6d4', 
    },
  ];
  
  // sanitize input to allow only digits and a single decimal point
  const sanitizeNumericInput = (text: string) => {
    if (!text) return '';
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 1) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  };
  
  // Handle stop loss input with numeric validation
  const handleStopLossChange = (text: string) => {
    const sanitized = sanitizeNumericInput(text);
    setStopLoss(sanitized);
  };
  
  // Handle take profit input with numeric validation
  const handleTakeProfitChange = (text: string) => {
    const sanitized = sanitizeNumericInput(text);
    setTakeProfit(sanitized);
  };
  
  // Animation for dropdowns
  const segmentDropdownAnim = useRef(new Animated.Value(0)).current;
  const closeDropdownAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(segmentDropdownAnim, {
      toValue: showSegmentDropdown ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showSegmentDropdown]);
  
  useEffect(() => {
    Animated.timing(closeDropdownAnim, {
      toValue: showCloseDropdown ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showCloseDropdown]);
  
  const cardWidth = (width - 56) / 3;
  
  // Filter positions based on segment
  const filterBySegment = (positions: PaperPosition[]) => {
    if (selectedSegment === 'All Segments') return positions;
    return positions.filter(p => p.market === selectedSegment);
  };
  
  // Filter closed positions to show only today's data (after 12am)
  const filterTodayClosed = (positions: any[]) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    return positions.filter(p => {
      const closeTime = p.closeTime || p.updatedAt || p.createdAt;
      if (!closeTime) return false;
      
      const positionCloseDate = new Date(closeTime);
      return positionCloseDate >= todayStart;
    });
  };
  
  const filteredPositions = activeTab === 'open' 
    ? filterBySegment(openPositions)
    : filterBySegment(filterTodayClosed(closedPositions));
  
  // Debug logging
  React.useEffect(() => {
    if (activeTab === 'closed') {
      console.log('Index - Total closed positions:', closedPositions.length);
      console.log('Index - Filtered closed positions:', filteredPositions.length);
      console.log('Index - Display limit:', displayLimit);
      console.log('Index - Positions to show:', positions.length);
    }
  }, [activeTab, closedPositions, filteredPositions, displayLimit]);
  
  // Apply display limit for pagination
  const positions = filteredPositions.slice(0, displayLimit);
  const hasMorePositions = filteredPositions.length > displayLimit;
  
  // Load more handler
  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + 6);
  };
    
  // Format position for display
  const formatPosition = (position: PaperPosition) => ({
    ...position,
    qty: position.volume,
    entryPrice: position.openPrice,
    ltp: position.currentPrice,
    mtm: Number(position.profit) || 0,
    time: new Date(position.closeTime || position.openTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    exitPrice: position.closePrice || 0,
    tradeId: position.orderId,
    strategyName: position.strategy?.name || position.strategyName || 'Manual Trade',
  });

  const handleSLTP = (position: any) => {
    setSelectedPosition(position);
    setStopLoss('');
    setTakeProfit('');
    setShowSLTPModal(true);
  };

  // Keep a ref of the selected position id to avoid stale closures in WS handlers
  useEffect(() => {
    sltpIdRef.current = selectedPosition?.id ?? null;
  }, [selectedPosition]);

  // Subscribe to websocket MTM / position updates while the SL/TP modal is open
  useEffect(() => {
    if (!showSLTPModal || !sltpIdRef.current) return;

    const handleMTMUpdate = (data: any) => {
      // Batch updates
      if (data.positions && Array.isArray(data.positions)) {
        const update = data.positions.find((p: any) => String(p.id) === String(sltpIdRef.current));
        if (update) {
          setSelectedPosition(prev => prev ? ({
            ...prev,
            ltp: update.currentPrice ?? prev.ltp,
            mtm: update.profit ?? prev.mtm,
          }) : prev);
        }
        return;
      }

      // Single update payload
      if (data.positionId && String(data.positionId) === String(sltpIdRef.current) && data.currentPrice !== undefined) {
        setSelectedPosition(prev => prev ? ({
          ...prev,
          ltp: data.currentPrice ?? prev.ltp,
          mtm: data.profit ?? prev.mtm,
        }) : prev);
      }
    };

    const handlePositionUpdate = (payload: any) => {
      const pos = payload.position || payload;
      if (!pos) return;
      if (String(pos.id) !== String(sltpIdRef.current)) return;
      setSelectedPosition(prev => prev ? ({
        ...prev,
        ltp: pos.currentPrice ?? prev.ltp,
        mtm: pos.profit ?? prev.mtm,
      }) : prev);
    };

    wsService.on(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);
    wsService.on(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);

    return () => {
      wsService.off(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMUpdate);
      wsService.off(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
    };
  }, [showSLTPModal]);

  const getGreeting = () => {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 60 * 60 * 1000;
    const ist = new Date(istMs);
    const hour = ist.getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={isDark ? ['#0a0a1a', '#050510', '#020208'] : ['#dbeafe', '#eff6ff', '#f8fafc', '#ffffff']}
        style={styles.gradientBackground}
      >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#0a0a2020' : '#ffffff40', borderBottomColor: theme.border }]}>
        <View style={styles.headerContent}>
          <View style={styles.topRow}>
            <
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={[styles.iconButton, { backgroundColor: theme.surfaceSecondary }]}
                onPress={() => setShowWalletDropdown(!showWalletDropdown)}
              >
                <Wallet size={20} color={colors.primary} weight="fill" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.iconButton, { backgroundColor: theme.surfaceSecondary }]}
                onPress={toggleTheme}
              >
                {isDark ? (
                  <Sun size={20} color={theme.textSecondary} />
                ) : (
                  <Moon size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.iconButton, { backgroundColor: theme.surfaceSecondary }]}
                onPress={() => router.push('/notifications')}
              >
                <Bell size={20} color={theme.textSecondary} />
                {unreadNotifications > 0 && <View style={styles.notificationDot} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* WebSocket connection status banner removed per request */}
        
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {STATS.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <View 
                key={index} 
                style={[
                  styles.statCard, 
                  { 
                    backgroundColor: isDark ? 'rgba(10, 10, 26, 0.7)' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(26, 26, 53, 0.3)' : 'rgba(226, 232, 240, 0.8)',
                    width: cardWidth 
                  }
                ]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
                  <IconComponent size={20} color={stat.color} weight="duotone" />
                </View>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
              </View>
            );
          })}
        </View>

        {/* Conditional Rendering: Quick Setup OR Trade Management */}
        {showQuickSetup ? (
          // Quick Setup for new users
          <View style={styles.section}>
            {/* Quick Setup Header with Gradient Background */}
            <LinearGradient
              colors={isDark 
                ? ['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)', 'transparent'] 
                : ['rgba(99, 102, 241, 0.1)', 'rgba(99, 102, 241, 0.03)', 'transparent']}
              style={styles.quickSetupHeader}
            >
              <View style={styles.quickSetupTitleRow}>
                <View style={[styles.quickSetupIconBg, { backgroundColor: colors.primary + '20' }]}>
                  <Rocket size={22} color={colors.primary} weight="duotone" />
                </View>
                <View>
                  <Text style={[styles.quickSetupMainTitle, { color: theme.text }]}>Quick Setup</Text>
                  <Text style={[styles.quickSetupSubtitle, { color: theme.textSecondary }]}>
                    Complete these steps to start trading
                  </Text>
                </View>
              </View>
              <View style={styles.progressStats}>
                <Text style={[styles.progressText, { color: colors.primary }]}>
                  1/3 Completed
                </Text>
                <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(26, 26, 53, 0.4)' : 'rgba(203, 213, 225, 0.5)' }]}>
                  <LinearGradient
                    colors={[colors.primary, '#8B5CF6']}
                    style={[styles.progressBarFill, { width: '33%' }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </View>
              </View>
            </LinearGradient>

            <View style={styles.list}>
              {ITEMS.map((item) => {
                const IconComponent = item.icon;
                const handlePress = () => {
                  if (item.id === '1') {
                    router.push('/(tabs)/strategies?tab=2');
                  } else if (item.id === '2') {
                    router.push('/(tabs)/explore');
                  } else if (item.id === '3') {
                    router.push('/api-details');
                  }
                };

                return (
                  <View key={item.id} style={styles.setupItemWrapper}>
                    {/* Progress Indicator on Left */}
                    <View style={styles.progressIndicatorWrapper}>
                      <View style={[styles.progressIndicatorTrack, { 
                        backgroundColor: isDark ? 'rgba(26, 26, 53, 0.3)' : 'rgba(203, 213, 225, 0.5)',
                      }]}>
                        <LinearGradient
                          colors={[item.color, item.color + 'cc']}
                          style={[styles.progressIndicatorFill, { height: `${item.completion}%` }]}
                          start={{ x: 0, y: 1 }}
                          end={{ x: 0, y: 0 }}
                        />
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={[styles.setupCard, { 
                        backgroundColor: isDark ? 'rgba(10, 10, 26, 0.7)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(26, 26, 53, 0.3)' : '#e2e8f0',
                        ...shadows.md 
                      }]} 
                      activeOpacity={0.7}
                      onPress={handlePress}
                    >
                      <View style={[styles.setupIconWrap, { backgroundColor: item.color + '20' }]}>
                        <IconComponent size={28} color={item.color} weight="duotone" />
                      </View>
                      
                      <View style={styles.setupTextWrap}>
                        <View style={styles.setupTitleRow}>
                          <Text style={[styles.setupTitle, { color: theme.text }]}>{item.title}</Text>
                          {item.completion === 100 && (
                            <CheckCircle size={18} color={colors.success} weight="fill" />
                          )}
                        </View>
                        <Text style={[styles.setupDescription, { color: theme.textSecondary }]}>{item.description}</Text>
                      </View>
                      
                      <View style={[styles.setupArrow, { backgroundColor: item.color + '15' }]}>
                        <CaretRight size={20} color={item.color} weight="bold" />
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          // Trade Management for users with strategies/subscriptions
          <View style={styles.section}>
          {/* Modern Tab Design */}
          <View style={[styles.tabsWrapper, { 
            backgroundColor: isDark ? 'rgba(10, 10, 26, 0.4)' : 'rgba(241, 245, 249, 0.8)',
          }]}>
            <TouchableOpacity 
              style={[
                styles.tabButton, 
                activeTab === 'open' && styles.activeTabButton,
                activeTab === 'open' && { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#ffffff' }
              ]}
              onPress={() => setActiveTab('open')}
            >
              <LinearGradient
                colors={activeTab === 'open' ? [colors.primary + '20', colors.primary + '10'] : ['transparent', 'transparent']}
                style={styles.tabGradient}
              >
                <Text style={[
                  styles.tabText, 
                  { color: activeTab === 'open' ? colors.primary : theme.textSecondary },
                  activeTab === 'open' && styles.activeTabText
                ]}>Open Position</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.tabButton, 
                activeTab === 'closed' && styles.activeTabButton,
                activeTab === 'closed' && { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#ffffff' }
              ]}
              onPress={() => setActiveTab('closed')}
            >
              <LinearGradient
                colors={activeTab === 'closed' ? [colors.primary + '20', colors.primary + '10'] : ['transparent', 'transparent']}
                style={styles.tabGradient}
              >
                <Text style={[
                  styles.tabText, 
                  { color: activeTab === 'closed' ? colors.primary : theme.textSecondary },
                  activeTab === 'closed' && styles.activeTabText
                ]}>Closed Position</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filterRow}>
            {/* Segment Filter */}
            <TouchableOpacity 
              style={[styles.filterButton, { 
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.15)',
              }]}
              onPress={() => {
                setShowSegmentDropdown(!showSegmentDropdown);
                setShowCloseDropdown(false);
              }}
            >
              <View style={[styles.filterIconWrap, { backgroundColor: colors.primary + '15' }]}>
                <SlidersHorizontal size={14} color={colors.primary} weight="bold" />
              </View>
              <Text style={[styles.filterValue, { color: theme.text }]} numberOfLines={1}>{selectedSegment}</Text>
              <CaretDown size={14} color={theme.textSecondary} weight="bold" style={{ transform: [{ rotate: showSegmentDropdown ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>

            {/* Refresh Button */}
            <TouchableOpacity 
              style={[styles.filterButton, { 
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.15)',
              }]}
              onPress={() => {
                setShowCloseDropdown(false);
                setShowSegmentDropdown(false);
                onRefresh();
              }}
            >
              <View style={[styles.filterIconWrap, { backgroundColor: colors.success + '15' }]}>
                <ArrowClockwise size={14} color={colors.success} weight="bold" />
              </View>
              <Text style={[styles.filterValue, { color: theme.text }]} numberOfLines={1}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Segment Dropdown */}
          {showSegmentDropdown && (
            <Animated.View style={[
              styles.dropdownMenu, 
              { 
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.98)' : 'rgba(255, 255, 255, 0.98)', 
                borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.15)',
                transform: [{ scale: segmentDropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
                opacity: segmentDropdownAnim,
              }
            ]}>
              {SEGMENT_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.dropdownItem, 
                    selectedSegment === option && { backgroundColor: colors.primary + '15' },
                    index === SEGMENT_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => {
                    setSelectedSegment(option);
                    setShowSegmentDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownText, { color: selectedSegment === option ? colors.primary : theme.text }]}>
                    {option}
                  </Text>
                  {selectedSegment === option && (
                    <View style={[styles.dropdownCheck, { backgroundColor: colors.primary }]}>
                      <CheckCircle size={12} color="#fff" weight="bold" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Close Dropdown removed — replaced by Refresh button above */}

          {/* Position Cards */}
          <View style={styles.positionList}>
            {/* Quick Load More for Open Positions (shows above the list) */}
            {activeTab === 'open' && filteredPositions.length > displayLimit && (
              <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
                <LinearGradient
                  colors={isDark ? ['rgba(99, 102, 241, 0.35)', 'rgba(139, 92, 246, 0.25)'] : ['rgba(99, 102, 241, 0.25)', 'rgba(139, 92, 246, 0.18)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loadMoreGradient}
                >
                  <Text style={[styles.loadMoreText, { color: isDark ? '#a5b4fc' : colors.primary }]}>Load More</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading positions...</Text>
              </View>
            ) : positions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {activeTab === 'open' ? 'No open positions' : 'No closed positions'}
                </Text>
              </View>
            ) : positions.map((position, index) => {
              const formattedPosition = formatPosition(position);
              return (
              <View 
                key={`${position.id}-${index}`}
                style={[styles.positionCard, { 
                  backgroundColor: isDark ? 'rgba(10, 10, 26, 0.7)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : '#e2e8f0'
                }]}
              >
                {/* Position Header with MTM and Badges */}
                <View style={styles.positionHeader}>
                  <View style={styles.headerLeft}>
                    {/* Buy/Sell Glassy Badge */}
                    <LinearGradient
                      colors={formattedPosition.type === 'Buy' 
                        ? ['rgba(16, 185, 129, 0.25)', 'rgba(16, 185, 129, 0.15)'] 
                        : ['rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.15)']}
                      style={[styles.typeBadgeGlassy]}
                    >
                      <Text style={[styles.typeBadgeText, { color: formattedPosition.type === 'Buy' ? colors.success : colors.error }]}>
                        {formattedPosition.type === 'Buy' ? 'B' : 'S'}
                      </Text>
                    </LinearGradient>
                    <View style={styles.symbolSection}>
                      <View style={styles.symbolRow}>
                        <Text style={[styles.positionSymbol, { color: theme.text }]}>{formattedPosition.symbol}</Text>
                        {activeTab === 'open' && (
                          <TouchableOpacity 
                            style={[styles.positionInfoIcon, {
                              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                            }]}
                            onPress={() => router.push(`/open-trade-detail?id=${formattedPosition.id}`)}
                          >
                            <ArrowSquareOut size={12} color={colors.primary} weight="bold" />
                          </TouchableOpacity>
                        )}
                        {activeTab === 'closed' && (
                          <TouchableOpacity
                            style={[styles.positionInfoIcon, {
                              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                            }]}
                            onPress={() => {
                              router.push(`/close-trade-detail?id=${formattedPosition.id}`);
                            }}
                          >
                            <Info size={12} color={colors.primary} weight="bold" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.timeRow}>
                        <Clock size={10} color={theme.textSecondary} weight="bold" />
                        <Text style={[styles.positionTime, { color: theme.textSecondary }]}>{formattedPosition.time}</Text>
                      </View>
                      {formattedPosition.strategyName && (
                        <Text style={[styles.strategyNameText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {formattedPosition.strategyName}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.headerRight}>
                    {/* MTM Value */}
                    <Text style={[styles.mtmValue, { color: Number(formattedPosition.mtm ?? 0) >= 0 ? colors.success : colors.error }]}>
                      {Number(formattedPosition.mtm ?? 0) >= 0 ? '+' : ''}{Number(formattedPosition.mtm ?? 0).toFixed(2)} USD
                    </Text>
                    {/* Mode Badge (Paper / Live) */}
                    {(() => {
                      const isPaper =
                        formattedPosition.tradeMode === 'paper' ||
                        (formattedPosition.broker && String(formattedPosition.broker).toLowerCase().includes('paper')) ||
                        ((formattedPosition.orderId || formattedPosition.tradeId) && String((formattedPosition.orderId || formattedPosition.tradeId)).toLowerCase().includes('paper'));
                      const badgeColors: readonly [string, string] = isPaper ? ['rgba(37, 99, 235, 0.12)', 'rgba(37, 99, 235, 0.06)'] : ['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.06)'];
                      const textColor = isPaper ? colors.primary : colors.success;
                      const label = isPaper ? 'Paper' : 'Live';
                      return (
                        <LinearGradient colors={badgeColors} style={styles.statusBadgeGlassy}>
                          <Text style={[styles.statusBadgeText, { color: textColor }]}>{label}</Text>
                        </LinearGradient>
                      );
                    })()}
                  </View>
                </View>

                {/* Position Details - Single Row */}
                <View style={[styles.positionDetailsRow, { 
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                }]}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Volume</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>{Number(formattedPosition.qty ?? 0).toFixed(4)}</Text>
                  </View>
                  <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(26, 26, 53, 0.4)' : 'rgba(203, 213, 225, 0.6)' }]} />
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Entry Price</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>{Number(formattedPosition.entryPrice ?? formattedPosition.openPrice ?? 0).toFixed(4)}</Text>
                  </View>
                  <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(26, 26, 53, 0.4)' : 'rgba(203, 213, 225, 0.6)' }]} />
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      {activeTab === 'open' ? 'Current Price' : 'Exit Price'}
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {activeTab === 'open' 
                        ? Number(formattedPosition.ltp ?? 0).toFixed(5)
                        : Number(formattedPosition.exitPrice ?? 0).toFixed(4)
                      }
                    </Text>
                  </View>
                </View>

                {/* Action Buttons - Conditional for Open/Closed */}
                {activeTab === 'open' ? (() => {
                  const isPaper =
                    formattedPosition.tradeMode === 'paper' ||
                    (formattedPosition.broker && String(formattedPosition.broker).toLowerCase().includes('paper')) ||
                    ((formattedPosition.orderId || formattedPosition.tradeId) && String((formattedPosition.orderId || formattedPosition.tradeId)).toLowerCase().includes('paper'));
                  return (
                    <View style={styles.positionActions}>
                      <TouchableOpacity 
                        style={[styles.tpSlButton, { 
                          backgroundColor: isDark ? 'rgba(10, 10, 26, 0.8)' : 'rgba(241, 245, 249, 0.9)',
                          borderColor: isDark ? 'rgba(26, 26, 53, 0.5)' : 'rgba(203, 213, 225, 0.8)',
                          opacity: isPaper ? 0.5 : 1,
                        }]}
                        disabled={isPaper}
                        onPress={() => { if (!isPaper) handleSLTP(formattedPosition); }}
                      >
                        <Text style={[styles.tpSlText, { color: theme.text }]}>TP/SL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.closeButton, { opacity: isPaper ? 0.6 : 1 }]}
                        disabled={isPaper}
                        onPress={() => !isPaper && handleClosePosition(formattedPosition.id)}
                      >
                        <LinearGradient
                          colors={['#EF4444', '#DC2626']}
                          style={styles.closeButtonGradient}
                        >
                          <Lightning size={14} color="#fff" weight="fill" />
                          <Text style={styles.closeButtonText}>Close</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  );
                })() : (
                  <View style={styles.positionActions} />
                )}
              </View>
            );
            })}
          </View>

          {/* Load More Button - Only show when there are more positions to load */}
          {hasMorePositions && positions.length >= 6 && (
            <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
              <LinearGradient
                colors={isDark ? ['rgba(99, 102, 241, 0.35)', 'rgba(139, 92, 246, 0.25)', 'rgba(59, 130, 246, 0.2)'] : ['rgba(99, 102, 241, 0.25)', 'rgba(139, 92, 246, 0.18)', 'rgba(59, 130, 246, 0.12)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loadMoreGradient}
              >
                <Text style={[styles.loadMoreText, { color: isDark ? '#a5b4fc' : colors.primary }]}>Load More</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      {/* SL/TP Modal */}
      <Modal
        visible={showSLTPModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSLTPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { 
            backgroundColor: isDark ? '#0a0a1a' : '#ffffff',
          }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Set Stop Loss & Take Profit</Text>
              <TouchableOpacity 
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(30, 40, 60, 0.5)' : 'rgba(226, 232, 240, 0.8)' }]}
                onPress={() => setShowSLTPModal(false)}
              >
                <X size={18} color={theme.textSecondary} weight="bold" />
              </TouchableOpacity>
            </View>
            
            {/* Position Details */}
            <View style={[styles.positionDetailsBanner, { 
              backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(241, 245, 249, 0.8)',
            }]}>
              <Text style={[styles.modalPositionSymbol, { color: theme.text }]}>
                {selectedPosition?.symbol} - {selectedPosition?.type}
              </Text>
              <Text style={[styles.positionEntry, { color: theme.textSecondary }]}>
                Entry: {Number(selectedPosition?.entryPrice ?? 0).toFixed(4)}
              </Text>
              <Text style={[styles.positionCurrent, { color: theme.textSecondary }]}>
                Current: {Number(selectedPosition?.ltp ?? 0).toFixed(4)} | MTM: <Text style={{ color: (selectedPosition?.mtm || 0) >= 0 ? colors.success : colors.error }}>
                  ${Number(selectedPosition?.mtm ?? 0).toFixed(2)}
                </Text>
              </Text>
            </View>
            
            {/* Stop Loss Section */}
            <View style={styles.inputSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Stop Loss</Text>
              
              {/* SL Type Radio Buttons */}
              <View style={styles.radioGroup}>
                <TouchableOpacity 
                  style={styles.radioItem}
                  onPress={() => setSlType('points')}
                >
                  <View style={[styles.radioCircle, { borderColor: slType === 'points' ? colors.primary : theme.textSecondary }]}>
                    {slType === 'points' && <View style={[styles.radioCircleInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Points</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.radioItem}
                  onPress={() => setSlType('percentage')}
                >
                  <View style={[styles.radioCircle, { borderColor: slType === 'percentage' ? colors.primary : theme.textSecondary }]}>
                    {slType === 'percentage' && <View style={[styles.radioCircleInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Percentage</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.radioItem}
                  onPress={() => setSlType('price')}
                >
                  <View style={[styles.radioCircle, { borderColor: slType === 'price' ? colors.primary : theme.textSecondary }]}>
                    {slType === 'price' && <View style={[styles.radioCircleInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Price</Text>
                </TouchableOpacity>
              </View>
              
              {/* SL Input */}
              <View style={[styles.slTpInput, { 
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                borderColor: isDark ? 'rgba(26, 26, 53, 0.5)' : 'rgba(203, 213, 225, 0.8)',
              }]}>
                <TextInput
                  style={[styles.slTpInputField, { color: theme.text }]}
                  placeholder={slType === 'points' ? '50' : slType === 'percentage' ? '5' : '90000'}
                  placeholderTextColor={theme.textSecondary}
                  value={stopLoss}
                  onChangeText={handleStopLossChange}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            
            {/* Take Profit Section */}
            <View style={styles.inputSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Take Profit</Text>
              
              {/* TP Type Radio Buttons */}
              <View style={styles.radioGroup}>
                <TouchableOpacity 
                  style={styles.radioItem}
                  onPress={() => setTpType('points')}
                >
                  <View style={[styles.radioCircle, { borderColor: tpType === 'points' ? colors.primary : theme.textSecondary }]}>
                    {tpType === 'points' && <View style={[styles.radioCircleInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Points</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.radioItem}
                  onPress={() => setTpType('percentage')}
                >
                  <View style={[styles.radioCircle, { borderColor: tpType === 'percentage' ? colors.primary : theme.textSecondary }]}>
                    {tpType === 'percentage' && <View style={[styles.radioCircleInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Percentage</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.radioItem}
                  onPress={() => setTpType('price')}
                >
                  <View style={[styles.radioCircle, { borderColor: tpType === 'price' ? colors.primary : theme.textSecondary }]}>
                    {tpType === 'price' && <View style={[styles.radioCircleInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.text }]}>Price</Text>
                </TouchableOpacity>
              </View>
              
              {/* TP Input */}
              <View style={[styles.slTpInput, { 
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                borderColor: isDark ? 'rgba(26, 26, 53, 0.5)' : 'rgba(203, 213, 225, 0.8)',
              }]}>
                <TextInput
                  style={[styles.slTpInputField, { color: theme.text }]}
                  placeholder={tpType === 'points' ? '100' : tpType === 'percentage' ? '10' : '95000'}
                  placeholderTextColor={theme.textSecondary}
                  value={takeProfit}
                  onChangeText={handleTakeProfitChange}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            
            {/* Info Box */}
            <View style={[styles.infoBox, { 
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.08)',
            }]}>
              <Info size={16} color={colors.primary} weight="fill" />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                <Text style={{ fontWeight: '600', color: theme.text }}>Points:</Text> Standard pip/point value. For forex, 50 points = 0.0050 price move (0.50 for JPY pairs). For crypto, 1 point = $1 price move.
              </Text>
            </View>
            
            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.cancelButton, { 
                  backgroundColor: isDark ? 'rgba(26, 26, 53, 0.3)' : 'rgba(226, 232, 240, 0.8)',
                }]}
                onPress={() => setShowSLTPModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, { 
                  backgroundColor: (!stopLoss && !takeProfit) ? (isDark ? 'rgba(26, 26, 53, 0.3)' : 'rgba(203, 213, 225, 0.5)') : colors.primary,
                }]}
                disabled={!stopLoss && !takeProfit}
                onPress={handleSaveSLTP}
              >
                <Text style={[styles.saveButtonText, { 
                  color: (!stopLoss && !takeProfit) ? theme.textSecondary : '#ffffff',
                }]}>Save SL/TP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet Dropdown Modal */}
      <Modal
        visible={showWalletDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWalletDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.walletModalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowWalletDropdown(false)}
        >
          <View style={[styles.walletDropdownModal, { backgroundColor: isDark ? '#0f0f1e' : '#ffffff', borderColor: theme.border }]}>
            <View style={styles.walletDropdownHeader}>
              <Wallet size={20} color={colors.primary} weight="fill" />
              <Text style={[styles.walletDropdownTitle, { color: theme.textSecondary }]}>Wallet Balance</Text>
            </View>
            <Text style={[styles.walletDropdownAmount, { color: theme.text }]}>₹{Number(walletBalance ?? 0).toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
      
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  // Modern Tab Styles
  tabsWrapper: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  activeTabButton: {
    ...shadows.sm,
  },
  tabGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabText: {
    ...typography.labelMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '700',
  },
  // Legacy tab styles (keep for reference)
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  header: {
    paddingTop: 60,
    paddingBottom:7,
    borderBottomWidth: 1,
  },
  headerContent: {
    paddingHorizontal: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoContainer: {
    // width: 56,
    // height: 56,
    borderRadius: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 84,
    height: 40,
    // resizeMode: 'contain',
  },
  logoText: {
    ...typography.h2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  walletModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  walletDropdownModal: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 75 : 110,
    right: 16,
    width: 180,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 50,
  },
  walletDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  walletDropdownTitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  walletDropdownAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  scrollContent: {
    paddingTop: spacing.xl,
  },
  statsContainer: {
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  statCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 95,
    borderColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
    // Ensure background fills entire card
    justifyContent: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.labelSmall,
    fontSize: 11,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    ...typography.h3,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  viewAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    backgroundColor: colors.primaryBg,
  },
  viewAllText: {
    ...typography.labelMedium,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  filterIconWrap: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterValue: {
    ...typography.labelSmall,
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 135,
    left: spacing.xl,
    right: width / 2 + spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginTop: spacing.xs,
    zIndex: 1000,
    overflow: 'hidden',
    ...shadows.lg,
  },
  closeDropdown: {
    left: width / 2 + spacing.xs,
    right: spacing.xl,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownText: {
    ...typography.bodyMedium,
    fontWeight: '500',
  },
  dropdownCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionList: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  positionCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  typeBadgeGlassy: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  symbolSection: {
    gap: 2,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  positionInfoIcon: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionSymbol: {
    ...typography.h3,
    fontSize: 15,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionTime: {
    ...typography.caption,
    fontSize: 10,
  },
  strategyNameText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  mtmValue: {
    ...typography.labelMedium,
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadgeGlassy: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '700',
  },
  positionDetailsRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.labelSmall,
    fontSize: 9,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    ...typography.labelMedium,
    fontSize: 12,
    fontWeight: '700',
  },
  detailDivider: {
    width: 1,
    height: '100%',
    marginHorizontal: spacing.xs,
  },
  positionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tpSlButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tpSlText: {
    ...typography.labelMedium,
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
  },
  closeButtonText: {
    ...typography.labelMedium,
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  viewDetailsText: {
    ...typography.labelMedium,
    fontSize: 13,
    fontWeight: '700',
  },
  viewDetailsIconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedIcon: {
    position: 'absolute',
    right: 10,
    bottom: 6,
    width: 35,
    height:35,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  loadMoreButton: {
    marginTop: spacing.lg,
    borderRadius: 22,
    overflow: 'hidden',
    alignSelf: 'center',
    minWidth: 150,
    maxWidth: 250,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  loadMoreGradient: {
    paddingVertical: 11,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backdropFilter: 'blur(12px)',
  },
  loadMoreText: {
    ...typography.labelMedium,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Legacy position styles
  positionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionNumber: {
    ...typography.labelMedium,
    fontSize: 13,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  typeText: {
    ...typography.labelSmall,
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeLarge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusTextLarge: {
    ...typography.labelSmall,
    fontSize: 11,
    fontWeight: '700',
  },
  positionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridItem: {
    flex: 1,
  },
  gridLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    marginBottom: 3,
  },
  gridValue: {
    ...typography.labelMedium,
    fontSize: 13,
    fontWeight: '700',
  },
  positionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  actionButtonText: {
    ...typography.labelSmall,
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonFilled: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  actionButtonTextWhite: {
    ...typography.labelSmall,
    fontSize: 12,
    fontWeight: '700',
  },
  viewAllButtonLarge: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  viewAllTextLarge: {
    ...typography.labelMedium,
    fontSize: 14,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalStrategyInfo: {
    marginBottom: spacing.xl,
  },
  modalStrategyLabel: {
    ...typography.labelMedium,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalStrategyDesc: {
    ...typography.bodySmall,
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.labelSmall,
    fontSize: 11,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  currencySymbol: {
    ...typography.bodyMedium,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.bodyMedium,
    fontSize: 14,
  },
  inputHint: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  currentPositionBox: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  currentPositionText: {
    ...typography.bodySmall,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.labelMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.labelMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  positionDetailsBanner: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  modalPositionSymbol: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  positionEntry: {
    fontSize: 12,
    marginBottom: 2,
  },
  positionCurrent: {
    fontSize: 12,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 13,
  },
  slTpInput: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  slTpInputField: {
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  list: {
    gap: spacing.lg,
  },
  setupItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 90,
  },
  progressIndicatorWrapper: {
    width: 4,
    height: '100%',
    alignSelf: 'stretch',
  },
  progressIndicatorTrack: {
    width: 4,
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  progressIndicatorFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderRadius: 2,
  },
  setupCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    minHeight: 80,
    ...shadows.md,
  },
  setupIconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  setupTextWrap: {
    flex: 1,
  },
  setupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  setupTitle: {
    ...typography.labelMedium,
    fontSize: 15,
    fontWeight: '700',
  },
  setupDescription: {
    ...typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
  },
  setupArrow: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickSetupHeader: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  quickSetupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  quickSetupIconBg: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickSetupMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickSetupSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 85,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  bottomSpacer: {
    height: Platform.OS === 'android' ? 80 : 100,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
