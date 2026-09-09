import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../utils/config';
import { deriveSessionTokens, isTokenExpired, type SessionTokens, type TokenResponse } from '../types/auth';

export const SESSION_KEY = 'driverAuthSession';
let refreshPromise: Promise<SessionTokens | null> | null = null;
const listeners = new Set<(tokens: SessionTokens) => void>();
export const subscribeSessionRefresh = (listener: (tokens: SessionTokens) => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export async function readLocationSession(): Promise<SessionTokens | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
// Foreground and headless location requests share the same refresh operation.
// Always read storage: a previous background callback may have rotated the token.
export async function getLocationSession(rejectedToken?: string): Promise<SessionTokens | null> {
  const current = await readLocationSession();
  if (!current) return null;
  if (!isTokenExpired(current.accessTokenExpiresAt) && current.accessToken !== rejectedToken) return current;
  if (refreshPromise) return refreshPromise;
  if (!current.refreshToken || isTokenExpired(current.refreshTokenExpiresAt)) return null;
  refreshPromise = (async () => {
    const { data } = await axios.post<TokenResponse>(API_BASE_URL + '/auth/refresh',
      { refreshToken: current.refreshToken }, { timeout: 15000 });
    const next = deriveSessionTokens(data);
    // Do not restore a session that was logged out or replaced while refreshing.
    const stored = await readLocationSession();
    if (stored?.refreshToken !== current.refreshToken) return stored;
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    listeners.forEach(listener => listener(next));
    return next;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
