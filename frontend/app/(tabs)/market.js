import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import * as marketService from '../../src/api/marketService';
import { Colors } from '../../src/constants/colors';

// ── Helpers ───────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
const SOURCE_LABEL = {
  farmer_report: 'Farmer Report',
  official:      'Official',
  scraped:       'Scraped',
};
const SOURCE_COLOR = {
  farmer_report: Colors.alertInfo,
  official:      Colors.success,
  scraped:       Colors.alertWarning,
};
const TREND_ICON  = { rising: '📈', falling: '📉', stable: '➡️' };
const TREND_LABEL = { rising: 'Rising', falling: 'Falling', stable: 'Stable' };
const TREND_COLOR = { rising: Colors.success, falling: Colors.error, stable: Colors.textSecondary };

// ─────────────────────────────────────────────────────────────────────
export default function MarketScreen() {
  const [trend,      setTrend]      = useState(null);
  const [prices,     setPrices]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [trendData, pricesData] = await Promise.all([
        marketService.getTrend().catch(() => null),
        marketService.getPrices().catch(() => []),
      ]);
      setTrend(trendData);
      setPrices(Array.isArray(pricesData) ? pricesData : []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const renderPrice = ({ item }) => {
    const src = item.source ?? 'farmer_report';
    return (
      <View style={c.row}>
        <View style={c.rowLeft}>
          <Text style={c.marketName}>{item.market_name ?? '—'}</Text>
          <Text style={c.county}>{item.county ?? ''}</Text>
          <View style={[c.srcBadge, { backgroundColor: SOURCE_COLOR[src] ?? Colors.textSecondary }]}>
            <Text style={c.srcText}>{SOURCE_LABEL[src] ?? src}</Text>
          </View>
        </View>
        <View style={c.rowRight}>
          <Text style={c.price}>KES {item.price_per_kg ?? '—'}/kg</Text>
          <Text style={c.date}>{fmtDate(item.reported_at ?? item.date)}</Text>
        </View>
      </View>
    );
  };

  const trendDir   = trend?.trend_direction ?? 'stable';
  const trendColor = TREND_COLOR[trendDir];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0E3D22', '#1B6B3A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <Text style={s.headerTitle}>Market Prices</Text>
        <Text style={s.headerSub}>Potato prices in Kenya</Text>
      </LinearGradient>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={prices}
          keyExtractor={(item, i) => String(item.id ?? i)}
          renderItem={renderPrice}
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
          ListHeaderComponent={
            <>
              {/* Trend card */}
              {trend ? (
                <View style={s.trendCard}>
                  <View style={s.trendTop}>
                    <View>
                      <Text style={s.currentPrice}>
                        KES {trend.current_price ?? '—'}/kg
                      </Text>
                      {trend.average_price != null && (
                        <Text style={s.avgPrice}>
                          30-day avg: KES {trend.average_price}/kg
                        </Text>
                      )}
                      {trend.best_market && (
                        <Text style={s.bestMarket}>
                          Best: {trend.best_market}
                        </Text>
                      )}
                    </View>
                    <View style={s.trendBadge}>
                      <Text style={s.trendIcon}>{TREND_ICON[trendDir] ?? '➡️'}</Text>
                      <Text style={[s.trendLabel, { color: trendColor }]}>
                        {TREND_LABEL[trendDir] ?? 'Stable'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={s.noDataCard}>
                  <Text style={s.noDataIcon}>📊</Text>
                  <Text style={s.noDataText}>No price data available yet</Text>
                  <Text style={s.noDataSub}>Be the first to report a price</Text>
                </View>
              )}

              {/* Report button */}
              <TouchableOpacity
                style={s.reportBtn}
                onPress={() => setShowReport(true)}
              >
                <Text style={s.reportBtnText}>📝 Report Local Price</Text>
              </TouchableOpacity>

              <Text style={s.listTitle}>Recent Market Reports</Text>
            </>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No price reports yet.</Text>
              <Text style={s.emptySub}>Tap "Report Local Price" to add one.</Text>
            </View>
          }
        />
      )}

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSuccess={() => { setShowReport(false); load(true); }}
      />
    </SafeAreaView>
  );
}

// ── Report Modal ──────────────────────────────────────────────────────
function ReportModal({ visible, onClose, onSuccess }) {
  const [price,      setPrice]      = useState('');
  const [market,     setMarket]     = useState('');
  const [county,     setCounty]     = useState('');
  const [date,       setDate]       = useState(todayStr());
  const [saving,     setSaving]     = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [errors,     setErrors]     = useState({});

  const reset = () => {
    setPrice(''); setMarket(''); setCounty(''); setDate(todayStr());
    setErrors({}); setSaving(false); setSuccess(false);
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!price.trim())  errs.price  = 'Price is required';
    if (!market.trim()) errs.market = 'Market name is required';
    if (!county.trim()) errs.county = 'County is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await marketService.reportPrice({
        price_per_kg: parseFloat(price),
        market_name:  market.trim(),
        county:       county.trim(),
        reported_at:  date,
        source:       'farmer_report',
      });
      setSuccess(true);
      setTimeout(() => { reset(); onSuccess(); }, 1800);
    } catch (_) {
      setErrors({ api: 'Failed to submit. Please try again.' });
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={m.sheet}>
        <View style={m.handle} />
        <Text style={m.title}>Report Local Price</Text>

        {success ? (
          <View style={m.successBox}>
            <Text style={m.successEmoji}>✅</Text>
            <Text style={m.successText}>Thank you! Price reported successfully</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Price */}
            <Text style={m.label}>Price per kg (KES) *</Text>
            <View style={m.priceRow}>
              <View style={m.kes}><Text style={m.kesText}>KES</Text></View>
              <TextInput
                style={[m.priceInput, !!errors.price && m.inputError]}
                value={price}
                onChangeText={(t) => { setPrice(t); setErrors((e) => ({...e, price: ''})); }}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>
            {!!errors.price && <Text style={m.errText}>{errors.price}</Text>}

            <MInput
              label="Market Name *"
              value={market}
              onChangeText={(t) => { setMarket(t); setErrors((e) => ({...e, market: ''})); }}
              placeholder="e.g. Ol Kalou Market"
              error={errors.market}
            />
            <MInput
              label="County *"
              value={county}
              onChangeText={(t) => { setCounty(t); setErrors((e) => ({...e, county: ''})); }}
              placeholder="e.g. Nyandarua"
              autoCapitalize="words"
              error={errors.county}
            />
            <MInput
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
            />

            {!!errors.api && <Text style={m.apiErr}>{errors.api}</Text>}

            <TouchableOpacity
              style={[m.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={m.submitText}>Submit Report</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function MInput({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, error }) {
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
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
      {!!error && <Text style={m.errText}>{error}</Text>}
    </View>
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
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:        { padding: 16, paddingBottom: 32 },

  trendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderLeftWidth: 5,
    borderLeftColor: Colors.primary,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  trendTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  currentPrice: { fontSize: 40, fontWeight: '800', color: Colors.primaryDark },
  avgPrice:     { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  bestMarket:   { fontSize: 13, color: Colors.primary, fontWeight: '700', marginTop: 4 },
  trendBadge:   { alignItems: 'center' },
  trendIcon:    { fontSize: 36 },
  trendLabel:   { fontSize: 14, fontWeight: '700', marginTop: 4 },

  noDataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  noDataIcon: { fontSize: 44, marginBottom: 12 },
  noDataText: { fontSize: 17, fontWeight: '700', color: Colors.text },
  noDataSub:  { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },

  reportBtn: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: Colors.surfaceTinted,
  },
  reportBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },

  listTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12, letterSpacing: 0.1 },

  empty:     { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  emptySub:  { fontSize: 13, color: Colors.textLight, marginTop: 4 },
});

const c = StyleSheet.create({
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rowLeft:    { flex: 1, gap: 5 },
  rowRight:   { alignItems: 'flex-end', gap: 5 },
  marketName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  county:     { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  srcBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  srcText:    { fontSize: 10, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },
  price:      { fontSize: 17, fontWeight: '800', color: Colors.primary },
  date:       { fontSize: 11, color: Colors.textLight, fontWeight: '500' },
});

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20 },

  priceRow:   { flexDirection: 'row', marginBottom: 4 },
  kes:        { backgroundColor: Colors.background, justifyContent: 'center', paddingHorizontal: 14, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', borderRightWidth: 0 },
  kesText:    { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  priceInput: { flex: 1, height: 52, borderWidth: 1.5, borderColor: '#D1D5DB', borderTopRightRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 14, fontSize: 20, fontWeight: '700', color: Colors.text },

  inputWrap: { marginBottom: 14 },
  label:     { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    height: 48, borderWidth: 1.5, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 14,
    fontSize: 15, color: Colors.text,
  },
  inputError: { borderColor: Colors.error },
  errText:    { fontSize: 12, color: Colors.error, marginTop: 4 },
  apiErr:     { fontSize: 13, color: Colors.error, textAlign: 'center', marginBottom: 12 },

  successBox:   { alignItems: 'center', paddingVertical: 40 },
  successEmoji: { fontSize: 56, marginBottom: 12 },
  successText:  { fontSize: 16, fontWeight: '600', color: Colors.success, textAlign: 'center' },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 10,
  },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cancelBtn:  { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 15, color: Colors.textSecondary },
});
