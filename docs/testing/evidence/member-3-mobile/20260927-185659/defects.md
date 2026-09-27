# Defects and blockers

## Device connection pending
ADB is installed but no device is currently detected. Physical cases remain NOT_RUN; this is an environment prerequisite, not a product defect.

Existing smoke HTTP 500 remains referenced in ../../2026-09-27-hosted-smoke/DEFECTS-AND-BLOCKERS.md; no new reproduction claimed.

## M3-DEF-001 — No visible feedback after camera permission denial
- Severity: Low (usability); status: observed, not fixed.
- Case: M02, attempt 01. Tester: Yasindu.
- Environment: Samsung SM-A236E, Android 14, EcoTrack 0.1.0/versionCode 1; exact EAS revision unverified.
- Preconditions: camera permission prompt displayed during Report an incident.
- Steps: tap Take photo; select Don't allow.
- Expected: clear denial feedback and guidance to enable camera access.
- Actual: returned to form; tester explicitly reports no denial message. Captured viewport also shows none.
- Frequency: one observed attempt; no repeated reproduction yet. Root cause unknown; off-screen feedback not ruled out.
- Evidence: screenshots/M02_attempt-01_camera-state.png and screenshots/M02_attempt-01_camera-denied.png.
- Workaround: retry and grant permission, or enable via Android Settings. Subsequent native camera opening observed in screenshots/M02_attempt-01_camera-recovery.png; exact recovery route not yet confirmed.
- Retest: pending; no application changes made.

## Device prerequisite update
Earlier device-connection blocker is resolved: authorized Samsung connected. Physical cases are progressing; earlier pending note describes initial setup only.
