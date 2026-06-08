import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';

import * as farmService from '../../../src/api/farmService';
import useFarmStore from '../../../src/store/farmStore';
import { Colors } from '../../../src/constants/colors';

const VARIETIES = ['Shangi', 'Dutch Robijn', 'Markies', 'Kenya Mpya', 'Tigoni', 'Other'];
const VARIETY_SLUGS = {
  'Shangi':      'shangi',
  'Dutch Robijn':'dutch_robijn',
  'Markies':     'markies',
  'Kenya Mpya':  'kenya_mpya',
  'Tigoni':      'tigoni',
  'Other':       'other',
};

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────
export default function FarmDetailScreen() {
  const { farmId } = useLocalSearchParams();
  const router     = useRouter();
  const { setActiveFarm, setActivePlot } = useFarmStore();

  const [farm,    setFarm]    = useState(null);
  const [plots,   setPlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPlot, setShowAddPlot] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [farmData, plotsData] = await Promise.all([
        farmService.getFarm(farmId),
        farmService.getPlots(farmId),
      ]);
      setFarm(farmData);
      setPlots(Array.isArray(plotsData) ? plotsData : []);
      setActiveFarm(farmData);
      if (plotsData?.length) setActivePlot(plotsData[0]);
    } catch (_) {}
    setLoading(false);
  }, [farmId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header name="Farm" onBack={() => router.back()} />
        <View style={s.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header name={farm?.name ?? 'Farm'} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Farm info card */}
        {farm && (
          <View style={s.infoCard}>
            {(farm.county || farm.sub_county) && (
              <InfoRow icon="📍" label={[farm.county, farm.sub_county].filter(Boolean).join(', ')} />
            )}
            {farm.altitude != null && (
              <InfoRow icon="🏔️" label={`${farm.altitude} m altitude`} />
            )}
            {farm.latitude != null && farm.longitude != null && (
              <InfoRow icon="🗺️" label={`${Number(farm.latitude).toFixed(4)}, ${Number(farm.longitude).toFixed(4)}`} />
            )}
          </View>
        )}

        {/* Plots section */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>My Plots</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddPlot(true)}>
            <Text style={s.addBtnText}>＋ Add Plot</Text>
          </TouchableOpacity>
        </View>

        {plots.length === 0 ? (
          <View style={s.emptyPlots}>
            <Text style={s.emptyPlotIcon}>🗺️</Text>
            <Text style={s.emptyPlotText}>Add your first plot to start monitoring</Text>
            <TouchableOpacity style={s.addBtn2} onPress={() => setShowAddPlot(true)}>
              <Text style={s.addBtnText2}>Add Plot</Text>
            </TouchableOpacity>
          </View>
        ) : (
          plots.map((plot) => (
            <PlotCard
              key={plot.id}
              plot={plot}
              onPress={() => router.push(`/farm/${farmId}/plot/${plot.id}`)}
            />
          ))
        )}
      </ScrollView>

      <AddPlotModal
        visible={showAddPlot}
        farmId={farmId}
        onClose={() => setShowAddPlot(false)}
        onCreated={(plot) => {
          setPlots((prev) => [...prev, plot]);
          setShowAddPlot(false);
          router.push(`/farm/${farmId}/plot/${plot.id}`);
        }}
      />
    </SafeAreaView>
  );
}

// ── Header ────────────────────────────────────────────────────────────
function Header({ name, onBack }) {
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
      <Text style={s.headerTitle} numberOfLines={1}>{name}</Text>
    </LinearGradient>
  );
}

// ── Info row ──────────────────────────────────────────────────────────
function InfoRow({ icon, label }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <Text style={s.infoLabel}>{label}</Text>
    </View>
  );
}

// ── Plot card ─────────────────────────────────────────────────────────
function PlotCard({ plot, onPress }) {
  const hasStage = plot.active_cycle && plot.growth_stage;
  return (
    <TouchableOpacity style={p.card} activeOpacity={0.85} onPress={onPress}>
      <View style={p.top}>
        <View style={p.titleRow}>
          <Text style={p.name}>{plot.name}</Text>
          {plot.variety && (
            <View style={p.varietyBadge}>
              <Text style={p.varietyText}>{plot.variety}</Text>
            </View>
          )}
        </View>
        <Text style={p.arrow}>→</Text>
      </View>
      <View style={p.meta}>
        {plot.size_acres != null && (
          <Text style={p.metaItem}>📐 {plot.size_acres} acres</Text>
        )}
        {hasStage ? (
          <Text style={p.metaItem}>
            🌱 {plot.growth_stage?.replace(/_/g, ' ')}
          </Text>
        ) : (
          <Text style={p.metaItem}>⏳ No active cycle</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Add Plot Modal ────────────────────────────────────────────────────
function AddPlotModal({ visible, farmId, onClose, onCreated }) {
  const [name,        setName]       = useState('');
  const [size,        setSize]       = useState('');
  const [variety,     setVariety]    = useState('');
  const [plantDate,   setPlantDate]  = useState(new Date());
  const [showPicker,  setShowPicker] = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [errors,      setErrors]     = useState({});

  const reset = () => {
    setName(''); setSize(''); setVariety('');
    setPlantDate(new Date()); setShowPicker(false);
    setErrors({}); setSaving(false);
  };

  const dateLabel = plantDate.toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const handleSubmit = async () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Plot name is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const varietySlug = variety ? (VARIETY_SLUGS[variety] || variety) : undefined;
      const plot = await farmService.createPlot(farmId, {
        name: name.trim(),
        size_acres: size ? parseFloat(size) : 0,
        crop: 'potato',
        variety: varietySlug,
      });

      // Always create a crop cycle with the selected planting date
      const plantingDateStr = plantDate.toISOString().split('T')[0];
      await farmService.createCycle(farmId, plot.id, {
        planting_date: plantingDateStr,
        variety: varietySlug,
      }).catch(() => {}); // non-fatal if cycle fails

      reset();
      onCreated(plot);
    } catch (_) {
      setErrors({ api: 'Failed to create plot. Please try again.' });
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={m.sheet}>
        <View style={m.handle} />
        <Text style={m.title}>Add Plot</Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <MInput
            label="Plot Name *"
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({...e, name: ''})); }}
            placeholder="e.g. Upper Field"
            error={errors.name}
          />
          <MInput
            label="Size (acres)"
            value={size}
            onChangeText={setSize}
            placeholder="e.g. 2.5"
            keyboardType="decimal-pad"
          />

          {/* Variety pill selector */}
          <Text style={m.label}>Potato Variety</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={m.pillRow}
            contentContainerStyle={{ gap: 8 }}
          >
            {VARIETIES.map((v) => (
              <TouchableOpacity
                key={v}
                style={[m.pill, variety === v && m.pillActive]}
                onPress={() => setVariety(v === variety ? '' : v)}
              >
                <Text style={[m.pillText, variety === v && m.pillTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Planting date — calendar picker */}
          <Text style={m.label}>Planting Date</Text>
          <TouchableOpacity
            style={m.dateTrigger}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.75}
          >
            <Text style={m.dateIcon}>📅</Text>
            <Text style={m.dateLabel}>{dateLabel}</Text>
            <Text style={m.dateChevron}>›</Text>
          </TouchableOpacity>

          {/* Native date picker — shows as dialog on Android, spinner on iOS */}
          {showPicker && (
            <DateTimePicker
              value={plantDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selected) => {
                setShowPicker(Platform.OS === 'ios');
                if (selected) setPlantDate(selected);
              }}
            />
          )}

          {!!errors.api && <Text style={m.apiErr}>{errors.api}</Text>}

          <TouchableOpacity
            style={[m.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={m.submitText}>Add Plot</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={m.cancelBtn} onPress={() => { reset(); onClose(); }}>
            <Text style={m.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function MInput({ label, value, onChangeText, placeholder, keyboardType, error }) {
  return (
    <View style={m.inputWrap}>
      <Text style={m.label}>{label}</Text>
      <TextInput
        style={[m.input, !!error && m.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? 'default'}
      />
      {!!error && <Text style={m.errorText}>{error}</Text>}
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
  scroll:      { padding: 16, paddingBottom: 32 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoIcon: { fontSize: 16, marginRight: 10 },
  infoLabel:{ fontSize: 14, color: Colors.text },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  addBtn:       {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  emptyPlots:    { alignItems: 'center', paddingVertical: 40 },
  emptyPlotIcon: { fontSize: 48, marginBottom: 12 },
  emptyPlotText: { fontSize: 15, color: Colors.textSecondary, marginBottom: 20, textAlign: 'center' },
  addBtn2:       {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  addBtnText2: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

const p = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  top:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  name:      { fontSize: 17, fontWeight: '800', color: Colors.text },
  arrow:     { fontSize: 20, color: Colors.primary, fontWeight: '700' },
  varietyBadge: {
    backgroundColor: Colors.borderGreen,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  varietyText: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark },
  meta:        { gap: 5 },
  metaItem:    { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
});

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 22, letterSpacing: 0.2 },

  inputWrap:  { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 7, letterSpacing: 0.1 },
  input: {
    height: 50, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14,
    fontSize: 15, color: Colors.text, backgroundColor: '#F9FAFB',
  },
  inputError: { borderColor: Colors.error, backgroundColor: '#FFF5F5' },
  errorText:  { fontSize: 12, color: Colors.error, marginTop: 5 },

  pillRow: { marginBottom: 16 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 22, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  pillActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText:       { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '700' },

  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  dateIcon:    { fontSize: 18, marginRight: 10 },
  dateLabel:   { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  dateChevron: { fontSize: 22, color: Colors.textLight },

  apiErr: { fontSize: 13, color: Colors.error, marginBottom: 12, textAlign: 'center' },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 10, marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  cancelBtn:  { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
});
