// API base URL resolution:
//   Android emulator  → http://10.0.2.2:8000  (host machine localhost alias)
//   Expo Go (device)  → set EXPO_PUBLIC_API_URL to your machine's LAN IP in .env
//   See .env.example for reference.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';

export const API_TIMEOUT_MS = 10000;
