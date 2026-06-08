import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';

import * as farmService   from '../../../../../src/api/farmService';
import * as engineService from '../../../../../src/api/engineService';
import * as iotService    from '../../../../../src/api/iotService';
import useFarmStore from '../../../../../src/store/farmStore';
import { Colors } from '../../../../../src/constants/colors';

const POTATO_CYCLE_DAYS = 120;

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}
function addDays(dateStr, n) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const colorFor = (v, type) => {
  if (v == null) return Colors.textSecondary;
  if (type === 'moisture') {
    if (v >= 25 && v <= 80) return Colors.success;
    if ((v >= 15 && v < 25) || (v > 80 && v <= 90)) return Colors.warning;
    return Colors.error;
  }
  if (type === 'ph') {
    if (v >= 5.0 && v <= 6.5) return Colors.success;
    if ((v >= 4.5 && v < 5.0) || (v > 6.5 && v <= 7.5)) return Colors.warning;
    return Colors.error;
  }
  if (type === 'temp') {
    if (v >= 10 && v <= 25) return Colors.success;
    if (v > 25 && v <= 30) return Colors.warning;
    return Colors.error;
  }
  if (type === 'humidity') {
    if (v >= 50 && v <= 80) return Colors.success;
    if (v > 80 && v <= 90) return Colors.warning;
    return Colors.error;
  }
  return Colors.text;
};
const alertLevelColor = (level) => {
  if (level === 'critical') return Colors.alertCritical;
  if (level === 'warning')  return Colors.alertWarning;
  return Colors.alertInfo;
};

// ─────────────────────────────────────────────────────────────────────
export default function PlotDetailScreen() {
  const { farmId, plotId } = useLocalSearchParams();
  const router = useRouter();
  const { setActivePlot, setActiveCycle } = useFarmStore();

  const [plot,     setPlot]    = useState(null);
  const [cycle,    setCycle]   = useState(null);
  const [reading,  setReading] = useState(null);
  const [alerts,   setAlerts]  = useState([]);
  const [loading,  setLoading] = useState(true);
  const [addingDate, setAddingDate] = useState(false);
  const [dateInput,  setDateInput]  = useState('');
  const [savingDate, setSavingDate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plotData, cycles, rdg, alertsData] = await Promise.all([
        farmService.getPlot(farmId, plotId),
        farmService.getCycles(farmId, plotId).catch(() => []),
        iotService.getLatestReading(plotId).catch(() => null),
        engineService.getAlerts().catch(() => []),
      ]);
      setPlot(plotData);
      const activeCycle = Array.isArray(cycles)
        ? cycles.find((c) => c.is_active) ?? cycles[0] ?? null
        : null;
      setCycle(activeCycle);
      setReading(rdg);
      setAlerts(
        Array.isArray(alertsData)
          ? alertsData.filter((a) => String(a.plot) === String(plotId)).slice(0, 3)
          : []
      );
      setActivePlot(plotData);
      if (activeCycle) setActiveCycle(activeCycle);
    } catch (_) {}
    setLoading(false);
  }, [farmId, plotId]);

  useEffect(() => { load(); }, [load]);

  const handleSavePlantingDate = async () => {
    if (!dateInput.trim() || !cycle) return;
    setSavingDate(true);
    try {
      const updated = await farmService.updateCycle(farmId, plotId, cycle.id, {
        planting_date: dateInput.trim(),
      });
      setCycle(updated);
      setAddingDate(false);
      setDateInput('');
    } catch (_) {}
    setSavingDate(false);
  };

  const handleStartCycle = async () => {
    try {
      const newCycle = await farmService.createCycle(farmId, plotId, {
        variety: plot?.variety ?? undefined,
      });
      setCycle(newCycle);
      setActiveCycle(newCycle);
    } catch (_) {}
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header title="Plot" onBack={() => router.back()} />
        <View style={s.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  const days = cycle?.planting_date ? daysSince(cycle.planting_date) : null;
  const progress = days != null ? Math.min(days / POTATO_CYCLE_DAYS, 1) : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header title={plot?.name ?? 'Plot'} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Cycle card */}
        <View style={s.card}>
          {cycle ? (
            <>
              <View style={s.cycleTop}>
                {plot?.variety && (
                  <View style={s.varietyBadge}>
                    <Text style={s.varietyText}>{plot.variety}</Text>
                  </View>
                )}
                {cycle.growth_stage && (
                  <View style={s.stagePill}>
                    <Text style={s.stageText}>{cycle.growth_stage.replace(/_/g, ' ')}</Text>
                  </View>
                )}
              </View>

              {cycle.planting_date ? (
                <>
                  {/* Progress bar */}
                  <Text style={s.dayLabel}>
                    Day {days ?? '?'} of ~{POTATO_CYCLE_DAYS}
                  </Text>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  <View style={s.cycleDates}>
                    <Text style={s.cycleDateText}>🌱 Planted {fmtDate(cycle.planting_date)}</Text>
                    <Text style={s.cycleDateText}>
                      🌾 Est. harvest {addDays(cycle.planting_date, POTATO_CYCLE_DAYS)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.missingDateBanner}>
                    <Text style={s.missingDateText}>
                      ⚠️ Add planting date for accurate recommendations
                    </Text>
                    <TouchableOpacity onPress={() => setAddingDate(true)}>
                      <Text style={s.addDateLink}>Add Date</Text>
                    </TouchableOpacity>
                  </View>
                  {addingDate && (
                    <View style={s.dateInputRow}>
                      <TextInput
                        style={s.dateInput}
                        value={dateInput}
                        onChangeText={setDateInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[s.dateInputBtn, savingDate && { opacity: 0.6 }]}
                        onPress={handleSavePlantingDate}
                        disabled={savingDate}
                      >
                        <Text style={s.dateInputBtnText}>
                          {savingDate ? '…' : 'Save'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </>
          ) : (
            <View style={s.noCycle}>
              <Text style={s.noCycleText}>No active crop cycle</Text>
              <TouchableOpacity style={s.startCycleBtn} onPress={handleStartCycle}>
                <Text style={s.startCycleBtnText}>Start Crop Cycle</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick stats */}
        <Text style={s.sectionTitle}>Soil Conditions</Text>
        <View style={s.statsGrid}>
          <StatCell label="Moisture" value={reading?.moisture != null ? `${reading.moisture}%` : '—'} color={colorFor(reading?.moisture, 'moisture')} />
          <StatCell label="pH"       value={reading?.ph != null ? Number(reading.ph).toFixed(1) : '—'} color={colorFor(reading?.ph, 'ph')} />
          <StatCell label="Temp"     value={reading?.temperature != null ? `${reading.temperature}°C` : '—'} color={colorFor(reading?.temperature, 'temp')} />
          <StatCell label="Humidity" value={reading?.humidity != null ? `${reading.humidity}%` : '—'} color={colorFor(reading?.humidity, 'humidity')} />
        </View>

        {/* Navigation cards */}
        <Text style={s.sectionTitle}>Explore</Text>
        <View style={s.navCards}>
          <TouchableOpacity
            style={s.navCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/farm/${farmId}/plot/${plotId}/sensors`)}
          >
            <Text style={s.navCardIcon}>📡</Text>
            <Text style={s.navCardLabel}>Sensor Data</Text>
            <Text style={s.navCardSub}>View readings & history</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.navCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/farm/${farmId}/plot/${plotId}/scan`)}
          >
            <Text style={s.navCardIcon}>📸</Text>
            <Text style={s.navCardLabel}>Disease Scan</Text>
            <Text style={s.navCardSub}>AI crop analysis</Text>
          </TouchableOpacity>
        </View>

        {/* Recent alerts */}
        {alerts.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Recent Alerts</Text>
            {alerts.map((a) => (
              <View key={a.id} style={s.alertRow}>
                <View style={[s.alertBar, { backgroundColor: alertLevelColor(a.level) }]} />
                <View style={s.alertContent}>
                  <Text style={s.alertTitle}>{a.title}</Text>
                  <Text style={s.alertMsg} numberOfLines={1}>{a.message}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }) {
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
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
    </LinearGradient>
  );
}

function StatCell({ label, value, color }) {
  return (
    <View style={st.cell}>
      <Text style={[st.value, { color }]}>{value}</Text>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  back:        { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 5, fontWeight: '500' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  scroll:      { padding: 16 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  cycleTop: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  varietyBadge: {
    backgroundColor: Colors.primaryLight + '33',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  varietyText: { fontSize: 12, fontWeight: '600', color: Colors.primaryDark },
  stagePill: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stageText: { fontSize: 12, color: Colors.textSecondary, textTransform: 'capitalize' },

  dayLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  progressTrack: {
    height: 10,
    backgroundColor: Colors.background,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: 10,
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
  cycleDates:    { gap: 4 },
  cycleDateText: { fontSize: 13, color: Colors.textSecondary },

  missingDateBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missingDateText: { fontSize: 13, color: '#92400E', flex: 1, marginRight: 8 },
  addDateLink:     { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  dateInputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dateInput: {
    flex: 1, height: 44, borderWidth: 1.5, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text,
  },
  dateInputBtn: {
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  dateInputBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  noCycle:        { alignItems: 'center', paddingVertical: 8 },
  noCycleText:    { fontSize: 15, color: Colors.textSecondary, marginBottom: 14 },
  startCycleBtn:  {
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  startCycleBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },

  navCards: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  navCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  navCardIcon:  { fontSize: 32, marginBottom: 8 },
  navCardLabel: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  navCardSub:   { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  alertRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  alertBar:     { width: 4 },
  alertContent: { flex: 1, padding: 12 },
  alertTitle:   { fontSize: 13, fontWeight: '600', color: Colors.text },
  alertMsg:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});

const st = StyleSheet.create({
  cell: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  value: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  label: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
});
