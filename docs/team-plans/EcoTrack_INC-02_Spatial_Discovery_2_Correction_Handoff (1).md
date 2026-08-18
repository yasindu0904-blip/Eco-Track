# EcoTrack INC-02 Spatial Discovery 2 — Correction Handoff

**Review date:** 2026-08-18  
**Reviewed branch:** `origin/feature/incident-spatial-discovery-2`  
**Reviewed commit:** `3a46fdf` (`inc-02`)  
**Integration baseline:** `origin/main` at `4449dff`  
**Task contract:** `INC-02 — Spatial incident discovery and covering-organization visibility`

## Review decision

Do **not** merge this branch into `main` yet.

The branch contains substantial and mostly sound INC-02 work. It has no predicted textual merge conflicts with the reviewed `main`, and its backend, web, and mobile static checks pass. However, it still has functional gaps, scalability concerns, unrelated changes, and verification work that must be resolved before INC-02 can be marked complete.

No new branch is required. Correct the issues on `feature/incident-spatial-discovery-2`, push additional commits, and let the Pull Request update automatically.

## What is already implemented correctly

The following work should be preserved while correcting the branch:

- Authenticated, bounded incident discovery by map viewport.
- Authenticated, bounded nearby discovery using PostGIS `ST_DWithin`.
- Strict viewport, radius, page-size, coordinate, and Sri Lanka range validation.
- Stable backend cursor ordering using `reported_at DESC, id DESC`.
- Parameterized Prisma raw SQL rather than interpolated user-provided SQL.
- Organization coverage using active organization and active service-area checks with `ST_Covers`.
- Support for both direct service-area boundaries and administrative-area reference boundaries.
- Retained organization access through that organization's existing review or linked cleanup event.
- Deduplication when multiple service polygons cover the same incident.
- Distinct public FALSE count from current active organizations.
- Minimal public and organization list projections without reporter contact information or private review notes.
- Citizen web and mobile viewport/nearby discovery screens.
- Map marker clustering, marker/list synchronization, request cancellation, and debounced viewport requests.
- Spatial query-plan evidence showing eligibility for the existing GiST indexes.
- Broad spatial, boundary, overlap, filtering, cursor, privacy, and cross-tenant test code.
- No Prisma schema or migration change in this branch.

## Required corrections before merge

### Blocker 1 — Complete organization cursor pagination in web and mobile

The organization discovery API returns `nextCursor`, but the organization web and mobile screens only record that more results exist. They do not provide a way to request and append the next page.

Current behavior can leave the user with text similar to:

```text
Showing the first 100 incidents in view
```

There is no usable `Load more` operation.

#### Required correction

- Keep the currently loaded cursor returned by the organization endpoint.
- Add a `Load more` action to the organization web screen.
- Add a `Load more` action to the organization mobile screen.
- Send the same viewport and active filters with the cursor.
- Append new items without duplicating existing incident IDs.
- Disable the action while the next page is loading.
- Clear pagination when the viewport or filters change.
- Preserve stable selection when appending records.
- Show retry feedback if a later page fails without deleting the already loaded page.

#### Acceptance checks

- Create more records than one page permits.
- Load the first page and every subsequent page.
- Confirm no incident is repeated or skipped.
- Confirm moving the map resets the old cursor.
- Confirm changing a filter resets the old cursor.

### Blocker 2 — Complete organization filters in web and mobile

The backend organization endpoint accepts:

```text
status
categoryId
reportedAfter
```

The organization web and mobile interfaces currently expose only `status`. Citizen discovery exposes the broader filter set, but organization discovery does not.

#### Required correction

- Add category filtering to organization web and mobile.
- Add a reported-time range to organization web and mobile.
- Use the existing incident-category endpoint instead of hard-coding categories.
- Send filters to PostgreSQL with every viewport request.
- Apply filters before pagination in the backend.
- Do not download a broad result and filter it only in React or React Native.
- Reset cursor pagination whenever a filter changes.

#### Acceptance checks

- Category filtering changes both markers and list results.
- Reported-time filtering changes both markers and list results.
- Combined status/category/time filters return the correct intersection.
- Network inspection shows filters in the organization API request.

### Blocker 3 — Bound and optimize organization service-area geometry

The current route is:

```http
GET /api/v1/organizations/:organizationId/service-area-boundaries
```

It returns every active organization service-area polygon as full GeoJSON. An organization can cover many GN Divisions, and detailed multipolygon geometry can create a large response, particularly for mobile users.

This conflicts with EcoTrack's low-bandwidth and bounded-map-response requirements.

#### Required correction

Choose and document a bounded display strategy. The recommended approach is:

- Require or accept the current map viewport.
- Return only organization service areas intersecting that viewport.
- Produce display geometry with a safe simplification strategy while retaining authoritative unsimplified geography for database coverage checks.
- Enforce a strict maximum number of returned features.
- Never use simplified client geometry for authorization or authoritative `ST_Covers` decisions.
- Keep tenant middleware and active-organization/service-area filters.

If the team chooses to load the organization's complete overlay once, prove with representative GN geometry that the maximum response remains safely bounded and document the measured payload size. Do not assume that 500 detailed GN polygons are a small response.

#### Acceptance checks

- Organization A receives only Organization A's permitted boundary overlay.
- An excessive or invalid viewport is rejected.
- The response cannot grow without a strict limit.
- Display simplification does not change backend incident-coverage authorization.
- Web and mobile render the bounded overlay correctly.

### Blocker 4 — Remove active-membership loading from every authentication request

The branch modifies the authentication profile query so every protected API request also loads all active organization memberships.

That means unrelated requests such as:

```http
GET /api/v1/notifications/unread-count
```

would perform additional membership and organization work. This makes the central authentication path heavier and couples INC-02 navigation to every backend request.

EcoTrack already provides the dedicated endpoint:

```http
GET /api/v1/organization-memberships/me/active
```

#### Required correction

- Restore the lightweight authentication/profile contract from current `main` unless a separately approved account-contract task changes it.
- Use `/organization-memberships/me/active` to populate the organization workspace switcher.
- Load memberships only when the user needs organization workspace context.
- Keep backend tenant middleware as the final authority for every selected organization.
- Do not trust memberships cached in the frontend as authorization evidence.
- Remove INC-02-only changes to auth repository tests/types/controllers when they are no longer needed.

#### Acceptance checks

- `/auth/me` retains its approved profile response contract.
- Citizen-only API calls do not query all memberships as part of authentication.
- The organization workspace still loads memberships from the dedicated endpoint.
- Direct Organization B URLs remain protected by backend tenant resolution.

### Blocker 5 — Remove unrelated completed-event reward history from INC-02

The branch adds functionality such as:

```http
GET /api/v1/rewards/me/completed-events
```

It also adds web and mobile `HistoricalReview` screens and changes reward repository, route, types, tests, and exports.

Completed cleanup-event reward history is not spatial incident discovery. Mixing it into INC-02 violates the one-task/one-branch rule and increases conflict risk with the rewards and event owners.

#### Required correction

Remove the following INC-02 branch work unless the integration owner creates a separate approved task and branch for it:

- `listMyCompletedCleanupEvents` controller/service/repository additions.
- `/rewards/me/completed-events` route.
- Completed-event history reward DTO additions.
- `HistoricalReviewPage` and `HistoricalReviewScreen`.
- Related Citizen dashboard buttons and shared application wiring.
- Related reward integration-test changes.

Do not delete the existing approved REW-01 functionality from `main`.

### Blocker 6 — Separate unrelated dependency and Android-build changes

The branch changes shared files including:

- `backend/package.json`
- `mobile/package.json`
- `mobile/package-lock.json`
- `mobile/app.json`
- `mobile/scripts/withShortAndroidCmakePath.cjs`

The Expo patch updates currently pass Expo Doctor, but package manifests, lockfiles, native configuration, and build plugins are shared files protected by the dependency/integration lock.

#### Required correction

- Remove package/native changes that are not required for INC-02 runtime behavior.
- If Expo patch alignment is needed, move it to a dedicated maintenance PR with the dependency lock.
- If the Windows CMake staging plugin is genuinely required, document the reproduced build failure, affected environments, generated Gradle change, cleanup behavior, and CI/non-Windows behavior in a separate reviewed task.
- Do not make a machine-specific Android workaround part of spatial discovery without explicit approval.

### Blocker 7 — Do not change the global test command inside INC-02 without approval

The branch changes the backend test script to:

```json
"test": "tsx --test --test-concurrency=1 \"src/**/*.test.ts\""
```

Serial execution may prevent database-fixture collisions, but it affects every backend test and CI duration. `backend/package.json` is integration-owned.

#### Required correction

Either:

- restore the current `main` test command in INC-02; or
- move test-runner serialization into a dedicated testing/CI task supported by a reproduced concurrency failure and measured CI duration.

INC-02-specific tests may be run serially with an explicit verification command without changing the global package script.

### Blocker 8 — Correct misleading review documentation

The branch's existing review document says the completed changes intentionally remain uncommitted, but they are present in commit `3a46fdf`.

#### Required correction

- Update the branch handoff document so it describes the actual committed branch state.
- Do not claim all application checks passed unless the latest commit was the commit tested.
- Do not claim interactive web/mobile checks passed unless they were performed.
- Separate historical audit notes from the final current decision clearly.

### Important naming cleanup — Discovery is not INC-03 review mutation

Components named `OrganizationIncidentReview` currently provide spatial discovery and display the organization's current review status, but they do not implement the INC-03 VIEWED/VALID/FALSE mutation workflow.

#### Recommended correction

Rename discovery-only components to names such as:

```text
OrganizationIncidentDiscovery
OrganizationIncidentMap
OrganizationIncidentQueue
```

This reduces collision and confusion when INC-03 introduces real review actions, reason codes, private notes, audit records, notifications, and rewards.

Displaying a privacy-safe `currentReviewStatus` summary may remain in INC-02. Review mutations must remain in INC-03.

## Verification status from integration review

The following checks were independently run against reviewed commit `3a46fdf` in a temporary clean worktree:

| Check | Result |
|---|---|
| Backend Prisma generation | Passed |
| Backend typecheck | Passed |
| Backend build | Passed |
| Web lint | Passed |
| Web production build | Passed with existing large-chunk warning |
| Mobile TypeScript | Passed |
| Mobile Metro image-security check | Passed |
| Expo Doctor | 21/21 passed |
| Map and incident validation tests | 14/14 passed |
| Predicted textual merge conflicts with reviewed `main` | None |

The full backend database suite was **not independently confirmed** during this review:

- Docker Desktop was stopped, so the isolated PostGIS database was unavailable.
- A run using the configured shared backend database produced no completed result and timed out after approximately 184 seconds.
- This timeout is not recorded as a failed assertion, but it also must not be reported as a successful test run.

The Vite production build reports a bundle larger than 500 kB. That warning is not an INC-02 merge blocker by itself; route/view-level lazy loading belongs to later integration optimization unless INC-02 introduces an avoidable duplicate dependency.

## Required automated tests

Preserve and pass tests proving:

- Viewport requests cannot become unbounded.
- Radius requests cannot exceed the configured maximum.
- Public results exclude reporter identity, email, phone number, submission ID, and private organization notes.
- Boundary points are included through `ST_Covers`.
- Multiple overlapping polygons do not duplicate one incident.
- Separate covering organizations each discover the same shared incident independently.
- Non-covering Organization B cannot access Organization A's private tenant view by changing an ID.
- Inactive organizations, service areas, and administrative areas do not grant current coverage.
- Existing organization review or linked-event relationships preserve legitimate historical access.
- FALSE count includes distinct current reviews from active organizations only.
- Category, status, and reported-time filters execute before pagination.
- Cursor pages do not skip or repeat incidents.
- Organization web/mobile pagination behavior has corresponding test coverage where the current test setup permits.

## Required manual checks

### Web

- Move and zoom the map and confirm requests are debounced.
- Confirm stale requests do not replace newer viewport results.
- Check marker clustering and marker/list selection synchronization.
- Test category, status, and time filters.
- Test Load more with more than one organization page.
- Verify current-location nearby search and permission failure behavior.
- Verify service-area overlays at representative organization sizes.
- Confirm loading, empty, error, retry, and refresh states.

### Android

- Repeat viewport, nearby, clustering, filter, selection, pagination, and retry checks on a physical device or emulator.
- Deny location permission and confirm the application remains usable.
- Confirm there is no continuous/background location tracking.
- Test weak/slow network behavior with already loaded results preserved.

## Correct branch workflow

Continue on the existing feature branch. Do not merge the incomplete branch into `main` and attempt to repair production history afterward.

```powershell
git fetch origin
git switch feature/incident-spatial-discovery-2
git pull --ff-only origin feature/incident-spatial-discovery-2
git status --short --branch
```

After making the corrections:

```powershell
git add <reviewed-inc-02-files>
git commit -m "fix: complete INC-02 spatial discovery review"
git push origin feature/incident-spatial-discovery-2
```

Do not use `git add .` without reviewing the changed-file list. Do not force-push, rewrite the teammate's branch history, restore a stash, or merge `main` through GitHub Desktop without checking the final diff.

## Verification commands before handoff

Start the isolated Docker/PostGIS environment from the repository root using the team's current Docker instructions. Then run:

```powershell
cd backend
npx prisma generate
npm run typecheck
npm run build
npm test
```

These commands generate the Prisma client, verify backend TypeScript, create the backend production build, and execute the complete backend test suite.

```powershell
cd ..\web
npm run lint
npm run build
```

These commands check web code quality and create the production web bundle.

```powershell
cd ..\mobile
npm run typecheck
npm run security:check
npm run doctor
```

These commands check mobile TypeScript, enforce the Metro image-parser safeguard, and verify Expo package/native compatibility.

## Final definition of done

INC-02 is ready to merge only when all of the following are true:

- [ ] Public viewport discovery is bounded, filtered, paginated, and privacy-safe.
- [ ] Public nearby discovery is bounded, filtered, paginated, and permission-safe.
- [ ] Organization discovery is tenant-verified, coverage-aware, filtered, and paginated.
- [ ] Organization web and mobile can load every cursor page.
- [ ] Organization web and mobile expose status, category, and reported-time filters.
- [ ] Organization boundary overlays have a documented, tested response bound.
- [ ] Authentication does not load memberships on every protected request for INC-02 navigation.
- [ ] Unrelated rewards/history work has been removed or moved to another approved branch.
- [ ] Unrelated package, CMake, and global test-runner changes have been removed or separately approved.
- [ ] Review documentation matches the actual latest commit.
- [ ] Full backend tests pass against an isolated PostGIS database.
- [ ] Backend typecheck/build pass.
- [ ] Web lint/build pass.
- [ ] Mobile typecheck/security/Expo Doctor pass.
- [ ] Web and Android manual discovery scenarios pass.
- [ ] The Pull Request diff contains only reviewed INC-02 and isolated integration wiring.
- [ ] CI passes on the final commit intended for merge.

