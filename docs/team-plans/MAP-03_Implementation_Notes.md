# MAP-03 Spatial Performance and Security Regression

Captured: 2026-08-20

## Scope

MAP-03 hardens the unified MAP-02 marker contract. It does not add a second map
API, change GeoJSON coordinate order, or add role capabilities. The regression
work covers the existing incident, cleanup-event, organization boundary, web,
and Android paths.

## Backend regression contract

The PostGIS integration fixtures prove:

- bounding-box and radius validation, including reversed/excessive bounds,
  invalid coordinates, maximum page size, and maximum radius;
- inclusive boundary behavior through `ST_Covers`;
- separate and overlapping organization areas, inactive areas, and
  deduplication when several approved polygons cover one incident;
- direct-ID and altered-organization tenant rejection;
- stable cursor paging with a maximum of 100 public or organization markers;
- recursive exclusion of reporter identity, review notes, contacts,
  coordinators, participants, internal notes, and storage paths from public
  map/detail projections;
- bounded query result counts in telemetry without using wall-clock time as a
  CI pass/fail condition.

The response-size assertions use fixed small fixtures as regression tripwires.
They do not replace the page-size, viewport, radius, cursor, and boundary
simplification controls enforced by the API.

## Query-plan evidence

Run the plan capture against a migrated PostGIS database:

```powershell
cd backend
$env:MAP_EXPLAIN_OUTPUT = "..\docs\team-plans\MAP-03_Query_Plans.json"
npm run db:explain:maps
```

`MAP_EXPLAIN_OUTPUT` makes the capture script write UTF-8 directly, avoiding
shell-dependent redirection encodings on Windows.

Set `MAP_EXPLAIN_ANALYZE=false` to capture planner output without executing the
queries. The command captures catalog definitions and JSON plans for:

1. public incident viewport and radius discovery;
2. organization incident coverage;
3. public cleanup-event viewport and radius discovery;
4. organization-owned cleanup-event viewport discovery;
5. organization service-area viewport discovery.

The checked-in `MAP-03_Query_Plans.json` records the fixture row counts, index
catalog, compact per-query index summary, accepted-index checks, and complete
JSON plans. It also records SHA-256 hashes for every captured query and the
repositories, validation, schema, and migration sources that define the map
contract. Plan capture fails when a required catalog index is missing or a
primary query has neither a naturally selected accepted index nor an explicit
small-fixture bounded-scan explanation backed by an index-eligibility probe for
the exact query. The probe disables sequential scans only as corroborating
evidence; it cannot satisfy a plan check unless the natural scan is bounded by
the recorded fixture ceiling. The backend spatial suite independently
recomputes natural and eligibility index intersections and all hashes in CI
instead of trusting stored `satisfied` flags. Regenerate the artifact after
material schema or query changes so the evidence stays aligned with the
repository implementation.

Review the captured plan using production-like row counts. The intended paths
are `incidents_geo_point_gist_idx`, the cleanup-event spatial index or the
query-aligned public/tenant cursor indexes, and the service/administrative-area
spatial or tenant indexes. The service-area query also has
`organization_service_areas_organization_status_id_idx`, matching its tenant,
status, and stable id-order path. A sequential scan on a tiny bounded table is
not treated as a failure, and forced planner settings are never accepted as the
sole evidence for production readiness.

The checked-in local `EXPLAIN (FORMAT JSON)` capture on 2026-08-20 used 32
incidents, 41 cleanup events, 51 organization service areas, and 13,844
administrative areas. It showed:

- `incidents_geo_point_gist_idx` for public viewport, radius, and the bounded
  organization incident candidate scan;
- `cleanup_events_public_map_published_idx` for public viewport and radius
  discovery, with the exact spatial predicate retained as a filter;
- `cleanup_events_organization_updated_id_idx` for the organization-owned map,
  matching its stable `(updated_at, id)` cursor order;
- `administrative_areas_pkey` for referenced administrative boundaries;
- `organization_service_areas_organization_status_id_idx` for the service-area
  viewport query, matching the tenant/status predicates and stable id order;
  the required service-area and administrative-area spatial indexes are also
  independently verified in the captured catalog.

The event and service-area plans should still be recaptured with
production-like cardinality before promotion so the planner's selectivity
choice can be compared with the checked-in bounded-fixture evidence.

## Web regression contract

The shared viewport scheduler has fake-timer coverage proving that rapid
pan/zoom input collapses into one request, an in-flight request is aborted by a
newer viewport, request IDs remain monotonic, and unmount/disposal aborts
outstanding work. Errors log a fixed message rather than API or marker payloads.

Existing screens continue to preserve selected marker/list/detail state,
provide retry/empty/error states, use public-only Super Admin projections, and
keep organization review/event actions behind tenant authorization.

Rendered role-scenario tests additionally drive citizen API error/retry/empty
and browser-permission-denied recovery, incident/event filter and selection
synchronization, overlapping organization boundaries with one deduplicated
incident, authorized organization selection with review/draft actions, and
read-only Super Admin marker-selection synchronization through the real screen
components with the map/network boundaries mocked. The extracted clustering
suite also feeds 250 dense markers through the production clustering algorithm
and proves none are dropped or duplicated.

## Mobile regression contract

The Android map uses the same tested debounce/abort contract. A throttled
`AppState` transition refreshes the last bounded citizen or organization query
once when the app returns from background. The refresh reuses existing request
cancellation and never starts a location watcher.

CI also rejects continuous/background location APIs and every non-allowlisted
console use in map flows. The TypeScript-AST guard self-tests ordinary calls,
bracket notation, global console access, method aliases, and direct console
aliases before scanning source. Location remains one-shot foreground access
initiated by the user.

The mobile component suite drives both the real `LocationPicker` state
transitions and the real `EcoMap` current-location action. It proves denied and
unavailable providers display their fallback messages, denial never requests a
position, a granted foreground request selects the returned position, manual
map selection remains usable after denial, valid coordinates can be confirmed
without location services, and invalid coordinates remain editable and
recoverable. Dense-source and press tests validate native clustering and marker
selection. Rendered citizen-discovery scenarios cover weak-network retry into
an empty state, bounded nearby search, incident/event filter synchronization,
and refresh of the last bounded viewport after a foreground transition.

## Verification commands

```powershell
cd backend
npm run typecheck
npm run test:spatial

cd ..\web
npm run lint
npm test
npm run build

cd ..\mobile
npm run security:check
npm run security:map
npm test
npm run typecheck
npx expo-doctor
npx expo export --platform android --output-dir dist
```

The automated suites cover dense clustering, empty/API-error recovery,
permission outcomes, weak-network retry, marker selection, and the
background/foreground refresh contract. A physical Android development-build
smoke test remains recommended before release for OS-dialog and rendering
behavior that cannot be reproduced by the component harness.
