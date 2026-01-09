
import { colors } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { apiKeyService, exchangeService } from '@/services';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Segment = 'Crypto' | 'Forex' | 'Indian';

interface ApiItem {
  id: number;
  apiName: string;
  broker: string;
  status: boolean;
  brokerFund: string;
  segment: Segment;
  // Extended fields from backend
  exchangeId?: string;
  accountType?: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  accessToken?: string;
  isDefault?: boolean;
  lastVerified?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Broker options for each segment
const cryptoExchanges = [
  'Binance', 'Coinbase', 'Kraken', 'Bitfinex', 'KuCoin', 'Bybit', 'OKX', 'Huobi', 'Gate.io', 'Gemini'
];

const forexBrokers = ['MT5', 'Deriv'];

const indianBrokers = [
  'Angel One', 'Alice Blue', 'Zerodha', 'Zebu', 'Motilal Oswal', 'Dhan', 'TradeSmart', 'Choice Broking', 'Kotak Neo'
];

export default function ApiDetailsScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false);
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false);
  const [showEditSegmentDropdown, setShowEditSegmentDropdown] = useState(false);
  const [showEditBrokerDropdown, setShowEditBrokerDropdown] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | ''>('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [selectedApi, setSelectedApi] = useState<ApiItem | null>(null);
  const [connectionTestStatus, setConnectionTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animation refs for slide-in from right
  const addModalAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const viewModalAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const editModalAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Animate modal open/close
  const openModalAnim = (anim: Animated.Value) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeModalAnim = (anim: Animated.Value, callback: () => void) => {
    Animated.timing(anim, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      callback();
      anim.setValue(SCREEN_WIDTH);
    });
  };

  // Modal open handlers
  const handleOpenAddModal = () => {
    setShowAddModal(true);
    openModalAnim(addModalAnim);
  };

  const handleCloseAddModal = () => {
    closeModalAnim(addModalAnim, () => {
      setShowAddModal(false);
      resetForm();
    });
  };

  const handleOpenViewModal = (api: ApiItem) => {
    setSelectedApi(api);
    setConnectionTestStatus('idle');
    setShowViewModal(true);
    openModalAnim(viewModalAnim);
  };

  const handleCloseViewModal = () => {
    closeModalAnim(viewModalAnim, () => {
      setShowViewModal(false);
    });
  };

  // Close the view modal first, then open the edit modal (prevents overlay/blocking)
  const handleOpenEditFromView = (api: ApiItem | null) => {
    if (!api) return;
    closeModalAnim(viewModalAnim, () => {
      setShowViewModal(false);
      // small timeout to ensure modal unmount order on native platforms
      setTimeout(() => handleOpenEditModal(api), 50);
    });
  };

  const handleOpenEditModal = (api: ApiItem) => {
    setSelectedApi(api);
    setSelectedSegment(api.segment);
    setSelectedBroker(api.broker);
    setApiName(api.apiName || '');
    // Populate form fields from backend data
    setApiKey(api.apiKey || '');
    setApiSecret(api.apiSecret || '');
    setPassphrase(api.passphrase || '');
    setAccessToken(api.accessToken || '');
    setMakeDefault(api.isDefault || false);
    setShowEditModal(true);
    openModalAnim(editModalAnim);
  };

  const handleCloseEditModal = () => {
    closeModalAnim(editModalAnim, () => {
      setShowEditModal(false);
      resetForm();
    });
  };
  
  // Form fields
  const [apiName, setApiName] = useState('');
  const [appName, setAppName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [mPin, setMPin] = useState('');
  const [totp, setTotp] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('fdfdf');

  // Pagination state for Load More functionality
  const [apisVisibleCount, setApisVisibleCount] = useState(6);

  // Sample API data
  const [apiList, setApiList] = useState<ApiItem[]>([
    {
      id: 1,
      apiName: 'dfdfdf',
      broker: 'Binance',
      status: false,
      brokerFund: '$0.00',
      segment: 'Crypto',
    },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [exchanges, setExchanges] = useState<any[]>([]);

  // Fetch API keys from backend
  const fetchApiKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const [apiKeysRes, exchangesRes] = await Promise.all([
        apiKeyService.getApiKeys(),
        exchangeService.getSupportedExchanges(),
      ]);

      if (apiKeysRes.data) {
        // defensive mapping: backend may use different field names for api name / broker
        setApiList(apiKeysRes.data.map((key: any) => {
          const bal = Number(key.balance);
          const hasBalance = Number.isFinite(bal);

          const apiNameCandidate = key.name ?? key.apiName ?? key.displayName ?? key.label ?? key.title ?? '';
          const apiName = apiNameCandidate || (key.broker ? `API ${key.id}` : `API ${key.id}`);

          const brokerCandidate = key.broker ?? key.exchange ?? key.exchangeName ?? key.brokerName ?? '';
          const broker = brokerCandidate || '-';

          const statusRaw = key.status ?? key.isActive ?? key.active;
          let status = false;
          if (typeof statusRaw === 'string') {
            status = statusRaw.toLowerCase() === 'active';
          } else if (typeof statusRaw === 'boolean') {
            status = statusRaw;
          }

          // if apiName ended up empty, log briefly for debugging
          if (!apiNameCandidate) console.debug('api-details: missing name for key', { id: key.id, broker });

          return {
            id: key.id,
            apiName,
            broker,
            status,
            brokerFund: hasBalance ? `$${bal.toFixed(2)}` : '$0.00',
            segment: key.segment || detectSegment(broker),
            // Store all backend fields for view/edit modals
            exchangeId: key.exchangeId,
            accountType: key.accountType || 'spot',
            apiKey: key.apiKey,
            apiSecret: key.apiSecret,
            passphrase: key.passphrase,
            accessToken: key.accessToken,
            isDefault: key.isDefault,
            lastVerified: key.lastVerified,
            createdAt: key.createdAt,
            updatedAt: key.updatedAt,
          };
        }));
      }

      if (exchangesRes.data) {
        setExchanges(exchangesRes.data);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchApiKeys();
  }, [fetchApiKeys]);

  // Detect segment from exchange name
  const detectSegment = (exchange: string): Segment => {
    if (cryptoExchanges.includes(exchange)) return 'Crypto';
    if (forexBrokers.includes(exchange)) return 'Forex';
    if (indianBrokers.includes(exchange)) return 'Indian';
    return 'Crypto';
  };

  const theme = {
    bg: isDark ? '#0a0a0f' : '#f8f9fc',
    cardBg: isDark ? 'rgba(30,30,58,0.8)' : '#fff',
    text: isDark ? '#fff' : '#1f2937',
    textSecondary: isDark ? '#a1a1aa' : '#6b7280',
    titleColor: isDark ? '#818cf8' : '#5B7FFF',
    borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.08)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
  };

  // Calculate stats from apiList
  const stats = [
    { label: 'Total', value: apiList.length, icon: 'globe-outline', color: '#10B981' },
    { label: 'Active', value: apiList.filter(a => a.status).length, icon: 'checkmark-circle', color: '#10B981' },
    { label: 'Inactive', value: apiList.filter(a => !a.status).length, icon: 'close-circle', color: '#EF4444' },
    { label: 'Forex', value: apiList.filter(a => a.segment === 'Forex').length, icon: 'cash-outline', color: '#F59E0B' },
    { label: 'Crypto', value: apiList.filter(a => a.segment === 'Crypto').length, icon: 'logo-bitcoin', color: '#F59E0B' },
    { label: 'Indian', value: apiList.filter(a => a.segment === 'Indian').length, icon: 'flag-outline', color: '#60A5FA' },
  ];

  const segments: Segment[] = ['Crypto', 'Forex', 'Indian'];

  const getBrokerOptions = () => {
    switch (selectedSegment) {
      case 'Crypto':
        return cryptoExchanges;
      case 'Forex':
        return forexBrokers;
      case 'Indian':
        return indianBrokers;
      default:
        return [];
    }
  };

  const resetForm = () => {
    setSelectedSegment('');
    setSelectedBroker('');
    setMakeDefault(false);
    setApiName('');
    setAppName('');
    setAccessToken('');
    setApiToken('');
    setBrokerId('');
    setMPin('');
    setTotp('');
    setApiKey('');
    setApiSecret('');
    setShowSegmentDropdown(false);
    setShowBrokerDropdown(false);
    setShowEditSegmentDropdown(false);
    setShowEditBrokerDropdown(false);
  };

  const handleAddApi = async () => {
    if (!selectedSegment || !selectedBroker) return;
    setIsAdding(true);
    try {
      const payload = {
        apiName: apiName || `API ${apiList.length + 1}`,
        segment: selectedSegment,
        broker: selectedBroker,
        apiKey: apiKey,
        apiSecret: apiSecret || undefined,
        passphrase: passphrase || undefined,
      };

      console.debug('api-details: creating api key with payload', payload);

      const response = await apiKeyService.createApiKey(payload);

      console.debug('api-details: createApiKey response', response);

      if (response && response.success) {
        // Refresh the list from backend to get consistent mapping
        await fetchApiKeys();
        Alert.alert('Success', 'API connection added');
        handleCloseAddModal();
      } else {
        const err = (response && (response.error || response.message)) || 'Failed to add API key';
        console.error('Create API failed:', err, response);
        Alert.alert('Error', String(err));
      }
    } catch (error: any) {
      console.error('Error adding API key:', error);
      Alert.alert('Error', error.message || 'Failed to add API key. Please try again.');
    } finally {
      setIsAdding(false);
    }
    return;
  };

  const toggleApiStatus = async (id: number) => {
    try {
      const api = apiList.find(a => a.id === id);
      if (api) {
        // Update via API - since there's no toggle endpoint, we just update local state
        // The actual toggle would need a backend endpoint
        setApiList(apiList.map(a => 
          a.id === id ? { ...a, status: !a.status } : a
        ));
      }
    } catch (error) {
      console.error('Error toggling API status:', error);
      Alert.alert('Error', 'Failed to update API status. Please try again.');
    }
  };

  const handleDeleteApi = async () => {
    if (selectedApi) {
      try {
        await apiKeyService.deleteApiKey(selectedApi.id);
        setApiList(apiList.filter(api => api.id !== selectedApi.id));
        setShowDeleteModal(false);
        setSelectedApi(null);
      } catch (error) {
        console.error('Error deleting API key:', error);
        Alert.alert('Error', 'Failed to delete API key. Please try again.');
      }
    }
  };

  const openViewModal = (api: ApiItem) => {
    handleOpenViewModal(api);
  };

  const openEditModal = (api: ApiItem) => {
    handleOpenEditModal(api);
  };

  const openDeleteModal = (api: ApiItem) => {
    setSelectedApi(api);
    setShowDeleteModal(true);
  };

  const handleTestConnection = async () => {
    if (!selectedApi) return;
    setConnectionTestStatus('testing');
    try {
      const response = await apiKeyService.testConnection(selectedApi.id);
      if (response.success) {
        setConnectionTestStatus('success');
      } else {
        setConnectionTestStatus('failed');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      setConnectionTestStatus('failed');
    }
  };

  const handleSaveEdit = async () => {
    if (selectedApi && selectedSegment && selectedBroker) {
      try {
        const updateData: any = {
          name: apiName || selectedApi.apiName,
          segment: selectedSegment,
          broker: selectedBroker,
        };
        // Add optional fields if they have values
        if (apiKey) updateData.apiKey = apiKey;
        if (apiSecret) updateData.apiSecret = apiSecret;
        if (passphrase) updateData.passphrase = passphrase;
        if (accessToken) updateData.accessToken = accessToken;

        const response = await apiKeyService.updateApiKey(selectedApi.id, updateData);
        
        if (response.success) {
          // Update local state
          setApiList(apiList.map(api => 
            api.id === selectedApi.id 
              ? { 
                  ...api, 
                  apiName: apiName || api.apiName, 
                  broker: selectedBroker, 
                  segment: selectedSegment,
                  apiKey: apiKey || api.apiKey,
                  apiSecret: apiSecret || api.apiSecret,
                  passphrase: passphrase || api.passphrase,
                  accessToken: accessToken || api.accessToken,
                }
              : api
          ));
          handleCloseEditModal();
          setSelectedApi(null);
          Alert.alert('Success', 'API key updated successfully');
        } else {
          Alert.alert('Error', response.error || 'Failed to update API key');
        }
      } catch (error: any) {
        console.error('Error updating API key:', error);
        Alert.alert('Error', error.message || 'Failed to update API key. Please try again.');
      }
    }
  };

  const refreshScreen = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchApiKeys();
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredApis = apiList.filter(api => {
    const q = (searchQuery || '').toLowerCase();
    const name = (api.apiName || '').toLowerCase();
    const broker = (api.broker || '').toLowerCase();
    return name.includes(q) || broker.includes(q);
  });

  const renderFormFields = () => {
    if (!selectedBroker) return null;

    // Crypto - just exchange selection is enough
    if (selectedSegment === 'Crypto') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Name (Optional)</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Key **</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API key"
              placeholderTextColor={theme.textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Secret **</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API secret"
              placeholderTextColor={theme.textSecondary}
              value={apiSecret}
              onChangeText={setApiSecret}
              secureTextEntry
            />
          </View>
        </>
      );
    }

    // Forex - MT5
    if (selectedSegment === 'Forex' && selectedBroker === 'MT5') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Name (Optional)</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>App Name **</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="apps-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter app name"
              placeholderTextColor={theme.textSecondary}
              value={appName}
              onChangeText={setAppName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>Access Token **</Text>
          <View style={[styles.inputContainerLarge, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} style={{ marginTop: 14 }} />
            <TextInput
              style={[styles.textInputMultiline, { color: theme.text }]}
              placeholder="Enter access token"
              placeholderTextColor={theme.textSecondary}
              value={accessToken}
              onChangeText={setAccessToken}
              multiline
              numberOfLines={3}
            />
          </View>
        </>
      );
    }

    // Forex - Deriv
    if (selectedSegment === 'Forex' && selectedBroker === 'Deriv') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Name</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Token</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API token"
              placeholderTextColor={theme.textSecondary}
              value={apiToken}
              onChangeText={setApiToken}
              secureTextEntry
            />
          </View>
        </>
      );
    }

    // Indian brokers
    if (selectedSegment === 'Indian') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Name</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>Broker ID</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="business-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter broker ID"
              placeholderTextColor={theme.textSecondary}
              value={brokerId}
              onChangeText={setBrokerId}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>mPIN</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="keypad-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="***"
              placeholderTextColor={theme.textSecondary}
              value={mPin}
              onChangeText={setMPin}
              secureTextEntry
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>TOTP</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter TOTP"
              placeholderTextColor={theme.textSecondary}
              value={totp}
              onChangeText={setTotp}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Key</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API key"
              placeholderTextColor={theme.textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>API Secret</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API secret"
              placeholderTextColor={theme.textSecondary}
              value={apiSecret}
              onChangeText={setApiSecret}
              secureTextEntry
            />
          </View>
        </>
      );
    }

    return null;
  };

  const renderEditFormFields = () => {
    if (!selectedBroker) return null;

    // Forex - MT5
    if (selectedSegment === 'Forex' && selectedBroker === 'MT5') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Name (Optional)</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>App Name</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="apps-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter app name"
              placeholderTextColor={theme.textSecondary}
              value={appName}
              onChangeText={setAppName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>Access Token</Text>
          <View style={[styles.inputContainerLarge, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} style={{ marginTop: 14 }} />
            <TextInput
              style={[styles.textInputMultiline, { color: theme.text }]}
              placeholder="Enter access token"
              placeholderTextColor={theme.textSecondary}
              value={accessToken}
              onChangeText={setAccessToken}
              multiline
              numberOfLines={3}
            />
          </View>
        </>
      );
    }

    // Forex - Deriv
    if (selectedSegment === 'Forex' && selectedBroker === 'Deriv') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Name</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>mPIN</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="keypad-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="***"
              placeholderTextColor={theme.textSecondary}
              value={mPin}
              onChangeText={setMPin}
              secureTextEntry
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>TOTP</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter TOTP"
              placeholderTextColor={theme.textSecondary}
              value={totp}
              onChangeText={setTotp}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Key</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API key"
              placeholderTextColor={theme.textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Secret</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API secret"
              placeholderTextColor={theme.textSecondary}
              value={apiSecret}
              onChangeText={setApiSecret}
              secureTextEntry
            />
          </View>
        </>
      );
    }

    // Crypto
    if (selectedSegment === 'Crypto') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Name (Optional)</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>mPIN</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="keypad-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="***"
              placeholderTextColor={theme.textSecondary}
              value={mPin}
              onChangeText={setMPin}
              secureTextEntry
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>TOTP</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter TOTP"
              placeholderTextColor={theme.textSecondary}
              value={totp}
              onChangeText={setTotp}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Key</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API key"
              placeholderTextColor={theme.textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Secret</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API secret"
              placeholderTextColor={theme.textSecondary}
              value={apiSecret}
              onChangeText={setApiSecret}
              secureTextEntry
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>Passphrase</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="document-text-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter passphrase"
              placeholderTextColor={theme.textSecondary}
              value={passphrase}
              onChangeText={setPassphrase}
            />
          </View>
        </>
      );
    }

    // Indian brokers
    if (selectedSegment === 'Indian') {
      return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Name</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API name"
              placeholderTextColor={theme.textSecondary}
              value={apiName}
              onChangeText={setApiName}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>Broker ID</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="business-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter broker ID"
              placeholderTextColor={theme.textSecondary}
              value={brokerId}
              onChangeText={setBrokerId}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>mPIN</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="keypad-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="***"
              placeholderTextColor={theme.textSecondary}
              value={mPin}
              onChangeText={setMPin}
              secureTextEntry
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>TOTP</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter TOTP"
              placeholderTextColor={theme.textSecondary}
              value={totp}
              onChangeText={setTotp}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Key</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API key"
              placeholderTextColor={theme.textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>API Secret</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Enter API secret"
              placeholderTextColor={theme.textSecondary}
              value={apiSecret}
              onChangeText={setApiSecret}
              secureTextEntry
            />
          </View>
        </>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>API Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}20` }]}>
                <Ionicons name={stat.icon as any} size={24} color={stat.color} />
              </View>
              <View style={styles.statInfo}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Search and Add Button */}
        <View style={styles.searchAddContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search APIs..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[styles.addIconBtn, { backgroundColor: theme.titleColor }]}
            onPress={handleOpenAddModal}
            accessibilityLabel="Add API"
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* API Cards */}
        {filteredApis.length > 0 ? (
          <View style={styles.apiCardsContainer}>
            {filteredApis.slice(0, apisVisibleCount).map((api) => (
              <View key={api.id} style={[styles.apiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                {/* Top row: API Name | Broker | Status */}
                <View style={styles.apiCardRow}>
                  <View style={[styles.apiCardInfo, { flexBasis: '44%' }] }>
                    <Text style={[styles.apiCardLabel, { color: theme.textSecondary }]}>API NAME</Text>
                    <Text style={[styles.apiCardValue, { color: theme.text }]} numberOfLines={1}>{api.apiName}</Text>
                  </View>

                  <View style={[styles.apiCardInfo, { flexBasis: '36%' }, styles.brokerShift] }>
                    <Text style={[styles.apiCardLabel, { color: theme.textSecondary }]}>BROKER</Text>
                    <Text style={[styles.apiCardValue, { color: theme.text }]} numberOfLines={1}>{api.broker}</Text>
                  </View>

                  <View style={styles.statusContainer}>
                    <Text style={[styles.statusLabel, { color: theme.textSecondary, marginRight: 1 }]}>STATUS</Text>
                    <Switch
                      value={api.status}
                      onValueChange={() => toggleApiStatus(api.id)}
                      trackColor={{ false: '#ccc', true: '#10B981' }}
                      thumbColor="#fff"
                      style={{ transform: [{ scaleX: 0.65 }, { scaleY: 0.65 }] }}
                    />
                  </View>
                </View>

                {/* Second row: Segment | Broker Fund | Actions (icons only) */}
                <View style={styles.apiCardRow}>
                  <View style={[styles.apiCardInfo, { flexBasis: '44%' }] }>
                    <Text style={[styles.apiCardLabel, { color: theme.textSecondary }]}>SEGMENT</Text>
                    <Text style={[styles.apiCardValue, { color: theme.text }]}>{api.segment}</Text>
                  </View>

                  <View style={[styles.apiCardInfo, { flexBasis: '36%' }, styles.brokerFundShift] }>
                    <Text style={[styles.apiCardLabel, { color: theme.textSecondary }]}>BROKER FUND</Text>
                    <Text style={[styles.apiCardValue, { color: theme.text }]}>{api.brokerFund}</Text>
                  </View>

                  <View style={styles.actionsWrapper}>
                    <View style={styles.actionsContainer}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#60A5FA20' }]}
                        onPress={refreshScreen}
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? (
                          <ActivityIndicator size="small" color="#60A5FA" />
                        ) : (
                          <Ionicons name="sync-outline" size={12} color="#60A5FA" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#A78BFA20' }]}
                        onPress={() => openViewModal(api)}
                      >
                        <Ionicons name="eye-outline" size={12} color="#A78BFA" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#10B98120' }]}
                        onPress={() => openEditModal(api)}
                      >
                        <Ionicons name="create-outline" size={12} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#EF444420' }]}
                        onPress={() => openDeleteModal(api)}
                      >
                        <Ionicons name="trash-outline" size={12} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
            {/* Load More Button for APIs */}
            {filteredApis.length > apisVisibleCount && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : colors.primary + '15', borderColor: colors.primary }]}
                onPress={() => setApisVisibleCount(prev => prev + 10)}
              >
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[styles.emptyStateContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.emptyStateText, { color: theme.text }]}>
              No API keys found. Click "+ New API" to add one.
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add API Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseAddModal}
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleCloseAddModal}
          />
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[styles.modalContent, { backgroundColor: theme.cardBg, transform: [{ translateX: addModalAnim }] }]}
          >
              <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Add API Connection</Text>
                <TouchableOpacity onPress={handleCloseAddModal}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Segment Selector */}
                <Text style={[styles.fieldLabel, { color: theme.titleColor }]}>Segment</Text>
                <TouchableOpacity
                  style={[styles.segmentSelector, { backgroundColor: theme.inputBg, borderColor: showSegmentDropdown ? theme.titleColor : theme.borderColor }]}
                  onPress={() => {
                    setShowSegmentDropdown(!showSegmentDropdown);
                    setShowBrokerDropdown(false);
                  }}
                >
                  <View style={styles.segmentDisplay}>
                    <Ionicons name="layers-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.segmentText, { color: selectedSegment ? theme.text : theme.textSecondary }]}>
                      {selectedSegment || 'Select segment'}
                    </Text>
                  </View>
                  <Ionicons name={showSegmentDropdown ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                {showSegmentDropdown && (
                  <View style={[styles.dropdownContainer, { 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.cardBg, 
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.borderColor, 
                    marginTop: 4,
                    shadowOpacity: isDark ? 0.4 : 0.15,
                  }]}>
                    {segments.map((segment, index) => (
                      <TouchableOpacity
                        key={segment}
                        style={[
                          styles.dropdownItem,
                          { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : theme.borderColor },
                          selectedSegment === segment && { backgroundColor: `${theme.titleColor}20` },
                          index === segments.length - 1 && { borderBottomWidth: 0 },
                        ]}
                        onPress={() => {
                          setSelectedSegment(segment);
                          setSelectedBroker('');
                          setShowSegmentDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: theme.text }]}>{segment}</Text>
                        {selectedSegment === segment && (
                          <Ionicons name="checkmark" size={20} color={theme.titleColor} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Broker/Exchange Selector - Only show when segment is selected */}
                {selectedSegment && (
                  <>
                    <Text style={[styles.fieldLabel, { color: theme.titleColor, marginTop: 16 }]}>
                      {selectedSegment === 'Crypto' ? 'Select Exchange' : 'Broker'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.segmentSelector, { backgroundColor: theme.inputBg, borderColor: showBrokerDropdown ? theme.titleColor : theme.borderColor }]}
                      onPress={() => {
                        setShowBrokerDropdown(!showBrokerDropdown);
                        setShowSegmentDropdown(false);
                      }}
                    >
                      <View style={styles.segmentDisplay}>
                        <Ionicons name="apps-outline" size={20} color={theme.textSecondary} />
                        <Text style={[styles.segmentText, { color: selectedBroker ? theme.text : theme.textSecondary }]}>
                          {selectedBroker || (selectedSegment === 'Crypto' ? 'Search 100+ exchanges...' : 'Select broker')}
                        </Text>
                      </View>
                      <Ionicons name={showBrokerDropdown ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {showBrokerDropdown && (
                      <View style={[styles.dropdownContainer, { 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.cardBg, 
                        borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.borderColor, 
                        marginTop: 4, 
                        maxHeight: 300,
                        shadowOpacity: isDark ? 0.4 : 0.15,
                      }]}>
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {getBrokerOptions().map((broker, index) => (
                            <TouchableOpacity
                              key={broker}
                              style={[
                                styles.dropdownItem,
                                { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : theme.borderColor },
                                selectedBroker === broker && { backgroundColor: `${theme.titleColor}20` },
                                index === getBrokerOptions().length - 1 && { borderBottomWidth: 0 },
                              ]}
                              onPress={() => {
                                setSelectedBroker(broker);
                                setShowBrokerDropdown(false);
                              }}
                            >
                              <Text style={[styles.dropdownItemText, { color: theme.text }]}>{broker}</Text>
                              {selectedBroker === broker && (
                                <Ionicons name="checkmark" size={20} color={theme.titleColor} />
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}

                {/* Dynamic Form Fields based on segment and broker */}
                {renderFormFields()}

                {/* Make Default Checkbox */}
                {selectedSegment && (
                  <TouchableOpacity 
                    style={styles.checkboxContainer}
                    onPress={() => setMakeDefault(!makeDefault)}
                  >
                    <View style={[styles.checkbox, { borderColor: theme.borderColor, backgroundColor: makeDefault ? theme.titleColor : 'transparent' }]}>
                      {makeDefault && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                      Make this the default API for {selectedSegment} segment
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn, { borderColor: theme.borderColor }]}
                  onPress={handleCloseAddModal}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.titleColor }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    styles.addModalBtn,
                    { backgroundColor: (selectedSegment && selectedBroker) ? theme.titleColor : '#ccc', opacity: (isAdding ? 0.8 : 1) },
                  ]}
                  onPress={handleAddApi}
                  disabled={isAdding || !selectedSegment || !selectedBroker}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.addModalBtnText, { color: '#fff' }]}>Add Connection</Text>
                  )}
                </TouchableOpacity>
              </View>
          </Animated.View>
        </View>
      </Modal>

      {/* View API Details Modal - Centered */}
      <Modal
        visible={showViewModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseViewModal}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleCloseViewModal} />
          <View style={[styles.centeredModalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
              <View style={styles.viewModalTitleRow}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>API Details</Text>
                <View style={[styles.statusBadge, { backgroundColor: selectedApi?.status ? '#10B98120' : '#64748B20' }]}>
                  <Text style={[styles.statusBadgeText, { color: selectedApi?.status ? '#10B981' : '#64748B' }]}>
                    {selectedApi?.status ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCloseViewModal}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Info Card - Dynamic Data */}
              <View style={[styles.viewInfoCard, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                {/* Row 1: Segment, Broker, API Name */}
                <View style={styles.viewInfoRow}>
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>Segment</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>{selectedApi?.segment || '-'}</Text>
                  </View>
                  <View style={[styles.viewInfoDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>Broker</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>{selectedApi?.broker || '-'}</Text>
                  </View>
                  <View style={[styles.viewInfoDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>API Name</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]} numberOfLines={1}>{selectedApi?.apiName || '-'}</Text>
                  </View>
                </View>
                
                <View style={[styles.viewInfoRowDivider, { backgroundColor: theme.borderColor }]} />
                
                {/* Row 2: Exchange ID, Account Type, Balance */}
                <View style={styles.viewInfoRow}>
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>Exchange ID</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>{selectedApi?.exchangeId || '-'}</Text>
                  </View>
                  <View style={[styles.viewInfoDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>Account</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>{selectedApi?.accountType || 'Spot'}</Text>
                  </View>
                  <View style={[styles.viewInfoDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>Balance</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>{selectedApi?.brokerFund || '$0.00'}</Text>
                  </View>
                </View>
                
                <View style={[styles.viewInfoRowDivider, { backgroundColor: theme.borderColor }]} />
                
                {/* Row 3: API Key, API Secret, Passphrase */}
                <View style={styles.viewInfoRow}>
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>API Key</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>{selectedApi?.apiKey ? '••••••' : '-'}</Text>
                  </View>
                  <View style={[styles.viewInfoDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={styles.viewInfoCell}>
                    <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>API Secret</Text>
                    <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>{selectedApi?.apiSecret ? '••••••' : '-'}</Text>
                  </View>
                  <View style={[styles.viewInfoDivider, { backgroundColor: theme.borderColor }]} />
                  <View style={[styles.viewInfoCell, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <View>
                      <Text style={[styles.viewInfoCellLabel, { color: theme.textSecondary }]}>Passphrase</Text>
                      <Text style={[styles.viewInfoCellValue, { color: theme.text }]}>
                        {selectedApi?.passphrase ? (showPassphrase ? selectedApi.passphrase : '••••••') : '-'}
                      </Text>
                    </View>
                    {selectedApi?.passphrase && (
                      <TouchableOpacity onPress={() => setShowPassphrase(!showPassphrase)}>
                        <Ionicons name={showPassphrase ? "eye-off-outline" : "eye-outline"} size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Stats Row - Dynamic */}
              <View style={styles.viewStatsRow}>
                <View style={[styles.viewStatItem, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="star-outline" size={16} color={theme.titleColor} />
                  <View>
                    <Text style={[styles.viewStatLabel, { color: theme.textSecondary }]}>Default</Text>
                    <Text style={[styles.viewStatValue, { color: theme.text }]}>{selectedApi?.isDefault ? 'Yes' : 'No'}</Text>
                  </View>
                </View>
                <View style={[styles.viewStatItem, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="calendar-outline" size={16} color={theme.titleColor} />
                  <View>
                    <Text style={[styles.viewStatLabel, { color: theme.textSecondary }]}>Created</Text>
                    <Text style={[styles.viewStatValue, { color: theme.text }]}>{selectedApi?.createdAt ? new Date(selectedApi.createdAt).toLocaleDateString() : '-'}</Text>
                  </View>
                </View>
              </View>

              {/* Test Connection Button */}
              <TouchableOpacity
                style={[styles.testConnectionBtn, { borderColor: theme.titleColor }]}
                onPress={handleTestConnection}
                disabled={connectionTestStatus === 'testing'}
              >
                <Ionicons name="git-compare-outline" size={16} color={theme.titleColor} />
                <Text style={[styles.testConnectionText, { color: theme.titleColor }]}>
                  {connectionTestStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </Text>
              </TouchableOpacity>

              {/* Connection Status */}
              {connectionTestStatus === 'failed' && (
                <View style={[styles.connectionStatus, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={[styles.connectionStatusText, { color: '#EF4444' }]}>Connection test failed</Text>
                </View>
              )}
              {connectionTestStatus === 'success' && (
                <View style={[styles.connectionStatus, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={[styles.connectionStatusText, { color: '#10B981' }]}>Connection successful</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.editBtnLarge, { backgroundColor: theme.titleColor }]}
                onPress={() => handleOpenEditFromView(selectedApi)}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.editBtnLargeText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeBtnOutline, { borderColor: theme.titleColor }]}
                onPress={handleCloseViewModal}
              >
                <Text style={[styles.closeBtnOutlineText, { color: theme.titleColor }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit API Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseEditModal}
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleCloseEditModal}
          />
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[styles.modalContent, { backgroundColor: theme.cardBg, transform: [{ translateX: editModalAnim }] }]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit API</Text>
              <TouchableOpacity onPress={handleCloseEditModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Segment Selector */}
              <Text style={[styles.fieldLabel, { color: theme.titleColor }]}>Segment</Text>
              <TouchableOpacity
                style={[styles.segmentSelector, { backgroundColor: theme.inputBg, borderColor: showEditSegmentDropdown ? theme.titleColor : theme.borderColor }]}
                onPress={() => {
                  setShowEditSegmentDropdown(!showEditSegmentDropdown);
                  setShowEditBrokerDropdown(false);
                }}
              >
                <View style={styles.segmentDisplay}>
                  <Ionicons name="layers-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.segmentText, { color: selectedSegment ? theme.text : theme.textSecondary }]}>
                    {selectedSegment || 'Select segment'}
                  </Text>
                </View>
                <Ionicons name={showEditSegmentDropdown ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {showEditSegmentDropdown && (
                <View style={[styles.dropdownContainer, { 
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.cardBg, 
                  borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.borderColor, 
                  marginTop: 4,
                  shadowOpacity: isDark ? 0.4 : 0.15,
                }]}>
                  {segments.map((segment, index) => (
                    <TouchableOpacity
                      key={segment}
                      style={[
                        styles.dropdownItem,
                        { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : theme.borderColor },
                        selectedSegment === segment && { backgroundColor: `${theme.titleColor}20` },
                        index === segments.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => {
                        setSelectedSegment(segment);
                        setSelectedBroker('');
                        setShowEditSegmentDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>{segment}</Text>
                      {selectedSegment === segment && (
                        <Ionicons name="checkmark" size={20} color={theme.titleColor} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Broker Selector - Only show when segment is selected */}
              {selectedSegment && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.titleColor, marginTop: 16 }]}>Broker</Text>
                  <TouchableOpacity
                    style={[styles.segmentSelector, { backgroundColor: theme.inputBg, borderColor: showEditBrokerDropdown ? theme.titleColor : theme.borderColor }]}
                    onPress={() => {
                      setShowEditBrokerDropdown(!showEditBrokerDropdown);
                      setShowEditSegmentDropdown(false);
                    }}
                  >
                    <View style={styles.segmentDisplay}>
                      <Ionicons name="apps-outline" size={20} color={theme.textSecondary} />
                      <Text style={[styles.segmentText, { color: selectedBroker ? theme.text : theme.textSecondary }]}>
                        {selectedBroker || 'Select broker'}
                      </Text>
                    </View>
                    <Ionicons name={showEditBrokerDropdown ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {showEditBrokerDropdown && (
                    <View style={[styles.dropdownContainer, { 
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : theme.cardBg, 
                      borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : theme.borderColor, 
                      marginTop: 4, 
                      maxHeight: 200,
                      shadowOpacity: isDark ? 0.4 : 0.15,
                    }]}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {getBrokerOptions().map((broker, index) => (
                          <TouchableOpacity
                            key={broker}
                            style={[
                              styles.dropdownItem,
                              { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.2)' : theme.borderColor },
                              selectedBroker === broker && { backgroundColor: `${theme.titleColor}20` },
                              index === getBrokerOptions().length - 1 && { borderBottomWidth: 0 },
                            ]}
                            onPress={() => {
                              setSelectedBroker(broker);
                              setShowEditBrokerDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: theme.text }]}>{broker}</Text>
                            {selectedBroker === broker && (
                              <Ionicons name="checkmark" size={20} color={theme.titleColor} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {/* Dynamic Form Fields based on segment and broker */}
              {renderEditFormFields()}

              {/* Make Default Checkbox */}
              {selectedSegment && (
                <TouchableOpacity 
                  style={styles.checkboxContainer}
                  onPress={() => setMakeDefault(!makeDefault)}
                >
                  <View style={[styles.checkbox, { borderColor: theme.borderColor, backgroundColor: makeDefault ? theme.titleColor : 'transparent' }]}>
                    {makeDefault && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                    Make this the default API for {selectedSegment} segment
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { borderColor: theme.borderColor }]}
                onPress={handleCloseEditModal}
              >
                <Text style={[styles.cancelBtnText, { color: theme.titleColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.addModalBtn, { backgroundColor: theme.titleColor }]}
                onPress={handleSaveEdit}
              >
                <Text style={[styles.addModalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="trash-outline" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.deleteTitle, { color: theme.text }]}>Delete API?</Text>
            <Text style={[styles.deleteMessage, { color: theme.textSecondary }]}>
              Are you sure you want to delete "{selectedApi?.apiName}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.deleteCancelBtn, { borderColor: theme.borderColor }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.deleteCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleDeleteApi}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
  },
  statCard: {
    width: '48%',
    flexDirection: 'row',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchAddContainer: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 4 : 12,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    marginRight:2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical:7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // API Card styles
  apiCardsContainer: {
    padding: 10,
    gap: 10,
  },
  apiCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  apiCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  apiCardInfo: {
    flex: 1,
  },
  statusContainer: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  actionsWrapper: {
    width:150,
    alignItems: 'flex-start',
    marginLeft: -30,
  },
  brokerShift: {
    marginLeft: -42,
  },
  brokerFundShift: {
    marginLeft: -42,
  },
  apiCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    opacity: 0.6,
  },
  apiCardValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap:6,
    marginTop: 0,
    alignItems: 'center',
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius:7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    margin: 16,
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  centeredModalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '90%',
    height: '100%',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  segmentSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  segmentDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  segmentText: {
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addModalBtn: {
    borderWidth: 0,
  },
  addModalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'visible',
    zIndex: 9999,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputContainerLarge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 60,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  textInputMultiline: {
    flex: 1,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 50,
  },
  // Checkbox styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  // View Modal styles
  viewModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  viewField: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewFieldWithIcon: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewFieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewFieldValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewRowSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  viewInfoItem: {
    alignItems: 'flex-start',
  },
  viewInfoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  viewInfoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  // New View Modal Card Styles
  viewInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  viewInfoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  viewInfoCell: {
    flex: 1,
    padding: 12,
  },
  viewInfoCellLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  viewInfoCellValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewInfoDivider: {
    width: 1,
  },
  viewInfoRowDivider: {
    height: 1,
    width: '100%',
  },
  viewStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  viewStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewStatLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewStatValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  testConnectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  testConnectionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  connectionStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  editBtnLarge: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  editBtnLargeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtnOutline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  closeBtnOutlineText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Edit Modal styles
  editRow: {
    flexDirection: 'row',
    gap: 12,
    zIndex: 9999,
    marginBottom: 16,
  },
  editFieldHalf: {
    flex: 1,
    position: 'relative',
    zIndex: 9999,
    overflow: 'visible',
  },
  // Delete Modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  deleteConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Broker Picker Modal styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerModalList: {
    maxHeight: 400,
  },
  pickerModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerModalItemText: {
    fontSize: 16,
    fontWeight: '500',
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
