# INC-02 Spatial Query Plan Evidence

Captured: 2026-08-18  
Database: local EcoTrack PostgreSQL/PostGIS development database  
Command: `EXPLAIN (ANALYZE, BUFFERS)`

## Dataset caveat

The inspected development database contained six incident rows and a small
number of service areas. PostgreSQL correctly preferred sequential scans for
some queries at that size. To verify index eligibility independently of the
small-table cost decision, the same statements were also inspected inside a
transaction with `SET LOCAL enable_seqscan = off`. This setting was rolled back
and is not an application or database configuration change.

## Citizen bounding-box discovery

Representative bounds: `west=79.8`, `south=6.8`, `east=80.0`, `north=7.1`.
The statement used both `ST_Intersects` and `ST_Covers`, matching the production
query's fast bounding check and exact inclusive-boundary check.

- Normal small-table plan: sequential scan, 4 rows returned, approximately
  78 ms execution on the first cold spatial call.
- Index-eligibility plan: `Index Scan using incidents_geo_point_gist_idx`.
- The index condition contained the PostGIS geography bounding operator for
  both spatial predicates.
- Forced-plan execution was approximately 0.10 ms after spatial functions and
  pages were warm.

Conclusion: the bounding-box query is eligible to use the existing incident
GiST index as table size and selectivity make it cheaper than a sequential
scan. No new migration is justified by the small development dataset.

## Citizen radius discovery

Representative search: latitude `6.9271`, longitude `79.8612`, radius `5000`
metres.

- Normal plan: `Index Scan using incidents_geo_point_gist_idx`.
- Index condition: geography bounding expansion generated for `ST_DWithin`.
- Exact filter: `ST_DWithin(..., 5000, true)`.
- 4 rows returned; approximately 1.74 ms execution.

Conclusion: radius discovery uses the incident GiST index without planner
coercion.

## Organization coverage and retained relationships

The representative statement included the mandatory viewport predicates plus
all three authorized organization relationships:

1. active organization and active service-area `ST_Covers` coverage;
2. an incident review belonging to the requested organization;
3. a cleanup event belonging to the requested organization and linked to the
   incident.

On the tiny dataset PostgreSQL used a sequential incident scan. The
index-eligibility plan showed:

- `Index Scan using incidents_geo_point_gist_idx` for the mandatory viewport;
- organization primary/status indexes for active-tenant checks;
- the organization service-area organization index before exact `ST_Covers`;
- `incident_reviews_organization_status_updated_idx` for retained reviews;
- `cleanup_events_organization_lifecycle_created_idx` for retained events.

The forced representative plan returned one row in approximately 0.56 ms.
Because every organization request remains viewport-bounded, the incident GiST
index limits candidate incidents before exact current-coverage and retained
tenant relationships are evaluated.

## Decision

The existing indexes support all three INC-02 query shapes:

- `incidents_geo_point_gist_idx` for viewport and radius candidate selection;
- `organization_service_areas_boundary_gist_idx` and
  `administrative_areas_boundary_gist_idx` for spatial area data;
- existing tenant/review/event indexes for retained organization access.

No index migration is added. Re-run these plans with production-like volumes
before changing indexes; a sequential scan on a tiny fixture database is not
evidence of a missing index.
