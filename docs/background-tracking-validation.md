# Background tracking release validation

The driver must use a newly installed native build. Expo Go does not support this flow. EAS excludes android/ios so Expo regenerates native permissions from app.json. Deploy the backend and admin/hotel changes before releasing the driver build; the new driver directions UI needs the authenticated maps endpoint and its steps response.

## Automated checks

- Driver: node --test scripts/tracking-regression.test.cjs
- Driver: node node_modules/typescript/lib/tsc.js --noEmit
- Driver: npx expo export --platform android --output-dir .expo-export-check
- Backend: pnpm --filter backend test -- driver-location.spec.ts geocoding.service.spec.ts
- Web: pnpm --filter web-admin build and pnpm --filter web-hotel build

These verify code and mocked OS/transport behavior, not actual device background delivery.

## Device acceptance test

1. Install the new native driver build, sign in, enable precise location and background access (Allow all the time / Always), and enable device location services.
2. Start travelling to pickup. Confirm the Android tracking notification or iOS location indicator appears. Open admin Monitoring and select this booking. Verify fresh server timestamps and the moving car.
3. Switch to another app, then lock the phone for at least five minutes while moving. Verify monitoring continues to receive captured timestamps and positions. Repeat during PICKED_UP. Opening a different booking screen must not stop tracking the active ride.
4. Disconnect mobile data briefly. Monitoring must show stale location after 30 seconds. Reconnect; a new fix must reach the server without logging out or moving backwards to an older queued fix. Repeat across an access-token refresh.
5. Complete, cancel, or reassign the ride from admin while the phone is locked. The next successful background upload receives trackingActive=false and stops the native task. Offline devices discover the change after reconnecting.
6. GPS updates alone must produce no requests to maps/directions or Google Directions/Routes. Tap Directions to Pickup/Drop: one requested route and written steps appear inside the driver app. Moving and hiding the app must not trigger repeated route requests. Admin and hotel Show/Refresh route buttons follow the same rule. An already accepted request can still complete and be billed.
7. Test Android removing the app from Recents separately from force-stop. Device manufacturers may kill services. Android force-stop and iOS swiping the app away cannot be promised to keep tracking; reopen the app to resume. Screen lock and ordinary background use are the supported scenario.

The route display provides a polyline and written steps. It does not provide voice navigation or automatic rerouting. Refresh the route explicitly when required. Map display/Places usage can still incur their own Google charges.

No physical device was connected during implementation, so the acceptance test remains required before claiming production background reliability.
