import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { API_BASE_URL } from '../utils/config';
import { getLocationSession } from './locationSession';

export const DRIVER_BACKGROUND_LOCATION_TASK = 'bal-driver-background-location';
const BACKGROUND_LOCATION_DISCLOSURE_KEY = 'backgroundLocationDisclosureAccepted';
const ACTIVE_BACKGROUND_BOOKING_ID_KEY = 'activeBackgroundLocationBookingId';
const PENDING_KEY = 'driverPendingLocationV2';
const STATUS_KEY = 'driverTrackingStatusV2';
export type TrackingSample = {
  latitude: number; longitude: number; timestamp: string;
  heading?: number; speed?: number; accuracy?: number;
  bookingId?: string; trackingOnly?: boolean;
};
export type TrackingStatus = {
  lastSentAt?: string; sample?: TrackingSample; error?: string | null;
};
const listeners = new Set<(status: TrackingStatus) => void>();
let pending: TrackingSample | null = null;
let sending: Promise<void> | null = null;
let lastRequestAt = 0;
let operation: Promise<unknown> = Promise.resolve();
let lifecycleVersion = 0;
let sampleVersion = 0;
export function subscribeTracking(listener: (status: TrackingStatus) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
async function report(status: TrackingStatus) {
  listeners.forEach(listener => listener(status));
  const previous = await readTrackingStatus();
  await AsyncStorage.setItem(STATUS_KEY, JSON.stringify({ ...previous, ...status }));
}
export async function readTrackingStatus(): Promise<TrackingStatus> {
  const raw = await AsyncStorage.getItem(STATUS_KEY);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export function locationSample(location: Location.LocationObject): TrackingSample {
  return {
    latitude: location.coords.latitude, longitude: location.coords.longitude,
    timestamp: new Date(location.timestamp).toISOString(),
    heading: location.coords.heading != null && location.coords.heading >= 0 ? location.coords.heading : undefined,
    speed: location.coords.speed != null && location.coords.speed >= 0 ? location.coords.speed : undefined,
    accuracy: location.coords.accuracy ?? undefined,
  };
}
export async function publishLocation(sample: TrackingSample): Promise<void> {
  const revision = ++sampleVersion;
  listeners.forEach(listener => listener({ sample }));
  pending = sample;
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(sample));
  if (revision !== sampleVersion) return;
  await flushPendingLocation();
}
export async function flushPendingLocation(): Promise<void> {
  if (sending) return sending;
  if (Date.now() - lastRequestAt < 4000) return;
  sending = (async () => {
    const raw = pending ? null : await AsyncStorage.getItem(PENDING_KEY);
    let sample = pending;
    if (!sample && raw) { try { sample = JSON.parse(raw); } catch { return; } }
    if (!sample) return;
    if (sample.trackingOnly && await AsyncStorage.getItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY) !== sample.bookingId) {
      pending = null; await AsyncStorage.removeItem(PENDING_KEY); return;
    }
    let session = await getLocationSession();
    if (!session) { await report({ error: 'Sign in again to share location.' }); return; }
    lastRequestAt = Date.now();
    const send = (token: string) => axios.post<{trackingActive?: boolean}>(API_BASE_URL + '/driver/location', sample,
      { headers: { Authorization: 'Bearer ' + token }, timeout: 15000 });
    let response;
    try { response = await send(session.accessToken); }
    catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
      session = await getLocationSession(session.accessToken);
      if (!session) throw new Error('Sign in again to share location.');
      response = await send(session.accessToken);
    }
    if (response.data.trackingActive === false && sample.trackingOnly) {
      if (await AsyncStorage.getItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY) === sample.bookingId) {
        await configureBackgroundTracking(null);
      }
    } else {
      await report({ lastSentAt: sample.timestamp, sample, error: null });
    }
    // A newer fix may have arrived while this HTTP request was in flight.
    if (!pending || pending.timestamp === sample.timestamp) {
      pending = null; await AsyncStorage.removeItem(PENDING_KEY);
    }
  })().catch(async error => {
    await report({ error: 'Location upload failed. Retrying when connected.' });
    console.warn('[Tracking] upload failed', axios.isAxiosError(error) ? error.response?.status ?? error.code : String(error));
  }).finally(() => { sending = null; });
  return sending;
}

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


export async function ensureBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || AppState.currentState !== 'active') return false;
  if (!await TaskManager.isAvailableAsync()) return false;
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status === 'granted') return true;
  if (background.canAskAgain === false) {
    Alert.alert('Enable background location', 'Allow location access all the time in Settings to track active rides with the screen locked.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Open settings', onPress: () => { void Linking.openSettings(); } }]);
    return false;
  }
  if (!await confirmBackgroundLocationDisclosure()) return false;
  return (await Location.requestBackgroundPermissionsAsync()).status === 'granted';
}

// Serialize native start/stop, but invalidate a pending permission dialog immediately.
export function configureBackgroundTracking(bookingId: string | null, requestPermission = false): Promise<boolean> {
  const revision = ++lifecycleVersion;
  const run = async () => {
    if (revision !== lifecycleVersion) return false;
    if (!bookingId) {
      await AsyncStorage.removeItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY);
      pending = null;
      await AsyncStorage.removeItem(PENDING_KEY);
      await AsyncStorage.removeItem(STATUS_KEY);
      lastRequestAt = 0;
      if (await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
      }
      return false;
    }
    const granted = requestPermission ? await ensureBackgroundLocationPermission()
      : (await Location.getBackgroundPermissionsAsync()).status === 'granted';
    if (revision !== lifecycleVersion) return false;
    if (!granted) return false;
    await AsyncStorage.setItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY, bookingId);
    if (!await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK)) {
      // Start while visible; the OS owns delivery when JS screens are suspended.
      if (AppState.currentState !== 'active') return false;
      await Location.startLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, distanceInterval: 0,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'BAL Driver live tracking',
          notificationBody: 'Sharing location for your active ride.',
          notificationColor: '#151e2d', killServiceOnDestroy: false,
        },
      });
    }
    return true;
  };
  const result = operation.catch(() => {}).then(run);
  operation = result;
  return result;
}

TaskManager.defineTask(DRIVER_BACKGROUND_LOCATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{locations?: Location.LocationObject[]}>) => {
    if (error) { await report({ error: error.message }); return; }
    const bookingId = await AsyncStorage.getItem(ACTIVE_BACKGROUND_BOOKING_ID_KEY);
    if (!bookingId) { await configureBackgroundTracking(null); return; }
    const latest = data?.locations?.slice(-1)[0];
    if (!latest) return;
    await publishLocation({ ...locationSample(latest), bookingId, trackingOnly: true });
  });
