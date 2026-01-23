import { colors, getTheme } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { apiKeyService } from '@/services/apiKeyService';
import { strategyBrokerService } from '@/services/strategyBrokerService';
import { strategyService } from '@/services/strategyService';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowClockwise,
    Bank,
    CaretDown,
    CheckSquare,
    Copy,
    Eye,
    Flask,
    FloppyDisk,
    GearSix,
    Info,
    Pause,
    PencilSimple,
    Play,
    PlusCircle,
    Sparkle,
    Square,
    Trash,
    Warning,
    X
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function TabTwoScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const theme = getTheme(isDark);
  const [activeTab, setActiveTab] = useState(tab === 'create' ? 'create' : 'ai-builder');
  const [segment, setSegment] = useState('Indian Market');
  const [instrument, setInstrument] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [tradingType, setTradingType] = useState('Intraday');
  const [slType, setSlType] = useState('Percent (%)');
  const [slValue, setSlValue] = useState('');
  const [tpType, setTpType] = useState('Percent (%)');
  const [tpValue, setTpValue] = useState('');
  const [capitalUsed, setCapitalUsed] = useState('');
  const [quantity, setQuantity] = useState('');
  const [strategyDescription, setStrategyDescription] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // API Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);

  // Modal states for saved strategies
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [selectedBrokers, setSelectedBrokers] = useState<number[]>([]);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editSegment, setEditSegment] = useState('');
  const [editStrategyType, setEditStrategyType] = useState('Intraday');
  const [editCapital, setEditCapital] = useState('');
  const [editSymbol, setEditSymbol] = useState('');
  const [editSymbolValue, setEditSymbolValue] = useState('');
  const [editLots, setEditLots] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editInstrumentType, setEditInstrumentType] = useState('');
  const [editMarketType, setEditMarketType] = useState('');
  const [editOrderType, setEditOrderType] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editSlType, setEditSlType] = useState('Percent (%)');
  const [editSlValue, setEditSlValue] = useState('');
  const [editTpType, setEditTpType] = useState('Percent (%)');
  const [editTpValue, setEditTpValue] = useState('');
  const [editStopLossPercent, setEditStopLossPercent] = useState('');
  const [editTargetPercent, setEditTargetPercent] = useState('');
  
  // Dropdown visibility states for edit modal
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false);
  const [showStrategyTypeDropdown, setShowStrategyTypeDropdown] = useState(false);
  const [showMarketTypeDropdown, setShowMarketTypeDropdown] = useState(false);
  const [showOrderTypeDropdown, setShowOrderTypeDropdown] = useState(false);
  const [showSlTypeDropdown, setShowSlTypeDropdown] = useState(false);
  const [showTpTypeDropdown, setShowTpTypeDropdown] = useState(false);

  // Create Strategy tab states
  const [strategyName, setStrategyName] = useState('');
  const [strategyType, setStrategyType] = useState('AI Builder');
  const [conditionText, setConditionText] = useState('');
  const [marketSegment, setMarketSegment] = useState('Cryptocurrency');
  const [minimumCapital, setMinimumCapital] = useState('');
  const [visibility, setVisibility] = useState('Private');
  const [strategyPrice, setStrategyPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedQuickSetup, setSelectedQuickSetup] = useState('');
  const [instrumentType, setInstrumentType] = useState('');
  const [symbol, setSymbol] = useState('');
  const [orderType, setOrderType] = useState('');
  const [marketType, setMarketType] = useState('');
  const [quantityValue, setQuantityValue] = useState('');

  const SEGMENT_OPTIONS = ['Indian Market', 'Cryptocurrency', 'Forex'];
  const INSTRUMENT_OPTIONS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFC'];
  const TIMEFRAME_OPTIONS = ['1 minute', '5 minutes', '15 minutes', '1 hour', '4 hour', '1 day', '1 week'];
  const TRADING_TYPE_OPTIONS = ['Intraday', 'Carry Forward'];
  const SL_TP_TYPE_OPTIONS = ['Percent (%)', 'Point / Value', 'Amount (₹)'];
  
  // AI Builder Visual Strategy Builder states
  const [aiExchange, setAiExchange] = useState('Indian Market');
  const [aiSymbol, setAiSymbol] = useState('NIFTY');
  const [aiRunInterval, setAiRunInterval] = useState('1 Minute');
  const [aiFromDate, setAiFromDate] = useState('01/01/2025');
  const [aiToDate, setAiToDate] = useState('31/12/2025');
  const [aiSelectedIndicator, setAiSelectedIndicator] = useState('');
  const [aiBuyCondition, setAiBuyCondition] = useState('');
  const [aiSellCondition, setAiSellCondition] = useState('');
  const [addedIndicators, setAddedIndicators] = useState<Array<{name: string, inputs: string, outputs: string}>>([]);
  const isBacktestEnabled = aiBuyCondition.trim().length > 0 && aiSellCondition.trim().length > 0;
  
  const RUN_INTERVAL_OPTIONS = ['1 Minute', '5 Minutes', '15 Minutes', '1 Hour', '4 Hours', '1 Day', '1 Week'];
  const INDICATOR_OPTIONS = [
    'RSI (Relative Strength Index)',
    'EMA (Exponential Moving Average)',
    'SMA (Simple Moving Average)',
    'MACD (Moving Average Convergence Divergence)',
    'Bollinger Bands',
    'ATR (Average True Range)',
    'ADX (Average Directional Index)',
    'Stochastic Oscillator',
    'ROC (Rate of Change)',
    'CCI (Commodity Channel Index)',
    'Williams %R',
    'MFI (Money Flow Index)',
    'OBV (On Balance Volume)',
    'VWAP (Volume Weighted Average Price)',
    'Supertrend',
    'Ichimoku Cloud',
    'Parabolic SAR',
    'DMI (Directional Movement Index)',
    'Aroon Indicator',
    'Keltner Channels'
  ];

  const getIndicatorDetails = (indicatorName: string) => {
    const details: Record<string, {inputs: string, outputs: string}> = {
      'RSI (Relative Strength Index)': { inputs: 'timeperiod = 14', outputs: 'real' },
      'EMA (Exponential Moving Average)': { inputs: 'timeperiod = 100', outputs: 'real' },
      'SMA (Simple Moving Average)': { inputs: 'timeperiod = 50', outputs: 'real' },
      'MACD (Moving Average Convergence Divergence)': { inputs: 'fastperiod = 12, slowperiod = 26, signalperiod = 9', outputs: 'macd, signal, histogram' },
      'Bollinger Bands': { inputs: 'timeperiod = 20, nbdevup = 2, nbdevdn = 2', outputs: 'upper, middle, lower' },
      'ATR (Average True Range)': { inputs: 'timeperiod = 14', outputs: 'real' },
      'ADX (Average Directional Index)': { inputs: 'timeperiod = 14', outputs: 'real' },
      'Stochastic Oscillator': { inputs: 'fastk_period = 14, slowk_period = 3, slowd_period = 3', outputs: 'slowk, slowd' },
      'ROC (Rate of Change)': { inputs: 'timeperiod = 10', outputs: 'real' },
      'CCI (Commodity Channel Index)': { inputs: 'timeperiod = 14', outputs: 'real' },
      'Williams %R': { inputs: 'timeperiod = 14', outputs: 'real' },
      'MFI (Money Flow Index)': { inputs: 'timeperiod = 14', outputs: 'real' },
      'OBV (On Balance Volume)': { inputs: '', outputs: 'real' },
      'VWAP (Volume Weighted Average Price)': { inputs: '', outputs: 'real' },
      'Supertrend': { inputs: 'period = 7, multiplier = 3', outputs: 'supertrend, direction' },
      'Ichimoku Cloud': { inputs: 'tenkan = 9, kijun = 26, senkou = 52', outputs: 'tenkan, kijun, senkou_a, senkou_b, chikou' },
      'Parabolic SAR': { inputs: 'acceleration = 0.02, maximum = 0.2', outputs: 'real' },
      'DMI (Directional Movement Index)': { inputs: 'timeperiod = 14', outputs: 'plus_di, minus_di' },
      'Aroon Indicator': { inputs: 'timeperiod = 25', outputs: 'aroon_up, aroon_down' },
      'Keltner Channels': { inputs: 'timeperiod = 20, multiplier = 2', outputs: 'upper, middle, lower' }
    };
    return details[indicatorName] || { inputs: '', outputs: 'real' };
  };

  // Header-only state to track pause status for bulk pause/resume button
  // true = at least one strategy is NOT paused (show "Pause All")
  // false = all strategies ARE paused (show "Activate All")
  const [headerAnyNotPaused, setHeaderAnyNotPaused] = useState<boolean | null>(null);

  // Pagination state for saved strategies
  const [savedStrategiesVisibleCount, setSavedStrategiesVisibleCount] = useState(8);

  // Derive effective value: use local state if set, otherwise compute from strategies
  const effectiveHeaderHasAnyActive = headerAnyNotPaused !== null 
    ? headerAnyNotPaused 
    : savedStrategies.some(s => !s.isPaused);

  const handleAddIndicator = (indicatorName: string) => {
    const details = getIndicatorDetails(indicatorName);
    setAddedIndicators([...addedIndicators, {
      name: indicatorName,
      inputs: details.inputs,
      outputs: details.outputs
    }]);
    setAiSelectedIndicator('');
    setOpenDropdown(null);
  };

  const handleRemoveIndicator = (index: number) => {
    setAddedIndicators(addedIndicators.filter((_, i) => i !== index));
  };

  // Allow only numeric input (digits and single decimal point)
  const filterNumeric = (text: string) => {
    let filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    if (parts.length > 2) {
      filtered = parts.shift() + '.' + parts.join('');
    }
    return filtered;
  };

  // Fetch saved strategies
  const fetchStrategies = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await strategyService.getStrategies();
      if (response.success && response.data) {
        const strategies = response.data;
        setSavedStrategies(strategies);
        // Update header state based on isPaused (not isActive)
        // true means at least one strategy is NOT paused → show "Pause All"
        setHeaderAnyNotPaused(strategies.some((s: any) => !s.isPaused));
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch drafts
  const fetchDrafts = useCallback(async () => {
    try {
      const response = await strategyService.getDrafts();
      if (response.success && response.data) {
        setDrafts(response.data);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
    }
  }, []);

  // Refresh data
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStrategies(), fetchDrafts()]);
    setIsRefreshing(false);
  }, [fetchStrategies, fetchDrafts]);

  // Load data on mount
  useEffect(() => {
    fetchStrategies();
    fetchDrafts();
  }, []);

  // Refetch data when tab comes into focus to sync with changes from other tabs
  useFocusEffect(
    useCallback(() => {
      fetchStrategies();
      fetchDrafts();
    }, [])
  );

  // Sync activeTab with route params
  useEffect(() => {
    if (tab === 'create') {
      setActiveTab('create');
    }
  }, [tab]);

  // Create strategy handler
  const handleCreateStrategy = async () => {
    if (!strategyName.trim()) {
      Alert.alert('Error', 'Please enter a strategy name');
      return;
    }
    if (!symbol.trim()) {
      Alert.alert('Error', 'Please select a symbol');
      return;
    }

    try {
      setIsCreating(true);
      
      const segmentMap: Record<string, 'Forex' | 'Crypto' | 'Indian'> = {
        'Indian Market': 'Indian',
        'Cryptocurrency': 'Crypto',
        'Forex': 'Forex'
      };

      const strategyData = {
        name: strategyName,
        segment: segmentMap[marketSegment] || 'Crypto',
        symbol: symbol,
        capital: parseFloat(minimumCapital) || 10000,
        lots: parseFloat(quantityValue) || 1,
        type: visibility as 'Private' | 'Public',
        description: description || undefined,
        price: visibility === 'Public' ? (parseFloat(strategyPrice) || 0) : 0,
      };

      const response = await strategyService.createStrategy(strategyData);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          'Strategy created successfully! You can now view it in the Saved Strategies tab.',
          [
            {
              text: 'View Strategy',
              onPress: () => {
                // Refresh strategies list
                fetchStrategies();
                // Switch to saved strategies tab
                setActiveTab('saved');
              }
            },
            {
              text: 'Create Another',
              style: 'cancel',
              onPress: () => {
                // Reset form for creating another strategy
                setStrategyName('');
                setDescription('');
                setMinimumCapital('');
                setQuantityValue('');
                setSymbol('');
                setStrategyPrice('');
                setVisibility('Private');
                // Still refresh in background
                fetchStrategies();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create strategy');
      }
    } catch (error: any) {
      console.error('Create strategy error:', error);
      Alert.alert('Error', error.message || 'Failed to create strategy');
    } finally {
      setIsCreating(false);
    }
  };

  // Save draft handler
  const handleSaveDraft = async () => {
    if (!strategyName.trim()) {
      Alert.alert('Error', 'Please enter a strategy name to save draft');
      return;
    }

    try {
      setIsSavingDraft(true);
      
      const draftData = {
        name: strategyName,
        segment: marketSegment,
        symbol: symbol,
        capital: minimumCapital,
        lots: quantityValue,
        visibility: visibility,
        description: description,
        strategyType: strategyType,
        conditionText: conditionText,
        // AI Builder data
        aiExchange: aiExchange,
        aiSymbol: aiSymbol,
        aiRunInterval: aiRunInterval,
        aiFromDate: aiFromDate,
        aiToDate: aiToDate,
        aiBuyCondition: aiBuyCondition,
        aiSellCondition: aiSellCondition,
        addedIndicators: addedIndicators,
      };

      const response = await strategyService.saveDraft(draftData);
      
      if (response.success) {
        Alert.alert('Success', 'Draft saved successfully!');
        fetchDrafts();
      } else {
        Alert.alert('Error', response.error || 'Failed to save draft');
      }
    } catch (error: any) {
      console.error('Save draft error:', error);
      Alert.alert('Error', error.message || 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Delete strategy handler
  const handleDeleteStrategy = async (strategyId: number) => {
    Alert.alert(
      'Delete Strategy',
      'Are you sure you want to delete this strategy?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await strategyService.deleteStrategy(strategyId);
              if (response.success) {
                Alert.alert('Success', 'Strategy deleted successfully');
                fetchStrategies();
              } else {
                Alert.alert('Error', response.error || 'Failed to delete strategy');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete strategy');
            }
          }
        }
      ]
    );
  };

  // Activate/Deactivate all strategies handler (optimistic update)
  const handlePauseAll = async () => {
    if (savedStrategies.length === 0) {
      Alert.alert('Info', 'No strategies to update');
      return;
    }

    // Determine if we should pause all or resume all based on pause state
    const anyNotPaused = savedStrategies.some(s => !s.isPaused);
    const intendedPaused = anyNotPaused; // if any strategy is not paused -> pause all; else resume all

    // Optimistically update local state so UI responds immediately
    setSavedStrategies(prev => prev.map(s => ({ ...s, isPaused: intendedPaused })));
    // Also update header state immediately so icon/text changes
    setHeaderAnyNotPaused(!intendedPaused);

    try {
      // Update each strategy's isPaused property on the server
      const promises = savedStrategies.map(strategy =>
        strategyService.updateStrategy(strategy.id, { isPaused: intendedPaused })
      );

      await Promise.all(promises);
      // Reset header state so it re-derives from fetched data
      setHeaderAnyNotPaused(null);
      fetchStrategies();
      Alert.alert('Success', intendedPaused ? 'All strategies paused successfully' : 'All strategies resumed successfully');
    } catch (error: any) {
      fetchStrategies();
      Alert.alert('Error', `Failed to update strategies: ${error.message}`);
    }
  };

  // View strategy handler
  const handleViewStrategy = async (strategy: any) => {
    setSelectedStrategy(strategy);
    try {
      if (apiKeys.length === 0) {
        const response = await apiKeyService.getApiKeys();
        if (response.success && response.data) setApiKeys(response.data);
      }
    } catch (error) {
      console.error('Error fetching api keys:', error);
    }
    setShowViewModal(true);
  };

  // Edit strategy handler
  const handleEditStrategy = (strategy: any) => {
    setSelectedStrategy(strategy);
    setEditName(strategy.name || '');
    setEditSegment(strategy.segment || 'Indian');
    setEditCapital(String(strategy.capital || ''));
    setEditSymbol(strategy.symbol || '');
    setEditSymbolValue(String(strategy.symbolValue || ''));
    setEditLots(String(strategy.lots || 1));
    setEditDescription(strategy.description || '');
    setEditIsActive(strategy.isActive ?? true);
    setEditIsPublic(strategy.isPublic ?? false);
    setEditPrice(String(strategy.price || ''));
    
    // Load marketRisk config if exists
    const marketRisk = strategy.marketRisk || {};
    setEditStrategyType(marketRisk.strategyType || 'Intraday');
    setEditInstrumentType(marketRisk.instrumentType || '');
    setEditMarketType(marketRisk.marketType || '');
    setEditOrderType(marketRisk.orderType || '');
    setEditQuantity(String(marketRisk.quantity || ''));
    setEditSlType(marketRisk.slType || 'Percent (%)');
    setEditSlValue(String(marketRisk.slValue || ''));
    setEditTpType(marketRisk.tpType || 'Percent (%)');
    setEditTpValue(String(marketRisk.tpValue || ''));
    setEditStopLossPercent(String(marketRisk.stopLossPercent || ''));
    setEditTargetPercent(String(marketRisk.targetPercent || ''));
    
    setShowEditModal(true);
  };

  // Save edit handler
  const handleSaveEdit = async () => {
    if (!selectedStrategy) return;
    
    try {
      const segmentMap: Record<string, 'Forex' | 'Crypto' | 'Indian'> = {
        'Forex': 'Forex',
        'Crypto': 'Crypto',
        'Indian': 'Indian',
        'Indian (Equity/F&O)': 'Indian',
        'Indian Market': 'Indian',
        'Cryptocurrency': 'Crypto',
      };
      
      // Only send fields that exist in the Strategy model
      const updateData: Record<string, any> = {
        name: editName,
        segment: segmentMap[editSegment] || 'Indian',
        capital: parseFloat(editCapital) || 10000,
        symbol: editSymbol,
        lots: parseFloat(editLots) || 1,
        description: editDescription,
        isActive: editIsActive,
        isPublic: editIsPublic,
        price: editIsPublic ? parseFloat(editPrice) || 0 : 0,
      };
      
      // Add symbolValue if provided
      if (editSymbolValue) {
        updateData.symbolValue = parseFloat(editSymbolValue) || 0;
      }
      
      // Store additional risk/market config in marketRisk JSON field
      const marketRiskConfig: Record<string, any> = {};
      if (editInstrumentType) marketRiskConfig.instrumentType = editInstrumentType;
      if (editMarketType) marketRiskConfig.marketType = editMarketType;
      if (editOrderType) marketRiskConfig.orderType = editOrderType;
      if (editQuantity) marketRiskConfig.quantity = parseFloat(editQuantity) || 0;
      if (editSlType) marketRiskConfig.slType = editSlType;
      if (editSlValue) marketRiskConfig.slValue = parseFloat(editSlValue) || 0;
      if (editTpType) marketRiskConfig.tpType = editTpType;
      if (editTpValue) marketRiskConfig.tpValue = parseFloat(editTpValue) || 0;
      if (editStopLossPercent) marketRiskConfig.stopLossPercent = parseFloat(editStopLossPercent) || 0;
      if (editTargetPercent) marketRiskConfig.targetPercent = parseFloat(editTargetPercent) || 0;
      if (editStrategyType) marketRiskConfig.strategyType = editStrategyType;
      
      if (Object.keys(marketRiskConfig).length > 0) {
        updateData.marketRisk = marketRiskConfig;
      }
      
      const response = await strategyService.updateStrategy(selectedStrategy.id, updateData);
      
      if (response.success) {
        Alert.alert('Success', 'Strategy updated successfully');
        setShowEditModal(false);
        fetchStrategies();
      } else {
        Alert.alert('Error', response.error || 'Failed to update strategy');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update strategy');
    }
  };

  // Broker selection handler
  const handleOpenBrokerModal = async (strategy: any) => {
    setSelectedStrategy(strategy);
    setSelectedBrokers([]);
    try {
      // Fetch all user's API keys
      const apiKeysResponse = await apiKeyService.getApiKeys();
      if (apiKeysResponse.success && apiKeysResponse.data) {
        setBrokers(apiKeysResponse.data);
      }
      
      // Fetch brokers already linked to this strategy
      const strategyBrokersResponse = await strategyBrokerService.getStrategyBrokers(strategy.id);
      if (strategyBrokersResponse.success && strategyBrokersResponse.data) {
        // Extract the apiKeyIds of linked brokers
        const linkedApiKeyIds = strategyBrokersResponse.data.map((sb: any) => sb.apiKeyId);
        setSelectedBrokers(linkedApiKeyIds);
      }
    } catch (error) {
      console.error('Error fetching brokers:', error);
    }
    setShowBrokerModal(true);
  };

  // Toggle broker selection
  const toggleBrokerSelection = (brokerId: number) => {
    setSelectedBrokers(prev => 
      prev.includes(brokerId) 
        ? prev.filter(id => id !== brokerId)
        : [...prev, brokerId]
    );
  };

  // Toggle trade mode - uses subscription endpoint like website
  const handleToggleTradeMode = async (strategy: any) => {
    const newMode = strategy.tradeMode === 'paper' ? 'live' : 'paper';
    const subscriptionId = strategy.subscriptionId;
    
    console.log(`[TradeMode Toggle] Strategy ${strategy.id}: ${strategy.tradeMode} -> ${newMode}, subscriptionId: ${subscriptionId}`);
    
    if (!subscriptionId) {
      Alert.alert('Error', 'No subscription found for this strategy');
      return;
    }
    
    // Optimistic UI update
    setSavedStrategies(prev => prev.map(s => 
      s.id === strategy.id ? { ...s, tradeMode: newMode } : s
    ));
    
    try {
      console.log(`[TradeMode Toggle] Calling setTradeMode API for subscription ${subscriptionId} with mode: ${newMode}`);
      const response = await strategyService.setTradeMode(subscriptionId, newMode);
      console.log(`[TradeMode Toggle] API Response:`, response);
      if (!response.success) {
        // Revert on error
        console.log(`[TradeMode Toggle] API returned error, reverting...`);
        setSavedStrategies(prev => prev.map(s => 
          s.id === strategy.id ? { ...s, tradeMode: strategy.tradeMode } : s
        ));
        Alert.alert('Error', response.error || 'Failed to update trade mode');
      } else {
        console.log(`[TradeMode Toggle] Success! Trade mode updated to ${newMode}`);
        // Refresh from server to ensure UI matches backend authoritative state
        try {
          await fetchStrategies();
        } catch (e) {
          console.log('[TradeMode Toggle] Warning: failed to refresh strategies after update', e);
        }
        // Show success message with backend text if available
        try {
          const successMsg = response?.message || `Trade Mode: ${newMode === 'live' ? 'Live' : 'Paper'}`;
          Alert.alert('Trade Mode', successMsg);
        } catch (e) {
          console.log('[TradeMode Toggle] Warning: failed to show success alert', e);
        }
      }
    } catch (error: any) {
      // Revert on error
      console.log(`[TradeMode Toggle] Exception occurred:`, error);
      setSavedStrategies(prev => prev.map(s => 
        s.id === strategy.id ? { ...s, tradeMode: strategy.tradeMode } : s
      ));
      Alert.alert('Error', error.message || 'Failed to update trade mode');
    }
  };

  // Optimistic toggle for single strategy active/inactive
  const toggleStrategyActive = async (strategyId: number, currentlyActive: boolean) => {
    const intendedActive = !currentlyActive;
    // optimistic UI
    setSavedStrategies(prev => prev.map(s => s.id === strategyId ? { ...s, isActive: intendedActive } : s));

    try {
      const response = await strategyService.updateStrategy(strategyId, { isActive: intendedActive });
      if (response && response.success) {
        Alert.alert('Success', intendedActive ? 'Strategy activated' : 'Strategy deactivated');
        fetchStrategies();
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error: any) {
      // revert on failure
      fetchStrategies();
      Alert.alert('Error', error?.message || 'Failed to update strategy');
    }
  };

  // Optimistic toggle for pause/resume (isPaused separate from isActive)
  const toggleStrategyPaused = async (strategyId: number, currentlyPaused: boolean) => {
    const intendedPaused = !currentlyPaused;
    // optimistic UI - update immediately
    setSavedStrategies(prev => prev.map(s => 
      s.id === strategyId ? { ...s, isPaused: intendedPaused, isStopped: intendedPaused, stopped: intendedPaused } : s
    ));

    try {
      const response = await strategyService.updateStrategy(strategyId, { isPaused: intendedPaused });
      if (response && response.success) {
        // Success message without Alert to avoid blocking UI
        console.log('✅ Strategy pause toggled:', intendedPaused ? 'paused' : 'resumed');
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error: any) {
      // revert on failure
      setSavedStrategies(prev => prev.map(s => 
        s.id === strategyId ? { ...s, isPaused: !intendedPaused, isStopped: !intendedPaused, stopped: !intendedPaused } : s
      ));
      Alert.alert('Error', error?.message || 'Failed to update pause status');
    }
  };

  // Copy webhook URL
  const copyWebhookUrl = async () => {
    await Clipboard.setStringAsync('https://app.uptrender.in/api/algo-trades/webhook');
    Alert.alert('Copied', 'Webhook URL copied to clipboard');
  };

  // Copy TradingView alert message
  const copyAlertMessage = async (webhookSecret: string) => {
    const message = `{ "secret": "${webhookSecret}", "signal": "{{strategy.position_size}}" }`;
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied', 'TradingView alert message copied to clipboard');
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Strategy Builder</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'ai-builder' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('ai-builder')}
        >
          <Sparkle size={18} color={activeTab === 'ai-builder' ? colors.primary : theme.textSecondary} weight={activeTab === 'ai-builder' ? 'fill' : 'regular'} />
          <Text style={[styles.tabText, { color: activeTab === 'ai-builder' ? colors.primary : theme.textSecondary }]}>
            AI Builder
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'create' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('create')}
        >
          <PlusCircle size={18} color={activeTab === 'create' ? colors.primary : theme.textSecondary} weight={activeTab === 'create' ? 'fill' : 'regular'} />
          <Text style={[styles.tabText, { color: activeTab === 'create' ? colors.primary : theme.textSecondary }]}>
            Create Strategy
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'saved' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('saved')}
        >
          <FloppyDisk size={18} color={activeTab === 'saved' ? colors.primary : theme.textSecondary} weight={activeTab === 'saved' ? 'fill' : 'regular'} />
          <Text style={[styles.tabText, { color: activeTab === 'saved' ? colors.primary : theme.textSecondary }]}>
            Saved
          </Text>
          {savedStrategies.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.tabBadgeText}>{savedStrategies.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'ai-builder' ? (
          <>
            {/* Main Content */}
            <View style={styles.mainContent}>
          {/* Configure Your AI Strategy */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <GearSix size={20} color={colors.primary} weight="duotone" />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Configure Your AI Strategy</Text>
            </View>

            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Market & Risk</Text>
              
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Segment</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setOpenDropdown(openDropdown === 'segment' ? null : 'segment')}
                  style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                >
                  <Text style={[styles.selectText, { color: theme.text }]}>{segment}</Text>
                  <CaretDown size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                {openDropdown === 'segment' && (
                  <View style={[styles.dropdown, { 
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                    shadowOpacity: isDark ? 0.4 : 0.15,
                  }]}> 
                    {SEGMENT_OPTIONS.map((opt, index) => (
                      <TouchableOpacity 
                        key={opt} 
                        style={[
                          styles.dropdownItem, 
                          { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                          index === SEGMENT_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                        ]} 
                        onPress={() => { setSegment(opt); setOpenDropdown(null); }}
                      >
                        <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Instrument</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setOpenDropdown(openDropdown === 'instrument' ? null : 'instrument')}
                  style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                >
                  <Text style={[styles.selectText, { color: instrument ? theme.text : theme.textSecondary }]}> {instrument || 'Select instrument'}</Text>
                  <CaretDown size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                {openDropdown === 'instrument' && (
                  <View style={[styles.dropdown, { 
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                    shadowOpacity: isDark ? 0.4 : 0.15,
                  }]}> 
                    {INSTRUMENT_OPTIONS.map((opt, index) => (
                      <TouchableOpacity 
                        key={opt} 
                        style={[
                          styles.dropdownItem, 
                          { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                          index === INSTRUMENT_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                        ]} 
                        onPress={() => { setInstrument(opt); setOpenDropdown(null); }}
                      >
                        <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Timeframe</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setOpenDropdown(openDropdown === 'timeframe' ? null : 'timeframe')}
                  style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                >
                  <Text style={[styles.selectText, { color: timeframe ? theme.text : theme.textSecondary }]}>{timeframe || 'Select timeframe'}</Text>
                  <CaretDown size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                {openDropdown === 'timeframe' && (
                  <View style={[styles.dropdown, { 
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                    shadowOpacity: isDark ? 0.4 : 0.15,
                  }]}> 
                    {TIMEFRAME_OPTIONS.map((opt, index) => (
                      <TouchableOpacity 
                        key={opt} 
                        style={[
                          styles.dropdownItem, 
                          { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                          index === TIMEFRAME_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                        ]} 
                        onPress={() => { setTimeframe(opt); setOpenDropdown(null); }}
                      >
                        <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Trading Type</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setOpenDropdown(openDropdown === 'tradingType' ? null : 'tradingType')}
                  style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                >
                  <Text style={[styles.selectText, { color: theme.text }]}>{tradingType}</Text>
                  <CaretDown size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                {openDropdown === 'tradingType' && (
                  <View style={[styles.dropdown, { 
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                    shadowOpacity: isDark ? 0.4 : 0.15,
                  }]}> 
                    {TRADING_TYPE_OPTIONS.map((opt, index) => (
                      <TouchableOpacity 
                        key={opt} 
                        style={[
                          styles.dropdownItem, 
                          { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                          index === TRADING_TYPE_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                        ]} 
                        onPress={() => { setTradingType(opt); setOpenDropdown(null); }}
                      >
                        <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text style={[styles.subsectionTitle, { color: theme.text, marginTop: 20 }]}>Quantity</Text>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>SL Type</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setOpenDropdown(openDropdown === 'slType' ? null : 'slType')}
                    style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  >
                    <Text style={[styles.selectText, { color: theme.text, fontSize: 13 }]}>{slType}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {openDropdown === 'slType' && (
                    <View style={[styles.dropdown, { 
                      borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                      shadowOpacity: isDark ? 0.4 : 0.15,
                    }]}> 
                      {SL_TP_TYPE_OPTIONS.map((opt, index) => (
                        <TouchableOpacity 
                          key={opt} 
                          style={[
                            styles.dropdownItem, 
                            { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                            index === SL_TP_TYPE_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                          ]} 
                          onPress={() => { setSlType(opt); setOpenDropdown(null); }}
                        >
                          <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>SL (%)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                    placeholder="Enter value"
                    placeholderTextColor={theme.textSecondary}
                    value={slValue}
                    onChangeText={(t) => setSlValue(filterNumeric(t))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>TP Type</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setOpenDropdown(openDropdown === 'tpType' ? null : 'tpType')}
                    style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  >
                    <Text style={[styles.selectText, { color: theme.text, fontSize: 13 }]}>{tpType}</Text>
                    <CaretDown size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {openDropdown === 'tpType' && (
                    <View style={[styles.dropdown, { 
                      borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                      shadowOpacity: isDark ? 0.4 : 0.15,
                    }]}> 
                      {SL_TP_TYPE_OPTIONS.map((opt, index) => (
                        <TouchableOpacity 
                          key={opt} 
                          style={[
                            styles.dropdownItem, 
                            { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                            index === SL_TP_TYPE_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                          ]} 
                          onPress={() => { setTpType(opt); setOpenDropdown(null); }}
                        >
                          <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>TP (%)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                    placeholder="Enter value"
                    placeholderTextColor={theme.textSecondary}
                    value={tpValue}
                    onChangeText={(t) => setTpValue(filterNumeric(t))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Capital Used (₹)</Text>
                <View style={[styles.inputWithPrefix, { backgroundColor: theme.inputBg, borderColor: theme.border }] }>
                  <Text style={[styles.prefix, { color: theme.text }]}>₹</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: 'transparent', borderColor: 'transparent', color: theme.text, flex: 1, paddingLeft: 0 }]}
                    placeholder="Enter capital amount"
                    placeholderTextColor={theme.textSecondary}
                    value={capitalUsed}
                    onChangeText={(t) => setCapitalUsed(filterNumeric(t))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

          {/* Visual Strategy Builder */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Visual Strategy Builder</Text>
            
            <Text style={[styles.subsectionTitle, { color: theme.text }]}>Basic Parameters</Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Exchange</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOpenDropdown(openDropdown === 'aiExchange' ? null : 'aiExchange')}
                style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
              >
                <Text style={[styles.selectText, { color: theme.text }]}>{aiExchange}</Text>
                <CaretDown size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              {openDropdown === 'aiExchange' && (
                <View style={[styles.dropdown, { 
                  borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                  shadowOpacity: isDark ? 0.4 : 0.15,
                }]}> 
                  {SEGMENT_OPTIONS.map((opt, index) => (
                    <TouchableOpacity 
                      key={opt} 
                      style={[
                        styles.dropdownItem, 
                        { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                        index === SEGMENT_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                      ]} 
                      onPress={() => { setAiExchange(opt); setOpenDropdown(null); }}
                    >
                      <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Symbol</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOpenDropdown(openDropdown === 'aiSymbol' ? null : 'aiSymbol')}
                style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
              >
                <Text style={[styles.selectText, { color: theme.text }]}>{aiSymbol}</Text>
                <CaretDown size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              {openDropdown === 'aiSymbol' && (
                <View style={[styles.dropdown, { 
                  borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                  shadowOpacity: isDark ? 0.4 : 0.15,
                }]}> 
                  {INSTRUMENT_OPTIONS.map((opt, index) => (
                    <TouchableOpacity 
                      key={opt} 
                      style={[
                        styles.dropdownItem, 
                        { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                        index === INSTRUMENT_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                      ]} 
                      onPress={() => { setAiSymbol(opt); setOpenDropdown(null); }}
                    >
                      <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Run Interval</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOpenDropdown(openDropdown === 'aiRunInterval' ? null : 'aiRunInterval')}
                style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
              >
                <Text style={[styles.selectText, { color: theme.text }]}>{aiRunInterval}</Text>
                <CaretDown size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              {openDropdown === 'aiRunInterval' && (
                <View style={[styles.dropdown, { 
                  borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                  shadowOpacity: isDark ? 0.4 : 0.15,
                }]}> 
                  {RUN_INTERVAL_OPTIONS.map((opt, index) => (
                    <TouchableOpacity 
                      key={opt} 
                      style={[
                        styles.dropdownItem, 
                        { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                        index === RUN_INTERVAL_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                      ]} 
                      onPress={() => { setAiRunInterval(opt); setOpenDropdown(null); }}
                    >
                      <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={[styles.subsectionTitle, { color: theme.text, marginTop: 20 }]}>Backtest Period</Text>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>From Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={theme.textSecondary}
                  value={aiFromDate}
                  onChangeText={setAiFromDate}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>To Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={theme.textSecondary}
                  value={aiToDate}
                  onChangeText={setAiToDate}
                />
              </View>
            </View>

            <Text style={[styles.subsectionTitle, { color: theme.text, marginTop: 20 }]}>Indicators</Text>

            <View style={styles.formGroup}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOpenDropdown(openDropdown === 'aiIndicator' ? null : 'aiIndicator')}
                style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
              >
                <Text style={[styles.selectText, { color: aiSelectedIndicator ? theme.text : theme.textSecondary }]}>
                  {aiSelectedIndicator || 'Select an Indicator to Add'}
                </Text>
                <CaretDown size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              {openDropdown === 'aiIndicator' && (
                <View style={[styles.dropdown, { borderColor: theme.border, backgroundColor: theme.surface, maxHeight: 250 }]}> 
                  <ScrollView showsVerticalScrollIndicator={true}>
                    {INDICATOR_OPTIONS.map((opt) => (
                      <TouchableOpacity key={opt} style={styles.dropdownItem} onPress={() => handleAddIndicator(opt)}>
                        <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {addedIndicators.length === 0 ? (
              <View style={[styles.infoBox, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                <Info size={18} color={colors.primary} weight="duotone" />
                <Text style={[styles.infoText, { color: colors.primary }]}>
                  No indicators added yet. Select from the dropdown above to add indicators.
                </Text>
              </View>
            ) : (
              <View style={styles.indicatorsListContainer}>
                {addedIndicators.map((indicator, index) => (
                  <View key={index} style={[styles.indicatorCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <View style={styles.indicatorCardHeader}>
                      <Text style={[styles.indicatorCardTitle, { color: theme.text }]}>{indicator.name}</Text>
                      <TouchableOpacity onPress={() => handleRemoveIndicator(index)}>
                        <Text style={[styles.indicatorRemoveBtn, { color: theme.textSecondary }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.indicatorCardDetail, { color: theme.textSecondary }]}>Inputs: {indicator.inputs || 'None'}</Text>
                    <Text style={[styles.indicatorCardDetail, { color: theme.textSecondary }]}>Outputs: {indicator.outputs}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.formGroup}>
              <View style={styles.conditionHeader}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Buy Condition</Text>
                <Text style={[styles.requiredLabel, { color: '#EF4444' }]}>*</Text>
                <View style={[styles.checkIcon, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              </View>
              <TextInput
                style={[styles.conditionInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g., close is greater than ema100 and roc is greater than 0"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={aiBuyCondition}
                onChangeText={setAiBuyCondition}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.conditionHeader}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Sell Condition</Text>
                <Text style={[styles.requiredLabel, { color: '#EF4444' }]}>*</Text>
                <View style={[styles.checkIcon, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              </View>
              <TextInput
                style={[styles.conditionInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g., close is less than ema100"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={aiSellCondition}
                onChangeText={setAiSellCondition}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.resetBtn, { borderColor: colors.primary }]}
              onPress={() => {
                setStrategyDescription('');
                setSelectedQuickSetup('');
              }}
            >
              <ArrowClockwise size={18} color={colors.primary} />
              <Text style={[styles.resetBtnText, { color: colors.primary }]}>Reset</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.backtestBtn,
                { backgroundColor: isBacktestEnabled ? colors.primary : theme.textSecondary, opacity: isBacktestEnabled ? 1 : 0.5 }
              ]}
              disabled={!isBacktestEnabled}
              onPress={() => {
                // placeholder backtest action
                console.log('Backtest started');
              }}
            >
              <Flask size={18} color="#fff" />
              <Text style={styles.backtestBtnText}>Backtest Now</Text>
            </TouchableOpacity>
          </View>

          {/* Summary removed as requested */}

          {/* AI Response */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>AI Response</Text>
            <Text style={[styles.aiResponseText, { color: theme.textSecondary }]}>
              AI responses and implementation messages will appear here.
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </>
        ) : activeTab === 'create' ? (
          <>
            {/* Create Strategy Content */}
            <View style={styles.createStrategyContainer}>
              {/* Left Column */}
              <View style={styles.createLeftCol}>
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 20 }]}>Create Strategy</Text>
                  
                  {/* Strategy Name */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Strategy Name</Text>
                      <Info size={14} color={theme.textSecondary} />
                    </View>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                      placeholder="e.g., Iron Condor Weekly"
                      placeholderTextColor={theme.textSecondary}
                      value={strategyName}
                      onChangeText={setStrategyName}
                    />
                  </View>

                  {/* Strategy Type */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Strategy Type</Text>
                      <Info size={14} color={theme.textSecondary} />
                    </View>
                    <View style={styles.checkboxRow}>
                      {['AI Builder', 'TradingView', 'Chartink', 'Python'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={styles.checkboxItem}
                          onPress={() => setStrategyType(type)}
                        >
                          {strategyType === type ? (
                            <CheckSquare size={20} color={colors.primary} weight="fill" />
                          ) : (
                            <Square size={20} color={theme.textSecondary} />
                          )}
                          <Text style={[styles.checkboxLabel, { color: theme.text }]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Strategy Type Specific Info */}
                  {strategyType === 'TradingView' && (
                    <View style={[styles.webhookBox, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.webhookTitle, { color: colors.primary }]}>Webhook URL</Text>
                      <Text style={[styles.webhookUrl, { color: colors.primary }]}>https://app.uptrender.in/api/algo-trades/webhook</Text>
                      
                      <Text style={[styles.webhookTitle, { color: colors.primary, marginTop: 16 }]}>TradingView Alert Message Format:</Text>
                      <Text style={[styles.codeText, { color: colors.primary }]}>
                        {'{ "secret": "YOUR_STRATEGY_SECRET", "signal": "{{{{strategy.position_size}}}}" }'}
                      </Text>
                      
                      <View style={[styles.warningBox, { backgroundColor: 'rgba(255,193,7,0.1)' }]}>
                        <Warning size={14} color="#FFC107" />
                        <Text style={[styles.warningText, { color: '#000' }]}>
                          Strategy secret will be generated after creation. All subscribers will receive trades automatically.
                        </Text>
                      </View>
                      
                      <Text style={[styles.helperText, { color: theme.text, marginTop: 8 }]}>
                        Use this URL to send trading signals from TradingView to your strategy
                      </Text>
                    </View>
                  )}

                  {strategyType === 'Chartink' && (
                    <View style={[styles.webhookBox, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.webhookTitle, { color: colors.primary }]}>Webhook URL</Text>
                      <Text style={[styles.webhookUrl, { color: colors.primary }]}>https://app.uptrender.in/api/algo-trades/webhook</Text>
                      
                      <Text style={[styles.helperText, { color: theme.text, marginTop: 12 }]}>
                        Use this URL to send trading signals from Chartink to your strategy
                      </Text>
                    </View>
                  )}

                  {strategyType === 'Python' && (
                    <View style={[styles.webhookBox, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.webhookTitle, { color: colors.primary }]}>Webhook URL</Text>
                      <Text style={[styles.webhookUrl, { color: colors.primary }]}>https://app.uptrender.in/api/algo-trades/webhook</Text>
                      
                      <Text style={[styles.helperText, { color: theme.text, marginTop: 12 }]}>
                        Use this URL to send trading signals from Python to your strategy
                      </Text>
                    </View>
                  )}

                  {/* Condition Builder - Only for AI Builder */}
                  {strategyType === 'AI Builder' && (
                    <View style={styles.formGroup}>
                      <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Condition Builder</Text>
                        <Info size={14} color={theme.textSecondary} />
                      </View>
                      <View style={styles.templateRow}>
                        {['Template 1', 'Template 2', 'Template 3', 'Template 4'].map((temp) => (
                          <TouchableOpacity 
                            key={temp}
                            style={[styles.templateBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                            onPress={() => {
                              switch (temp) {
                                case 'Template 1':
                                  setConditionText('Buy when 20 EMA crosses above 50 EMA; sell when 20 EMA crosses below 50 EMA');
                                  setSelectedQuickSetup('template1');
                                  break;
                                case 'Template 2':
                                  setConditionText('RSI < 30 enter long; exit when RSI > 50; SL 2%, TP 5%');
                                  setSelectedQuickSetup('template2');
                                  break;
                                case 'Template 3':
                                  setConditionText('Breakout: buy when price closes above previous day high; SL previous day low');
                                  setSelectedQuickSetup('template3');
                                  break;
                                case 'Template 4':
                                  setConditionText('Mean reversion: buy if price < BB lower band; TP middle band; SL 1.5%');
                                  setSelectedQuickSetup('template4');
                                  break;
                              }
                            }}
                          >
                            <Text style={[styles.templateText, { color: theme.textSecondary }]}>{temp}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[styles.resetBtnSmall, { borderColor: colors.primary }]}
                          onPress={() => {
                            setConditionText('');
                            setSelectedQuickSetup('');
                          }}
                        >
                          <ArrowClockwise size={14} color={colors.primary} />
                          <Text style={[styles.resetBtnText, { color: colors.primary }]}>Reset</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[styles.textarea, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, marginTop: 12 }]}
                        placeholder="Describe your strategy conditions, e.g., EMA crossovers, RSI thresholds, SL/TP rules, position sizing..."
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        value={conditionText}
                        onChangeText={setConditionText}
                      />
                      <View style={[styles.tipBox, { backgroundColor: colors.primaryBg, marginTop: 12 }]}>
                        <View style={styles.tipHeader}>
                          <Info size={14} color={colors.primary} weight="duotone" />
                          <Text style={[styles.tipTitle, { color: colors.primary }]}>
                            Be specific about entry/exit triggers, SL/TP levels (percent, points or amount), and position sizing.
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Market Segment */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Market Segment</Text>
                      <Info size={14} color={theme.textSecondary} />
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setOpenDropdown(openDropdown === 'marketSegment' ? null : 'marketSegment')}
                      style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                    >
                      <Text style={[styles.selectText, { color: marketSegment ? theme.text : theme.textSecondary }]}>
                        {marketSegment || 'Select segment'}
                      </Text>
                      <CaretDown size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {openDropdown === 'marketSegment' && (
                      <View style={[styles.dropdown, { 
                        borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                        shadowColor: isDark ? '#000' : '#000',
                        shadowOpacity: isDark ? 0.4 : 0.15,
                      }]}> 
                        {SEGMENT_OPTIONS.map((opt, index) => (
                          <TouchableOpacity 
                            key={opt} 
                            style={[
                              styles.dropdownItem, 
                              { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                              index === SEGMENT_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                            ]} 
                            onPress={() => { setMarketSegment(opt); setOpenDropdown(null); }}
                          >
                            <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Minimum Capital */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Minimum Capital</Text>
                      <Info size={14} color={theme.textSecondary} />
                    </View>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                      placeholder="e.g., 50000"
                      placeholderTextColor={theme.textSecondary}
                      value={minimumCapital}
                      onChangeText={setMinimumCapital}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.helperText, { color: theme.textSecondary }]}>Min ₹10,000</Text>
                  </View>

                  {/* Visibility */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Visibility</Text>
                      <Info size={14} color={theme.textSecondary} />
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setOpenDropdown(openDropdown === 'visibility' ? null : 'visibility')}
                      style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                    >
                      <Text style={[styles.selectText, { color: theme.text }]}>{visibility}</Text>
                      <CaretDown size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {openDropdown === 'visibility' && (
                      <View style={[styles.dropdown, { 
                        borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                        shadowColor: isDark ? '#000' : '#000',
                        shadowOpacity: isDark ? 0.4 : 0.15,
                      }]}> 
                        {['Private', 'Public'].map((opt, index) => (
                          <TouchableOpacity 
                            key={opt} 
                            style={[
                              styles.dropdownItem, 
                              { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                              index === 1 && { borderBottomWidth: 0 }
                            ]} 
                            onPress={() => { setVisibility(opt); setOpenDropdown(null); }}
                          >
                            <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Price (₹) - Only show when visibility is Public */}
                  {visibility === 'Public' && (
                    <View style={styles.formGroup}>
                      <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Price (₹)</Text>
                        <Info size={14} color={theme.textSecondary} />
                      </View>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                        placeholder="e.g., 499"
                        placeholderTextColor={theme.textSecondary}
                        value={strategyPrice}
                        onChangeText={(t) => setStrategyPrice(filterNumeric(t))}
                        keyboardType="numeric"
                      />
                      <Text style={[styles.helperText, { color: theme.textSecondary }]}>0 for free</Text>
                    </View>
                  )}

                  {/* Description */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
                      <Info size={14} color={theme.textSecondary} />
                    </View>
                    <TextInput
                      style={[styles.textarea, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, minHeight: 100 }]}
                      placeholder="Describe your strategy, entry/exit rules, risk management..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      value={description}
                      onChangeText={setDescription}
                    />
                    <Text style={[styles.helperText, { color: theme.textSecondary }]}>Min 10 characters</Text>
                  </View>
                </View>
              </View>

              {/* Right Column - Market & Risk */}
              <View style={styles.createRightCol}>
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 16 }]}>Market & Risk</Text>
                  
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Segment *</Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setOpenDropdown(openDropdown === 'marketSegment' ? null : 'marketSegment')}
                      style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                    >
                      <Text style={[styles.selectText, { color: marketSegment ? theme.text : theme.textSecondary }]}>
                        {marketSegment || 'Select Segment'}
                      </Text>
                      <CaretDown size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {openDropdown === 'marketSegment' && (
                      <View style={[styles.dropdown, { 
                        borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                        shadowOpacity: isDark ? 0.4 : 0.15,
                      }]}>
                        {['Cryptocurrency', 'Forex', 'Indian Market'].map((seg, index) => (
                          <TouchableOpacity 
                            key={seg} 
                            style={[
                              styles.dropdownItem, 
                              { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                              index === 2 && { borderBottomWidth: 0 }
                            ]} 
                            onPress={() => { 
                              setMarketSegment(seg); 
                              setOpenDropdown(null); 
                            }}
                          >
                            <Text style={[styles.dropdownText, { color: theme.text }]}>{seg}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {marketSegment && (
                    <>
                      {/* Instrument Type - for Crypto, Forex and Indian Market */}
                      {(marketSegment === 'Cryptocurrency' || marketSegment === 'Forex' || marketSegment === 'Indian Market') && (
                        <View style={styles.formGroup}>
                          <Text style={[styles.label, { color: theme.textSecondary }]}>Instrument Type *</Text>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setOpenDropdown(openDropdown === 'instrumentType' ? null : 'instrumentType')}
                            style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                          >
                            <Text style={[styles.selectText, { color: instrumentType ? theme.text : theme.textSecondary }]}>
                              {instrumentType || 'Select Instrument Type'}
                            </Text>
                            <CaretDown size={18} color={theme.textSecondary} />
                          </TouchableOpacity>
                          {openDropdown === 'instrumentType' && (
                            <View style={[styles.dropdown, { 
                              borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                              shadowOpacity: isDark ? 0.4 : 0.15,
                            }]}>
                              {(marketSegment === 'Cryptocurrency' 
                                ? ['Spot', 'Futures', 'Perpetual'] 
                                : marketSegment === 'Forex'
                                ? ['Spot', 'Forward', 'Options']
                                : ['Futures (F&O)', 'Cash (Equity)', 'Options (F&O)']
                              ).map((type, index, arr) => (
                                <TouchableOpacity 
                                  key={type} 
                                  style={[
                                    styles.dropdownItem, 
                                    { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                                    index === arr.length - 1 && { borderBottomWidth: 0 }
                                  ]} 
                                  onPress={() => { 
                                    setInstrumentType(type); 
                                    setOpenDropdown(null); 
                                  }}
                                >
                                  <Text style={[styles.dropdownText, { color: theme.text }]}>{type}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Symbol */}
                      <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Symbol *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                          placeholder={
                            marketSegment === 'Cryptocurrency' ? 'e.g., BTCUSDT, ETHUSDT' :
                            marketSegment === 'Forex' ? 'e.g., EURUSD, GBPUSD' :
                            'e.g., NIFTY, BANKNIFTY, RELIANCE'
                          }
                          placeholderTextColor={theme.textSecondary}
                          value={symbol}
                          onChangeText={setSymbol}
                        />
                      </View>

                      {/* Market Type - for Indian only */}
                      {marketSegment === 'Indian Market' && (
                        <View style={styles.formGroup}>
                          <Text style={[styles.label, { color: theme.textSecondary }]}>Market Type *</Text>
                          <View style={styles.segmentBtnRow}>
                            {['Intraday', 'Carry'].map((type) => (
                              <TouchableOpacity
                                key={type}
                                style={[
                                  styles.segmentBtn,
                                  { borderColor: colors.primary },
                                  marketType === type && { backgroundColor: colors.primary }
                                ]}
                                onPress={() => setMarketType(type)}
                              >
                                <Text style={[
                                  styles.segmentBtnText,
                                  { color: marketType === type ? '#fff' : colors.primary }
                                ]}>
                                  {type}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Order Type */}
                      <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Order Type *</Text>
                        <View style={styles.orderTypeRow}>
                          {[{ label: 'Buy', color: '#10B981' }, { label: 'Sell', color: '#EF4444' }, { label: 'Auto', color: colors.primary }].map((type) => (
                            <TouchableOpacity
                              key={type.label}
                              style={[
                                styles.orderTypeBtn,
                                { borderColor: type.color },
                                orderType === type.label && { backgroundColor: type.color },
                              ]}
                              onPress={() => setOrderType(type.label)}
                            >
                              <Text style={[
                                styles.orderTypeBtnText,
                                { color: orderType === type.label ? '#fff' : type.color }
                              ]}>
                                {type.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Quantity */}
                      <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Quantity</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                          placeholder="Quantity"
                          placeholderTextColor={theme.textSecondary}
                          value={quantityValue}
                          onChangeText={(t) => setQuantityValue(filterNumeric(t))}
                          keyboardType="decimal-pad"
                        />
                      </View>

                      {/* Risk Management */}
                      <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 8 }]}>Risk Management</Text>
                        <View style={styles.row}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={[styles.label, { color: theme.textSecondary, fontSize: 12 }]}>SL Type</Text>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => setOpenDropdown(openDropdown === 'slTypeMarket' ? null : 'slTypeMarket')}
                              style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                            >
                              <Text style={[styles.selectText, { color: theme.text, fontSize: 13 }]}>{slType}</Text>
                              <CaretDown size={14} color={theme.textSecondary} />
                            </TouchableOpacity>
                            {openDropdown === 'slTypeMarket' && (
                              <View style={[styles.dropdown, { 
                                borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                                shadowOpacity: isDark ? 0.4 : 0.15,
                              }]}> 
                                {SL_TP_TYPE_OPTIONS.map((opt, index) => (
                                  <TouchableOpacity 
                                    key={opt} 
                                    style={[
                                      styles.dropdownItem, 
                                      { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                                      index === SL_TP_TYPE_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                                    ]} 
                                    onPress={() => { setSlType(opt); setOpenDropdown(null); }}
                                  >
                                    <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.label, { color: theme.textSecondary, fontSize: 12 }]}>SL (%)</Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                              placeholder="SL (%)"
                              placeholderTextColor={theme.textSecondary}
                              value={slValue}
                              onChangeText={setSlValue}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>

                        <View style={[styles.row, { marginTop: 12 }]}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={[styles.label, { color: theme.textSecondary, fontSize: 12 }]}>TP Type</Text>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => setOpenDropdown(openDropdown === 'tpTypeMarket' ? null : 'tpTypeMarket')}
                              style={[styles.select, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                            >
                              <Text style={[styles.selectText, { color: theme.text, fontSize: 13 }]}>{tpType}</Text>
                              <CaretDown size={14} color={theme.textSecondary} />
                            </TouchableOpacity>
                            {openDropdown === 'tpTypeMarket' && (
                              <View style={[styles.dropdown, { 
                                borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.border, 
                                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.surface,
                                shadowOpacity: isDark ? 0.4 : 0.15,
                              }]}> 
                                {SL_TP_TYPE_OPTIONS.map((opt, index) => (
                                  <TouchableOpacity 
                                    key={opt} 
                                    style={[
                                      styles.dropdownItem, 
                                      { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(200, 200, 200, 0.3)' },
                                      index === SL_TP_TYPE_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                                    ]} 
                                    onPress={() => { setTpType(opt); setOpenDropdown(null); }}
                                  >
                                    <Text style={[styles.dropdownText, { color: theme.text }]}>{opt}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.label, { color: theme.textSecondary, fontSize: 12 }]}>TP (%)</Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                              placeholder="TP (%)"
                              placeholderTextColor={theme.textSecondary}
                              value={tpValue}
                              onChangeText={setTpValue}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* Action Buttons at Bottom */}
            <View style={[styles.bottomActionButtons, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
              <TouchableOpacity 
                style={[styles.bottomCancelBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
                onPress={handleSaveDraft}
                disabled={isSavingDraft}
              >
                {isSavingDraft ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Text style={[styles.bottomCancelBtnText, { color: theme.text }]}>Save Draft</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.bottomSubmitBtn, { backgroundColor: colors.primary, opacity: isCreating ? 0.7 : 1 }]}
                onPress={handleCreateStrategy}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.bottomSubmitBtnText}>Create Strategy</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 100 }} />
          </>
        ) : (
          <>
            {/* Saved Strategies Content */}
            <View style={styles.savedStrategiesContainer}>
              <View style={styles.savedStrategiesHeader}>
                <TouchableOpacity 
                  style={[styles.smallActionBtn, { 
                    borderColor: effectiveHeaderHasAnyActive ? '#F59E0B' : '#10B981',
                    backgroundColor: effectiveHeaderHasAnyActive ? '#F59E0B15' : '#10B98115',
                    opacity: savedStrategies.length === 0 ? 0.5 : 1
                  }]}
                  onPress={handlePauseAll}
                  disabled={savedStrategies.length === 0}
                >
                  {effectiveHeaderHasAnyActive ? (
                    <Pause size={14} color="#F59E0B" weight="fill" />
                  ) : (
                    <Play size={14} color="#10B981" weight="fill" />
                  )}
                  <Text style={[styles.smallActionBtnText, { color: effectiveHeaderHasAnyActive ? '#F59E0B' : '#10B981' }]}> 
                    {effectiveHeaderHasAnyActive ? 'Pause All' : 'Activate All'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.smallActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setActiveTab('create')}
                >
                  <PlusCircle size={14} color="#FFFFFF" weight="bold" />
                  <Text style={[styles.smallActionBtnText, { color: '#FFFFFF' }]}>New Strategy</Text>
                </TouchableOpacity>
              </View>

              {/* Strategy Cards */}
              <View style={styles.strategyCardsContainer}>
                {isLoading ? (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary, marginTop: 16 }]}>Loading strategies...</Text>
                  </View>
                ) : savedStrategies.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <FloppyDisk size={48} color={theme.textSecondary} weight="duotone" />
                    <Text style={[styles.emptyStateText, { color: theme.text, marginTop: 16 }]}>No Strategies Yet</Text>
                    <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary, marginTop: 8 }]}>
                      Create your first strategy to get started with automated trading.
                    </Text>
                    <TouchableOpacity 
                      style={[styles.emptyStateBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                      onPress={() => setActiveTab('create')}
                    >
                      <Text style={styles.emptyStateBtnText}>Create Strategy</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                  {savedStrategies.slice(0, savedStrategiesVisibleCount).map((strategy) => (
                    <View key={strategy.id} style={[styles.compactStrategyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      {/* Header Row with Name & Status Toggle */}
                      <View style={styles.compactCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.compactCardTitle, { color: theme.text }]} numberOfLines={1}>{strategy.name}</Text>
                          <Text style={[styles.compactCardSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                            {strategy.description || strategy.symbol || 'No description'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {/* Active/Inactive Status Toggle */}
                          <Switch
                            value={strategy.isActive}
                            onValueChange={() => toggleStrategyActive(strategy.id, strategy.isActive)}
                            trackColor={{ false: '#D1D5DB', true: '#a9ebf4ff' }}
                            thumbColor={strategy.isActive ? '#19bacfff' : '#9CA3AF'}
                            style={{ transform: [{ scaleX: 0.65 }, { scaleY: 0.75 }] }}
                          />
                          <Text style={[styles.compactBadgeText, { color: strategy.isActive ? '#10B981' : '#F59E0B', fontWeight: '600' }]}>
                            {strategy.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Detail Row - Lots (editable), Expiry, Created */}
                      <View style={styles.compactDetailGrid}>
                        <View style={[styles.compactDetailRow, { alignItems: 'center' }]}>
                          <View style={styles.compactDetailItem}>
                            <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Lots</Text>
                            <View style={[styles.lotsInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                              <TextInput
                                style={[styles.lotsInput, { color: theme.text }]}
                                defaultValue={String(strategy.lots || 1)}
                                keyboardType="numeric"
                                onEndEditing={async (e) => {
                                  const text = e.nativeEvent.text;
                                  const newLots = parseFloat(text) || 1;
                                  if (newLots !== strategy.lots) {
                                    try {
                                      await strategyService.updateStrategy(strategy.id, { lots: newLots });
                                      fetchStrategies();
                                    } catch (error) {
                                      console.error('Failed to update lots:', error);
                                    }
                                  }
                                }}
                              />
                            </View>
                          </View>
                          <View style={styles.compactDetailItem}>
                            <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Expiry</Text>
                            <Text style={[styles.compactDetailValue, { color: theme.text }]}>N/A</Text>
                          </View>
                          <View style={styles.compactDetailItem}>
                            <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Created At</Text>
                            <Text style={[styles.compactDetailValue, { color: theme.text }]}>
                              {new Date(strategy.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Action Buttons Row - Matches web: Eye, Pause/Play, Edit, Delete, Bank, Paper text, Toggle, Live text, Link */}
                      <View style={styles.compactCardFooter}>
                        {/* View */}
                        <TouchableOpacity 
                          style={[styles.compactActionBtn, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}
                          onPress={() => handleViewStrategy(strategy)}
                        >
                          <Eye size={14} color={colors.primary} weight="bold" />
                        </TouchableOpacity>
                        
                        {/* Pause/Resume - icon follows header state:
                            Header "Pause All" (effectiveHeaderHasAnyActive true) → show Play icon on card
                            Header "Active All" (effectiveHeaderHasAnyActive false) → show Pause icon on card */}
                        <TouchableOpacity 
                          style={[styles.compactActionBtn, { backgroundColor: strategy.isPaused ? '#FEF3C7' : '#D1FAE5' }]}
                          onPress={() => toggleStrategyPaused(strategy.id, strategy.isPaused)}
                        >
                          {strategy.isPaused ? (
                            <Play size={14} color="#F59E0B" weight="fill" />
                          ) : (
                            <Pause size={14} color="#10B981" weight="fill" />
                          )}
                        </TouchableOpacity>
                        
                        {/* Edit */}
                        <TouchableOpacity 
                          style={[styles.compactActionBtn, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}
                          onPress={() => handleEditStrategy(strategy)}
                        >
                          <PencilSimple size={14} color={colors.primary} weight="bold" />
                        </TouchableOpacity>
                        
                        {/* Delete */}
                        <TouchableOpacity 
                          style={[styles.compactActionBtn, { backgroundColor: '#FEE2E2' }]}
                          onPress={() => handleDeleteStrategy(strategy.id)}
                        >
                          <Trash size={14} color="#DC2626" weight="bold" />
                        </TouchableOpacity>
                        
                        {/* Broker */}
                        <TouchableOpacity 
                          style={[styles.compactActionBtn, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}
                          onPress={() => handleOpenBrokerModal(strategy)}
                        >
                          <Bank size={14} color={colors.primary} weight="bold" />
                        </TouchableOpacity>
                        
                        {/* Paper/Live Toggle Section */}
                        <View style={styles.tradeModeSection}>
                          <Text style={[styles.tradeModeLabel, { color: strategy.tradeMode === 'paper' ? colors.primary : theme.textSecondary }]}>Paper</Text>
                          <Switch
                            value={strategy.tradeMode === 'live'}
                            onValueChange={() => handleToggleTradeMode(strategy)}
                            trackColor={{ false: '#93C5FD', true: '#6EE7B7' }}
                            thumbColor={strategy.tradeMode === 'live' ? '#10B981' : colors.primary}
                            style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }], marginHorizontal: 4 }}
                          />
                          <Text style={[styles.tradeModeLabel, { color: strategy.tradeMode === 'live' ? '#10B981' : theme.textSecondary }]}>Live</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {/* Load More Button for Saved Strategies */}
                  {savedStrategies.length > savedStrategiesVisibleCount && (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={() => setSavedStrategiesVisibleCount(prev => prev + 8)}
                    >
                      <LinearGradient
                        colors={isDark ? ['rgba(99, 102, 241, 0.35)', 'rgba(139, 92, 246, 0.25)', 'rgba(59, 130, 246, 0.2)'] : ['rgba(99, 102, 241, 0.25)', 'rgba(139, 92, 246, 0.18)', 'rgba(59, 130, 246, 0.12)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.loadMoreGradient}
                      >
                        <Text style={[styles.loadMoreBtnText, { color: isDark ? '#a5b4fc' : colors.primary }]}>Load More</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  </>
                )}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </>
        )}

        {/* View Strategy Modal */}
        <Modal
          visible={showViewModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowViewModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>{selectedStrategy?.name?.charAt(0) || 'S'}</Text>
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedStrategy?.name || 'Strategy'}</Text>
                    <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Strategy Details</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowViewModal(false)}>
                  <X size={22} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
              </View>
              
              {selectedStrategy && (
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Status Badges */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    <View style={[styles.statusPill, { backgroundColor: selectedStrategy.isActive ? '#D1FAE5' : '#FEE2E2' }]}>
                      <Text style={[styles.statusPillText, { color: selectedStrategy.isActive ? '#059669' : '#DC2626' }]}>
                        {selectedStrategy.isActive ? 'Active' : 'Stopped'}
                      </Text>
                    </View>
                    {selectedStrategy.isPublic && (
                      <View style={[styles.statusPill, { backgroundColor: '#DBEAFE' }]}>
                        <Text style={[styles.statusPillText, { color: colors.primary }]}>Public</Text>
                      </View>
                    )}
                    <View style={[styles.statusPill, { backgroundColor: selectedStrategy.tradeMode === 'paper' ? '#FEF3C7' : '#D1FAE5' }]}>
                      <Text style={[styles.statusPillText, { color: selectedStrategy.tradeMode === 'paper' ? '#D97706' : '#059669' }]}>
                        {selectedStrategy.tradeMode === 'paper' ? 'Paper Mode' : 'Live Mode'}
                      </Text>
                    </View>
                  </View>

                  {/* Basic Information Section */}
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>Basic Information</Text>
                  <View style={[styles.infoSection, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Segment</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.segment || 'N/A'}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Type</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.strategyType || 'Intraday'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>API</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>
                          {(() => {
                            const matched = apiKeys.filter((a: any) => selectedStrategy?.brokers?.includes(a.id));
                            return matched.length ? matched.map((a: any) => a.name || a.broker || `#${a.id}`).join(', ') : 'N/A';
                          })()}
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Broker</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>
                          {(() => {
                            const matched = apiKeys.filter((a: any) => selectedStrategy?.brokers?.includes(a.id));
                            const names = matched.map((a: any) => a.broker).filter(Boolean);
                            return names.length ? Array.from(new Set(names)).join(', ') : 'N/A';
                          })()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Capital</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>₹{Number(selectedStrategy.capital || 0).toLocaleString()}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Symbol</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.symbol || 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Lots/Quantity</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.lots || selectedStrategy.quantity || 1}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Symbol Value</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.symbolValue || 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Created At</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>
                          {new Date(selectedStrategy.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Last Updated</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>
                          {new Date(selectedStrategy.updatedAt || selectedStrategy.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Market & Risk Section */}
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>Market & Risk</Text>
                  <View style={[styles.infoSection, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Instrument</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.marketRisk?.instrumentType || 'N/A'}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Market Type</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.marketRisk?.marketType || 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Order Type</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.marketRisk?.orderType || 'N/A'}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>SL</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.marketRisk?.slValue || 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>TP</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.marketRisk?.tpValue || 'N/A'}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Stop Loss %</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.marketRisk?.stopLossPercent || 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Target %</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.marketRisk?.targetPercent || 'N/A'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Author & Performance */}
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>Author & Performance</Text>
                  <View style={[styles.infoSection, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Author</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.author?.name || 'N/A'}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Performance</Text>
                        <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.performance ?? 'N/A'}</Text>
                      </View>
                    </View>
                    {selectedStrategy.stats && (
                      <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                          <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Total Trades</Text>
                          <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.stats.totalTrades ?? 'N/A'}</Text>
                        </View>
                        <View style={styles.infoItem}>
                          <Text style={[styles.infoItemLabel, { color: theme.textSecondary }]}>Win Rate</Text>
                          <Text style={[styles.infoItemValue, { color: theme.text }]}>{selectedStrategy.stats.winRate ? `${selectedStrategy.stats.winRate}%` : 'N/A'}</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Description */}
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>Description</Text>
                  <View style={[styles.infoSection, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
                      {selectedStrategy.description || 'No description provided'}
                    </Text>
                  </View>

                  {/* Webhook Configuration */}
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>Webhook Configuration</Text>
                  <View style={[styles.webhookBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                    <Text style={[styles.webhookLabel, { color: theme.textSecondary }]}>Webhook URL:</Text>
                    <View style={styles.webhookUrlContainer}>
                      <Text style={[styles.webhookUrlText, { color: '#047857' }]} numberOfLines={1}>
                        https://app.uptrender.in/api/algo-trades/webhook
                      </Text>
                      <TouchableOpacity onPress={copyWebhookUrl}>
                        <Copy size={16} color="#047857" weight="bold" />
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={[styles.webhookLabel, { color: theme.textSecondary, marginTop: 12 }]}>TradingView Alert Message Format:</Text>
                    <View style={[styles.codeBox, { backgroundColor: '#D1FAE5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                      <Text style={[styles.codeText, { color: '#065F46', flex: 1 }]}>{`{ "secret": "${selectedStrategy?.webhookSecret || 'LOADING...'}", "signal": "{{strategy.position_size}}" }`}</Text>
                      <TouchableOpacity onPress={() => selectedStrategy?.webhookSecret && copyAlertMessage(selectedStrategy.webhookSecret)}>
                        <Copy size={16} color="#047857" weight="bold" />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.webhookHint, { color: '#059669' }]}>
                      ✓ Copy this exact message to TradingView alert
                    </Text>
                  </View>
                </ScrollView>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalFooterBtn, { borderColor: '#DC2626', borderWidth: 1 }]}
                  onPress={async () => {
                    if (selectedStrategy) {
                      try {
                        const response = selectedStrategy.isActive 
                          ? await strategyService.deactivateStrategy(selectedStrategy.id)
                          : await strategyService.activateStrategy(selectedStrategy.id);
                        if (response.success) {
                          Alert.alert('Success', selectedStrategy.isActive ? 'Strategy stopped' : 'Strategy started');
                          fetchStrategies();
                          setShowViewModal(false);
                        }
                      } catch (error) {
                        Alert.alert('Error', 'Failed to update strategy');
                      }
                    }
                  }}
                >
                  <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 13 }}>
                    {selectedStrategy?.isActive ? 'Stop Strategy' : 'Start Strategy'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalFooterBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowViewModal(false);
                    if (selectedStrategy) handleEditStrategy(selectedStrategy);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Edit Strategy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalFooterBtn, { borderColor: theme.border, borderWidth: 1 }]}
                  onPress={() => setShowViewModal(false)}
                >
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Strategy Modal */}
        <Modal
          visible={showEditModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Strategy</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <X size={22} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Row 1: Name, Segment, Type, Capital */}
                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1.5 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Strategy Name *</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Demo"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Segment</Text>
                    <TouchableOpacity 
                      style={[styles.editSelect, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setShowSegmentDropdown(!showSegmentDropdown)}
                    >
                      <Text style={[styles.editSelectText, { color: theme.text }]}>{editSegment || 'Indian (Equity/F&O)'}</Text>
                      <CaretDown size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {showSegmentDropdown && (
                      <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        {['Crypto', 'Forex', 'Indian (Equity/F&O)'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[styles.dropdownItem, { backgroundColor: editSegment === option ? theme.background : 'transparent' }]}
                            onPress={() => {
                              setEditSegment(option);
                              setShowSegmentDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Strategy Type</Text>
                    <TouchableOpacity 
                      style={[styles.editSelect, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setShowStrategyTypeDropdown(!showStrategyTypeDropdown)}
                    >
                      <Text style={[styles.editSelectText, { color: theme.text }]}>{editStrategyType || 'Intraday'}</Text>
                      <CaretDown size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {showStrategyTypeDropdown && (
                      <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        {['Intraday', 'Positional', 'BTST', 'Swing'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[styles.dropdownItem, { backgroundColor: editStrategyType === option ? theme.background : 'transparent' }]}
                            onPress={() => {
                              setEditStrategyType(option);
                              setShowStrategyTypeDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Capital *</Text>
                    <View style={[styles.editInputWithPrefix, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.editPrefix, { color: theme.textSecondary }]}>₹</Text>
                      <TextInput
                        style={[styles.editInputNoBorder, { color: theme.text, flex: 1 }]}
                        value={editCapital}
                        onChangeText={setEditCapital}
                        placeholder="10000"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>

                {/* Row 2: Symbol, Symbol Value, Lots */}
                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Symbol *</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editSymbol}
                      onChangeText={setEditSymbol}
                      placeholder="NIFTY"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Symbol Value</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editSymbolValue}
                      onChangeText={setEditSymbolValue}
                      placeholder="Symbol Value"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                  <View style={[styles.editFormGroup, { flex: 0.7 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Lots</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editLots}
                      onChangeText={setEditLots}
                      placeholder="1"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Description */}
                <View style={styles.editFormGroup}>
                  <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Description</Text>
                  <TextInput
                    style={[styles.editInput, styles.editTextArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Enter description..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* Market & Risk Configuration */}
                <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 8 }]}>Market & Risk Configuration</Text>
                
                {/* Row 1: Instrument Type & Market Type */}
                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Instrument Type</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editInstrumentType}
                      onChangeText={setEditInstrumentType}
                      placeholder="Instrument Type"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Market Type</Text>
                    <TouchableOpacity 
                      style={[styles.editSelect, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setShowMarketTypeDropdown(!showMarketTypeDropdown)}
                    >
                      <Text style={[styles.editSelectText, { color: theme.text }]}>{editMarketType || 'Intraday'}</Text>
                      <CaretDown size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {showMarketTypeDropdown && (
                      <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        {['Intraday', 'Carry'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[styles.dropdownItem, { backgroundColor: editMarketType === option ? theme.background : 'transparent' }]}
                            onPress={() => {
                              setEditMarketType(option);
                              setShowMarketTypeDropdown(false);
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
                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Order Type</Text>
                    <TouchableOpacity 
                      style={[styles.editSelect, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setShowOrderTypeDropdown(!showOrderTypeDropdown)}
                    >
                      <Text style={[styles.editSelectText, { color: theme.text }]}>{editOrderType || 'Buy'}</Text>
                      <CaretDown size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {showOrderTypeDropdown && (
                      <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        {['Buy', 'Sell'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[styles.dropdownItem, { backgroundColor: editOrderType === option ? theme.background : 'transparent' }]}
                            onPress={() => {
                              setEditOrderType(option);
                              setShowOrderTypeDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Quantity</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editQuantity}
                      onChangeText={setEditQuantity}
                      placeholder="Quantity"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Row 3: SL Type & SL Value */}
                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>SL Type</Text>
                    <TouchableOpacity 
                      style={[styles.editSelect, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setShowSlTypeDropdown(!showSlTypeDropdown)}
                    >
                      <Text style={[styles.editSelectText, { color: theme.text }]}>{editSlType}</Text>
                      <CaretDown size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {showSlTypeDropdown && (
                      <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        {['Percent (%)', 'Points/Value', 'Amount (₹)'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[styles.dropdownItem, { backgroundColor: editSlType === option ? theme.background : 'transparent' }]}
                            onPress={() => {
                              setEditSlType(option);
                              setShowSlTypeDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>SL Value</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editSlValue}
                      onChangeText={setEditSlValue}
                      placeholder="SL Value"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Row 4: TP Type & TP Value */}
                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>TP Type</Text>
                    <TouchableOpacity 
                      style={[styles.editSelect, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setShowTpTypeDropdown(!showTpTypeDropdown)}
                    >
                      <Text style={[styles.editSelectText, { color: theme.text }]}>{editTpType}</Text>
                      <CaretDown size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {showTpTypeDropdown && (
                      <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        {['Percent (%)', 'Points/Value', 'Amount (₹)'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[styles.dropdownItem, { backgroundColor: editTpType === option ? theme.background : 'transparent' }]}
                            onPress={() => {
                              setEditTpType(option);
                              setShowTpTypeDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: theme.text }]}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>TP Value</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editTpValue}
                      onChangeText={setEditTpValue}
                      placeholder="TP Value"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Row 5: Stop Loss % & Target % */}

                <View style={styles.editRow}>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Stop Loss %</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editStopLossPercent}
                      onChangeText={setEditStopLossPercent}
                      placeholder="Stop Loss %"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1 }]}>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Target %</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editTargetPercent}
                      onChangeText={setEditTargetPercent}
                      placeholder="Target %"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Toggles */}
                <View style={styles.togglesRow}>
                  <View style={styles.toggleItem}>
                    <Text style={[styles.toggleLabel, { color: theme.text }]}>Active</Text>
                    <Switch
                      value={editIsActive}
                      onValueChange={setEditIsActive}
                      trackColor={{ false: '#D1D5DB', true: '#6EE7B7' }}
                      thumbColor={editIsActive ? '#059669' : '#f4f3f4'}
                    />
                  </View>
                  <View style={styles.toggleItem}>
                    <Text style={[styles.toggleLabel, { color: theme.text }]}>Public</Text>
                    <Switch
                      value={editIsPublic}
                      onValueChange={setEditIsPublic}
                      trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                      thumbColor={editIsPublic ? colors.primary : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* Price if Public */}
                {editIsPublic && (
                  <View style={styles.editFormGroup}>
                    <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 8, marginBottom: 4 }]}>Pricing Settings</Text>
                    <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Subscription Price (₹)</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      placeholder="10.00"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.editHint, { color: theme.textSecondary, fontSize: 12, marginTop: 4 }]}>0 or empty for free subscription</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={[styles.modalCancelBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSaveBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Broker Selection Modal */}
        <Modal
          visible={showBrokerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBrokerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Bank size={22} color={colors.primary} weight="duotone" />
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Select Brokers for Strategy</Text>
                </View>
                <TouchableOpacity onPress={() => setShowBrokerModal(false)}>
                  <X size={22} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Strategy Info */}
                {selectedStrategy && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.brokerStrategyName, { color: theme.text }]}>Strategy: <Text style={{ fontWeight: '700' }}>{selectedStrategy.name}</Text></Text>
                    <Text style={[styles.brokerStrategyHint, { color: theme.textSecondary }]}>
                      Select which brokers/API keys should be used for this strategy
                    </Text>
                  </View>
                )}

                {/* Selection Count & Select All */}
                <View style={styles.brokerSelectionHeader}>
                  <Text style={[styles.brokerCountText, { color: theme.textSecondary }]}>
                    {selectedBrokers.length} of {brokers.length} broker(s) selected
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      if (selectedBrokers.length === brokers.length) {
                        setSelectedBrokers([]);
                      } else {
                        setSelectedBrokers(brokers.map(b => b.id));
                      }
                    }}
                  >
                    <Text style={[styles.selectAllText, { color: colors.primary }]}>
                      {selectedBrokers.length === brokers.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Broker List */}
                {brokers.length === 0 ? (
                  <View style={[styles.noBrokersMessage, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Bank size={32} color={theme.textSecondary} weight="duotone" />
                    <Text style={[styles.noBrokersText, { color: theme.textSecondary }]}>No brokers connected</Text>
                    <Text style={[styles.noBrokersHint, { color: theme.textSecondary }]}>
                      Connect a broker in Settings to enable live trading
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.brokerListContainer, { borderColor: theme.border }]}>
                    {brokers.map((broker, index) => (
                      <TouchableOpacity
                        key={broker.id}
                        style={[
                          styles.brokerListItem,
                          index !== brokers.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                        ]}
                        onPress={() => toggleBrokerSelection(broker.id)}
                      >
                        <View style={[
                          styles.brokerCheckboxSquare,
                          { borderColor: selectedBrokers.includes(broker.id) ? colors.primary : theme.border }
                        ]}>
                          {selectedBrokers.includes(broker.id) && (
                            <View style={[styles.brokerCheckboxInner, { backgroundColor: colors.primary }]} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.brokerItemName, { color: theme.text }]}>{broker.name || broker.broker}</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <View style={[styles.brokerBadge, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                              <Text style={[styles.brokerBadgeText, { color: '#374151' }]}>{broker.broker}</Text>
                            </View>
                            <View style={[styles.brokerBadge, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                              <Text style={[styles.brokerBadgeText, { color: colors.primary }]}>{broker.segment || 'Crypto'}</Text>
                            </View>
                            {broker.clientId && (
                              <Text style={[styles.brokerIdText, { color: theme.textSecondary }]}>ID: {broker.clientId}</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowBrokerModal(false)}
                >
                  <Text style={[styles.modalCancelBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSaveBtn, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    if (!selectedStrategy) return;
                    try {
                      // Use bulk update API to save broker selections
                      const response = await strategyBrokerService.updateStrategyBrokers(
                        selectedStrategy.id, 
                        selectedBrokers
                      );
                      if (response.success) {
                        setShowBrokerModal(false);
                        Alert.alert('Success', 'Broker selection saved successfully');
                        fetchStrategies(); // Refresh to show updated brokers
                      } else {
                        Alert.alert('Error', response.error || 'Failed to save broker selection');
                      }
                    } catch (error: any) {
                      console.error('Error saving brokers:', error);
                      Alert.alert('Error', error.message || 'Failed to save broker selection');
                    }
                  }}
                >
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop:70,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize:18,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight:18,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    flexGrow: 0,
    maxHeight: 50,
  },
  tabsContent: {
    paddingHorizontal:10,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 6,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 0,
    marginBottom: 0,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepCircleInactive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepNumberInactive: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  mainContent: {
    paddingTop: 16,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingVertical:6
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  select: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectText: {
    fontSize: 14,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  prefix: {
    fontSize: 16,
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
  },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  templateBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  templateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  textarea: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  tipBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  tipList: {
    gap: 4,
  },
  tipItem: {
    fontSize: 13,
    lineHeight: 20,
  },
  summaryGrid: {
    marginTop: 16,
    gap: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  aiResponseText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  bottomActionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    marginTop: 24,
  },
  bottomCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottomSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSubmitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  backtestBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  backtestBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 200, 200, 0.3)',
  },
  dropdownText: {
    fontSize: 14,
  },
  createStrategyContainer: {
    paddingTop: 16,
  },
  createLeftCol: {
    width: '100%',
  },
  createRightCol: {
    width: '100%',
    marginTop: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  resetBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  segmentBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickSetupBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  quickSetupText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  webhookBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  webhookTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  webhookUrl: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  orderTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  orderTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  orderTypeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  savedStrategiesContainer: {
    paddingTop: 16,
  },
  savedStrategiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activeAllBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
  },
  activeAllBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  newStrategyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  newStrategyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  strategyCardsContainer: {
    gap: 16,
  },
  emptyState: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStateBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  loadMoreBtn: {
    borderRadius: 24,
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
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  loadMoreBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  strategyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  strategyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  strategyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  strategyCardBody: {
    gap: 8,
    marginBottom: 12,
  },
  strategyCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strategyCardLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  strategyCardValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  strategyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  conditionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  requiredLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  checkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  conditionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  indicatorsListContainer: {
    gap: 12,
    marginTop: 0,
    marginVertical:10
  },
  indicatorCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  indicatorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  indicatorCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  indicatorRemoveBtn: {
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  indicatorCardDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  strategyNameCol: {
    flex: 1,
    marginRight: 12,
  },
  strategyCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  strategyStatusCol: {
    alignItems: 'flex-end',
  },
  strategyDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  strategyDetailItem: {
    width: '45%',
  },
  strategyDetailLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  strategyDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tradeModeRow: {
    marginBottom: 12,
  },
  tradeModeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  tradeModeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // New compact styles
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical:8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactStrategyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    marginBottom: 8,
  },
  compactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  compactCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactCardSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  compactStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  compactBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactDetailGrid: {
    gap: 8,
    marginBottom: 12,
  },
  compactDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  compactDetailItem: {
    flex: 1,
  },
  compactDetailLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
  compactDetailValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  lotsInputContainer: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    width:50,
    maxWidth: 50,
  },
  lotsInput: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    padding: 0,
    margin: 0,
    minWidth: 26,
  },
  compactCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  compactActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactActionBtnWide: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  tradeModeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  tradeModeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardToggleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    paddingBottom: 0,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    // Ensure modal body has a max height so ScrollView can render content
    maxHeight: '80%',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  modalCloseBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  
  // View modal styles
  viewDetailSection: {
    marginBottom: 16,
  },
  viewStrategyName: {
    fontSize: 20,
    fontWeight: '700',
  },
  viewInfoGrid: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  viewInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  viewInfoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewInfoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  viewDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  webhookSection: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  webhookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  webhookUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyBtn: {
    padding: 6,
    borderRadius: 6,
  },
  
  // Edit modal styles
  editFormGroup: {
    marginBottom: 14,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  editInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  editTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  editToggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Broker modal styles
  tradeModeToggleSection: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  tradeModeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeModeToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tradeModeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradeModeOption: {
    fontSize: 12,
    fontWeight: '600',
  },
  tradeModeHint: {
    fontSize: 11,
    marginTop: 8,
  },
  brokerSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  noBrokersMessage: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  noBrokersText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  noBrokersHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  brokerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  brokerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brokerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  brokerAccount: {
    fontSize: 11,
    marginTop: 2,
  },
  brokerCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Enhanced Card Styles
  tradeModeToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  tradeModeToggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  
  // Enhanced Modal Styles
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  infoSection: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoItem: {
    flex: 1,
  },
  infoItemLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoItemValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  webhookLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  webhookUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
  },
  webhookUrlText: {
    fontSize: 11,
    fontFamily: 'monospace',
    flex: 1,
  },
  codeBox: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  codeTextStyle: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  webhookHint: {
    fontSize: 11,
    marginTop: 8,
  },
  modalFooterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  // Edit Modal Enhanced Styles
  editRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  editSelect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    position: 'relative',
  },
  editSelectText: {
    fontSize: 14,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
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
  editInputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  editPrefix: {
    fontSize: 14,
    marginRight: 4,
  },
  editInputNoBorder: {
    fontSize: 14,
    padding: 0,
  },
  togglesRow: {
    flexDirection: 'row',
    gap: 24,
    marginVertical: 12,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  editHint: {
    fontSize: 11,
    marginTop: 4,
  },
  
  // Broker Modal Enhanced Styles
  brokerStrategyName: {
    fontSize: 14,
  },
  brokerStrategyHint: {
    fontSize: 12,
    marginTop: 4,
  },
  brokerSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brokerCountText: {
    fontSize: 12,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  brokerListContainer: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  brokerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  brokerCheckboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brokerCheckboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  brokerItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  brokerBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  brokerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  brokerIdText: {
    fontSize: 11,
    alignSelf: 'center',
  },
});
