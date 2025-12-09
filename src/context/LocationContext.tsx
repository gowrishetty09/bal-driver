import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import { sendLocation } from '../api/driver';
import { useAuth } from '../hooks/useAuth';

export type LocationPermissionState = Location.PermissionStatus | 'undetermined';

export type LocationContextValue = {
  permissionStatus: LocationPermissionState;
  isSharingLocation: boolean;
  lastSentAt: string | null;
  lastKnownCoordinates: { latitude: number; longitude: number } | null;
  requestPermission: () => Promise<void>;
};

export const LocationContext = createContext<LocationContextValue | null>(null);

const LOCATION_INTERVAL_MS = 30000;

export const LocationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionState>('undetermined');
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastKnownCoordinates, setLastKnownCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSharingLocation(false);
  }, []);

  const sendCurrentLocation = useCallback(async () => {
    if (permissionStatus !== 'granted' || !isAuthenticated) {
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLastKnownCoordinates(coords);
      await sendLocation(coords);
      setLastSentAt(new Date().toISOString());
      setIsSharingLocation(true);
    } catch (error) {
      console.log('Unable to send location update', error);
    }
  }, [isAuthenticated, permissionStatus]);

  const startInterval = useCallback(() => {
    if (intervalRef.current || permissionStatus !== 'granted' || !isAuthenticated) {
      return;
    }

    sendCurrentLocation();
    intervalRef.current = setInterval(sendCurrentLocation, LOCATION_INTERVAL_MS);
  }, [isAuthenticated, permissionStatus, sendCurrentLocation]);

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
    } else if (permissionStatus === 'undetermined') {
      requestPermission();
    } else {
      stopInterval();
    }
  }, [isAuthenticated, permissionStatus, requestPermission, startInterval, stopInterval]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isAuthenticated && permissionStatus === 'granted') {
          startInterval();
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
    }),
    [permissionStatus, isSharingLocation, lastSentAt, lastKnownCoordinates, requestPermission]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
