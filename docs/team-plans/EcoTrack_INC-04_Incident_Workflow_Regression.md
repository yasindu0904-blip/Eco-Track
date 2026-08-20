# EcoTrack INC-04 Incident Workflow Regression Handoff

Date: 20 August 2026  
Branch: `INC-04`  
Owner: Member 2 / incident and map lane

## Scope and dependency audit

INC-04 was checked against `EcoTrack_ClickUp_Core_Feature_Backlog.md` and the
current source-of-truth documents before implementation.

Available provider contracts on this branch:

- INC-01 reporting, evidence metadata, deadlines, own reports, and submission
  idempotency.
- INC-02 spatial discovery, boundary-inclusive coverage, overlap, and public
  false counts.
- INC-03 tenant-private organization review, reporter notifications, and the
  idempotent verified-report contribution.
- EVT-03 linked-event publication and atomic incident claim.
- NOT-01 notifications and REW-01 rewards.
- MAP-03 spatial/privacy regression coverage.

Unavailable provider contract:

- EVT-06 owns event cancellation, completion, evidence, operational lifecycle,
  claim release, and linked-incident resolution. No EVT-06 branch, route, use
  case, or commit is present locally. INC-04 therefore does not implement those
  event-owned operations. Cancellation/completion acceptance remains gated on
  EVT-06 being merged.

## Backend real-API regression

The incident integration app mounts the real incident and cleanup-event routers
with the normal authentication, profile, tenant, ability, record-authorization,
controller, service/use-case, repository, Prisma, PostgreSQL, and PostGIS path.

The stitched INC-04 scenario verifies:

1. A citizen submits one shared incident and a retry returns the same record.
2. The incident has one initial ACTIVE history row and stored deadlines derived
   from `PlatformSettings` (48 highlight hours plus 7 unaddressed days).
3. The overlap point is available to Organization A and Organization B as the
   same incident ID.
4. Both organizations retain one independent current review and separate
   private notes.
5. Two FALSE reviews produce a public count of two without changing ACTIVE.
6. Organization B changes its existing FALSE row to VALID; the public count
   becomes one and Organization A's FALSE row remains unchanged.
7. Retrying VALID creates no duplicate review, reporter notification, or
   verified-report contribution.
8. Organization B creates and publishes a real linked event after its VALID
   review.
9. Publication changes the incident to CLEANUP_ORGANIZED exactly once and adds
   one incident history, event history, and reporter EVENT_PUBLISHED
   notification.
10. Retrying publication succeeds idempotently without duplicate side effects.
11. Reporter, public, organization, and Super Admin projections remain within
    their privacy boundaries; altered-tenant direct IDs are rejected.

Provider suites continue to cover DRAFT-not-claiming behavior and simultaneous
Organization A/Organization B publication, with exactly one winner and one
stable 409 conflict.

## Web regression evidence

Automated web scenarios verify:

- My Reports reloads CLEANUP_ORGANIZED and the complete reporter-visible
  ACTIVE -> CLEANUP_ORGANIZED history.
- Citizen discovery renders the same organized-status meaning and public false
  count.
- Incident UI output contains no organization private-note fields.
- A recoverable report-list/network error leaves the valid session signed in.
- Existing citizen, organization, and Super Admin map scenarios remain green.

An interactive signed-in browser smoke was attempted after starting the real
backend on port 5000 and Vite on port 5173. No in-app or external browser was
connected to this Codex session, so an interactive browser result is not
claimed. The real HTTP/API journey is covered by the backend integration test;
the signed-in UI walkthrough remains a manual handoff item.

## Android/mobile regression evidence

Automated mobile scenarios verify:

- Weak-network submission failure preserves the form and reuses the same
  `submissionId` on retry.
- Manual pin confirmation and the retried payload preserve coordinates.
- My Reports reloads CLEANUP_ORGANIZED and reporter-visible status history.
- Nearby/location discovery, bounded viewport behavior, map/list selection,
  foreground refresh, and weak-network retry remain green.
- Network, authorization, and conflict errors do not request sign-out; only a
  401 authentication failure does.
- Citizen output contains no organization private-note fields.

No Android SDK `adb` command is available in this environment, so a physical
device/emulator GPS, image-picker/upload, and offline-network walkthrough is not
claimed. That device-only smoke remains a manual handoff item.

## ClickUp acceptance status

| INC-04 acceptance item | Status | Evidence |
|---|---|---|
| Full incident lifecycle regression passes | Blocked by EVT-06 | Report through linked publication passes; cancel/complete provider routes are absent. |
| Overlap, boundary visibility, independent review, and false-count behavior remain correct | Pass | Incident and spatial integration suites. |
| Publish/cancel/complete produces correct state without duplicate history, rewards, or notifications | Partial | Publish and retry pass; cancel/complete require EVT-06. |
| Direct-ID attacks and private-field projection tests pass | Pass | Incident, MAP-03, web, and mobile regressions. |
| Web and Android smoke-test results using real APIs are documented | Partial | Real API automated evidence is documented; interactive browser/device smoke could not be executed in this environment. |
| Changes remain in the incident/map lane unless shared changes are approved | Pass | No event production, shared composition, schema, migration, manifest, or lockfile changes. |

## Required continuation after EVT-06 merges

1. Rebase/create the continuation from the integration owner's latest merged
   branch containing EVT-06.
2. Extend the stitched regression through event cancellation and completion.
3. Verify cancellation returns a recent incident to ACTIVE or an elapsed
   incident to EXPIRED/UNADDRESSED according to stored deadlines, releases the
   claim, and permits a replacement publication.
4. Verify completion atomically changes the linked incident to RESOLVED and
   creates exactly one history/audit/reward/notification set.
5. Run the signed-in web journey and Android GPS/manual-pin/evidence/weak-network
   journey on a connected browser and device, then replace the two manual
   limitations above with observed pass/fail evidence.

## Verification commands

Executed targeted checks:

```text
backend: npm run typecheck
backend: npm run build
backend: npx tsx --test --test-concurrency=1 src/modules/incidents/incident.integration.test.ts
web: npm test -- --run src/features/mapRoleScenarios.test.tsx src/features/incidents/IncidentPage.scenarios.test.tsx
web: npm run build
web: npm run lint
mobile: npm test -- --run src/features/incidents/CitizenIncidentDiscoveryScreen.scenarios.test.tsx src/features/incidents/IncidentWorkflow.scenarios.test.tsx src/api/apiError.test.ts
mobile: npm run typecheck
```

Observed targeted result: all commands passed. Backend incident integration
reported 9/9 passing tests, web targeted regression 10/10, and mobile targeted
regression 11/11. Vite reported only its existing large-chunk advisory.

Executed final repository recheck:

```text
backend: npm test
backend: npx prisma validate
backend: npx prisma migrate status
backend: npm run db:check
web: npm test
mobile: npm test
mobile: npm run security:check
mobile: npm run security:map
mobile: npm run doctor
root: git diff --check
```

Final results:

- Backend: 127/127 tests passed in the serialized full suite.
- Web: 14/14 tests passed; build and lint passed.
- Mobile: 22/22 tests passed; typecheck, both security checks, and all 21
  Expo Doctor checks passed.
- Prisma schema is valid, all 16 migrations are applied, and the database/
  PostGIS repository check succeeded.
- `git diff --check` reported no whitespace errors. Git only reported the
  repository's normal LF-to-CRLF working-copy advisory.
