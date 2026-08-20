# DASH-01 Dashboard Summaries Handoff

## Status

DASH-01 provides real, role-correct citizen, organization, and Super Admin
summary data across the backend, web client, and mobile client. It does not
replace the feature screens or give the dashboard permission to perform domain
mutations. Final cross-feature routing and lazy loading remain owned by INT-01.

## Backend endpoints

| Audience | Endpoint | Required authorization |
|---|---|---|
| Citizen/volunteer | `GET /api/v1/dashboards/citizen` | Authenticated, completed active profile, `ReadOwn Dashboard` |
| Organization workspace | `GET /api/v1/organizations/:organizationId/dashboard-summary` | Authenticated, completed active profile, exact active tenant membership, `Read Dashboard` |
| Super Admin | `GET /api/v1/dashboards/platform` | Authenticated, completed active Super Admin profile, `Read Dashboard` |

Each endpoint accepts either no date range or both `from` and `to` ISO date
values. A range must be ordered, cannot exceed 366 days, and cannot contain
unknown query fields.

## Request flow

```text
client dashboard
  -> dashboard.api.ts
  -> Express dashboard.routes.ts
  -> authentication and completed-profile middleware
  -> tenant middleware when an organization is requested
  -> CASL ability middleware and authorize middleware
  -> dashboard controller
  -> dashboard service
  -> aggregate-only dashboard repository
  -> PostgreSQL/PostGIS
  -> safe summary response
```

The organization ID used by the repository comes from the verified tenant
context, not directly from an unchecked request parameter. Organization A
cannot use a changed URL to read Organization B's dashboard.

## Backend file ownership

- `backend/src/modules/dashboards/dashboard.routes.ts` owns endpoint composition
  and middleware order.
- `backend/src/modules/dashboards/controllers/` owns HTTP request/response work.
- `backend/src/modules/dashboards/services/` owns summary use-case entry points.
- `backend/src/modules/dashboards/repositories/dashboard.repository.ts` owns
  Prisma aggregate queries and the parameterized PostGIS coverage query.
- `backend/src/modules/dashboards/dashboard.validation.ts` owns bounded range
  validation.
- `backend/src/modules/dashboards/dashboard.types.ts` owns backend contracts.
- `backend/src/modules/dashboards/dashboard.dependencies.ts` connects production
  Prisma and authorization dependencies.
- `backend/src/app.ts` mounts the router only when dashboard dependencies are
  supplied; `backend/src/server.ts` supplies the real production dependencies.

Do not call the repository directly from a route. Do not replace CASL checks
with frontend role checks or request-body organization IDs.

## Returned summaries

Citizen data is restricted to the authenticated profile and contains:

- own incident reports grouped by state;
- joined and upcoming cleanup-event counts;
- unread notification count;
- private contribution count and point total.

Organization data is restricted to the exact active workspace and contains:

- incidents spatially covered by active service areas, grouped by state;
- that organization's review counts;
- owned cleanup events grouped by lifecycle;
- upcoming session, joined participant, and pending membership-request counts.

Super Admin data contains only platform aggregates. It does not expose tenant
notes, contact records, record collections, or ordinary organization-operation
permissions.

## Database work

Migration `20260822100000_add_dashboard_summary_indexes` adds query-supporting
indexes for citizen incident summaries and participant summaries. The Prisma
schema and `database_docs/EcoTrack_ERD_v2_Final.dbml` contain the same indexes.
The intentional Prisma schema change is also reflected in the checked-in
MAP-03 source-hash evidence.

## Web and mobile

- Web uses `web/src/features/dashboards/dashboard.api.ts` and
  `SummaryPanel.tsx` inside the existing citizen, organization, and Super Admin
  dashboards.
- Mobile uses `mobile/src/features/dashboards/dashboard.api.ts` and
  `SummaryCards.tsx` in the equivalent screens.
- Both clients use the shared API-failure helper and support loading, empty,
  initial-error, partial refresh-error, retained-data, and manual refresh states.
- Existing dashboard actions continue to open their real feature screens. INT-01
  may reorganize final navigation and add route-level lazy loading after merge.

## Verification coverage

- Real PostgreSQL/PostGIS tests create two non-overlapping organizations and
  prove citizen ownership, tenant isolation, spatial summary correctness, CASL
  authorization, and aggregate-only platform output.
- Route tests prove authentication, onboarding, role separation, exact tenant
  access, and invalid date-range rejection.
- Repository tests prove user-scoped filters and aggregate-only responses.
- Web and mobile component tests cover success, refresh, retained partial data,
  error, and empty states.

## Integration notes

INT-01 should consume these endpoints and components as published. It should
not move dashboard aggregation into `App.tsx`, duplicate summary queries, or
weaken the backend middleware chain. If a future dashboard metric is added,
update its repository aggregate, response type, web/mobile type, relevant
index/migration documentation, and tenant-isolation tests together.
