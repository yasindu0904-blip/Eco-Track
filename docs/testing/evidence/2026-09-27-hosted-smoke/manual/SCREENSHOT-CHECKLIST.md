# Remaining manual evidence
Save screenshots in this folder using the filenames below. Do not mark tests passed until actually observed.
For each test fill execution-record.csv: tester, local timestamp, device/model, Android version, app version/build, result and notes.
Do not capture passwords, tokens, database URLs, or another person's private information.

| ID | Screenshot filename | Action and required evidence |
|---|---|---|
| M01 | M01-android-login.png | Sign in on the installed APK using a real test account. Show the dashboard after successful login. Record whether magic-link receipt/opening worked. |
| M02 | M02-incident-camera.png | Report incident, grant camera permission, take a photo. Show preview and removal control; check no photo ID is displayed. |
| M03 | M03-incident-saved.png | Complete and submit the report; show saved report detail with photo and location. Record any error and retry separately. |
| M04 | M04-nearby-map.png | Open Find cleanup activity, allow location, select Awaiting cleanup and a test incident. Show incident details and no-cleanup message. Test radius choices 1, 2, 3 km. |
| M05 | M05-android-notification.png | Trigger a real test notification for that signed-in user, put app in background, and capture the Android notification. Also save M05-notification-opened.png after tapping it. Record trigger and receipt times. |
| M06 | M06-event-evidence-camera.png | Using your own test organization and event: manage ongoing cleanup, use Take photo, upload evidence and show saved preview. |
| M07 | M07-worker-logs.png | Northflank notification service fresh logs, with timestamps after the test action. No startup-only claim of delivery. |
| M08 | M08-backend-error.png | Northflank Eco-Track log around 2026-09-27 12:35:02?12:35:07 UTC (18:05:02?18:05:07 Sri Lanka). Capture error accompanying initial HTTP 500. |
| M09 | M09-org-event-lifecycle.png | Kesbewa GN data is now available: apply/approve organization, draft/publish event, volunteer join/attendance, add evidence and complete or cancel. Use separate screenshots for each stage. Two organizations required for isolation/coverage checks. |

Device screenshots are still needed for Android. Hosted browser screenshots are already in browser/verified.
M06/M09 still require human execution. 73 Kesbewa GN divisions are now available. Synthetic automation Auth identities were deleted; use your own test accounts. Do not mark empty lists as proof of lifecycle correctness.
Magic-link delivery is not covered by automated session setup.
