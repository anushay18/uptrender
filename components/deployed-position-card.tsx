import { colors, getTheme } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { paperPositionService } from '@/services';
import { WS_EVENTS, wsService } from '@/services/websocket';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'phosphor-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  position: any;
  onPress?: () => void;
  onTP?: () => void;
  onClose?: () => void;
}

export default function DeployedPositionCard({ position: initialPosition, onPress, onClose }: Props) {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [pos, setPos] = useState(() => ({ ...initialPosition, id: initialPosition?.id }));
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setPos(prev => ({ ...prev, ...initialPosition }));
  }, [initialPosition]);

  const idRef = useRef(pos.id);
  useEffect(() => { idRef.current = pos.id; }, [pos.id]);

  useEffect(() => {
    const handlePositionUpdate = (data: any) => {
      const actionId = data.position?.id ?? data.positionId;
      if (actionId === undefined) return;
      if (String(actionId) !== String(idRef.current)) return;

      setIsUpdating(true);
      setPos(prev => ({
        ...prev,
        ...data.position,
        currentPrice: data.currentPrice ?? data.position?.currentPrice ?? prev.currentPrice,
        profit: data.profit ?? data.position?.profit ?? prev.profit,
        profitPercent: data.profitPercent ?? data.position?.profitPercent ?? prev.profitPercent,
      }));

      setTimeout(() => setIsUpdating(false), 300);
    };

    const handleMTM = (data: any) => {
      if (!data.positions || !Array.isArray(data.positions)) return;
      const my = data.positions.find((p: any) => String(p.id) === String(idRef.current));
      if (!my) return;

      setIsUpdating(true);
      setPos(prev => ({
        ...prev,
        currentPrice: my.currentPrice ?? prev.currentPrice,
        profit: my.profit ?? prev.profit,
        profitPercent: my.profitPercent ?? prev.profitPercent,
      }));

      setTimeout(() => setIsUpdating(false), 300);
    };

    wsService.on(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
    wsService.on(WS_EVENTS.PAPER_MTM_UPDATE, handleMTM);

    return () => {
      wsService.off(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
      wsService.off(WS_EVENTS.PAPER_MTM_UPDATE, handleMTM);
    };
  }, []);

  const formatted = {
    ...pos,
    qty: pos.volume ?? pos.qty,
    entryPrice: pos.openPrice ?? pos.entryPrice,
    ltp: pos.currentPrice,
    mtm: Number(pos.profit) || 0,
    time: new Date(pos.closeTime || pos.openTime).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }),
    strategyName: pos.strategy?.name || pos.strategyName || 'Manual Trade',
  };
  const isPaper =
    pos.tradeMode === 'paper' ||
    (pos.broker && String(pos.broker).toLowerCase().includes('paper')) ||
    (pos.orderId && String(pos.orderId).toLowerCase().includes('paper'));
  const [showSLTPModal, setShowSLTPModal] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [slType, setSlType] = useState<'points' | 'percentage' | 'price'>('points');
  const [tpType, setTpType] = useState<'points' | 'percentage' | 'price'>('points');

  const openSLTP = () => {
    setStopLoss('');
    setTakeProfit('');
    setSlType('points');
    setTpType('points');
    setShowSLTPModal(true);
  };

  const handleSaveSLTP = async () => {
    try {
      let finalStopLoss: number | undefined = undefined;
      let finalTakeProfit: number | undefined = undefined;

      const entry = Number(pos.entryPrice ?? pos.openPrice ?? 0);

      if (stopLoss) {
        const slValue = parseFloat(stopLoss);
        if (slType === 'points') finalStopLoss = entry - slValue;
        else if (slType === 'percentage') finalStopLoss = entry * (1 - slValue / 100);
        else finalStopLoss = slValue;
      }

      if (takeProfit) {
        const tpValue = parseFloat(takeProfit);
        if (tpType === 'points') finalTakeProfit = entry + tpValue;
        else if (tpType === 'percentage') finalTakeProfit = entry * (1 + tpValue / 100);
        else finalTakeProfit = tpValue;
      }

      const result = await paperPositionService.modifyPosition(pos.id, {
        stopLoss: finalStopLoss,
        takeProfit: finalTakeProfit,
      });

      if (result.success) {
        setShowSLTPModal(false);
        setPos(prev => ({ ...prev, stopLoss: finalStopLoss, takeProfit: finalTakeProfit }));
        Alert.alert('Success', 'Stop Loss and Take Profit updated');
      } else {
        Alert.alert('Error', result.error || 'Failed to update SL/TP');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update SL/TP');
    }
  };

  const handleCloseFromModal = async () => {
    Alert.alert('Close Position', `Are you sure you want to close this ${pos.symbol} position?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        try {
          const res = await paperPositionService.closePosition(pos.id);
          if (res.success) {
            setShowSLTPModal(false);
            onClose?.();
            Alert.alert('Success', 'Position closed');
          } else {
            Alert.alert('Error', res.error || 'Failed to close');
          }
        } catch (err: any) {
          Alert.alert('Error', err.message || 'Failed to close');
        }
      }}
    ]);
  };

  return (
    <>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: isDark ? 'rgba(10,10,26,0.7)' : '#fff',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(71,85,105,0.3)' : '#e2e8f0',
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LinearGradient
            colors={['rgba(16,185,129,0.25)', 'rgba(16,185,129,0.15)']}
            style={{ padding: 8, borderRadius: 8, marginRight: 8 }}
          >
            <Text style={{ color: colors.success, fontWeight: '700' }}>{pos.type === 'Buy' ? 'B' : 'S'}</Text>
          </LinearGradient>
          <View>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{formatted.symbol}</Text>
            <Text style={{ color: theme.textSecondary }}>{formatted.strategyName}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: formatted.mtm >= 0 ? colors.success : colors.error, fontWeight: '700' }}>{formatted.mtm >= 0 ? '+' : ''}{Number(formatted.mtm).toFixed(2)} USD</Text>
          <LinearGradient colors={isPaper ? ['rgba(37,99,235,0.12)','rgba(37,99,235,0.06)'] : ['rgba(16,185,129,0.12)','rgba(16,185,129,0.06)']} style={{ padding: 6, borderRadius: 8, marginTop: 6 }}>
            <Text style={{ color: isPaper ? colors.primary : colors.success,fontSize: 10,fontWeight: '600' }}>{isPaper ? 'Paper' : 'Live'}</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={{ marginTop: 12, backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc', padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Volume</Text>
          <Text style={{ color: theme.text }}>{Number(formatted.qty ?? 0).toFixed(4)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Entry Price</Text>
          <Text style={{ color: theme.text }}>{Number(formatted.entryPrice ?? 0).toFixed(4)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Current Price</Text>
          <Text style={{ color: theme.text }}>{Number(formatted.ltp ?? 0).toFixed(5)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <TouchableOpacity
          disabled={isPaper}
          onPress={() => { if (!isPaper) openSLTP(); }}
          style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff', borderWidth: 1, borderColor: '#e5e7eb', opacity: isPaper ? 0.6 : 1 }}
        >
          <Text style={{ textAlign: 'center', color: theme.textSecondary }}>TP/SL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={isPaper}
          onPress={() => { if (!isPaper) onClose?.(); }}
          style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#ef4444', opacity: isPaper ? 0.6 : 1 }}
        >
          <Text style={{ textAlign: 'center', color: '#fff' }}>⚡ Close</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>

    {/* SL/TP Modal (deployed card) */}
    <Modal visible={showSLTPModal} transparent animationType="fade" onRequestClose={() => setShowSLTPModal(false)}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ width: '92%', borderRadius: 14, padding: 16, backgroundColor: isDark ? '#0a0a1a' : '#fff' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Set Stop Loss & Take Profit</Text>
            <TouchableOpacity onPress={() => setShowSLTPModal(false)} style={{ padding: 6 }}>
              <X size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: isDark ? 'rgba(10,10,26,0.5)' : '#f8fafc' }}>
            <Text style={{ fontWeight: '700', color: theme.text }}>{pos.symbol} - {pos.type}</Text>
            <Text style={{ color: theme.textSecondary, marginTop: 6 }}>Entry: {Number(pos.entryPrice ?? pos.openPrice ?? 0).toFixed(4)}</Text>
            <Text style={{ color: theme.textSecondary, marginTop: 4 }}>Current: {Number(pos.currentPrice ?? pos.ltp ?? 0).toFixed(4)} | MTM: <Text style={{ color: (pos.profit ?? pos.mtm ?? 0) >= 0 ? colors.success : colors.error }}>${Number(pos.profit ?? pos.mtm ?? 0).toFixed(2)}</Text></Text>
          </View>

          {/* SL / TP inputs simplified */}
          <View style={{ marginTop: 14 }}>
            <Text style={{ color: theme.text, marginBottom: 8 }}>Stop Loss</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setSlType('points')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: slType === 'points' ? colors.primary : theme.textSecondary, justifyContent: 'center', alignItems: 'center' }}>{slType === 'points' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
                <Text style={{ color: theme.text }}>Points</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSlType('percentage')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: slType === 'percentage' ? colors.primary : theme.textSecondary, justifyContent: 'center', alignItems: 'center' }}>{slType === 'percentage' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
                <Text style={{ color: theme.text }}>Percentage</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSlType('price')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: slType === 'price' ? colors.primary : theme.textSecondary, justifyContent: 'center', alignItems: 'center' }}>{slType === 'price' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
                <Text style={{ color: theme.text }}>Price</Text>
              </TouchableOpacity>
            </View>
            <TextInput placeholder={slType === 'points' ? '50' : slType === 'percentage' ? '5' : '90000'} placeholderTextColor={theme.textSecondary} value={stopLoss} onChangeText={t => setStopLoss(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={{ padding: 12, borderRadius: 8, backgroundColor: isDark ? 'rgba(10,10,26,0.5)' : '#f1f5f9', color: theme.text }} />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.text, marginBottom: 8 }}>Take Profit</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setTpType('points')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: tpType === 'points' ? colors.primary : theme.textSecondary, justifyContent: 'center', alignItems: 'center' }}>{tpType === 'points' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
                <Text style={{ color: theme.text }}>Points</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTpType('percentage')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: tpType === 'percentage' ? colors.primary : theme.textSecondary, justifyContent: 'center', alignItems: 'center' }}>{tpType === 'percentage' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
                <Text style={{ color: theme.text }}>Percentage</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTpType('price')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: tpType === 'price' ? colors.primary : theme.textSecondary, justifyContent: 'center', alignItems: 'center' }}>{tpType === 'price' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
                <Text style={{ color: theme.text }}>Price</Text>
              </TouchableOpacity>
            </View>
            <TextInput placeholder={tpType === 'points' ? '100' : tpType === 'percentage' ? '10' : '95000'} placeholderTextColor={theme.textSecondary} value={takeProfit} onChangeText={t => setTakeProfit(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={{ padding: 12, borderRadius: 8, backgroundColor: isDark ? 'rgba(10,10,26,0.5)' : '#f1f5f9', color: theme.text }} />
          </View>

          <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <TouchableOpacity onPress={() => setShowSLTPModal(false)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: isDark ? 'rgba(26,26,53,0.3)' : '#eef2f7' }}>
              <Text style={{ textAlign: 'center', color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!stopLoss && !takeProfit} onPress={handleSaveSLTP} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: (!stopLoss && !takeProfit) ? '#e5e7eb' : colors.primary }}>
              <Text style={{ textAlign: 'center', color: (!stopLoss && !takeProfit) ? theme.textSecondary : '#fff' }}>Save SL/TP</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 10 }}>
            <TouchableOpacity onPress={handleCloseFromModal} disabled={isPaper} style={{ padding: 12, borderRadius: 8, backgroundColor: isPaper ? '#f3f4f6' : '#ef4444' }}>
              <Text style={{ textAlign: 'center', color: isPaper ? theme.textSecondary : '#fff' }}>Close Position</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}
