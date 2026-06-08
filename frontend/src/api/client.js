import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_TIMEOUT_MS } from '../constants/config';

// Injected by authStore after it initialises — breaks the import cycle:
//   client.js ← authStore.js ← authService.js ← client.js
let _logoutCallback = null;
export const setLogoutCallback = (fn) => {
  _logoutCallback = fn;
};

// ── Queue for requests that arrive while a token refresh is in-flight ──
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

// ── Axios instance ────────────────────────────────────────────────────
const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach Bearer token ──────────────────────────
client.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    console.log('[API] Request:', config.method?.toUpperCase(), config.url);
    console.log('[API] Token exists:', !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: silent token refresh on 401 ────────────────
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        })
        .catch((err) => Promise.reject(err));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refresh = await SecureStore.getItemAsync('refresh_token');
      if (!refresh) throw new Error('no_refresh_token');

      const { data } = await axios.post(
        `${API_BASE_URL}/api/auth/token/refresh/`,
        { refresh },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const newAccess = data.access;
      await SecureStore.setItemAsync('access_token', newAccess);

      processQueue(null, newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return client(original);
    } catch (refreshError) {
      processQueue(refreshError, null);

      await SecureStore.deleteItemAsync('access_token').catch(() => {});
      await SecureStore.deleteItemAsync('refresh_token').catch(() => {});

      if (_logoutCallback) _logoutCallback();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default client;
