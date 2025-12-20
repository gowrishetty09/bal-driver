# Firebase Cloud Messaging - Implementation Overview

## 📊 Visual Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LIM DRIVER APP                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    App.tsx                           │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │         NotificationProvider (NEW)             │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │   useNotificationService (NEW)           │  │  │   │
│  │  │  │                                          │  │  │   │
│  │  │  │  ✅ Get FCM Token                        │  │  │   │
│  │  │  │  ✅ Register with Backend                │  │  │   │
│  │  │  │  ✅ Listen for Messages                  │  │  │   │
│  │  │  │  ✅ Handle Tap Navigation                │  │  │   │
│  │  │  │                                          │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  │                                                │  │   │
│  │  │  notificationHandlers (NEW)                    │  │   │
│  │  │  ✅ Display Notification                       │  │   │
│  │  │  ✅ Trigger Vibration                          │  │   │
│  │  │  ✅ Play Sound                                 │  │   │
│  │  │                                                │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         AuthContext / LocationContext / SosContext  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   AppNavigator                       │   │
│  │  - ActiveJobsScreen (receives notification)         │   │
│  │  - UpcomingJobsScreen                               │   │
│  │  - HistoryJobsScreen                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
                          ↓ (Tap Notification)
          ┌───────────────────────────────┐
          │   Navigate to Job Details     │
          │   with jobId from payload     │
          └───────────────────────────────┘
```

---

## 📱 Notification Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Firebase Admin SDK)                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /notifications/register-device                │   │
│  │  └─ Device Token Stored with DRIVER role            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Send FCM Message                                    │   │
│  │  {                                                   │   │
│  │    token: "FCM_TOKEN",                               │   │
│  │    notification: { title, body },                    │   │
│  │    data: {                                           │   │
│  │      notificationType: "NEW_RIDE",                   │   │
│  │      jobId: "...",                                   │   │
│  │      ...                                             │   │
│  │    }                                                 │   │
│  │  }                                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ (FCM Service)
┌─────────────────────────────────────────────────────────────┐
│        FIREBASE CLOUD MESSAGING (Google Services)            │
│                                                               │
│  ✅ Route message to correct device                          │
│  ✅ Handle priority levels                                   │
│  ✅ Retry on failure                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              MOBILE DEVICE (Android)                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  App State: FOREGROUND                             │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ onMessage Listener Triggered                 │  │    │
│  │  │ ✅ displayNotification()                      │  │    │
│  │  │ ✅ triggerVibration()                         │  │    │
│  │  │ ✅ Play Sound                                 │  │    │
│  │  │ ✅ Show in Notification Tray                  │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                          OR                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  App State: BACKGROUND or KILLED                   │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ setBackgroundMessageHandler Triggered        │  │    │
│  │  │ ✅ displayNotification()                      │  │    │
│  │  │ ✅ Show in Notification Tray                  │  │    │
│  │  │ ✅ Wait for User Tap                          │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓ (User Taps Notification)
┌─────────────────────────────────────────────────────────────┐
│              Notification Tap Handler                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ handleNotificationPress(notification.data)         │    │
│  │                                                     │    │
│  │ Extract: notificationType                          │    │
│  │ Switch on type:                                    │    │
│  │   - NEW_RIDE → Navigate ActiveJobs + JobDetails    │    │
│  │   - RIDE_CANCELLED → Navigate ActiveJobs + Details │    │
│  │   - SOS_MESSAGE → Navigate ActiveJobs              │    │
│  │                                                     │    │
│  │ Pass jobId, sosId to target screen                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│          APP NAVIGATES TO CORRECT SCREEN                     │
│          WITH NOTIFICATION DATA PASSED AS PARAMS             │
│                                                               │
│  ✅ Job details display                                      │
│  ✅ Navigation state preserved                               │
│  ✅ User can take action                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Authentication & Token Flow

```
USER LOGIN
    ↓
AuthContext.login()
    ↓
JWT Token Received
    ↓
isAuthenticated = true
    ↓
useNotificationService Hook Activates
    ↓
Firebase Cloud Messaging.getToken()
    ↓
FCM TOKEN OBTAINED
    ↓
registerDeviceToken({
    token: "...",
    platform: "android",
    role: "DRIVER"
})
    ↓
Backend: POST /notifications/register-device
    ↓
Backend Validates JWT
    ↓
Device Token Stored in Database
    ↓
✅ APP READY TO RECEIVE NOTIFICATIONS
    ↓
Token Refresh Listener Activated
    ↓
(If token refreshes)
    ↓
Re-register with new token
    ↓
Database updated
    ↓
✅ CONTINUE RECEIVING NOTIFICATIONS
```

---

## 📢 Notification Types & Channels

```
┌──────────────────────────────────────────────────────────────┐
│                  NOTIFICATION TYPES                          │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  1️⃣  NEW_RIDE                                                 │
│  ├─ Priority: HIGH/MAX                                        │
│  ├─ Channel ID: rides                                         │
│  ├─ Color: Gold (#FFB800)                                     │
│  ├─ Sound: Default system sound                               │
│  ├─ Vibration: [100,100,100,100,100,100] (double pulse)       │
│  ├─ Title: "New Ride Assigned"                                │
│  ├─ Body: "Pick up John at Downtown Station"                  │
│  └─ Action: Open Active Jobs + Job Details                    │
│                                                                │
│  2️⃣  RIDE_CANCELLED                                           │
│  ├─ Priority: HIGH                                            │
│  ├─ Channel ID: ride-cancellation                             │
│  ├─ Color: Default                                            │
│  ├─ Sound: Default system sound                               │
│  ├─ Vibration: [150,100,150] (medium pulse)                   │
│  ├─ Title: "Ride Cancelled"                                   │
│  ├─ Body: "Ride LIM-001234 has been cancelled"                │
│  └─ Action: Open Active Jobs + Cancellation Details           │
│                                                                │
│  3️⃣  SOS_MESSAGE                                              │
│  ├─ Priority: MAX (Critical)                                  │
│  ├─ Channel ID: sos-alerts                                    │
│  ├─ Color: Red (#FF0000)                                      │
│  ├─ Sound: Default system sound (critical)                    │
│  ├─ Vibration: [50,50,50,50,50,50,50,50] (rapid pulses)       │
│  ├─ Title: "🚨 SOS Alert"                                     │
│  ├─ Body: "Emergency assistance requested"                    │
│  └─ Action: Open Active Jobs Screen                           │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 📂 File Dependency Graph

```
app.json
    ↓
package.json (✅ UPDATED - added Firebase deps)
    ↓
    ├─→ @react-native-firebase/app
    ├─→ @react-native-firebase/messaging
    └─→ react-native-notifee
         ↓
    android/build.gradle (✅ UPDATED)
         ↓
    android/app/build.gradle (✅ UPDATED)
         ↓
    android/app/google-services.json (⚠️ ADD THIS)


App.tsx (✅ UPDATED)
    ├─→ AuthProvider
    │   └─→ src/context/AuthContext.tsx
    │
    ├─→ NotificationProvider (✅ NEW)
    │   └─→ src/context/NotificationContext.tsx (✅ NEW)
    │       └─→ useNotificationService (✅ NEW)
    │           └─→ src/hooks/useNotificationService.ts
    │               ├─→ src/api/driver.ts (registerDeviceToken)
    │               ├─→ src/utils/notificationHandlers.ts (✅ NEW)
    │               │   └─→ react-native-notifee
    │               └─→ src/types/notifications.ts (✅ NEW)
    │
    ├─→ LocationProvider
    ├─→ SosProvider
    └─→ AppNavigator
        └─→ ActiveJobsScreen
            ├─→ JobDetailsScreen
            └─→ (receives jobId from notification)
```

---

## 🔗 Data Flow: New Ride Notification

```
Backend Event: New Ride Assigned to Driver
        ↓
Backend Code:
    jobId = "job_12345"
    driverId = "driver_abc"
    job = getJob(jobId)

    Send FCM Message:
    {
        token: getDeviceToken(driverId),
        notification: {
            title: "New Ride Assigned",
            body: `Pick up ${job.passengerName}`
        },
        data: {
            notificationType: "NEW_RIDE",
            jobId: jobId,
            jobReference: "LIM-001",
            passengerName: "John Doe",
            pickupAddress: "123 Main St",
            dropoffAddress: "456 Park Ave",
            estimatedFare: "25.50",
            estimatedDuration: "15"
        }
    }
        ↓
Firebase Cloud Messaging
        ↓
Device Receives Message
        ↓
App Processes (useNotificationService)
        ↓
displayNotification() Calls:
    - notifee.displayNotification()
    - Shows: "New Ride Assigned - Pick up John Doe"
    - Color: Gold (#FFB800)
    - Sound: Default plays
    - Vibration: Double pulse triggered
        ↓
User Sees Notification
        ↓
User Taps Notification
        ↓
onNotificationOpenedApp Handler:
    notificationType = data.notificationType → "NEW_RIDE"
    jobId = data.jobId → "job_12345"

    navigation.navigate("ActiveJobsTab", {
        jobId: "job_12345",
        openDetails: true
    })
        ↓
App Navigates to:
    ActiveJobsScreen → JobDetailsScreen
        ↓
Screen Receives jobId as Route Param
        ↓
Screen Fetches Job Details:
    GET /api/jobs/job_12345
        ↓
Screen Displays:
    ✅ Passenger: John Doe
    ✅ Pickup: 123 Main St
    ✅ Dropoff: 456 Park Ave
    ✅ Fare: $25.50
    ✅ Duration: ~15 minutes
    ✅ Accept/Reject buttons
```

---

## 🛠️ Technology Stack

```
┌──────────────────────────────────────┐
│    FRONTEND (Mobile App)             │
├──────────────────────────────────────┤
│                                      │
│  React Native 0.81.5                 │
│  ├─ Expo 54.0.27                     │
│  ├─ React 19.1.0                     │
│  └─ TypeScript 5.9.3                 │
│                                      │
│  @react-native-firebase/app@19.0.0   │
│  @react-native-firebase/messaging    │
│  react-native-notifee@7.8.0          │
│                                      │
└──────────────────────────────────────┘
          ↓ (API Calls)
┌──────────────────────────────────────┐
│    BACKEND (Your Server)             │
├──────────────────────────────────────┤
│                                      │
│  Node.js / Express / TypeScript      │
│  Firebase Admin SDK                  │
│  Database (PostgreSQL/MongoDB)       │
│                                      │
└──────────────────────────────────────┘
          ↓ (Sends FCM)
┌──────────────────────────────────────┐
│    FIREBASE CLOUD MESSAGING          │
├──────────────────────────────────────┤
│                                      │
│  Google Firebase Service             │
│  Routes messages to devices          │
│  Handles reliability & delivery      │
│                                      │
└──────────────────────────────────────┘
          ↓ (Delivers)
┌──────────────────────────────────────┐
│    ANDROID DEVICE                    │
├──────────────────────────────────────┤
│                                      │
│  API 26+ (Android 8.0+)              │
│  Notification Channels               │
│  System Notification Tray            │
│  Vibration Motor                     │
│  Audio System                        │
│                                      │
└──────────────────────────────────────┘
```

---

## 📈 Implementation Phases

```
PHASE 1: SETUP (Days 1-2)
├─ Create Firebase Project
├─ Register Android App
├─ Download google-services.json
├─ Add to android/app/
└─ Run: npm install

PHASE 2: CODE (Day 3)
├─ ✅ src/types/notifications.ts
├─ ✅ src/hooks/useNotificationService.ts
├─ ✅ src/utils/notificationHandlers.ts
├─ ✅ src/context/NotificationContext.tsx
├─ ✅ Updated src/api/driver.ts
├─ ✅ Updated App.tsx
├─ ✅ Updated package.json
├─ ✅ Updated android/build.gradle
└─ ✅ Updated android/app/build.gradle

PHASE 3: BACKEND (Days 4-6)
├─ Implement /notifications/register-device
├─ Set up device token storage
├─ Create notification service
├─ Configure Firebase Admin SDK
└─ Test endpoint

PHASE 4: TESTING (Days 7-8)
├─ Verify token registration
├─ Test each notification type
├─ Test all app states
├─ Load testing
└─ QA sign-off

PHASE 5: LAUNCH (Day 9+)
├─ Production Firebase setup
├─ Release to Play Store
├─ Monitor metrics
└─ Support team training
```

---

## ✅ Verification Checkpoints

```
✓ Code Compilation
  └─ No TypeScript errors
  └─ All imports resolved

✓ Dependencies
  └─ Firebase packages installed
  └─ Notifee installed
  └─ Android SDK configured

✓ Token Registration
  └─ FCM token obtained on login
  └─ Token sent to backend
  └─ Backend stores token

✓ Notification Delivery
  └─ Message received by device
  └─ Notification displayed
  └─ Sound plays
  └─ Vibration works

✓ Navigation
  └─ Tap opens correct screen
  └─ Job data populated
  └─ No crashes

✓ States
  └─ Foreground state works
  └─ Background state works
  └─ Killed state works

✓ Production Ready
  └─ Error handling complete
  └─ Logging enabled
  └─ Memory optimized
  └─ Security verified
```

---

**Visual diagrams and architecture complete!** 🎉
