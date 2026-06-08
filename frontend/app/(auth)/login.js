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
import useAuthStore from '../../src/store/authStore';
import { normalizeKEPhone } from '../../src/utils/phone';

const validate = (phone, password) => {
  const errs = {};
  const p = phone.trim();
  if (!p) {
    errs.phone = 'Phone number is required';
  } else if (!/^(\+254|0)\d{8,9}$/.test(p)) {
    errs.phone = 'Enter a valid Kenyan number (07XX… or +254…)';
  }
  if (!password) {
    errs.password = 'Password is required';
  } else if (password.length < 8) {
    errs.password = 'Password must be at least 8 characters';
  }
  return errs;
};

const parseApiError = (err) => {
  const status = err?.response?.status;
  const msg    = err?.response?.data?.error;
  if (status === 401) return 'Invalid phone number or password';
  if (status === 403) return 'Account not verified. Check your WhatsApp for OTP.';
  if (!err?.response)  return 'Connection failed. Check your internet connection.';
  return msg || 'Something went wrong. Please try again.';
};

export default function LoginScreen() {
  const router     = useRouter();
  const storeLogin = useAuthStore((s) => s.login);
  const pwRef      = useRef(null);

  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});
  const [apiErr,   setApiErr]   = useState('');

  const clearFieldErr = (field) =>
    setErrors((prev) => ({ ...prev, [field]: '' }));

  const handleSubmit = async () => {
    setApiErr('');
    const errs = validate(phone, password);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const data = await authService.login(normalizeKEPhone(phone), password);
      await storeLogin(data.access, data.refresh, data.user ?? null);
    } catch (err) {
      setApiErr(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Top safe-area in green so the status bar matches the hero */}
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
          {/* ── Hero ─────────────────────────────────────────────── */}
          <LinearGradient
            colors={['#0E3D22', '#1B6B3A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🌿</Text>
            </View>
            <Text style={styles.appName}>Smart Farmer</Text>
            <Text style={styles.tagline}>Your intelligent farming companion</Text>
          </LinearGradient>

          {/* ── Form card ────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSub}>Sign in to your farm account</Text>

            <FormInput
              label="Phone Number"
              value={phone}
              onChangeText={(t) => { setPhone(t); clearFieldErr('phone'); }}
              placeholder="+254 7XX XXX XXX"
              keyboardType="phone-pad"
              error={errors.phone}
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
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {!!apiErr && (
              <View style={styles.apiErrBox}>
                <Text style={styles.apiErrText}>⚠️  {apiErr}</Text>
              </View>
            )}

            <PrimaryButton
              title="Sign In"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitBtn}
            />

            <View style={styles.footer}>
              <Text style={styles.footerGray}>Don't have an account?  </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.footerLink}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom safe-area in white so the home indicator area is white */}
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
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoEmoji: { fontSize: 38 },
  appName:   { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  tagline:   { fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 6 },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 32,
    marginTop: -28,
  },

  welcomeTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  welcomeSub:   { fontSize: 14, color: '#6B7280', marginBottom: 28 },

  forgotRow:  { alignSelf: 'flex-end', marginTop: -6, marginBottom: 22 },
  forgotText: { fontSize: 13, color: '#1B6B3A', fontWeight: '600' },

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
