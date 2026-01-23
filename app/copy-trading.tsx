import { borderRadius, colors, getTheme, shadows, spacing } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { copyTradingService } from '@/services';
import { useRouter } from 'expo-router';
import {
  ArrowsClockwise,
  Bank,
  CaretDown,
  CheckSquare,
  Copy,
  GearSix,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
  TrendUp,
  Users,
  Warning,
  X
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

// Default stats when no data
const DEFAULT_STATS = [
  { label: 'Total Accounts', value: '0', icon: Users, color: '#2563EB', bgColor: 'rgba(37, 99, 235, 0.15)' },
  { label: 'Master Accounts', value: '0', icon: TrendUp, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  { label: 'Copy Accounts', value: '0', icon: Copy, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { label: 'Active Accounts', value: '0', icon: Sparkle, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
];

export default function CopyTradingScreen({ hideHeader = false, hideTop = false }: { hideHeader?: boolean; hideTop?: boolean }) {
  const router = useRouter();
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  
  const [activeTab, setActiveTab] = useState<'trading' | 'unlinked' | 'all'>('trading');
  const [tradingGroups, setTradingGroups] = useState<any[]>([]); 
  const [allAccountsList, setAllAccountsList] = useState<any[]>([]); // Store flat list for All Accounts tab
  const [unlinkedAccounts, setUnlinkedAccounts] = useState<any[]>([]); // Copy accounts without master
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState(DEFAULT_STATS);
  
  // Pagination states for Load More functionality
  const [tradingGroupsVisibleCount, setTradingGroupsVisibleCount] = useState(6);
  const [allAccountsVisibleCount, setAllAccountsVisibleCount] = useState(6);
  const [unlinkedAccountsVisibleCount, setUnlinkedAccountsVisibleCount] = useState(6);
  
  // Fetch copy trading data from API
  const fetchData = useCallback(async () => {
    try {
      console.log('Copy Trading - Fetching data from API...');
      const [accountsResponse, statsResponse] = await Promise.all([
        copyTradingService.getAccounts(),
        copyTradingService.getStatistics(),
      ]);
      
      console.log('Copy Trading - Full API response:', JSON.stringify(accountsResponse, null, 2));
      console.log('Copy Trading - Response success:', accountsResponse.success);
      console.log('Copy Trading - Response data type:', typeof accountsResponse.data);
      console.log('Copy Trading - Response data is array:', Array.isArray(accountsResponse.data));
      
      if (accountsResponse.success && accountsResponse.data) {
        // Transform API data - handle both nested and flat structures
        const allAccounts = Array.isArray(accountsResponse.data) ? accountsResponse.data : [];
        console.log('Copy Trading - All accounts:', JSON.stringify(allAccounts, null, 2));
        console.log('Copy Trading - All accounts count:', allAccounts.length);
        
        // API uses: type='master'/'child', masterAccountId for linking
        const masterAccounts = allAccounts.filter((acc: any) => acc.type === 'master');
        const copyAccounts = allAccounts.filter((acc: any) => acc.type === 'child');
        
        console.log('Copy Trading - Master accounts:', masterAccounts.map((m: any) => ({ id: m.id, name: m.name })));
        console.log('Copy Trading - Copy accounts:', copyAccounts.map((c: any) => ({ id: c.id, name: c.name, masterAccountId: c.masterAccountId, masterAccountName: c.masterAccountName })));
        
        const groups = masterAccounts.map((master: any) => {
          // Find copy accounts linked to this master using masterAccountId
          const linkedCopyAccounts = copyAccounts.filter((copy: any) => {
            const copyMasterId = copy.masterAccountId;
            const masterId = master.id;
            // Log each comparison for debugging
            console.log(`Comparing copy "${copy.name}" masterAccountId=${copyMasterId} (${typeof copyMasterId}) with master "${master.name}" id=${masterId} (${typeof masterId})`);
            // Compare as numbers (handle both string and number)
            return Number(copyMasterId) === Number(masterId);
          });
          
          console.log(`Master "${master.name}" (ID: ${master.id}) linked to ${linkedCopyAccounts.length} copy accounts:`, linkedCopyAccounts.map((c: any) => c.name));
          
          // Transform linked copy accounts to UI format
          const uiCopyAccounts = linkedCopyAccounts.map((child: any) => ({
            id: String(child.id),
            name: child.name,
            detail: `${child.broker || ''} • Copying ${master.name}`.trim().replace(/^•\s*/, ''),
          }));
          
          return {
            id: String(master.id),
            name: master.name,
            type: 'Master Account',
            broker: master.broker || '',
            apiKey: master.apiKey || '***',
            status: master.isActive ? 'Active' : 'Inactive',
            copyAccounts: uiCopyAccounts,
          };
        });
        
        // Also store flat list for All Accounts tab
        const flatList = allAccounts.map((acc: any) => ({
          id: String(acc.id),
          name: acc.name,
          type: acc.type === 'master' ? 'Master Account' : 'Copy Account',
          broker: acc.broker || '',
          status: acc.isActive ? 'Active' : 'Inactive',
          masterName: acc.masterAccountName || null,
        }));
        setAllAccountsList(flatList);
        
        // Find unlinked copy accounts (no masterAccountId)
        const unlinked = copyAccounts
          .filter((acc: any) => !acc.masterAccountId)
          .map((acc: any) => ({
            id: String(acc.id),
            name: acc.name,
            type: 'Copy Account',
            broker: acc.broker || '',
            status: acc.isActive ? 'Active' : 'Inactive',
          }));
        setUnlinkedAccounts(unlinked);
        
        console.log('Copy Trading - Final groups:', groups);
        console.log('Copy Trading - Unlinked accounts:', unlinked.length);
        // Only use mock data if no accounts exist at all
        setTradingGroups(groups);
        
        // Also set stats from account data if stats API fails
        const computedStats = [
          { label: 'Total Accounts', value: allAccounts.length.toString(), icon: Users, color: colors.primary, bgColor: 'rgba(37, 99, 235, 0.15)' },
          { label: 'Master Accounts', value: masterAccounts.length.toString(), icon: TrendUp, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
          { label: 'Copy Accounts', value: copyAccounts.length.toString(), icon: Copy, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
          { label: 'Active Accounts', value: allAccounts.filter((a: any) => a.isActive).length.toString(), icon: Sparkle, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
        ];
        setStats(computedStats);
      } else {
        // No data or API failed - show empty state
        console.log('Copy Trading - API failed or no data');
        console.log('Copy Trading - Response:', accountsResponse);
        console.log('Copy Trading - Success:', accountsResponse.success, 'Data:', accountsResponse.data);
        setTradingGroups([]);
        setAllAccountsList([]);
        setUnlinkedAccounts([]);
        // Set default stats to 0
        setStats([
          { label: 'Total Accounts', value: '0', icon: Users, color: colors.primary, bgColor: 'rgba(37, 99, 235, 0.15)' },
          { label: 'Master Accounts', value: '0', icon: TrendUp, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
          { label: 'Copy Accounts', value: '0', icon: Copy, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
          { label: 'Active Accounts', value: '0', icon: Sparkle, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
        ]);
      }
      
      if (statsResponse.success && statsResponse.data) {
        setStats([
          { label: 'Total Accounts', value: (statsResponse.data.totalAccounts || 0).toString(), icon: Users, color: colors.primary, bgColor: 'rgba(37, 99, 235, 0.15)' },
          { label: 'Master Accounts', value: (statsResponse.data.masterAccounts || 0).toString(), icon: TrendUp, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
          { label: 'Copy Accounts', value: (statsResponse.data.childAccounts || 0).toString(), icon: Copy, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
          { label: 'Active Accounts', value: (statsResponse.data.activeAccounts || 0).toString(), icon: Sparkle, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
        ]);
      }
    } catch (error: any) {
      console.error('Error fetching copy trading data:', error);
      console.error('Error details:', error?.message || error);
      console.error('Error response:', error?.response?.data || 'No response data');
      // Show empty state on error instead of mock data
      setTradingGroups([]);
      setAllAccountsList([]);
      setUnlinkedAccounts([]);
      setStats([
        { label: 'Total Accounts', value: '0', icon: Users, color: colors.primary, bgColor: 'rgba(37, 99, 235, 0.15)' },
        { label: 'Master Accounts', value: '0', icon: TrendUp, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
        { label: 'Copy Accounts', value: '0', icon: Copy, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
        { label: 'Active Accounts', value: '0', icon: Sparkle, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
      ]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);
  
  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editBroker, setEditBroker] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editSecretKey, setEditSecretKey] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [showMasterPicker, setShowMasterPicker] = useState(false);
  const [editAccountType, setEditAccountType] = useState('Master Account');
  const [showEditAccountTypeDropdown, setShowEditAccountTypeDropdown] = useState(false);
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false);
  const [showApiAccountDropdown, setShowApiAccountDropdown] = useState(false);
  const [selectedApiAccount, setSelectedApiAccount] = useState('');
  const [accountId, setAccountId] = useState('');
  // Add Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [parentGroupForAdd, setParentGroupForAdd] = useState<any>(null);
  const [addName, setAddName] = useState('');
  const [addBroker, setAddBroker] = useState('');
  const [addApiKey, setAddApiKey] = useState('');
  const [addSecretKey, setAddSecretKey] = useState('');
  const [addIsActive, setAddIsActive] = useState(true);
  const [addAccountType, setAddAccountType] = useState<'master' | 'child'>('master');
  const [showAddAccountTypeDropdown, setShowAddAccountTypeDropdown] = useState(false);
  const [showAddBrokerDropdown, setShowAddBrokerDropdown] = useState(false);
  const [showAddMasterPicker, setShowAddMasterPicker] = useState(false);
  
  // Delete Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);

  const handleEditAccount = (account: any) => {
    setSelectedAccount(account);
    setEditName(account.name);
    setEditBroker(account.broker);
    setEditApiKey(account.apiKey);
    setEditSecretKey('');
    setEditIsActive(account.status === 'Active');
    setEditParentId(null);
    setEditAccountType(account.type || 'Master Account');
    // initialize broker/api/account id for modal
    setSelectedApiAccount('crypto');
    setAccountId('12345678');
    setShowEditModal(true);
  };

  const handleEditCopyAccount = (copyAcc: any, parentGroup: any) => {
    setSelectedAccount({ ...copyAcc, isCopy: true });
    setEditName(copyAcc.name);
    // try to parse broker from detail if present, else fallback to parent broker
    const maybeBroker = parentGroup?.broker || '';
    setEditBroker(maybeBroker);
    setEditApiKey('');
    setEditSecretKey('');
    setEditIsActive(true);
    setEditParentId(parentGroup?.id || null);
    setEditAccountType('Child Account');
    setSelectedApiAccount('crypto');
    setAccountId('');
    setShowEditModal(true);
  };

  // Handler for adding copy account under a master
  const handleOpenAddCopy = (group: any) => {
    setParentGroupForAdd(group);
    setAddAccountType('child');
    setAddName('');
    setAddBroker('');
    setAddApiKey('');
    setAddSecretKey('');
    setAddIsActive(true);
    setShowAddAccountTypeDropdown(false);
    setShowAddBrokerDropdown(false);
    setShowAddMasterPicker(false);
    setShowAddModal(true);
  };

  // Handler for adding new master account
  const handleOpenAddMaster = () => {
    setParentGroupForAdd(null);
    setAddAccountType('master');
    setAddName('');
    setAddBroker('');
    setAddApiKey('');
    setAddSecretKey('');
    setAddIsActive(true);
    setShowAddAccountTypeDropdown(false);
    setShowAddBrokerDropdown(false);
    setShowAddMasterPicker(false);
    setShowAddModal(true);
  };

  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const handleCreateAccount = async () => {
    if (!addName || !addBroker || !addApiKey || !addSecretKey) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    
    // Validate child account requires master selection
    if (addAccountType === 'child' && !parentGroupForAdd) {
      Alert.alert('Error', 'Please select a master account');
      return;
    }
    setIsCreating(true);
    try {
      const response = await copyTradingService.createAccount({
        name: addName,
        type: addAccountType,
        broker: addBroker,
        apiKey: addApiKey,
        secretKey: addSecretKey,
        masterAccountId: addAccountType === 'child' && parentGroupForAdd ? Number(parentGroupForAdd.id) : undefined,
      });
      
      if (response.success) {
        Alert.alert('Success', response.message || 'Account created successfully');
        setShowAddModal(false);
        setParentGroupForAdd(null);
        setAddName('');
        setAddBroker('');
        setAddApiKey('');
        setAddSecretKey('');
        setAddAccountType('master');
        fetchData(); // Refresh the list
      } else {
        Alert.alert('Error', response.error || 'Failed to create account');
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;
    
    setIsUpdating(true);
    try {
      const updateData: any = {};
      if (editName) updateData.name = editName;
      if (editBroker) updateData.broker = editBroker;
      if (editApiKey && editApiKey !== '***' && !editApiKey.startsWith('***')) {
        updateData.apiKey = editApiKey;
      }
      if (editSecretKey) updateData.secretKey = editSecretKey;
      updateData.isActive = editIsActive;
      
      const response = await copyTradingService.updateAccount(
        Number(selectedAccount.id),
        updateData
      );
      
      if (response.success) {
        Alert.alert('Success', 'Account updated successfully');
        setShowEditModal(false);
        setSelectedAccount(null);
        setEditParentId(null);
        fetchData(); // Refresh the list
      } else {
        Alert.alert('Error', response.error || 'Failed to update account');
      }
    } catch (error: any) {
      console.error('Error updating account:', error);
      Alert.alert('Error', error.message || 'Failed to update account');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (accountId: string, currentStatus: string) => {
    setIsToggling(accountId);
    try {
      const newStatus = currentStatus !== 'Active';
      const response = await copyTradingService.toggleStatus(Number(accountId), newStatus);
      
      if (response.success) {
        // Optimistic update
        setTradingGroups(prev => prev.map(acc => 
          acc.id === accountId 
            ? { ...acc, status: newStatus ? 'Active' : 'Inactive' }
            : acc
        ));
        setAllAccountsList(prev => prev.map(acc =>
          acc.id === accountId
            ? { ...acc, status: newStatus ? 'Active' : 'Inactive' }
            : acc
        ));
        Alert.alert('Success', 'Account status updated');
      } else {
        Alert.alert('Error', response.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', error.message || 'Failed to update status');
    } finally {
      setIsToggling(null);
    }
  };

  const handleDeleteClick = (account: any) => {
    setAccountToDelete(account);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await copyTradingService.deleteAccount(Number(accountToDelete.id));
      
      if (response.success) {
        Alert.alert('Success', 'Account deleted successfully');
        setShowDeleteModal(false);
        setAccountToDelete(null);
        fetchData(); // Refresh the list
      } else {
        Alert.alert('Error', response.error || 'Failed to delete account');
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', error.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
      setAccountToDelete(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      {!hideHeader && (
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Copy Trading</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color={theme.text} weight="bold" />
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[{ color: theme.textSecondary, marginTop: 12 }]}>Loading accounts...</Text>
        </View>
      ) : (
        <ScrollView 
          style={hideTop ? [styles.content, { paddingTop: 8 }] : styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* DEBUG INFO - REMOVE LATER */}
          {!hideTop && __DEV__ && (
            <View style={{ padding: 12, margin: 12, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#334155' : '#cbd5e1' }}>
              <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}>Debug Info:</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Trading Groups: {tradingGroups.length}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Unlinked Accounts: {unlinkedAccounts.length}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>All Accounts: {allAccountsList.length}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Active Tab: {activeTab}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Loading: {isLoading.toString()}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Hide Top: {hideTop.toString()}</Text>
            </View>
          )}
          
          {/* Stats Cards */}
          {!hideTop && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsRow}
            >
              {stats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <View 
                    key={index}
                    style={[styles.statCard, {
                      backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : stat.bgColor,
                      borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.5)',
                    }]}
                  >
                    <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}> 
                      <IconComponent size={18} color={stat.color} weight="fill" />
                    </View>
                    <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

        {/* Tabs */}
        {!hideTop && (
          <View style={styles.tabsRow}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'trading' && styles.tabActive]}
              onPress={() => setActiveTab('trading')}
            >
              <Users size={16} color={activeTab === 'trading' ? colors.primary : theme.textSecondary} weight={activeTab === 'trading' ? 'fill' : 'regular'} />
              <Text style={[styles.tabText, activeTab === 'trading' && styles.tabTextActive, { color: activeTab === 'trading' ? colors.primary : theme.textSecondary }]}>
                Trading Groups ({tradingGroups.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'unlinked' && styles.tabActive]}
              onPress={() => setActiveTab('unlinked')}
            >
              <Bank size={16} color={activeTab === 'unlinked' ? colors.primary : theme.textSecondary} weight={activeTab === 'unlinked' ? 'fill' : 'regular'} />
              <Text style={[styles.tabText, activeTab === 'unlinked' && styles.tabTextActive, { color: activeTab === 'unlinked' ? colors.primary : theme.textSecondary }]}>
                Unlinked Accounts ({unlinkedAccounts.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'all' && styles.tabActive]}
              onPress={() => setActiveTab('all')}
            >
              <GearSix size={16} color={activeTab === 'all' ? colors.primary : theme.textSecondary} weight={activeTab === 'all' ? 'fill' : 'regular'} />
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive, { color: activeTab === 'all' ? colors.primary : theme.textSecondary }]}>
                All Accounts
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lists based on active tab */}
        {activeTab === 'trading' && (
          <View style={styles.groupsList}>
            {tradingGroups.length === 0 ? (
              // If there are no master groups but some unlinked child accounts exist,
              // show a helpful banner and list the unlinked accounts so user can link them.
              unlinkedAccounts.length > 0 ? (
                <>
                  <View style={[styles.emptyStateCard, { backgroundColor: isDark ? 'rgba(255, 249, 230, 0.95)' : '#fff7ed', borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(250, 204, 21, 0.25)' }]}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <Warning size={32} color="#d97706" weight="duotone" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.emptyStateTitle, { color: isDark ? '#ffedd5' : '#92400e' }]}>These child accounts need to be linked to a master account to start copy trading.</Text>
                        <Text style={[styles.emptyStateText, { color: isDark ? '#fef3c7' : '#92400e' }]}>Link each child account to a master or create a new master account.</Text>
                      </View>
                      <TouchableOpacity style={[styles.emptyStateButton, { backgroundColor: colors.primary }]} onPress={handleOpenAddMaster}>
                        <Plus size={16} color="#fff" weight="bold" />
                        <Text style={styles.emptyStateButtonText}>Add Master</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Render unlinked child accounts here so user can act immediately */}
                  {unlinkedAccounts.slice(0, unlinkedAccountsVisibleCount).map((account) => (
                    <View key={account.id} style={[styles.groupCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff', borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(250, 204, 21, 0.3)' }]}> 
                      <View style={styles.masterHeader}>
                        <View style={styles.masterLeft}>
                          <View style={[styles.masterIcon, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}> 
                            <Copy size={18} color="#e1a948ff" weight="bold" />
                          </View>
                          <View style={styles.masterInfo}>
                            <Text style={[styles.masterName, { color: theme.text }]}>{account.name}</Text>
                            <View style={styles.masterDetails}>
                              <Text style={[styles.brokerText, { color: theme.textSecondary }]}>{account.broker} • {account.type}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.masterActions}>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]} onPress={() => handleEditAccount({ ...account, type: 'Child Account' })}>
                            <PencilSimple size={13} color={colors.primary} weight="bold" />
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]} onPress={() => handleDeleteClick(account)}>
                            <Trash size={12} color={theme.textSecondary} weight="bold" />
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleOpenAddMaster()}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Link to Master</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
              <View style={[styles.emptyStateCard, { 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff', 
                borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(226, 232, 240, 0.8)' 
              }]}> 
                <Warning size={48} color={isDark ? '#a1a1aa' : '#6b7280'} weight="duotone" />
                <Text style={[styles.emptyStateTitle, { color: isDark ? '#ffffff' : '#1f2937' }]}>No Trading Groups Yet</Text>
                <Text style={[styles.emptyStateText, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>Start by creating your first master trading account to begin copy trading.</Text>
                <TouchableOpacity
                  style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
                  onPress={handleOpenAddMaster}
                >
                  <Plus size={16} color="#fff" weight="bold" />
                  <Text style={styles.emptyStateButtonText}>Add Master Account</Text>
                </TouchableOpacity>
              </View>
              )
            ) : (

              <>
                {tradingGroups.slice(0, tradingGroupsVisibleCount).map((group) => (
                  <View 
                    key={group.id}
                    style={[styles.groupCard, {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff',
                      borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(226, 232, 240, 0.8)',
                    }]}
                  >
                    {/* Master Account Header */}
                    <View style={styles.masterHeader}>
                      <View style={styles.masterLeft}>
                        <View style={[styles.masterIcon, { backgroundColor: colors.primary + '15' }]}>
                          <TrendUp size={18} color={colors.primary} weight="bold" />
                        </View>
                        <View style={styles.masterInfo}>
                          <Text style={[styles.masterName, { color: theme.text }]}>{group.name}</Text>
                          <View style={styles.masterDetails}>
                            <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                              <Text style={styles.typeBadgeText}>{group.type}</Text>
                            </View>
                            <Text style={[styles.brokerText, { color: theme.textSecondary }]}>{group.broker}</Text>
                            <View style={styles.statusDot}>
                              <View style={[styles.dot, { backgroundColor: group.status === 'Active' ? '#10b981' : '#94a3b8' }]} />
                              <Text style={[styles.statusText, { color: group.status === 'Active' ? '#10b981' : '#94a3b8' }]}>
                                {group.status}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles.masterActions}>
                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)' }]}
                          onPress={() => handleEditAccount(group)}
                        >
                          <PencilSimple size={13} color={colors.primary} weight="bold" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: group.status === 'Active' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(148, 163, 184, 0.06)' }]}
                          onPress={() => handleToggleStatus(group.id, group.status)}
                          disabled={isToggling === group.id}
                        >
                          {isToggling === group.id ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Sparkle size={12} color={group.status === 'Active' ? '#10b981' : '#94a3b8'} weight="fill" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}
                          onPress={() => handleDeleteClick(group)}
                        >
                          <Trash size={12} color={theme.textSecondary} weight="bold" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Copy Accounts Section */}
                    {!group.copyAccounts || group.copyAccounts.length === 0 ? (
                      <View style={[styles.emptyState, { backgroundColor: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 0.8)' }]}>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No copy accounts linked to this master</Text>
                        <TouchableOpacity style={[styles.addCopyBtn, { borderColor: colors.primary }]} onPress={() => handleOpenAddCopy(group)}>
                          <Plus size={16} color={colors.primary} weight="bold" />
                          <Text style={[styles.addCopyText, { color: colors.primary }]}>Add Copy Account</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.copyAccountsSection}>
                        <Text style={[styles.copyAccountsTitle, { color: theme.text }]}>Copy Accounts ({group.copyAccounts?.length || 0})</Text>
                        <View style={styles.copyAccountsList}>
                          {group.copyAccounts?.map((copyAcc: { id: string; name: string; detail: string }) => (
                            <View key={copyAcc.id} style={[styles.copyAccountCard, { backgroundColor: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(248, 250, 252, 0.9)', borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)' }]}> 
                              <View style={[styles.copyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F3F4F6' }]}> 
                                <Copy size={12} color={theme.textSecondary} weight="bold" />
                              </View>
                              <View style={styles.copyInfo}>
                                <Text style={[styles.copyName, { color: theme.text }]}>{copyAcc.name}</Text>
                                <Text style={[styles.copyDetail, { color: theme.textSecondary }]}>{copyAcc.detail}</Text>
                              </View>
                              <TouchableOpacity style={[styles.copyActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.03)' }]} onPress={() => handleEditCopyAccount(copyAcc, group)}>
                                <PencilSimple size={12} color={theme.textTertiary || theme.textSecondary} weight="bold" />
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.copyActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.03)' }]} onPress={() => handleDeleteClick({ ...copyAcc, parentId: group.id, isCopy: true })}>
                                <Trash size={12} color={theme.textTertiary || theme.textSecondary} weight="bold" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ))}
                {tradingGroups.length > tradingGroupsVisibleCount && (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { borderColor: colors.primary }]}
                    onPress={() => setTradingGroupsVisibleCount(prev => prev + 10)}
                  >
                    <ArrowsClockwise size={16} color={colors.primary} weight="bold" />
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                      Load More 
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {activeTab === 'all' && (
          <View style={styles.groupsList}>
            {allAccountsList.length === 0 ? (
              <View style={[styles.emptyStateCard, { 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff', 
                borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(226, 232, 240, 0.8)' 
              }]}>
                <GearSix size={48} color={isDark ? '#a1a1aa' : '#6b7280'} weight="duotone" />
                <Text style={[styles.emptyStateTitle, { color: isDark ? '#ffffff' : '#1f2937' }]}>No Accounts Yet</Text>
                <Text style={[styles.emptyStateText, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>Start by creating your first trading account</Text>
                <TouchableOpacity
                  style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
                  onPress={handleOpenAddMaster}
                >
                  <Plus size={16} color="#fff" weight="bold" />
                  <Text style={styles.emptyStateButtonText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            ) : (
            /* All accounts as individual cards like web version */
            <>
              {allAccountsList.slice(0, allAccountsVisibleCount).map((account: any) => (
                <View key={account.id} style={[styles.groupCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff', borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(226, 232, 240, 0.8)' }]}>
                  <View style={styles.masterHeader}>
                    <View style={styles.masterLeft}>
                      <View style={[styles.masterIcon, { backgroundColor: account.type === 'Master Account' ? colors.primary + '15' : 'rgba(16, 185, 129, 0.15)' }]}>
                        {account.type === 'Master Account' ? (
                          <TrendUp size={18} color={colors.primary} weight="bold" />
                        ) : (
                          <Copy size={18} color="#10b981" weight="bold" />
                        )}
                      </View>
                      <View style={styles.masterInfo}>
                        <Text style={[styles.masterName, { color: theme.text }]}>{account.name}</Text>
                        <View style={styles.masterDetails}>
                          <Text style={[styles.brokerText, { color: theme.textSecondary }]}>
                            {account.broker} • {account.type}
                          </Text>
                        </View>
                        <View style={[styles.statusBadgeSmall, { backgroundColor: account.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)' }]}>
                          <Text style={[styles.statusBadgeText, { color: account.status === 'Active' ? '#10b981' : '#94a3b8' }]}>{account.status}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.masterActions}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)' }]}
                        onPress={() => handleEditAccount({ ...account, type: account.type === 'Master Account' ? 'Master Account' : 'Child Account' })}
                      >
                        <PencilSimple size={13} color={colors.primary} weight="bold" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: account.status === 'Active' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(148, 163, 184, 0.06)' }]}
                        onPress={() => handleToggleStatus(account.id, account.status)}
                        disabled={isToggling === account.id}
                      >
                        {isToggling === account.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Sparkle size={12} color={account.status === 'Active' ? '#10b981' : '#94a3b8'} weight="fill" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}
                        onPress={() => handleDeleteClick(account)}
                      >
                        <Trash size={12} color={theme.textSecondary} weight="bold" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
              {allAccountsList.length > allAccountsVisibleCount && (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, { borderColor: colors.primary }]}
                  onPress={() => setAllAccountsVisibleCount(prev => prev + 10)}
                >
                  <ArrowsClockwise size={16} color={colors.primary} weight="bold" />
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                    Load More 
                  </Text>
                </TouchableOpacity>
              )}
            </>
            )}
          </View>
        )}

        {activeTab === 'unlinked' && (
          <View style={styles.groupsList}>
            {unlinkedAccounts.length === 0 ? (
              <View style={[styles.emptyStateCard, { 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff', 
                borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(226, 232, 240, 0.8)' 
              }]}>
                <CheckSquare size={48} color="#10b981" weight="duotone" />
                <Text style={[styles.emptyStateTitle, { color: isDark ? '#ffffff' : '#1f2937' }]}>All Accounts Properly Linked</Text>
                <Text style={[styles.emptyStateText, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>Every child account has a master to copy from</Text>
              </View>
            ) : (
              <>
                {unlinkedAccounts.slice(0, unlinkedAccountsVisibleCount).map((account) => (
                  <View key={account.id} style={[styles.groupCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff', borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(226, 232, 240, 0.8)' }]}>
                    <View style={styles.masterHeader}>
                      <View style={styles.masterLeft}>
                        <View style={[styles.masterIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                          <Copy size={18} color="#e1a948ff" weight="bold" />
                        </View>
                        <View style={styles.masterInfo}>
                          <Text style={[styles.masterName, { color: theme.text }]}>{account.name}</Text>
                          <View style={styles.masterDetails}>
                            <Text style={[styles.brokerText, { color: theme.textSecondary }]}>{account.broker} • {account.type}</Text>
                          </View>
                          <View style={[styles.statusBadgeSmall, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>Unlinked</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.masterActions}>
                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)' }]}
                          onPress={() => handleEditAccount({ ...account, type: 'Child Account' })}
                        >
                          <PencilSimple size={13} color={colors.primary} weight="bold" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}
                          onPress={() => handleDeleteClick(account)}
                        >
                          <Trash size={12} color={theme.textSecondary} weight="bold" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
                {unlinkedAccounts.length > unlinkedAccountsVisibleCount && (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { borderColor: colors.primary }]}
                    onPress={() => setUnlinkedAccountsVisibleCount(prev => prev + 10)}
                  >
                    <ArrowsClockwise size={16} color={colors.primary} weight="bold" />
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                      Load More 
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Edit Account Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editModalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.editModalTitle, { color: theme.text }]}>Edit Account</Text>

            <View style={styles.editForm}>
              {/* Account Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Account Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Account Name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              {/* Account Type */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Account Type *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                  onPress={() => setShowEditAccountTypeDropdown(!showEditAccountTypeDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: theme.text }]}>{editAccountType}</Text>
                  <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
                {showEditAccountTypeDropdown && (
                  <View style={styles.dropdownPicker}>
                    <TouchableOpacity style={styles.pickerItem} onPress={() => { setEditAccountType('Master Account'); setShowEditAccountTypeDropdown(false); }}>
                      <Text style={[styles.pickerItemText, { color: theme.text }]}>Master Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pickerItem} onPress={() => { setEditAccountType('Child Account'); setShowEditAccountTypeDropdown(false); }}>
                      <Text style={[styles.pickerItemText, { color: theme.text }]}>Child Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {selectedAccount?.isCopy && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Master Account to Follow *</Text>
                  <TouchableOpacity
                    style={[styles.dropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowMasterPicker(!showMasterPicker)}
                  >
                    <Text style={[styles.dropdownText, { color: theme.text }]}>{tradingGroups.find(g => g.id === editParentId)?.name || 'Select Master Account'}</Text>
                    <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                  </TouchableOpacity>

                  {showMasterPicker && (
                    <View style={styles.dropdownPicker}>
                      {tradingGroups.map(g => (
                        <TouchableOpacity
                          key={g.id}
                          onPress={() => { setEditParentId(g.id); setShowMasterPicker(false); }}
                          style={styles.pickerItem}
                        >
                          <Text style={[styles.pickerItemText, { color: theme.text }]}>{g.name} {g.broker ? `(${g.broker.slice(0, 12)})` : ''}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Broker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Broker *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                  onPress={() => setShowBrokerDropdown(!showBrokerDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: editBroker ? theme.text : theme.textSecondary }]}>
                    {editBroker || 'Select Broker'}
                  </Text>
                  <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
                {showBrokerDropdown && (
                  <View style={styles.dropdownPicker}>
                    <TouchableOpacity style={styles.pickerItem} onPress={() => { setEditBroker('Binance'); setShowBrokerDropdown(false); }}>
                      <Text style={[styles.pickerItemText, { color: theme.text }]}>Binance</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {/* Select API Account */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Select API Account *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                  onPress={() => setShowApiAccountDropdown(!showApiAccountDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: selectedApiAccount ? theme.text : theme.textSecondary }]}>
                    {selectedApiAccount || 'Select API Account'}
                  </Text>
                  <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
                {showApiAccountDropdown && (
                  <View style={styles.dropdownPicker}>
                    <TouchableOpacity style={styles.pickerItem} onPress={() => { setSelectedApiAccount('crypto'); setAccountId('12345678'); setShowApiAccountDropdown(false); }}>
                      <Text style={[styles.pickerItemText, { color: theme.text }]}>crypto</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>Select from your existing API keys</Text>
              </View>

              {/* Account ID */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Account ID *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.05)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                  value={accountId}
                  editable={false}
                  placeholder="Account ID"
                  placeholderTextColor={theme.textSecondary}
                />
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>Auto-filled from selected API account</Text>
              </View>

              {/* Active Toggle */}
              <View style={styles.toggleRow}>
                <TouchableOpacity 
                  style={[styles.toggleSwitch, { backgroundColor: editIsActive ? colors.primary : theme.border }]}
                  onPress={() => setEditIsActive(!editIsActive)}
                >
                  <View style={[styles.toggleKnob, { marginLeft: editIsActive ? 22 : 2 }]} />
                </TouchableOpacity>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Active</Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.editModalActions}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { borderColor: colors.primary }]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.updateBtn, { backgroundColor: editName && editBroker && !isUpdating ? colors.primary : theme.border }]}
                onPress={handleUpdateAccount}
                disabled={!editName || !editBroker || isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[styles.updateBtnText, { color: editName && editBroker ? '#ffffff' : theme.textSecondary }]}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Account Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView 
            style={{ maxHeight: '90%' }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.editModalContent, { backgroundColor: theme.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={[styles.editModalTitle, { color: theme.text, marginBottom: 0 }]}>
                {addAccountType === 'master' ? 'Add Master Account' : 'Add Copy Account'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color={theme.textSecondary} weight="bold" />
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Account Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                  value={addName}
                  onChangeText={setAddName}
                  placeholder="Account Name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Account Type *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                  onPress={() => setShowAddAccountTypeDropdown(!showAddAccountTypeDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: theme.text }]}>
                    {addAccountType === 'master' ? 'Master Account' : 'Copy Account'}
                  </Text>
                  <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                </TouchableOpacity>
                {showAddAccountTypeDropdown && (
                  <View style={[styles.dropdownPicker, { backgroundColor: isDark ? theme.surface : '#ffffff', borderColor: theme.border }]}>
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => { setAddAccountType('master'); setParentGroupForAdd(null); setShowAddAccountTypeDropdown(false); }}
                    >
                      <Text style={[styles.pickerItemText, { color: theme.text }]}>Master Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => { setAddAccountType('child'); setShowAddAccountTypeDropdown(false); }}
                    >
                      <Text style={[styles.pickerItemText, { color: theme.text }]}>Copy Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Master Account Picker - only show when adding child account */}
              {addAccountType === 'child' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Select Master Account *</Text>
                  <TouchableOpacity
                    style={[styles.dropdown, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', borderColor: theme.border }]}
                    onPress={() => setShowAddMasterPicker(!showAddMasterPicker)}
                  >
                    <Text style={[styles.dropdownText, { color: parentGroupForAdd ? theme.text : theme.textSecondary }]}>
                      {parentGroupForAdd ? parentGroupForAdd.name : 'Select Master Account'}
                    </Text>
                    <CaretDown size={16} color={theme.textSecondary} weight="bold" />
                  </TouchableOpacity>
                  {showAddMasterPicker && (
                    <View style={[styles.dropdownPicker, { backgroundColor: isDark ? theme.surface : '#ffffff', borderColor: theme.border }]}>
                      {tradingGroups.length === 0 ? (
                        <View style={styles.pickerItem}>
                          <Text style={[styles.pickerItemText, { color: theme.textSecondary }]}>No master accounts available</Text>
                        </View>
                      ) : (
                        tradingGroups.map(g => (
                          <TouchableOpacity
                            key={g.id}
                            style={styles.pickerItem}
                            onPress={() => { setParentGroupForAdd(g); setShowAddMasterPicker(false); }}
                          >
                            <Text style={[styles.pickerItemText, { color: theme.text }]}>{g.name} {g.broker ? `(${g.broker})` : ''}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Broker *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                  value={addBroker}
                  onChangeText={setAddBroker}
                  placeholder="e.g., Binance, Delta Exchange"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>API Key *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                  value={addApiKey}
                  onChangeText={setAddApiKey}
                  placeholder="Your API Key"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Secret Key *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? 'rgba(10, 10, 26, 0.5)' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                  value={addSecretKey}
                  onChangeText={setAddSecretKey}
                  placeholder="Your Secret Key"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                />
              </View>

              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleSwitch, { backgroundColor: addIsActive ? colors.primary : theme.border }]}
                  onPress={() => setAddIsActive(!addIsActive)}
                >
                  <View style={[styles.toggleKnob, { marginLeft: addIsActive ? 22 : 2 }]} />
                </TouchableOpacity>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Active</Text>
              </View>
            </View>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.primary }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.updateBtn, { backgroundColor: addName && addBroker && addApiKey && addSecretKey && !isCreating ? colors.primary : theme.border }]}
                onPress={handleCreateAccount}
                disabled={!addName || !addBroker || !addApiKey || !addSecretKey || isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[styles.updateBtnText, { color: addName && addBroker && addApiKey && addSecretKey ? '#ffffff' : theme.textSecondary }]}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.deleteModalHeader}>
              <Warning size={24} color={colors.error} weight="fill" />
              <Text style={[styles.deleteModalTitle, { color: theme.text }]}>Delete Account</Text>
            </View>
            
            <Text style={[styles.deleteModalText, { color: theme.textSecondary }]}>
              Are you sure you want to delete the account:
            </Text>
            <Text style={[styles.deleteAccountName, { color: colors.error }]}>
              "{accountToDelete?.name}"
            </Text>

            <View style={[styles.deleteWarningBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Text style={[styles.deleteWarningText, { color: colors.error }]}>
                This action cannot be undone. All associated data will be permanently deleted.
              </Text>
            </View>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={[styles.deleteCancelBtn, { borderColor: colors.primary }]}
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.deleteCancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteConfirmBtn, { backgroundColor: isDeleting ? theme.border : colors.error }]}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete Account</Text>
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
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsRow: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 100,
    ...shadows.sm,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  groupsList: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 250,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  groupCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  masterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  masterLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: spacing.md,
  },
  masterIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterInfo: {
    flex: 1,
  },
  masterName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  masterDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  brokerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  masterActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    width: 33,
    height: 33,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  addCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  addCopyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  copyAccountsSection: {
    marginTop: spacing.sm,
  },
  copyAccountsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  copyAccountsList: {
    gap: spacing.sm,
  },
  copyAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  copyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  copyInfo: {
    flex: 1,
  },
  copyName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  copyDetail: {
    fontSize: 11,
  },
  copyActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editModalContent: {
    width: width - 40,
    maxHeight: '85%',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  editModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  editForm: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dropdownText: {
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  dropdownPicker: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  pickerItemText: {
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  editModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  updateBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  updateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteModalContent: {
    width: width - 48,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
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
  deleteAccountName: {
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
  deleteWarningText: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  deleteCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  deleteConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
