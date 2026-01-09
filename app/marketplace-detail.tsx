import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function MarketplaceDetailScreen() {
  const router = useRouter();
  const { id, name, author } = useLocalSearchParams<{ id: string; name: string; author: string }>();
  const { isDark } = useTheme();

  const theme = {
    bg: isDark ? '#0a0a0f' : '#f8f9fc',
    cardBg: isDark ? 'rgba(30, 30, 58, 0.8)' : 'rgba(255, 255, 255, 0.95)',
    text: isDark ? '#ffffff' : '#1f2937',
    textSecondary: isDark ? '#a1a1aa' : '#6b7280',
    titleColor: isDark ? '#818cf8' : '#5B7FFF',
    borderColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0, 0, 0, 0.05)',
    tagBg: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)',
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {decodeURIComponent(name || 'Strategy Details')}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Strategy Title Card */}
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.strategyTitle, { color: theme.text }]}>
            {decodeURIComponent(name || '1M NIFTY 50 BUY 520 741 777 8')}
          </Text>
          <Text style={[styles.createdText, { color: theme.titleColor }]}>
            Created: a year ago
          </Text>
          <View style={styles.tagsRow}>
            <View style={[styles.tag, { backgroundColor: theme.tagBg }]}>
              <Text style={[styles.tagText, { color: theme.titleColor }]}>Momentum</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.tagBg }]}>
              <Text style={[styles.tagText, { color: theme.titleColor }]}>Breakout</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.tagBg }]}>
              <Text style={[styles.tagText, { color: theme.titleColor }]}>Option Buying</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={[styles.statsGrid, { backgroundColor: theme.cardBg }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Min capital</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>₹ 10.00 K</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Monthly Fee</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>Free + 10.00%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Drawdown</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>₹ 536.25 (5.36%)</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Live deployments:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>132</Text>
          </View>
        </View>

        {/* Strategy Description */}
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Strategy description</Text>
          
          <Text style={[styles.subTitle, { color: theme.text }]}>Overview:</Text>
          <Text style={[styles.bodyText, { color: theme.text }]}>
            Nifty 50 Buying Strategy – Detailed Description
          </Text>

          <Text style={[styles.bodyText, { color: theme.text, marginTop: 16 }]}>
            &ldquo;Do not switch to live trading immediately. Paper trade for at least 3–4 weeks to understand the profit behavior, draw downs, and the risks involved.&rdquo;
          </Text>

          <Text style={[styles.subTitle, { color: theme.text, marginTop: 20 }]}>Overview</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: theme.text }]}>
              1. The Nifty 50 Buying Strategy is a systematically designed options-buying model focused on capturing short-term momentum in the Nifty index.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              2. It operates on a 1-minute timeframe, using a rule-based entry and exit mechanism that eliminates emotional bias and ensures disciplined execution throughout the trading day.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              3. This strategy is fully automated and designed for retail traders who prefer controlled risk exposure with small capital, while maintaining strong consistency through high-frequency trades.
            </Text>
          </View>
        </View>

        {/* Strategy Logic */}
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Strategy Logic</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: theme.text }]}>
              1. The system monitors live Nifty 50 price action from market open.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              2. Based on internal candle pattern and momentum signals, the algo identifies Call Buy or Put Buy opportunities.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              3. Once a trade is triggered, a strict stop loss and target are applied automatically.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              4. Every trade follows a risk-reward ratio of 1:3, maintaining healthy profitability over a large sample of trades.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              5. The strategy ensures only one open position at any point in time, avoiding overlapping exposure.
            </Text>
          </View>
        </View>

        {/* Trade Timings */}
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Trade Timings</Text>
          <View style={styles.parameterSection}>
            <Text style={[styles.parameterLabel, { color: theme.textSecondary }]}>Parameter</Text>
            <Text style={[styles.parameterLabel, { color: theme.textSecondary }]}>Detail</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Start Time</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>9:20 AM</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Exit Time</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>3:20 PM</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Capital Requirement</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>₹10,000 per multiplier (X)</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Target</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>₹1500 per multiplier (X)</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Stop Loss</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>₹500 per multiplier (X)</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Trailing Stop Loss</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>₹500 per multiplier (X)</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Drawdown</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>~10% to 20%</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Average Trades</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>~150 per month</Text>
          </View>
          <View style={styles.parameterRow}>
            <Text style={[styles.parameterKey, { color: theme.text }]}>Max Open Positions</Text>
            <Text style={[styles.parameterValue, { color: theme.text }]}>1 at a time</Text>
          </View>
        </View>

        {/* Example */}
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Example:</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 8 }]}>
            If you deploy with ₹20,000 capital (2X multiplier):
          </Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: theme.text }]}>1. Target: ₹3,000</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>2. Stop Loss: ₹1,000</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>3. Trailing SL: ₹1,000</Text>
          </View>
          <Text style={[styles.codeText, { color: theme.textSecondary, marginTop: 16 }]}>
            Shared Code: a699ba4b-757f-4f6e-85e1-77ea4c51188f
          </Text>
        </View>

        {/* User Responsibilities */}
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>User Responsibilities</Text>
          
          <Text style={[styles.subTitle, { color: theme.text, marginTop: 12 }]}>Capital Buffer:</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 8 }]}>
            Always maintain 10% extra funds above ₹10,000 per multiplier to handle any margin fluctuation on volatile days.
          </Text>

          <Text style={[styles.subTitle, { color: theme.text, marginTop: 16 }]}>API Token:</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 8 }]}>
            Generate your API token between 8:30 AM – 9:00 AM daily to ensure flawless execution once the strategy starts at 9:20 AM.
          </Text>

          <Text style={[styles.subTitle, { color: theme.text, marginTop: 16 }]}>Error Handling:</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: theme.text }]}>
              1. If any error occurs during deployment, you may receive Tradetron or WhatsApp alerts.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              2. Check your deployment logs immediately to identify the issue.
            </Text>
            <Text style={[styles.listItem, { color: theme.text }]}>
              3. Reach out through the official Telegram support group for assistance.
            </Text>
          </View>
        </View>

        {/* Broker Setup + Performance + Important Points + Disclaimer + Support */}
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Broker Setup:</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 8 }]}>For best performance, use low-brokerage or zero-brokerage brokers with stable API connections.</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 12 }]}>Contact our support team for broker recommendations suitable for algo execution.</Text>

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Performance & Expectations</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: theme.text }]}>1. The algo takes trades only when clear momentum signals are detected.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>2. While results vary slightly depending on entry strike or execution price, these differences generally balance out over time.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>3. The strategy’s performance is based on discipline and consistency, not luck or emotional trading.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>4. With approximately 150 trades per month, returns smooth out when viewed over a 30-day cycle rather than single-day outcomes.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Important Points to Remember</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: theme.text }]}>1. Ensure internet stability and API connectivity during market hours.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>2. Always monitor your account periodically, especially for any error notifications from Tradetron.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>3. Avoid interfering manually with live trades unless instructed by the system or during emergency conditions.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>4. Refrain from adding or removing capital mid-day — always adjust capital before market open.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Disclaimer</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: theme.text }]}>1. Algo trading is not a guaranteed income source. It is a disciplined method to manage trades objectively without emotions.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>2. You will experience both profitable and losing trades — the key is maintaining consistency and patience.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>3. Technical issues like slippage, order rejection, or internet/API errors can occur occasionally.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>4. ISHANI ALGOS is not SEBI-registered and does not offer investment advice or guaranteed profits.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>5. This strategy is thoroughly back-tested and forward-tested, but outcomes may vary based on market volatility and execution speed.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>6. Option trading involves risk and should be used only by those who understand derivatives and their associated risks.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>7. Past performance ≠ future returns. Please trade responsibly and use paper trading before live deployment.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>8. Always consult your financial advisor before deploying with live capital.</Text>
            <Text style={[styles.listItem, { color: theme.text }]}>9. Trading requires patience, discipline, and trust in your system.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Support</Text>
          <Text style={[styles.bodyText, { color: theme.text, marginTop: 8 }]}>Email: ishanialgos@gmail.com</Text>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Fixed footer with Subscribed button */}
      <View style={[styles.footer, { backgroundColor: theme.bg }]}> 
        <TouchableOpacity style={[styles.subscribedFooterBtn, { backgroundColor: theme.textSecondary + '30' }]} disabled> 
          <Text style={[styles.subscribedFooterBtnText, { color: theme.textSecondary }]}>Subscribed</Text> 
        </TouchableOpacity> 
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statsCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  strategyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, lineHeight: 28 },
  createdText: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: { fontSize: 14, fontWeight: '500' },
  statValue: { fontSize: 15, fontWeight: '700' },
  parameterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  parameterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  parameterKey: {
    fontSize: 14,
    fontWeight: '500',
  },
  parameterValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  subTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  bodyText: { fontSize: 14, fontWeight: '400', lineHeight: 22 },
  listContainer: { marginTop: 8 },
  listItem: { fontSize: 14, fontWeight: '400', lineHeight: 22, marginBottom: 8 },
  codeText: { fontSize: 13, fontWeight: '500', marginTop: 8 },
  detailRow: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  detailValue: { fontSize: 14, fontWeight: '400', marginTop: 4, marginBottom: 8 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  unsubscribeBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 2, alignItems: 'center' },
  unsubscribeBtnText: { fontSize: 16, fontWeight: '700' },
  deployBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  deployBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  subscribedFooterBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  subscribedFooterBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footerInner: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
  },
});
