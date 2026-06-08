import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';

import * as iotService    from '../../../../../src/api/iotService';
import * as engineService from '../../../../../src/api/engineService';
import { Colors } from '../../../../../src/constants/colors';

function fmtTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-KE', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}
const SOURCE_COLOR = {
  mqtt:      Colors.success,
  manual:    Colors.alertInfo,
  simulator: Colors.alertWarning,
};

const FIELDS = [
  { key: 'moisture',    label: 'Moisture', unit: '%',    keyboard: 'decimal-pad' },
  { key: 'ph',          label: 'pH',       unit: '',     keyboard: 'decimal-pad' },
  { key: 'temperature', label: 'Temp',     unit: '°C',   keyboard: 'decimal-pad' },
  { key: 'humidity',    label: 'Humidity', unit: '%',    keyboard: 'decimal-pad' },
  { key: 'npk_n',       label: 'NPK-N',    unit: 'ppm',  keyboard: 'decimal-pad' },
  { key: 'npk_p',       label: 'NPK-P',    unit: 'ppm',  keyboard: 'decimal-pad' },
  { key: 'npk_k',       label: 'NPK-K',    unit: 'ppm',  keyboard: 'decimal-pad' },
];

// ─────────────────────────────────────────────────────────────────────
export default function SensorsScreen() {
  const { farmId, plotId } = useLocalSearchParams();
  const router = useRouter();

  const [sensors,    setSensors]    = useState([]);
  const [latest,     setLatest]     = useState(null);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [form,       setForm]       = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sensorData, latestRdg, histRdg] = await Promise.all([
        iotService.getSensors(plotId).catch(() => []),
        iotService.getLatestReading(plotId).catch(() => null),
        iotService.getReadings(plotId).catch(() => []),
      ]);
      setSensors(Array.isArray(sensorData) ? sensorData : []);
      setLatest(latestRdg);
      setHistory(Array.isArray(histRdg) ? histRdg.slice(0, 20) : []);
    } catch (_) {}
    setLoading(false);
  }, [plotId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitReading = async () => {
    const payload = { plot: plotId, source: 'manual' };
    FIELDS.forEach(({ key }) => {
      const val = form[key]?.trim();
      if (val) payload[key] = parseFloat(val);
    });
    if (Object.keys(payload).length <= 2) return; // nothing entered

    setSubmitting(true);
    setSuccess(false);
    try {
      await iotService.submitManualReading(payload);
      // Trigger analysis silently
      engineService.runAnalysis(plotId).catch(() => {});
      // Refresh readings
      const [latestRdg, histRdg] = await Promise.all([
        iotService.getLatestReading(plotId).catch(() => null),
        iotService.getReadings(plotId).catch(() => []),
      ]);
      setLatest(latestRdg);
      setHistory(Array.isArray(histRdg) ? histRdg.slice(0, 20) : []);
      setForm({});
      setSuccess(true);
      setExpanded(false);
      setTimeout(() => setSuccess(false), 4000);
    } catch (_) {}
    setSubmitting(false);
  };

  const renderHistoryRow = ({ item }) => (
    <View style={h.row}>
      <Text style={h.ts}>{fmtTs(item.timestamp)}</Text>
      <Text style={h.val}>{item.moisture ?? '—'}%</Text>
      <Text style={h.val}>{item.ph != null ? Number(item.ph).toFixed(1) : '—'}</Text>
      <Text style={h.val}>{item.temperature ?? '—'}°</Text>
      <View style={[h.badge, { backgroundColor: SOURCE_COLOR[item.source?.toLowerCase()] ?? Colors.textSecondary }]}>
        <Text style={h.badgeText}>{item.source ?? '—'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header onBack={() => router.back()} plotId={plotId} />
        <View style={s.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header onBack={() => router.back()} plotId={plotId} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Registered sensors */}
        <Text style={s.sectionTitle}>Registered Sensors</Text>
        <View style={s.card}>
          {sensors.length === 0 ? (
            <>
              <Text style={s.noData}>No sensors registered</Text>
              <Text style={s.hint}>Sensors auto-submit readings via MQTT</Text>
            </>
          ) : (
            sensors.map((sensor) => (
              <View key={sensor.id} style={s.sensorRow}>
                <View style={[s.activeDot, { backgroundColor: sensor.is_active ? Colors.success : Colors.textLight }]} />
                <View style={s.sensorInfo}>
                  <Text style={s.sensorType}>{sensor.sensor_type?.replace(/_/g, ' ')}</Text>
                  <Text style={s.sensorId}>{sensor.device_id}</Text>
                </View>
                <Text style={s.sensorStatus}>{sensor.is_active ? 'Active' : 'Inactive'}</Text>
              </View>
            ))
          )}
          <Text style={s.hint}>Sensors auto-submit readings via MQTT</Text>
        </View>

        {/* Latest reading */}
        <Text style={s.sectionTitle}>Latest Reading</Text>
        <View style={s.card}>
          {latest ? (
            <>
              <View style={s.latestHeader}>
                <Text style={s.latestTs}>{fmtTs(latest.timestamp)}</Text>
                <View style={[s.sourceBadge, { backgroundColor: SOURCE_COLOR[latest.source?.toLowerCase()] ?? Colors.textSecondary }]}>
                  <Text style={s.sourceBadgeText}>{latest.source ?? '—'}</Text>
                </View>
              </View>
              <View style={s.readingGrid}>
                {FIELDS.map(({ key, label, unit }) =>
                  latest[key] != null ? (
                    <View key={key} style={s.readingCell}>
                      <Text style={s.readingVal}>{typeof latest[key] === 'number' ? latest[key].toFixed(key === 'ph' ? 1 : 0) : latest[key]}{unit}</Text>
                      <Text style={s.readingLabel}>{label}</Text>
                    </View>
                  ) : null
                )}
              </View>
            </>
          ) : (
            <Text style={s.noData}>No readings yet</Text>
          )}
        </View>

        {/* Success message */}
        {success && (
          <View style={s.successBox}>
            <Text style={s.successText}>
              ✅ Reading submitted — analysis updating...
            </Text>
          </View>
        )}

        {/* Manual entry */}
        <TouchableOpacity
          style={s.manualHeader}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={s.sectionTitle}>Submit Manual Reading</Text>
          <Text style={s.expandIcon}>{expanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {expanded && (
          <View style={s.card}>
            {FIELDS.map(({ key, label, unit, keyboard }) => (
              <View key={key} style={s.formRow}>
                <Text style={s.formLabel}>{label}{unit ? ` (${unit})` : ''}</Text>
                <TextInput
                  style={s.formInput}
                  value={form[key] ?? ''}
                  onChangeText={(t) => setForm((prev) => ({ ...prev, [key]: t }))}
                  placeholder="—"
                  placeholderTextColor="#9CA3AF"
                  keyboardType={keyboard}
                />
              </View>
            ))}
            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmitReading}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={s.submitText}>Submit Reading</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Reading history */}
        {history.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Reading History</Text>
            <View style={s.card}>
              <View style={h.header}>
                <Text style={h.hTs}>Time</Text>
                <Text style={h.hVal}>Moist</Text>
                <Text style={h.hVal}>pH</Text>
                <Text style={h.hVal}>Temp</Text>
                <Text style={h.hBadge}>Src</Text>
              </View>
              <FlatList
                data={history}
                keyExtractor={(item, i) => String(item.id ?? i)}
                renderItem={renderHistoryRow}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={h.sep} />}
              />
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack, plotId }) {
  return (
    <LinearGradient
      colors={['#0E3D22', '#1B6B3A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={s.header}
    >
      <TouchableOpacity onPress={onBack}>
        <Text style={s.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle}>Sensor Data</Text>
      <Text style={s.headerSub} numberOfLines={1}>Plot: {plotId}</Text>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  back:       { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 5, fontWeight: '500' },
  headerTitle:{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub:  { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  scroll:     { padding: 16, paddingBottom: 24 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  noData: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 8 },
  hint:   { fontSize: 12, color: Colors.textLight, textAlign: 'center', marginTop: 6 },

  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  activeDot:  { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  sensorInfo: { flex: 1 },
  sensorType: { fontSize: 14, fontWeight: '600', color: Colors.text, textTransform: 'capitalize' },
  sensorId:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sensorStatus:{ fontSize: 12, color: Colors.textSecondary },

  latestHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  latestTs:     { fontSize: 13, color: Colors.textSecondary },
  sourceBadge:  { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  sourceBadgeText: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },

  readingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  readingCell: {
    width: '30%',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  readingVal:  { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  readingLabel:{ fontSize: 11, color: Colors.textSecondary },

  successBox: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: { fontSize: 14, color: Colors.success, fontWeight: '600', textAlign: 'center' },

  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  expandIcon: { fontSize: 14, color: Colors.textSecondary },

  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  formLabel: { width: 90, fontSize: 13, fontWeight: '600', color: Colors.text },
  formInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.text,
  },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

// History table styles
const h = StyleSheet.create({
  header: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: 4,
  },
  hTs:    { flex: 2, fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  hVal:   { flex: 1, fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  hBadge: { width: 48, fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textAlign: 'right' },

  row:   { flexDirection: 'row', paddingVertical: 8, alignItems: 'center' },
  ts:    { flex: 2, fontSize: 12, color: Colors.text },
  val:   { flex: 1, fontSize: 12, color: Colors.text, textAlign: 'center' },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { fontSize: 9, color: '#FFFFFF', fontWeight: '700' },
  sep:   { height: 1, backgroundColor: Colors.divider },
});
