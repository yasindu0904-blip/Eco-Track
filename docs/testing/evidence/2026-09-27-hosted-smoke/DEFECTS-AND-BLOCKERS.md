# Defects and blockers
## D01 ? Initial incident submission returned HTTP 500 (High; open/intermittent)
At 2026-09-27T12:35:06.530Z the hosted POST /api/v1/incidents returned INTERNAL_SERVER_ERROR after successful signed photo upload.
Evidence: SM14.json, SM15.json, SM16.json. The failed attempt did not persist an incident.
The second hosted run passed creation, idempotent replay, retrieval, photo download and spatial persistence (retest/SM16?SM20).
No application fix was applied. Do not mark this defect fixed just because the retest passed.
Local diagnostic: cold repository connection returned Prisma P2028 (transaction could not start); after SELECT 1 the same repository write succeeded. This is a hypothesis for the hosted failure, NOT a confirmed root cause. Obtain Northflank server logs.

## B01 ? GN reference data initially absent (resolved for Kesbewa smoke scope)
SM01 showed zero administrative_areas. GN search returns HTTP 200 with an empty result: transport works, but usable coverage data is missing.
At the initial pass these flows were blocked. Consult lifecycle/ and lifecycle-retest/ for the subsequent executed checks.
Follow-up: imported 73 official Kesbewa GN divisions using the repository NSDI importer. See GN-import.txt and lifecycle/L01.json. Synthetic organizations with official boundaries were prepared directly in SQL; subsequent lifecycle evidence supersedes the initial blocker for the exercised flows. Registration/approval UI and full spatial-filter regression remain untested.

## B02 ? Physical device and email delivery evidence pending
No Android camera/gallery/permissions/offline/push-receipt tests were executed from this workstation.
A live worker heartbeat confirms Redis reachability and recent worker activity, not delivery to a phone.
Browser authentication uses a real session injected for a confirmed synthetic user; email magic-link delivery remains manual.

## R01 ? Redis queue isolation caveat (source inspection, not a runtime smoke failure)
Earlier guidance said REDIS_KEY_PREFIX separates notification queues. In the inspected local source it prefixes cache/heartbeat keys only.
backend/src/queues/notification.queue.ts uses the fixed ecotrack-notifications queue without a custom BullMQ prefix; worker health reads fixed bull queue keys.
Do not assume that changing REDIS_KEY_PREFIX gives independent production/test queues. No queue was purged or changed by this run.
The deployed commit has not been verified. Use a separate Redis instance or implement/verify queue namespacing before running production and test workers concurrently.

## Harness issues (not product defects)
See harness-notes.md. Initial role restoration used CITIZEN instead of USER; this was corrected on the synthetic profile and in the retest.
Early browser screenshots captured loading states; use browser/verified for accepted evidence.

## Harness timestamp conflict ? not a production-write reproduction
The lifecycle fixture advanced starts_at and updated_at with SQL now(), producing microsecond precision. Completion sent JavaScript millisecond precision and received EVENT_STATE_CONFLICT. RT01 records both timestamps. The fixture precision was normalized for the retest; no application code was changed. The initial L22 response is retained.
