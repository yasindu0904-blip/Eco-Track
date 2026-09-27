# Member 2 progress — 2026-09-27T15:05:57.626Z

Branch test-chirana; local and inspected deployed revision 4181db9c2dd455569aa872ce0c73541c8cd632ce. Existing initial smoke and earlier member run preserved by reference.

## Hosted API matrix A01?A14

Updated 2026-09-27T16:46:28.5829052Z. API A01-A14: 14 unique cases attempted or partially attempted; 12 PASS (A01-A08, A10, A11, A13, A14), 1 FAIL (A09), 1 BLOCKED/incomplete (A12). A14 is an investigation pass, not a verified fix. A09 withdrawal failed twice.

## Isolated backend verification

B01–B05: 5 unique checks passed at latest attempt. All 20 migrations applied; Prisma generation, typecheck, build passed. Full test suite retest: 163 passed, 0 failed, 0 skipped. First suite attempt: 162 passed, 1 missing-evidence-file harness failure, retained separately. Do not count the retry as an extra unique case. Node 24 Docker runner, PostgreSQL 17/PostGIS 3.5, dedicated Redis 8.2; no hosted credentials in child environment. Auth/provider mocks are not live-provider evidence.

A13 supplemental SQL: 29 public application tables have RLS enabled with no anon/authenticated data privileges; direct role SELECTs denied. Invalid FK and duplicate primary-key writes rejected and rolled back with no residue. Prisma migration metadata excluded from application-table RLS assertions.

## Deployment and D01

Read-only Northflank inspection: API/worker each one configured instance and successful deployment at inspected revision. Container status, returned CPU/memory history and health-check configuration saved. These observations are not a coordinated performance window, restart-count proof, autoscaling evidence or multi-instance load-balancing demonstration.

D01 immediate failure is now supported by historical hosted logs: Prisma P2028 transaction-start timeout in createIncident at 12:35:06.984Z, time-correlated with SM16. No request ID was logged in retrieved lines. Underlying connection/resource cause remains unconfirmed; no corrective change verified; D01 OPEN.

## Performance preparation

JMeter 5.6.3 downloaded from Apache and SHA512 verified, installed under ignored tmp/member2-tools outside application dependencies. Plan and secret-free property template prepared; zero-user validation exited 0 with zero samples. P01 executed: see performance-results.md. Initial Java compatibility failure retained; compatible retries separate. Screenshot/restart-counter gaps remain; no SLA verdict.

## Setup and access gaps

Three authorized labeled test Auth identities created (org-a, org-b, volunteer); IDs recorded in fixtures.csv. Org-a, org-b and volunteer have completed application profiles. Two SQL-prepared test organizations each have their own active ORG_ADMIN membership and distinct official Kesbewa service area; volunteer remains independent. Passwords/sessions stay in ignored tmp; cleanup pending until hosted work completes. Supplied admin password sign-in returned invalid_credentials; no password reset attempted. Private backend/.env.test.local now connects to project zkiciluuktuzkidjaiaz using verify-full and downloaded Supabase root CA. Hosted target proven in A02. Working admin access remains pending.

Only member-owned local containers stopped after tests; retained for reuse. No purchases, deployments, shared-service restarts, scaling, queue clearing, or real-world messages. No phone delivery, camera, UI screenshot or failover claims.

## Human next actions

Arrange working admin sign-in; agree notification observation and short exclusive load window with teammates. No screenshot is needed for automated SQL/unit/API evidence. During later load run capture Northflank API/worker metrics at start/peak/end. Yasindu must capture actual phone notification and destination when jointly triggered.

## A04 update

All nine assertions/steps passed: upload intent and real Supabase signed upload, HTTP incident creation, detail retrieval, signed photo read with exact-byte comparison, idempotent replay, missing-file rejection, wrong-owner-path rejection and SQL persistence checks. Exactly one incident and one photo; stored PostGIS point X=79.94/Y=6.795; rejected submissions left no incident rows. Synthetic PNG only, not camera evidence. Incident/storage fixtures retained and recorded in fixtures.csv. Wrong-owner test used a synthetic non-owner UUID path, not an existing other user's file.

## A05?A07 update

A05 passed all radius expectations at 1000/2000/3000m for incidents and events using labeled 500/1500/2500/3500m fixtures and independently measured PostGIS distances. Resolved incident excluded. Pagination exhausted before ID assertions.

A06 passed owner positive control, Org A rejection from Org B draft list/detail, participants, operations and PATCH; anonymous/volunteer admin rejection; complete target event row unchanged after forbidden PATCH. Public published event read intentionally succeeded.

A07 passed both organizations' covered-incident and review-event ID assertions: own drafts visible, other-org drafts hidden, public direct/linked events visible only within viewer coverage; resolved and outside-area incidents excluded. Official imported geometries reused, no invented boundaries.

All organizations, memberships, service-area assignments and spatial incident/event fixtures were SQL setup, not API registration/approval/publication success. Some other-owner event fixtures deliberately sit inside the viewing organization's area to test visibility; this does not claim those fixtures passed publication authorization. Profile completion used API. Only M2 fixtures changed; IDs and setup queries retained. UI marker colors remain Member 1 coverage.

## A08–A11 and A13 execution update

A08 PASS: API draft create/update/delete; publication rejected before readiness with no persisted transition; incident validated, coordinator assigned, publication succeeded; second claim returned 409 with one published claimant and competing draft unchanged. Initial publication assertion used wrong response path; harness corrected without product changes.

A09 FAIL (M2-D02 OPEN): initial join and duplicate join passed, but withdrawal returned HTTP 500 twice; rejoin not executed. Participant remained JOINED/UNMARKED after failures. Continued independent checks: real scheduled start elapsed, attendance marked, participant note visible, BEFORE/AFTER storage uploads and evidence registered, missing readiness rejected, completion succeeded, incident resolved, history and past participation present, one reward and one EVENT_COMPLETED notification row confirmed. These later passes do not erase withdrawal failures. No SQL timestamp acceleration. All notification recipients were labeled synthetic test users without registered devices; no phone delivery claim.

A10 PASS: separate API-created incident/event cancelled with reason; incident ACTIVE and unresolved, returned by awaiting-cleanup query; one cancellation history row. A11 PASS: stale API version returned 409; DB state/version/history unchanged; fresh version succeeded once (shared cancellation execution with A10).

A13 PASS: hosted read-only audit matches 20 migrations, 29 application-table RLS/grant restrictions, PostGIS, 73 active GN divisions, settings/categories; direct SELECT as anon/authenticated denied. Invalid FK/duplicate writes remain isolated-DB-only evidence.

M2-D02 first failure server logs show P2028 expired transaction at commit: timeout 5000ms, elapsed 6196ms. Second withdrawal also returned HTTP 500. No application fix or service change made.

## A12 notification evidence

Authenticated volunteer inbox and stored EVENT_COMPLETED recipient/content matched (PASS subcheck). Worker-health admin access remains pending. Registered-device and delivery counts are saved in requests/A12_attempt-01_inbox-and-delivery.json; no provider acceptance, receipt or physical phone display is claimed. Reused the API completion from A09 without sending another notification.


A14 investigation finalized: see logs/A14-investigation-conclusion.md. The successful controlled A04 repeat (HTTP 201, 5926ms) is reused by reference. D01 remains OPEN; underlying cause and corrective change unverified.


Worker health HTTP 200: online=true, waiting=0, failed=0. Authorized temporary M2 role restored to USER. A12 remains incomplete only for physical push/provider evidence. JMeter baseline executed; see performance-results.md for measurements and tooling failure versus retry. P01 remains BLOCKED for full guide coverage pending human screenshots and exact restart/OOM observations; HTTP measurements are reported separately.

Screenshot update: Six user-supplied JMeter chart screenshots in screenshots/ss/ were visually reviewed and indexed. They show response times, percentiles, active threads, bytes throughput, latency and connection time. They do not show the Statistics or Errors tables. Those table screenshots and Northflank/phone evidence remain outstanding. Duplicate copies under tools/ss are not additional observations.


Verified Statistics screenshot: screenshots/P01-jmeter-summary.png (unaltered copy of screenshots/ss/Screenshot 2026-09-27 225427.png). Shows 82 samples, 0 failures, 0.00% errors, average 1442.73ms, median 1302.50ms, p95 2183.25ms, p99/max 3264ms, throughput 0.71 transactions/s. Use these JMeter dashboard statistics when captioning this screenshot. Earlier runner numbers use nearest-rank percentiles (p95 2162ms) and configured-duration throughput (82/120 = 0.6833/s); they are separate calculations, not additional executions. The Statistics screenshot requirement is satisfied; separate Errors-table, historical Northflank screenshots and real phone evidence are still absent. No test verdict changed.
