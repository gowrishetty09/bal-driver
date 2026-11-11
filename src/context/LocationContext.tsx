import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiClient } from '../api/client';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { socketService } from '../services/socketService';
import { getDriverJobs } from '../api/driver';
import { useAuth } from '../hooks/useAuth';
import { subscribeJobRefresh } from '../utils/events';
import {
  configureBackgroundTracking, flushPendingLocation, locationSample, publishLocation, READY_FOR_RIDES_TRACKING, ensureBackgroundLocationPermission,
  readTrackingStatus, requestForegroundLocationPermissionWithDisclosure, subscribeTracking, supportsBackgroundLocation,
} from '../services/backgroundLocation';

export type LocationPermissionState = Location.PermissionStatus | 'undetermined';
export type LocationContextValue = {
  outsideDriver: boolean | null;
  readyForRides: boolean;
  readinessBusy: boolean;
  readinessError: string | null;
  setRideReadiness: (ready: boolean) => Promise<void>;
  permissionStatus: LocationPermissionState;
  isSharingLocation: boolean;
  backgroundTrackingActive: boolean;
  trackingError: string | null;
  lastSentAt: string | null;
  lastKnownCoordinates: {latitude: number; longitude: number} | null;
  requestPermission: () => Promise<void>;
  isHighFrequencyMode: boolean;
  backgroundTrackingStarting: boolean;
  refreshLocation: () => Promise<{latitude: number; longitude: number} | null>;
};
export const LocationContext = createContext<LocationContextValue | null>(null);
const ACTIVE = ['PICKED_UP', 'ARRIVED', 'EN_ROUTE'];

export const LocationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isInitializing, user, token } = useAuth();
  const [outsideDriver, setOutsideDriver] = useState<boolean | null>(null);
  const [readyForRides, setReadyForRides] = useState(false);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const readinessLock = useRef(false);
  const readinessRevision = useRef(0);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated) { setOutsideDriver(null); setReadyForRides(false); return; }
    let alive = true;
    const refresh = async () => {
      if (AppState.currentState !== 'active' || readinessLock.current) return;
      const revision = readinessRevision.current;
      try {
        const { data } = await apiClient.get('/driver/ride-readiness');
        if (alive && !readinessLock.current && revision === readinessRevision.current) { setOutsideDriver(data.outsideDriver); setReadyForRides(data.ready); setReadinessError(null); }
      } catch { if (alive) setReadinessError('Ride availability could not be loaded. Check your connection and try again.'); }
    };
    void refresh(); const timer = setInterval(refresh, 15000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { alive = false; clearInterval(timer); listener.remove(); };
  }, [isAuthenticated, user?.id]);
  const setRideReadiness = useCallback(async (ready: boolean) => {
    if (readinessLock.current) return;
    readinessLock.current = true; readinessRevision.current++; setReadinessBusy(true); setReadinessError(null);
    try {
      if (ready) {
        if (!supportsBackgroundLocation) throw new Error('Install the driver development or TestFlight build to go ready for rides. Expo Go tracking is disabled.');
        const permission = await requestForegroundLocationPermissionWithDisclosure();
        setPermissionStatus(permission.status);
        if (permission.status !== 'granted') throw new Error('Allow location access to receive nearby rides.');
        if (!await ensureBackgroundLocationPermission()) throw new Error('Allow background location to stay ready when the screen is locked.');
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (Date.now() - position.timestamp > 120000 || (position.coords.accuracy ?? Infinity) > 200) throw new Error('Waiting for an accurate GPS position. Move outdoors and try again.');
        await apiClient.post('/driver/location', locationSample(position));
      }
      const { data } = await apiClient.patch('/driver/ride-readiness', { ready });
      setReadyForRides(data.ready); setOutsideDriver(data.outsideDriver);
    } catch (error: any) {
      const message = error?.response?.data?.message ?? error?.message ?? 'Unable to update ride availability.';
      setReadinessError(typeof message === 'string' ? message : 'Unable to update ride availability.');
    } finally { readinessLock.current = false; setReadinessBusy(false); }
  }, []);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionState>('undetermined');
  const [appState, setAppState] = useState(AppState.currentState);
  // Undefined means the server has not reconciled the active ride yet.
  const [activeBookingId, setActiveBookingId] = useState<string | null | undefined>();
  const [backgroundTrackingActive, setBackgroundTrackingActive] = useState(false);
  const backgroundRef = useRef(false);
  const [backgroundTrackingStarting, setBackgroundTrackingStarting] = useState(false);
  const [permissionRetry, setPermissionRetry] = useState(0);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [lastAcknowledgedAt, setLastAcknowledgedAt] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastKnownCoordinates, setLastKnownCoordinates] = useState<{latitude:number;longitude:number} | null>(null);
  const latestFixTime = useRef(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (isAuthenticated && user?.id && token) {
      void socketService.connect({ driverId: user.id, token }).catch(console.warn);
    } else socketService.disconnect();
    return () => socketService.disconnect();
  }, [isAuthenticated, user?.id, token]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', setAppState);
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => { listener.remove(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const apply = (status: Awaited<ReturnType<typeof readTrackingStatus>>) => {
      if (cancelled) return;
      if (status.lastAcknowledgedAt) setLastAcknowledgedAt(previous => !previous || Date.parse(status.lastAcknowledgedAt!) > Date.parse(previous) ? status.lastAcknowledgedAt! : previous);
      if (status.sample && Date.parse(status.sample.timestamp) >= latestFixTime.current) {
        latestFixTime.current = Date.parse(status.sample.timestamp);
        setLastKnownCoordinates({latitude:status.sample.latitude,longitude:status.sample.longitude});
      }
      if (status.lastSentAt) setLastSentAt(previous => !previous || Date.parse(status.lastSentAt!) > Date.parse(previous) ? status.lastSentAt! : previous);
      if (status.error !== undefined) setTrackingError(status.error);
      setNow(Date.now());
    };
    const unsubscribe = subscribeTracking(apply);
    void readTrackingStatus().then(apply).catch(console.warn);
    // Headless tasks can run in a separate JS runtime, so their in-memory
    // listeners cannot update this provider. Read their persisted receipt too.
    const timer = appState === 'active' ? setInterval(() => {
      void readTrackingStatus().then(apply).catch(console.warn);
    }, 5000) : undefined;
    return () => { cancelled = true; unsubscribe(); if (timer) clearInterval(timer); };
  }, [appState, isAuthenticated]);

  useEffect(() => {
    if (appState !== 'active') return;
    void Location.getForegroundPermissionsAsync().then(p => setPermissionStatus(p.status)).catch(console.warn);
  }, [appState]);

  // Ride lifecycle belongs to the provider, never to a details screen.
  useEffect(() => {
    if (isInitializing) return;
    if (!isAuthenticated) { latestFixTime.current = 0; setActiveBookingId(null); setLastSentAt(null); setLastAcknowledgedAt(null); setLastKnownCoordinates(null); return; }
    let cancelled = false;
    let inFlight = false;
    const sync = async () => {
      if (inFlight || AppState.currentState !== 'active') return;
      inFlight = true;
      try {
        const jobs = await getDriverJobs('ACTIVE');
        const active = jobs.filter(job => ACTIVE.includes(job.status))
          .sort((a,b) => ACTIVE.indexOf(a.status)-ACTIVE.indexOf(b.status));
        if (!cancelled) setActiveBookingId(active[0]?.id ?? null);
      } catch (error) {
        // A network failure is not evidence that the ride ended.
        console.warn('[Tracking] Cannot reconcile active ride', error);
      } finally { inFlight = false; }
    };
    void sync();
    const timer = setInterval(() => { void sync(); }, 30000);
    const subscription = subscribeJobRefresh(() => { void sync(); });
    const events = ['BOOKING_STATUS_UPDATED','BOOKING_ASSIGNED','RIDE_STARTED','connect'];
    events.forEach(event => socketService.on(event, sync));
    return () => { cancelled = true; clearInterval(timer); subscription.remove(); events.forEach(event => socketService.off(event,sync)); };
  }, [isAuthenticated, isInitializing, user?.id, appState]);

  useEffect(() => {
    if (isInitializing || activeBookingId === undefined) return;
    let cancelled = false;
    socketService.setCurrentBookingId(activeBookingId);
    const trackingTarget = activeBookingId ?? (readyForRides ? READY_FOR_RIDES_TRACKING : null);
    const configure = async (askPermission = true) => {
      if (cancelled) return;
      if (askPermission) setBackgroundTrackingStarting(supportsBackgroundLocation && Boolean(trackingTarget) && !backgroundRef.current);
      try {
        const active = await configureBackgroundTracking(isAuthenticated ? trackingTarget : null,
          askPermission && Boolean(trackingTarget) && appState === 'active');
        if (cancelled) return;
        backgroundRef.current = active;
        setBackgroundTrackingActive(active);
        if (supportsBackgroundLocation && activeBookingId && !active) setTrackingError('Background tracking is not enabled. Allow location all the time in Settings.');
        else setTrackingError(previous => previous?.startsWith('Background tracking') || previous?.startsWith('Allow location') ? null : previous);
        const foreground = await Location.getForegroundPermissionsAsync();
        if (!cancelled) setPermissionStatus(foreground.status);
      } catch (error) {
        if (!cancelled) { backgroundRef.current = false; setBackgroundTrackingActive(false); setTrackingError('Background tracking could not start. Enable location permissions and use an installed app build.'); }
        console.warn('[Tracking] start failed', error);
      } finally {
        if (!cancelled) setBackgroundTrackingStarting(false);
      }
    };
    // A running native task continues without restarting when the app is hidden.
    let inFlight = false;
    const reconcile = async (askPermission: boolean) => {
      if (inFlight) return;
      inFlight = true;
      try { await configure(askPermission); } finally { inFlight = false; }
    };
    if (appState === 'active' || !activeBookingId || !isAuthenticated) void reconcile(true);
    // Reconcile after Android Settings and recover from delayed native startup.
    // Passive retries never reopen a permission dialog.
    const timer = appState === 'active' && activeBookingId && isAuthenticated
      ? setInterval(() => { void reconcile(false); }, 5000) : undefined;
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [activeBookingId, readyForRides, isAuthenticated, isInitializing, appState, permissionRetry]);

  useEffect(() => {
    if (!supportsBackgroundLocation || !isAuthenticated || permissionStatus !== 'granted' || appState !== 'active') return;
    let cancelled = false;
    let watcher: Location.LocationSubscription | undefined;
    let lastUpload = 0;
    void Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:5000,distanceInterval:0}, position => {
      if (cancelled) return;
      if (position.timestamp >= latestFixTime.current) {
        latestFixTime.current = position.timestamp;
        setLastKnownCoordinates({latitude:position.coords.latitude,longitude:position.coords.longitude});
      }
      // The native task publishes during active rides, including in the foreground.
      if (backgroundRef.current || Date.now()-lastUpload < 5000) return;
      lastUpload = Date.now();
      void publishLocation(locationSample(position)).catch(console.warn);
    }).then(subscription => { if (cancelled) subscription.remove(); else watcher=subscription; })
      .catch(() => setTrackingError('Unable to obtain GPS location. Check device location settings.'));
    return () => { cancelled=true; watcher?.remove(); };
  }, [isAuthenticated, permissionStatus, appState]);

  useEffect(() => NetInfo.addEventListener(state => {
    if (isAuthenticated && state.isConnected && state.isInternetReachable !== false) void flushPendingLocation();
  }), [isAuthenticated]);

  const requestPermission = useCallback(async () => {
    try {
      const permission = await requestForegroundLocationPermissionWithDisclosure();
      setPermissionStatus(permission.status);
      if (permission.status === 'granted') setPermissionRetry(value => value + 1);
    } catch { setTrackingError('Unable to enable location. Check app permissions in Settings.'); }
  }, [activeBookingId]);
  const refreshLocation = useCallback(async () => {
    if (permissionStatus !== 'granted') return null;
    try {
      const location=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      const coords={latitude:location.coords.latitude,longitude:location.coords.longitude};
      setLastKnownCoordinates(coords); return coords;
    } catch { return null; }
  }, [permissionStatus]);
  const isSharingLocation = supportsBackgroundLocation && isAuthenticated && !trackingError && Boolean(lastAcknowledgedAt && now-Date.parse(lastAcknowledgedAt)<30000);
  const value = useMemo(() => ({ outsideDriver, readyForRides, readinessBusy, readinessError, setRideReadiness, permissionStatus,isSharingLocation,backgroundTrackingActive,trackingError,
    lastSentAt,lastKnownCoordinates,requestPermission,isHighFrequencyMode:Boolean(activeBookingId),backgroundTrackingStarting,refreshLocation }),
    [outsideDriver,readyForRides,readinessBusy,readinessError,setRideReadiness,permissionStatus,isSharingLocation,backgroundTrackingActive,trackingError,lastSentAt,lastKnownCoordinates,requestPermission,activeBookingId,backgroundTrackingStarting,refreshLocation]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
