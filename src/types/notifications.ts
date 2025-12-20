/**
 * Firebase Cloud Messaging Notification Types
 */

export type NotificationType = 'NEW_RIDE' | 'RIDE_CANCELLED' | 'SOS_MESSAGE' | 'ADMIN_REASSIGNMENT';

export type FCMNotificationPayload = {
    notificationType: NotificationType;
    title: string;
    body: string;
    data: {
        notificationType: NotificationType;
        [key: string]: string | number | boolean;
    };
};

export type NewRideNotification = FCMNotificationPayload & {
    data: {
        notificationType: 'NEW_RIDE';
        jobId: string;
        jobReference: string;
        passengerName: string;
        pickupAddress: string;
        dropoffAddress: string;
        estimatedFare: string;
        estimatedDuration: string;
    };
};

export type RideCancelledNotification = FCMNotificationPayload & {
    data: {
        notificationType: 'RIDE_CANCELLED';
        jobId: string;
        jobReference: string;
        cancelReason?: string;
    };
};

export type SosMessageNotification = FCMNotificationPayload & {
    data: {
        notificationType: 'SOS_MESSAGE';
        sosId: string;
        driverId: string;
        message: string;
    };
};

export type AdminReassignmentNotification = FCMNotificationPayload & {
    data: {
        notificationType: 'ADMIN_REASSIGNMENT';
        jobId: string;
        jobReference: string;
        previousDriverId?: string;
        newDriverId: string;
        reason: string;
        passengerName: string;
        pickupAddress: string;
        dropoffAddress: string;
    };
};

export type RemoteMessage = {
    notification?: {
        title?: string;
        body?: string;
    };
    data?: Record<string, string | number | boolean>;
    messageId?: string;
    sentTime?: number;
    from?: string;
};

export type NotificationTapAction = {
    type: 'NAVIGATE' | 'OPEN_RIDE';
    params?: {
        jobId?: string;
        screen?: string;
        [key: string]: any;
    };
};
