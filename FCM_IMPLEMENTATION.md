# Firebase Cloud Messaging (FCM) Implementation Guide

## Overview

This document describes the Firebase Cloud Messaging (FCM) implementation for the LIM Driver Mobile App. The system sends high-priority push notifications for critical events like new ride assignments, ride cancellations, and SOS alerts.

## Architecture

### Components

1. **NotificationContext** (`src/context/NotificationContext.tsx`)

   - Provides notification context to the app
   - Initializes the notification service on app startup

2. **useNotificationService Hook** (`src/hooks/useNotificationService.ts`)

   - Manages FCM initialization
   - Handles token registration and refresh
   - Sets up foreground/background message listeners
   - Manages notification press actions

3. **Notification Handlers** (`src/utils/notificationHandlers.ts`)

   - Displays local notifications with channel-specific configuration
   - Manages vibration patterns based on notification type
   - Handles navigation based on notification tap
   - Initializes Android notification channels

4. **Device Token API** (`src/api/driver.ts`)

   - `registerDeviceToken()` - Registers FCM token with the backend
   - Marks token with `role: 'DRIVER'` for backend filtering

5. **Types** (`src/types/notifications.ts`)
   - Type definitions for all notification types
   - Payload structures for NEW_RIDE, RIDE_CANCELLED, SOS_MESSAGE

## Features

### Notification Types

#### 1. New Ride Assignment (NEW_RIDE)

- **Priority**: High/Max
- **Sound**: Default system sound
- **Vibration**: Double pulse (100ms on, 100ms off, repeated)
- **Channel Color**: Gold (#FFB800)
- **Action**: Opens Active Jobs screen with job details
- **Payload Example**:
  ```json
  {
    "notificationType": "NEW_RIDE",
    "title": "New Ride Assigned",
    "body": "Pick up John at Downtown Center",
    "data": {
      "notificationType": "NEW_RIDE",
      "jobId": "job_123",
      "jobReference": "LIM-001",
      "passengerName": "John Doe",
      "pickupAddress": "Downtown Center, Main St",
      "dropoffAddress": "Central Park",
      "estimatedFare": "$25.50",
      "estimatedDuration": "15 mins"
    }
  }
  ```

#### 2. Ride Cancelled (RIDE_CANCELLED)

- **Priority**: High
- **Sound**: Default system sound
- **Vibration**: Medium pattern (150ms, 100ms, 150ms)
- **Channel**: ride-cancellation
- **Action**: Opens Active Jobs screen with cancelled job details
- **Payload Example**:
  ```json
  {
    "notificationType": "RIDE_CANCELLED",
    "title": "Ride Cancelled",
    "body": "Ride LIM-001 has been cancelled",
    "data": {
      "notificationType": "RIDE_CANCELLED",
      "jobId": "job_123",
      "jobReference": "LIM-001",
      "cancelReason": "Passenger cancelled the ride"
    }
  }
  ```

#### 3. SOS Alert (SOS_MESSAGE)

- **Priority**: Max (Critical)
- **Sound**: Default system sound
- **Vibration**: Rapid pulses (50ms on/off, repeated)
- **Channel Color**: Red (#FF0000)
- **Action**: Opens Active Jobs screen
- **Payload Example**:
  ```json
  {
    "notificationType": "SOS_MESSAGE",
    "title": "SOS Alert",
    "body": "Emergency assistance requested",
    "data": {
      "notificationType": "SOS_MESSAGE",
      "sosId": "sos_456",
      "driverId": "driver_123",
      "message": "Emergency assistance required"
    }
  }
  ```

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Add Android app:
   - Package Name: `com.lim.driver` (or your package name)
   - SHA-1 certificate fingerprint (follow Firebase instructions)
   - Download `google-services.json` and place in `android/app/`
4. Add iOS app (if needed):
   - Bundle ID: Your iOS bundle ID
   - Download `GoogleService-Info.plist` and add to iOS project

### 2. Android Configuration

**Already configured in this project:**

- ✅ `com.google.gms:google-services` plugin in `android/build.gradle`
- ✅ `com.google.gms.google-services` plugin applied in `android/app/build.gradle`
- ✅ Firebase dependencies in `package.json`:
  - `@react-native-firebase/app`
  - `@react-native-firebase/messaging`
  - `react-native-notifee`

**Additional steps:**

1. **Ensure `google-services.json` is in place:**

   ```
   android/app/google-services.json
   ```

2. **Verify Android Manifest permissions** (usually auto-configured):
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   ```

### 3. Backend API Endpoint

Implement the following endpoint in your backend:

**POST** `/notifications/register-device`

**Request Headers:**

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "FCM_TOKEN_HERE",
  "platform": "android",
  "role": "DRIVER"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Device registered successfully"
}
```

**Implementation Notes:**

- Store the device token securely
- Link token to driver account using JWT token
- Support multiple tokens per driver (mobile + web)
- Implement token cleanup for inactive devices

### 4. Sending Notifications from Backend

**Using Firebase Admin SDK (Node.js example):**

```typescript
import admin from "firebase-admin";

const message = {
  notification: {
    title: "New Ride Assigned",
    body: "Pick up John at Downtown Center",
  },
  data: {
    notificationType: "NEW_RIDE",
    jobId: "job_123",
    jobReference: "LIM-001",
    passengerName: "John Doe",
    pickupAddress: "Downtown Center, Main St",
    dropoffAddress: "Central Park",
    estimatedFare: "25.50",
    estimatedDuration: "15",
  },
  android: {
    priority: "high",
    notification: {
      sound: "default",
      channelId: "rides",
      color: "#FFB800",
    },
  },
  apns: {
    headers: {
      "apns-priority": "10",
    },
    payload: {
      aps: {
        sound: "default",
        badge: 1,
        "content-available": 1,
      },
    },
  },
};

// Send to specific device token
await admin.messaging().send({
  ...message,
  token: "DEVICE_FCM_TOKEN",
});

// Or send to specific topic
await admin.messaging().send({
  ...message,
  topic: "drivers-new-rides",
});
```

## Implementation Details

### FCM Token Registration Flow

```
1. User authenticates successfully
   ↓
2. AuthContext provides authentication tokens
   ↓
3. useNotificationService hook initializes
   ↓
4. Firebase Cloud Messaging obtains FCM token
   ↓
5. Token registered with backend via registerDeviceToken()
   ↓
6. Token stored in SecureStore for offline access
   ↓
7. Token refresh listener activated
```

### Notification Reception Flow

**Foreground (App in Focus):**

```
FCM Message received
   ↓
onMessage listener triggered
   ↓
displayNotification() shows local notification
   ↓
triggerVibration() activates based on type
   ↓
Sound plays automatically from notification channel
```

**Background/Killed State:**

```
FCM Message received
   ↓
setBackgroundMessageHandler executes (high priority)
   ↓
displayNotification() shows local notification
   ↓
User taps notification
   ↓
onNotificationOpenedApp listener triggered
   ↓
Navigation to appropriate screen based on type
```

### Notification Channels (Android)

| Channel ID          | Name               | Importance | Color   | Use Case               |
| ------------------- | ------------------ | ---------- | ------- | ---------------------- |
| `rides`             | Ride Notifications | MAX        | Gold    | New ride assignments   |
| `ride-cancellation` | Ride Cancellations | HIGH       | Default | Ride cancellations     |
| `sos-alerts`        | SOS Alerts         | MAX        | Red     | Emergency SOS messages |

## Testing

### Manual Testing

1. **Test Token Registration:**

   - Open Android Logcat while app runs
   - Check for: "FCM token obtained: [token]"
   - Verify: "FCM token registered successfully with backend"

2. **Test Notification Display:**

   - Use Firebase Console to send test message
   - Verify notification appears in notification tray
   - Check vibration pattern matches notification type

3. **Test Navigation:**
   - Tap notification
   - Verify correct screen opens with proper job data

### Firebase Console Testing

1. Go to Firebase Console → Cloud Messaging
2. Select "New Campaign"
3. Create notification with:
   - Title: "New Ride Assigned"
   - Body: "Test notification"
   - Additional data:
     ```
     notificationType: NEW_RIDE
     jobId: test_job_123
     ```
4. Target: Select app and device token
5. Send test notification

### Logcat Debugging

```bash
# Filter FCM logs
adb logcat | grep -i "fcm\|notification\|messaging"

# Full log with context
adb logcat *:V | grep "FCM\|Notification"
```

## Troubleshooting

### Token Not Registered

- **Check**: Is user authenticated? (useNotificationService requires isAuthenticated)
- **Check**: Is `google-services.json` in correct location?
- **Check**: Backend `/notifications/register-device` endpoint exists?
- **Check**: Network connectivity to backend

### Notifications Not Appearing

- **Check**: Android notification permissions granted
- **Check**: Notification channel created correctly
- **Check**: Backend sending to correct FCM token
- **Check**: Payload format matches expected structure

### Vibration Not Working

- **Check**: Device has vibration enabled in settings
- **Check**: App has vibration permission
- **Check**: Platform.OS is 'android' (iOS vibration uses different APIs)

### Navigation Not Working on Tap

- **Check**: NavigationRef passed correctly to handler
- **Check**: Screen name matches navigation stack
- **Check**: Job data in notification payload is valid

## Performance Considerations

1. **Token Refresh**: Only triggered when FCM provides new token (rare)
2. **Message Listeners**: Unsubscribed on cleanup to prevent memory leaks
3. **Local Notifications**: Displayed via notifee (efficient notification display)
4. **Vibration**: Cancelled previous pattern before starting new one

## Security

1. **Token Storage**: FCM tokens stored in SecureStore, encrypted
2. **API Authentication**: Device token endpoint protected by JWT auth
3. **Role-Based**: Tokens registered with DRIVER role for filtering
4. **Token Rotation**: Automatic refresh via FCM when needed
5. **Payload Validation**: App verifies notificationType before processing

## Future Enhancements

1. **Notification Preferences**: Let drivers customize alert sounds/vibration
2. **Do Not Disturb**: Support scheduled quiet hours
3. **Notification History**: Store received notifications in local DB
4. **Delivery Confirmation**: Confirm to backend when notification tapped
5. **Rich Notifications**: Add images/actions to notifications
6. **Topic Subscriptions**: Subscribe to specific topics (e.g., surge pricing)

## Integration Checklist

- [ ] `google-services.json` added to `android/app/`
- [ ] Firebase project created and Android app registered
- [ ] Backend endpoint `/notifications/register-device` implemented
- [ ] Backend can send FCM messages using Admin SDK
- [ ] Test notification sent and received on device
- [ ] Navigation works correctly on notification tap
- [ ] Vibration patterns verified for each notification type
- [ ] Sound configuration tested
- [ ] Token refresh tested (send test message after token change)
- [ ] Documentation shared with backend team

## Related Files

- [Notification Types](../types/notifications.ts)
- [Notification Service Hook](../hooks/useNotificationService.ts)
- [Notification Handlers](../utils/notificationHandlers.ts)
- [Notification Context](../context/NotificationContext.tsx)
- [Device Token API](../api/driver.ts)
