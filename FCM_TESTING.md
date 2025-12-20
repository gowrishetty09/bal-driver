# FCM Testing & Troubleshooting Guide

## Quick Start Testing

### 1. Setup Firebase Project

```bash
# Create Firebase project if not done
# 1. Go to https://console.firebase.google.com
# 2. Create new project
# 3. Add Android app (Package: com.lim.driver or your package name)
# 4. Download google-services.json
# 5. Place in android/app/google-services.json
```

### 2. Install Dependencies

```bash
# Install packages (already in package.json)
npm install

# Install native modules for Android
npx expo prebuild --clean

# Or if using EAS
eas build --platform android --local
```

### 3. Test Token Registration

**Step 1: Start the app**

```bash
npm run android
# or
expo run:android
```

**Step 2: Watch logs for FCM token**

```bash
adb logcat | grep -i "FCM"
```

**Expected output:**

```
I/RNFirebase: FCM token obtained: eEHVkQ3LR8WeSc7...
I/NotificationService: FCM token registered successfully with backend
```

### 4. Send Test Notification

**Option A: Firebase Console**

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select your project → Cloud Messaging
3. Click "Send your first message"
4. Fill in notification details:
   - **Title**: "New Ride Assigned"
   - **Body**: "Pick up John at Downtown Center"
   - **Additional options** → Add custom data:

     ```
     Key: notificationType
     Value: NEW_RIDE

     Key: jobId
     Value: test_job_123
     ```
5. Target → "Send test message"
6. Enter FCM token from logcat
7. Click "Test"

**Option B: Using curl**

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
        "body": "Pick up John at Downtown Center"
      },
      "data": {
        "notificationType": "NEW_RIDE",
        "jobId": "test_123",
        "jobReference": "LIM-001",
        "passengerName": "John Doe",
        "pickupAddress": "Downtown Center",
        "dropoffAddress": "Central Park",
        "estimatedFare": "25.50",
        "estimatedDuration": "15"
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

### 5. Verify Notification Appears

**Expected behavior:**

- ✅ Notification appears in system notification tray
- ✅ Sound plays
- ✅ Device vibrates with pattern: double pulse
- ✅ Notification can be tapped
- ✅ Tapping navigates to Active Jobs screen

## Advanced Testing

### Test Different Notification Types

#### New Ride (NEW_RIDE)

```json
{
  "message": {
    "token": "FCM_TOKEN",
    "notification": {
      "title": "🚗 New Ride Assigned",
      "body": "Pick up Sarah at Downtown Station"
    },
    "data": {
      "notificationType": "NEW_RIDE",
      "jobId": "job_001",
      "jobReference": "LIM-0001",
      "passengerName": "Sarah Johnson",
      "pickupAddress": "123 Main St, Downtown",
      "dropoffAddress": "456 Park Ave, Central",
      "estimatedFare": "28.50",
      "estimatedDuration": "18"
    },
    "android": {
      "priority": "high",
      "notification": {
        "sound": "default",
        "channel_id": "rides",
        "color": "#FFB800",
        "priority": "max"
      }
    }
  }
}
```

**Expected vibration pattern:** `[100, 100, 100, 100, 100, 100]` (double pulse)

#### Ride Cancelled (RIDE_CANCELLED)

```json
{
  "message": {
    "token": "FCM_TOKEN",
    "notification": {
      "title": "Ride Cancelled",
      "body": "Ride LIM-0001 has been cancelled by passenger"
    },
    "data": {
      "notificationType": "RIDE_CANCELLED",
      "jobId": "job_001",
      "jobReference": "LIM-0001",
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
}
```

**Expected vibration pattern:** `[150, 100, 150]` (medium single pulse)

#### SOS Alert (SOS_MESSAGE)

```json
{
  "message": {
    "token": "FCM_TOKEN",
    "notification": {
      "title": "🚨 SOS Alert",
      "body": "Emergency assistance requested"
    },
    "data": {
      "notificationType": "SOS_MESSAGE",
      "sosId": "sos_001",
      "driverId": "driver_123",
      "message": "Emergency assistance required - Check status"
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
}
```

**Expected vibration pattern:** `[50, 50, 50, 50, 50, 50, 50, 50]` (rapid pulses)

### Test Token Refresh

1. Get current FCM token from logcat
2. Wait 1 hour or trigger refresh:
   ```bash
   adb shell am broadcast -a com.google.android.c2dm.intent.REGISTRATION \
     -n com.lim.driver/com.google.android.gms.cloudmessaging.GoogleCloudMessagingReceiver
   ```
3. Verify new token appears in logcat
4. Old token should be updated with new token on backend

### Test Background/Killed State

**Test 1: App in background**

1. Send notification while app is backgrounded
2. Notification should appear in notification tray
3. Tap notification
4. App opens and navigates to appropriate screen

**Test 2: App killed**

1. Close app completely
2. Send notification
3. Notification should appear
4. Tap notification
5. App launches and navigates to appropriate screen

**Test 3: App not installed**

1. Uninstall app
2. Send notification (FCM queues it)
3. Reinstall app
4. Old notification won't appear (FCM timeout)

## Debugging with Logcat

### Filter FCM Logs

```bash
# All Firebase/FCM logs
adb logcat | grep -i "firebase\|fcm\|messaging\|notifee"

# Specific to notification service
adb logcat | grep "NotificationService"

# With timestamps
adb logcat -v threadtime | grep "FCM"

# Full output with errors
adb logcat E:E *:S | grep "FCM"

# Save to file
adb logcat > fcm_logs.txt
```

### Expected Log Sequence

```
I/RNFirebase: FCM token obtained: eEHVkQ3LR8WeSc7... [~5 sec after auth]
I/NotificationService: Notification channels initialized
I/NotificationService: FCM token registered successfully with backend
I/LayoutInflater: Token refresh listener activated
I/NotificationService: Foreground message received: {data: {...}}
I/NotificationService: Displayed NEW_RIDE notification
D/Notifee: Local notification displayed
D/RNFirebase: onNotificationOpenedApp called - navigating to ActiveJobsTab
```

### Common Log Messages

| Log                                                 | Meaning                           | Action                 |
| --------------------------------------------------- | --------------------------------- | ---------------------- |
| `FCM token obtained`                                | Token generated successfully      | ✅ Good                |
| `Token registered successfully`                     | Backend received token            | ✅ Good                |
| `Cannot register FCM token: user not authenticated` | Auth issue                        | Check auth flow        |
| `Failed to register FCM token`                      | Network/backend error             | Check backend endpoint |
| `Notification channels initialized`                 | Android setup complete            | ✅ Good                |
| `Foreground message received`                       | App in focus, message arrived     | ✅ Good                |
| `Background message received`                       | App backgrounded, message arrived | ✅ Good                |
| `Failed to display notification`                    | Notifee error                     | Check Notifee config   |

## Troubleshooting

### Issue: No FCM Token in Logs

**Symptoms:**

- Logcat doesn't show "FCM token obtained"
- Firebase initialization appears to hang

**Solutions:**

1. **Check google-services.json:**

   ```bash
   # Verify file exists
   ls -la android/app/google-services.json

   # Check content
   cat android/app/google-services.json
   ```

2. **Verify Firebase plugin applied:**

   ```gradle
   // android/app/build.gradle should have
   apply plugin: "com.google.gms.google-services"
   ```

3. **Check Android manifest permissions:**

   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   ```

4. **Clear cache and rebuild:**

   ```bash
   cd android
   ./gradlew clean
   cd ..
   npm run android -- --no-cache
   ```

5. **Check Firebase console:**
   - Verify Cloud Messaging is enabled
   - Check project ID matches google-services.json

### Issue: "User not authenticated" Error

**Symptoms:**

- Token obtained but registration fails
- Logs show: "Cannot register FCM token: user not authenticated"

**Solutions:**

1. **Verify authentication:**

   - Login successfully in app first
   - Check AuthContext shows isAuthenticated = true

2. **Check token availability:**

   ```typescript
   // In useAuth hook
   console.log("isAuthenticated:", isAuthenticated);
   console.log("token:", token);
   ```

3. **Verify API endpoint:**
   - Check `/notifications/register-device` exists on backend
   - Test endpoint with postman:

     ```
     POST http://backend/notifications/register-device
     Authorization: Bearer <TOKEN>
     Content-Type: application/json

     {
       "token": "FCM_TOKEN",
       "platform": "android",
       "role": "DRIVER"
     }
     ```

### Issue: Notification Not Appearing

**Symptoms:**

- FCM token registered
- No notification in tray
- Logs show token sent but not received

**Solutions:**

1. **Check notification channels:**

   ```typescript
   // Force reinitialize
   await initializeNotificationChannels();
   ```

2. **Verify notification permissions:**

   - Settings → App → Permissions → Notifications (enabled)
   - Or request at runtime:
     ```
     adb shell pm grant com.lim.driver android.permission.POST_NOTIFICATIONS
     ```

3. **Check FCM payload format:**

   - Ensure `notification.title` and `notification.body` present
   - Check data keys don't have special characters

4. **Debug notifee:**

   ```typescript
   notifee
     .displayNotification({
       title: "Test",
       body: "Debug test",
     })
     .then(() => console.log("Notification displayed"))
     .catch((e) => console.log("Error:", e));
   ```

5. **Check Do Not Disturb:**
   - Device may have DND enabled
   - Disable or add app to priority list

### Issue: Tap Not Opening Correct Screen

**Symptoms:**

- Notification appears and taps
- But wrong screen opens or crashes

**Solutions:**

1. **Check navigation setup:**

   ```typescript
   // Verify screen names in navigation
   const navAction = handleNotificationPress(data);
   console.log("Navigation action:", navAction);
   ```

2. **Verify data in notification:**

   ```json
   {
     "data": {
       "notificationType": "NEW_RIDE",
       "jobId": "valid_id_here"
     }
   }
   ```

3. **Check screen params:**

   ```typescript
   // ActiveJobsScreen should accept optional jobId param
   export type ActiveJobsStackParamList = {
     ActiveJobs: {
       jobId?: string;
       openDetails?: boolean;
     };
   };
   ```

4. **Debug navigation:**

   ```typescript
   // In notification handler
   console.log("Navigation ref:", navigation);
   console.log("Navigating to:", navAction);

   navigation.navigate(navAction.screen, navAction.params);
   ```

### Issue: Vibration Not Working

**Symptoms:**

- Notification appears with sound
- But device doesn't vibrate

**Solutions:**

1. **Check vibration settings:**

   - Settings → Sound & vibration (enabled)
   - Volume not muted

2. **Check permissions:**

   ```bash
   adb shell pm grant com.lim.driver android.permission.VIBRATE
   ```

3. **Verify vibration code:**

   ```typescript
   // Test directly
   Vibration.vibrate([100, 100, 100], false);
   ```

4. **Check device support:**
   - Not all devices have vibration motor
   - Test on different device

### Issue: Sound Not Playing

**Symptoms:**

- Notification appears
- No sound, even with volume on
- Vibration works

**Solutions:**

1. **Check system volume:**

   - Ensure media/notification volume is up
   - Not in silent mode

2. **Verify channel configuration:**

   ```typescript
   // Channel should have sound enabled
   await notifee.createChannel({
     id: "rides",
     sound: "default", // ✅ This is correct
     vibration: true,
   });
   ```

3. **Check Android notification settings:**

   - Settings → Apps → LIM Driver → Notifications
   - Ensure sound enabled

4. **Test system sounds:**
   ```bash
   adb shell am start -a android.intent.action.RINGTONE_PICKER
   ```

## Performance Testing

### Load Testing

```typescript
// Test sending 100 notifications rapidly
async function loadTest() {
    const tokens = ['token1', 'token2', ...]; // 100 tokens
    const startTime = Date.now();

    const promises = tokens.map(token =>
        messaging().send({
            token,
            notification: { title: 'Test', body: 'Load test' },
            data: { notificationType: 'NEW_RIDE' },
        })
    );

    const results = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Sent ${successful}/${results.length} in ${duration}ms`);
    console.log(`Failed: ${failed}`);
    console.log(`Rate: ${(successful / duration * 1000).toFixed(0)} msgs/sec`);
}
```

### Battery Impact Testing

1. Install app with FCM
2. Check battery usage:
   ```bash
   adb shell dumpsys batterystats | grep "YOUR_PACKAGE"
   ```
3. Monitor with Android Studio Profiler
4. FCM should have minimal battery impact

## Verification Checklist

- [ ] `google-services.json` placed in `android/app/`
- [ ] Firebase Cloud Messaging enabled in console
- [ ] FCM token obtained and logged
- [ ] Token registered with backend successfully
- [ ] Test notification received with correct title/body
- [ ] Sound plays on notification arrival
- [ ] Vibration pattern matches notification type
- [ ] Notification appears in system tray
- [ ] Tap opens correct screen
- [ ] Navigation params contain correct job/SOS data
- [ ] Works in foreground, background, and killed states
- [ ] Token refresh works after app update
- [ ] Multiple tokens per driver work correctly
- [ ] Payload validation prevents crashes
- [ ] Logging shows all expected messages

## Contact & Support

For issues related to FCM implementation:

1. Check [FCM_IMPLEMENTATION.md](./FCM_IMPLEMENTATION.md)
2. Check [BACKEND_FCM_SETUP.md](./BACKEND_FCM_SETUP.md)
3. Review Firebase Admin SDK docs: https://firebase.google.com/docs/messaging
4. Check React Native Firebase docs: https://rnfirebase.io/messaging/usage
