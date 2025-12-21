/**
 * Custom hook for managing Expo push notifications
 * Handles token registration, message listeners, and navigation
 * Compatible with Expo managed workflow
 * 
 * NOTE: This hook does NOT use useNavigation() to avoid requiring
 * NavigationContainer. Navigation is handled via the context's
 * pendingNavigation state which can be consumed by a component
 * inside the NavigationContainer.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { useAuth } from './useAuth';
import { registerDeviceToken } from '../api/driver';
import {
    getNotificationType,
    handleNotificationPress,
    logNotification,
    triggerVibration,
} from '../utils/notificationHandlers';

const PUSH_TOKEN_KEY = 'driverPushToken';

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export type PendingNavigation = {
    screen: string;
    params?: Record<string, any>;
} | null;

/**
 * Hook to initialize and manage Expo push notifications
 */
export const useNotificationService = () => {
    const { user, token: authToken, isAuthenticated } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);

    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    /**
     * Clear pending navigation after it's been handled
     */
    const clearPendingNavigation = useCallback(() => {
        setPendingNavigation(null);
    }, []);

    /**
     * Register push token with backend
     */
    const registerPushToken = async (pushToken: string): Promise<void> => {
        if (!isAuthenticated || !authToken) {
            console.warn('Cannot register push token: user not authenticated');
            return;
        }

        try {
            const platform = Platform.OS as 'android' | 'ios';
            const response = await registerDeviceToken({
                token: pushToken,
                platform,
                role: 'DRIVER',
            });

            if (response.success) {
                console.log('Push token registered successfully with backend');
                await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
            }
        } catch (error) {
            console.error('Failed to register push token:', error);
        }
    };

    /**
     * Get Expo push token
     */
    const getExpoPushToken = async (): Promise<string | null> => {
        // Check if running on a physical device
        if (!Device.isDevice) {
            console.warn('Push notifications require a physical device');
            return null;
        }

        try {
            // Check and request permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.warn('Notification permission not granted');
                return null;
            }

            // Get project ID from Constants
            const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

            if (!projectId) {
                console.error('Project ID not found. Make sure you have configured EAS in app.json/app.config.js');
                return null;
            }

            // Get Expo push token
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId,
            });

            console.log('Expo push token obtained:', tokenData.data);
            return tokenData.data;
        } catch (error) {
            console.error('Failed to get Expo push token:', error);
            return null;
        }
    };

    /**
     * Setup Android notification channel
     */
    const setupNotificationChannel = async (): Promise<void> => {
        if (Platform.OS !== 'android') {
            return;
        }

        // Create channels for different notification types
        await Notifications.setNotificationChannelAsync('rides', {
            name: 'Ride Notifications',
            description: 'High priority notifications for new ride assignments',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 100, 100, 100, 100, 100],
            lightColor: '#FFB800',
        });

        await Notifications.setNotificationChannelAsync('ride-cancellation', {
            name: 'Ride Cancellations',
            description: 'Notifications when rides are cancelled',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 150, 100, 150],
        });

        await Notifications.setNotificationChannelAsync('sos-alerts', {
            name: 'SOS Alerts',
            description: 'Emergency SOS alerts',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 200, 100, 200, 100, 200],
            lightColor: '#FF0000',
        });

        await Notifications.setNotificationChannelAsync('admin-updates', {
            name: 'Admin Updates',
            description: 'Administrative notifications and reassignments',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 100, 50, 100, 50, 100],
            lightColor: '#0066CC',
        });

        console.log('Notification channels initialized');
    };

    /**
     * Handle foreground notification received
     */
    const handleForegroundNotification = (notification: Notifications.Notification): void => {
        const data = notification.request.content.data as Record<string, string | number | boolean> | undefined;
        const notificationType = getNotificationType(data);

        console.log('Foreground notification received:', notification);
        logNotification(notificationType, data);
        triggerVibration(notificationType);
    };

    /**
     * Handle notification tap response - sets pending navigation
     */
    const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse): void => {
        const data = response.notification.request.content.data as Record<string, string | number | boolean> | undefined;
        const notificationType = getNotificationType(data);

        console.log('Notification tapped:', response);
        logNotification(notificationType, data);

        const navigationAction = handleNotificationPress(data);
        if (navigationAction) {
            // Set pending navigation to be handled by a component inside NavigationContainer
            setPendingNavigation(navigationAction);
        }
    }, []);

    /**
     * Initialize notifications on authentication
     */
    useEffect(() => {
        if (!isAuthenticated || !authToken) {
            return;
        }

        let isMounted = true;

        const initializeNotifications = async (): Promise<void> => {
            try {
                // Setup Android notification channels
                await setupNotificationChannel();

                // Get Expo push token
                const token = await getExpoPushToken();

                if (token && isMounted) {
                    setExpoPushToken(token);
                    await registerPushToken(token);
                }

                // Set up foreground notification listener
                notificationListener.current = Notifications.addNotificationReceivedListener(
                    handleForegroundNotification
                );

                // Set up notification response (tap) listener
                responseListener.current = Notifications.addNotificationResponseReceivedListener(
                    handleNotificationResponse
                );

                // Check if app was opened from a notification
                const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
                if (lastNotificationResponse && isMounted) {
                    console.log('App opened from notification:', lastNotificationResponse);
                    handleNotificationResponse(lastNotificationResponse);
                }

                if (isMounted) {
                    setIsInitialized(true);
                }

                console.log('Expo notifications initialization completed');
            } catch (error) {
                console.error('Notification initialization failed:', error);
            }
        };

        initializeNotifications();

        // Cleanup on unmount
        return () => {
            isMounted = false;

            if (notificationListener.current) {
                notificationListener.current.remove();
                notificationListener.current = null;
            }

            if (responseListener.current) {
                responseListener.current.remove();
                responseListener.current = null;
            }
        };
    }, [isAuthenticated, authToken, user?.id, handleNotificationResponse]);

    return {
        expoPushToken,
        isInitialized,
        pendingNavigation,
        clearPendingNavigation,
        registerPushToken,
    };
};
