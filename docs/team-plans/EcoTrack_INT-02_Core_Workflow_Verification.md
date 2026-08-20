# EcoTrack INT-02 Core Workflow Verification

Date: 21 August 2026  
Branch: `feature/cross-feature_workflow_verification`  
Base: `origin/main` at `1a0808c` (INT-01 merged)

## Result

INT-02 now has an automated release-verification layer across the clean PostGIS database, backend APIs, web navigation contracts, Android navigation contracts, and Docker composition. No new business feature or database migration was introduced.

The automated scope passes. GitHub Actions and signed-in manual browser/Android walkthroughs remain external acceptance items and must not be reported as passed until they are actually observed.

## Backend cross-feature workflow

`backend/src/modules/incidents/incident.integration.test.ts` now mounts the real notification, reward, and dashboard routers alongside the existing real incident and cleanup-event routers. Its INT-02 scenario exercises the actual middleware, controllers, use cases/services, repositories, Prisma client, PostgreSQL constraints, and PostGIS queries.

The scenario proves:

1. A citizen reports one shared incident and an identical retry creates no duplicate.
2. Overlapping Organizations A and B receive legitimate access to the same incident.
3. Each organization keeps an independent review and private notes.
4. A VALID review creates the reporter reward and notification once.
5. Organization B creates a linked draft, session, and coordinator.
6. Publishing claims the incident and is idempotent.
7. A volunteer joins the event.
8. Cancellation is idempotent, notifies the participant, releases the claim, and restores the incident.
9. A replacement event publishes, the volunteer joins, and the organization allocates and confirms attendance.
10. AFTER evidence and required event/session transitions satisfy completion readiness.
11. Completion resolves the incident and creates history, audit, rewards, and notifications exactly once.
12. Reporter-visible history is `ACTIVE -> CLEANUP_ORGANIZED -> ACTIVE -> CLEANUP_ORGANIZED -> RESOLVED`.
13. The notification inbox exposes safe cancellation/completion destinations without private fields.
14. Reward history contains the verified-report and completed-event contributions.
15. The citizen dashboard reports the resolved incident, unread notifications, and contribution totals.
16. Organization B's dashboard reports its VALID review plus CANCELLED and COMPLETED events.
17. An Organization A actor receives `403` when requesting Organization B's dashboard directly.

Existing provider scenarios continue to prove direct events, DRAFT-not-claiming behavior, concurrent publication with one winner and one stable `409`, cross-event allocation rejection, private contact projections, RLS, partial indexes, and direct-ID tenant isolation.

## Web client parity

`web/src/app/clientParity.test.ts` verifies:

- Every completed citizen and organization destination is recognized by production navigation.
- Incident, event, membership, organization-review, and achievement notifications resolve to real screens.
- Organization incident notifications require the exact active organization membership.
- Missing event identifiers and GENERAL notifications do not create unsafe navigation.
- All organization workspace tabs, including incident discovery, event drafts, event operations, and membership administration, remain reachable.

The existing web map, incident, participant-operation, dashboard, browser-history, loading/error, and lazy-route tests remain part of the complete suite.

## Android client parity

`mobile/src/app/clientParity.test.ts` verifies:

- Every completed mobile destination has a deterministic Android back destination.
- Nested organization destinations return to the exact organization overview rather than another tenant or the first membership.
- Android notification destinations match the web/API meaning for incidents, events, membership, organization review, and achievements.
- Cross-tenant organization notification metadata and incomplete event metadata are rejected.

The existing Android tests continue to cover GPS permission behavior, manual location selection, weak-network retry, map privacy, incident history, dashboards, and API error/session rules.

## Clean-database evidence

A temporary local database named `ecotrack_int02_verification` was created inside the isolated Docker PostGIS service. It was configured with the Supabase-compatible `extensions` schema and backend-only roles.

All 18 migrations deployed from an empty database. Prisma then reported:

- schema valid;
- 18 migrations found;
- database schema up to date.

Supabase was not modified.

## Automated verification results

### Backend

- Full clean-database test suite: **148/148 passed**.
- Focused incident/cross-feature suite: **10/10 passed**.
- TypeScript typecheck: passed.
- Production build: passed.
- Prisma validate: passed.
- Prisma migrate status: up to date.

Expected Prisma constraint errors printed during rejection tests are evidence that invalid duplicate, cross-tenant, and cross-event writes were rejected; they were not test failures.

### Web

- Tests: **28/28 passed**.
- ESLint: passed.
- Production build: passed.
- Completed features remain route-level lazy-loaded.
- No Vite chunk-size warning was emitted.

### Mobile

- Tests: **33/33 passed**.
- TypeScript typecheck: passed.
- Metro image-parser security safeguard: passed.
- Map privacy safeguard: passed.
- Expo Doctor: **21/21 passed**.
- Android JavaScript production export: passed (792 modules, Hermes bundle generated).

### Docker

- Local PostGIS database: healthy on host port 5433.
- Migration container: completed successfully.
- Backend: healthy on host port 5000.
- `GET /health`: HTTP 200 with `status: ok`.
- Web: healthy on host port 8080.
- Web root: HTTP 200.

## Manual acceptance still required

No Android device or emulator was connected during this verification. A signed-in browser session was also not controlled by the automated test runner. Complete these checks before marking manual acceptance passed.

### Web walkthrough

1. Sign in through the real Supabase magic link and verify the profile gate.
2. Report an incident and confirm it in My Reports and public discovery.
3. Switch to a covering organization and VALID-review the incident.
4. Create sessions/coordinators, publish a linked event, and verify public details.
5. Join through a citizen account and submit session availability.
6. Allocate the volunteer, record attendance, add evidence, and complete the event.
7. Verify the incident becomes RESOLVED and notifications, rewards, citizen dashboard, and organization dashboard update.
8. Verify browser back navigation and organization switching preserve the selected tenant.
9. Sign out and confirm protected API failures return to sign-in without an expired-session error screen loop.

### Android walkthrough

1. Verify magic-link deep-link return and session restoration after restarting the app.
2. Verify accepted GPS permission and denied-permission/manual-pin reporting.
3. Attach incident evidence and submit the report.
4. Temporarily disconnect the network and verify the form/session survive retry.
5. Discover and join a published event, set availability, and view allocation updates.
6. Verify organization switching, notification navigation, rewards, and dashboard summaries.
7. Verify Android hardware back returns nested organization screens to the same organization's overview.

## CI status

The local equivalents of all GitHub Actions steps pass. `.github/workflows/ci.yml` now labels the web and mobile steps accurately as full test suites rather than map-only suites.

GitHub CI remains pending until this branch is committed and pushed. Record its result here or in the pull request before checking the CI acceptance box.

## Deliberate exclusions

The following remain deliberately outside INT-02:

- Expo push-token registration and actual push delivery;
- WebSockets;
- Redis/BullMQ deployment and background workers;
- full offline synchronization;
- advanced heatmaps/recommendations;
- multi-organization ownership of one cleanup event;
- payment, employment, donation, or volunteer-application workflows;
- machine-learning and IoT functionality.

In-app PostgreSQL notifications are included and verified.

## Files changed for INT-02

- `backend/src/modules/incidents/incident.integration.test.ts`
- `web/src/app/clientParity.test.ts`
- `mobile/src/app/clientParity.test.ts`
- `.github/workflows/ci.yml`
- `docs/team-plans/EcoTrack_ClickUp_Core_Feature_Backlog.md`
- `docs/team-plans/EcoTrack_INT-02_Core_Workflow_Verification.md`

No Prisma schema, migration, package manifest, lockfile, or production feature module changed.
