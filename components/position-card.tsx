import { colors, getTheme } from '@/constants/styles';
import { useTheme } from '@/context/ThemeContext';
import { WS_EVENTS, wsService } from '@/services/websocket';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Clock } from 'phosphor-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
  position: any;
  isPaper?: boolean;
  isDark?: boolean;
}

export default function PositionCard({ position: initialPosition, isPaper = true }: Props) {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const router = useRouter();

  const [pos, setPos] = useState(() => ({ ...initialPosition, id: initialPosition?.id }));
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setPos(prev => ({ ...prev, ...initialPosition }));
  }, [initialPosition]);

  // Keep a ref to the current position id so websocket handlers don't close over stale state.
  const idRef = useRef(pos.id);

  useEffect(() => {
    idRef.current = pos.id;
  }, [pos.id]);

  useEffect(() => {
    const handlePositionUpdate = (data: any) => {
      const actionId = data.position?.id ?? data.positionId;
      if (actionId === undefined) return;
      if (String(actionId) !== String(idRef.current)) return;

      // Show update indicator
      setIsUpdating(true);

      // Merge updated position fields using functional update to avoid stale closures
      setPos(prev => {
        const updated = { ...prev, ...data.position };
        if (data.currentPrice !== undefined) updated.currentPrice = data.currentPrice;
        if (data.profit !== undefined) updated.profit = data.profit;
        if (data.profitPercent !== undefined) updated.profitPercent = data.profitPercent;

        try {
          console.log('🔁 [PositionCard] Real-time update received for position', prev.id, {
            symbol: prev.symbol,
            oldPrice: prev.currentPrice,
            newPrice: updated.currentPrice,
            oldProfit: prev.profit,
            newProfit: updated.profit,
          });
        } catch {}

        return updated;
      });

      // Hide indicator after a short animation (shorter for snappier UI)
      setTimeout(() => setIsUpdating(false), 300);
    };

    const handleMTMBatchUpdate = (data: any) => {
      if (!data.positions || !Array.isArray(data.positions)) return;

      const myUpdate = data.positions.find((p: any) => String(p.id) === String(idRef.current));
      if (!myUpdate) return;

      setIsUpdating(true);
      setPos(prev => {
        try {
          console.log('📊 [PositionCard] Batch MTM update for position', prev.id, {
            symbol: prev.symbol,
            oldPrice: prev.currentPrice,
            newPrice: myUpdate.currentPrice,
            oldProfit: prev.profit,
            newProfit: myUpdate.profit,
          });
        } catch {}

        return {
          ...prev,
          currentPrice: myUpdate.currentPrice ?? prev.currentPrice,
          profit: myUpdate.profit ?? prev.profit,
          profitPercent: myUpdate.profitPercent ?? prev.profitPercent,
        };
      });

      setTimeout(() => setIsUpdating(false), 300);
    };

    // Subscribe once; handlers use idRef to target the correct position instantly.
    wsService.on(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
    wsService.on(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMBatchUpdate);

    return () => {
      wsService.off(WS_EVENTS.PAPER_POSITION_UPDATE, handlePositionUpdate);
      wsService.off(WS_EVENTS.PAPER_MTM_UPDATE, handleMTMBatchUpdate);
    };
  }, []);

  const formattedPosition = {
    ...pos,
    qty: pos.volume ?? pos.qty,
    entryPrice: pos.openPrice ?? pos.entryPrice,
    ltp: pos.currentPrice,
    mtm: Number(pos.profit) || 0,
    time: new Date(pos.closeTime || pos.openTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    exitPrice: pos.closePrice || 0,
    tradeId: pos.orderId,
    strategyName: pos.strategy?.name || pos.strategyName || 'Manual Trade',
  };

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: isDark ? 'rgba(10,10,26,0.7)' : '#fff',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(71,85,105,0.3)' : '#e2e8f0',
        marginBottom: 12,
        shadowColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
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
            <Text style={{ color: theme.text, fontWeight: '700' }}>{formattedPosition.symbol}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Clock size={10} color={theme.textSecondary} weight="bold" />
              <Text style={{ color: theme.textSecondary, marginLeft: 6 }}>{formattedPosition.time}</Text>
            </View>
            <Text style={{ color: theme.textSecondary }}>{formattedPosition.strategyName}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: formattedPosition.mtm >= 0 ? colors.success : colors.error, fontWeight: '700' }}>
            {formattedPosition.mtm >= 0 ? '+' : ''}{Number(formattedPosition.mtm).toFixed(2)} USD
          </Text>
          <LinearGradient colors={isPaper ? ['rgba(37,99,235,0.12)','rgba(37,99,235,0.06)'] : ['rgba(16,185,129,0.12)','rgba(16,185,129,0.06)']} style={{ padding: 6, borderRadius: 8, marginTop: 6 }}>
            <Text style={{ color: isPaper ? colors.primary : colors.success }}>{isPaper ? 'Paper' : 'Live'}</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={{ marginTop: 12, backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc', padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Volume</Text>
          <Text style={{ color: theme.text }}>{Number(formattedPosition.qty ?? 0).toFixed(4)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Entry Price</Text>
          <Text style={{ color: theme.text }}>{Number(formattedPosition.entryPrice ?? 0).toFixed(4)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Current Price</Text>
          <Text style={{ color: theme.text }}>{Number(formattedPosition.ltp ?? 0).toFixed(5)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff', borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ textAlign: 'center', color: theme.textSecondary }}>TP/SL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#ef4444' }}>
          <Text style={{ textAlign: 'center', color: '#fff' }}>⚡ Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
