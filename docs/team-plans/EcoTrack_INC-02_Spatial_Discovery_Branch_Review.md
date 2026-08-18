# INC-02 Spatial Discovery Branch Review and Completion Handoff

Audit date: 2026-08-17  
Task owner: Member 2  
Reviewed branch: `origin/feature/incident-spatial-discovery`  
Current integration baseline: `origin/main` at `ae6fcc2`

## Implementation update (2026-08-18)

The original branch reviewed below has now been merged into
`feature/incident-spatial-discovery-2`, with a recovery branch retained at
`backup/incident-spatial-discovery-2-before-merge-20260818`.

The following original blockers are now implemented in the working tree:

- authenticated public/citizen bounding-box discovery;
- explicit foreground-permission "near me" discovery using `ST_DWithin`;
- removal of the production `scope=all` path;
- bounded, paginated viewport requests from organization web and mobile clients;
- server-side category, status, and reported-after filtering;
- citizen "Find cleanup activity" destinations in web and mobile, including
  marker/list synchronization, selected public-safe detail, pagination,
  refresh/retry, and loading/error/empty states;
- a citizen "Historical review" dashboard box and web/mobile screens showing
  the verified successfully-concluded cleanup-event count and event names;
- retained organization access through that tenant's own incident review or
  linked cleanup event after current service-area coverage changes;
- the full two-organization overlap, boundary, inactive-area/organization,
  direct-ID, privacy, server-filter, FALSE-count, and stable-cursor matrix;
- representative `EXPLAIN (ANALYZE, BUFFERS)` evidence in
  `EcoTrack_INC-02_Spatial_Query_Plans.md`;
- Expo SDK patch alignment and a clean 21/21 Expo Doctor result;
- serialized backend integration execution, with all 111 backend tests passing;
- web production build/lint, mobile typecheck/security checks, and backend
  typecheck/build.

The only remaining non-commit handoff check is interactive device verification:

- manually verify web and mobile clustering, pagination, location permission,
  historical review, and failure recovery with representative data. The local
  web preview responded successfully, but this Codex session had no connected
  Browser instance or native mobile device, so interactive behavior was not
  claimed as passed.

Changes intentionally remain uncommitted at the requester's direction.

The detailed sections below preserve the original 2026-08-17 audit for branch
history and review context.

## Final review decision

`origin/feature/incident-spatial-discovery` contains useful, substantial INC-02 work, but INC-02 is **not complete and the branch is not ready to merge**.

Do not merge the branch into `main` yet. Finish the missing public/citizen discovery, remove the unbounded `scope=all` path, complete server-side pagination/filtering, add the missing spatial and cross-tenant tests, and integrate from the latest `origin/main` without overwriting newer shared application code.

## Is this branch already in main?

No.

The branch has these two commits that are not contained in `origin/main`:

```text
45a04d4 inc-03
a180b62 inc-02 done
```

The branch was created from `5aa66e5`, the last commit of `feature/incident-reporting`. Current `main` later integrated MAP-01 and INC-01 through:

```text
ae6fcc2 integrate MAP-01 and INC-01 across backend web and mobile
```

Therefore:

- `main` contains the accepted MAP-01 and INC-01 foundation;
- `main` does not contain the two unique spatial-discovery commits above;
- similar files may exist on both branches because they share MAP-01/INC-01 ancestry;
- this does not mean the INC-02 additions have been merged.

## What the branch has implemented

### Backend

The branch adds an authenticated organization-scoped discovery route:

```http
GET /api/v1/organizations/:organizationId/incidents
```

The route correctly uses the expected protection chain:

```text
authenticate
-> requireCompletedProfile
-> tenant middleware
-> ability middleware
-> authorize(Read, Incident)
-> controller
-> service
-> spatial repository query
```

It also adds an organization service-area overlay route:

```http
GET /api/v1/organizations/:organizationId/service-area-boundaries
```

Implemented repository behavior includes:

- `ST_Covers` checks between incident points and active organization service areas;
- support for both legacy service-area boundaries and referenced administrative-area boundaries through `COALESCE`;
- active-organization, active-service-area, and active-administrative-area checks;
- `EXISTS`-based coverage, which avoids duplicate incidents when multiple polygons belonging to the same organization overlap;
- optional status, category, and reported-after filters;
- viewport intersection filtering when a viewport is supplied;
- cursor ordering by `reported_at DESC, id DESC` for the bounded path;
- a distinct FALSE-review count from active organizations;
- the active organization's own current review status;
- a small organization incident projection that omits description, reporter identity, reporter contact details, private notes, and photos;
- GeoJSON service-area boundary output for organization-map overlays.

The branch uses parameterized `Prisma.sql`/`$queryRaw` values rather than interpolating untrusted SQL strings.

### Shared web map

The branch extends the reusable web map with:

- debounced viewport callbacks;
- maximum-viewport warnings;
- marker clustering;
- selected-marker styling;
- synchronized keyboard-accessible list selection;
- organization service-area polygon overlays;
- controls for focusing multiple service areas.

### Shared mobile map

The branch extends the reusable mobile MapLibre map with:

- native GeoJSON clustering;
- debounced viewport callbacks after map interaction ends;
- selected-marker styling;
- compact list selection;
- service-area polygon overlays;
- controls for focusing organization service areas;
- no continuous background location tracking.

### Organization web and mobile views

The branch adds organization workspace screens that:

- show covered incident markers and a synchronized list;
- show organization service-area boundaries;
- support client-side status filtering;
- select an incident from either the marker or list;
- show severity, status, the organization's current review status, and public FALSE count.

These screens are useful INC-02 presentation work. Despite names such as `OrganizationIncidentReview`, they do not implement the INC-03 review mutation workflow.

### Existing test coverage in the branch

The incident integration test currently checks:

- an incident covered by an active service area is returned;
- one organization with two overlapping service polygons receives one incident rather than duplicates;
- a non-member receives `403` on the organization route;
- excessive viewport bounds receive `400`;
- inactive service areas no longer expose the incident;
- the organization projection excludes reporter ID, description, and private notes;
- service-area boundaries return a GeoJSON feature collection.

This is useful coverage but does not satisfy the complete INC-02 acceptance suite.

## Blocking work still required

### 1. Add citizen/public-safe bounding-box discovery

INC-02 requires a public-safe authenticated incident-discovery endpoint for the personal Citizen & Volunteer workspace. The branch only exposes organization discovery.

Add a bounded endpoint that accepts the existing shared viewport contract:

```text
west, south, east, north, zoom, limit, cursor
```

It must also support:

```text
status, categoryId, reportedAfter
```

The endpoint must return only marker/list-safe fields. It must never include reporter ID, email, phone number, submission ID, private notes, or internal organization-review notes.

### 2. Add citizen/public-safe radius discovery

Add nearby discovery using the existing shared radius contract:

```text
latitude, longitude, radiusMeters, limit, cursor
```

Use PostGIS `ST_DWithin` against `incidents.geo_point`. The existing map foundation already limits radius requests to 50,000 metres. Do not invent a second validation contract.

This powers explicit actions such as “Find incidents near me.” It must not continuously track the user's location.

### 3. Remove the unbounded `scope=all` behavior

This is the most important performance blocker.

The current web and mobile APIs send:

```ts
new URLSearchParams({ scope: "all" })
```

The backend interprets that as:

- no viewport filter;
- no page limit;
- no cursor pagination;
- potentially every covered incident for an organization.

The clients then download all incidents and filter them in memory. This violates the task requirement that spatial requests remain small and bounded.

Delete `scope=all` from the discovery validator, service, repository, tests, and both clients. Every map request must use either a bounded viewport or a bounded radius and a strict page limit.

### 4. Fetch by viewport instead of filtering a national/full result in the client

Web and mobile must pass their debounced viewport to the API. When the user finishes moving the map:

```text
map move ends
-> debounce
-> cancel stale request
-> send bounded viewport and active filters
-> backend performs indexed spatial query
-> replace/update visible markers and compact list
```

Do not fetch everything once and apply longitude/latitude filtering only in React.

### 5. Complete pagination and maximum-result behavior

All discovery paths must have:

- a default page size;
- a strict maximum page size;
- stable cursor ordering;
- `limit + 1` lookup to determine `nextCursor`;
- no path that changes `limit` to `null`;
- no unbounded repository query.

Test subsequent cursor pages to prove that records are neither repeated nor skipped.

### 6. Connect citizen discovery in both web and mobile

The branch adds only the organization incident map.

Add personal-workspace discovery in both clients:

- viewport incident loading;
- “near me” radius loading after explicit location permission/action;
- marker clustering;
- category, status, and time filters;
- compact list fallback;
- marker/list selection synchronization;
- selected public-safe incident detail;
- manual refresh and network-error retry;
- loading and empty states;
- stale-request cancellation.

Reuse the existing `EcoMap`. Do not create another incident-specific map component.

### 7. Send filters to the backend

The backend branch accepts some organization filters, but the current organization clients request `scope=all` and apply only status locally.

Web and mobile should send active filters with every viewport/radius request. Add at least:

- incident status;
- category;
- reported-after/time range.

Filtering must happen before pagination in PostgreSQL, not after a page is returned.

### 8. Preserve legitimate historical/event access

The authorization contract says an organization can access a shared incident only through:

- current approved active service-area coverage; or
- another explicitly allowed historical/event relationship.

Do not make organization access depend only on current coverage if an organization already has a legitimate review or linked cleanup-event relationship that must remain visible for history/operations. Implement this through tenant-filtered repository conditions; never trust an organization ID supplied only by the frontend.

Coordinate the exact event-history relationship with the event owner and integration owner before changing event-owned files.

### 9. Inspect and document the spatial query plans

The database already has the important GiST indexes:

```text
incidents_geo_point_gist_idx
organization_service_areas_boundary_gist_idx
administrative_areas_boundary_gist_idx
```

Use `EXPLAIN (ANALYZE, BUFFERS)` on representative bounding-box, radius, and organization-coverage queries. Confirm the query structure can use the spatial indexes as the dataset grows.

Do not create a migration merely because a small test database chooses a sequential scan. Add a new index only when the query plan and realistic data demonstrate that it is needed. If a migration is necessary, create a new migration; never edit an applied migration.

### 10. Complete cross-organization and spatial tests

The current test has two overlapping polygons for one organization. The acceptance criterion also requires separate organizations.

Create:

```text
Organization A
Organization B
active and inactive service areas
separate and overlapping polygons
incidents inside A only, B only, overlap, outside, and exactly on a boundary
```

Prove all of the following:

- a boundary point is included by `ST_Covers`;
- an overlap incident appears once for Organization A and once for Organization B;
- multiple polygons for one organization do not duplicate the incident;
- Organization B cannot request Organization A's tenant route by direct ID;
- a non-covering organization cannot obtain private organization projection/review data;
- inactive organization/service-area/admin-area records do not grant current coverage;
- bounding-box and radius maximums reject excessive requests;
- all discovery requests remain paginated;
- category/status/time filters work before pagination;
- public results exclude reporter contact details and private notes;
- cursor pages are stable and non-duplicating;
- no unbounded query option is accepted.

## Branch and integration risks

### The branch is behind current main

The branch's merge base is `5aa66e5`, while current `main` is `ae6fcc2`. Current main contains newer notification, membership, profile, cleanup-workflow, and integration work.

Do not replace current main files with older full-file copies from this branch.

### INC-02 and INC-03 are mixed

The branch contains a commit named `inc-03` before `inc-02 done`. Much of that commit is actually organization discovery/workspace support needed by INC-02, but it also uses review-oriented names and touches unrelated authentication/profile/workspace composition.

For this task:

- keep only discovery, safe current-review summary, FALSE count, service-area overlay, and workspace entry needed by INC-02;
- do not add VIEWED/VALID/FALSE mutation endpoints here;
- do not award rewards or create review notifications here;
- leave actual review mutations for INC-03.

### Predicted merge conflicts

A dry Git merge analysis against current `main` reports conflicts in:

```text
mobile/App.tsx
mobile/src/features/citizen/CitizenDashboard.tsx
web/src/App.tsx
web/src/features/citizen/CitizenDashboard.tsx
```

These are integration-owner/shared composition files. Preserve current-main authentication, profile completion, notifications, membership switching, incident reporting, and cleanup navigation. Add only the smallest required INC-02 navigation hooks.

## Recommended safe recovery workflow

The safest approach is to preserve the old branch as reference and finish INC-02 from a clean branch based on the latest main.

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/incident-spatial-discovery-v2
git push -u origin HEAD
```

What these commands do:

- `git fetch origin` downloads the newest branch information;
- `git switch main` moves to the integration baseline;
- `git pull --ff-only origin main` updates local main without creating an accidental merge commit;
- `git switch -c ...` creates a clean task branch from current main;
- `git push -u origin HEAD` publishes the task branch under its own name, not to `main`.

Use the existing work as a reference:

```powershell
git diff origin/main...origin/feature/incident-spatial-discovery -- backend/src/modules/incidents
git show origin/feature/incident-spatial-discovery:backend/src/modules/incidents/repositories/incident.repository.ts
```

Do not merge or cherry-pick both old commits wholesale. They combine INC-02/INC-03 work and older versions of shared application files. Port the relevant functions into the latest main-based files carefully.

If the integration owner chooses to keep the original branch instead, merge `origin/main` into it before further work and resolve the four shared-file conflicts with current main as the structural baseline. Do not force-push or rebase a branch another person is using without team agreement.

## Expected implementation flow after completion

### Citizen viewport flow

```text
Citizen opens map
-> EcoMap emits a bounded viewport after move-end debounce
-> web/mobile discovery API sends viewport + filters + page limit
-> authenticated backend route validates the request
-> controller passes validated input only
-> service decodes cursor and applies public-safe rules
-> repository executes parameterized indexed PostGIS query
-> backend returns minimal marker/list projection + nextCursor
-> map clusters markers and synchronizes selection with the list/detail
```

### Citizen nearby flow

```text
Citizen presses Find near me
-> client requests foreground location once
-> client sends coordinate + bounded radius + filters
-> backend validates Sri Lanka coordinate/radius/page size
-> repository uses ST_DWithin with incidents.geo_point
-> public-safe paginated results return
```

### Organization discovery flow

```text
User selects Organization A workspace
-> route contains Organization A ID
-> authentication verifies identity
-> profile middleware verifies onboarding
-> tenant middleware verifies active Organization A membership
-> CASL verifies Incident Read ability in that tenant context
-> repository proves each incident is covered by Organization A's active areas
   or another explicitly allowed Organization A historical/event relationship
-> bounded, deduplicated, minimal results return
```

Organization A permissions must never carry into Organization B. Frontend workspace state is navigation context only; it is not authorization evidence.

## Required verification before requesting review

Run all checks from the correct folder and report the results in the Pull Request:

```powershell
cd backend
npm run typecheck
npm run build
npm test
```

```powershell
cd ..\web
npm run lint
npm run build
```

```powershell
cd ..\mobile
npm run typecheck
npm run doctor
npm run security:check
```

Also run the backend integration tests against the local Docker PostGIS database and manually verify web and mobile viewport/nearby behavior with enough incident records to exercise clustering and pagination.

## Definition of done

INC-02 is ready for integration only when:

- public-safe authenticated bounding-box discovery exists;
- public-safe authenticated radius discovery exists;
- organization discovery uses active coverage and legitimate retained relationships;
- every request is spatially bounded and paginated;
- `scope=all` and all equivalent unbounded paths are removed;
- public/private projections are separated;
- web and mobile citizen discovery are complete;
- web and mobile organization discovery call the bounded server API;
- filters execute in PostgreSQL before pagination;
- organization overlap, boundary, inactive-area, direct-ID, privacy, bbox, radius, and cursor tests pass;
- query plans and existing GiST-index use have been inspected and documented;
- current main functionality is preserved;
- backend, web, mobile, Docker/PostGIS, and CI checks pass.

