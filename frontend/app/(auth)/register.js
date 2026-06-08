import { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import FormInput from '../../src/components/FormInput';
import PrimaryButton from '../../src/components/PrimaryButton';
import * as authService from '../../src/api/authService';
import { normalizeKEPhone } from '../../src/utils/phone';

// ── Validation ────────────────────────────────────────────────────────
const validate = ({ fullName, phone, county, password, confirmPassword }) => {
  const errs = {};
  if (!fullName.trim() || fullName.trim().length < 2) {
    errs.fullName = 'Full name is required (min 2 characters)';
  }
  const p = phone.trim();
  if (!p) {
    errs.phone = 'Phone number is required';
  } else if (!/^(\+254|0)\d{8,9}$/.test(p)) {
    errs.phone = 'Enter a valid Kenyan number starting with 0 or +254';
  }
  if (!county.trim()) {
    errs.county = 'County is required';
  }
  if (!password || password.length < 8) {
    errs.password = 'Password must be at least 8 characters';
  }
  if (password !== confirmPassword) {
    errs.confirmPassword = 'Passwords do not match';
  }
  return errs;
};

// ── API error → plain English ─────────────────────────────────────────
const parseApiError = (err) => {
  const status = err?.response?.status;
  const data   = err?.response?.data;
  if (status === 400) {
    if (data?.error?.toLowerCase().includes('already registered')) {
      return 'This phone number is already registered';
    }
    if (data?.phone_number) return data.phone_number[0];
    if (data?.error)        return data.error;
  }
  if (!err?.response) return 'Connection failed. Check your internet connection.';
  return data?.error || data?.detail || 'Something went wrong. Please try again.';
};

// ─────────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();

  // Refs for focus chain
  const phoneRef  = useRef(null);
  const countyRef = useRef(null);
  const pwRef     = useRef(null);
  const cpwRef    = useRef(null);

  const [fullName,        setFullName]        = useState('');
  const [phone,           setPhone]           = useState('');
  const [county,          setCounty]          = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw,          setShowPw]          = useState(false);
  const [showCpw,         setShowCpw]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [errors,          setErrors]          = useState({});
  const [apiErr,          setApiErr]          = useState('');

  const clearFieldErr = (field) =>
    setErrors((prev) => ({ ...prev, [field]: '' }));

  const handleSubmit = async () => {
    setApiErr('');
    const errs = validate({ fullName, phone, county, password, confirmPassword });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const normalized = normalizeKEPhone(phone);
      const response = await authService.register(normalized, fullName.trim(), password, county.trim());
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { phone: normalized, debug_otp: response?.debug_otp ?? '' },
      });
    } catch (err) {
      setApiErr(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Hero ───────────────────────────────────────────── */}
          <LinearGradient
            colors={['#0E3D22', '#1B6B3A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.heroEmoji}>🌱</Text>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSub}>Join Smart Farmer today</Text>
          </LinearGradient>

          {/* ── Form card ──────────────────────────────────────── */}
          <View style={styles.card}>
            <FormInput
              label="Full Name"
              value={fullName}
              onChangeText={(t) => { setFullName(t); clearFieldErr('fullName'); }}
              placeholder="e.g. John Kamau"
              autoCapitalize="words"
              error={errors.fullName}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            <FormInput
              inputRef={phoneRef}
              label="Phone Number"
              value={phone}
              onChangeText={(t) => { setPhone(t); clearFieldErr('phone'); }}
              placeholder="+254 7XX XXX XXX"
              keyboardType="phone-pad"
              error={errors.phone}
              returnKeyType="next"
              onSubmitEditing={() => countyRef.current?.focus()}
            />
            <FormInput
              inputRef={countyRef}
              label="County"
              value={county}
              onChangeText={(t) => { setCounty(t); clearFieldErr('county'); }}
              placeholder="e.g. Nyandarua"
              autoCapitalize="words"
              error={errors.county}
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
            />
            <FormInput
              inputRef={pwRef}
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); clearFieldErr('password'); }}
              placeholder="Min. 8 characters"
              secureTextEntry={!showPw}
              showToggle
              onToggle={() => setShowPw((v) => !v)}
              error={errors.password}
              returnKeyType="next"
              onSubmitEditing={() => cpwRef.current?.focus()}
            />
            <FormInput
              inputRef={cpwRef}
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); clearFieldErr('confirmPassword'); }}
              placeholder="Re-enter your password"
              secureTextEntry={!showCpw}
              showToggle
              onToggle={() => setShowCpw((v) => !v)}
              error={errors.confirmPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {!!apiErr && (
              <View style={styles.apiErrBox}>
                <Text style={styles.apiErrText}>⚠️  {apiErr}</Text>
              </View>
            )}

            <PrimaryButton
              title="Create Account"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitBtn}
            />

            <View style={styles.footer}>
              <Text style={styles.footerGray}>Already have an account?  </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.safeBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  safeTop:    { backgroundColor: '#0E3D22' },
  safeBottom: { backgroundColor: '#FFFFFF' },
  flex:       { flex: 1 },
  scroll:     { flexGrow: 1 },

  hero: {
    paddingTop: 16,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  backBtn:  { marginBottom: 16, alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  heroEmoji: { fontSize: 32, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  heroSub:   { fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 4 },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 36,
    marginTop: -28,
  },

  apiErrBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  apiErrText: { color: '#B91C1C', fontSize: 13, lineHeight: 19 },

  submitBtn: { marginBottom: 24 },

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerGray: { fontSize: 14, color: '#6B7280' },
  footerLink: { fontSize: 14, color: '#1B6B3A', fontWeight: '700' },
});
