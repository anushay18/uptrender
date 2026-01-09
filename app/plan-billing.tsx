import { borderRadius, colors, getTheme, spacing, typography } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { useWalletUpdates } from '@/hooks/useWebSocket';
import { planService, walletService } from '@/services';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ClipboardText,
  Copy,
  CreditCard,
  CurrencyBtc,
  Info,
  Link,
  Plus,
  QrCode,
  ShieldCheck,
  Star,
  TrendDown,
  TrendUp,
  Wallet,
  X
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function PlanBillingScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const theme = getTheme(isDark);
  
  // API data states
  const [plans, setPlans] = useState<any[]>([]);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [isAddingFunds, setIsAddingFunds] = useState(false);

  // Real-time wallet updates
  useWalletUpdates((data) => {
    if (data.balance !== undefined) {
      setWalletBalance(data.balance);
    }
    if (data.transaction) {
      setBillingHistory(prev => [
        {
          id: data.transaction.id,
          date: new Date(data.transaction.createdAt).toLocaleString(),
          desc: data.transaction.description || data.transaction.type,
          ref: data.transaction.reference,
          type: data.transaction.type === 'credit' ? 'Credit' : 'Debit',
          amount: `${data.transaction.type === 'credit' ? '+' : '-'}₹${Math.abs(data.transaction.amount).toFixed(2)}`,
          balance: `₹${data.transaction.balanceAfter?.toFixed(2) || data.transaction.balance?.toFixed(2) || '0.00'}`,
        },
        ...prev,
      ]);
      setTotalTransactions(prev => prev + 1);
    }
  });

  // Fetch data from APIs
  const fetchData = useCallback(async () => {
    try {
      const [plansRes, walletRes, transactionsRes, subscriptionRes] = await Promise.all([
        planService.getAvailablePlans(),
        walletService.getWallet(),
        walletService.getTransactions({ limit: 100 }),
        planService.getCurrentPlan(),
      ]);

      if (plansRes.success && plansRes.data && plansRes.data.length > 0) {
        setPlans(plansRes.data.map((p: any) => ({
          id: String(p.id || ''),
          name: p.name || 'Unknown Plan',
          description: p.description || '',
          price: p.price || 0,
          period: `${p.duration || 30} days`,
          walletBalance: `$${p.walletCredit || 0}`,
          duration: `${p.duration || 30} days`,
          isPopular: p.isPopular || false,
          limits: {
            activeStrategies: `${p.maxStrategies || 'Unlimited'} Active Strategies`,
            tradesPerMonth: `${p.maxTrades || 'Unlimited'} Trades/Month`,
            apiAccess: p.apiAccess || false,
            prioritySupport: p.prioritySupport || null,
          },
          color: p.isPopular ? colors.primary : '#64748B',
        })));
      }

      if (walletRes.success && walletRes.data) {
        setWalletBalance(walletRes.data.balance || 0);
      }

      if (transactionsRes.success && transactionsRes.data) {
        setBillingHistory(transactionsRes.data.map((t: any) => ({
          id: t.id,
          date: t.createdAt ? new Date(t.createdAt).toLocaleString() : '-',
          desc: t.description || t.type || '-',
          ref: t.reference,
          type: t.type === 'credit' ? 'Credit' : 'Debit',
          amount: `${t.type === 'credit' ? '+' : '-'}₹${Math.abs(Number(t.amount) || 0).toFixed(2)}`,
          balance: `₹${(Number(t.balanceAfter) || Number(t.balance) || 0).toFixed(2)}`,
        })));
        if (transactionsRes.pagination) {
          setTotalTransactions(transactionsRes.pagination.total || transactionsRes.data.length);
        } else {
          setTotalTransactions(transactionsRes.data.length);
        }
      }

      if (subscriptionRes.success && subscriptionRes.data) {
        setCurrentPlan(subscriptionRes.data);
      }
    } catch (error) {
      console.error('Error fetching plan data:', error);
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
    setDisplayCount(10);
    fetchData();
  }, [fetchData]);

  // Load More handler
  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 10);
  };
  
  // Modal states
  const [showUpgradePlan, setShowUpgradePlan] = useState(false);
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [showMetaMask, setShowMetaMask] = useState(false);
  const [showUPI, setShowUPI] = useState(false);
  
  // Form states
  const [razorpayAmount, setRazorpayAmount] = useState('');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [cryptoTab, setCryptoTab] = useState<'wallet' | 'manual'>('wallet');
  const [upiAmount, setUpiAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  
  // Payment method form
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [zipCode, setZipCode] = useState('');

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${text} copied to clipboard`);
  };

  const handleNumberInput = (value: string, setter: (val: string) => void) => {
    // Only allow numbers and decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return;
    }
    setter(numericValue);
  };

  // Handle plan subscription
  const handleSubscribeToPlan = async (planId: string) => {
    try {
      const response = await planService.subscribeToPlan(parseInt(planId));
      if (response.data) {
        Alert.alert('Success', 'Successfully subscribed to plan!');
        setCurrentPlan(response.data);
        setShowUpgradePlan(false);
        fetchData(); // Refresh data
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to subscribe to plan');
    }
  };

  // Handle Razorpay Add Funds
  const handleRazorpayPayment = async () => {
    if (!razorpayAmount || parseFloat(razorpayAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    setIsAddingFunds(true);
    try {
      const response = await walletService.addFunds({
        amount: parseFloat(razorpayAmount),
        paymentMethod: 'razorpay',
      });
      
      if (response.success) {
        Alert.alert('Success', `₹${razorpayAmount} added to your wallet successfully!`);
        setRazorpayAmount('');
        setShowRazorpay(false);
        fetchData(); // Refresh wallet balance
      } else {
        Alert.alert('Error', response.error || 'Failed to add funds');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process payment');
    } finally {
      setIsAddingFunds(false);
    }
  };

  // Handle UPI Payment Submission
  const handleUPISubmit = async () => {
    if (!upiAmount || parseFloat(upiAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!utrNumber || utrNumber.trim().length < 10) {
      Alert.alert('Error', 'Please enter a valid UTR number (minimum 10 characters)');
      return;
    }
    
    setIsAddingFunds(true);
    try {
      const response = await walletService.addFunds({
        amount: parseFloat(upiAmount),
        paymentMethod: 'upi',
        transactionId: utrNumber.trim(),
      });
      
      if (response.success) {
        Alert.alert('Success', 'Your payment has been submitted for verification. Amount will be credited after admin approval.');
        setUpiAmount('');
        setUtrNumber('');
        setShowUPI(false);
        fetchData(); // Refresh data
      } else {
        Alert.alert('Error', response.error || 'Failed to submit payment');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit payment');
    } finally {
      setIsAddingFunds(false);
    }
  };

  const renderPlanCard = (plan: any) => (
    <View 
      key={plan.id}
      style={[
        styles.planCard, 
        { 
          backgroundColor: theme.surface, 
          borderColor: plan.isPopular ? plan.color : theme.border,
          borderWidth: plan.isPopular ? 2 : 1
        }
      ]}
    >
      {plan.isPopular && (
        <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
        </View>
      )}
      
      <View style={[styles.planIconContainer, { backgroundColor: plan.color + '20' }]}>
        <Star size={24} color={plan.color} weight="fill" />
      </View>
      
      <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
      <Text style={[styles.planDescription, { color: theme.textSecondary }]}>{plan.description}</Text>
      
      <View style={styles.priceContainer}>
        <Text style={[styles.priceSymbol, { color: theme.textSecondary }]}>$</Text>
        <Text style={[styles.priceAmount, { color: theme.text }]}>{plan.price}</Text>
      </View>
      <Text style={[styles.pricePeriod, { color: theme.textSecondary }]}>per {plan.period}</Text>
      
      <View style={[styles.walletInfoBox, { backgroundColor: plan.color + '10', borderColor: plan.color + '30' }]}>
        <Wallet size={16} color={plan.color} weight="fill" />
        <Text style={[styles.walletInfoText, { color: plan.color }]}>Wallet Balance: {plan.walletBalance}</Text>
      </View>
      <Text style={[styles.durationText, { color: theme.textSecondary }]}>Duration: {plan.duration}</Text>
      
      <View style={styles.limitsSection}>
        <Text style={[styles.limitsTitle, { color: theme.text }]}>Trading Limits</Text>
        
        <View style={styles.limitItem}>
          <TrendUp size={16} color={colors.success} weight="bold" />
          <Text style={[styles.limitText, { color: theme.text }]}>{plan.limits.activeStrategies}</Text>
        </View>
        
        <View style={styles.limitItem}>
          <Check size={16} color={colors.success} weight="bold" />
          <Text style={[styles.limitText, { color: theme.text }]}>{plan.limits.tradesPerMonth}</Text>
        </View>
        
        {plan.limits.apiAccess && (
          <View style={styles.limitItem}>
            <ShieldCheck size={16} color={colors.success} weight="bold" />
            <Text style={[styles.limitText, { color: colors.success }]}>Full API Access</Text>
          </View>
        )}
        
        {plan.limits.prioritySupport && (
          <View style={styles.limitItem}>
            <Star size={16} color="#F59E0B" weight="fill" />
            <Text style={[styles.limitText, { color: '#F59E0B' }]}>{plan.limits.prioritySupport}</Text>
          </View>
        )}
      </View>
      
      <TouchableOpacity 
        style={[
          styles.choosePlanButton, 
          { backgroundColor: plan.isPopular ? plan.color : 'transparent', borderColor: plan.color }
        ]}
      >
        <Text style={[styles.choosePlanText, { color: plan.isPopular ? '#fff' : plan.color }]}>
          {plan.isPopular ? 'Get Started' : 'Choose Plan'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderBillingCard = (item: any) => (
    <View 
      key={item.id}
      style={[styles.billingHistoryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.billingCardHeader}>
        <Text style={[styles.billingDate, { color: theme.textSecondary }]}>{item.date}</Text>
        <View style={[
          styles.typeBadge, 
          { backgroundColor: item.type === 'Credit' ? colors.success + '20' : colors.error + '20' }
        ]}>
          {item.type === 'Credit' ? (
            <TrendUp size={14} color={colors.success} weight="bold" />
          ) : (
            <TrendDown size={14} color={colors.error} weight="bold" />
          )}
          <Text style={[
            styles.typeBadgeText, 
            { color: item.type === 'Credit' ? colors.success : colors.error }
          ]}>
            {item.type}
          </Text>
        </View>
      </View>
      
      <Text style={[styles.billingDesc, { color: theme.text }]}>{item.desc}</Text>
      {item.ref && (
        <Text style={[styles.billingRef, { color: theme.textSecondary }]}>Ref: {item.ref}</Text>
      )}
      
      <View style={styles.billingCardFooter}>
        <Text style={[
          styles.billingAmount, 
          { color: item.type === 'Credit' ? colors.success : colors.error }
        ]}>
          {item.amount}
        </Text>
        <Text style={[styles.billingBalance, { color: theme.textSecondary }]}>Balance: {item.balance}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Plan & Billing</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Wallet Balance Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Wallet size={22} color={colors.primary} weight="fill" />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Wallet Balance</Text>
          </View>
          
          <View style={[styles.walletBalanceContainer, { backgroundColor: colors.primary + '15' }]}>
            <Wallet size={40} color={colors.primary} weight="fill" />
          </View>
          <Text style={[styles.balanceAmount, { color: theme.text }]}>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Available Balance</Text>
          
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowRazorpay(true)}
          >
            <Plus size={18} color="#fff" weight="bold" />
            <Text style={styles.primaryButtonText}>Add Funds</Text>
          </TouchableOpacity>
        </View>

        {/* Plan Management Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <ShieldCheck size={22} color={colors.primary} weight="fill" />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Plan Management</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Manage your Plan and billing
          </Text>
          
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowUpgradePlan(true)}
          >
            <ArrowUp size={18} color="#fff" weight="bold" />
            <Text style={styles.primaryButtonText}>Upgrade Plan</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.outlineButton, { borderColor: colors.primary }]}
            onPress={() => setShowBillingHistory(true)}
          >
            <ClipboardText size={18} color={colors.primary} weight="duotone" />
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>View Billing</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.textButton, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => setShowBillingHistory(true)}
          >
            <Text style={[styles.textButtonLabel, { color: colors.primary }]}>View Past History</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.textButton, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => setShowPaymentMethod(true)}
          >
            <Text style={[styles.textButtonLabel, { color: colors.primary }]}>Update Payment Method</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Methods Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: '#F59E0B20' }]}>
              <CreditCard size={22} color="#F59E0B" weight="fill" />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Payment Methods</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Choose your preferred payment option
          </Text>
          
          <TouchableOpacity 
            style={[styles.paymentOption, { backgroundColor: theme.surfaceSecondary, borderColor: colors.primary + '60' }]}
            onPress={() => setShowRazorpay(true)}
          >
            <CreditCard size={20} color={colors.primary} weight="duotone" />
            <Text style={[styles.paymentOptionText, { color: colors.primary }]}>Razorpay</Text>
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>Test</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.paymentOption, { backgroundColor: theme.surfaceSecondary, borderColor: '#F59E0B60' }]}
            onPress={() => setShowMetaMask(true)}
          >
            <CurrencyBtc size={20} color="#F59E0B" weight="fill" />
            <Text style={[styles.paymentOptionText, { color: '#F59E0B' }]}>MetaMask / Crypto</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.paymentOption, { backgroundColor: theme.surfaceSecondary, borderColor: '#10B98160' }]}
            onPress={() => setShowUPI(true)}
          >
            <QrCode size={20} color="#10B981" weight="fill" />
            <Text style={[styles.paymentOptionText, { color: '#10B981' }]}>UPI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Upgrade Plan Modal */}
      <Modal
        visible={showUpgradePlan}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpgradePlan(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.fullModal, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choose Your Trading Plan</Text>
              <TouchableOpacity onPress={() => setShowUpgradePlan(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Start trading with the plan that suits your needs. Upgrade or downgrade anytime.
            </Text>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.plansContainer}>
              {plans.map(renderPlanCard)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Billing History Modal */}
      <Modal
        visible={showBillingHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBillingHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.fullModal, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Billing History</Text>
              <TouchableOpacity onPress={() => setShowBillingHistory(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.billingListContainer}>
              {billingHistory.length > 0 ? (
                <>
                  {billingHistory.slice(0, displayCount).map(renderBillingCard)}
                  
                  {/* Load More Button */}
                  {displayCount < billingHistory.length && (
                    <TouchableOpacity 
                      style={[styles.loadMoreButton, { backgroundColor: colors.primary }]}
                      onPress={handleLoadMore}
                    >
                      <Text style={styles.loadMoreButtonText}>
                        Load More 
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>No transactions yet</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Method Modal */}
      <Modal
        visible={showPaymentMethod}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentMethod(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.centeredModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalTitleRow}>
                <CreditCard size={24} color={colors.primary} weight="duotone" />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Payment Method</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPaymentMethod(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.infoBanner, { backgroundColor: colors.primary + '10' }]}>
                <Info size={20} color={colors.primary} />
                <Text style={[styles.infoBannerText, { color: colors.primary }]}>
                  Your payment information is encrypted and securely stored.
                </Text>
              </View>
              
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    placeholder="Card Number"
                    placeholderTextColor={theme.textSecondary}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    placeholder="Cardholder Name"
                    placeholderTextColor={theme.textSecondary}
                    value={cardholderName}
                    onChangeText={setCardholderName}
                  />
                </View>
              </View>
              
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    placeholder="MM"
                    placeholderTextColor={theme.textSecondary}
                    value={expiryMonth}
                    onChangeText={setExpiryMonth}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    placeholder="YY"
                    placeholderTextColor={theme.textSecondary}
                    value={expiryYear}
                    onChangeText={setExpiryYear}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>
              
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    placeholder="CVV"
                    placeholderTextColor={theme.textSecondary}
                    value={cvv}
                    onChangeText={setCvv}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    placeholder="Billing ZIP Code"
                    placeholderTextColor={theme.textSecondary}
                    value={zipCode}
                    onChangeText={setZipCode}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: theme.border }]}
                  onPress={() => setShowPaymentMethod(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.saveButtonText}>Save Payment Method</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Razorpay Modal */}
      <Modal
        visible={showRazorpay}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRazorpay(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.centeredModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalTitleRow}>
                <CreditCard size={24} color={colors.primary} weight="duotone" />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Add Funds via Razorpay</Text>
              </View>
              <View style={styles.testModeBadge}>
                <Text style={styles.testModeText}>Test Mode</Text>
              </View>
            </View>
            
            <View style={styles.modalContent}>
              <View style={[styles.infoBanner, { backgroundColor: colors.primary + '10' }]}>
                <Info size={20} color={colors.primary} />
                <Text style={[styles.infoBannerText, { color: colors.primary }]}>
                  You will be redirected to Razorpay secure payment gateway to complete the transaction.
                </Text>
              </View>
              
              <View style={styles.amountInputContainer}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Amount (₹)</Text>
                <TextInput
                  style={[styles.amountInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="Enter the amount you want to add to your wallet"
                  placeholderTextColor={theme.textSecondary}
                  value={razorpayAmount}
                  onChangeText={(value) => handleNumberInput(value, setRazorpayAmount)}
                  keyboardType="decimal-pad"
                />
              </View>
              
              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: theme.border }]}
                  onPress={() => setShowRazorpay(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.payButton, { backgroundColor: (razorpayAmount && !isAddingFunds) ? colors.primary : theme.border }]}
                  disabled={!razorpayAmount || isAddingFunds}
                  onPress={handleRazorpayPayment}
                >
                  <CreditCard size={18} color={(razorpayAmount && !isAddingFunds) ? '#fff' : theme.textSecondary} weight="bold" />
                  <Text style={[styles.payButtonText, { color: (razorpayAmount && !isAddingFunds) ? '#fff' : theme.textSecondary }]}>
                    {isAddingFunds ? 'Processing...' : 'Pay Now'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* MetaMask/Crypto Modal */}
      <Modal
        visible={showMetaMask}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMetaMask(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.centeredModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalTitleRow}>
                <CurrencyBtc size={24} color="#F59E0B" weight="fill" />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Add Funds via Crypto</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMetaMask(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              {/* Tabs */}
              <View style={[styles.tabContainer, { backgroundColor: theme.background }]}>
                <TouchableOpacity 
                  style={[
                    styles.tab, 
                    cryptoTab === 'wallet' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
                  ]}
                  onPress={() => setCryptoTab('wallet')}
                >
                  <Wallet size={18} color={cryptoTab === 'wallet' ? colors.primary : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: cryptoTab === 'wallet' ? colors.primary : theme.textSecondary }]}>
                    Connect Wallet
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.tab, 
                    cryptoTab === 'manual' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
                  ]}
                  onPress={() => setCryptoTab('manual')}
                >
                  <ClipboardText size={18} color={cryptoTab === 'manual' ? colors.primary : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: cryptoTab === 'manual' ? colors.primary : theme.textSecondary }]}>
                    Manual Entry
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.amountInputContainer}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>INR Equivalent Amount (₹)</Text>
                <TextInput
                  style={[styles.amountInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="Enter the INR value to be credited to your wallet after verification"
                  placeholderTextColor={theme.textSecondary}
                  value={cryptoAmount}
                  onChangeText={(value) => handleNumberInput(value, setCryptoAmount)}
                  keyboardType="decimal-pad"
                />
              </View>
              
              {cryptoTab === 'wallet' && (
                <View style={styles.connectWalletSection}>
                  <View style={[styles.walletIcon, { backgroundColor: '#F59E0B20' }]}>
                    <Wallet size={40} color="#F59E0B" weight="fill" />
                  </View>
                  <Text style={[styles.connectWalletTitle, { color: theme.text }]}>Connect Your Wallet</Text>
                  <Text style={[styles.connectWalletDesc, { color: theme.textSecondary }]}>
                    Connect your MetaMask wallet to make a payment
                  </Text>
                  <TouchableOpacity style={[styles.connectButton, { backgroundColor: '#F59E0B' }]}>
                    <Link size={18} color="#fff" weight="bold" />
                    <Text style={styles.connectButtonText}>Connect MetaMask</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* UPI Modal */}
      <Modal
        visible={showUPI}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUPI(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.centeredModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalTitleRow}>
                <QrCode size={24} color="#10B981" weight="fill" />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Add Funds via UPI</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUPI(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.infoBanner, { backgroundColor: '#10B98110' }]}>
                <Info size={20} color="#10B981" />
                <Text style={[styles.infoBannerText, { color: '#10B981' }]}>
                  Scan the QR code or use the UPI ID to make payment. After payment, enter the UTR number to verify.
                </Text>
              </View>
              
              <View style={[styles.upiIdCard, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
                <View style={styles.upiIdHeader}>
                  <View>
                    <Text style={[styles.upiIdLabel, { color: theme.textSecondary }]}>UPI ID</Text>
                    <Text style={[styles.upiIdValue, { color: theme.text }]}>admin@uptrender</Text>
                    <Text style={[styles.upiName, { color: theme.textSecondary }]}>Name: Uptrender Admin</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.copyButton, { backgroundColor: '#10B98120' }]}
                    onPress={() => copyToClipboard('admin@uptrender')}
                  >
                    <Copy size={20} color="#10B981" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Submit Payment Details</Text>
              
              <View style={styles.amountInputContainer}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Amount Paid (₹)</Text>
                <TextInput
                  style={[styles.amountInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="Enter the exact amount you paid via UPI"
                  placeholderTextColor={theme.textSecondary}
                  value={upiAmount}
                  onChangeText={(value) => handleNumberInput(value, setUpiAmount)}
                  keyboardType="decimal-pad"
                />
              </View>
              
              <View style={styles.amountInputContainer}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>UTR / Transaction Reference Number</Text>
                <TextInput
                  style={[styles.amountInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="12-digit UTR number from your UPI app (found in transaction details)"
                  placeholderTextColor={theme.textSecondary}
                  value={utrNumber}
                  onChangeText={setUtrNumber}
                />
              </View>
              
              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: theme.border }]}
                  onPress={() => setShowUPI(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.submitButton, { backgroundColor: (upiAmount && utrNumber && !isAddingFunds) ? '#10B981' : theme.border }]}
                  disabled={!upiAmount || !utrNumber || isAddingFunds}
                  onPress={handleUPISubmit}
                >
                  <QrCode size={18} color={(upiAmount && utrNumber && !isAddingFunds) ? '#fff' : theme.textSecondary} weight="bold" />
                  <Text style={[styles.submitButtonText, { color: (upiAmount && utrNumber && !isAddingFunds) ? '#fff' : theme.textSecondary }]}>
                    {isAddingFunds ? 'Submitting...' : 'Submit for Verification'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    marginTop: 42,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    fontSize: 18,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  
  // Cards
  card: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    ...typography.h3,
    fontSize: 16,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  
  // Wallet Balance
  walletBalanceContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  balanceAmount: {
    ...typography.h1,
    fontSize: 24,
    textAlign: 'center',
  },
  balanceLabel: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  
  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    ...typography.labelLarge,
    color: '#fff',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  outlineButtonText: {
    ...typography.labelLarge,
  },
  textButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  textButtonLabel: {
    ...typography.labelMedium,
  },
  
  // Payment Options
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  paymentOptionText: {
    ...typography.labelLarge,
    flex: 1,
  },
  testBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  testBadgeText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullModal: {
    flex: 1,
    width: '100%',
    paddingTop: 50,
  },
  centeredModal: {
    width: '94%',
    maxHeight: '85%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  modalContent: {
    padding: spacing.xl,
  },
  testModeBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  testModeText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
  },
  
  // Plans
  plansContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  planCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  popularBadgeText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
  },
  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  planName: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: 4,
  },
  planDescription: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priceSymbol: {
    ...typography.bodyMedium,
    marginTop: 4,
  },
  priceAmount: {
    ...typography.h1,
    fontSize: 36,
  },
  pricePeriod: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  walletInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 4,
  },
  walletInfoText: {
    ...typography.labelMedium,
  },
  durationText: {
    ...typography.bodySmall,
    marginBottom: spacing.lg,
  },
  limitsSection: {
    marginBottom: spacing.lg,
  },
  limitsTitle: {
    ...typography.labelLarge,
    marginBottom: spacing.md,
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  limitText: {
    ...typography.bodySmall,
  },
  choosePlanButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  choosePlanText: {
    ...typography.labelLarge,
  },
  
  // Billing History
  billingListContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  billingHistoryCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  billingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  billingDate: {
    ...typography.bodySmall,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  billingDesc: {
    ...typography.bodyMedium,
    marginBottom: 4,
  },
  billingRef: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
  },
  billingCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  billingAmount: {
    ...typography.h3,
    fontSize: 16,
  },
  billingBalance: {
    ...typography.bodySmall,
  },
  
  // Forms
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoBannerText: {
    ...typography.bodySmall,
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  formField: {
    gap: spacing.xs,
  },
  formInput: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...typography.bodyMedium,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.labelLarge,
  },
  saveButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.labelLarge,
    color: '#fff',
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  payButtonText: {
    ...typography.labelLarge,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  submitButtonText: {
    ...typography.labelLarge,
  },
  
  // Amount Input
  amountInputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.labelMedium,
    marginBottom: spacing.sm,
  },
  amountInput: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...typography.bodyMedium,
  },
  
  // Crypto Tabs
  tabContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  tabText: {
    ...typography.labelMedium,
  },
  connectWalletSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  walletIcon: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  connectWalletTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  connectWalletDesc: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  connectButtonText: {
    ...typography.labelLarge,
    color: '#fff',
  },
  
  // UPI
  upiIdCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  upiIdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  upiIdLabel: {
    ...typography.bodySmall,
    marginBottom: 4,
  },
  upiIdValue: {
    ...typography.h3,
    fontSize: 16,
    marginBottom: 4,
  },
  upiName: {
    ...typography.bodySmall,
  },
  copyButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sectionTitle: {
    ...typography.labelLarge,
    marginBottom: spacing.md,
  },
  
  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    borderTopWidth: 1,
  },
  paginationText: {
    ...typography.bodySmall,
    fontSize: 12,
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paginationBtn: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  paginationBtnDisabled: {
    opacity: 0.5,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateText: {
    ...typography.bodySmall,
  },
  
  // Load More Button
  loadMoreButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  loadMoreButtonText: {
    ...typography.labelLarge,
    color: '#fff',
  },
});
