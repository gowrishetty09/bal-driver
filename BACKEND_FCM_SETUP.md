# Backend FCM Implementation Guide

This guide provides detailed instructions for implementing Firebase Cloud Messaging (FCM) support on the backend to send push notifications to driver mobile devices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Admin Setup](#firebase-admin-setup)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Notification Services](#notification-services)
6. [Implementation Examples](#implementation-examples)

## Prerequisites

### Required Services

- Firebase Project with Cloud Messaging enabled
- Node.js/TypeScript for backend
- Database (PostgreSQL, MongoDB, etc.)
- Redis (optional, for caching device tokens)

### Node.js Packages

```bash
npm install firebase-admin
npm install @google-cloud/firestore  # if using Firestore
```

## Firebase Admin Setup

### 1. Generate Service Account Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely (contains sensitive credentials)
4. Add to your backend `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY=path/to/serviceAccountKey.json
   FIREBASE_PROJECT_ID=your-project-id
   ```

### 2. Initialize Firebase Admin SDK

**TypeScript Example:**

```typescript
import admin from "firebase-admin";
import * as fs from "fs";

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

export const messaging = admin.messaging();
```

## Database Schema

### Device Tokens Table

```sql
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    fcm_token VARCHAR(1000) NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL, -- 'android' or 'ios'
    role VARCHAR(50) NOT NULL, -- 'DRIVER'
    device_name VARCHAR(255),
    device_model VARCHAR(255),
    app_version VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_driver_id (driver_id),
    INDEX idx_fcm_token (fcm_token),
    INDEX idx_is_active (is_active)
);

-- Notifications Log (optional, for audit trail)
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    body TEXT,
    data JSONB,
    status VARCHAR(50), -- 'sent', 'failed', 'delivered'
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_driver_id (driver_id),
    INDEX idx_notification_type (notification_type),
    INDEX idx_sent_at (sent_at)
);
```

### MongoDB Schema (Alternative)

```javascript
db.createCollection("deviceTokens", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["driverId", "fcmToken", "platform", "role"],
      properties: {
        _id: { bsonType: "objectId" },
        driverId: { bsonType: "objectId" },
        fcmToken: { bsonType: "string" },
        platform: { enum: ["android", "ios"] },
        role: { bsonType: "string" },
        deviceName: { bsonType: "string" },
        deviceModel: { bsonType: "string" },
        appVersion: { bsonType: "string" },
        isActive: { bsonType: "bool" },
        lastUsedAt: { bsonType: "date" },
        registeredAt: { bsonType: "date" },
        expiresAt: { bsonType: "date" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
});

// Create indexes
db.deviceTokens.createIndex({ driverId: 1 });
db.deviceTokens.createIndex({ fcmToken: 1 }, { unique: true });
db.deviceTokens.createIndex({ isActive: 1 });
```

## API Endpoints

### 1. Register Device Token

**Endpoint:** `POST /notifications/register-device`

**Authentication:** Required (JWT Bearer token)

**Request Body:**

```json
{
  "token": "FCM_TOKEN_STRING",
  "platform": "android",
  "role": "DRIVER"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "deviceTokenId": "device_token_123",
    "registeredAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid token or platform"
}
```

**Implementation (TypeScript):**

```typescript
import express from "express";
import { authMiddleware } from "./middleware/auth";
import { validateRequest } from "./middleware/validation";

const router = express.Router();

router.post(
  "/register-device",
  authMiddleware,
  validateRequest({
    token: "string|required|min:100|max:1000",
    platform: "string|required|in:android,ios",
    role: "string|required|in:DRIVER",
  }),
  async (req, res) => {
    try {
      const { token, platform, role } = req.body;
      const driverId = req.user.id; // From JWT token

      // Validate platform
      if (!["android", "ios"].includes(platform)) {
        return res.status(400).json({
          success: false,
          error: "Invalid platform",
        });
      }

      // Register or update device token
      const deviceToken = await DeviceToken.upsert(
        {
          driverId,
          fcmToken: token,
        },
        {
          fcmToken: token,
          platform,
          role,
          isActive: true,
          registeredAt: new Date(),
          lastUsedAt: new Date(),
        }
      );

      // Optional: Cache in Redis
      await redis.setex(
        `device:${driverId}`,
        24 * 60 * 60,
        JSON.stringify(deviceToken)
      );

      res.json({
        success: true,
        message: "Device registered successfully",
        data: {
          deviceTokenId: deviceToken.id,
          registeredAt: deviceToken.registeredAt,
        },
      });
    } catch (error) {
      console.error("Device registration error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to register device",
      });
    }
  }
);

export default router;
```

### 2. Get Active Device Tokens (Internal)

**Endpoint:** `GET /admin/devices/:driverId/tokens` (Internal only)

```typescript
async function getActiveDeviceTokens(driverId: string): Promise<string[]> {
  const tokens = await DeviceToken.find({
    driverId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });

  return tokens.map((t) => t.fcmToken);
}
```

## Notification Services

### 1. Base Notification Service

```typescript
import { messaging } from "./firebaseAdmin";
import { DeviceToken } from "./models/DeviceToken";

export interface NotificationPayload {
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, string>;
  android?: {
    priority?: "high" | "normal";
    notification?: Record<string, string>;
    ttl?: number;
  };
  apns?: {
    headers?: Record<string, string>;
    payload?: Record<string, any>;
  };
}

export class NotificationService {
  /**
   * Send notification to specific driver
   */
  static async sendToDriver(
    driverId: string,
    payload: NotificationPayload
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const tokens = await DeviceToken.find({
      driverId,
      isActive: true,
    });

    if (tokens.length === 0) {
      console.warn(`No active devices for driver ${driverId}`);
      return { success: 0, failed: 0, errors: ["No active devices"] };
    }

    return this.sendToTokens(
      tokens.map((t) => t.fcmToken),
      payload
    );
  }

  /**
   * Send notification to multiple tokens
   */
  static async sendToTokens(
    tokens: string[],
    payload: NotificationPayload
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = await Promise.allSettled(
      tokens.map((token) =>
        messaging().send({
          ...payload,
          token,
        })
      )
    );

    const response = { success: 0, failed: 0, errors: [] as string[] };

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        response.success++;
        console.log(`Message sent:`, result.value);
      } else {
        response.failed++;
        response.errors.push(result.reason.message);
        console.error(`Message failed:`, result.reason);
      }
    });

    return response;
  }

  /**
   * Send to topic
   */
  static async sendToTopic(
    topic: string,
    payload: NotificationPayload
  ): Promise<string> {
    return messaging().send({
      ...payload,
      topic,
    });
  }

  /**
   * Send multicast message
   */
  static async sendMulticast(
    tokens: string[],
    payload: NotificationPayload
  ): Promise<admin.messaging.BatchResponse> {
    return messaging().sendMulticast({
      ...payload,
      tokens,
    });
  }
}
```

### 2. Ride Notification Service

```typescript
import {
  NotificationService,
  NotificationPayload,
} from "./NotificationService";
import { Job } from "./models/Job";

export class RideNotificationService {
  /**
   * Send new ride assignment notification
   */
  static async notifyNewRide(jobId: string): Promise<void> {
    const job = await Job.findById(jobId);
    if (!job) throw new Error("Job not found");

    const payload: NotificationPayload = {
      notification: {
        title: "New Ride Assigned",
        body: `Pick up ${job.passengerName} at ${
          job.pickupAddress.split(",")[0]
        }`,
      },
      data: {
        notificationType: "NEW_RIDE",
        jobId: job.id,
        jobReference: job.reference,
        passengerName: job.passengerName,
        pickupAddress: job.pickupAddress,
        dropoffAddress: job.dropoffAddress,
        estimatedFare: job.estimatedFare?.toString() || "0",
        estimatedDuration: job.estimatedDuration?.toString() || "0",
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

    try {
      const result = await NotificationService.sendToDriver(
        job.driverId,
        payload
      );
      console.log(`New ride notification sent:`, result);

      // Log notification
      await NotificationLog.create({
        driverId: job.driverId,
        notificationType: "NEW_RIDE",
        title: payload.notification.title,
        body: payload.notification.body,
        data: payload.data,
        status: result.success > 0 ? "sent" : "failed",
        sentAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to send new ride notification:", error);
      throw error;
    }
  }

  /**
   * Send ride cancelled notification
   */
  static async notifyRideCancelled(
    jobId: string,
    reason?: string
  ): Promise<void> {
    const job = await Job.findById(jobId);
    if (!job) throw new Error("Job not found");

    const payload: NotificationPayload = {
      notification: {
        title: "Ride Cancelled",
        body: `Ride ${job.reference} has been cancelled`,
      },
      data: {
        notificationType: "RIDE_CANCELLED",
        jobId: job.id,
        jobReference: job.reference,
        cancelReason: reason || "No reason provided",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "ride-cancellation",
          click_action: "RIDE_CANCELLED",
        },
      },
    };

    try {
      const result = await NotificationService.sendToDriver(
        job.driverId,
        payload
      );
      console.log(`Ride cancelled notification sent:`, result);

      await NotificationLog.create({
        driverId: job.driverId,
        notificationType: "RIDE_CANCELLED",
        title: payload.notification.title,
        body: payload.notification.body,
        data: payload.data,
        status: result.success > 0 ? "sent" : "failed",
        sentAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to send ride cancelled notification:", error);
      throw error;
    }
  }

  /**
   * Send SOS notification
   */
  static async notifySOSAlert(
    sosId: string,
    driverId: string,
    message: string
  ): Promise<void> {
    const payload: NotificationPayload = {
      notification: {
        title: "SOS Alert",
        body: message,
      },
      data: {
        notificationType: "SOS_MESSAGE",
        sosId,
        driverId,
        message,
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "sos-alerts",
          color: "#FF0000",
          click_action: "SOS_MESSAGE",
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
              title: "SOS Alert",
              body: message,
            },
          },
        },
      },
    };

    try {
      const result = await NotificationService.sendToDriver(driverId, payload);
      console.log(`SOS notification sent:`, result);

      await NotificationLog.create({
        driverId,
        notificationType: "SOS_MESSAGE",
        title: payload.notification.title,
        body: payload.notification.body,
        data: payload.data,
        status: result.success > 0 ? "sent" : "failed",
        sentAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to send SOS notification:", error);
      throw error;
    }
  }
}
```

## Implementation Examples

### 1. Express Route Integration

```typescript
import express from "express";
import { RideNotificationService } from "./services/RideNotificationService";
import { authMiddleware } from "./middleware/auth";

const router = express.Router();

// Assign ride and notify driver
router.post("/jobs/:jobId/assign", authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { driverId } = req.body;

    // Assign the job
    const job = await Job.findByIdAndUpdate(
      jobId,
      { driverId, status: "ASSIGNED" },
      { new: true }
    );

    // Send notification
    await RideNotificationService.notifyNewRide(jobId);

    res.json({
      success: true,
      job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Cancel ride and notify driver
router.post("/jobs/:jobId/cancel", authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;

    // Update job status
    const job = await Job.findByIdAndUpdate(
      jobId,
      { status: "CANCELLED" },
      { new: true }
    );

    // Send notification
    await RideNotificationService.notifyRideCancelled(jobId, reason);

    res.json({
      success: true,
      job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
```

### 2. SOS Integration

```typescript
router.post("/sos", authMiddleware, async (req, res) => {
  try {
    const { driverId } = req.user;
    const { message } = req.body;

    // Create SOS record
    const sos = await SOS.create({
      driverId,
      message,
      status: "ACTIVE",
      createdAt: new Date(),
    });

    // Notify driver's support team/supervisor
    await RideNotificationService.notifySOSAlert(sos.id, driverId, message);

    res.json({
      success: true,
      sos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

### 3. Token Cleanup Job

```typescript
import cron from "node-cron";

// Clean up expired tokens every hour
cron.schedule("0 * * * *", async () => {
  try {
    const result = await DeviceToken.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    console.log(`Cleaned up ${result.deletedCount} expired tokens`);
  } catch (error) {
    console.error("Token cleanup failed:", error);
  }
});
```

## Testing Notification Delivery

### Using Firebase Console

1. Go to Firebase Console → Cloud Messaging
2. Click "Send your first message"
3. Enter notification details
4. Select "Send test message"
5. Add FCM token or instance ID
6. Click "Test"

### Using Admin SDK (Node.js)

```typescript
import { messaging } from "./firebaseAdmin";

async function testNotification() {
  const message = {
    notification: {
      title: "Test Notification",
      body: "This is a test message",
    },
    data: {
      notificationType: "NEW_RIDE",
      jobId: "test_123",
    },
    android: {
      priority: "high" as const,
      notification: {
        sound: "default",
        channelId: "rides",
      },
    },
    token: "YOUR_FCM_TOKEN_HERE",
  };

  try {
    const response = await messaging().send(message);
    console.log("Message sent successfully:", response);
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}
```

## Monitoring & Analytics

### Log Notification Metrics

```typescript
async function logNotificationMetrics() {
  const logs = await NotificationLog.find({
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  const metrics = {
    total: logs.length,
    sent: logs.filter((l) => l.status === "sent").length,
    failed: logs.filter((l) => l.status === "failed").length,
    byType: {
      newRide: logs.filter((l) => l.notificationType === "NEW_RIDE").length,
      cancelled: logs.filter((l) => l.notificationType === "RIDE_CANCELLED")
        .length,
      sos: logs.filter((l) => l.notificationType === "SOS_MESSAGE").length,
    },
  };

  console.log("24h Notification Metrics:", metrics);
  return metrics;
}
```

## Troubleshooting

### Common Issues

1. **"InvalidArgumentError: Malformed FCM token"**

   - Token format invalid or corrupted
   - Re-register device to get fresh token

2. **"InstanceIdError: Instance ID token revoked"**

   - Token expired or revoked
   - User uninstalled/reinstalled app
   - Clear token and get new one

3. **"NotFoundError: Requested instance ID token not found"**

   - Token was deleted or never existed
   - Device was unregistered from FCM

4. **"QuotaExceededError: Message rate exceeded"**
   - Sending too many messages (quota limits)
   - Implement rate limiting
   - Check Firebase pricing plan
