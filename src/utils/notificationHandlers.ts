/**
 * Notification handlers and utilities for FCM notifications
 */
import { Platform, Vibration } from 'react-native';
import notifee, { AndroidImportance, AndroidChannel, AuthorizationStatus } from 'react-native-notifee';
import { RemoteMessage, NotificationType, NewRideNotification, RideCancelledNotification, SosMessageNotification } from '../types/notifications';

/**
 * Initialize Android notification channels for different notification types
 */
export const initializeNotificationChannels = async (): Promise<void> => {
    if (Platform.OS !== 'android') {
        return;
    }

    try {
        // Channel for new ride notifications (high priority with sound)
        await notifee.createChannel({
            id: 'rides',
            name: 'Ride Notifications',
            description: 'High priority notifications for new ride assignments',
            importance: AndroidImportance.MAX,
            sound: 'default',
            vibration: true,
            lightColor: '#FFB800',
        } as AndroidChannel);

        // Channel for ride cancellation notifications
        await notifee.createChannel({
            id: 'ride-cancellation',
            name: 'Ride Cancellations',
            description: 'Notifications when rides are cancelled',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibration: true,
        } as AndroidChannel);

        // Channel for SOS alerts (max priority)
        await notifee.createChannel({
            id: 'sos-alerts',
            name: 'SOS Alerts',
            description: 'Emergency SOS alerts',
            importance: AndroidImportance.MAX,
            sound: 'default',
            vibration: true,
            lightColor: '#FF0000',
        } as AndroidChannel);

        console.log('Notification channels initialized');
    } catch (error) {
        console.error('Failed to initialize notification channels:', error);
    }
};

/**
 * Request user permission for notifications
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    try {
        const authStatus = await notifee.requestPermission({
            alert: true,
            sound: true,
            badge: true,
            criticalAlert: true,
        });

        const isEnabled = authStatus === AuthorizationStatus.GRANTED;
        console.log(`Notification permission ${isEnabled ? 'granted' : 'denied'}`);
        return isEnabled;
    } catch (error) {
        console.error('Failed to request notification permission:', error);
        return false;
    }
};

/**
 * Display a local foreground notification with proper styling
 */
export const displayNotification = async (
    notification: RemoteMessage,
    notificationType: NotificationType,
): Promise<void> => {
    try {
        const title = notification.notification?.title || 'LIM Driver';
        const body = notification.notification?.body || 'New notification';
        const data = notification.data || {};

        let channelId = 'default';
        let android: any = {
            channelId: 'default',
            sound: 'default',
            vibrate: [0, 250, 250, 250],
        };

        // Configure channel and styling based on notification type
        switch (notificationType) {
            case 'NEW_RIDE':
                channelId = 'rides';
                android = {
                    channelId: 'rides',
                    sound: 'default',
                    vibrate: [0, 100, 100, 100, 100, 100],
                    priority: 'high',
                    color: '#FFB800',
                    pressAction: {
                        id: 'default',
                    },
                };
                break;
            case 'RIDE_CANCELLED':
                channelId = 'ride-cancellation';
                android = {
                    channelId: 'ride-cancellation',
                    sound: 'default',
                    vibrate: [0, 150, 100, 150],
                    priority: 'high',
                    pressAction: {
                        id: 'default',
                    },
                };
                break;
            case 'SOS_MESSAGE':
                channelId = 'sos-alerts';
                android = {
                    channelId: 'sos-alerts',
                    sound: 'default',
                    vibrate: [0, 200, 100, 200, 100, 200],
                    priority: 'max',
                    color: '#FF0000',
                    pressAction: {
                        id: 'default',
                    },
                };
                break;
        }

        await notifee.displayNotification({
            title,
            body,
            data,
            android,
            ios: {
                sound: 'default',
                critical: notificationType === 'SOS_MESSAGE',
                criticalVolume: 1,
            },
        });

        console.log(`Displayed ${notificationType} notification:`, { title, body });
    } catch (error) {
        console.error('Failed to display notification:', error);
    }
};

/**
 * Trigger vibration based on notification type
 */
export const triggerVibration = (notificationType: NotificationType): void => {
    if (Platform.OS !== 'android') {
        return;
    }

    try {
        switch (notificationType) {
            case 'NEW_RIDE':
                // Strong vibration pattern for new ride (double pulse)
                Vibration.vibrate([100, 100, 100, 100, 100, 100], false);
                break;
            case 'RIDE_CANCELLED':
                // Medium vibration pattern for cancellation
                Vibration.vibrate([150, 100, 150], false);
                break;
            case 'SOS_MESSAGE':
                // Urgent vibration pattern for SOS (rapid pulses)
                Vibration.vibrate([50, 50, 50, 50, 50, 50, 50, 50], false);
                break;
        }
    } catch (error) {
        console.warn('Failed to trigger vibration:', error);
    }
};

/**
 * Extract notification type from FCM message data
 */
export const getNotificationType = (data?: Record<string, string | number | boolean>): NotificationType => {
    if (!data) {
        return 'NEW_RIDE';
    }

    const type = data.notificationType;
    if (type === 'NEW_RIDE' || type === 'RIDE_CANCELLED' || type === 'SOS_MESSAGE') {
        return type;
    }

    return 'NEW_RIDE';
};

/**
 * Handle notification tap/press action
 * Returns navigation params for routing
 */
export const handleNotificationPress = (data?: Record<string, string | number | boolean>) => {
    if (!data) {
        return { screen: 'ActiveJobsTab' };
    }

    const notificationType = getNotificationType(data);

    switch (notificationType) {
        case 'NEW_RIDE':
        case 'RIDE_CANCELLED':
            // Navigate to active jobs with specific job details
            return {
                screen: 'ActiveJobsTab',
                params: {
                    jobId: data.jobId,
                    openDetails: true,
                },
            };
        case 'SOS_MESSAGE':
            // For SOS, navigate to active jobs (driver is already there)
            return {
                screen: 'ActiveJobsTab',
            };
        default:
            return { screen: 'ActiveJobsTab' };
    }
};

/**
 * Log notification for debugging/analytics
 */
export const logNotification = (
    notificationType: NotificationType,
    data?: Record<string, string | number | boolean>,
): void => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Notification received:`, {
        type: notificationType,
        data,
    });
};
