import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, FlatList, RefreshControl, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import * as engineService from '../../src/api/engineService';
import { Colors } from '../../src/constants/colors';

// ── Helpers ───────────────────────────────────────────────────────────
const LEVEL_COLOR = {
  critical: Colors.alertCritical,
  warning:  Colors.alertWarning,
  info:     Colors.alertInfo,
};
const CATEGORY_ICON = {
  irrigation:  '💧', fertilizer: '🌿', disease: '🦠',
  pest:        '🐛', weather:    '🌦️', soil:    '🌱',
  harvest:     '🌾', general:    '📋',
};
const FILTERS = ['all', 'critical', 'warning', 'info'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Skeleton ──────────────────────────────────────────────────────────
function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [opacity]);
  return (
    <Animated.View style={[sk.card, { opacity }]}>
      <View style={sk.bar} />
      <View style={sk.body}>
        <View style={sk.title} />
        <View style={sk.line} />
        <View style={sk.lineShort} />
      </View>
    </Animated.View>
  );
}

// ── Alert card ────────────────────────────────────────────────────────
function AlertCard({ alert, onMarkRead, onDismiss, onPress }) {
  const barColor = LEVEL_COLOR[alert.level] ?? Colors.alertInfo;
  const catIcon  = CATEGORY_ICON[alert.category] ?? '📋';

  return (
    <TouchableOpacity style={c.card} activeOpacity={0.85} onPress={onPress}>
      {/* Unread blue dot */}
      {!alert.is_read && <View style={c.unreadDot} />}

      {/* Left level bar */}
      <View style={[c.levelBar, { backgroundColor: barColor }]} />

      <View style={c.content}>
        {/* Top row: category + level badge */}
        <View style={c.topRow}>
          <Text style={c.category}>
            {catIcon} {alert.category?.replace(/_/g, ' ')}
          </Text>
          <View style={[c.levelBadge, { backgroundColor: barColor }]}>
            <Text style={c.levelBadgeText}>{alert.level?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={c.title}>{alert.title}</Text>

        {/* Message */}
        <Text style={c.message} numberOfLines={2}>{alert.message}</Text>

        {/* Footer: time + actions */}
        <View style={c.footer}>
          <Text style={c.timeAgo}>{timeAgo(alert.created_at)}</Text>
          <View style={c.actions}>
            {!alert.is_read && (
              <TouchableOpacity
                style={c.actionBtn}
                onPress={(e) => { e.stopPropagation?.(); onMarkRead(alert.id); }}
              >
                <Text style={c.actionRead}>Mark read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={c.actionBtn}
              onPress={(e) => { e.stopPropagation?.(); onDismiss(alert.id); }}
            >
              <Text style={c.actionDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────
export default function AlertsScreen() {
  const router = useRouter();
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,    setFilter]    = useState('all');

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await engineService.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (_) {
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, []);

  const handleMarkRead = async (alertId) => {
    try {
      await engineService.markAlertRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => a.id === alertId ? { ...a, is_read: true } : a)
      );
    } catch (_) {}
  };

  const handleDismiss = async (alertId) => {
    try {
      await engineService.dismissAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (_) {}
  };

  const filtered = filter === 'all'
    ? alerts
    : alerts.filter((a) => a.level === filter);

  const criticalCount = alerts.filter((a) => a.level === 'critical').length;
  const warningCount  = alerts.filter((a) => a.level === 'warning').length;
  const infoCount     = alerts.filter((a) => a.level === 'info').length;

  const renderItem = ({ item }) => (
    <AlertCard
      alert={item}
      onMarkRead={handleMarkRead}
      onDismiss={handleDismiss}
      onPress={() => router.push({ pathname: '/alert/[alertId]', params: { alertId: item.id, alert: JSON.stringify(item) } })}
    />
  );

  const ListHeader = (
    <>
      {/* Summary bar */}
      <View style={s.summaryBar}>
        <Text style={[s.summaryNum, { color: Colors.alertCritical }]}>
          🔴 {criticalCount} Critical
        </Text>
        <Text style={[s.summaryNum, { color: Colors.alertWarning }]}>
          ⚠️ {warningCount} Warning
        </Text>
        <Text style={[s.summaryNum, { color: Colors.alertInfo }]}>
          💡 {infoCount} Info
        </Text>
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterPill, filter === f && s.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const EmptyComponent = (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>✅</Text>
      <Text style={s.emptyTitle}>No active alerts</Text>
      <Text style={s.emptyTitle2}>Your farm is looking good!</Text>
      <Text style={s.emptySub}>
        Alerts will appear here when your farm needs attention
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0E3D22', '#1B6B3A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <Text style={s.headerTitle}>Alerts</Text>
        <Text style={s.headerSub}>{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</Text>
      </LinearGradient>

      {loading ? (
        <View style={s.skeletonWrap}>
          {[0,1,2,3,4].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={EmptyComponent}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAlerts(true); }}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 3, fontWeight: '500' },

  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryNum: { fontSize: 13, fontWeight: '700' },

  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    elevation: 3,
  },
  filterText:       { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },

  list:        { paddingBottom: 24 },
  skeletonWrap:{ padding: 16 },

  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  emptyTitle2:{ fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginBottom: 12 },
  emptySub:   { fontSize: 14, color: Colors.textLight, textAlign: 'center', lineHeight: 20 },
});

// Alert card styles
const c = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  unreadDot: {
    position: 'absolute',
    left: 10,
    top: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.alertInfo,
    zIndex: 1,
  },
  levelBar: { width: 5 },
  content:  { flex: 1, padding: 14 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  category: { fontSize: 12, color: Colors.textSecondary, textTransform: 'capitalize', fontWeight: '500' },
  levelBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  title:   { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 5, lineHeight: 21 },
  message: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 10 },

  footer:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeAgo: { fontSize: 11, color: Colors.textLight, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 14 },
  actionBtn: { paddingVertical: 3 },
  actionRead:    { fontSize: 12, color: Colors.alertInfo,     fontWeight: '600' },
  actionDismiss: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});

// Skeleton styles
const sk = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    height: 100,
  },
  bar:       { width: 4, backgroundColor: '#E5E7EB' },
  body:      { flex: 1, padding: 12, gap: 8 },
  title:     { height: 16, backgroundColor: '#E5E7EB', borderRadius: 4, width: '60%' },
  line:      { height: 12, backgroundColor: '#E5E7EB', borderRadius: 4 },
  lineShort: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 4, width: '40%' },
});
