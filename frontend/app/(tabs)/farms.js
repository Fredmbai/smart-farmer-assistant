import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

import * as farmService from '../../src/api/farmService';
import { Colors } from '../../src/constants/colors';

// ─────────────────────────────────────────────────────────────────────
export default function FarmsScreen() {
  const router = useRouter();

  const [farms,    setFarms]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);

  const loadFarms = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await farmService.getFarms();
      setFarms(Array.isArray(data) ? data : []);
    } catch (_) {
      setFarms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadFarms(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadFarms(true);
  };

  const renderFarm = ({ item }) => (
    <TouchableOpacity
      style={c.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/farm/${item.id}`)}
    >
      <View style={c.cardMain}>
        <Text style={c.farmName}>{item.name}</Text>
        <Text style={c.arrow}>→</Text>
      </View>
      <View style={c.meta}>
        {(item.county || item.sub_county) && (
          <Text style={c.metaItem}>
            📍 {[item.county, item.sub_county].filter(Boolean).join(', ')}
          </Text>
        )}
        {item.plot_count != null && (
          <Text style={c.metaItem}>📐 {item.plot_count} plot{item.plot_count !== 1 ? 's' : ''}</Text>
        )}
      </View>
    </TouchableOpacity>
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
        <Text style={s.headerTitle}>My Farms</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
          <Text style={s.addBtnText}>＋</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : farms.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🚜</Text>
          <Text style={s.emptyTitle}>No farms yet</Text>
          <Text style={s.emptySub}>Add your first farm to get started</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setShowModal(true)}>
            <Text style={s.emptyBtnText}>Add Farm</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={farms}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderFarm}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      )}

      <CreateFarmModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(farm) => {
          setFarms((prev) => [farm, ...prev]);
          setShowModal(false);
          router.push(`/farm/${farm.id}`);
        }}
      />
    </SafeAreaView>
  );
}

// ── Create Farm Modal ─────────────────────────────────────────────────
function CreateFarmModal({ visible, onClose, onCreated }) {
  const [name,      setName]      = useState('');
  const [county,    setCounty]    = useState('');
  const [subCounty, setSubCounty] = useState('');
  const [lat,       setLat]       = useState(null);
  const [lon,       setLon]       = useState(null);
  const [locLabel,  setLocLabel]  = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState({});

  const reset = () => {
    setName(''); setCounty(''); setSubCounty('');
    setLat(null); setLon(null); setLocLabel('');
    setErrors({}); setSaving(false);
  };

  const handleGetLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocLabel('Location permission denied');
        setLocLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000,
        maximumAge: 60000,
      });
      setLat(pos.coords.latitude);
      setLon(pos.coords.longitude);
      setLocLabel(`📍 ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
    } catch (err) {
      const msg = err?.message?.toLowerCase() ?? '';
      if (msg.includes('timeout') || msg.includes('timed out')) {
        setLocLabel('Location timed out — try again or enter manually');
      } else {
        setLocLabel('Could not get location');
      }
    } finally {
      setLocLoading(false);
    }
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!name.trim())   errs.name   = 'Farm name is required';
    if (!county.trim()) errs.county = 'County is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        county: county.trim(),
        sub_county: subCounty.trim() || undefined,
        latitude:  lat ?? undefined,
        longitude: lon ?? undefined,
      };
      const farm = await farmService.createFarm(payload);
      reset();
      onCreated(farm);
    } catch (_) {
      setErrors({ api: 'Failed to create farm. Please try again.' });
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={m.sheet}>
        <View style={m.handle} />
        <Text style={m.title}>Add New Farm</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <ModalInput
            label="Farm Name *"
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({...e, name: ''})); }}
            placeholder="e.g. Kamau Farm"
            error={errors.name}
          />
          <ModalInput
            label="County *"
            value={county}
            onChangeText={(t) => { setCounty(t); setErrors((e) => ({...e, county: ''})); }}
            placeholder="e.g. Nyandarua"
            autoCapitalize="words"
            error={errors.county}
          />
          <ModalInput
            label="Sub County"
            value={subCounty}
            onChangeText={setSubCounty}
            placeholder="e.g. Ol Kalou"
            autoCapitalize="words"
          />

          {/* GPS */}
          <TouchableOpacity
            style={[m.gpsBtn, locLoading && { opacity: 0.6 }]}
            onPress={handleGetLocation}
            disabled={locLoading}
          >
            {locLoading
              ? <ActivityIndicator color={Colors.primary} size="small" />
              : <Text style={m.gpsBtnText}>📍 Use My Location</Text>
            }
          </TouchableOpacity>
          {!!locLabel && (
            <Text style={[
              m.locLabel,
              { color: locLabel.startsWith('📍') ? Colors.success : Colors.error },
            ]}>
              {locLabel}
            </Text>
          )}

          {!!errors.api && <Text style={m.apiErr}>{errors.api}</Text>}

          <TouchableOpacity
            style={[m.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={m.submitText}>Create Farm</Text>
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

function ModalInput({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, error }) {
  return (
    <View style={m.inputWrap}>
      <Text style={m.inputLabel}>{label}</Text>
      <TextInput
        style={[m.input, !!error && m.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
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
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  addBtnText: { fontSize: 22, color: '#FFFFFF', lineHeight: 28, marginTop: -2 },

  list:    { padding: 16, paddingBottom: 24 },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  emptyIcon:  { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: Colors.textSecondary, marginBottom: 28, textAlign: 'center' },
  emptyBtn:   {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 36, paddingVertical: 14,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

const c = StyleSheet.create({
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
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  farmName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  arrow:    { fontSize: 20, color: Colors.primary, fontWeight: '700' },
  meta:     { gap: 5 },
  metaItem: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
});

const m = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: Colors.overlay,
  },
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
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 7, letterSpacing: 0.1 },
  input: {
    height: 50, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14,
    fontSize: 15, color: Colors.text, backgroundColor: '#F9FAFB',
  },
  inputError: { borderColor: Colors.error, backgroundColor: '#FFF5F5' },
  errorText:  { fontSize: 12, color: Colors.error, marginTop: 5 },

  gpsBtn: {
    height: 48, borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, backgroundColor: Colors.surfaceTinted,
  },
  gpsBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  locLabel:   { fontSize: 13, marginBottom: 12, textAlign: 'center' },

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
