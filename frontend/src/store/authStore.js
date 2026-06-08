import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLogoutCallback } from '../api/client';
import * as authService from '../api/authService';

const KEYS = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
  USER: 'user_data',
};

const useAuthStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // true until initialize() completes

  // ── initialize ─────────────────────────────────────────────────────
  // Called once from the root layout on app mount.
  // Reads persisted credentials and decides which stack to show.
  initialize: async () => {
    try {
      const [access, refresh, userJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.ACCESS),
        SecureStore.getItemAsync(KEYS.REFRESH),
        AsyncStorage.getItem(KEYS.USER),
      ]);

      console.log('[Auth] Stored access token:', !!access);
      console.log('[Auth] Stored refresh token:', !!refresh);

      if (access && refresh) {
        const user = userJson ? JSON.parse(userJson) : null;
        console.log('[Auth] Restored user:', user?.phone_number ?? '(no user data)');
        set({
          accessToken: access,
          refreshToken: refresh,
          user,
          isAuthenticated: true,
        });
      } else {
        console.log('[Auth] No stored credentials — showing login');
      }
    } catch (e) {
      console.log('[Auth] initialize error:', e.message);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── login ──────────────────────────────────────────────────────────
  // Called by the Login screen after a successful POST /api/auth/login/
  login: async (accessToken, refreshToken, user) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH, refreshToken),
      AsyncStorage.setItem(KEYS.USER, JSON.stringify(user)),
    ]);
    set({ accessToken, refreshToken, user, isAuthenticated: true });
  },

  // ── logout ─────────────────────────────────────────────────────────
  // Blacklists the refresh token on the server, then wipes local state.
  // Safe to call even when the server is unreachable.
  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch (_) {}

    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.REFRESH).catch(() => {}),
      AsyncStorage.removeItem(KEYS.USER).catch(() => {}),
    ]);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  // ── updateUser ─────────────────────────────────────────────────────
  // Called by the Profile screen after PATCH /api/auth/profile/
  updateUser: async (userData) => {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(userData)).catch(() => {});
    set({ user: userData });
  },
}));

// Register the logout callback with the API client so that a failed
// token refresh can trigger a full logout without importing authStore
// inside client.js (which would create a circular dependency).
setLogoutCallback(() => useAuthStore.getState().logout());

export default useAuthStore;
