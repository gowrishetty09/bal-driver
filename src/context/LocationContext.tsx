import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { socketService } from '../services/socketService';
import { getDriverJobs } from '../api/driver';
import { useAuth } from '../hooks/useAuth';
import { subscribeJobRefresh } from '../utils/events';
import {
  configureBackgroundTracking, flushPendingLocation, locationSample, publishLocation,
  readTrackingStatus, requestForegroundLocationPermissionWithDisclosure, subscribeTracking,
} from '../services/backgroundLocation';

export type LocationPermissionState = Location.PermissionStatus | 'undetermined';
export type LocationContextValue = {
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
    const configure = async (askPermission = true) => {
      if (cancelled) return;
      if (askPermission) setBackgroundTrackingStarting(Boolean(activeBookingId) && !backgroundRef.current);
      try {
        const active = await configureBackgroundTracking(isAuthenticated ? activeBookingId : null,
          askPermission && Boolean(activeBookingId) && appState === 'active');
        if (cancelled) return;
        backgroundRef.current = active;
        setBackgroundTrackingActive(active);
        if (activeBookingId && !active) setTrackingError('Background tracking is not enabled. Allow location all the time in Settings.');
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
  }, [activeBookingId, isAuthenticated, isInitializing, appState, permissionRetry]);

  useEffect(() => {
    if (!isAuthenticated || permissionStatus !== 'granted' || appState !== 'active') return;
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
  const isSharingLocation = isAuthenticated && !trackingError && Boolean(lastAcknowledgedAt && now-Date.parse(lastAcknowledgedAt)<30000);
  const value = useMemo(() => ({ permissionStatus,isSharingLocation,backgroundTrackingActive,trackingError,
    lastSentAt,lastKnownCoordinates,requestPermission,isHighFrequencyMode:Boolean(activeBookingId),backgroundTrackingStarting,refreshLocation }),
    [permissionStatus,isSharingLocation,backgroundTrackingActive,trackingError,lastSentAt,lastKnownCoordinates,requestPermission,activeBookingId,backgroundTrackingStarting,refreshLocation]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
