import { colors, getTheme } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { apiKeyService, copyTradingService } from '@/services';
import {
    ArrowRight,
    CaretDown,
    Copy,
    GearSix,
    Link,
    PencilSimple,
    Plus,
    Sparkle,
    Star,
    Trash,
    TrendUp,
    Users,
    Warning,
    WifiHigh,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import CopyTradingScreen from '../copy-trading';

export default function WatchlistScreen() {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const [activeTab, setActiveTab] = useState<'trading-groups' | 'unlinked' | 'all'>('trading-groups');
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('Master Account');
  const [broker, setBroker] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showAccountTypeDropdown, setShowAccountTypeDropdown] = useState(false);
  
  // API loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [masterAccounts, setMasterAccounts] = useState<any[]>([]);
  const [copyAccounts, setCopyAccounts] = useState<any[]>([]);
  const [unlinkedAccounts, setUnlinkedAccounts] = useState<any[]>([]);
  const [apiAccounts, setApiAccounts] = useState<any[]>([]);
  
  // Pagination states for Load More functionality
  const [unlinkedVisibleCount, setUnlinkedVisibleCount] = useState(10);
  const [allAccountsVisibleCount, setAllAccountsVisibleCount] = useState(10);
  
  // Link to Master modal states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedUnlinkedAccount, setSelectedUnlinkedAccount] = useState<any>(null);
  const [selectedMasterAccount, setSelectedMasterAccount] = useState('');
  const [showMasterDropdown, setShowMasterDropdown] = useState(false);
  const [linkEditName, setLinkEditName] = useState('');
  const [linkEditBroker, setLinkEditBroker] = useState('');
  const [linkEditApiKey, setLinkEditApiKey] = useState('');
  const [linkEditSecretKey, setLinkEditSecretKey] = useState('');
  const [linkEditIsActive, setLinkEditIsActive] = useState(true);
  const [linkEditAccountType, setLinkEditAccountType] = useState('Child Account');
  const [showLinkAccountTypeDropdown, setShowLinkAccountTypeDropdown] = useState(false);
  const [selectedAllAccount, setSelectedAllAccount] = useState<any>(null);
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false);
  const [showApiAccountDropdown, setShowApiAccountDropdown] = useState(false);
  const [selectedApiAccount, setSelectedApiAccount] = useState('');
  const [accountId, setAccountId] = useState('');

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const [accountsRes, statsRes, apiKeysRes] = await Promise.all([
        copyTradingService.getAccounts(),
        copyTradingService.getStatistics(),
        apiKeyService.getApiKeys(),
      ]);

      if (accountsRes.data) {
        const masters = accountsRes.data.filter((a: any) => a.type === 'master');
        const copies = accountsRes.data.filter((a: any) => a.type === 'child');
        
        setMasterAccounts(masters.map((m: any) => ({
          id: m.id,
          name: m.name,
          broker: m.broker || 'N/A',
          type: 'Master Account',
          status: m.isActive ? 'Active' : 'Inactive',
          following: null,
        })));

        setCopyAccounts(copies.map((c: any) => ({
          id: c.id,
          name: c.name,
          broker: c.broker || 'N/A',
          type: 'Copy Account',
          status: c.isActive ? 'Active' : 'Inactive',
          following: c.masterAccount?.name || null,
          masterAccountId: c.masterAccountId,
        })));

        // Unlinked = copy accounts without master
        setUnlinkedAccounts(copies
          .filter((c: any) => !c.masterAccountId)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            broker: c.broker || 'N/A',
            status: 'Not linked to any master account',
          })));

        // Combine all accounts for "All" tab
        const combinedAccounts = accountsRes.data.map((a: any) => ({
          id: a.id,
          name: a.name,
          broker: a.broker || 'N/A',
          type: a.type === 'master' ? 'Master Account' : 'Copy Account',
          status: a.isActive ? 'Active' : 'Inactive',
          following: a.masterAccount?.name || null,
        }));
        setAllAccounts(combinedAccounts);
      }

      if (apiKeysRes.data) {
        setApiAccounts(apiKeysRes.data.map((a: any) => ({
          id: a.id,
          name: a.name,
          exchange: a.exchange,
        })));
      }
    } catch (error) {
      console.error('Error fetching copy trading data:', error);
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
  
  const handleLinkToMaster = (account: any) => {
    setSelectedUnlinkedAccount(account);
    setLinkEditName(account.name);
    setLinkEditBroker(account.broker);
    setLinkEditApiKey('***7d3f');
    setLinkEditSecretKey('');
    setLinkEditIsActive(true);
    setSelectedMasterAccount('');
    setLinkEditAccountType('Child Account');
    setSelectedApiAccount('');
    setAccountId('');
    setShowLinkModal(true);
  };

  const linkCanUpdate = selectedAllAccount 
    ? !!linkEditName && !!linkEditBroker && !!selectedApiAccount && !!accountId
    : !!linkEditName && !!linkEditBroker && !!selectedMasterAccount && !!selectedApiAccount && !!accountId;

  const handleEditAllAccount = (account: any) => {
    setSelectedAllAccount(account);
    setLinkEditName(account.name);
    setLinkEditBroker(account.broker);
    setLinkEditApiKey('***7d3f');
    setLinkEditSecretKey('');
    setLinkEditIsActive(account.status === 'Active');
    setLinkEditAccountType(account.type);
    setSelectedMasterAccount(account.following || '');
    setSelectedApiAccount('crypto');
    setAccountId('12345678');
    setShowLinkModal(true);
  };

  const handleToggleAccountStatus = (account: any) => {
    // Update the account status immediately
    setAllAccounts(prevAccounts => 
      prevAccounts.map(acc => 
        acc.id === account.id 
          ? { ...acc, status: acc.status === 'Active' ? 'Inactive' : 'Active' }
          : acc
      )
    );
    Alert.alert('Success', 'Account status updated');
  };

  const handleDeleteConfirm = (name?: string, onConfirm?: () => void) => {
    Alert.alert(
      'Delete Account',
      name ? `Are you sure you want to delete "${name}"?` : 'Are you sure you want to delete this account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onConfirm && onConfirm() },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Copy Trading</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddAccountModal(true)}
        >
          <Plus size={16} color="#fff" weight="bold" />
          <Text style={styles.addButtonText}>Add New Account</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        {/* Row 1: Total Accounts and Master Accounts */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? theme.surface : '#F8FAFC', borderColor: isDark ? theme.border : 'rgba(226,232,240,0.6)'}]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F3F4F6'}]}>
              <Users size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{allAccounts.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Accounts</Text>
              <Text style={[styles.statDescription, { color: theme.textSecondary }]}>All trading accounts</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? theme.surface : '#F8FAFC', borderColor: isDark ? theme.border : 'rgba(226,232,240,0.6)'}]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F3F4F6'}]}>
              <TrendUp size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{masterAccounts.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Master Accounts</Text>
              <Text style={[styles.statDescription, { color: theme.textSecondary }]}>Strategy providers</Text>
            </View>
          </View>
        </View>

        {/* Row 2: Copy Accounts and Active Accounts */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? theme.surface : '#F8FAFC', borderColor: isDark ? theme.border : 'rgba(226,232,240,0.6)'}]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F3F4F6'}]}>
              <Copy size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{copyAccounts.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Copy Accounts</Text>
              <Text style={[styles.statDescription, { color: theme.textSecondary }]}>Strategy followers</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? theme.surface : '#F8FAFC', borderColor: isDark ? theme.border : 'rgba(226,232,240,0.6)'}]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F3F4F6'}]}>
              <Star size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{allAccounts.filter(a => a.status === 'Active').length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Accounts</Text>
              <Text style={[styles.statDescription, { color: theme.textSecondary }]}>Currently trading</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'trading-groups' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('trading-groups')}
        >
          <Users 
            size={18} 
            color={activeTab === 'trading-groups' ? colors.primary : theme.textSecondary}
            weight={activeTab === 'trading-groups' ? 'fill' : 'regular'}
          />
          <Text style={[styles.tabText, { color: activeTab === 'trading-groups' ? colors.primary : theme.textSecondary }]}>
            Trading Groups ({masterAccounts.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'unlinked' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('unlinked')}
        >
          <Link 
            size={18} 
            color={activeTab === 'unlinked' ? colors.primary : theme.textSecondary}
            weight={activeTab === 'unlinked' ? 'fill' : 'regular'}
          />
          <Text style={[styles.tabText, { color: activeTab === 'unlinked' ? colors.primary : theme.textSecondary }]}>
            Unlinked Accounts ({unlinkedAccounts.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('all')}
        >
          <GearSix 
            size={18} 
            color={activeTab === 'all' ? colors.primary : theme.textSecondary}
            weight={activeTab === 'all' ? 'fill' : 'regular'}
          />
          <Text style={[styles.tabText, { color: activeTab === 'all' ? colors.primary : theme.textSecondary }]}>
            All Accounts
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'trading-groups' && (
          <CopyTradingScreen hideHeader hideTop />
        )}

        {activeTab === 'unlinked' && (
          <View style={styles.unlinkedContainer}>
            {unlinkedAccounts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: theme.inputBg }]}>
                  <Link size={48} color={theme.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>All Accounts Linked</Text>
                <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
                  Every child account is properly linked to a master account
                </Text>
              </View>
            ) : (
              <>
                {/* Warning Banner */}
                <View style={[styles.warningBanner, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#FEF3C7' }]}>
                  <Warning size={20} color="#F59E0B" weight="fill" />
                  <Text style={[styles.warningText, { color: '#D97706' }]}>
                    These child accounts need to be linked to a master account to start copy trading.
                  </Text>
                </View>
                
                {/* Unlinked Account Cards */}
                {unlinkedAccounts.slice(0, unlinkedVisibleCount).map((account) => (
                  <View 
                    key={account.id}
                    style={[styles.unlinkedCard, { 
                      backgroundColor: theme.surface, 
                      borderColor: '#F59E0B',
                    }]}
                  >
                    <View style={styles.unlinkedTopRow}>
                      <View style={[styles.unlinkedIcon, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#FEF3C7' }]}>
                        <WifiHigh size={24} color="#F59E0B" weight="fill" />
                      </View>
                      <View style={styles.unlinkedInfo}>
                        <Text style={[styles.unlinkedName, { color: theme.text }]}>{account.name}</Text>
                        <Text style={[styles.unlinkedDetail, { color: theme.textSecondary }]}> {account.broker} • {account.status}</Text>
                      </View>
                    </View>

                    <View style={styles.unlinkedBottomRow}>
                      <View style={{ flex: 1 }} />
                      <View style={styles.unlinkedActionsRow}>
                        <TouchableOpacity 
                          style={styles.linkButton}
                          onPress={() => handleLinkToMaster(account)}
                        >
                          <ArrowRight size={16} color="#fff" weight="bold" />
                          <Text style={styles.linkButtonText}>Link to Master</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.unlinkedDeleteBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                          onPress={() => handleDeleteConfirm(account.name)}
                        >
                          <Trash size={18} color={colors.error} weight="bold" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
                {/* Load More Button for Unlinked Accounts */}
                {unlinkedAccounts.length > unlinkedVisibleCount && (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : colors.primary + '15', borderColor: colors.primary }]}
                    onPress={() => setUnlinkedVisibleCount(prev => prev + 10)}
                  >
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {activeTab === 'all' && (
          <View style={styles.allAccountsContainer}>
            {allAccounts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: theme.inputBg }]}>
                  <GearSix size={48} color={theme.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Accounts Yet</Text>
                <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
                  Start by creating your first trading account to begin copy trading
                </Text>
                <TouchableOpacity 
                  style={[styles.createButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowAddAccountModal(true)}
                >
                  <Plus size={20} color="#fff" weight="bold" />
                  <Text style={styles.createButtonText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Account Grid */}
                <View style={styles.accountsGrid}>
                  {allAccounts.slice(0, allAccountsVisibleCount).map((account) => (
                <View 
                  key={account.id}
                  style={[styles.accountCard, { 
                    backgroundColor: theme.surface, 
                    borderColor: theme.border,
                  }]}
                >
                  <View style={styles.accountCardHeader}>
                    <View style={[styles.accountIcon, { 
                      backgroundColor: account.type === 'Master Account' 
                        ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5') 
                        : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE')
                    }]}>
                      {account.type === 'Master Account' ? (
                        <TrendUp size={20} color="#10B981" weight="bold" />
                      ) : (
                        <Copy size={20} color="#3B82F6" weight="bold" />
                      )}
                    </View>
                    <View style={styles.accountInfoWrap}>
                      <View style={styles.accountInfoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.accountCardName, { color: theme.text }]} numberOfLines={1}>{account.name}</Text>
                          <Text style={[styles.accountCardDetail, { color: theme.textSecondary }]} numberOfLines={1}>
                            {account.broker} • {account.type}
                          </Text>
                        </View>
                        <View style={styles.accountCardActions}>
                          <TouchableOpacity style={styles.accountActionBtn} onPress={() => handleEditAllAccount(account)}>
                            <PencilSimple size={14} color={theme.textTertiary || theme.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.accountActionBtn} onPress={() => handleToggleAccountStatus(account)}>
                            <Sparkle size={14} color={theme.textTertiary || theme.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.accountActionBtn} onPress={() => handleDeleteConfirm(account.name)}>
                            <Trash size={14} color={theme.textTertiary || theme.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.accountCardFooter}>
                        <View style={[styles.statusBadge, { 
                          backgroundColor: account.status === 'Active' ? '#D1FAE5' : (isDark ? 'rgba(148, 163, 184, 0.2)' : '#F1F5F9'),
                          borderColor: account.status === 'Active' ? '#10B981' : '#94A3B8',
                        }]}>
                          <Text style={[styles.statusBadgeText, { 
                            color: account.status === 'Active' ? '#059669' : '#64748B' 
                          }]}>{account.status}</Text>
                        </View>
                        {account.following && (
                          <View style={[styles.followingBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: '#3B82F6' }]}>
                            <Text style={[styles.followingBadgeText, { color: '#2563EB' }]}>Following: {account.following}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            {/* Load More Button for All Accounts */}
            {allAccounts.length > allAccountsVisibleCount && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : colors.primary + '15', borderColor: colors.primary }]}
                onPress={() => setAllAccountsVisibleCount(prev => prev + 10)}
              >
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
              </TouchableOpacity>
            )}
          </>
            )}
          </View>
        )}

        <View style={{ height: Platform.OS === 'android' ? 80 : 100 }} />
      </ScrollView>

      {/* Link to Master Modal */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            setShowLinkModal(false);
            setSelectedUnlinkedAccount(null);
            setSelectedAllAccount(null);
          }}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={[styles.linkModalContent, { backgroundColor: theme.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedAllAccount ? 'Edit Account' : 'Edit Account'}
            </Text>

            <View style={styles.linkModalForm}>
              {/* Account Name */}
              <View style={styles.linkInputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Account Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={linkEditName}
                  onChangeText={setLinkEditName}
                  placeholder="Account Name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              {/* Account Type */}
              <View style={styles.linkInputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Account Type *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowLinkAccountTypeDropdown(!showLinkAccountTypeDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: theme.text }]}>{linkEditAccountType}</Text>
                  <CaretDown size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                {showLinkAccountTypeDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => { setLinkEditAccountType('Master Account'); setShowLinkAccountTypeDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>Master Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => { setLinkEditAccountType('Child Account'); setShowLinkAccountTypeDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>Child Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Broker */}
              <View style={styles.linkInputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Broker *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowBrokerDropdown(!showBrokerDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: linkEditBroker ? theme.text : theme.textSecondary }]}>
                    {linkEditBroker || 'Select Broker'}
                  </Text>
                  <CaretDown size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                {showBrokerDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => { setLinkEditBroker('Binance'); setShowBrokerDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>Binance</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Select API Account */}
              <View style={styles.linkInputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select API Account *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowApiAccountDropdown(!showApiAccountDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: selectedApiAccount ? theme.text : theme.textSecondary }]}>
                    {selectedApiAccount || 'Select API Account'}
                  </Text>
                  <CaretDown size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                {showApiAccountDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => { 
                        setSelectedApiAccount('crypto');
                        setAccountId('12345678');
                        setShowApiAccountDropdown(false); 
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>crypto</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>Select from your existing API keys</Text>
              </View>

              {/* Account ID */}
              <View style={styles.linkInputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Account ID *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }]}
                  value={accountId}
                  editable={false}
                  placeholder="Account ID"
                  placeholderTextColor={theme.textSecondary}
                />
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>Auto-filled from selected API account</Text>
              </View>

              {/* Active Toggle */}
              <View style={styles.activeToggleContainer}>
                <Switch
                  value={linkEditIsActive}
                  onValueChange={setLinkEditIsActive}
                  trackColor={{ false: '#E5E7EB', true: colors.primary }}
                  thumbColor="#fff"
                />
                <Text style={[styles.activeToggleText, { color: theme.text }]}>Active</Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.linkModalActions}>
              <TouchableOpacity 
                style={[styles.linkCancelButton, { borderColor: colors.primary }]}
                onPress={() => {
                  setShowLinkModal(false);
                  setSelectedUnlinkedAccount(null);
                  setSelectedAllAccount(null);
                }}
              >
                <Text style={[styles.linkCancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.linkUpdateButton, { backgroundColor: linkCanUpdate ? colors.primary : theme.border }]}
                onPress={() => {
                  if (linkCanUpdate) {
                    Alert.alert('Success', 'Account updated successfully');
                    setShowLinkModal(false);
                    setSelectedUnlinkedAccount(null);
                    setSelectedAllAccount(null);
                  }
                }}
                disabled={!linkCanUpdate}
              >
                <Text style={[styles.linkUpdateText, { color: linkCanUpdate ? '#ffffff' : theme.textSecondary }]}>Update</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add Account Modal */}
      <Modal
        visible={showAddAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add New Account</Text>

            <View style={styles.modalForm}>
              {/* Account Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Account Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder=""
                  placeholderTextColor={theme.textSecondary}
                  value={accountName}
                  onChangeText={setAccountName}
                />
              </View>

              {/* Account Type */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Account Type *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowAccountTypeDropdown(!showAccountTypeDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: theme.text }]}>{accountType}</Text>
                  <CaretDown size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                {showAccountTypeDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => { setAccountType('Master Account'); setShowAccountTypeDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>Master Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => { setAccountType('Child Account'); setShowAccountTypeDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>Child Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Broker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Broker *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowBrokerDropdown(!showBrokerDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: broker ? theme.text : theme.textSecondary }]}>{broker || 'Select Broker'}</Text>
                  <CaretDown size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                {showBrokerDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setBroker('Binance'); setShowBrokerDropdown(false); }}>
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>Binance</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Select API Account */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select API Account *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setShowApiAccountDropdown(!showApiAccountDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: selectedApiAccount ? theme.text : theme.textSecondary }]}>{selectedApiAccount || 'Select API Account'}</Text>
                  <CaretDown size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                {showApiAccountDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSelectedApiAccount('crypto'); setAccountId('12345678'); setShowApiAccountDropdown(false); }}>
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>crypto</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>Select from your existing API keys</Text>
              </View>

              {/* Account ID */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Account ID *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }]}
                  value={accountId}
                  editable={false}
                  placeholder="Account ID"
                  placeholderTextColor={theme.textSecondary}
                />
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>Auto-filled from selected API account</Text>
              </View>

              {/* Active Toggle */}
              <View style={styles.toggleContainer}>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#d1d5db', true: colors.primary }}
                  thumbColor="#fff"
                />
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Active</Text>
              </View>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#E0E7FF' }]}
                onPress={() => {
                  setShowAddAccountModal(false);
                  setAccountName('');
                  setBroker('');
                  setApiKey('');
                  setSecretKey('');
                  setAccountType('Master Account');
                  setIsActive(true);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.createButtonModal, { backgroundColor: (accountName && accountType && broker && selectedApiAccount && accountId) ? colors.primary : '#E5E7EB' }]}
                onPress={() => {
                  if (!(accountName && accountType && broker && selectedApiAccount && accountId)) return;
                  // add to allAccounts list
                  const newAcc = {
                    id: String(Date.now()),
                    name: accountName,
                    broker: broker,
                    type: accountType,
                    status: isActive ? 'Active' : 'Inactive',
                    following: null,
                  };
                  setAllAccounts(prev => [newAcc, ...prev]);
                  Alert.alert('Success', 'Account created successfully');
                  setShowAddAccountModal(false);
                  setAccountName('');
                  setBroker('');
                  setAccountType('Master Account');
                  setApiKey('');
                  setSecretKey('');
                  setIsActive(true);
                  setSelectedApiAccount('');
                  setAccountId('');
                }}
                disabled={!(accountName && accountType && broker && selectedApiAccount && accountId)}
              >
                <Text style={[styles.createButtonModalText, { color: (accountName && accountType && broker && selectedApiAccount && accountId) ? '#ffffff' : '#9CA3AF' }]}>Create</Text>
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
    fontSize:18,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    gap: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  statCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 1,
  },
  statDescription: {
    fontSize: 10,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    maxHeight: 50,
  },
  tabsContent: {
    paddingRight: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
    marginRight: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  modalForm: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 15,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemText: {
    fontSize: 15,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonModal: {},
  createButtonModalText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Unlinked Accounts styles
  unlinkedContainer: {
    padding: 16,
    gap: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  unlinkedCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  unlinkedIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlinkedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unlinkedBottomRow: {
    marginTop:1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlinkedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlinkedInfo: {
    flex: 1,
  },
  unlinkedName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  unlinkedDetail: {
    fontSize: 13,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  unlinkedDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // All Accounts styles
  allAccountsContainer: {
    padding: 16,
  },
  accountsGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  accountCard: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfoWrap: {
    flex: 1,
  },
  accountInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountCardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  accountActionBtn: {
    padding: 4,
  },
  accountCardName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  accountCardDetail: {
    fontSize: 12,
    marginBottom: 10,
  },
  accountCardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  followingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  followingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Link to Master Modal styles
  linkModalContent: {
    width: '97%',
    maxWidth: 500,
    padding: 24,
    borderRadius: 16,
  },
  linkModalForm: {
    marginVertical:0,
    gap: 12,
  },
  linkModalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  linkInputGroup: {
    marginBottom: 0,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  activeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  activeToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginTop:10
  },
  linkCancelButton: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  linkCancelText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkUpdateButton: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  linkUpdateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
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
    marginHorizontal: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
