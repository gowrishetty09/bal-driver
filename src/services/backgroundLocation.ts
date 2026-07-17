import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { Alert, Platform } from 'react-native';

import { API_BASE_URL } from '../utils/config';
import { SESSION_KEY } from '../context/AuthContext';
import { deriveSessionTokens, isTokenExpired, SessionTokens, TokenResponse } from '../types/auth';

export const DRIVER_BACKGROUND_LOCATION_TASK = 'bal-driver-background-location';

const BACKGROUND_LOCATION_INTERVAL_MS = 5_000;
const BACKGROUND_LOCATION_DISTANCE_M = 10;
const BACKGROUND_LOCATION_DISCLOSURE_KEY = 'backgroundLocationDisclosureAccepted';
const ACTIVE_BACKGROUND_BOOKING_ID_KEY = 'activeBackgroundLocationBookingId';

const readStoredSession = async (): Promise<SessionTokens | null> => {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionTokens;
  } catch {
    return null;
  }
};

const writeStoredSession = async (tokens: SessionTokens) => {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(tokens));
};

const getUsableAccessToken = async (): Promise<string | null> => {
  const tokens = await readStoredSession();
  if (!tokens?.accessToken) return null;

  if (!isTokenExpired(tokens.accessTokenExpiresAt)) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken || isTokenExpired(tokens.refreshTokenExpiresAt)) {
    return null;
  }

  try {
    const { data } = await axios.post<TokenResponse>(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: tokens.refreshToken,
    });
    const nextTokens = deriveSessionTokens(data);
    await writeStoredSession(nextTokens);
    return nextTokens.accessToken;
  } catch {
    return null;
  }
};

const sendBackgroundLocation = async (location: Location.LocationObject) => {
  const token = await getUsableAccessToken();
  if (!token) return;

  const bookingId = await AsyncStorage.getItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY);

  await axios.post(
    `${API_BASE_URL}/driver/location`,
    {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      ...(bookingId ? { bookingId } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
    },
  );
};

export const setBackgroundLocationBookingId = async (bookingId: string | null): Promise<void> => {
  if (bookingId) {
    await AsyncStorage.setItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY, bookingId);
    return;
  }

  await AsyncStorage.removeItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY);
};

const confirmBackgroundLocationDisclosure = async (): Promise<boolean> => {
  const accepted = await AsyncStorage.getItem(BACKGROUND_LOCATION_DISCLOSURE_KEY);
  if (accepted === 'true') return true;

  return new Promise((resolve) => {
    Alert.alert(
      'Background location for active rides',
      'BAL Driver collects and shares your location during active rides, including when the app is in the background or Google Maps is open. This lets dispatch, hotel users, and admins track the assigned car until the ride is completed or cancelled.',
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Continue',
          onPress: () => {
            AsyncStorage.setItem(BACKGROUND_LOCATION_DISCLOSURE_KEY, 'true')
              .then(() => resolve(true))
              .catch(() => resolve(true));
          },
        },
      ],
    );
  });
};

TaskManager.defineTask(
  DRIVER_BACKGROUND_LOCATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations?: Location.LocationObject[] }>) => {
    if (error) {
      console.log('[BackgroundLocation] task error:', error.message);
      return;
    }

    const locations = data?.locations;
    const latest = Array.isArray(locations) ? locations[locations.length - 1] : null;
    if (!latest) return;

    try {
      await sendBackgroundLocation(latest);
    } catch (sendError) {
      console.log('[BackgroundLocation] send failed:', sendError);
    }
  },
);

export const ensureBackgroundLocationPermission = async (): Promise<boolean> => {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    const requestedForeground = await Location.requestForegroundPermissionsAsync();
    if (requestedForeground.status !== Location.PermissionStatus.GRANTED) {
      return false;
    }
  }

  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status === Location.PermissionStatus.GRANTED) {
    return true;
  }

  if (Platform.OS !== 'web') {
    const consented = await confirmBackgroundLocationDisclosure();
    if (!consented) return false;
  }

  const requestedBackground = await Location.requestBackgroundPermissionsAsync();
  return requestedBackground.status === Location.PermissionStatus.GRANTED;
};

export const startBackgroundLocationTracking = async (): Promise<boolean> => {
  const hasPermission = await ensureBackgroundLocationPermission();
  if (!hasPermission) return false;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) return true;

  await Location.startLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: BACKGROUND_LOCATION_INTERVAL_MS,
    distanceInterval: BACKGROUND_LOCATION_DISTANCE_M,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'BAL Driver live tracking',
      notificationBody: 'Sharing your location during the active ride.',
      notificationColor: '#151e2d',
    },
  });

  return true;
};

export const stopBackgroundLocationTracking = async (): Promise<void> => {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  }
};
