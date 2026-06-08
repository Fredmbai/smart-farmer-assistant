import { useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';

import * as engineService from '../../src/api/engineService';
import { Colors } from '../../src/constants/colors';

// ── Helpers ───────────────────────────────────────────────────────────
const LEVEL_COLOR = {
  critical: Colors.alertCritical,
  warning:  Colors.alertWarning,
  info:     Colors.alertInfo,
};
const LEVEL_LABEL = {
  critical: 'CRITICAL ALERT',
  warning:  'WARNING ALERT',
  info:     'INFO ALERT',
};
const CATEGORY_ICON = {
  irrigation: '💧', fertilizer: '🌿', disease: '🦠',
  pest: '🐛', weather: '🌦️', soil: '🌱',
  harvest: '🌾', general: '📋',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────
export default function AlertDetailScreen() {
  const { alertId, alert: alertParam } = useLocalSearchParams();
  const router = useRouter();

  // Prefer pre-fetched alert from params, fall back to API lookup
  const [alert, setAlert]   = useState(alertParam ? JSON.parse(alertParam) : null);
  const [loading, setLoading] = useState(!alertParam);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (alert) return;
    engineService.getAlerts()
      .then((data) => {
        const found = Array.isArray(data)
          ? data.find((a) => String(a.id) === String(alertId))
          : null;
        setAlert(found ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async () => {
    setWorking(true);
    try {
      await engineService.markAlertRead(alertId);
      setAlert((prev) => ({ ...prev, is_read: true }));
    } catch (_) {}
    setWorking(false);
  };

  const handleDismiss = async () => {
    setWorking(true);
    try {
      await engineService.dismissAlert(alertId);
      router.back();
    } catch (_) {
      setWorking(false);
    }
  };

  const GradientHeader = ({ children }) => (
    <LinearGradient colors={['#0E3D22', '#1B6B3A']} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={s.header}>
      {children}
    </LinearGradient>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <GradientHeader>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Alert Detail</Text>
        </GradientHeader>
        <View style={s.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!alert) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <GradientHeader>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Alert</Text>
        </GradientHeader>
        <View style={s.centered}>
          <Text style={s.notFound}>Alert not found.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const bannerColor = LEVEL_COLOR[alert.level] ?? Colors.alertInfo;
  const catIcon     = CATEGORY_ICON[alert.category] ?? '📋';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0E3D22', '#1B6B3A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Alert Detail</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Level banner */}
        <View style={[s.banner, { backgroundColor: bannerColor }]}>
          <Text style={s.bannerText}>
            {LEVEL_LABEL[alert.level] ?? 'ALERT'}
          </Text>
        </View>

        <View style={s.body}>
          {/* Category icon + title */}
          <Text style={s.catIcon}>{catIcon}</Text>
          <Text style={s.title}>{alert.title}</Text>
          <Text style={s.timestamp}>{formatDate(alert.created_at)}</Text>

          <View style={s.divider} />

          {/* What's happening */}
          <Text style={s.sectionLabel}>What's happening</Text>
          <Text style={s.messageText}>{alert.message}</Text>

          {/* What to do */}
          {!!alert.action_required && (
            <>
              <Text style={s.sectionLabel}>What to do</Text>
              <View style={s.actionBox}>
                <Text style={s.actionText}>{alert.action_required}</Text>
              </View>
            </>
          )}

          {/* Farm details */}
          {(alert.plot_name || alert.farm_name || alert.plot) && (
            <>
              <Text style={s.sectionLabel}>Farm Details</Text>
              <View style={s.detailCard}>
                {!!alert.plot_name && (
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>Plot</Text>
                    <Text style={s.detailVal}>{alert.plot_name}</Text>
                  </View>
                )}
                {!!alert.farm_name && (
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>Farm</Text>
                    <Text style={s.detailVal}>{alert.farm_name}</Text>
                  </View>
                )}
                {!!alert.category && (
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>Category</Text>
                    <Text style={s.detailVal}>{alert.category?.replace(/_/g, ' ')}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <View style={s.divider} />

          {/* Action buttons */}
          {!alert.is_read && (
            <TouchableOpacity
              style={s.btnOutline}
              onPress={handleMarkRead}
              disabled={working}
            >
              <Text style={s.btnOutlineText}>
                {working ? 'Updating…' : 'Mark as Read'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.btnOutline, s.btnDismiss]}
            onPress={handleDismiss}
            disabled={working}
          >
            <Text style={s.btnDismissText}>
              {working ? 'Updating…' : 'Dismiss Alert'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  back:        { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },

  banner: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },

  scroll: { flexGrow: 1, paddingBottom: 40 },
  body:   { padding: 20 },

  catIcon:   { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title:     { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 6 },
  timestamp: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },

  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 20 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  actionBox: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
    marginBottom: 20,
  },
  actionText: { fontSize: 15, color: Colors.text, lineHeight: 22 },

  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailKey: { fontSize: 14, color: Colors.textSecondary },
  detailVal: { fontSize: 14, fontWeight: '600', color: Colors.text, textTransform: 'capitalize' },

  btnOutline: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnOutlineText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  btnDismiss:     { borderColor: '#9CA3AF' },
  btnDismissText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:  { fontSize: 16, color: Colors.textSecondary, marginBottom: 12 },
  backLink:  { fontSize: 15, color: Colors.primary, fontWeight: '600' },
});
