import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import useAuthStore from '../src/store/authStore';
import { Colors } from '../src/constants/colors';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const router = useRouter();
  const segments = useSegments();
  // useRootNavigationState lets us delay the redirect until the navigator
  // has fully mounted — prevents "navigate before navigation is ready" errors.
  const navState = useRootNavigationState();

  // Run once on mount to hydrate auth state from SecureStore
  useEffect(() => {
    initialize();
  }, []);

  // Re-evaluate routing whenever auth state or navigation readiness changes
  useEffect(() => {
    if (!navState?.key) return; // navigator not ready yet
    if (isLoading) return;      // still hydrating

    const inAuth = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, navState?.key, segments]);

  // ── Splash / loading screen ────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.splash}>
          <Text style={styles.splashLogo}>SmartFarmer</Text>
          <Text style={styles.splashTagline}>Grow smarter, harvest more</Text>
          <ActivityIndicator
            color={Colors.secondary}
            size="large"
            style={styles.splashSpinner}
          />
        </View>
      </SafeAreaProvider>
    );
  }

  // ── Main navigation tree ───────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="farm/[farmId]" />
        <Stack.Screen name="alert/[alertId]" />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textInverse,
    letterSpacing: 1,
  },
  splashTagline: {
    fontSize: 14,
    color: Colors.secondary,
    marginTop: 8,
  },
  splashSpinner: {
    marginTop: 40,
  },
});
