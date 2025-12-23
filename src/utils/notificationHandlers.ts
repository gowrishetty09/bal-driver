/**
 * Notification handlers and utilities for Expo push notifications
 * Compatible with Expo managed workflow
 */
import { Platform, Vibration } from 'react-native';
import { NotificationType } from '../types/notifications';

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
            case 'ADMIN_REASSIGNMENT':
                // Moderate vibration pattern for admin updates
                Vibration.vibrate([100, 50, 100, 50, 100], false);
                break;
        }
    } catch (error) {
        console.warn('Failed to trigger vibration:', error);
    }
};

/**
 * Extract notification type from notification data
 * Backend sends 'type' field with values like 'DRIVER_ASSIGNED', 'RIDE_STARTED', etc.
 * Mobile uses 'notificationType' with values like 'NEW_RIDE', 'RIDE_CANCELLED', etc.
 */
export const getNotificationType = (data?: Record<string, string | number | boolean>): NotificationType => {
    if (!data) {
        return 'NEW_RIDE';
    }

    // Check for mobile-style notificationType first
    const mobileType = data.notificationType;
    if (mobileType === 'NEW_RIDE' || mobileType === 'RIDE_CANCELLED' || mobileType === 'SOS_MESSAGE' || mobileType === 'ADMIN_REASSIGNMENT') {
        return mobileType;
    }

    // Map backend notification types to mobile types
    const backendType = data.type as string;
    switch (backendType) {
        case 'DRIVER_ASSIGNED':
        case 'NEW_BOOKING':
        case 'BOOKING_CREATED':
            return 'NEW_RIDE';
        case 'BOOKING_CANCELLED':
        case 'RIDE_CANCELLED':
            return 'RIDE_CANCELLED';
        case 'SOS_ALERT':
        case 'SOS_MESSAGE':
            return 'SOS_MESSAGE';
        case 'DRIVER_REASSIGNED':
        case 'ADMIN_UPDATE':
            return 'ADMIN_REASSIGNMENT';
        default:
            return 'NEW_RIDE';
    }
};

/**
 * Handle notification tap/press action
 * Returns navigation params for routing
 * Backend sends entityId for booking ID, mobile sends jobId
 */
export const handleNotificationPress = (data?: Record<string, string | number | boolean>) => {
    if (!data) {
        return { screen: 'ActiveJobsTab' };
    }

    const notificationType = getNotificationType(data);
    // Backend sends entityId, mobile sends jobId - support both
    const jobId = data.jobId || data.entityId;

    switch (notificationType) {
        case 'NEW_RIDE':
        case 'RIDE_CANCELLED':
        case 'ADMIN_REASSIGNMENT':
            // Navigate to active jobs with specific job details
            return {
                screen: 'ActiveJobsTab',
                params: {
                    jobId: jobId,
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

/**
 * Get channel ID for a notification type (for backend/Expo push server)
 */
export const getChannelIdForType = (notificationType: NotificationType): string => {
    switch (notificationType) {
        case 'NEW_RIDE':
            return 'rides';
        case 'RIDE_CANCELLED':
            return 'ride-cancellation';
        case 'SOS_MESSAGE':
            return 'sos-alerts';
        case 'ADMIN_REASSIGNMENT':
            return 'admin-updates';
        default:
            return 'default';
    }
};
