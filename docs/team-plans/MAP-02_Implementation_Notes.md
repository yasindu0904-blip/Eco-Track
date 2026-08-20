# MAP-02 Unified Map Experience - Implementation Notes

## Delivered role projections

- Citizen/volunteer: bounded viewport and nearby discovery combine active incidents with published cleanup events. Markers identify the current user's own reports and joined events without exposing reporter, participant, organization contact, evidence, or private-note data.
- Organization: the existing covered-incident projection is combined with a separately tenant-filtered owned-event projection. Active-membership tenant middleware remains the gate; owned events never come from the public projection. Selected incidents open the review workflow and selected owned events open the exact draft/lifecycle record.
- Super Admin: the web dashboard uses only the public-safe projections, supports bounded cursor paging for dense areas, and exposes no assignment, review, or organization-operation action.

## Spatial API contracts

- `GET /incidents` and `GET /incidents/nearby`
- `GET /events/map` and `GET /events/nearby`
- `GET /organizations/:organizationId/incidents`
- `GET /organizations/:organizationId/events/:eventId`
- `GET /organizations/:organizationId/events/map`
- `GET /organizations/:organizationId/service-area-boundaries`

All viewport/radius requests share the central Sri Lanka bounds, maximum span, radius, page-size, and opaque-cursor validation. Viewport predicates use boundary-inclusive `ST_Covers`; nearby predicates use indexed `ST_DWithin`. Public incident paging is ordered by `(reported_at, id)`, public event paging by `(published_at, id)`, and organization event paging by `(updated_at, id)`.

## Index and performance contract

MAP-02 relies on the existing schema-owned indexes and does not add a migration:

- GiST: `incidents.geo_point`, `cleanup_events.event_geo_point`, service/administrative boundaries.
- B-tree: incident status/reported time, cleanup-event organization/lifecycle/created time, event-participant user/status.

Spatial query timing is emitted as structured `spatial_query` telemetry with operation, projection, query mode, duration, and returned row count. Integration tests enforce the current `2,000 ms` spatial-query budget for public viewport/radius and organization viewport projections. The local PostGIS verification on 2026-08-20 completed the tested map queries below this budget.

Production promotion should still include representative `EXPLAIN (ANALYZE, BUFFERS)` checks against viewport, radius, dense-result, and tenant-event queries using production-like row counts. Confirm that the GiST path is selected and compare p95 duration against the deployment performance objective; a small integration fixture cannot substitute for a production-scale query-plan review.

## Regression coverage

Incident integration tests cover default active-only visibility, explicit status filtering, malformed/excessive bounds, excessive radius, stable dense paging, overlapping service areas, exact boundary inclusion, inactive areas, cross-tenant rejection, private-field exclusion, and query timing. Cleanup-event integration coverage checks exact-boundary visibility, malformed bounds, opaque dense paging, public marker shape, nearby discovery and radius rejection, joined/owned projections, tenant isolation, private-field exclusion, and query timing.

Client lint/build/type checks cover the mixed marker contract, activity filters, clustering, list/map selection synchronization, stale-request cancellation, empty/error states, bounded pagination, citizen report/event-detail navigation, organization review/event routing, and read-only Super Admin behavior. Organization event navigation uses an exact tenant-scoped read so a selected event remains synchronized even when it is older than the first lifecycle-list page; organization switches clear tenant-specific event and draft selection.
