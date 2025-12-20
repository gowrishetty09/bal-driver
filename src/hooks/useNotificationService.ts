/**
 * Custom hook for managing Firebase Cloud Messaging notifications
 * Handles FCM token registration, message listeners, and navigation
 */
import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as SecureStore from 'expo-secure-store';

import { useAuth } from './useAuth';
import { registerDeviceToken } from '../api/driver';
import {
    initializeNotificationChannels,
    requestNotificationPermission,
    displayNotification,
    triggerVibration,
    getNotificationType,
    handleNotificationPress,
    logNotification,
} from '../utils/notificationHandlers';
import { Platform } from 'react-native';

const FCM_TOKEN_KEY = 'driverFCMToken';

type NavigationRef = ReturnType<typeof useNavigation>;

/**
 * Hook to initialize and manage FCM notifications
 */
export const useNotificationService = () => {
    const navigation = useNavigation() as NavigationRef;
    const { user, token: authToken, isAuthenticated } = useAuth();
    const unsubscribeMessageRef = useRef<(() => void) | null>(null);
    const unsubscribePressRef = useRef<(() => void) | null>(null);

    /**
     * Register FCM token with backend
     */
    const registerFCMToken = async (fcmToken: string): Promise<void> => {
        if (!isAuthenticated || !authToken) {
            console.warn('Cannot register FCM token: user not authenticated');
            return;
        }

        try {
            const platform = Platform.OS as 'android' | 'ios';
            const response = await registerDeviceToken({
                token: fcmToken,
                platform,
                role: 'DRIVER',
            });

            if (response.success) {
                console.log('FCM token registered successfully with backend');
                // Store FCM token locally
                await SecureStore.setItemAsync(FCM_TOKEN_KEY, fcmToken);
            }
        } catch (error) {
            console.error('Failed to register FCM token:', error);
            // Don't throw error here - allow app to continue even if registration fails
        }
    };

    /**
     * Handle FCM token refresh
     */
    const handleTokenRefresh = async (newToken: string): Promise<void> => {
        console.log('FCM token refreshed:', newToken);
        await registerFCMToken(newToken);
    };

    /**
     * Handle foreground messages (when app is in focus)
     */
    const handleForegroundMessage = async (message: FirebaseMessagingTypes.RemoteMessage): Promise<void> => {
        console.log('Foreground message received:', message);

        const notificationType = getNotificationType(message.data);
        logNotification(notificationType, message.data);

        // Display the notification
        await displayNotification(message, notificationType);

        // Trigger vibration
        triggerVibration(notificationType);
    };

    /**
     * Handle background message press (when app is closed or backgrounded)
     */
    const handleBackgroundMessagePress = async (message: FirebaseMessagingTypes.RemoteMessage): Promise<void> => {
        console.log('Background message pressed:', message);

        const notificationType = getNotificationType(message.data);
        logNotification(notificationType, message.data);

        // Handle navigation based on notification type
        const navigationAction = handleNotificationPress(message.data);
        if (navigationAction) {
            // @ts-ignore - navigation params vary by screen
            navigation.navigate(navigationAction.screen, navigationAction.params);
        }
    };

    /**
     * Initialize FCM setup on authentication
     */
    useEffect(() => {
        if (!isAuthenticated || !authToken) {
            return;
        }

        const initializeFCM = async (): Promise<void> => {
            try {
                // Initialize notification channels (Android only)
                await initializeNotificationChannels();

                // Request notification permissions
                await requestNotificationPermission();

                // Get FCM token and register it
                const fcmToken = await messaging().getToken();
                console.log('FCM token obtained:', fcmToken);
                await registerFCMToken(fcmToken);

                // Set up token refresh listener
                const unsubscribeTokenRefresh = messaging().onTokenRefresh((newToken) => {
                    handleTokenRefresh(newToken);
                });

                // Set up foreground message listener
                unsubscribeMessageRef.current = messaging().onMessage(async (message) => {
                    await handleForegroundMessage(message);
                });

                // Set up background message handler (when app is terminated or backgrounded)
                messaging().setBackgroundMessageHandler(async (message) => {
                    console.log('Background message received:', message);
                    const notificationType = getNotificationType(message.data);
                    logNotification(notificationType, message.data);

                    // Display notification for background messages too
                    await displayNotification(message, notificationType);
                    triggerVibration(notificationType);
                });

                // Handle notification press when app is opened from background
                unsubscribePressRef.current = messaging().onNotificationOpenedApp((message) => {
                    handleBackgroundMessagePress(message);
                });

                // Check if app was launched from a notification
                const initialNotification = await messaging().getInitialNotification();
                if (initialNotification) {
                    console.log('App opened from notification:', initialNotification);
                    handleBackgroundMessagePress(initialNotification);
                }

                console.log('FCM initialization completed');

                // Cleanup function
                return () => {
                    unsubscribeTokenRefresh();
                    unsubscribeMessageRef.current?.();
                    unsubscribePressRef.current?.();
                };
            } catch (error) {
                console.error('FCM initialization failed:', error);
            }
        };

        const cleanupPromise = initializeFCM();

        return () => {
            // This is a bit tricky with async cleanup
            // We'll just ensure the listeners are cleaned up
            unsubscribeMessageRef.current?.();
            unsubscribePressRef.current?.();
        };
    }, [isAuthenticated, authToken, user?.id]);

    return {
        registerFCMToken,
    };
};
