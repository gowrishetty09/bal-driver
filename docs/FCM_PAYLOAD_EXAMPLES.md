# FCM Notification Payload Examples

This file contains ready-to-use FCM notification payloads for different notification types.

## 1. New Ride Assignment Notification

### Scenario

Driver is assigned a new ride pickup task.

### Firebase Admin SDK (Node.js)

```typescript
import admin from "firebase-admin";

const message = {
  notification: {
    title: "New Ride Assigned",
    body: "Pick up John Doe at Downtown Station",
  },
  data: {
    notificationType: "NEW_RIDE",
    jobId: "64f5a8c9d0e1f2g3h4i5j6k7",
    jobReference: "LIM-001234",
    passengerName: "John Doe",
    pickupAddress: "123 Main Street, Downtown Station, New York",
    dropoffAddress: "456 Park Avenue, Central Park, New York",
    estimatedFare: "28.50",
    estimatedDuration: "18",
  },
  android: {
    priority: "high",
    notification: {
      sound: "default",
      channelId: "rides",
      color: "#FFB800",
      click_action: "NEW_RIDE",
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

// Send to specific device
await admin.messaging().send({
  ...message,
  token: "FCM_TOKEN_HERE",
});

// Or send to multiple devices
const devicesTokens = ["token1", "token2", "token3"];
await admin.messaging().sendMulticast({
  ...message,
  tokens: devicesTokens,
});

// Or send to topic
await admin.messaging().send({
  ...message,
  topic: "drivers-new-rides",
});
```

### cURL Example

```bash
curl -X POST \
  https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "FCM_TOKEN_HERE",
      "notification": {
        "title": "New Ride Assigned",
        "body": "Pick up John Doe at Downtown Station"
      },
      "data": {
        "notificationType": "NEW_RIDE",
        "jobId": "64f5a8c9d0e1f2g3h4i5j6k7",
        "jobReference": "LIM-001234",
        "passengerName": "John Doe",
        "pickupAddress": "123 Main Street, Downtown Station, New York",
        "dropoffAddress": "456 Park Avenue, Central Park, New York",
        "estimatedFare": "28.50",
        "estimatedDuration": "18"
      },
      "android": {
        "priority": "high",
        "notification": {
          "sound": "default",
          "channel_id": "rides",
          "color": "#FFB800"
        }
      }
    }
  }'
```

### Expected App Behavior

- ✅ Notification appears with gold (#FFB800) indicator
- ✅ Sound plays (default system sound)
- ✅ Device vibrates with pattern: [100, 100, 100, 100, 100, 100]
- ✅ When tapped, opens Active Jobs screen with job details
- ✅ Job details show passenger name, pickup/dropoff addresses, fare estimate

---

## 2. Ride Cancelled Notification

### Scenario

A ride that was assigned to the driver has been cancelled by the passenger.

### Firebase Admin SDK (Node.js)

```typescript
const message = {
  notification: {
    title: "Ride Cancelled",
    body: "Ride LIM-001234 has been cancelled by passenger",
  },
  data: {
    notificationType: "RIDE_CANCELLED",
    jobId: "64f5a8c9d0e1f2g3h4i5j6k7",
    jobReference: "LIM-001234",
    cancelReason: "Passenger requested cancellation",
  },
  android: {
    priority: "high",
    notification: {
      sound: "default",
      channelId: "ride-cancellation",
      click_action: "RIDE_CANCELLED",
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

await admin.messaging().send({
  ...message,
  token: "FCM_TOKEN_HERE",
});
```

### cURL Example

```bash
curl -X POST \
  https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "FCM_TOKEN_HERE",
      "notification": {
        "title": "Ride Cancelled",
        "body": "Ride LIM-001234 has been cancelled by passenger"
      },
      "data": {
        "notificationType": "RIDE_CANCELLED",
        "jobId": "64f5a8c9d0e1f2g3h4i5j6k7",
        "jobReference": "LIM-001234",
        "cancelReason": "Passenger requested cancellation"
      },
      "android": {
        "priority": "high",
        "notification": {
          "sound": "default",
          "channel_id": "ride-cancellation"
        }
      }
    }
  }'
```

### Expected App Behavior

- ✅ Notification appears in system tray
- ✅ Sound plays
- ✅ Device vibrates with pattern: [150, 100, 150]
- ✅ When tapped, opens Active Jobs screen
- ✅ Shows cancellation reason and ride reference

### Cancel Reason Examples

- "Passenger requested cancellation"
- "System auto-cancelled due to timeout"
- "Driver cancelled the ride"
- "Payment method failed"
- "Ride no longer needed"

---

## 3. SOS (Emergency) Alert Notification

### Scenario

The driver has triggered an SOS/emergency alert requiring immediate attention.

### Firebase Admin SDK (Node.js)

```typescript
const message = {
  notification: {
    title: "🚨 SOS Alert",
    body: "Emergency assistance requested by driver",
  },
  data: {
    notificationType: "SOS_MESSAGE",
    sosId: "64f5a9d0e1f2g3h4i5j6k7l8",
    driverId: "64e4b8c9d0e1f2g3h4i5j6k7",
    message: "Emergency assistance required - Driver location: 123 Main St",
  },
  android: {
    priority: "high",
    notification: {
      sound: "default",
      channelId: "sos-alerts",
      color: "#FF0000",
      click_action: "SOS_MESSAGE",
      priority: "max",
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
        alert: {
          title: "🚨 SOS Alert",
          body: "Emergency assistance requested",
        },
      },
    },
  },
};

await admin.messaging().send({
  ...message,
  token: "FCM_TOKEN_HERE",
});

// Or send to support team
await admin.messaging().send({
  ...message,
  topic: "support-team-sos-alerts",
});
```

### cURL Example

```bash
curl -X POST \
  https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "FCM_TOKEN_HERE",
      "notification": {
        "title": "🚨 SOS Alert",
        "body": "Emergency assistance requested by driver"
      },
      "data": {
        "notificationType": "SOS_MESSAGE",
        "sosId": "64f5a9d0e1f2g3h4i5j6k7l8",
        "driverId": "64e4b8c9d0e1f2g3h4i5j6k7",
        "message": "Emergency assistance required - Driver location: 123 Main St"
      },
      "android": {
        "priority": "high",
        "notification": {
          "sound": "default",
          "channel_id": "sos-alerts",
          "color": "#FF0000",
          "priority": "max"
        }
      }
    }
  }'
```

### Expected App Behavior

- ✅ Notification appears with red (#FF0000) indicator
- ✅ Sound plays (default system sound)
- ✅ Device vibrates with rapid pattern: [50, 50, 50, 50, 50, 50, 50, 50]
- ✅ High priority/critical alert
- ✅ When tapped, opens Active Jobs screen
- ✅ Shows emergency details and driver location

---

## Payload Data Fields Reference

### Common Fields (All Types)

| Field                | Type   | Required | Description                                    |
| -------------------- | ------ | -------- | ---------------------------------------------- |
| `notificationType`   | string | Yes      | `NEW_RIDE`, `RIDE_CANCELLED`, or `SOS_MESSAGE` |
| `notification.title` | string | Yes      | Notification title (shown in tray)             |
| `notification.body`  | string | Yes      | Notification body/message                      |

### NEW_RIDE Specific

| Field               | Type   | Description                                |
| ------------------- | ------ | ------------------------------------------ |
| `jobId`             | string | Unique job/ride ID from your system        |
| `jobReference`      | string | Driver-facing reference (e.g., LIM-001234) |
| `passengerName`     | string | Name of passenger                          |
| `pickupAddress`     | string | Full pickup address                        |
| `dropoffAddress`    | string | Full dropoff address                       |
| `estimatedFare`     | string | Fare amount (as decimal string)            |
| `estimatedDuration` | string | Duration in minutes                        |

**Example**:

```json
{
  "jobId": "64f5a8c9d0e1f2g3h4i5j6k7",
  "jobReference": "LIM-001234",
  "passengerName": "John Doe",
  "pickupAddress": "123 Main Street, Downtown, NY 10001",
  "dropoffAddress": "456 Park Avenue, Manhattan, NY 10022",
  "estimatedFare": "28.50",
  "estimatedDuration": "18"
}
```

### RIDE_CANCELLED Specific

| Field          | Type   | Description             |
| -------------- | ------ | ----------------------- |
| `jobId`        | string | Unique job/ride ID      |
| `jobReference` | string | Driver-facing reference |
| `cancelReason` | string | Reason for cancellation |

**Example**:

```json
{
  "jobId": "64f5a8c9d0e1f2g3h4i5j6k7",
  "jobReference": "LIM-001234",
  "cancelReason": "Passenger requested cancellation"
}
```

### SOS_MESSAGE Specific

| Field      | Type   | Description                 |
| ---------- | ------ | --------------------------- |
| `sosId`    | string | Unique SOS alert ID         |
| `driverId` | string | Driver ID who triggered SOS |
| `message`  | string | Emergency message details   |

**Example**:

```json
{
  "sosId": "64f5a9d0e1f2g3h4i5j6k7l8",
  "driverId": "64e4b8c9d0e1f2g3h4i5j6k7",
  "message": "Emergency assistance required - Location: 123 Main St, NYC"
}
```

---

## Android Notification Fields

### Channel IDs

- `rides` - New ride assignments (High priority, Gold color)
- `ride-cancellation` - Ride cancellations (High priority)
- `sos-alerts` - Emergency SOS alerts (Max priority, Red color)

### Priority Levels

- `high` - Standard high priority notifications
- `max` - Maximum priority for SOS alerts

### Colors (Hex)

- `#FFB800` - Gold (New rides)
- `#FF0000` - Red (SOS alerts)
- Default - For cancellations

---

## iOS Notification Fields

### APNS Priority

- `10` - High priority (used for all notification types)

### APS Payload

- `sound: 'default'` - Play system sound
- `badge: 1` - Show badge count
- `content-available: 1` - Background content available
- `critical: true` - For SOS (critical alert)

---

## Error Handling

### Common FCM Error Responses

```json
{
  "error": {
    "code": 400,
    "message": "Invalid registration token provided. Make sure it matches the registration token of the client app that the message is intended for."
  }
}
```

**Possible error codes:**

| Code | Meaning               | Action                                            |
| ---- | --------------------- | ------------------------------------------------- |
| 400  | Invalid token         | Token format wrong or expired, re-register device |
| 401  | Authentication failed | Check service account credentials                 |
| 403  | Not authorized        | Check project permissions                         |
| 404  | Instance ID not found | Token doesn't exist in Firebase                   |
| 429  | Rate limit exceeded   | Implement backoff retry                           |
| 500  | Internal server error | Retry after delay                                 |

### Retry Logic Example

```typescript
async function sendWithRetry(message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await admin.messaging().send(message);
    } catch (error) {
      if (error.code === "messaging/invalid-registration-token") {
        // Token invalid, delete from database
        console.log("Token invalid, removing...");
        break;
      }
      if (i < maxRetries - 1) {
        // Exponential backoff
        await delay(Math.pow(2, i) * 1000);
      }
    }
  }
  throw new Error("Failed to send after retries");
}
```

---

## Testing with cURL

### Prerequisites

```bash
# Get access token
gcloud auth application-default login

# Set variables
PROJECT_ID="your-firebase-project-id"
FCM_TOKEN="device-fcm-token-here"
```

### Send Test Notification

```bash
curl -X POST \
  "https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "message": {
    "token": "FCM_TOKEN",
    "notification": {
      "title": "Test Notification",
      "body": "This is a test message"
    },
    "data": {
      "notificationType": "NEW_RIDE",
      "jobId": "test_123",
      "jobReference": "TEST-001"
    }
  }
}
EOF
```

---

## Integration Checklist

- [ ] Firebase project created
- [ ] Android app registered with SHA-1
- [ ] Service account key generated
- [ ] Google Services plugin configured
- [ ] google-services.json placed in android/app/
- [ ] Backend `/notifications/register-device` endpoint implemented
- [ ] Device tokens stored in database
- [ ] Notification service implemented (see BACKEND_FCM_SETUP.md)
- [ ] Test notifications sent and received
- [ ] Navigation works on tap
- [ ] All notification types tested
- [ ] Vibration and sound verified
- [ ] Background state tested
- [ ] Killed state tested
- [ ] Error handling implemented
- [ ] Rate limiting configured
- [ ] Logging and monitoring set up

---

## Additional Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Firebase REST API Reference](https://firebase.google.com/docs/reference/fcm/rest)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [React Native Firebase](https://rnfirebase.io/messaging/usage)
- [Notifee Documentation](https://notifee.app/)

---

**Last Updated**: 2024  
**Version**: 1.0.0
