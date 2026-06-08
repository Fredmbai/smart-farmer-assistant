import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import useAuthStore from '../../src/store/authStore';
import useFarmStore from '../../src/store/farmStore';
import * as authService   from '../../src/api/authService';
import * as farmService   from '../../src/api/farmService';
import * as engineService from '../../src/api/engineService';
import { Colors }         from '../../src/constants/colors';
import { API_BASE_URL }   from '../../src/constants/config';

const APP_VERSION = '1.0.0';

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ─────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const user   = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { activeFarm, activePlot } = useFarmStore();

  const [farmCount,  setFarmCount]  = useState(0);
  const [plotCount,  setPlotCount]  = useState(0);
  const [showEdit,   setShowEdit]   = useState(false);
  const [apiStatus,  setApiStatus]  = useState('unknown'); // 'connected' | 'disconnected' | 'checking'
  const [syncing,    setSyncing]    = useState(false);
  const [syncOk,     setSyncOk]     = useState(false);
  const [showAbout,  setShowAbout]  = useState(false);

  // Load farm/plot counts once
  useEffect(() => {
    farmService.getFarms()
      .then((farms) => {
        setFarmCount(farms.length);
        const plotFetches = farms.map((f) => farmService.getPlots(f.id).catch(() => []));
        return Promise.all(plotFetches);
      })
      .then((plotLists) => {
        setPlotCount(plotLists.reduce((acc, pl) => acc + pl.length, 0));
      })
      .catch(() => {});
  }, []);

  // Test API connection
  const checkConnection = useCallback(async () => {
    setApiStatus('checking');
    try {
      await engineService.getAlerts();
      setApiStatus('connected');
    } catch (_) {
      setApiStatus('disconnected');
    }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncOk(false);
    try {
      await Promise.all([
        farmService.getFarms().catch(() => {}),
        engineService.getAlerts().catch(() => {}),
      ]);
      setSyncOk(true);
      setTimeout(() => setSyncOk(false), 3000);
    } catch (_) {}
    setSyncing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  const avatarLetters = initials(user?.full_name);
  const statusColor   = apiStatus === 'connected' ? Colors.success
    : apiStatus === 'disconnected' ? Colors.error : Colors.textSecondary;
  const statusLabel   = apiStatus === 'connected' ? '✅ Connected'
    : apiStatus === 'disconnected' ? '❌ Disconnected' : '⏳ Checking...';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Profile Header ──────────────────────────────────── */}
        <LinearGradient
          colors={['#0E3D22', '#1B6B3A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.profileHeader}
        >
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{avatarLetters}</Text>
          </View>
          <Text style={s.fullName}>{user?.full_name ?? '—'}</Text>
          <Text style={s.phone}>{user?.phone_number ?? '—'}</Text>
          {!!user?.county && (
            <Text style={s.county}>📍 {user.county} County</Text>
          )}
        </LinearGradient>

        {/* ── Farm summary ────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <View style={s.summaryItem}>
            <Text style={s.summaryNum}>{farmCount}</Text>
            <Text style={s.summaryLabel}>🏡 Farm{farmCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryNum}>{plotCount}</Text>
            <Text style={s.summaryLabel}>🌱 Active Plot{plotCount !== 1 ? 's' : ''}</Text>
          </View>
          {activeFarm && (
            <>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryNum} numberOfLines={1}>{activeFarm.name}</Text>
                <Text style={s.summaryLabel}>Active Farm</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Settings: Account ───────────────────────────────── */}
        <Text style={s.sectionLabel}>Account</Text>
        <View style={s.settingsCard}>
          <SettingsRow icon="✏️" label="Edit Profile" onPress={() => setShowEdit(true)} />
          <View style={s.rowDivider} />
          <SettingsRow icon="🔔" label="Notification Settings" onPress={() => {}} />
        </View>

        {/* ── Settings: App ───────────────────────────────────── */}
        <Text style={s.sectionLabel}>App</Text>
        <View style={s.settingsCard}>
          <View style={s.settingsRow}>
            <Text style={s.rowIcon}>📱</Text>
            <Text style={s.rowLabel}>App Version</Text>
            <Text style={s.rowValue}>{APP_VERSION}</Text>
          </View>
          <View style={s.rowDivider} />
          <TouchableOpacity style={s.settingsRow} onPress={checkConnection} activeOpacity={0.7}>
            <Text style={s.rowIcon}>🌐</Text>
            <View style={s.rowMiddle}>
              <Text style={s.rowLabel}>API Connection</Text>
              <Text style={s.rowSub} numberOfLines={1}>{API_BASE_URL}</Text>
            </View>
            <Text style={[s.rowValue, { color: statusColor }]}>{statusLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Settings: Data ──────────────────────────────────── */}
        <Text style={s.sectionLabel}>Data</Text>
        <View style={s.settingsCard}>
          <TouchableOpacity
            style={s.settingsRow}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.7}
          >
            <Text style={s.rowIcon}>🔄</Text>
            <Text style={s.rowLabel}>Sync Now</Text>
            {syncing
              ? <ActivityIndicator color={Colors.primary} size="small" />
              : syncOk
                ? <Text style={[s.rowValue, { color: Colors.success }]}>✅ Synced</Text>
                : <Text style={s.rowArrow}>›</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Settings: About ─────────────────────────────────── */}
        <Text style={s.sectionLabel}>About</Text>
        <View style={s.settingsCard}>
          <SettingsRow icon="ℹ️" label="About Smart Farmer" onPress={() => setShowAbout(true)} />
        </View>

        {/* ── Logout ──────────────────────────────────────────── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>🚪 Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEdit}
        user={user}
        onClose={() => setShowEdit(false)}
        onSaved={(updated) => { updateUser(updated); setShowEdit(false); }}
      />

      {/* About Modal */}
      <Modal visible={showAbout} transparent animationType="fade" onRequestClose={() => setShowAbout(false)}>
        <TouchableOpacity style={ab.backdrop} activeOpacity={1} onPress={() => setShowAbout(false)} />
        <View style={ab.box}>
          <Text style={ab.title}>Smart Farmer</Text>
          <Text style={ab.version}>Version {APP_VERSION}</Text>
          <View style={ab.divider} />
          <Text style={ab.desc}>
            An AI-powered farm monitoring app built for Kenyan potato farmers.
            Monitor soil, weather, crop health, and market prices from one place.
          </Text>
          <Text style={ab.tagline}>Built for Kenyan potato farmers 🥔</Text>
          <View style={ab.divider} />
          <Text style={ab.teamLabel}>Team</Text>
          <Text style={ab.team}>Vincent Kiprop</Text>
          <Text style={ab.team}>Fredrick Mbai</Text>
          <Text style={ab.team}>Erick Kimani</Text>
          <TouchableOpacity style={ab.closeBtn} onPress={() => setShowAbout(false)}>
            <Text style={ab.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Settings Row ──────────────────────────────────────────────────────
function SettingsRow({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.rowIcon}>{icon}</Text>
      <Text style={[s.rowLabel, { flex: 1 }]}>{label}</Text>
      <Text style={s.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────
function EditProfileModal({ visible, user, onClose, onSaved }) {
  const [name,    setName]    = useState(user?.full_name ?? '');
  const [county,  setCounty]  = useState(user?.county ?? '');
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (visible) {
      setName(user?.full_name ?? '');
      setCounty(user?.county ?? '');
      setSuccess(false);
      setError('');
    }
  }, [visible, user]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await authService.updateProfile({
        full_name: name.trim(),
        county: county.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => { onSaved(updated); }, 1200);
    } catch (_) {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={em.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={em.sheet}>
        <View style={em.handle} />
        <Text style={em.title}>Edit Profile</Text>

        {success ? (
          <View style={em.successBox}>
            <Text style={em.successEmoji}>✅</Text>
            <Text style={em.successText}>Profile updated</Text>
          </View>
        ) : (
          <>
            <View style={em.inputWrap}>
              <Text style={em.label}>Full Name</Text>
              <TextInput
                style={em.input}
                value={name}
                onChangeText={(t) => { setName(t); setError(''); }}
                placeholder="Your full name"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
            <View style={em.inputWrap}>
              <Text style={em.label}>County</Text>
              <TextInput
                style={em.input}
                value={county}
                onChangeText={setCounty}
                placeholder="e.g. Nyandarua"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
            {!!error && <Text style={em.error}>{error}</Text>}
            <TouchableOpacity
              style={[em.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={em.saveText}>Save Changes</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={em.cancelBtn} onPress={onClose}>
              <Text style={em.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },

  profileHeader: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#FFFFFF' },
  fullName:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 5, letterSpacing: 0.2 },
  phone:      { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginBottom: 4, fontWeight: '500' },
  county:     { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 4,
  },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryNum:     { fontSize: 20, fontWeight: '800', color: Colors.primary, maxWidth: 90 },
  summaryLabel:   { fontSize: 12, color: Colors.textSecondary, marginTop: 3, fontWeight: '500' },
  summaryDivider: { width: 1, backgroundColor: '#F0F0F0' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 8,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  rowIcon:    { fontSize: 18, marginRight: 14, width: 24, textAlign: 'center' },
  rowLabel:   { fontSize: 15, color: Colors.text, fontWeight: '500' },
  rowMiddle:  { flex: 1 },
  rowSub:     { fontSize: 11, color: Colors.textLight, marginTop: 1 },
  rowValue:   { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  rowArrow:   { fontSize: 22, color: '#D1D5DB', fontWeight: '300' },
  rowDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 56 },

  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.error },
});

const em = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20 },

  inputWrap: { marginBottom: 14 },
  label:     { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    height: 50, borderWidth: 1.5, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 14,
    fontSize: 15, color: Colors.text,
  },
  error: { fontSize: 13, color: Colors.error, marginBottom: 12 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  saveText:   { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cancelBtn:  { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 15, color: Colors.textSecondary },

  successBox:   { alignItems: 'center', paddingVertical: 32 },
  successEmoji: { fontSize: 48, marginBottom: 12 },
  successText:  { fontSize: 17, fontWeight: '600', color: Colors.success },
});

const ab = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  box: {
    position: 'absolute',
    top: '20%',
    left: 32,
    right: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title:    { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  version:  { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  divider:  { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },
  desc:     { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, textAlign: 'center', marginBottom: 8 },
  tagline:  { fontSize: 14, color: Colors.primary, fontWeight: '600', textAlign: 'center' },
  teamLabel:{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  team:     { fontSize: 14, color: Colors.text, textAlign: 'center', marginBottom: 2 },
  closeBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  closeText:{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
