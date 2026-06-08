import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PrimaryButton from '../../src/components/PrimaryButton';
import * as authService from '../../src/api/authService';
import useAuthStore from '../../src/store/authStore';

const RESEND_COOLDOWN = 60;

export default function VerifyOtpScreen() {
  const router      = useRouter();
  const storeLogin  = useAuthStore((s) => s.login);
  const { phone, debug_otp } = useLocalSearchParams();
  const inputRef    = useRef(null);

  const [otp,           setOtp]           = useState('');
  const [otpFocused,    setOtpFocused]    = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown,setResendCooldown]= useState(RESEND_COOLDOWN);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [debugBanner,   setDebugBanner]   = useState(false);

  // ── Countdown timer ───────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // ── Auto-fill OTP from debug_otp param (DEBUG mode only) ─────────
  useEffect(() => {
    if (debug_otp && debug_otp.length === 6) {
      setOtp(debug_otp);
      setDebugBanner(true);
    }
  }, [debug_otp]);

  // ── Auto-focus OTP field on mount ─────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // ── Verify ────────────────────────────────────────────────────────
  const verify = async (code) => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await authService.verifyOtp(phone, code);
      await storeLogin(data.access, data.refresh, data.user ?? null);
      // Root layout auth guard redirects to /(tabs)
    } catch {
      setError('Invalid or expired OTP. Please try again.');
      setOtp('');
      // Re-focus so user can type again immediately
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setError('');
    setResendSuccess(false);
    if (digits.length === 6) verify(digits); // auto-submit
  };

  // ── Resend ────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setResendSuccess(false);
    setError('');
    try {
      const data = await authService.resendOtp(phone);
      setResendCooldown(RESEND_COOLDOWN);
      setResendSuccess(true);
      if (data?.debug_otp && data.debug_otp.length === 6) {
        setOtp(data.debug_otp);
        setDebugBanner(true);
      }
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
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
            <Text style={styles.heroEmoji}>📱</Text>
            <Text style={styles.heroTitle}>Verify Your Number</Text>
            <Text style={styles.heroSub}>
              6-digit code sent to your WhatsApp
            </Text>
            <Text style={styles.phoneDisplay}>{phone}</Text>
          </LinearGradient>

          {/* ── Card ───────────────────────────────────────────── */}
          <View style={styles.card}>
          {debugBanner && (
            <View style={styles.debugBanner}>
              <Text style={styles.debugBannerText}>
                🔧 Debug mode — OTP auto-filled
              </Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Enter 6-digit code</Text>
          <View style={styles.otpWrapper}>
            <TextInput
              ref={inputRef}
              style={[
                styles.otpInput,
                otpFocused && styles.otpFocused,
                !!error    && styles.otpError,
              ]}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              returnKeyType="done"
              onFocus={() => setOtpFocused(true)}
              onBlur={() => setOtpFocused(false)}
              onSubmitEditing={() => verify(otp)}
              editable={!loading}
            />
          </View>

          {!!error && (
            <Text style={styles.errorText}>⚠️  {error}</Text>
          )}

          <PrimaryButton
            title="Verify OTP"
            onPress={() => verify(otp)}
            loading={loading}
            disabled={otp.length !== 6}
            style={styles.verifyBtn}
          />

          <View style={styles.resendSection}>
            {resendSuccess && (
              <Text style={styles.resendSuccess}>
                ✅  OTP resent to your WhatsApp
              </Text>
            )}
            {resendCooldown > 0 ? (
              <View style={styles.cooldownRow}>
                <Text style={styles.resendCooldown}>
                  Resend available in
                </Text>
                <View style={styles.cooldownBadge}>
                  <Text style={styles.cooldownNum}>{resendCooldown}s</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                <Text style={[styles.resendLink, resendLoading && styles.resendLinkDim]}>
                  {resendLoading ? 'Sending…' : "Didn't receive it? Resend OTP"}
                </Text>
              </TouchableOpacity>
            )}
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
    paddingBottom: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backBtn:  { alignSelf: 'flex-start', width: '100%', marginBottom: 16 },
  backText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  heroEmoji:    { fontSize: 44, marginBottom: 12 },
  heroTitle:    { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  heroSub:      { fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 6, textAlign: 'center' },
  phoneDisplay: { fontSize: 16, fontWeight: '700', color: '#74C69D', marginTop: 8 },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
    marginTop: -28,
  },

  debugBanner: {
    backgroundColor: '#FFF9C4',
    borderWidth: 1,
    borderColor: '#F9A825',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  debugBannerText: { fontSize: 13, color: '#7B5800', fontWeight: '600' },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },

  otpWrapper: { width: '100%', alignItems: 'center', marginBottom: 12 },
  otpInput: {
    width: 260,
    height: 76,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    fontSize: 34,
    letterSpacing: 10,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  otpFocused: {
    borderColor: '#1B6B3A',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B6B3A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  otpError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },

  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },

  verifyBtn: { width: '100%', marginBottom: 28 },

  resendSection: { alignItems: 'center', gap: 10 },
  resendSuccess: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  cooldownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resendCooldown: { fontSize: 13, color: '#9CA3AF' },
  cooldownBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cooldownNum: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  resendLink:    { fontSize: 14, color: '#1B6B3A', fontWeight: '700' },
  resendLinkDim: { opacity: 0.5 },

});
