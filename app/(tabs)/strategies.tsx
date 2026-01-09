import { borderRadius, colors, getTheme, shadows, spacing } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { usePaperPositionUpdates, useStrategyUpdates } from '@/hooks/useWebSocket';
import { paperPositionService, strategyService, tradeService } from '@/services';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowClockwise,
  ArrowSquareOut,
  Bank,
  CalendarBlank,
  CaretDown,
  ChartLineUp,
  CheckCircle,
  CheckSquare,
  Clock,
  Copy,
  CurrencyDollar,
  Eye,
  FileText,
  Globe,
  Info,
  Lightbulb,
  Lightning,
  Link,
  Lock,
  MagnifyingGlass,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Rocket,
  SlidersHorizontal,
  Square,
  Star,
  Stop,
  Storefront,
  Trash,
  TrendUp,
  Users,
  Warning,
  X,
  XCircle
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width: SCREEN_WIDTH, width } = Dimensions.get('window');

const TABS = [
  { name: 'Deployed', Icon: Rocket },
  { name: 'My Strategies', Icon: Lightbulb },
  { name: 'Marketplace', Icon: Storefront },
];

// Stats for Subscribed Strategies tab - will be computed from API data
const getSubscribedStats = (subscriptions: any[]) => [
  { label: 'Subscribed', value: String(subscriptions.length), icon: Users, color: colors.primary, bgColor: 'rgba(59,130,246,0.04)' },
  { label: 'Active', value: String(subscriptions.filter(s => s.isActive).length), icon: CheckCircle, color: colors.success, bgColor: 'rgba(16,185,129,0.04)' },
  { label: 'Total Lots', value: String(subscriptions.reduce((acc, s) => acc + (s.lots || 0), 0)), icon: XCircle, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.04)' },
  { label: 'Public', value: String(subscriptions.filter(s => s.strategy?.isPublic).length), icon: Globe, color: '#7C3AED', bgColor: 'rgba(124,58,237,0.04)' },
  { label: 'Private', value: String(subscriptions.filter(s => !s.strategy?.isPublic).length), icon: Lock, color: '#06b6d4', bgColor: 'rgba(6,182,212,0.03)' },
];

// Stats for My Strategies tab - will be computed from API data
const getMyStrategiesStats = (strategies: any[]) => [
  { label: 'Total', value: String(strategies.length), icon: Users, color: colors.primary, bgColor: 'rgba(59,130,246,0.04)' },
  { label: 'Active', value: String(strategies.filter(s => s.isActive).length), icon: CheckCircle, color: colors.success, bgColor: 'rgba(16,185,129,0.04)' },
  { label: 'Inactive', value: String(strategies.filter(s => !s.isActive).length), icon: XCircle, color: '#ef4444', bgColor: 'rgba(239,68,68,0.04)' },
  { label: 'Public', value: String(strategies.filter(s => s.isPublic || s.type === 'Public').length), icon: Globe, color: '#7C3AED', bgColor: 'rgba(124,58,237,0.04)' },
  { label: 'Private', value: String(strategies.filter(s => !s.isPublic && s.type !== 'Public').length), icon: Lock, color: '#06b6d4', bgColor: 'rgba(6,182,212,0.03)' },
];

// Mock Brokers Data - this should come from API
const BROKERS_DATA = [
  {
    id: 'broker1',
    name: 'Binance',
    type: 'Crypto',
    description: 'Crypto exchange',
    isConnected: true,
  },
  {
    id: 'broker2',
    name: 'MT5',
    type: 'Forex',
    description: 'Forex trading',
    isConnected: true,
  },
];

export default function StrategiesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const [activeTab, setActiveTab] = useState(0);
  const [summaryMode, setSummaryMode] = useState<'expiry' | 'today'>('expiry');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [backtestStatus, setBacktestStatus] = useState<'Completed' | 'In Progress' | 'Archived'>('Completed');
  const [showBacktestMenu, setShowBacktestMenu] = useState(false);
  const [selectedType, setSelectedType] = useState<string[]>(['All']);
  const [selectedViewType, setSelectedViewType] = useState<string[]>([]);
  const [selectedSort, setSelectedSort] = useState<string[]>([]);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
  const [selectedFee, setSelectedFee] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // API loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const [closedPositions, setClosedPositions] = useState<any[]>([]);
  const [deployedStrategies, setDeployedStrategies] = useState<any[]>([]);
  const [marketplaceStrategies, setMarketplaceStrategies] = useState<any[]>([]);
  const [myStrategiesList, setMyStrategiesList] = useState<any[]>([]);
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>([]);
  
  // Real-time WebSocket hooks
  useStrategyUpdates((strategy: any) => {
    // Update deployed strategies
    setDeployedStrategies(prev => 
      prev.map(s => s.id === strategy.strategyId ? { ...s, ...strategy } : s)
    );
    // Update own strategies
    setOwnStrategies(prev => 
      prev.map(s => s.id === strategy.strategyId ? { ...s, ...strategy } : s)
    );
  });
  
  usePaperPositionUpdates((position: any) => {
    if (position.positionStatus === 'Open') {
      setOpenPositions(prev => {
        const exists = prev.find(p => p.id === position.positionId);
        if (exists) {
          return prev.map(p => p.id === position.positionId ? { ...p, ...position } : p);
        }
        return [position, ...prev];
      });
    } else {
      // Move to closed
      setOpenPositions(prev => prev.filter(p => p.id !== position.positionId));
      setClosedPositions(prev => [position, ...prev]);
    }
  });
  
  // Deployed tab states
  const [deployedPositionTab, setDeployedPositionTab] = useState<'open' | 'closed'>('open');
  const [selectedSegment, setSelectedSegment] = useState('All Segments');
  const [selectedClose, setSelectedClose] = useState('Close All');
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false);
  const [showCloseDropdown, setShowCloseDropdown] = useState(false);
  const [showSLTPModal, setShowSLTPModal] = useState(false);
  const [slType, setSlType] = useState<'points' | 'percentage' | 'price'>('points');
  const [tpType, setTpType] = useState<'points' | 'percentage' | 'price'>('points');
  // Local state for user's own strategies so we can delete them with confirmation
  const [ownStrategies, setOwnStrategies] = useState<any[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  
  // My Strategies tab states
  const [myStrategiesSubTab, setMyStrategiesSubTab] = useState<'subscribed' | 'myStrategies' | 'own'>('subscribed');
  const [myStrategiesSearch, setMyStrategiesSearch] = useState('');

  // Subscribed Strategies modals & states
  const [subscribedStrategies, setSubscribedStrategies] = useState<any[]>([]);
  const [showStrategyDetailModal, setShowStrategyDetailModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const [showBrokersModal, setShowBrokersModal] = useState(false);
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>(['broker2']);
  const [showTradeModeModal, setShowTradeModeModal] = useState(false);
  const [selectedTradeMode, setSelectedTradeMode] = useState<'paper' | 'live' | null>(null);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);

  // My Own Strategies modals & states
  const [showOwnDetailModal, setShowOwnDetailModal] = useState(false);
  const [showOwnEditModal, setShowOwnEditModal] = useState(false);
  const [showOwnDeleteModal, setShowOwnDeleteModal] = useState(false);
  const [showOwnBrokersModal, setShowOwnBrokersModal] = useState(false);
  const [showOwnTradeModeModal, setShowOwnTradeModeModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [selectedOwnStrategy, setSelectedOwnStrategy] = useState<any>(null);
  const [selectedOwnBrokers, setSelectedOwnBrokers] = useState<string[]>([]);
  const [ownPauseMessage, setOwnPauseMessage] = useState<string | null>(null);
  
  // Pagination for deployed cards
  const [deployedCardsLimit, setDeployedCardsLimit] = useState(6);
  
  // Close All functionality states
  const [allStrategiesPaused, setAllStrategiesPaused] = useState(false);
  const [showCloseAllModal, setShowCloseAllModal] = useState(false);
  const [showCloseAllTooltip, setShowCloseAllTooltip] = useState(false);
  
  // Marketplace filter states
  const [marketplaceFilters, setMarketplaceFilters] = useState({
    status: [] as string[],
    type: [] as string[],
    madeBy: [] as string[],
    segment: [] as string[],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedMarketplaceStrategy, setSelectedMarketplaceStrategy] = useState<any>(null);
  const [marketplaceSubTab, setMarketplaceSubTab] = useState<'public' | 'own'>('public');
  
  // Pagination states for Load More functionality
  const [marketplaceVisibleCount, setMarketplaceVisibleCount] = useState(6);
  const [subscribedVisibleCount, setSubscribedVisibleCount] = useState(6);
  const [myStrategiesVisibleCount, setMyStrategiesVisibleCount] = useState(6);
  const [ownStrategiesVisibleCount, setOwnStrategiesVisibleCount] = useState(6);

  // Animation for filters sidebar (slide from right)
  const filterSlideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Fetch data from APIs
  const fetchData = useCallback(async () => {
    try {
      const [
        strategiesRes,
        marketplaceRes,
        subscriptionsRes,
        openPosRes,
        closedPosRes,
      ] = await Promise.all([
        strategyService.getStrategies(),
        strategyService.getMarketplaceStrategies(),
        strategyService.getSubscriptions(),
        paperPositionService.getOpenPositions({ limit: 100 }),
        tradeService.getTrades({ status: 'Completed,Failed', limit: 100 }),
      ]);

      console.log('Strategies response:', strategiesRes);
      
      if (strategiesRes.success && strategiesRes.data) {
        console.log('Setting own strategies:', strategiesRes.data.length);
        setMyStrategiesList(strategiesRes.data);
        setOwnStrategies(strategiesRes.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description || '',
          visibility: s.isPublic ? 'Public' : 'Private',
          status: s.isActive ? 'Active' : 'Inactive',
          stopped: s.isPaused,
          lots: s.lots || 1,
          expiry: 'N/A',
          createdAt: new Date(s.createdAt).toLocaleDateString(),
          lastUpdated: new Date(s.updatedAt).toLocaleString(),
          segment: s.segment,
          type: 'Intraday',
          capital: `₹${Number(s.capital ?? 0).toFixed(2)}`,
          symbol: s.symbol,
          symbolValue: 'N/A',
          tradeMode: s.tradeMode || 'paper',
          webhookUrl: s.webhookUrl || 'https://app.uptrender.in/api/algo-trades/webhook',
          webhookSecret: s.webhookSecret || '',
        })));
      }

      if (marketplaceRes.success && marketplaceRes.data) {
        setMarketplaceStrategies(marketplaceRes.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          author: s.author?.name || 'User',
          capital: `₹${s.capital?.toLocaleString() || '10,000'}`,
          symbol: s.symbol,
          subscription: s.price > 0 ? `₹${s.price.toLocaleString()}` : 'Free',
          performance: `+${s.performance || 0}%`,
          visibility: s.isPublic ? 'Public' : 'Private',
          segment: s.segment,
          madeBy: s.madeBy || 'User',
          status: s.isActive ? 'Active' : 'Inactive',
        })));
      }

      if (subscriptionsRes.success && subscriptionsRes.data) {
        setSubscriptionsList(subscriptionsRes.data);
        setSubscribedStrategies(subscriptionsRes.data.map((sub: any) => ({
          id: sub.id,
          strategyId: sub.strategyId,
          name: sub.strategy?.name || 'Unknown',
          description: sub.strategy?.description || '',
          author: sub.strategy?.author?.name || 'Unknown',
          status: sub.isActive ? 'Active' : 'Inactive',
          isPaused: sub.isPaused,
          lots: sub.lots,
          expiry: sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString() : 'N/A',
          subscribedAt: new Date(sub.subscribedAt).toLocaleDateString(),
          segment: sub.strategy?.segment || 'Forex',
          type: 'Intraday',
          capital: `₹${Number(sub.strategy?.capital ?? 0).toFixed(2)}`,
          symbol: sub.strategy?.symbol || 'N/A',
          isPublic: sub.strategy?.isPublic,
          isStopped: sub.isPaused,
          tradeMode: sub.tradeMode,
        })));
      }

      if (openPosRes.success && openPosRes.data) {
        setOpenPositions(openPosRes.data.map((p: any) => ({
          id: p.id,
          symbol: p.symbol,
          type: p.type,
          qty: Number(p.volume ?? 0),
          entryPrice: Number(p.openPrice ?? 0),
          ltp: Number(p.currentPrice ?? p.openPrice ?? 0),
          mtm: Number(p.profit ?? 0),
          status: 'Open',
          time: new Date(p.openTime || p.createdAt).toLocaleString(),
          strategyName: p.strategy?.name || 'Manual Trade',
          broker: 'Paper Trading',
          takeProfit: Number(p.takeProfit ?? 0),
          stopLoss: Number(p.stopLoss ?? 0),
        })));
      }

      if (closedPosRes.success && closedPosRes.data) {
        console.log('Strategies - Closed positions received:', closedPosRes.data.length);
        const mappedClosed = closedPosRes.data.map((trade: any) => ({
          ...trade,
          id: trade.id,
          symbol: trade.symbol,
          type: trade.type,
          qty: Number(trade.filledQuantity || trade.amount || trade.volume || 0),
          entryPrice: Number(trade.avgFillPrice || trade.price || 0),
          exitPrice: Number(trade.currentPrice || trade.closePrice || 0),
          mtm: Number(trade.pnl || trade.profit || 0),
          status: trade.status || 'Closed',
          time: new Date(trade.signalReceivedAt || trade.createdAt || trade.openTime).toLocaleString(),
          strategyName: trade.strategyName || trade.strategy?.name || 'Manual Trade',
        }));
        setClosedPositions(mappedClosed);
      }

      // closed positions already mapped above when `closedPosRes.success` is true
      // (avoid overwriting statuses with an incorrect fallback mapping)
    } catch (error) {
      console.error('Error fetching strategies data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);


  const openFiltersSidebar = () => {
    setShowFilters(true);
    Animated.timing(filterSlideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeFiltersSidebar = () => {
    Animated.timing(filterSlideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowFilters(false);
      filterSlideAnim.setValue(SCREEN_WIDTH);
    });
  };
  
  // Edit form states
  const [editName, setEditName] = useState('');
  const [editSegment, setEditSegment] = useState('Forex');
  const [editType, setEditType] = useState('Intraday');
  const [editCapital, setEditCapital] = useState('');
  const [editSymbol, setEditSymbol] = useState('');
  const [editSymbolValue, setEditSymbolValue] = useState('');
  const [editNumberValue, setEditNumberValue] = useState('1');
  const [editDescription, setEditDescription] = useState('');
  const [editInstrumentType, setEditInstrumentType] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editSlType, setEditSlType] = useState('Percent (%)');
  const [editSlValue, setEditSlValue] = useState('');
  const [editTpType, setEditTpType] = useState('Percent (%)');
  const [editTpValue, setEditTpValue] = useState('');
  const [editStopLossPercent, setEditStopLossPercent] = useState('');
  const [editTargetPercent, setEditTargetPercent] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editMarketType, setEditMarketType] = useState('Intraday');
  const [editOrderType, setEditOrderType] = useState('Buy');
  
  // Dropdown visibility states for edit modal
  const [showEditSegmentDropdown, setShowEditSegmentDropdown] = useState(false);
  const [showEditTypeDropdown, setShowEditTypeDropdown] = useState(false);
  const [showEditMarketTypeDropdown, setShowEditMarketTypeDropdown] = useState(false);
  const [showEditOrderTypeDropdown, setShowEditOrderTypeDropdown] = useState(false);
  const [showEditSlTypeDropdown, setShowEditSlTypeDropdown] = useState(false);
  const [showEditTpTypeDropdown, setShowEditTpTypeDropdown] = useState(false);

  // Sanitize numeric input to allow only numbers and decimal point
  const sanitizeNumericInput = (text: string) => {
    if (!text) return '';
    // Remove any character that's not a digit or dot
    let cleaned = text.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 1) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  };

  // Handle stop loss input with numeric validation
  const handleStopLossChange = (text: string) => {
    setStopLoss(sanitizeNumericInput(text));
  };

  // Handle take profit input with numeric validation
  const handleTakeProfitChange = (text: string) => {
    setTakeProfit(sanitizeNumericInput(text));
  };

  // Save SL/TP with type conversion
  const handleSaveSLTP = async () => {
    if (!selectedPosition) return;
    try {
      let finalStopLoss = undefined as number | undefined;
      let finalTakeProfit = undefined as number | undefined;

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
        setOpenPositions(prev => prev.map(p => p.id === selectedPosition.id ? { ...p, stopLoss: finalStopLoss, takeProfit: finalTakeProfit } : p));
        Alert.alert('Success', 'Stop Loss and Take Profit updated successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to update SL/TP');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update SL/TP');
    }
  };

  const SEGMENT_OPTIONS = ['All Segments', 'Indian', 'Crypto', 'Forex'];
  const CLOSE_OPTIONS = ['Close All', 'Close Profit', 'Close Loss'];

  React.useEffect(() => {
    const tabParam = params?.tab as string | undefined;
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < TABS.length) {
        setActiveTab(parsed);
      } else {
        // try matching by name
        const idx = TABS.findIndex(t => t.name.toLowerCase() === String(tabParam).toLowerCase());
        if (idx >= 0) setActiveTab(idx);
      }
    }
  }, [params]);

  // Use API data - no more fallback to static data
  const positions = deployedPositionTab === 'open' ? (openPositions || []) : (closedPositions || []);

  // Marketplace filter functions
  const toggleFilter = (category: 'status' | 'type' | 'madeBy' | 'segment', value: string) => {
    setMarketplaceFilters(prev => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter(item => item !== value)
        : [...prev[category], value]
    }));
  };

  const resetFilters = () => {
    setMarketplaceFilters({
      status: [],
      type: [],
      madeBy: [],
      segment: [],
    });
  };

  const getFilteredMarketplaceStrategies = () => {
    // First filter by public/own sub-tab
    let strategiesToFilter = marketplaceStrategies;
    if (marketplaceSubTab === 'public') {
      strategiesToFilter = marketplaceStrategies.filter(s => s.visibility === 'Public');
    } else {
      // 'own' tab - show user's private strategies
      strategiesToFilter = ownStrategies.filter(s => s.visibility === 'Private' || s.type === 'Private');
    }
    
    return strategiesToFilter.filter(strategy => {
      if (marketplaceFilters.status.length > 0 && !marketplaceFilters.status.includes(strategy.status)) return false;
      if (marketplaceFilters.type.length > 0 && !marketplaceFilters.type.includes(strategy.visibility)) return false;
      if (marketplaceFilters.madeBy.length > 0 && !marketplaceFilters.madeBy.includes(strategy.madeBy)) return false;
      if (marketplaceFilters.segment.length > 0 && !marketplaceFilters.segment.includes(strategy.segment)) return false;
      
      // Search filter
      if (marketplaceSearchQuery) {
        const query = marketplaceSearchQuery.toLowerCase();
        return strategy.name?.toLowerCase().includes(query) || 
               strategy.symbol?.toLowerCase().includes(query);
      }
      
      return true;
    });
  };

  const getFilterCounts = () => {
    const strategiesToCount = marketplaceStrategies;
    return {
      total: strategiesToCount.length,
      active: strategiesToCount.filter(s => s.status === 'Active').length,
      inactive: strategiesToCount.filter(s => s.status === 'Inactive').length,
      public: strategiesToCount.filter(s => s.visibility === 'Public').length,
      admin: strategiesToCount.filter(s => s.madeBy === 'Admin').length,
      user: strategiesToCount.filter(s => s.madeBy === 'User').length,
      forex: strategiesToCount.filter(s => s.segment === 'Forex').length,
      indian: strategiesToCount.filter(s => s.segment === 'Indian').length,
      crypto: strategiesToCount.filter(s => s.segment === 'Crypto').length,
    };
  };

  const filterCounts = getFilterCounts();
  const filteredMarketplaceStrategies = getFilteredMarketplaceStrategies();

  // Calculate deployed stats from API data
  const deployedPnL = openPositions.reduce((acc, p) => acc + (p.mtm || 0), 0);
  const openCount = openPositions.length;
  const closedCount = closedPositions.length;

  const renderDeployedTab = () => (
    <View style={styles.deployedContainer}>
      {/* Position Tabs */}
      <View style={[styles.positionTabsWrapper, { 
        backgroundColor: isDark ? 'rgba(10, 10, 26, 0.4)' : 'rgba(241, 245, 249, 0.8)',
      }]}>
        <TouchableOpacity 
          style={[
            styles.positionTabButton, 
            deployedPositionTab === 'open' && styles.activePositionTab,
            deployedPositionTab === 'open' && { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#ffffff' }
          ]}
          onPress={() => setDeployedPositionTab('open')}
        >
          <LinearGradient
            colors={deployedPositionTab === 'open' ? [colors.primary + '20', colors.primary + '10'] : ['transparent', 'transparent']}
            style={styles.positionTabGradient}
          >
            <Text style={[
              styles.positionTabText, 
              { color: deployedPositionTab === 'open' ? colors.primary : theme.textSecondary },
              deployedPositionTab === 'open' && styles.activePositionTabText
            ]}>Open Position</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.positionTabButton, 
            deployedPositionTab === 'closed' && styles.activePositionTab,
            deployedPositionTab === 'closed' && { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#ffffff' }
          ]}
          onPress={() => setDeployedPositionTab('closed')}
        >
          <LinearGradient
            colors={deployedPositionTab === 'closed' ? [colors.primary + '20', colors.primary + '10'] : ['transparent', 'transparent']}
            style={styles.positionTabGradient}
          >
            <Text style={[
              styles.positionTabText, 
              { color: deployedPositionTab === 'closed' ? colors.primary : theme.textSecondary },
              deployedPositionTab === 'closed' && styles.activePositionTabText
            ]}>Closed Position</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Quick Load More for Open Positions (shows above the list) */}
      {deployedPositionTab === 'open' && openPositions.length > deployedCardsLimit && (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={() => setDeployedCardsLimit(prev => prev + 8)}
        >
          <LinearGradient
            colors={isDark ? ['rgba(99, 102, 241, 0.35)', 'rgba(139, 92, 246, 0.25)'] : ['rgba(99, 102, 241, 0.25)', 'rgba(139, 92, 246, 0.18)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loadMoreGradient}
          >
            <Text style={[styles.loadMoreText, { color: isDark ? '#a5b4fc' : colors.primary }]}>Load More </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      {/* Filters */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterButton, { 
            backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.08)',
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

        <TouchableOpacity 
          style={[styles.filterButton, { 
            backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.08)',
          }]}
          onPress={() => {
            // trigger a full refresh instead of showing Close dropdown
            setShowCloseDropdown(false);
            setShowSegmentDropdown(false);
            onRefresh();
          }}
          disabled={isRefreshing}
        >
          <View style={[styles.filterIconWrap, { backgroundColor: colors.success + '15' }]}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <ArrowClockwise size={14} color={colors.success} weight="bold" />
            )}
          </View>
          <Text style={[styles.filterValue, { color: theme.text }]} numberOfLines={1}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Segment Dropdown */}
      {showSegmentDropdown && (
        <View style={[
          styles.dropdownMenu, 
          { 
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)', 
            borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(37, 99, 235, 0.08)',
          }
        ]}>
          {SEGMENT_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.dropdownItem,
                { borderBottomColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(0,0,0,0.05)' },
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
        </View>
      )}

      {/* Close Dropdown */}
      {showCloseDropdown && (
        <View style={[
          styles.dropdownMenu, 
          styles.closeDropdown,
          { 
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)', 
            borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(239, 68, 68, 0.15)',
          }
        ]}>
          {CLOSE_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.dropdownItem,
                { borderBottomColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(0,0,0,0.05)' },
                selectedClose === option && { backgroundColor: colors.error + '15' },
                index === CLOSE_OPTIONS.length - 1 && { borderBottomWidth: 0 }
              ]}
              onPress={() => {
                setSelectedClose(option);
                setShowCloseDropdown(false);
              }}
            >
              <Text style={[styles.dropdownText, { color: selectedClose === option ? colors.error : theme.text }]}>
                {option}
              </Text>
              {selectedClose === option && (
                <View style={[styles.dropdownCheck, { backgroundColor: colors.error }]}>
                  <CheckCircle size={12} color="#fff" weight="bold" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Position Cards */}
      <View style={styles.positionList}>
        {positions.length === 0 ? (
          <View style={[styles.emptyStateContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Rocket size={48} color={theme.textSecondary} weight="duotone" />
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Deployed Strategies</Text>
            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>Deploy a strategy from My Strategies tab to start trading</Text>
          </View>
        ) : (
          <>
            {positions.slice(0, deployedCardsLimit).map((position) => (
              <TouchableOpacity 
            key={position.id}
            style={[styles.positionCard, { 
              backgroundColor: isDark ? 'rgba(10, 10, 26, 0.7)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : '#e2e8f0'
            }]}
            onPress={() => {
              router.push(`/open-trade-detail?id=${position.id}`);
            }}
            activeOpacity={0.7}
          >
            {/* Position Header with MTM and Badges */}
            <View style={styles.positionHeader}>
              <View style={styles.headerLeft}>
                {/* Buy/Sell Glassy Badge */}
                <LinearGradient
                  colors={position.type === 'Buy' 
                    ? ['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.06)'] 
                    : ['rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.15)']}
                  style={[styles.typeBadgeGlassy]}
                >
                  <Text style={[styles.typeBadgeText, { color: position.type === 'Buy' ? colors.success : colors.error }]}>
                    {position.type === 'Buy' ? 'B' : 'S'}
                  </Text>
                </LinearGradient>
                <View style={styles.symbolSection}>
                  <View style={styles.symbolRow}>
                    <Text style={[styles.positionSymbol, { color: theme.text }]}>{position.symbol}</Text>
                    {deployedPositionTab === 'open' && (
                      <View style={[styles.chevronIcon, {
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                      }]}>
                        <ArrowSquareOut size={12} color={colors.primary} weight="bold" />
                      </View>
                    )}
                    {deployedPositionTab === 'closed' && (
                      <TouchableOpacity
                        style={[styles.infoIconInline, {
                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                        }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/close-trade-detail?id=${position.id}`);
                        }}
                      >
                        <Info size={12} color={colors.primary} weight="bold" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.timeRow}>
                    <Clock size={10} color={theme.textSecondary} weight="bold" />
                    <Text style={[styles.positionTime, { color: theme.textSecondary }]}>{position.time}</Text>
                  </View>
                  {position.strategyName ? (
                    <Text style={[styles.positionStrategyName, { color: theme.textSecondary }]} numberOfLines={1}>
                      {position.strategyName}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.headerRight}>
                {/* MTM Value */}
                <Text style={[styles.mtmValue, { color: position.mtm >= 0 ? colors.success : colors.error }]}>
                  {position.mtm >= 0 ? '+' : ''}{Number(position.mtm ?? 0).toFixed(2)} USD
                </Text>
                {/* Status Badge */}
                <LinearGradient
                  colors={
                    deployedPositionTab === 'open' 
                      ? ['rgba(245, 158, 11, 0.25)', 'rgba(245, 158, 11, 0.15)']
                      : (['Completed', 'Closed'].includes(position.status as any))
                        ? ['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.06)']
                        : ['rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.15)']
                  }
                  style={styles.statusBadgeGlassy}
                >
                  <Text style={[styles.statusBadgeText, { 
                    color: deployedPositionTab === 'open' 
                      ? '#F59E0B' 
                      : (['Completed', 'Closed'].includes(position.status as any)) 
                        ? colors.success 
                        : colors.error 
                  }]}>
                    {position.status}
                  </Text>
                </LinearGradient>
              </View>
            </View>

            {/* Position Details - Single Row */}
            <View style={[styles.positionDetailsRow, { 
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
            }]}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Volume</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{Number(position.qty ?? 0).toFixed(4)}</Text>
              </View>
              <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)' }]} />
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Entry Price</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{Number(position.entryPrice ?? 0).toFixed(4)}</Text>
              </View>
              <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)' }]} />
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  {deployedPositionTab === 'open' ? 'Current Price' : 'Exit Price'}
                </Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {deployedPositionTab === 'open' 
                    ? ('ltp' in position ? Number(position.ltp ?? 0).toFixed(5) : '0.00000')
                    : ('exitPrice' in position ? Number(position.exitPrice ?? 0).toFixed(4) : '0.0000')
                  }
                </Text>
              </View>
            </View>

            {/* Action Buttons - Conditional for Open/Closed */}
            {deployedPositionTab === 'open' ? (
              <View style={styles.positionActions}>
                <TouchableOpacity 
                  style={[styles.tpSlButton, { 
                    backgroundColor: isDark ? 'rgba(10, 10, 26, 0.8)' : 'rgba(241, 245, 249, 0.9)',
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.8)',
                  }]}
                  onPress={() => {
                    setSelectedPosition(position);
                    setShowSLTPModal(true);
                  }}
                >
                  <Text style={[styles.tpSlText, { color: theme.text }]}>TP/SL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton}>
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.closeButtonGradient}
                  >
                    <Lightning size={14} color="#fff" weight="fill" />
                    <Text style={styles.closeButtonText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.positionActions} />
            )}
          </TouchableOpacity>
            ))}
            
            {/* Load More Button */}
            {positions.length > deployedCardsLimit && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setDeployedCardsLimit(prev => prev + 8)}
              >
                <LinearGradient
                  colors={isDark ? ['rgba(99, 102, 241, 0.35)', 'rgba(139, 92, 246, 0.25)', 'rgba(59, 130, 246, 0.2)'] : ['rgba(99, 102, 241, 0.25)', 'rgba(139, 92, 246, 0.18)', 'rgba(59, 130, 246, 0.12)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loadMoreGradient}
                >
                  <Text style={[styles.loadMoreText, { color: isDark ? '#a5b4fc' : colors.primary }]}>Load More</Text>
                  {/* <CaretDown size={16} color={isDark ? '#a5b4fc' : colors.primary} weight="bold" /> */}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

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
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)' }]}
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
                  backgroundColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
                }]}
                onPress={() => setShowSLTPModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, { 
                  backgroundColor: (!stopLoss && !takeProfit) ? (isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)') : colors.primary,
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
    </View>
  );

  const renderMyStrategiesTab = () => {
    // Choose stats based on active sub-tab - use dynamic functions
    const currentStats = myStrategiesSubTab === 'subscribed' 
      ? getSubscribedStats(subscribedStrategies) 
      : getMyStrategiesStats(ownStrategies);
    const filteredSubscribed = subscribedStrategies.filter(s =>
      s.name?.toLowerCase().includes(myStrategiesSearch.toLowerCase()) ||
      s.description?.toLowerCase().includes(myStrategiesSearch.toLowerCase())
    );
    const filteredOwn = ownStrategies.filter(s =>
      s.name?.toLowerCase().includes(myStrategiesSearch.toLowerCase()) ||
      s.description?.toLowerCase().includes(myStrategiesSearch.toLowerCase())
    );

    // Handler functions
    const handleViewDetails = (strategy: any) => {
      setSelectedStrategy(strategy);
      setShowStrategyDetailModal(true);
    };

    const handleToggleActive = async (strategy: any) => {
      const newActiveState = strategy.status !== 'Active';
      // Optimistic update
      setSubscribedStrategies(prev => prev.map(s => 
        s.id === strategy.id ? { ...s, status: newActiveState ? 'Active' : 'Inactive' } : s
      ));
      
      try {
        const response = await strategyService.updateSubscription(strategy.id, { isActive: newActiveState });
        if (response.success) {
          // Success - no alert needed for quick toggle
        } else {
          throw new Error(response.error || 'Failed to toggle active status');
        }
      } catch (error: any) {
        // Revert on error
        setSubscribedStrategies(prev => prev.map(s => 
          s.id === strategy.id ? { ...s, status: newActiveState ? 'Inactive' : 'Active' } : s
        ));
        Alert.alert('Error', error.message || 'Failed to toggle active status');
      }
    };

    const handlePauseResume = async (strategy: any) => {
      const newPausedState = !strategy.isPaused;
      // Optimistic update
      setSubscribedStrategies(prev => prev.map(s => 
        s.id === strategy.id ? { ...s, isPaused: newPausedState } : s
      ));
      
      try {
        const response = await strategyService.toggleSubscriptionPause(strategy.id);
        if (response.success) {
          setPauseMessage(newPausedState ? 'Strategy paused successfully' : 'Strategy resumed successfully');
          setTimeout(() => setPauseMessage(null), 3000);
        } else {
          throw new Error(response.error || 'Failed to toggle pause');
        }
      } catch (error: any) {
        // Revert on error
        setSubscribedStrategies(prev => prev.map(s => 
          s.id === strategy.id ? { ...s, isPaused: !newPausedState } : s
        ));
        Alert.alert('Error', error.message || 'Failed to toggle pause status');
      }
    };

    const handleUnsubscribe = (strategy: any) => {
      setSelectedStrategy(strategy);
      setShowUnsubscribeModal(true);
    };

    const confirmUnsubscribe = async () => {
      if (!selectedStrategy) return;
      try {
        // If it's a subscription, unsubscribe via API
        if (selectedStrategy.strategyId) {
          await strategyService.unsubscribe(selectedStrategy.strategyId);
        }
        const isOwn = ownStrategies.some((s: any) => s.id === selectedStrategy.id);
        if (isOwn) {
          setOwnStrategies((prev: any) => prev.filter((s: any) => s.id !== selectedStrategy.id));
        } else {
          setSubscribedStrategies((prev: any) => prev.filter((s: any) => s.id !== selectedStrategy.id));
        }
        setShowUnsubscribeModal(false);
        setSelectedStrategy(null);
      } catch (error) {
        console.error('Failed to unsubscribe:', error);
        Alert.alert('Error', 'Failed to unsubscribe. Please try again.');
      }
    };

    const handleSelectBrokers = (strategy: any) => {
      setSelectedStrategy(strategy);
      setShowBrokersModal(true);
    };

    const toggleBrokerSelection = (brokerId: string) => {
      setSelectedBrokers(prev => 
        prev.includes(brokerId) 
          ? prev.filter(id => id !== brokerId)
          : [...prev, brokerId]
      );
    };

    const handleSetTradeMode = (strategy: any) => {
      setSelectedStrategy(strategy);
      setSelectedTradeMode(null);
      setShowTradeModeModal(true);
    };

    const confirmTradeMode = (mode: 'paper' | 'live') => {
      setSelectedTradeMode(mode);
      // persist selection to subscribedStrategies list
      if (selectedStrategy) {
        setSubscribedStrategies(prev => prev.map(s => s.id === selectedStrategy.id ? { ...s, tradeMode: mode } : s));
        setSelectedStrategy((prev: any) => prev ? { ...prev, tradeMode: mode } : prev);
      }
      const modeLabel = mode === 'paper' ? 'Paper Trading' : 'Live Trading';
      Alert.alert('Success', `${modeLabel} mode set for ${selectedStrategy?.name}`);
      setShowTradeModeModal(false);
    };

    // --- My Own Strategies Handlers ---
    const handleOwnViewDetails = (strategy: any) => {
      setSelectedOwnStrategy(strategy);
      setShowOwnDetailModal(true);
    };

    const handleOwnToggleActive = async (strategy: any) => {
      const newActiveState = strategy.status !== 'Active';
      // Optimistic update
      setOwnStrategies((prev: any) => prev.map((s: any) => 
        s.id === strategy.id ? { ...s, status: newActiveState ? 'Active' : 'Inactive' } : s
      ));
      
      try {
        const response = await strategyService.updateStrategy(strategy.id, { isActive: newActiveState });
        if (response.success) {
          // Success - no alert needed for quick toggle
        } else {
          throw new Error(response.error || 'Failed to toggle active status');
        }
      } catch (error: any) {
        // Revert on error
        setOwnStrategies((prev: any) => prev.map((s: any) => 
          s.id === strategy.id ? { ...s, status: newActiveState ? 'Inactive' : 'Active' } : s
        ));
        Alert.alert('Error', error.message || 'Failed to toggle active status');
      }
    };

    const handleOwnPauseResume = async (strategy: any) => {
      const newPausedState = !strategy.stopped;
      // Optimistic update
      setOwnStrategies((prev: any) => prev.map((s: any) => 
        s.id === strategy.id ? { ...s, stopped: newPausedState } : s
      ));
      
      try {
        const response = await strategyService.updateStrategy(strategy.id, { isPaused: newPausedState });
        if (response.success) {
          setOwnPauseMessage(newPausedState ? 'Strategy paused successfully' : 'Strategy resumed successfully');
          setTimeout(() => setOwnPauseMessage(null), 3000);
        } else {
          throw new Error(response.error || 'Failed to toggle pause');
        }
      } catch (error: any) {
        // Revert on error
        setOwnStrategies((prev: any) => prev.map((s: any) => 
          s.id === strategy.id ? { ...s, stopped: !newPausedState } : s
        ));
        Alert.alert('Error', error.message || 'Failed to toggle pause status');
      }
    };

    const handleOwnEdit = (strategy: any) => {
      setSelectedOwnStrategy(strategy);
      // Populate edit form
      setEditName(strategy.name || '');
      setEditSegment(strategy.segment || 'Forex');
      setEditType(strategy.type || 'Intraday');
      setEditCapital(strategy.capital?.replace('₹', '') || '');
      setEditSymbol(strategy.symbol || '');
      setEditSymbolValue(strategy.symbolValue || '');
      setEditNumberValue('1');
      setEditDescription(strategy.description || '');
      setEditIsActive(strategy.status === 'Active');
      setEditIsPublic(strategy.visibility === 'Public');
      setShowOwnEditModal(true);
    };

    const handleSaveEdit = () => {
      if (selectedOwnStrategy) {
        setOwnStrategies((prev: any) => prev.map((s: any) => {
          if (s.id === selectedOwnStrategy.id) {
            return {
              ...s,
              name: editName,
              segment: editSegment,
              type: editType,
              capital: '₹' + editCapital,
              symbol: editSymbol,
              symbolValue: editSymbolValue,
              description: editDescription,
              status: editIsActive ? 'Active' : 'Paused',
              visibility: editIsPublic ? 'Public' : 'Private',
            };
          }
          return s;
        }));
        setShowOwnEditModal(false);
        setSelectedOwnStrategy(null);
      }
    };

    const handleOwnDelete = (strategy: any) => {
      setSelectedOwnStrategy(strategy);
      setShowOwnDeleteModal(true);
    };

    const confirmOwnDelete = async () => {
      if (selectedOwnStrategy) {
        try {
          await strategyService.deleteStrategy(selectedOwnStrategy.id);
          setOwnStrategies((prev: any) => prev.filter((s: any) => s.id !== selectedOwnStrategy.id));
          setShowOwnDeleteModal(false);
          setSelectedOwnStrategy(null);
        } catch (error) {
          console.error('Failed to delete strategy:', error);
          Alert.alert('Error', 'Failed to delete strategy. Please try again.');
        }
      }
    };

    const handleOwnSelectBrokers = (strategy: any) => {
      setSelectedOwnStrategy(strategy);
      setSelectedOwnBrokers([]);
      setShowOwnBrokersModal(true);
    };

    const toggleOwnBrokerSelection = (brokerId: string) => {
      setSelectedOwnBrokers(prev => 
        prev.includes(brokerId) 
          ? prev.filter(id => id !== brokerId)
          : [...prev, brokerId]
      );
    };

    const selectAllBrokers = () => {
      if (selectedOwnBrokers.length === BROKERS_DATA.length) {
        setSelectedOwnBrokers([]);
      } else {
        setSelectedOwnBrokers(BROKERS_DATA.map(b => b.id));
      }
    };

    const handleOwnSetTradeMode = (strategy: any) => {
      setSelectedOwnStrategy(strategy);
      setShowOwnTradeModeModal(true);
    };

    const confirmOwnTradeMode = (mode: 'paper' | 'live') => {
      if (selectedOwnStrategy) {
        setOwnStrategies((prev: any) => prev.map((s: any) => s.id === selectedOwnStrategy.id ? { ...s, tradeMode: mode } : s));
        setSelectedOwnStrategy((prev: any) => prev ? { ...prev, tradeMode: mode } : prev);
      }
      const modeLabel = mode === 'paper' ? 'Paper Trading' : 'Live Trading';
      Alert.alert('Success', `${modeLabel} mode set for ${selectedOwnStrategy?.name}`);
      setShowOwnTradeModeModal(false);
    };

    const handleOwnWebhook = (strategy: any) => {
      setSelectedOwnStrategy(strategy);
      setShowWebhookModal(true);
    };

    // Handle Close All button click
    const handleCloseAllClick = () => {
      setShowCloseAllModal(true);
    };

    // Handle Close All confirmation
    const handleCloseAllConfirm = () => {
      const newPausedState = !allStrategiesPaused;
      
      // Update subscribed strategies - toggle isPaused field
      setSubscribedStrategies((prev: any) => prev.map((s: any) => ({
        ...s,
        isPaused: newPausedState,
      })));
      
      // Update own strategies - toggle stopped field
      setOwnStrategies((prev: any) => prev.map((s: any) => ({
        ...s,
        stopped: newPausedState,
      })));
      
      setAllStrategiesPaused(newPausedState);
      setShowCloseAllModal(false);
      
      const message = newPausedState ? 'All strategies paused successfully' : 'All strategies resumed successfully';
      if (myStrategiesSubTab === 'subscribed') {
        setPauseMessage(message);
        setTimeout(() => setPauseMessage(null), 3000);
      } else {
        setOwnPauseMessage(message);
        setTimeout(() => setOwnPauseMessage(null), 3000);
      }
    };

    return (
    <View style={styles.myStrategiesContainer}>
      {/* Stats Cards Row */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.myStrategiesStatsRow}
      >
        {currentStats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <View 
              key={index}
              style={[styles.statCardWide, {
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : stat.bgColor,
                borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.5)',
              }]}
            >
              <View style={[styles.statCardIcon, { backgroundColor: stat.color + '20' }]}>
                <IconComponent size={18} color={stat.color} weight="fill" />
              </View>
              <View style={styles.statCardContent}>
                <Text style={[styles.statCardLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.statCardValue, { color: theme.text }]}>{stat.value}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Sub Tabs */}
      <View style={styles.subTabRow}>
        <TouchableOpacity 
          style={[styles.subTabItem, myStrategiesSubTab === 'subscribed' && styles.subTabItemActive]}
          onPress={() => setMyStrategiesSubTab('subscribed')}
        >
          <Text style={[styles.subTabTitle, myStrategiesSubTab === 'subscribed' && styles.subTabTitleActive, { color: myStrategiesSubTab === 'subscribed' ? colors.primary : theme.textSecondary }]}>Subscribed Strategies</Text>
          {/* <Text style={[styles.subTabDesc, { color: theme.textSecondary }]}>Strategies You Follow</Text> */}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.subTabItem, myStrategiesSubTab === 'myStrategies' && styles.subTabItemActive]}
          onPress={() => setMyStrategiesSubTab('myStrategies')}
        >
          <Text style={[styles.subTabTitle, myStrategiesSubTab === 'myStrategies' && styles.subTabTitleActive, { color: myStrategiesSubTab === 'myStrategies' ? colors.primary : theme.textSecondary }]}>My Strategies</Text>
          {/* <Text style={[styles.subTabDesc, { color: theme.textSecondary }]}>Strategies Created By The User</Text> */}
        </TouchableOpacity>
      </View>

      {/* Search Bar + Action Buttons */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
          <MagnifyingGlass size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search strategies..."
            placeholderTextColor={theme.textSecondary}
            value={myStrategiesSearch}
            onChangeText={setMyStrategiesSearch}
          />
        </View>
        <TouchableOpacity 
          style={[styles.pauseIconBtn, { 
            borderColor: allStrategiesPaused ? colors.success : colors.error, 
            backgroundColor: allStrategiesPaused ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' 
          }]}
          onPress={handleCloseAllClick}
          onLongPress={() => Alert.alert(allStrategiesPaused ? 'Activate All' : 'Pause All', allStrategiesPaused ? 'Tap to activate all strategies' : 'Tap to pause all strategies')}
        >
          {allStrategiesPaused ? (
            <Play size={18} color={colors.success} weight="fill" />
          ) : (
            <Pause size={18} color={colors.error} weight="fill" />
          )}
        </TouchableOpacity>
        {myStrategiesSubTab === 'myStrategies' && (
          <TouchableOpacity
            style={[styles.newStrategyBtn]}
            onPress={() => router.push({ pathname: '/explore', params: { tab: 'create' } })}
          >
            <Plus size={16} color="#fff" weight="bold" />
          </TouchableOpacity>
        )}
      </View>

      {/* Strategy List Boxes */}
      <View style={styles.strategyListContainer}>
        {myStrategiesSubTab === 'subscribed' ? (
          filteredSubscribed.length === 0 ? (
            <View style={[styles.emptyStateContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Lightning size={48} color={theme.textSecondary} weight="duotone" />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Subscribed Strategies</Text>
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>Subscribe to strategies from the Marketplace to start automated trading</Text>
              <TouchableOpacity
                style={[styles.emptyStateBtn, { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab(2)}
              >
                <Text style={styles.emptyStateBtnText}>Browse Marketplace</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
            {filteredSubscribed.slice(0, subscribedVisibleCount).map((strategy, index) => (
            <View
              key={strategy.id}
              style={[styles.strategyListItem, {
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#ffffff',
                borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
              }]}
            >
              <View style={styles.strategyListHeader}>
                <View style={styles.strategyListInfo}>
                  <Text style={[styles.strategyListName, { color: theme.text }]} numberOfLines={1}>{strategy.name}</Text>
                  <Text style={[styles.strategyListAuthor, { color: theme.textSecondary }]} numberOfLines={1}>{strategy.description}</Text>
                </View>
                <View style={styles.strategyStatusRow}>
                  <TouchableOpacity 
                    onPress={() => handleToggleActive(strategy)}
                    style={[styles.statusToggle, { backgroundColor: strategy.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(100,100,100,0.15)' }]}
                  >
                    <View style={[styles.statusToggleThumb, { 
                      backgroundColor: strategy.status === 'Active' ? colors.success : '#888',
                      transform: [{ translateX: strategy.status === 'Active' ? 16 : 0 }]
                    }]} />
                  </TouchableOpacity>
                  <Text style={[styles.statusToggleText, { color: strategy.status === 'Active' ? colors.success : '#F59E0B' }]}>
                    {strategy.status}
                  </Text>
                </View>
              </View>

              <View style={styles.strategyListDetails}>
                <Text style={[styles.strategyDetailText, { color: theme.textSecondary }]}>Lots: <Text style={{ color: theme.text, fontWeight: '600' }}>{strategy.lots}</Text></Text>
                <Text style={[styles.strategyDetailText, { color: theme.textSecondary }]}>Expiry: <Text style={{ color: theme.text, fontWeight: '600' }}>{strategy.expiry}</Text></Text>
                <Text style={[styles.strategyDetailText, { color: theme.textSecondary }]}>Subscribed At: <Text style={{ color: theme.text, fontWeight: '600' }}>{strategy.subscribedAt}</Text></Text>
              </View>

              <View style={styles.strategyListActions}>
                <TouchableOpacity 
                  style={[styles.strategyActionBtn, { backgroundColor: colors.primary + '12' }]}
                  onPress={() => handleViewDetails(strategy)}
                >
                  <Eye size={14} color={colors.primary} weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.strategyActionBtn, { backgroundColor: strategy.isPaused ? colors.success : colors.primary }]}
                  onPress={() => handlePauseResume(strategy)}
                >
                  {strategy.isPaused ? (
                    <Play size={14} color="#fff" weight="bold" />
                  ) : (
                    <Pause size={14} color="#fff" weight="bold" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.strategyActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleUnsubscribe(strategy)}
                >
                  <Trash size={14} color="#fff" weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.strategyActionBtn, { backgroundColor: '#06b6d415' }]}
                  onPress={() => handleSelectBrokers(strategy)}
                >
                  <Bank size={14} color="#06b6d4" weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.strategyActionBtn,
                    { backgroundColor: strategy.tradeMode === 'paper' ? colors.primary + '12' : colors.success + '12' },
                  ]}
                  onPress={() => handleSetTradeMode(strategy)}
                >
                  {strategy.tradeMode === 'paper' ? (
                    <FileText size={14} color={colors.primary} weight="bold" />
                  ) : (
                    <ChartLineUp size={14} color={colors.success} weight="bold" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
            {/* Load More Button for Subscribed */}
            {filteredSubscribed.length > subscribedVisibleCount && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setSubscribedVisibleCount(prev => prev + 8)}
              >
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
            </>
          )
        ) : (
          filteredOwn.length === 0 ? (
            <View style={[styles.emptyStateContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Lightning size={48} color={theme.textSecondary} weight="duotone" />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Strategies Available</Text>
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>Create your first strategy to start automated trading</Text>
              <TouchableOpacity
                style={[styles.emptyStateBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <Text style={styles.emptyStateBtnText}>Create Strategy</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
            {filteredOwn.slice(0, myStrategiesVisibleCount).map((strategy, index) => (
            <View
              key={strategy.id}
              style={[styles.strategyListItem, {
                backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#ffffff',
                borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)',
              }]}
            >
              <View style={styles.strategyListHeader}>
                <View style={styles.strategyListInfo}>
                  <Text style={[styles.strategyListName, { color: theme.text }]} numberOfLines={1}>{strategy.name}</Text>
                  <Text style={[styles.strategyListAuthor, { color: theme.textSecondary }]} numberOfLines={1}>{strategy.description}</Text>
                </View>
                <View style={styles.strategyBadgeRow}>
                  <LinearGradient
                    colors={strategy.visibility === 'Public' ? ['rgba(6,182,212,0.25)','rgba(6,182,212,0.15)'] : ['rgba(139,92,246,0.25)','rgba(139,92,246,0.15)']}
                    style={styles.strategyStatusBadge}
                  >
                    <Text style={[styles.strategyStatusText, { color: strategy.visibility === 'Public' ? '#06b6d4' : '#8B5CF6' }]}>{strategy.visibility}</Text>
                  </LinearGradient>
                  <View style={styles.strategyStatusRow}>
                    <TouchableOpacity 
                      onPress={() => handleOwnToggleActive(strategy)}
                      style={[styles.statusToggle, { backgroundColor: strategy.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(100,100,100,0.15)' }]}
                    >
                      <View style={[styles.statusToggleThumb, { 
                        backgroundColor: strategy.status === 'Active' ? colors.success : '#888',
                        transform: [{ translateX: strategy.status === 'Active' ? 16 : 0 }]
                      }]} />
                    </TouchableOpacity>
                    <Text style={[styles.statusToggleText, { color: strategy.status === 'Active' ? colors.success : '#F59E0B' }]}>
                      {strategy.status}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.strategyListDetails}>
                <Text style={[styles.strategyDetailText, { color: theme.textSecondary }]}>Lots: <Text style={{ color: theme.text, fontWeight: '600' }}>{strategy.lots}</Text></Text>
                <Text style={[styles.strategyDetailText, { color: theme.textSecondary }]}>Expiry: <Text style={{ color: theme.text, fontWeight: '600' }}>{strategy.expiry}</Text></Text>
                <Text style={[styles.strategyDetailText, { color: theme.textSecondary }]}>Created At: <Text style={{ color: theme.text, fontWeight: '600' }}>{strategy.createdAt}</Text></Text>
              </View>

              <View style={styles.strategyListActions}>
                <TouchableOpacity style={[styles.strategyActionBtn, { backgroundColor: colors.primary + '12' }]} onPress={() => handleOwnViewDetails(strategy)}>
                  <Eye size={14} color={colors.primary} weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.strategyActionBtn, { backgroundColor: colors.primary + '12' }]} onPress={() => handleOwnEdit(strategy)}>
                  <PencilSimple size={14} color={colors.primary} weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.strategyActionBtn, { backgroundColor: strategy.stopped ? colors.success : colors.primary }]}
                  onPress={() => handleOwnPauseResume(strategy)}
                >
                  {strategy.stopped ? (
                    <Play size={14} color="#fff" weight="bold" />
                  ) : (
                    <Pause size={14} color="#fff" weight="bold" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.strategyActionBtn, { backgroundColor: colors.primary }]} onPress={() => handleOwnDelete(strategy)}>
                  <Trash size={14} color="#fff" weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.strategyActionBtn, { backgroundColor: strategy.tradeMode === 'paper' ? colors.primary + '12' : colors.success + '12' }]}
                  onPress={() => handleOwnSetTradeMode(strategy)}
                >
                  {strategy.tradeMode === 'paper' ? (
                    <FileText size={14} color={colors.primary} weight="bold" />
                  ) : (
                    <ChartLineUp size={14} color={colors.success} weight="bold" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.strategyActionBtn, { backgroundColor: '#06b6d415' }]} onPress={() => handleOwnSelectBrokers(strategy)}>
                  <Bank size={14} color="#06b6d4" weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.strategyActionBtn, { backgroundColor: 'rgba(139,92,246,0.12)' }]} onPress={() => handleOwnWebhook(strategy)}>
                  <Link size={14} color="#7C3AED" weight="bold" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
            {/* Load More Button for My Strategies */}
            {filteredOwn.length > myStrategiesVisibleCount && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setMyStrategiesVisibleCount(prev => prev + 8)}
              >
                <LinearGradient
                  colors={isDark ? ['rgba(99, 102, 241, 0.35)', 'rgba(139, 92, 246, 0.25)', 'rgba(59, 130, 246, 0.2)'] : ['rgba(99, 102, 241, 0.25)', 'rgba(139, 92, 246, 0.18)', 'rgba(59, 130, 246, 0.12)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loadMoreGradient}
                >
                  <Text style={[styles.loadMoreText, { color: isDark ? '#a5b4fc' : colors.primary }]}>Load More </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            </>
          )
        )}
      </View>

      {/* Pause/Resume Success Message */}
      {pauseMessage && (
        <View style={[styles.pauseMessageContainer, { backgroundColor: '#10b981' }]}>
          <CheckCircle size={18} color="#fff" weight="bold" />
          <Text style={styles.pauseMessageText}>{pauseMessage}</Text>
        </View>
      )}

      {/* Own Strategy Pause/Resume Success Message */}
      {ownPauseMessage && (
        <View style={[styles.pauseMessageContainer, { backgroundColor: '#10b981' }]}>
          <CheckCircle size={18} color="#fff" weight="bold" />
          <Text style={styles.pauseMessageText}>{ownPauseMessage}</Text>
        </View>
      )}

      {/* Strategy Detail Modal */}
      <Modal
        visible={showStrategyDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStrategyDetailModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.strategyDetailModalContent, { backgroundColor: theme.surface }]}>
            {/* Header */}
            <View style={styles.strategyDetailHeader}>
              <View style={styles.strategyDetailTitleRow}>
                <View style={[styles.strategyDetailIcon, { backgroundColor: colors.primary }]}>
                  <Text style={styles.strategyDetailIconText}>{selectedStrategy?.name?.charAt(0).toLowerCase() || 'f'}</Text>
                </View>
                <View style={styles.strategyDetailTitleInfo}>
                  <Text style={[styles.strategyDetailTitle, { color: theme.text }]}>{selectedStrategy?.name}</Text>
                  <Text style={[styles.strategyDetailSubtitle, { color: theme.textSecondary }]}>Strategy Details</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowStrategyDetailModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Status Badges */}
            <View style={styles.strategyDetailBadges}>
              <View style={[styles.detailBadgeOutline, { borderColor: selectedStrategy?.status === 'Active' ? colors.success : '#F59E0B' }]}>
                <Text style={[styles.detailBadgeText, { color: selectedStrategy?.status === 'Active' ? colors.success : '#F59E0B' }]}>{selectedStrategy?.status}</Text>
              </View>
              {selectedStrategy?.isPublic && (
                <View style={[styles.detailBadgeOutline, { borderColor: '#3b82f6' }]}>
                  <Globe size={12} color="#3b82f6" weight="fill" />
                  <Text style={[styles.detailBadgeText, { color: '#3b82f6' }]}>Public</Text>
                </View>
              )}
              {selectedStrategy?.isStopped && (
                <View style={[styles.detailBadgeOutline, { borderColor: colors.error }]}>
                  <Pause size={12} color={colors.error} weight="fill" />
                  <Text style={[styles.detailBadgeText, { color: colors.error }]}>Stopped</Text>
                </View>
              )}
            </View>

            <View style={[styles.detailDividerLine, { backgroundColor: theme.border }]} />

            <ScrollView style={styles.strategyDetailScroll} showsVerticalScrollIndicator={false}>
              {/* Basic Information */}
              <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Basic Information</Text>
              
              <View style={styles.detailInfoRow}>
                <Rocket size={16} color={theme.textSecondary} />
                <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Segment</Text>
                <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.segment || 'N/A'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Rocket size={16} color={theme.textSecondary} />
                <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Type</Text>
                <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.type || 'N/A'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <CurrencyDollar size={16} color={theme.textSecondary} />
                <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Capital</Text>
                <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.capital || 'N/A'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <TrendUp size={16} color={theme.textSecondary} />
                <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Symbol</Text>
                <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.symbol || 'N/A'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <TrendUp size={16} color={theme.textSecondary} />
                <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Symbol Value</Text>
                <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.symbolValue || 'N/A'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <CalendarBlank size={16} color={theme.textSecondary} />
                <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Created At</Text>
                <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.createdAt || 'N/A'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <CalendarBlank size={16} color={theme.textSecondary} />
                <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Last Updated</Text>
                <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.lastUpdated || 'N/A'}</Text>
              </View>

              {/* Market & Risk */}
              <Text style={[styles.detailSectionTitle, { color: theme.text, marginTop: spacing.lg }]}>Market & Risk</Text>
              
              <View style={styles.detailGridContainer}>
                <View style={styles.detailGridCol}>
                  <View style={styles.detailInfoRow}>
                    <Rocket size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Segment</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.marketSegment || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Rocket size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Instrument</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.instrument || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <TrendUp size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Symbol</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.symbolDetail || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Rocket size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Market Type</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.marketType || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Rocket size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Order Type</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.orderType || 'N/A'}</Text>
                  </View>
                </View>
                <View style={styles.detailGridCol}>
                  <View style={styles.detailInfoRow}>
                    <CurrencyDollar size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Quantity</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.quantity || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <CurrencyDollar size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>SL</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.sl || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <CurrencyDollar size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>TP</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.tp || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <CurrencyDollar size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Stop Loss %</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.stopLossPercent || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <CurrencyDollar size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Target %</Text>
                    <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedStrategy?.targetPercent || 'N/A'}</Text>
                  </View>
                </View>
              </View>

              {/* Description */}
              <View style={[styles.detailDividerLine, { backgroundColor: theme.border, marginVertical: spacing.md }]} />
              <View style={styles.descriptionHeader}>
                <FileText size={18} color={theme.text} />
                <Text style={[styles.detailSectionTitle, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>Description</Text>
              </View>
              <Text style={[styles.descriptionText, { color: theme.text }]}>{selectedStrategy?.description || 'No description available'}</Text>
            </ScrollView>

            <View style={[styles.detailDividerLine, { backgroundColor: theme.border }]} />

            {/* Close Button */}
            <TouchableOpacity 
              style={[styles.closeDetailBtnLarge, { backgroundColor: colors.primary }]}
              onPress={() => setShowStrategyDetailModal(false)}
            >
              <Text style={styles.closeDetailBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Unsubscribe Confirmation Modal */}
      <Modal
        visible={showUnsubscribeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnsubscribeModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.confirmModalContent, { backgroundColor: theme.surface }]}>
            {(() => {
              const isOwn = selectedStrategy ? ownStrategies.some((s: any) => s.id === selectedStrategy.id) : false;
              return (
                <>
                  <Text style={[styles.confirmModalTitle, { color: theme.text }]}>{isOwn ? 'Confirm Delete' : 'Confirm Unsubscribe'}</Text>
                  <Text style={[styles.confirmModalText, { color: theme.textSecondary }]}> 
                    {isOwn
                      ? 'Are you sure you want to delete this strategy? This action cannot be undone.'
                      : 'Are you sure you want to unsubscribe from this strategy? This action cannot be undone.'
                    }
                  </Text>
                  <View style={styles.confirmModalActions}>
                    <TouchableOpacity 
                      style={[styles.confirmCancelBtn, { borderColor: theme.border }]}
                      onPress={() => setShowUnsubscribeModal(false)}
                    >
                      <Text style={[styles.confirmCancelText, { color: theme.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.confirmUnsubBtn, { backgroundColor: isOwn ? '#ff7f7f' : '#ff7f7f' }]}
                      onPress={confirmUnsubscribe}
                    >
                      <Text style={styles.confirmUnsubText}>{isOwn ? 'Delete' : 'Unsubscribe'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Select Brokers Modal */}
      <Modal
        visible={showBrokersModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBrokersModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.brokersModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.brokersModalHeader}>
              <View style={styles.brokersModalTitleRow}>
                <Bank size={24} color={colors.primary} weight="fill" />
                <Text style={[styles.brokersModalTitle, { color: theme.text }]}>Select Brokers</Text>
              </View>
            </View>
            <Text style={[styles.brokersSubtitle, { color: theme.textSecondary }]}>For strategy: {selectedStrategy?.name}</Text>
            
            <View style={[styles.brokersDivider, { backgroundColor: theme.border }]} />
            
            <Text style={[styles.brokersDescription, { color: theme.textSecondary }]}>
              Select which brokers should execute trades for this strategy. Trades will be sent to all selected brokers.
            </Text>

            <ScrollView style={styles.brokersList}>
              {BROKERS_DATA.map((broker) => {
                const isSelected = selectedBrokers.includes(broker.id);
                return (
                  <TouchableOpacity
                    key={broker.id}
                    style={[
                      styles.brokerItem,
                      { 
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        borderColor: isSelected ? colors.primary : theme.border,
                      }
                    ]}
                    onPress={() => toggleBrokerSelection(broker.id)}
                  >
                    <View style={[
                      styles.brokerCheckbox,
                      { 
                        borderColor: isSelected ? colors.primary : theme.border,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                      }
                    ]}>
                      {isSelected && <CheckCircle size={16} color="#fff" weight="fill" />}
                    </View>
                    <View style={styles.brokerInfo}>
                      <View style={styles.brokerNameRow}>
                        <Text style={[styles.brokerName, { color: theme.text }]}>{broker.name}</Text>
                        <View style={[styles.brokerTypeBadge, { backgroundColor: theme.border }]}>
                          <Text style={[styles.brokerTypeText, { color: theme.text }]}>{broker.type}</Text>
                        </View>
                        {broker.isConnected && <CheckCircle size={18} color="#10b981" weight="fill" />}
                      </View>
                      <Text style={[styles.brokerDesc, { color: theme.textSecondary }]}>{broker.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.brokersDivider, { backgroundColor: theme.border }]} />

            <View style={styles.brokersModalActions}>
              <TouchableOpacity 
                style={styles.brokersCancelBtn}
                onPress={() => setShowBrokersModal(false)}
              >
                <Text style={[styles.brokersCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.brokersSaveBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Alert.alert('Success', 'Broker selection saved successfully');
                  setShowBrokersModal(false);
                }}
              >
                <Text style={styles.brokersSaveText}>Save Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Set Trade Mode Modal */}
      <Modal
        visible={showTradeModeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTradeModeModal(false)}
      >
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.tradeModeModalContent, { backgroundColor: theme.surface }]}> 
            <View style={styles.tradeModeHeader}>
              <Text style={[styles.tradeModeTitle, { color: theme.text }]}>Set Trade Mode</Text>
              <TouchableOpacity onPress={() => setShowTradeModeModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.tradeModeSubtitle, { color: theme.text }]}>Subscribed Strategy: {selectedStrategy?.name}</Text>
            <Text style={[styles.tradeModeDesc, { color: theme.textSecondary }]}>Choose how you want to execute trades for this strategy</Text>

            {/* Paper Trading Option */}
            <TouchableOpacity 
              style={[
                styles.tradeModeOption,
                { 
                  borderColor: selectedTradeMode === 'paper' ? colors.primary : theme.border,
                  backgroundColor: selectedTradeMode === 'paper' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                }
              ]}
              onPress={() => setSelectedTradeMode('paper')}
            >
              <FileText size={22} color={colors.primary} weight="fill" />
              <Text style={[styles.tradeModeOptionTitle, { color: colors.primary }]}>Paper Trading</Text>
              <Text style={[styles.tradeModeOptionDesc, { color: theme.textSecondary }]}>
                Practice trading with virtual money. No real money involved. Perfect for testing strategies.
              </Text>
            </TouchableOpacity>

            {/* Live Trading Option */}
            <TouchableOpacity 
              style={[
                styles.tradeModeOption,
                { 
                  borderColor: selectedTradeMode === 'live' ? '#10b981' : theme.border,
                  backgroundColor: selectedTradeMode === 'live' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                }
              ]}
              onPress={() => setSelectedTradeMode('live')}
            >
              <TrendUp size={22} color="#10b981" weight="fill" />
              <Text style={[styles.tradeModeOptionTitle, { color: '#10b981' }]}>Live Trading</Text>
              <Text style={[styles.tradeModeOptionDesc, { color: theme.textSecondary }]}>
                Execute real trades with actual money. Use this when you're confident about the strategy.
              </Text>
            </TouchableOpacity>

            <View style={styles.tradeModeActions}>
              <TouchableOpacity 
                style={styles.tradeModeCancelBtn}
                onPress={() => setShowTradeModeModal(false)}
              >
                <Text style={[styles.tradeModeCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              {selectedTradeMode === 'paper' && (
                <TouchableOpacity 
                  style={[styles.tradeModePaperBtn, { borderColor: colors.primary }]}
                  onPress={() => confirmTradeMode('paper')}
                >
                  <FileText size={16} color={colors.primary} weight="fill" />
                  <Text style={[styles.tradeModePaperText, { color: colors.primary }]}>Set Paper Trade</Text>
                </TouchableOpacity>
              )}
              {selectedTradeMode === 'live' && (
                <TouchableOpacity 
                  style={[styles.tradeModeLiveBtn, { backgroundColor: '#10b981' }]}
                  onPress={() => confirmTradeMode('live')}
                >
                  <TrendUp size={16} color="#fff" weight="fill" />
                  <Text style={styles.tradeModeLiveText}>Set Live Trade</Text>
                </TouchableOpacity>
              )}
              {!selectedTradeMode && (
                <View style={[styles.tradeModeDisabledBtn, { backgroundColor: theme.border }]}>
                  <Text style={[styles.tradeModeDisabledText, { color: theme.textSecondary }]}>Select a mode</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* My Own Strategy Detail Modal */}
      <Modal
        visible={showOwnDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOwnDetailModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.strategyDetailModalContent, { backgroundColor: theme.surface }]}>
            {/* Header */}
            <View style={styles.strategyDetailHeader}>
              <View style={styles.strategyDetailTitleRow}>
                <View style={[styles.strategyDetailIcon, { backgroundColor: colors.primary }]}>
                  <Text style={styles.strategyDetailIconText}>{selectedOwnStrategy?.name?.charAt(0).toLowerCase() || 't'}</Text>
                </View>
                <View style={styles.strategyDetailTitleInfo}>
                  <Text style={[styles.strategyDetailTitle, { color: theme.text }]}>{selectedOwnStrategy?.name}</Text>
                  <Text style={[styles.strategyDetailSubtitle, { color: theme.textSecondary }]}>Strategy Details</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowOwnDetailModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Status Badges */}
            <View style={styles.strategyDetailBadges}>
              <View style={[styles.detailBadgeOutline, { borderColor: selectedOwnStrategy?.status === 'Active' ? colors.success : '#F59E0B' }]}>
                <Text style={[styles.detailBadgeText, { color: selectedOwnStrategy?.status === 'Active' ? colors.success : '#F59E0B' }]}>{selectedOwnStrategy?.status}</Text>
              </View>
              <View style={[styles.detailBadgeFilled, { backgroundColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)' }]}>
                <Lock size={12} color={theme.text} />
                <Text style={[styles.detailBadgeText, { color: theme.text }]}>{selectedOwnStrategy?.visibility}</Text>
              </View>
              {selectedOwnStrategy?.stopped && (
                <View style={[styles.detailBadgeFilled, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Stop size={12} color={colors.error} weight="fill" />
                  <Text style={[styles.detailBadgeText, { color: colors.error }]}>Stopped</Text>
                </View>
              )}
            </View>

            <ScrollView style={styles.strategyDetailScroll} showsVerticalScrollIndicator={false}>
              {/* Basic Information */}
              <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Basic Information</Text>
              <View style={[styles.detailInfoGrid, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(248, 250, 252, 0.8)' }]}>
                <View style={styles.detailInfoRow}>
                  <SlidersHorizontal size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Segment</Text>
                  <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedOwnStrategy?.segment || 'N/A'}</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Lightning size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Type</Text>
                  <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedOwnStrategy?.type || 'N/A'}</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <CurrencyDollar size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Capital</Text>
                  <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedOwnStrategy?.capital || 'N/A'}</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <TrendUp size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Symbol</Text>
                  <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedOwnStrategy?.symbol || 'N/A'}</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <TrendUp size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Symbol Value</Text>
                  <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedOwnStrategy?.symbolValue || 'N/A'}</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <CalendarBlank size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Created At</Text>
                  <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedOwnStrategy?.createdAt || 'N/A'}</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Clock size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailInfoLabel, { color: theme.textSecondary }]}>Last Updated</Text>
                  <Text style={[styles.detailInfoValue, { color: theme.text }]}>{selectedOwnStrategy?.lastUpdated || 'N/A'}</Text>
                </View>
              </View>

              {/* Description */}
              <View style={[styles.detailDividerLine, { backgroundColor: theme.border, marginVertical: spacing.md }]} />
              <View style={styles.descriptionHeader}>
                <FileText size={18} color={theme.text} />
                <Text style={[styles.detailSectionTitle, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>Description</Text>
              </View>
              <Text style={[styles.descriptionText, { color: theme.text }]}>{selectedOwnStrategy?.description || 'No description available'}</Text>

              {/* Webhook Configuration */}
              <View style={[styles.detailDividerLine, { backgroundColor: theme.border, marginVertical: spacing.md }]} />
              <View style={styles.descriptionHeader}>
                <Link size={18} color="#eab308" />
                <Text style={[styles.detailSectionTitle, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>Webhook Configuration</Text>
              </View>
              <View style={[styles.webhookConfigBox, { borderColor: '#10b98150', backgroundColor: 'rgba(16, 185, 129, 0.05)' }]}>
                <Text style={[styles.webhookLabel, { color: theme.textSecondary }]}>Webhook URL:</Text>
                <Text style={[styles.webhookValue, { color: theme.text }]}>{selectedOwnStrategy?.webhookUrl || 'N/A'}</Text>
                
                <Text style={[styles.webhookLabel, { color: '#10b981', marginTop: spacing.sm }]}>TradingView Alert Message Format:</Text>
                <View style={[styles.webhookCodeBox, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.8)' : '#f8fafc', borderColor: '#10b98130' }]}>
                  <Text style={[styles.webhookCode, { color: theme.text }]}>
                    {`{ "secret": "${selectedOwnStrategy?.webhookSecret || 'N/A'}", "signal": "{{strategy.position_size}}" }`}
                  </Text>
                </View>
                <View style={styles.webhookNote}>
                  <CheckCircle size={14} color="#10b981" weight="fill" />
                  <Text style={[styles.webhookNoteText, { color: '#10b981' }]}>
                    Copy this exact message to TradingView alert. All 0 subscriber(s) will receive trades automatically!
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={[styles.detailDividerLine, { backgroundColor: theme.border }]} />
            <View style={styles.ownDetailFooter}>
              <TouchableOpacity 
                style={[styles.stopStrategyBtn, { borderColor: colors.error }]}
                onPress={() => {
                  handleOwnPauseResume(selectedOwnStrategy);
                  setShowOwnDetailModal(false);
                }}
              >
                <Text style={[styles.stopStrategyText, { color: colors.error }]}> 
                  {selectedOwnStrategy?.stopped ? 'Resume Strategy' : 'Pause Strategy'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editStrategyBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowOwnDetailModal(false);
                  handleOwnEdit(selectedOwnStrategy);
                }}
              >
                <Text style={styles.editStrategyText}>Edit Strategy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.closeSmallBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowOwnDetailModal(false)}
              >
                <Text style={styles.closeDetailBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Strategy Modal */}
      <Modal
        visible={showOwnEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOwnEditModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.editModalHeader}>
              <Text style={[styles.editModalTitle, { color: theme.text }]}>Edit Strategy</Text>
              <TouchableOpacity onPress={() => setShowOwnEditModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalScroll} showsVerticalScrollIndicator={false}>
              {/* Row 1: Name, Segment, Type, Capital, Symbol */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldLarge}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Strategy Name *</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Strategy Name"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Segment</Text>
                  <TouchableOpacity 
                    style={[styles.editDropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowEditSegmentDropdown(!showEditSegmentDropdown)}
                  >
                    <Text style={{ color: theme.text }}>{editSegment}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {showEditSegmentDropdown && (
                    <View style={[styles.editDropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      {['Crypto', 'Forex', 'Indian (Equity/F&O)'].map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.dropdownItem, { backgroundColor: editSegment === option ? (isDark ? 'rgba(10, 10, 26, 0.8)' : '#f8fafc') : 'transparent' }]}
                          onPress={() => {
                            setEditSegment(option);
                            setShowEditSegmentDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Strategy Type</Text>
                  <TouchableOpacity 
                    style={[styles.editDropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowEditTypeDropdown(!showEditTypeDropdown)}
                  >
                    <Text style={{ color: theme.text }}>{editType}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {showEditTypeDropdown && (
                    <View style={[styles.editDropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      {['Intraday', 'Positional', 'BTST', 'Swing'].map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.dropdownItem, { backgroundColor: editType === option ? (isDark ? 'rgba(10, 10, 26, 0.8)' : '#f8fafc') : 'transparent' }]}
                          onPress={() => {
                            setEditType(option);
                            setShowEditTypeDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.editFormRow}>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Capital *</Text>
                  <View style={[styles.editInputWithPrefix, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}>
                    <Text style={{ color: theme.textSecondary }}>₹</Text>
                    <TextInput
                      style={[styles.editInputNoBorder, { color: theme.text }]}
                      value={editCapital}
                      onChangeText={(text) => setEditCapital(sanitizeNumericInput(text))}
                      placeholder="10000.00"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Symbol *</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editSymbol}
                    onChangeText={setEditSymbol}
                    placeholder="EURUSD"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              {/* Row 2: Symbol Value, Numb, Description */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Symbol Value</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editSymbolValue}
                    onChangeText={setEditSymbolValue}
                    placeholder="Symbol Value"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Numb...</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editNumberValue}
                    onChangeText={setEditNumberValue}
                    placeholder="1"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.editFieldLarge}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Description</Text>
                  <TextInput
                    style={[styles.editInputMultiline, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Description"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              {/* Market & Risk Configuration */}
              <Text style={[styles.editSectionTitle, { color: theme.text }]}>Market & Risk Configuration</Text>

              {/* Row 1: Instrument Type & Market Type */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Instrument Type</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editInstrumentType}
                    onChangeText={setEditInstrumentType}
                    placeholder="Instrument Type"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Market Type</Text>
                  <TouchableOpacity
                    style={[styles.editDropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowEditMarketTypeDropdown(!showEditMarketTypeDropdown)}
                  >
                    <Text style={{ color: theme.text }}>{editMarketType || 'Intraday'}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {showEditMarketTypeDropdown && (
                    <View style={[styles.editDropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      {['Intraday', 'Carry'].map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.dropdownItem, { backgroundColor: editMarketType === option ? (isDark ? 'rgba(10, 10, 26, 0.8)' : '#f8fafc') : 'transparent' }]}
                          onPress={() => {
                            setEditMarketType(option);
                            setShowEditMarketTypeDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Row 2: Order Type & Quantity */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Order Type</Text>
                  <TouchableOpacity
                    style={[styles.editDropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowEditOrderTypeDropdown(!showEditOrderTypeDropdown)}
                  >
                    <Text style={{ color: theme.text }}>{editOrderType || 'Buy'}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {showEditOrderTypeDropdown && (
                    <View style={[styles.editDropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      {['Buy', 'Sell'].map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.dropdownItem, { backgroundColor: editOrderType === option ? (isDark ? 'rgba(10, 10, 26, 0.8)' : '#f8fafc') : 'transparent' }]}
                          onPress={() => {
                            setEditOrderType(option);
                            setShowEditOrderTypeDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Quantity</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editQuantity}
                    onChangeText={(text) => setEditQuantity(sanitizeNumericInput(text))}
                    placeholder="Quantity"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Row 3: SL Type & SL Value */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>SL Type</Text>
                  <TouchableOpacity
                    style={[styles.editDropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowEditSlTypeDropdown(!showEditSlTypeDropdown)}
                  >
                    <Text style={{ color: theme.text }}>{editSlType}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {showEditSlTypeDropdown && (
                    <View style={[styles.editDropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      {['Percent (%)', 'Points/Value', 'Amount (₹)'].map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.dropdownItem, { backgroundColor: editSlType === option ? (isDark ? 'rgba(10, 10, 26, 0.8)' : '#f8fafc') : 'transparent' }]}
                          onPress={() => {
                            setEditSlType(option);
                            setShowEditSlTypeDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>SL Value</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editSlValue}
                    onChangeText={(text) => setEditSlValue(sanitizeNumericInput(text))}
                    placeholder="SL Value"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Row 4: TP Type & TP Value */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>TP Type</Text>
                  <TouchableOpacity
                    style={[styles.editDropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowEditTpTypeDropdown(!showEditTpTypeDropdown)}
                  >
                    <Text style={{ color: theme.text }}>{editTpType}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {showEditTpTypeDropdown && (
                    <View style={[styles.editDropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      {['Percent (%)', 'Points/Value', 'Amount (₹)'].map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.dropdownItem, { backgroundColor: editTpType === option ? (isDark ? 'rgba(10, 10, 26, 0.8)' : '#f8fafc') : 'transparent' }]}
                          onPress={() => {
                            setEditTpType(option);
                            setShowEditTpTypeDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>TP Value</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editTpValue}
                    onChangeText={(text) => setEditTpValue(sanitizeNumericInput(text))}
                    placeholder="TP Value"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Row 5: Stop Loss & Target */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Stop Loss %</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editStopLossPercent}
                    onChangeText={(text) => setEditStopLossPercent(sanitizeNumericInput(text))}
                    placeholder="Stop Loss %"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.editFieldSmall}>
                  <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Target %</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                    value={editTargetPercent}
                    onChangeText={(text) => setEditTargetPercent(sanitizeNumericInput(text))}
                    placeholder="Target %"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                {/* Active toggle moved below with Public */}
              </View>

              {/* Active + Public Toggles Row */}
              <View style={styles.editFormRow}>
                <View style={styles.editFieldToggle}>
                  <TouchableOpacity 
                    style={[styles.toggleSwitch, { backgroundColor: editIsActive ? '#10b981' : theme.border }]}
                    onPress={() => setEditIsActive(!editIsActive)}
                  >
                    <View style={[styles.toggleKnob, { marginLeft: editIsActive ? 20 : 2 }]} />
                  </TouchableOpacity>
                  <Text style={[styles.editFieldLabel, { color: theme.text, marginTop: 4 }]}>Active</Text>
                </View>
                <View style={styles.editFieldToggle}>
                  <TouchableOpacity 
                    style={[styles.toggleSwitch, { backgroundColor: editIsPublic ? '#10b981' : theme.border }]}
                    onPress={() => setEditIsPublic(!editIsPublic)}
                  >
                    <View style={[styles.toggleKnob, { marginLeft: editIsPublic ? 20 : 2 }]} />
                  </TouchableOpacity>
                  <Text style={[styles.editFieldLabel, { color: theme.text, marginTop: 4 }]}>Public</Text>
                </View>
              </View>
              
              {/* Pricing Settings - Show only when Public is enabled */}
              {editIsPublic && (
                <View style={styles.editFormRow}>
                  <View style={styles.editFieldLarge}>
                    <Text style={[styles.editSectionTitle, { color: theme.text, marginBottom: 8 }]}>Pricing Settings</Text>
                    <Text style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Subscription Price (\u20b9)</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                      value={editPrice}
                      onChangeText={(text) => setEditPrice(sanitizeNumericInput(text))}
                      placeholder="10.00"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.editHint, { color: theme.textSecondary, fontSize: 12, marginTop: 4 }]}>0 or empty for free subscription</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer Actions */}
            <View style={[styles.detailDividerLine, { backgroundColor: theme.border }]} />
            <View style={styles.editModalFooter}>
              <TouchableOpacity 
                style={[styles.editCancelBtn, { borderColor: colors.primary }]}
                onPress={() => setShowOwnEditModal(false)}
              >
                <Text style={[styles.editCancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editSaveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.editSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Strategy Modal */}
      <Modal
        visible={showOwnDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOwnDeleteModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.deleteModalHeader}>
              <Warning size={24} color="#F59E0B" weight="fill" />
              <Text style={[styles.deleteModalTitle, { color: theme.text }]}>Delete Strategy</Text>
            </View>
            
            <Text style={[styles.deleteModalText, { color: theme.textSecondary }]}>
              Are you sure you want to delete the strategy:
            </Text>
            <Text style={[styles.deleteStrategyName, { color: colors.primary }]}>
              "{selectedOwnStrategy?.name}"
            </Text>

            <View style={[styles.deleteWarningBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
              <View style={styles.deleteWarningHeader}>
                <Warning size={16} color="#F59E0B" weight="fill" />
                <Text style={[styles.deleteWarningTitle, { color: '#F59E0B' }]}>
                  This action cannot be undone. All associated data including:
                </Text>
              </View>
              <View style={styles.deleteWarningList}>
                <Text style={[styles.deleteWarningItem, { color: '#F59E0B' }]}>• Strategy configuration</Text>
                <Text style={[styles.deleteWarningItem, { color: '#F59E0B' }]}>• Performance history</Text>
                <Text style={[styles.deleteWarningItem, { color: '#F59E0B' }]}>• Trade records</Text>
              </View>
              <Text style={[styles.deleteWarningFooter, { color: '#F59E0B' }]}>will be permanently deleted.</Text>
            </View>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={[styles.deleteCancelBtn, { borderColor: colors.primary }]}
                onPress={() => setShowOwnDeleteModal(false)}
              >
                <Text style={[styles.deleteCancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteConfirmBtn, { backgroundColor: '#ff7f7f' }]}
                onPress={confirmOwnDelete}
              >
                <Text style={styles.deleteConfirmText}>Delete Strategy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Close All Strategies Confirmation Modal */}
      <Modal
        visible={showCloseAllModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCloseAllModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.deleteModalHeader}>
              <Warning size={24} color={allStrategiesPaused ? '#10b981' : colors.error} weight="fill" />
              <Text style={[styles.deleteModalTitle, { color: theme.text }]}>
                {allStrategiesPaused ? 'Resume All Strategies' : 'Close All Strategies'}
              </Text>
            </View>
            
            <Text style={[styles.deleteModalText, { color: theme.textSecondary }]}>
              {allStrategiesPaused 
                ? 'Are you sure you want to resume all strategies? This will activate all your paused strategies.'
                : 'Are you sure you want to close all strategies? This will pause all your active strategies.'
              }
            </Text>

            <View style={[styles.deleteWarningBox, { 
              backgroundColor: allStrategiesPaused ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              borderColor: allStrategiesPaused ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' 
            }]}>
              <View style={styles.deleteWarningHeader}>
                <Info size={16} color={allStrategiesPaused ? '#10b981' : colors.error} weight="fill" />
                <Text style={[styles.deleteWarningTitle, { color: allStrategiesPaused ? '#10b981' : colors.error }]}>
                  {allStrategiesPaused 
                    ? 'All strategies will be activated and start trading according to their configurations.'
                    : 'All active strategies will be paused and stop trading until resumed.'
                  }
                </Text>
              </View>
            </View>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={[styles.deleteCancelBtn, { borderColor: colors.primary }]}
                onPress={() => setShowCloseAllModal(false)}
              >
                <Text style={[styles.deleteCancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteConfirmBtn, { 
                  backgroundColor: allStrategiesPaused ? '#10b981' : colors.error 
                }]}
                onPress={handleCloseAllConfirm}
              >
                <Text style={styles.deleteConfirmText}>
                  {allStrategiesPaused ? 'Resume All' : 'Close All'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Own Strategy Brokers Modal */}
      <Modal
        visible={showOwnBrokersModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOwnBrokersModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.ownBrokersModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.ownBrokersHeader}>
              <View style={styles.ownBrokersHeaderRow}>
                <Bank size={24} color={colors.primary} weight="fill" />
                <Text style={[styles.ownBrokersTitle, { color: theme.text }]}>Select Brokers for Strategy</Text>
              </View>
              <TouchableOpacity onPress={() => setShowOwnBrokersModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.detailDividerLine, { backgroundColor: theme.border }]} />

            <Text style={[styles.ownBrokersStrategyLabel, { color: theme.textSecondary }]}>
              Strategy: <Text style={{ color: theme.text, fontWeight: '600' }}>{selectedOwnStrategy?.name}</Text>
            </Text>
            <Text style={[styles.ownBrokersDesc, { color: theme.textSecondary }]}>
              Select which brokers/API keys should be used for this strategy
            </Text>

            <View style={styles.ownBrokersCountRow}>
              <Text style={[styles.ownBrokersCount, { color: theme.textSecondary }]}>
                {selectedOwnBrokers.length} of {BROKERS_DATA.length} broker(s) selected
              </Text>
              <TouchableOpacity 
                style={[styles.selectAllBtn, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}
                onPress={selectAllBrokers}
              >
                <Text style={[styles.selectAllText, { color: colors.primary }]}>
                  {selectedOwnBrokers.length === BROKERS_DATA.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.ownBrokersList}>
              {BROKERS_DATA.map((broker) => (
                <TouchableOpacity
                  key={broker.id}
                  style={[styles.ownBrokerItem, { 
                    borderColor: selectedOwnBrokers.includes(broker.id) ? colors.primary : theme.border,
                    backgroundColor: selectedOwnBrokers.includes(broker.id) ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                  }]}
                  onPress={() => toggleOwnBrokerSelection(broker.id)}
                >
                  <View style={styles.ownBrokerCheckbox}>
                    {selectedOwnBrokers.includes(broker.id) ? (
                      <CheckSquare size={24} color={colors.primary} weight="fill" />
                    ) : (
                      <Square size={24} color={theme.border} />
                    )}
                  </View>
                  <View style={styles.ownBrokerInfo}>
                    <Text style={[styles.ownBrokerName, { color: theme.text }]}>{broker.description}</Text>
                    <View style={styles.ownBrokerBadges}>
                      <View style={[styles.ownBrokerBadge, { borderColor: theme.border }]}>
                        <Text style={[styles.ownBrokerBadgeText, { color: theme.text }]}>{broker.name}</Text>
                      </View>
                      <View style={[styles.ownBrokerBadge, { borderColor: colors.primary, backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                        <Text style={[styles.ownBrokerBadgeText, { color: colors.primary }]}>{broker.type}</Text>
                      </View>
                      {broker.id === 'broker1' && (
                        <Text style={[styles.ownBrokerId, { color: theme.textSecondary }]}>ID: {broker.description}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.ownBrokersFooter}>
              <TouchableOpacity onPress={() => setShowOwnBrokersModal(false)}>
                <Text style={[styles.ownBrokersCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.ownBrokersSaveBtn, { 
                  backgroundColor: selectedOwnBrokers.length > 0 ? colors.primary : theme.border,
                }]}
                disabled={selectedOwnBrokers.length === 0}
                onPress={() => {
                  Alert.alert('Success', `${selectedOwnBrokers.length} broker(s) selected for ${selectedOwnStrategy?.name}`);
                  setShowOwnBrokersModal(false);
                }}
              >
                <Text style={[styles.ownBrokersSaveText, { color: selectedOwnBrokers.length > 0 ? '#fff' : theme.textSecondary }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Own Strategy Trade Mode Modal */}
      <Modal
        visible={showOwnTradeModeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOwnTradeModeModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.tradeModeModalContent, { backgroundColor: theme.surface }]}> 
            <View style={styles.tradeModeHeader}>
              <Text style={[styles.tradeModeTitle, { color: theme.text }]}>Set Trade Mode</Text>
              <TouchableOpacity onPress={() => setShowOwnTradeModeModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.tradeModeSubtitle, { color: theme.text }]}>Strategy: {selectedOwnStrategy?.name}</Text>
            <Text style={[styles.tradeModeDesc, { color: theme.textSecondary }]}>Choose how you want to execute trades for this strategy</Text>

            {/* Paper Trading Option */}
            <TouchableOpacity 
              style={[
                styles.tradeModeOption,
                { 
                  borderColor: selectedOwnStrategy?.tradeMode === 'paper' ? colors.primary : theme.border,
                  backgroundColor: selectedOwnStrategy?.tradeMode === 'paper' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                }
              ]}
              onPress={() => confirmOwnTradeMode('paper')}
            >
              <FileText size={22} color={colors.primary} weight="fill" />
              <Text style={[styles.tradeModeOptionTitle, { color: colors.primary }]}>Paper Trading</Text>
              <Text style={[styles.tradeModeOptionDesc, { color: theme.textSecondary }]}>
                Practice trading with virtual money. No real money involved. Perfect for testing strategies.
              </Text>
            </TouchableOpacity>

            {/* Live Trading Option */}
            <TouchableOpacity 
              style={[
                styles.tradeModeOption,
                { 
                  borderColor: selectedOwnStrategy?.tradeMode === 'live' ? '#10b981' : theme.border,
                  backgroundColor: selectedOwnStrategy?.tradeMode === 'live' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                }
              ]}
              onPress={() => confirmOwnTradeMode('live')}
            >
              <TrendUp size={22} color="#10b981" weight="fill" />
              <Text style={[styles.tradeModeOptionTitle, { color: '#10b981' }]}>Live Trading</Text>
              <Text style={[styles.tradeModeOptionDesc, { color: theme.textSecondary }]}>
                Execute real trades with actual money. Use this when you're confident about the strategy.
              </Text>
            </TouchableOpacity>

            <View style={styles.tradeModeActions}>
              <TouchableOpacity 
                style={styles.tradeModeCancelBtn}
                onPress={() => setShowOwnTradeModeModal(false)}
              >
                <Text style={[styles.tradeModeCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tradeModePaperBtn, { borderColor: colors.primary }]}
                onPress={() => confirmOwnTradeMode('paper')}
              >
                <FileText size={16} color={colors.primary} weight="fill" />
                <Text style={[styles.tradeModePaperText, { color: colors.primary }]}>Set Paper Trade</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tradeModeLiveBtn, { backgroundColor: '#10b981' }]}
                onPress={() => confirmOwnTradeMode('live')}
              >
                <TrendUp size={16} color="#fff" weight="fill" />
                <Text style={styles.tradeModeLiveText}>Set Live Trade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Webhook Configuration Modal */}
      <Modal
        visible={showWebhookModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWebhookModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.webhookModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.webhookModalHeader}>
              <View style={styles.webhookModalTitleRow}>
                <Link size={24} color="#eab308" weight="fill" />
                <Text style={[styles.webhookModalTitle, { color: theme.text }]}>TradingView Webhook Configuration</Text>
              </View>
              <TouchableOpacity onPress={() => setShowWebhookModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.detailDividerLine, { backgroundColor: theme.border }]} />

            <Text style={[styles.webhookModalStrategy, { color: theme.textSecondary }]}>
              Strategy: <Text style={{ color: theme.text, fontWeight: '700' }}>{selectedOwnStrategy?.name}</Text>
            </Text>

            <View style={[styles.detailDividerLine, { backgroundColor: theme.border, marginVertical: spacing.md }]} />

            <ScrollView style={styles.webhookModalScroll} showsVerticalScrollIndicator={false}>
              {/* Webhook URL */}
              <Text style={[styles.webhookUrlLabel, { color: '#ff7f7f' }]}>Webhook URL:</Text>
              <View style={[styles.webhookUrlBox, { borderColor: colors.primary, backgroundColor: 'rgba(37, 99, 235, 0.05)' }]}>
                <Text style={[styles.webhookUrlText, { color: theme.text }]}>{selectedOwnStrategy?.webhookUrl || 'N/A'}</Text>
                  <TouchableOpacity style={styles.webhookCopyBtn} onPress={async () => { await Clipboard.setStringAsync(selectedOwnStrategy?.webhookUrl || ''); Alert.alert('Copied', 'Webhook URL copied to clipboard'); }}>
                    <Copy size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
              </View>

              {/* Alert Message Format */}
              <Text style={[styles.webhookAlertLabel, { color: '#10b981' }]}>TradingView Alert Message Format:</Text>
              <View style={[styles.webhookAlertBox, { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)' }]}>
                <Text style={[styles.webhookAlertCode, { color: theme.text }]}>
                  {`{\n  "secret": "${selectedOwnStrategy?.webhookSecret || 'N/A'}",\n  "signal": "{{strategy.position_size}}"\n}`}
                </Text>
                <TouchableOpacity style={styles.webhookCopyBtn} onPress={async () => { await Clipboard.setStringAsync(`{ "secret": "${selectedOwnStrategy?.webhookSecret || ''}", "signal": "{{strategy.position_size}}" }`); Alert.alert('Copied', 'Alert message format copied to clipboard'); }}>
                  <Copy size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Instructions */}
              <Text style={[styles.webhookInstructionsTitle, { color: theme.text }]}>Instructions:</Text>
              <View style={styles.webhookInstructions}>
                <Text style={[styles.webhookInstructionItem, { color: theme.textSecondary }]}>1. Open your TradingView chart and create an alert</Text>
                <Text style={[styles.webhookInstructionItem, { color: theme.textSecondary }]}>2. In the alert settings, select "Webhook URL" option</Text>
                <Text style={[styles.webhookInstructionItem, { color: theme.textSecondary }]}>3. Paste the Webhook URL above</Text>
                <Text style={[styles.webhookInstructionItem, { color: theme.textSecondary }]}>4. In the "Message" field, paste the Alert Message Format above</Text>
                <Text style={[styles.webhookInstructionItem, { color: theme.textSecondary }]}>5. The signal will automatically update based on strategy position (long/short)</Text>
              </View>
            </ScrollView>

            <View style={[styles.detailDividerLine, { backgroundColor: theme.border }]} />

            <View style={styles.webhookModalFooter}>
              <TouchableOpacity 
                style={[styles.webhookCloseBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowWebhookModal(false)}
              >
                <Text style={styles.webhookCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    );
  };

  // Main render
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Strategy</Text>
        {/* <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)' }]}>
            <ListBullets size={20} color={theme.text} weight="bold" />
          </TouchableOpacity>
        </View> */}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollView} contentContainerStyle={styles.tabsContainer}>
        {TABS.map((tab, idx) => {
          const Icon = tab.Icon;
          const isActive = activeTab === idx;
          return (
            <TouchableOpacity
              key={tab.name}
             style={[styles.tab, isActive && styles.tabActive, { backgroundColor: isActive ? (isDark ? 'rgba(37, 99, 235, 0.2)' : (Platform.OS === 'android' ? '#dbeafe' : colors.primary + '15')) : (isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(255, 255, 255, 0.9)') }]}
              onPress={() => setActiveTab(idx)}
            >
              <Icon size={16} color={isActive ? colors.primary : theme.textSecondary} weight={isActive ? 'fill' : 'regular'} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive, { color: isActive ? colors.primary : theme.textSecondary }]}>{tab.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
        {activeTab === 0 && renderDeployedTab()}
        {activeTab === 1 && renderMyStrategiesTab()}
        {activeTab === 2 && (
          <View style={styles.marketplaceMainContainer}>
            {/* Main Content Area */}
            <View style={styles.marketplaceContentWrapper}>
            <View style={styles.marketplaceContent}>
              {/* Public/Own Sub Tabs */}
              <View style={styles.marketplaceSubTabRow}>
                <TouchableOpacity 
                  style={[styles.marketplaceSubTabItem, marketplaceSubTab === 'public' && styles.marketplaceSubTabItemActive]}
                  onPress={() => setMarketplaceSubTab('public')}
                >
                  <Text style={[styles.marketplaceSubTabTitle, marketplaceSubTab === 'public' && styles.marketplaceSubTabTitleActive, { color: marketplaceSubTab === 'public' ? colors.primary : theme.textSecondary }]}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.marketplaceSubTabItem, marketplaceSubTab === 'own' && styles.marketplaceSubTabItemActive]}
                  onPress={() => setMarketplaceSubTab('own')}
                >
                  <Text style={[styles.marketplaceSubTabTitle, marketplaceSubTab === 'own' && styles.marketplaceSubTabTitleActive, { color: marketplaceSubTab === 'own' ? colors.primary : theme.textSecondary }]}>Own</Text>
                </TouchableOpacity>
              </View>

              {/* Header with Search and Filter Button (always visible while marketplace has data or when searching) */}
              <View style={styles.marketplaceHeaderRow}>
                <View style={[styles.marketplaceSearchBar, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc' }]}>
                  <MagnifyingGlass size={18} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.marketplaceSearchInput, { color: theme.text }]}
                    placeholder="Search strategies..."
                    placeholderTextColor={theme.textSecondary}
                    value={marketplaceSearchQuery}
                    onChangeText={setMarketplaceSearchQuery}
                  />
                </View>
                <TouchableOpacity 
                  style={[styles.filterToggleBtn, { 
                    backgroundColor: showFilters ? colors.primary : (isDark ? 'rgba(10, 10, 26, 0.5)' : 'rgba(241, 245, 249, 0.8)'),
                    borderColor: showFilters ? colors.primary : theme.border,
                  }]}
                  onPress={openFiltersSidebar}
                >
                  <SlidersHorizontal size={18} color={showFilters ? '#fff' : theme.text} weight="bold" />
                  <Text style={[styles.filterToggleBtnText, { color: showFilters ? '#fff' : theme.text }]}>Filters</Text>
                  {Object.values(marketplaceFilters).flat().length > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: showFilters ? '#fff' : colors.primary }]}>
                      <Text style={[styles.filterBadgeText, { color: showFilters ? colors.primary : '#fff' }]}>
                        {Object.values(marketplaceFilters).flat().length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* If search yields no results show empty state, otherwise list the strategies */}
              {filteredMarketplaceStrategies.length === 0 ? (
                <View style={[styles.emptyStateContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Storefront size={48} color={theme.textSecondary} weight="duotone" />
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Strategies Available</Text>
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}> 
                    {marketplaceSubTab === 'public' 
                      ? 'No public strategies are currently available in the marketplace. Check back later!'
                      : 'You have no private strategies yet. Create one to get started!'}
                  </Text>
                </View>
              ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.strategyCardsVertical}>
                {filteredMarketplaceStrategies.slice(0, marketplaceVisibleCount).map((strategy) => (
                  <View 
                    key={strategy.id}
                    style={[styles.marketplaceStrategyCard, { 
                      backgroundColor: isDark ? 'rgba(10, 10, 26, 0.7)' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : '#e2e8f0',
                    }]}
                  >
                    {/* Card Header */}
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.strategyCardName, { color: theme.text }]}>{strategy.name}</Text>
                      <TouchableOpacity>
                        <Star size={14} color={theme.textSecondary} weight="regular" />
                      </TouchableOpacity>
                    </View>

                    {/* Tags */}
                    <View style={styles.strategyTags}>
                      <View style={[styles.tag, { backgroundColor: '#10b98115', borderColor: '#10b98130' }]}>
                        <Text style={[styles.tagText, { color: '#10b981' }]}>{strategy.visibility}</Text>
                      </View>
                      <View style={[styles.tag, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                        <Text style={[styles.tagText, { color: colors.primary }]}>{strategy.segment}</Text>
                      </View>
                      <View style={[styles.tag, { backgroundColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                        <Text style={[styles.tagText, { color: '#8b5cf6' }]}>By {strategy.madeBy}</Text>
                      </View>
                    </View>

                    {/* Performance */}
                    <View style={styles.performanceRow}>
                      <TrendUp size={14} color="#10b981" weight="bold" />
                      <Text style={[styles.performanceText, { color: '#10b981' }]}>{strategy.performance} performance</Text>
                    </View>

                    {/* Strategy Details */}
                    <View style={[styles.strategyDetailsBox, { backgroundColor: isDark ? 'rgba(51, 65, 85, 0.3)' : '#f8fafc' }]}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Capital</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{strategy.capital}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Symbol</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{strategy.symbol}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Subscription</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{strategy.subscription}</Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.cardActions}>
                      <TouchableOpacity 
                        style={[styles.viewDetailsBtn, { borderColor: colors.primary }]}
                        onPress={() => router.push(`/marketplace-strategy-detail?id=${strategy.id}`)}
                      >
                        <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details</Text>
                      </TouchableOpacity>
                      { /* Only show subscribe controls on public marketplace cards (hide on own strategy cards) */ }
                      {marketplaceSubTab === 'public' && (
                        subscribedStrategies.some(sub => sub.strategyId === strategy.id) ? (
                          <View 
                            style={[styles.subscribeBtn, { backgroundColor: '#2c9d2eff' }]}
                          >
                            <Text style={styles.subscribeBtnText}>Subscribed</Text>
                          </View>
                        ) : (
                          <TouchableOpacity 
                            style={[styles.subscribeBtn, { backgroundColor: colors.primary }]}
                            onPress={() => {
                              setSelectedMarketplaceStrategy(strategy);
                              setShowSubscribeModal(true);
                            }}
                          >
                            <Text style={styles.subscribeBtnText}>Subscribe</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                ))}
                
                {/* Load More Button */}
                {filteredMarketplaceStrategies.length > marketplaceVisibleCount && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => setMarketplaceVisibleCount(prev => prev + 8)}
                  >
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
              </ScrollView>
              )}
            </View>
            </View>

            {/* Filters Modal Overlay */}
            <Modal transparent visible={showFilters} animationType="none" onRequestClose={closeFiltersSidebar}>
              <View style={styles.filterModalContainer}>
                <TouchableOpacity style={styles.filterBackdrop} activeOpacity={1} onPress={closeFiltersSidebar} />
                <Animated.View style={[styles.filtersSidebarModal, { backgroundColor: isDark ? '#0a0a1a' : '#ffffff', transform: [{ translateX: filterSlideAnim }] }]}>
                  <View style={styles.filtersHeader}>
                    <View style={styles.filtersHeaderLeft}>
                      <SlidersHorizontal size={20} color={colors.primary} weight="bold" />
                      <View>
                        <Text style={[styles.filtersTitle, { color: theme.text }]}>Filters</Text>
                        <Text style={[styles.filtersSubtitle, { color: theme.textSecondary }]}>Refine your strategies</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={resetFilters}>
                      <ArrowClockwise size={16} color={theme.textSecondary} weight="bold" />
                      <Text style={[styles.resetText, { color: theme.textSecondary }]}>Reset</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.appliedFilters, { color: theme.textSecondary }]}>
                    {Object.values(marketplaceFilters).flat().length} filters applied
                  </Text>

                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Status Filter */}
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Status</Text>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('status', 'Total')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.status.includes('Total') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.status.includes('Total') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Total ({filterCounts.total})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('status', 'Active')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.status.includes('Active') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.status.includes('Active') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Active ({filterCounts.active})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('status', 'Inactive')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.status.includes('Inactive') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.status.includes('Inactive') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Inactive ({filterCounts.inactive})</Text>
                  </TouchableOpacity>
                </View>

                {/* Type Filter */}
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Type</Text>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('type', 'Public')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.type.includes('Public') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.type.includes('Public') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Public ({filterCounts.public})</Text>
                  </TouchableOpacity>
                </View>

                {/* Made By Filter */}
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Made By</Text>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('madeBy', 'Admin')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.madeBy.includes('Admin') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.madeBy.includes('Admin') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Admin ({filterCounts.admin})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('madeBy', 'User')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.madeBy.includes('User') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.madeBy.includes('User') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>User ({filterCounts.user})</Text>
                  </TouchableOpacity>
                </View>

                {/* Segment Filter */}
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Segment</Text>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('segment', 'Forex')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.segment.includes('Forex') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.segment.includes('Forex') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Forex ({filterCounts.forex})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('segment', 'Indian')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.segment.includes('Indian') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.segment.includes('Indian') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Indian ({filterCounts.indian})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterCheckbox}
                    onPress={() => toggleFilter('segment', 'Crypto')}
                  >
                    <View style={[styles.checkbox, marketplaceFilters.segment.includes('Crypto') && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {marketplaceFilters.segment.includes('Crypto') && <CheckSquare size={14} color="#fff" weight="fill" />}
                    </View>
                    <Text style={[styles.filterLabel, { color: theme.text }]}>Crypto ({filterCounts.crypto})</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
                </Animated.View>
              </View>
            </Modal>
          </View>
        )}
      </ScrollView>

      {/* Subscription Modal */}
      <Modal
        visible={showSubscribeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubscribeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#0a0a1a' : '#ffffff' }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Modal Header */}
              <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Subscription</Text>
              <Text style={[styles.modalStrategyName, { color: theme.textSecondary }]}>
                {selectedMarketplaceStrategy?.name || 'Strategy'}
              </Text>
              {/* close is handled by tapping backdrop */}
              
              {/* Tags */}
              <View style={styles.modalTags}>
                <View style={[styles.modalTag, { borderColor: colors.primary }]}>
                  <Text style={[styles.modalTagText, { color: colors.primary }]}>{selectedMarketplaceStrategy?.segment || 'Forex'}</Text>
                </View>
                <View style={[styles.modalTag, { borderColor: colors.primary }]}>
                  <Text style={[styles.modalTagText, { color: colors.primary }]}>{selectedMarketplaceStrategy?.visibility || 'Public'}</Text>
                </View>
                <View style={[styles.modalTag, { borderColor: '#10b981' }]}>
                  <Text style={[styles.modalTagText, { color: '#10b981' }]}>{selectedMarketplaceStrategy?.performance || '+%'}</Text>
                </View>
              </View>

              {/* Subscription Details */}
              <Text style={[styles.subscriptionDetailsTitle, { color: theme.text }]}>Subscription Details</Text>
              
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <CurrencyDollar size={20} color={theme.textSecondary} weight="bold" />
                </View>
                <Text style={[styles.detailLabel, { color: theme.text }]}>Subscription Fee</Text>
                <Text style={[styles.detailValue, { color: '#10b981' }]}>
                  {selectedMarketplaceStrategy?.subscription || 'FREE'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <CalendarBlank size={20} color={theme.textSecondary} weight="bold" />
                </View>
                <Text style={[styles.detailLabel, { color: theme.text }]}>Access Duration</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>30 Days</Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <CheckCircle size={20} color={theme.textSecondary} weight="bold" />
                </View>
                <Text style={[styles.detailLabel, { color: theme.text }]}>Expires On</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>02 Feb 2026</Text>
              </View>

              {/* What You Get Section */}
              <View style={[styles.whatYouGetBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#E8FFFB' }]}>
                <View style={styles.whatYouGetHeader}>
                  <CheckCircle size={20} color="#10b981" weight="fill" />
                  <Text style={[styles.whatYouGetTitle, { color: '#10b981' }]}>What You Get</Text>
                </View>
                <View style={styles.bulletList}>
                  <Text style={[styles.bulletItem, { color: '#10b981' }]}>• 30 days of strategy access</Text>
                  <Text style={[styles.bulletItem, { color: '#10b981' }]}>• Automatic trade execution</Text>
                  <Text style={[styles.bulletItem, { color: '#10b981' }]}>• Real-time signal updates</Text>
                  <Text style={[styles.bulletItem, { color: '#10b981' }]}>• Auto-renewal option</Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowSubscribeModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubscribeBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  if (!selectedMarketplaceStrategy) return;
                  try {
                    await strategyService.subscribe(selectedMarketplaceStrategy.id, {
                      lots: 1,
                      tradeMode: 'paper',
                    });
                    // Refresh subscriptions
                    const subscriptionsRes = await strategyService.getSubscriptions();
                    if (subscriptionsRes.data) {
                      setSubscribedStrategies(subscriptionsRes.data.map((sub: any) => ({
                        id: sub.id,
                        strategyId: sub.strategyId,
                        name: sub.strategy?.name || 'Unknown',
                        description: sub.strategy?.description || '',
                        author: sub.strategy?.author?.name || 'Unknown',
                        status: sub.isActive ? 'Active' : 'Inactive',
                        lots: sub.lots,
                        expiry: sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString() : 'N/A',
                        subscribedAt: new Date(sub.subscribedAt).toLocaleDateString(),
                        segment: sub.strategy?.segment || 'Forex',
                        type: 'Intraday',
                        capital: `₹${Number(sub.strategy?.capital ?? 0).toFixed(2)}`,
                        symbol: sub.strategy?.symbol || 'N/A',
                        isPublic: sub.strategy?.isPublic,
                        isStopped: sub.isPaused,
                        tradeMode: sub.tradeMode,
                      })));
                    }
                    setShowSubscribeModal(false);
                    Alert.alert('Success', 'Successfully subscribed to strategy!');
                  } catch (error: any) {
                    console.error('Failed to subscribe:', error);
                    Alert.alert('Error', error.message || 'Failed to subscribe. Please try again.');
                  }
                }}
              >
                <CheckCircle size={18} color="#fff" weight="fill" />
                <Text style={styles.modalSubscribeText}>Subscribe Now</Text>
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
    flex: 1,
  },
  header: {
    paddingTop: 64,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsScrollView: {
    flexGrow: 0,
    marginTop: 8,
  },
  tabsContainer: {
    paddingHorizontal:10,
    gap: 8,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabActive: {
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 80 : 100,
  },
  deployedContainer: {
    gap: 16,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  toggleButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
  },
  toggleBtnActive: {},
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  strategiesList: {
    gap: 12,
  },
  strategyCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  strategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  strategyTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12,
  },
  strategyName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtn: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  brokerText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pnlValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
  backtestContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  emptyStateContainer: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  emptyStateBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  loadMoreGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  backtestMenu: {
    position: 'absolute',
    right: 0,
    top: 44,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 50,
  },
  backtestMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  myStrategiesContainer: {
    gap: 16,
  },
  selectListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectListText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'android' ? 2 : 10,
    borderRadius: 12,
    minHeight: Platform.OS === 'android' ? 32 : 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketplaceList: {
    gap: 16,
  },
  marketplaceCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  marketplaceTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketplaceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  marketplaceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  marketplaceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  marketplaceDetailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  marketplaceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  unsubscribeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  unsubscribeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  deployBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  deployBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Marketplace Styles
  marketplaceMainContainer: {
    flex: 1,
    position: 'relative',
  },
  marketplaceContentWrapper: {
    flex: 1,
    position: 'relative',
  },
  marketplaceContent: {
    flex: 1,
  },
  marketplaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  filterBackdrop: {
    flex: 1,
  },
  filtersSidebarModal: {
    width: 260,
    height: '100%',
    padding: spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(203, 213, 225, 0.3)',
    ...shadows.lg,
    elevation: 10,
    flexShrink: 0,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    marginTop: 100,
  },
  filtersHeaderLeft: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  filtersSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  resetText: {
    fontSize: 11,
    marginTop: 2,
  },
  appliedFilters: {
    fontSize: 12,
    marginBottom: spacing.md,
  },
  filterSection: {
    marginBottom: spacing.lg,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  filterCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 13,
  },
  marketplaceSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'android' ? 2 : spacing.sm,
    borderRadius: borderRadius.lg,
  },
  marketplaceSearchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  filterToggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  strategyCardsVertical: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  marketplaceStrategyCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  strategyCardName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.xs,
  },
  strategyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
  },
  performanceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  strategyDetailsBox: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  viewDetailsBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subscribeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  subscribeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  marketplaceContainer: {
    gap: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.1)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99, 102, 241, 0.1)',
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  filterApplyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // SL/TP Modal Styles
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalStrategyInfo: {
    paddingHorizontal: 20,
    marginBottom: spacing.lg,
  },
  modalStrategyLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalStrategyDesc: {
    fontSize: 12,
  },
  inputGroup: {
    paddingHorizontal: 20,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 14,
  },
  inputHint: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  currentPositionBox: {
    marginHorizontal: 20,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  currentPositionText: {
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Position Details Banner Styles
  positionDetailsBanner: {
    paddingHorizontal: 20,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
  },
  modalPositionSymbol: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  positionEntry: {
    fontSize: 12,
    marginBottom: 2,
  },
  positionCurrent: {
    fontSize: 12,
  },
  // Radio Button Styles
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.sm,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    fontWeight: '500',
  },
  slTpInput: {
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
  },
  slTpInputField: {
    paddingVertical: spacing.md,
    fontSize: 14,
  },
  // Info Box Styles
  infoBox: {
    marginHorizontal: 20,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  // Position Tab Styles
  positionTabsWrapper: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  positionTabButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  activePositionTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  positionTabGradient: {
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  positionTabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  activePositionTabText: {
    fontWeight: '700',
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
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 120,
    left: 16,
    width: width / 2 - 24,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginTop: spacing.xs,
    zIndex: 100000,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  closeDropdown: {
    left: width / 2 + 8,
    width: width / 2 - 24,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  dropdownText: {
    fontSize: 14,
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
    ...shadows.sm,
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
  chevronIcon: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionInfoIcon: {
    padding: 2,
  },
  positionSymbol: {
    fontSize: 15,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionTime: {
    fontSize: 10,
  },
  positionStrategyName: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  mtmValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadgeGlassy: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
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
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoIconInline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  // My Strategies Tab Styles
  myStrategiesStatsRow: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  myStrategiesStatCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 80,
    ...shadows.sm,
  },
  myStrategiesStatIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  myStrategiesStatValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  myStrategiesStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  myStrategiesSubTabsWrapper: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  myStrategiesSubTabButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  activeMyStrategiesSubTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  myStrategiesSubTabGradient: {
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  myStrategiesSubTabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeMyStrategiesSubTabText: {
    fontWeight: '700',
  },
  strategyListContainer: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  strategyListItem: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  strategyListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  strategyListInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  strategyListName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  strategyListAuthor: {
    fontSize: 11,
    fontWeight: '500',
  },
  strategyBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  strategyStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  strategyStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  strategyIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strategyListDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  strategyDetailText: {
    fontSize: 12,
    fontWeight: '500',
  },
  strategyListActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  strategyActionBtn: {
    width: 31,
    height: 31,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // New Stats Card Styles
  statCardWide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    minWidth: 110,
    gap: spacing.sm,
  },
  statCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCardContent: {
    flex: 1,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  statCardValue: {
    fontSize:17,
    fontWeight: '700',
  },
  // Sub Tab Styles
  subTabRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  subTabItem: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabItemActive: {
    borderBottomColor: colors.primary,
  },
  subTabTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  subTabTitleActive: {
    fontWeight: '700',
  },
  subTabDesc: {
    fontSize: 11,
  },
  // Marketplace Sub Tab Styles
  marketplaceSubTabRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
  },
  marketplaceSubTabItem: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  marketplaceSubTabItemActive: {
    borderBottomColor: colors.primary,
  },
  marketplaceSubTabTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  marketplaceSubTabTitleActive: {
    fontWeight: '700',
  },
  // Active All / Pause All Button
  activeAllBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  activeAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Pause/Play icon-only button
  pauseIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  // Pause All Button (legacy - keeping for reference)
  pauseAllBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    position: 'relative',
  },
  pauseAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  // Status Toggle Switch Styles
  strategyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusToggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  statusToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Tooltip Styles
  tooltip: {
    position: 'absolute',
    top: -35,
    left: '50%',
    transform: [{ translateX: -45 }],
    minWidth:87,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  // New Strategy Button
  newStrategyBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(94, 139, 211, 1)',
  },
  newStrategyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Table Styles
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableBody: {
    gap: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  tableCell: {
    fontSize: 12,
    fontWeight: '500',
  },
  colNum: {
    width: 24,
    textAlign: 'center',
  },
  colName: {
    flex: 2,
    paddingRight: spacing.sm,
  },
  colStatus: {
    width: 70,
    alignItems: 'center',
  },
  colLots: {
    width: 50,
    alignItems: 'center',
  },
  colExpiry: {
    width: 75,
    textAlign: 'center',
  },
  colDate: {
    width: 80,
    textAlign: 'center',
  },
  colAction: {
    flex: 1,
    minWidth: 100,
  },
  strategyNameText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  strategyDescText: {
    fontSize: 10,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  lotsInputWrap: {
    justifyContent: 'center',
  },
  lotsInput: {
    width: 40,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  actionIcons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  actionIconBtn: {
    padding: 4,
  },
  // Toggle Switch Styles
  statusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  // Pause Message Toast
  pauseMessageContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    zIndex: 1000,
  },
  pauseMessageText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Strategy Detail Modal
  strategyDetailModalContent: {
    width: width - 40,
    maxHeight: '90%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  strategyDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  strategyDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  strategyDetailIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strategyDetailIconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  strategyDetailTitleInfo: {
    gap: 2,
  },
  strategyDetailTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  strategyDetailSubtitle: {
    fontSize: 12,
  },
  strategyDetailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  detailBadgeOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  detailBadgeFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  detailBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailDividerLine: {
    height: 1,
    marginVertical: spacing.sm,
  },
  strategyDetailScroll: {
    maxHeight: 380,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailSection: {
    gap: spacing.xs,
  },
  detailInfoGrid: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  detailInfoLabel: {
    fontSize: 12,
    minWidth: 90,
  },
  detailInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  detailGridContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailGridCol: {
    flex: 1,
  },
  detailGridRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: 4,
  },
  detailGridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  descriptionBox: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeDetailBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  closeDetailBtnLarge: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.xl,
  },
  closeSmallBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  closeDetailBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Confirm Modal (Unsubscribe)
  confirmModalContent: {
    width: width - 60,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  confirmModalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  confirmModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  confirmCancelBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  confirmCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  confirmUnsubBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  confirmUnsubText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Brokers Modal
  brokersModalContent: {
    width: width - 40,
    maxHeight: '80%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  brokersModalHeader: {
    marginBottom: spacing.xs,
  },
  brokersModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brokersModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  brokersSubtitle: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  brokersDivider: {
    height: 1,
    marginVertical: spacing.md,
  },
  brokersDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  brokersList: {
    maxHeight: 250,
  },
  brokerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  brokerCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brokerInfo: {
    flex: 1,
  },
  brokerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  brokerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  brokerTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  brokerTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  brokerDesc: {
    fontSize: 12,
  },
  brokersModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  brokersCancelBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  brokersCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  brokersSaveBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  brokersSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Trade Mode Modal
  tradeModeModalContent: {
    width: width - 40,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  tradeModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tradeModeTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tradeModeSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  tradeModeDesc: {
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  tradeModeOption: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tradeModeOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  tradeModeOptionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  tradeModeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  tradeModeCancelBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  tradeModeCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  tradeModePaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  tradeModePaperText: {
    fontWeight: '600',
    fontSize: 13,
  },
  tradeModeLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  tradeModeLiveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  tradeModeDisabledBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  tradeModeDisabledText: {
    fontWeight: '600',
    fontSize: 13,
  },
  // Own Strategy Detail Modal
  webhookConfigBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  webhookLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  webhookValue: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  webhookCodeBox: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  webhookCode: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  webhookNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
  },
  webhookNoteText: {
    fontSize: 11,
    flex: 1,
  },
  ownDetailFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  stopStrategyBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  stopStrategyText: {
    fontWeight: '600',
    fontSize: 13,
  },
  editStrategyBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  editStrategyText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  // Edit Strategy Modal
  editModalContent: {
    width: width - 32,
    maxHeight: '85%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  editModalScroll: {
    maxHeight: 400,
  },
  editFormRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  editFieldLarge: {
    flex: 2,
    minWidth: 150,
  },
  editFieldSmall: {
    flex: 1,
    minWidth: 100,
  },
  editFieldTiny: {
    width: 50,
  },
  editFieldToggle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editFieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  editInputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  editInputNoBorder: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  editInputMultiline: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    position: 'relative',
  },
  editDropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemText: {
    fontSize: 14,
  },
  editSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleSwitch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  editModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editCancelBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  editCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  editSaveBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  editSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  editHint: {
    fontSize: 12,
    marginTop: 4,
  },
  // Delete Strategy Modal
  deleteModalContent: {
    width: width - 48,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  deleteModalText: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  deleteStrategyName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  deleteWarningBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  deleteWarningHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  deleteWarningTitle: {
    fontSize: 13,
    flex: 1,
  },
  deleteWarningList: {
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
  },
  deleteWarningItem: {
    fontSize: 13,
    marginBottom: 2,
  },
  deleteWarningFooter: {
    fontSize: 13,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  deleteCancelBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  deleteCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  deleteConfirmBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  deleteConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Own Brokers Modal
  ownBrokersModalContent: {
    width: width - 40,
    maxHeight: '80%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  ownBrokersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ownBrokersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownBrokersTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  ownBrokersStrategyLabel: {
    fontSize: 14,
    marginTop: spacing.sm,
  },
  ownBrokersDesc: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  ownBrokersCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ownBrokersCount: {
    fontSize: 13,
  },
  selectAllBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ownBrokersList: {
    maxHeight: 250,
  },
  ownBrokerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  ownBrokerCheckbox: {},
  ownBrokerInfo: {
    flex: 1,
  },
  ownBrokerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  ownBrokerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ownBrokerBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  ownBrokerBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ownBrokerId: {
    fontSize: 11,
    marginLeft: spacing.xs,
  },
  ownBrokersFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  ownBrokersCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  ownBrokersSaveBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  ownBrokersSaveText: {
    fontWeight: '600',
    fontSize: 14,
  },
  // Webhook Configuration Modal
  webhookModalContent: {
    width: width - 40,
    maxHeight: '85%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  webhookModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  webhookModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  webhookModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  webhookModalStrategy: {
    fontSize: 14,
    marginTop: spacing.sm,
  },
  webhookModalScroll: {
    maxHeight: 350,
  },
  webhookUrlLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  webhookUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  webhookUrlText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  webhookCopyBtn: {
    padding: spacing.xs,
  },
  webhookAlertLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  webhookAlertBox: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  webhookAlertCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  webhookInstructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  webhookInstructions: {
    marginBottom: spacing.md,
  },
  webhookInstructionItem: {
    fontSize: 13,
    lineHeight: 20,
  },
  webhookModalFooter: {
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  webhookCloseBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  webhookCloseBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Subscription Modal Styles
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
  detailIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  whatYouGetBox: {
    borderRadius: 12,
    padding: 18,
    marginTop: 8,
    marginBottom: 16,
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
