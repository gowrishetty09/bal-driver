import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { loginDriver, DriverUser, logoutDriver, refreshDriverSession } from '../api/driver';
import { registerAuthHandlers, setSessionTokens } from '../api/client';
import { SessionTokens, isTokenExpired } from '../types/auth';

const SESSION_KEY = 'driverAuthSession';
const USER_KEY = 'driverAuthUser';

type AuthState = {
  tokens: SessionTokens | null;
  user: DriverUser | null;
};

export type AuthContextValue = {
  user: DriverUser | null;
  tokens: SessionTokens | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updater: (prev: DriverUser | null) => DriverUser | null) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('Failed to parse cached auth payload', error);
    return null;
  }
};

const hasDriverRole = (user: DriverUser) =>
  user.role === 'DRIVER' || (Array.isArray(user.roles) && user.roles.includes('DRIVER'));

const clearStoredSession = () =>
  Promise.all([SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(USER_KEY)]);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ tokens: null, user: null });
  const [isInitializing, setIsInitializing] = useState(true);

  const performLogout = useCallback(
    async ({ skipRemote }: { skipRemote?: boolean } = {}) => {
      const refreshToken = state.tokens?.refreshToken;
      setSessionTokens(null);
      setState({ tokens: null, user: null });
      await clearStoredSession();

      if (!skipRemote && refreshToken) {
        try {
          await logoutDriver(refreshToken);
        } catch (error) {
          console.warn('Failed to revoke driver session', error);
        }
      }
    },
    [state.tokens]
  );

  const refreshSession = useCallback(async (): Promise<SessionTokens | null> => {
    const currentTokens = state.tokens;
    if (!currentTokens) {
      return null;
    }

    if (isTokenExpired(currentTokens.refreshTokenExpiresAt)) {
      await performLogout({ skipRemote: true });
      return null;
    }

    try {
      const nextTokens = await refreshDriverSession(currentTokens.refreshToken);
      setSessionTokens(nextTokens);
      setState((prev) => ({ ...prev, tokens: nextTokens }));
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextTokens));
      return nextTokens;
    } catch (error) {
      await performLogout({ skipRemote: true });
      throw error;
    }
  }, [state.tokens, performLogout]);

  useEffect(() => {
    registerAuthHandlers({
      onRefresh: refreshSession,
      onUnauthorized: () => performLogout({ skipRemote: true }),
    });
  }, [refreshSession, performLogout]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [tokensRaw, userRaw] = await Promise.all([
          SecureStore.getItemAsync(SESSION_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);

        const storedTokens = parseJson<SessionTokens>(tokensRaw);
        const storedUser = parseJson<DriverUser>(userRaw);

        if (!storedTokens || !storedUser) {
          await clearStoredSession();
          return;
        }

        if (isTokenExpired(storedTokens.refreshTokenExpiresAt)) {
          await clearStoredSession();
          return;
        }

        let activeTokens = storedTokens;

        if (isTokenExpired(storedTokens.accessTokenExpiresAt)) {
          try {
            activeTokens = await refreshDriverSession(storedTokens.refreshToken);
            await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(activeTokens));
          } catch (error) {
            console.warn('Unable to refresh expired access token during bootstrap', error);
            await clearStoredSession();
            return;
          }
        }

        setSessionTokens(activeTokens);
        setState({ tokens: activeTokens, user: storedUser });
      } catch (error) {
        console.warn('Unable to bootstrap auth session', error);
        await clearStoredSession();
      } finally {
        setIsInitializing(false);
      }
    };

    bootstrap();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { tokens, user } = await loginDriver({ email, password });

        if (!hasDriverRole(user)) {
          throw new Error('This account is not a driver user');
        }

        setSessionTokens(tokens);
        setState({ tokens, user });
        await Promise.all([
          SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(tokens)),
          SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
        ]);
      } catch (error) {
        await performLogout({ skipRemote: true });

        if (error instanceof Error && error.message === 'This account is not a driver user') {
          throw error;
        }

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 401 || status === 403) {
            throw new Error('Invalid email or password');
          }
          const backendMessage =
            (typeof error.response?.data === 'string' && error.response.data) ||
            (error.response?.data as { message?: string })?.message;
          throw new Error(backendMessage ?? 'Unable to sign in');
        }

        if (error instanceof Error) {
          throw error;
        }

        throw new Error('Unable to sign in');
      }
    },
    [performLogout]
  );

  const logout = useCallback(async () => {
    await performLogout();
  }, [performLogout]);

  const updateUserProfile = useCallback(async (updater: (prev: DriverUser | null) => DriverUser | null) => {
    let nextUser: DriverUser | null = null;
    setState((prev) => {
      nextUser = updater(prev.user);
      return { tokens: prev.tokens, user: nextUser };
    });

    if (nextUser) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      user: state.user,
      tokens: state.tokens,
      token: state.tokens?.accessToken ?? null,
      isAuthenticated: Boolean(state.tokens && state.user),
      isInitializing,
      login,
      logout,
      updateUserProfile,
    }),
    [state, isInitializing, login, logout, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
