import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import { socketService } from '../services/socketService';
import { sendLocation as sendLocationRest } from '../api/driver';
import { useAuth } from '../hooks/useAuth';

export type LocationPermissionState = Location.PermissionStatus | 'undetermined';

export type LocationContextValue = {
  permissionStatus: LocationPermissionState;
  isSharingLocation: boolean;
  lastSentAt: string | null;
  lastKnownCoordinates: { latitude: number; longitude: number } | null;
  requestPermission: () => Promise<void>;
  setHighFrequencyMode: (enabled: boolean) => void;
  isHighFrequencyMode: boolean;
  setActiveBookingId: (bookingId: string | null) => void;
};

export const LocationContext = createContext<LocationContextValue | null>(null);

const LOCATION_INTERVAL_MS = 3000; // Normal: 3 seconds
const HIGH_FREQUENCY_INTERVAL_MS = 1000; // Active ride: 1 second

export const LocationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionState>('undetermined');
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastKnownCoordinates, setLastKnownCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isHighFrequencyMode, setHighFrequencyModeState] = useState(false);
  const [activeBookingId, setActiveBookingIdState] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const highFrequencyRef = useRef(false);
  const activeBookingIdRef = useRef<string | null>(null);
  const hasRequestedPermission = useRef(false);

  // Connect/disconnect socket based on authentication
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Initialize socket asynchronously after app is ready
      socketService.connect(user.id).catch((err: any) => {
        console.log('[Location] Socket connection error:', err);
      });
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, user?.id]);

  const setActiveBookingId = useCallback((bookingId: string | null) => {
    activeBookingIdRef.current = bookingId;
    setActiveBookingIdState(bookingId);
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSharingLocation(false);
  }, []);

  const sendCurrentLocation = useCallback(async () => {
    if (permissionStatus !== 'granted' || !isAuthenticated || !user?.id) {
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: highFrequencyRef.current ? Location.Accuracy.High : Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        heading: position.coords.heading ?? undefined,
        speed: position.coords.speed ?? undefined,
      };

      setLastKnownCoordinates({ latitude: coords.latitude, longitude: coords.longitude });

      // Try WebSocket first, fall back to REST if not connected
      const sent = socketService.sendLocation({
        ...coords,
        bookingId: activeBookingIdRef.current ?? undefined,
      });

      if (!sent) {
        // Fallback to REST API if socket not connected
        await sendLocationRest({ latitude: coords.latitude, longitude: coords.longitude });
      }

      setLastSentAt(new Date().toISOString());
      setIsSharingLocation(true);
    } catch (error) {
      console.log('Unable to send location update', error);
    }
  }, [isAuthenticated, permissionStatus, user?.id]);

  const startInterval = useCallback((highFrequency = false) => {
    // Clear existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (permissionStatus !== 'granted' || !isAuthenticated) {
      return;
    }

    const intervalMs = highFrequency ? HIGH_FREQUENCY_INTERVAL_MS : LOCATION_INTERVAL_MS;
    console.log(`[Location] Starting location updates every ${intervalMs / 1000}s (high frequency: ${highFrequency})`);
    
    sendCurrentLocation();
    intervalRef.current = setInterval(sendCurrentLocation, intervalMs);
  }, [isAuthenticated, permissionStatus, sendCurrentLocation]);

  const setHighFrequencyMode = useCallback((enabled: boolean) => {
    console.log(`[Location] High frequency mode: ${enabled}`);
    highFrequencyRef.current = enabled;
    setHighFrequencyModeState(enabled);
    
    // Restart interval with new frequency if we're currently sharing
    if (permissionStatus === 'granted' && isAuthenticated) {
      startInterval(enabled);
    }
  }, [isAuthenticated, permissionStatus, startInterval]);

  const evaluatePermission = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status ?? 'undetermined');
    } catch (error) {
      console.log('Unable to read location permission', error);
      setPermissionStatus('undetermined');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status ?? 'undetermined');
      if (status === 'granted' && isAuthenticated) {
        startInterval();
      }
    } catch (error) {
      console.log('Location permission request failed', error);
    }
  }, [isAuthenticated, startInterval]);

  useEffect(() => {
    evaluatePermission();
  }, [evaluatePermission]);

  useEffect(() => {
    if (!isAuthenticated) {
      stopInterval();
      return;
    }

    if (permissionStatus === 'granted') {
      startInterval();
    } else if (!hasRequestedPermission.current) {
      // Request permission only once per app session when user is authenticated
      hasRequestedPermission.current = true;
      requestPermission();
    }
  }, [isAuthenticated, permissionStatus, requestPermission, startInterval, stopInterval]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isAuthenticated && permissionStatus === 'granted') {
          startInterval(highFrequencyRef.current);
        }
      }

      if (nextAppState.match(/inactive|background/)) {
        stopInterval();
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, permissionStatus, startInterval, stopInterval]);

  useEffect(
    () => () => {
      stopInterval();
    },
    [stopInterval]
  );

  const value = useMemo(
    () => ({
      permissionStatus,
      isSharingLocation,
      lastSentAt,
      lastKnownCoordinates,
      requestPermission,
      setHighFrequencyMode,
      isHighFrequencyMode,
      setActiveBookingId,
    }),
    [permissionStatus, isSharingLocation, lastSentAt, lastKnownCoordinates, requestPermission, setHighFrequencyMode, isHighFrequencyMode, setActiveBookingId]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
