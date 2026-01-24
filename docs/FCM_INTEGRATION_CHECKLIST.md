# FCM Integration Checklist

A comprehensive checklist for implementing and verifying Firebase Cloud Messaging in the LIM Driver Mobile App.

## Phase 1: Firebase Setup

### Firebase Project Configuration

- [ ] Create Firebase project at https://console.firebase.google.com
- [ ] Enable Cloud Messaging in project settings
- [ ] Enable Cloud Firestore (if using for storage)
- [ ] Download Service Account key JSON file
- [ ] Store Service Account key securely on backend

### Android App Registration

- [ ] Register Android app in Firebase console
- [ ] Package name: `com.lim.driver`
- [ ] Generate SHA-1 certificate fingerprint:
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore
  ```
- [ ] Download `google-services.json`
- [ ] Place `google-services.json` in `android/app/` directory
- [ ] Verify file exists: `ls -la android/app/google-services.json`

### iOS Configuration (If Supporting iOS)

- [ ] Register iOS app in Firebase console
- [ ] Download `GoogleService-Info.plist`
- [ ] Add to iOS project in Xcode
- [ ] Configure APNs certificate in Firebase console

## Phase 2: Mobile App Code

### Dependencies Installed

- [ ] `@react-native-firebase/app` (~19.0.0)
- [ ] `@react-native-firebase/messaging` (~19.0.0)
- [ ] `react-native-notifee` (~7.8.0)
- [ ] `expo-secure-store` (already present)
- [ ] Run: `npm install`

### File Structure Created

- [ ] `src/types/notifications.ts` - Type definitions
- [ ] `src/hooks/useNotificationService.ts` - Service hook
- [ ] `src/utils/notificationHandlers.ts` - Utility functions
- [ ] `src/context/NotificationContext.tsx` - Provider context
- [ ] `src/api/driver.ts` - Updated with `registerDeviceToken`

### Android Configuration Updated

- [ ] `android/build.gradle` - Added Google Services plugin
- [ ] `android/app/build.gradle` - Applied Google Services plugin
- [ ] `android/app/src/main/AndroidManifest.xml` - Has required permissions:
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  ```

### App Integration

- [ ] `App.tsx` - Wrapped with `<NotificationProvider>`
- [ ] `NotificationProvider` placed inside `AuthProvider`
- [ ] `NotificationProvider` placed before `AppNavigator`

## Phase 3: Backend API

### Endpoint Implementation

- [ ] Implemented `POST /notifications/register-device`
- [ ] Endpoint requires JWT authentication
- [ ] Request validation in place
- [ ] Stores device token securely

### Request/Response Format

- [ ] Accepts:
  ```json
  {
    "token": "FCM_TOKEN_STRING",
    "platform": "android|ios",
    "role": "DRIVER"
  }
  ```
- [ ] Returns success response:
  ```json
  {
    "success": true,
    "message": "Device registered successfully"
  }
  ```

### Database Schema

- [ ] Device tokens table created with:
  - [ ] `id` (UUID, primary key)
  - [ ] `driver_id` (foreign key to drivers)
  - [ ] `fcm_token` (unique, indexed)
  - [ ] `platform` (android/ios)
  - [ ] `role` (DRIVER)
  - [ ] `is_active` (boolean)
  - [ ] `registered_at` (timestamp)
  - [ ] `expires_at` (timestamp)
  - [ ] `last_used_at` (timestamp)
- [ ] Notification logs table created (optional but recommended)
- [ ] Indexes created for efficient queries

### Notification Services

- [ ] `NotificationService` class/module created
- [ ] `RideNotificationService` class/module created
- [ ] Methods implemented:
  - [ ] `sendToDriver(driverId, payload)`
  - [ ] `notifyNewRide(jobId)`
  - [ ] `notifyRideCancelled(jobId, reason)`
  - [ ] `notifySOSAlert(sosId, driverId, message)`
- [ ] Error handling and logging in place

### Firebase Admin SDK Setup

- [ ] Firebase Admin SDK initialized
- [ ] Service account key loaded
- [ ] Messaging instance created
- [ ] Token validation before sending

## Phase 4: Integration Testing

### Local Testing

- [ ] Installed latest Android SDK
- [ ] `google-services.json` verified in build
- [ ] Built APK successfully: `npm run android`
- [ ] App installed on test device/emulator

### Token Registration Testing

- [ ] App started and user logged in
- [ ] Checked logcat for "FCM token obtained"
- [ ] Verified token format (long alphanumeric string)
- [ ] Confirmed "FCM token registered successfully" message
- [ ] Verified token stored in SecureStore
- [ ] Checked backend database for token entry

### Firebase Console Testing

- [ ] Logged into Firebase Console
- [ ] Selected correct project and app
- [ ] Found device token in testing interface
- [ ] Successfully sent test notification
- [ ] Notification appeared in device tray

### Foreground Notification Testing

- [ ] App open and in focus
- [ ] Sent NEW_RIDE notification
  - [ ] Notification displayed
  - [ ] Sound played
  - [ ] Vibration occurred (double pulse)
  - [ ] Correct title/body shown
- [ ] Sent RIDE_CANCELLED notification
  - [ ] Notification displayed
  - [ ] Different vibration pattern
- [ ] Sent SOS_MESSAGE notification
  - [ ] Red color indicator
  - [ ] Rapid vibration pattern

### Background State Testing

- [ ] Backgrounded app (but not killed)
- [ ] Sent notifications
- [ ] Notification appeared in tray
- [ ] Tapped notification
- [ ] App came to foreground
- [ ] Correct screen opened with proper data

### Killed State Testing

- [ ] Closed app completely
- [ ] Sent notification
- [ ] Notification appeared in tray
- [ ] Tapped notification
- [ ] App launched from scratch
- [ ] Navigated to correct screen with job data
- [ ] Job details displayed correctly

### Navigation Testing

- [ ] NEW_RIDE notification tap → Active Jobs + Job Details
- [ ] RIDE_CANCELLED notification tap → Active Jobs + Job Details
- [ ] SOS_MESSAGE notification tap → Active Jobs screen
- [ ] Job data populated correctly
- [ ] No crashes on navigation
- [ ] Screen state preserved

## Phase 5: Advanced Features

### Token Refresh Testing

- [ ] Uninstalled and reinstalled app
- [ ] New FCM token obtained
- [ ] Old token invalidated
- [ ] Notification sends to new token successfully
- [ ] Old token properly cleaned up

### Multiple Device Testing

- [ ] Same driver logged in on multiple devices
- [ ] Both devices registered with backend
- [ ] Notification sent to both devices
- [ ] Both received notification independently

### Error Handling

- [ ] Invalid token rejected
- [ ] Network errors handled gracefully
- [ ] Backend errors logged
- [ ] App continues functioning despite notification failures
- [ ] Retry logic working for transient failures

### Payload Validation

- [ ] Missing notificationType doesn't crash
- [ ] Missing jobId doesn't crash
- [ ] Extra fields in payload ignored
- [ ] Special characters in names handled
- [ ] Very long text truncated appropriately

## Phase 6: Production Preparation

### Code Review

- [ ] All TypeScript types correct
- [ ] No console.error that should be console.warn
- [ ] Proper error boundaries
- [ ] No memory leaks in hooks
- [ ] Cleanup functions in useEffect

### Performance

- [ ] App startup time not affected
- [ ] Message listeners properly unsubscribed
- [ ] No continuous polling or timers
- [ ] Token registration doesn't block UI
- [ ] Navigation responsive when opening from notification

### Security

- [ ] FCM tokens never logged in user-facing logs
- [ ] Backend validates JWT on every request
- [ ] Role-based access control enforced
- [ ] Token expiration handled
- [ ] google-services.json not committed to git
- [ ] Service account key stored securely

### Documentation

- [ ] [FCM_IMPLEMENTATION.md](FCM_IMPLEMENTATION.md) reviewed
- [ ] [BACKEND_FCM_SETUP.md](BACKEND_FCM_SETUP.md) reviewed
- [ ] [FCM_TESTING.md](FCM_TESTING.md) reviewed
- [ ] [FCM_PAYLOAD_EXAMPLES.md](FCM_PAYLOAD_EXAMPLES.md) reviewed
- [ ] Backend team has setup documentation
- [ ] Operational runbooks prepared

### Monitoring & Logging

- [ ] Notification sent/failed metrics tracked
- [ ] Error rates monitored
- [ ] FCM rate limits monitored
- [ ] Token registration failures logged
- [ ] Delivery confirmations tracked
- [ ] Analytics dashboard configured

## Phase 7: Launch Checklist

### Before Release

- [ ] Firebase quota limits verified
- [ ] Notification rate limiting configured
- [ ] Error handling tested under load
- [ ] Database backup configured
- [ ] Rollback plan documented
- [ ] Support team trained

### Release

- [ ] Build APK for release
- [ ] Sign APK with production key
- [ ] Test with production Firebase project
- [ ] Upload to Google Play Store
- [ ] Monitor metrics after release
- [ ] Support team on standby

### Post-Launch

- [ ] Monitor for crashes/errors
- [ ] Check notification delivery rates
- [ ] Verify no memory leaks over time
- [ ] Collect user feedback
- [ ] Document any issues/fixes
- [ ] Plan improvements for next release

## Phase 8: Ongoing Maintenance

### Regular Tasks

- [ ] [ ] Weekly: Monitor FCM delivery metrics
- [ ] [ ] Weekly: Check for invalid tokens to clean up
- [ ] [ ] Monthly: Review error logs
- [ ] [ ] Monthly: Update Firebase SDK if needed
- [ ] [ ] Quarterly: Load test notification service
- [ ] [ ] Yearly: Review security practices

### Monitoring Alerts

- [ ] Set up alert for high error rate (> 5%)
- [ ] Set up alert for quota exceeded
- [ ] Set up alert for invalid tokens (> 10% of active)
- [ ] Set up alert for slow registration (> 5s)
- [ ] Set up alert for backend endpoint timeouts

### Scaling Considerations

- [ ] Document max devices per driver
- [ ] Document max notifications per minute
- [ ] Plan for database growth
- [ ] Configure connection pooling
- [ ] Implement rate limiting
- [ ] Plan for multi-region deployment

## Troubleshooting Reference

### If FCM token not obtained:

1. [ ] Verify google-services.json in android/app/
2. [ ] Check `apply plugin: "com.google.gms.google-services"`
3. [ ] Verify Firebase project ID matches
4. [ ] Check internet connection
5. [ ] Clear app cache: `adb shell pm clear com.lim.driver`

### If notification doesn't appear:

1. [ ] Check notification permissions granted
2. [ ] Verify notification channel created
3. [ ] Check Do Not Disturb not enabled
4. [ ] Verify payload has title and body
5. [ ] Check logcat for errors

### If navigation wrong on tap:

1. [ ] Verify jobId in notification data
2. [ ] Check screen name in navigation
3. [ ] Verify params passed to screen
4. [ ] Check navigation stack structure
5. [ ] Test with hardcoded screen name

### If token registration fails:

1. [ ] Verify user is authenticated
2. [ ] Check auth token valid
3. [ ] Verify backend endpoint exists
4. [ ] Check network connectivity
5. [ ] Verify backend CORS configured

## Sign-Off

- [ ] Mobile Developer: Implementation complete
- [ ] Backend Developer: API & services complete
- [ ] QA Tester: All tests passed
- [ ] Product Manager: Feature approved
- [ ] DevOps: Infrastructure ready
- [ ] Documentation: Complete and reviewed

---

**Implementation Date**: ******\_\_\_******  
**Testing Completed**: ******\_\_\_******  
**Production Release**: ******\_\_\_******

**Notes**:

```
[Add any notes, issues, or special considerations here]
```

---

For detailed information on each section, refer to:

- [FCM_IMPLEMENTATION.md](FCM_IMPLEMENTATION.md)
- [BACKEND_FCM_SETUP.md](BACKEND_FCM_SETUP.md)
- [FCM_TESTING.md](FCM_TESTING.md)
