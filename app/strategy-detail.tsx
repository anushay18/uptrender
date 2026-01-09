import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function StrategyDetailScreen() {
	const router = useRouter();
	const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
	const { isDark } = useTheme();
	const [selectedType, setSelectedType] = useState('PT');
	const [selectedMultiplier, setSelectedMultiplier] = useState('1X');
	const [selectedOption, setSelectedOption] = useState('Select');
	const [showActionsModal, setShowActionsModal] = useState(false);
	const [showMultiplierModal, setShowMultiplierModal] = useState(false);

	const theme = {
		bg: isDark ? '#0a0a0f' : '#f8f9fc',
		cardBg: isDark ? 'rgba(30, 30, 58, 0.8)' : 'rgba(255, 255, 255, 0.95)',
		text: isDark ? '#ffffff' : '#1f2937',
		textSecondary: isDark ? '#a1a1aa' : '#6b7280',
		titleColor: isDark ? '#818cf8' : '#5B7FFF',
		borderColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0, 0, 0, 0.05)',
		modalBg: isDark ? '#1a1a2e' : '#ffffff',
	};

	return (
		<View style={[styles.screen, { backgroundColor: theme.bg }]}>
			{/* Header */}
			<View style={[styles.header, { backgroundColor: theme.cardBg }]}>
				<TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color={theme.text} />
				</TouchableOpacity>
				<Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
					{name || 'Strategy Details'}
				</Text>
				<TouchableOpacity style={styles.menuBtn} onPress={() => setShowActionsModal(true)}>
					<Ionicons name="ellipsis-vertical" size={24} color={theme.text} />
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				{/* Controls Card */}
				<View style={[styles.controlsCard, { backgroundColor: theme.cardBg }]}>
					<View style={styles.controlsRow}>
						<TouchableOpacity style={[styles.dropdown, { borderColor: theme.borderColor }]}>
							<Text style={[styles.dropdownText, { color: theme.text }]}>{selectedType}</Text>
							<Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.dropdown, { borderColor: theme.borderColor }]}
							onPress={() => setShowMultiplierModal(true)}
						>
							<Text style={[styles.dropdownText, { color: theme.text }]}>{selectedMultiplier}</Text>
							<Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
						</TouchableOpacity>

						<TouchableOpacity style={[styles.dropdown, styles.dropdownWide, { borderColor: theme.borderColor }]}>
							<Text style={[styles.dropdownText, { color: theme.text }]}>{selectedOption}</Text>
							<Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
						</TouchableOpacity>
					</View>

					{/* Stats Row */}
					<View style={styles.statsRow}>
						<View style={styles.statBox}>
							<Text style={[styles.statLabel, { color: theme.textSecondary }]}>Value(₹)</Text>
							<Text style={[styles.statValue, { color: theme.text }]}>0</Text>
						</View>
						<View style={[styles.statDivider, { backgroundColor: theme.borderColor }]} />
						<View style={styles.statBox}>
							<Text style={[styles.statLabel, { color: theme.textSecondary }]}>PNL(₹)</Text>
							<View style={styles.pnlRow}>
								<Text style={[styles.statValue, { color: '#10b981' }]}>0</Text>
								<Ionicons name="arrow-down" size={16} color="#ef4444" />
							</View>
						</View>
					</View>
				</View>

				{/* Empty state for positions/orders */}
				<View style={styles.emptyState}>
					<Ionicons name="briefcase-outline" size={64} color={theme.textSecondary} />
					<Text style={[styles.emptyText, { color: theme.textSecondary }]}>No positions yet</Text>
					<Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Your strategy positions will appear here</Text>
				</View>
			</ScrollView>

			{/* Actions Modal */}
			<Modal visible={showActionsModal} transparent animationType="slide" onRequestClose={() => setShowActionsModal(false)}>
				<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionsModal(false)}>
					<View style={[styles.modalContent, { backgroundColor: theme.modalBg }]}> 
						<View style={styles.modalHandle} />
						<Text style={[styles.modalTitle, { color: theme.text }]}>{name || 'Strategy'}</Text>
						<View style={styles.modalSidRow}>
							<Text style={[styles.modalSid, { color: theme.textSecondary }]}>SID: 27116117</Text>
							<TouchableOpacity
								onPress={async () => {
									try {
										// require at runtime so builds that don't have expo-clipboard installed won't fail static analysis
										// if expo-clipboard is available this will copy; otherwise fall back to alert
										// eslint-disable-next-line @typescript-eslint/no-var-requires
										const cb = require('expo-clipboard');
										if (cb && typeof cb.setStringAsync === 'function') {
											await cb.setStringAsync('27116117');
											Alert.alert('Copied', 'SID copied to clipboard');
										} else {
											Alert.alert('Copied', 'SID: 27116117');
										}
									} catch (e) {
										Alert.alert('Copied', 'SID: 27116117');
									}
								}}
							>
								<Ionicons name="copy-outline" size={16} color={theme.titleColor} />
							</TouchableOpacity>
						</View>

						<Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Statuses</Text>
						<TouchableOpacity style={styles.modalItem}>
							<Ionicons name="pause" size={22} color={theme.titleColor} />
							<Text style={[styles.modalItemText, { color: theme.text }]}>Pause</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.modalItem}>
							<Ionicons name="archive-outline" size={22} color={theme.titleColor} />
							<Text style={[styles.modalItemText, { color: theme.text }]}>Archive</Text>
						</TouchableOpacity>

						<Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Strategy data</Text>
						<TouchableOpacity style={styles.modalItem}>
							<Ionicons name="bar-chart-outline" size={22} color={theme.titleColor} />
							<Text style={[styles.modalItemText, { color: theme.text }]}>Statistics</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.modalItem}>
							<Ionicons name="trending-up-outline" size={22} color={theme.titleColor} />
							<Text style={[styles.modalItemText, { color: theme.text }]}>Intraday PNL</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.modalItem}>
							<Ionicons name="time-outline" size={22} color={theme.titleColor} />
							<Text style={[styles.modalItemText, { color: theme.text }]}>Notification Log</Text>
						</TouchableOpacity>

						<Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>Actions</Text>
						<TouchableOpacity style={styles.modalItem}>
							<Ionicons name="create-outline" size={22} color={theme.titleColor} />
							<Text style={[styles.modalItemText, { color: theme.text }]}>User Notes</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.modalItem}>
							<Ionicons name="trash-outline" size={22} color="#ef4444" />
							<Text style={[styles.modalItemText, { color: '#ef4444' }]}>Delete</Text>
						</TouchableOpacity>

						<TouchableOpacity style={styles.closeBtn} onPress={() => setShowActionsModal(false)}>
							<Ionicons name="close" size={28} color={theme.titleColor} />
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>

			{/* Multiplier Modal (no header) */}
			<Modal visible={showMultiplierModal} transparent animationType="slide" onRequestClose={() => setShowMultiplierModal(false)}>
				<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMultiplierModal(false)}>
					<View style={[styles.modalContent, { backgroundColor: theme.modalBg }]}>
						<View style={{ paddingVertical: 6 }} />
						{Array.from({ length: 12 }).map((_, i) => {
							const val = `${i + 1}X`;
							return (
								<TouchableOpacity key={val} style={styles.multiplierItem} onPress={() => { setSelectedMultiplier(val); setShowMultiplierModal(false); }}>
									<Text style={[styles.multiplierText, { color: theme.text }]}>{val}</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</TouchableOpacity>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	header: {
		paddingTop: 64,
		paddingBottom: 14,
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
	menuBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
	content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
	controlsCard: { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, marginBottom: 20 },
	controlsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
	dropdown: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
	dropdownWide: { flex: 1.5 },
	dropdownText: { fontSize: 14, fontWeight: '600' },
	statsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
	statBox: { flex: 1, alignItems: 'center' },
	statDivider: { width: 1, height: 40 },
	statLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
	statValue: { fontSize: 20, fontWeight: '700' },
	pnlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
	emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
	emptySubtext: { fontSize: 14, marginTop: 6 },
	modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
	modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, maxHeight: '80%' },
	modalHandle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
	modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
	modalSidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
	modalSid: { fontSize: 14, fontWeight: '500' },
	modalSectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 12 },
	modalItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
	modalItemText: { fontSize: 16, fontWeight: '500' },
	closeBtn: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
	multiplierItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
	multiplierText: { fontSize: 16, fontWeight: '600' },
});

