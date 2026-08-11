# EcoTrack — CV, Portfolio, and Interview Project Dossier

Audit date: 11 August 2026  
Audited branch: `integration/organization-onboarding`  
Repository type: team-based academic software-engineering project  
Project status: working foundation and organization-onboarding milestone; broader incident and cleanup lifecycle is designed for future implementation

## 1. How to use this document

This dossier separates repository facts into three confidence levels:

- **Implemented:** present in the production `backend/` or `web/` code.
- **Prototype/design:** implemented only in the static `ecotrack-srs-mockup/` reference or screenshots.
- **Planned:** specified in the source-of-truth documents or final ERD but not yet implemented as a production module.

For a CV, claim only work that you personally completed or can explain in an interview. EcoTrack is a team project, and Git history currently contains two author identities. Replace team-level wording such as “we designed” with “I designed” only where your commits, pull requests, or team records support that claim.

## 2. Project identity

### Project name

EcoTrack — Multi-Tenant Environmental Reporting and Cleanup Coordination Platform

### One-line description

EcoTrack is a multi-tenant SaaS platform that connects citizens with verified environmental organizations through location-based incident reporting, cleanup-event coordination, and voluntary community participation.

### 30-second elevator pitch

EcoTrack replaces fragmented social posts, posters, phone calls, and manual volunteer lists with one structured environmental-action workflow. Citizens use a single passwordless account to report environmental incidents and join public cleanup events. Verified organizations discover shared incidents only inside approved geographic service areas, review them independently, and coordinate their own cleanup events without exposing another organization’s private data. The current implementation delivers the TypeScript/Supabase/Prisma security foundation and organization-onboarding flow; the complete PostGIS incident and cleanup lifecycle is designed in the ERD and roadmap.

### Portfolio summary

EcoTrack demonstrates full-stack TypeScript engineering, domain modeling, multi-tenant authorization, passwordless authentication, transactional data access, PostgreSQL security, PostGIS geospatial design, responsive UI development, automated testing, and architecture planning. It deliberately uses a modular monolith instead of premature microservices, with a future path to Redis-backed workers for notifications, image processing, exports, and analytics.

### Problem being solved

Community environmental action is commonly coordinated through disconnected social-media posts, messaging groups, calls, posters, and spreadsheets. These channels make it difficult to:

- verify the organizations asking for access;
- route a report to every relevant organization without making the citizen choose one;
- prevent one organization from reading another tenant’s private information;
- coordinate multi-day events and volunteer availability;
- preserve an auditable history of reports, reviews, decisions, attendance, and evidence;
- work effectively on low-bandwidth mobile connections.

EcoTrack converts that informal process into a secure, location-aware, voluntary workflow.

### Product boundaries

EcoTrack is not an employment platform, payment platform, government enforcement tool, donation service, or AI project. There are no wages, forced assignments, volunteer job applications, or organization assignments made by the Super Admin. The intended technical strength is secure multi-tenancy, geospatial routing, reliable workflow design, and practical community coordination.

## 3. Users, roles, and permissions

### Citizen and volunteer

Every normal account automatically has both citizen and volunteer capabilities. A person uses the same account to report incidents, browse public information, join cleanup events, select availability, and review their own history. There is no separate volunteer account or approval process.

### Organization member

An `ORG_MEMBER` is attached to one organization through an organization-scoped membership. Membership does not automatically grant control of every event. An active member gains event-specific coordination rights only when assigned as a coordinator for that event.

### Organization administrator

An `ORG_ADMIN` manages its own organization, members, workflows, service-area requests, incident reviews, cleanup events, coordinators, and operational data. It cannot access another organization’s private records.

### Super Admin

A `SUPER_ADMIN` is a platform role for organization verification, platform oversight, account safety, support, and necessary audit access. A Super Admin does not choose which organization should act on an incident and does not control ordinary volunteer operations.

### Authorization model

- Supabase Auth answers: **Who is the user?**
- Prisma/PostgreSQL answer: **What profile, membership, tenant, assignment, and record state exist?**
- CASL answers: **What actions may this user perform on which subjects?**
- Express middleware enforces the decision before a controller runs.
- PostgreSQL constraints and RLS provide structural integrity and defense in depth.

## 4. Current implementation snapshot

### Implemented backend capabilities

- Express 5 REST API written in strict TypeScript and ESM.
- Public health endpoint.
- Supabase Bearer-token verification.
- Automatic creation or synchronization of an EcoTrack `UserProfile` after verified authentication.
- Account-status enforcement for suspended or archived users.
- Safe authenticated-profile response that excludes auth internals and secrets.
- CASL ability construction for citizens, Super Admins, organization members, and organization admins.
- Tenant middleware that resolves an active membership from the authenticated backend context.
- Route-level authorization middleware and record-aware CASL conditions.
- Cross-tenant authorization integration tests using Organization A and Organization B.
- Organization application create/list/detail APIs.
- Search API for official Sri Lankan Grama Niladhari Divisions.
- Transactional creation of an organization, pending service-area links, and an audit record.
- Zod validation, normalized email, UUID validation, unique service-area selection, and a limit of 1–10 selected GN Divisions.
- Collision-resistant organization slug generation.
- Centralized 404 and error responses using application error codes.
- Helmet, restricted CORS origin, disabled `x-powered-by`, and a 1 MB JSON request limit.
- Graceful HTTP shutdown and Prisma disconnection on `SIGINT`/`SIGTERM`.
- Prisma singleton using Prisma 7’s PostgreSQL adapter.
- PostgreSQL migrations with RLS and revoked direct `anon`/`authenticated` privileges on the identity, organization-foundation, audit, and incident-category tables.
- PostGIS `geography(MultiPolygon,4326)` service-area and administrative-area storage.
- GiST spatial indexes.
- Idempotent, paginated import of official GN Division GeoJSON data from the Sri Lanka NSDI ArcGIS service.

### Implemented production web capabilities

- Responsive React 19 + TypeScript + Vite application.
- Passwordless email magic-link sign-in through Supabase.
- Web callback handling at `/auth/callback`.
- Session restoration, auth-state subscription, safe retry, and sign-out.
- Race protection for asynchronous session updates through operation IDs.
- Bearer-token API client with consistent typed error handling.
- Role-aware rendering for citizen and Super Admin dashboards.
- Citizen organization-application form and “my applications” view.
- Authenticated GN Division search and multi-select.
- Preview-only development modes separated from real authentication.
- Responsive desktop/mobile layouts, explicit loading/error/empty states, semantic labels, visible focus treatment, and reduced-motion support.

### Prototype/design outputs

The separate SRS mockup contains eight static interactive UI references:

1. Passwordless magic-link login.
2. Citizen/volunteer incident and event map.
3. Incident reporting and map-pin confirmation.
4. Cleanup-event details and join flow.
5. Multi-day availability selection.
6. Organization dashboard.
7. Incident review, event scheduling, and volunteer roster.
8. Super Admin organization verification.

Five designs target a 390 px mobile viewport and three target a 1440 px desktop viewport. Eight PNG outputs are present in `screenshots/`. These screens use fictional data and do not prove production API functionality.

### Not implemented yet

- The `mobile/` application is currently empty.
- Super Admin organization review/approval APIs and live review queue.
- Verification-document upload and secure storage workflow.
- Organization membership request/admin-management APIs.
- Production incident, photo, incident-review, and status-history modules.
- Production OpenStreetMap map and bounding-box queries.
- Cleanup-event, session, coordinator, participant, availability, allocation, notes, evidence, and workflow modules.
- Expo device registration, notification persistence/delivery, and Redis workers.
- Contribution points, badges, achievements, issue reporting, and analytics.
- Deployment, CI/CD, observability, production rate limiting, and load testing.

## 5. Repository structure

```text
Eco-Track/
├── backend/                 Express + TypeScript REST API
│   ├── prisma/              Prisma schema, seed, and reviewed SQL migrations
│   └── src/
│       ├── authorization/   CASL rules, subjects, actions, and repositories
│       ├── config/          Environment and Supabase clients
│       ├── database/        Shared Prisma singleton
│       ├── middleware/      Auth, tenant, ability, authorization, errors
│       ├── modules/         Domain-oriented modular-monolith features
│       ├── scripts/         DB checks and GN Division importer
│       └── tests/           Auth and cross-tenant integration tests
├── web/                     Production React + TypeScript + Vite application
├── mobile/                  Planned React Native + Expo application (empty now)
├── ecotrack-srs-mockup/     Static UI specification/reference only
├── screenshots/             Eight SRS interface outputs
├── docs/IMPORTANT/          Product and architecture sources of truth
├── database_docs/           Final DBML ERD and database safeguards
└── docs/team-plans/         Three-member integration and ownership plans
```

At audit time, the repository contained 51 hand-written backend TypeScript files with approximately 3,503 lines and 23 production-web TypeScript/TSX/CSS files with approximately 4,506 lines. Generated Prisma code is excluded from those backend numbers.

## 6. Architecture

### Architecture name

> A modular monolith with layered domain modules, selective vertical slices for complex use cases, and separate background workers for heavy asynchronous processing.

### Request flow

```text
Client
  ↓ HTTPS + Supabase Bearer token
Express route
  ↓
Authentication middleware
  ↓
Tenant/context middleware (organization-scoped routes)
  ↓
CASL ability middleware
  ↓
Action/subject authorization middleware
  ↓
Controller
  ↓
Service or complex use case
  ↓
Repository
  ↓
Prisma / PostgreSQL / PostGIS
```

### Why a modular monolith

The semester scope does not justify microservice deployment and operational overhead. Domain modules provide clear ownership and boundaries while retaining simple local transactions and debugging. Heavy, slow, retryable, or bulk execution can later move to separate Redis-backed worker processes without extracting ordinary domain logic.

### Layer responsibilities

- **Route:** URL and middleware composition.
- **Middleware:** authentication, tenant resolution, abilities, permission checks, validation context, and centralized errors.
- **Controller:** translate HTTP input/output and call one service.
- **Service/use case:** business rules, state transitions, and transaction orchestration.
- **Repository:** Prisma queries, tenant filters, and persistence mapping.
- **Database:** permanent constraints, relationships, indexes, geospatial operations, and audit history.

### Complex use-case rule

An operation moves into a dedicated `use-cases/<operation>/` slice when it performs multiple writes, owns a transaction, calls other modules, sends notifications, writes audit logs, queues work, or has complex branches/status transitions. Examples include event publication, volunteer allocation, and completing an event with evidence and incident resolution.

### Future worker flow

```text
API transaction → commit permanent records → enqueue Redis job → return response
Redis worker → retry external/heavy work → save delivery/result status → log failures
```

Planned worker workloads include Expo push batches, thumbnails, image resizing, CSV/PDF exports, analytics recalculation, scheduled reminders, and retryable third-party calls.

## 7. Technology stack

| Area | Current technology | Purpose |
|---|---|---|
| Backend runtime | Node.js | Server-side JavaScript runtime |
| Backend framework | Express 5.2 | REST routing and middleware |
| Backend language | TypeScript 7 preview dependency, strict mode | Type-safe API and domain code |
| Frontend | React 19.2 + React DOM | Production web user interface |
| Frontend build | Vite 8.2 | Development server and optimized build |
| Authentication | Supabase Auth | Passwordless magic links, sessions, tokens |
| Database | Supabase PostgreSQL | Permanent relational data |
| Geospatial | PostGIS | GN boundaries, incident points, spatial coverage |
| ORM/migrations | Prisma 7.9 | Type-safe access and migration history |
| PostgreSQL adapter | `@prisma/adapter-pg` + `pg` | Prisma 7 database connection |
| Authorization | CASL 7 + `@casl/prisma` | Role and record-aware permission rules |
| Validation | Zod 4.4 | Runtime validation of untrusted input/env |
| Security middleware | Helmet, CORS | Secure headers and origin control |
| Styling | Plain responsive CSS | Lightweight, custom design system |
| Testing | Node test runner through `tsx` | API and authorization integration tests |
| UI specification | React 18 mockup + Playwright | Eight SRS screens and screenshots |
| Planned mobile | React Native + Expo | Citizen/volunteer field experience |
| Planned caching/queues | Redis | Cache, locks, idempotency, rate limits, jobs |
| Planned notifications | Expo Push Notifications | MVP mobile alerts |
| Planned maps | OpenStreetMap | Map presentation without paid map APIs |

Backend and web use separate package manifests and dependency versions. The static mockup is also a separate workspace and should not be presented as the production web app.

## 8. Authentication flow

### Implemented web flow

1. The user enters an email address.
2. The web app normalizes it and calls `supabase.auth.signInWithOtp`.
3. Supabase emails a single-use magic link with a web callback URL.
4. Supabase restores the session after the callback.
5. The web app sends the access token to `GET /api/v1/auth/me`.
6. The API verifies the token using Supabase Auth.
7. The API normalizes the verified email and provisions or updates `UserProfile` through Prisma.
8. A conflicting email already linked to another Supabase ID returns HTTP 409.
9. A suspended or archived account returns HTTP 403.
10. The client receives safe profile fields and renders the role-appropriate dashboard.

### Security properties

- EcoTrack does not store passwords.
- The frontend does not choose its platform role or organization role.
- Verified Supabase identity is mapped to a unique application profile.
- The backend owns account-status and role decisions.
- Tokens are sent in the Authorization header, not logged or stored in source.
- `auth.users` remains Supabase-owned and is not a normal Prisma-managed table relation.

### Planned mobile flow

The same Supabase magic link will return to the Expo app using an approved deep link/universal link. SecureStore should hold sensitive session material. The mobile flow remains unimplemented.

## 9. Authorization and tenant isolation

### Implemented abilities

- Active normal users can create and read their own organization applications and read their own notifications conceptually.
- Active Super Admins can read the platform and read/review/approve/decline organization applications.
- An active tenant member can read only its own active organization and service areas.
- An active tenant `ORG_ADMIN` can update that organization and manage that organization’s memberships.
- Suspended profiles receive no protected permissions.

### Defense layers

1. Token verification.
2. Active-account check.
3. Tenant membership lookup from authenticated profile ID and route organization ID.
4. CASL action/subject checks.
5. Repository filters using authorized user/organization identifiers.
6. PostgreSQL foreign keys, unique constraints, checks, and transaction rules.
7. RLS enabled on the implemented identity, organization-foundation, audit, and incident-category tables.
8. Direct table privileges revoked from Supabase `anon` and `authenticated` roles on those protected tables.

The current service-area migration and in-progress administrative-area migration do not yet contain the matching RLS/revocation statements. That gap must be closed with a new reviewed migration before production; RLS coverage must ultimately apply to every public application table.

### Cross-tenant attack model

The tests explicitly simulate an Organization A administrator changing a route ID to Organization B. The tenant middleware rejects the request. Future modules must also test cross-event ID combinations such as an Event A participant referencing an Event B session.

### Important rule

Frontend navigation or hidden buttons are user-experience features, not security controls. Every protected action must be enforced by the backend.

## 10. Current REST API

All feature endpoints are mounted below `/api/v1`; JSON responses use a `{ "data": ... }` envelope and errors use a safe structured application-error response.

| Method and path | Protection | Current behavior |
|---|---|---|
| `GET /health` | Public | Returns service health |
| `GET /api/v1/auth/me` | Bearer authentication | Returns safe current profile |
| `GET /api/v1/super-admin/ping` | Auth + CASL `read Platform` | Verifies Super Admin API access |
| `GET /api/v1/administrative-areas` | Bearer authentication | Searches up to 100 active GN Divisions |
| `POST /api/v1/organization-applications` | Auth + CASL `create OrganizationApplication` | Creates a pending organization application transactionally |
| `GET /api/v1/organization-applications/me` | Auth + CASL `readOwn` | Lists only the current requester’s applications |
| `GET /api/v1/organization-applications/me/:id` | Auth + CASL `readOwn` | Returns an owned application; hides another requester’s record |

### Organization application input

```json
{
  "name": "Green Colombo Society",
  "registrationNumber": "optional-registration-id",
  "description": "Community environmental organization",
  "officialEmail": "office@example.org",
  "officialPhone": "+94 77 123 4567",
  "officialAddress": "Official organization address",
  "administrativeAreaIds": ["gn-division-uuid"]
}
```

Validation rules include a 2–160 character name, 2,000 character optional description, normalized email, constrained phone format, 5–500 character address, 1–10 active GN Division UUIDs, no duplicate selections, and strict rejection of unknown/requester-controlled fields.

### Transactional result

The create operation writes:

1. one `Organization` in `PENDING_REVIEW`;
2. one `OrganizationServiceArea` per verified GN Division in `PENDING_REVIEW`;
3. one `AuditLog` with action `ORGANIZATION_APPLICATION_SUBMITTED`.

It deliberately does not create the first administrator membership until a Super Admin approves the organization.

## 11. Database design

### Implemented Prisma models (10)

| Model | Responsibility |
|---|---|
| `UserProfile` | Application identity, platform role, account status, profile fields |
| `PlatformSettings` | Singleton configuration, currently 48-hour highlight and 7-day unaddressed defaults |
| `IncidentCategory` | Global environmental incident lookup data |
| `Organization` | Organization application and tenant lifecycle |
| `OrganizationVerificationDocument` | Proof-document metadata and review state |
| `OrganizationMembership` | Tenant-scoped member/admin role and lifecycle |
| `OrganizationMembershipRequest` | Citizen request for `ORG_MEMBER` access |
| `OrganizationServiceArea` | Pending/approved organization area linked to a GN Division or legacy polygon |
| `AdministrativeArea` | Imported official GN Division metadata and PostGIS boundary |
| `AuditLog` | Actor, tenant, action, entity, metadata, and timestamp |

### Important implemented constraints

- Unique Supabase auth user ID and synchronized email.
- Unique organization slug.
- Unique user membership per organization.
- Unique membership source request.
- Unique service-area selection per organization and administrative area.
- Unique administrative-area official code per level.
- Partial unique index allowing only one pending membership request per user/organization while preserving request history.
- Positive singleton platform settings enforced with SQL checks.
- `TIMESTAMPTZ` for real moments and `DATE` for document expiry.
- RLS and revoked public client privileges on the current protected foundation/category tables; equivalent coverage is still required for the newer geospatial tables.
- GiST index on service-area and administrative-area boundaries.
- Legacy-service-area compatibility check while GN references are introduced.

### Final ERD scope (planned)

The database v2 DBML specifies 30 public application tables plus external Supabase `auth.users`. In addition to the current foundation, the target model includes:

- organization workflow statuses and allowed transitions;
- incidents, incident photos, independent organization reviews, and status history;
- cleanup events and event sessions;
- event coordinators and participants;
- participant session availability and session allocations/attendance;
- event notes, evidence, and workflow history;
- contribution events, achievement definitions, and user achievements;
- user devices and notifications;
- issue reports and platform audit logs.

### Target lifecycle enums

- Incident severity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Global incident status: `ACTIVE`, `CLEANUP_ORGANIZED`, `RESOLVED`, `EXPIRED`, `ARCHIVED`.
- Organization review: `VIEWED`, `VALID`, `FALSE`.
- Cleanup event: `DRAFT`, `PUBLISHED`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETION_SUBMITTED`, `COMPLETED`, `CANCELLED`.
- Session: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- Participant: `JOINED`, `WITHDRAWN`, `REMOVED`.
- Allocation/attendance: `PLANNED`, `ATTENDED`, `ABSENT`, `REMOVED`.
- Evidence: `BEFORE`, `PROGRESS`, `AFTER`.

### Planned cross-entity safeguards

- Event workflow status must belong to the event’s organization.
- Event creator/coordinator/reviewer/allocator memberships must belong to the same owning tenant and be active/authorized.
- Participant availability and allocation must reference a session in the same event.
- Evidence session must belong to the referenced event.
- Session end time must be later than start time; capacity must be positive.
- An active organization must have at least one approved active service area.
- The same source cannot award a contribution twice.
- Strong database constraints are combined with service validation and negative integration tests.

## 12. Geospatial design

### Current GN Division pipeline

1. The importer requests pages of up to 250 features from the Sri Lanka NSDI ArcGIS GN Division layer.
2. It asks the source for GeoJSON in EPSG/SRID 4326.
3. Polygon and MultiPolygon geometry is normalized with PostGIS.
4. Invalid, empty, unnamed, or unusable-code features are skipped.
5. Metadata includes official code, GN name/number, Divisional Secretariat, district, province, source URL, and source version.
6. Rows are upserted on `(level, official_code)` so repeated imports are idempotent.
7. The organization application stores a foreign-key reference instead of duplicating the polygon.

The script supports `GN_IMPORT_WHERE` and `GN_IMPORT_OFFSET` for filtered or resumable imports.

### Geometry choices

- Incident/event/session points: planned `geography(Point,4326)` plus latitude/longitude for convenient API responses.
- Administrative/service boundaries: `geography(MultiPolygon,4326)`.
- MultiPolygon handles disconnected areas and island/fragment geometry without changing the model.
- GiST indexes support fast spatial lookup.
- Latitude/longitude and geography values must be synchronized through controlled database logic.

### Planned incident routing query

The platform will use boundary-inclusive `ST_Covers`, not strict interior-only matching. An incident on an exact boundary should still be discoverable. Every active organization whose approved active area covers the point sees the same shared incident.

### Overlap rule

An incident is one platform record, not one copy per organization. Each covering organization has its own private review record. A `FALSE` review is informational and cannot hide the report from other organizations. The citizen and Super Admin do not assign an organization.

## 13. Complete planned product flow

1. A person signs in with a Supabase email magic link and receives one citizen/volunteer account.
2. A citizen selects current GPS or manually confirms a map point.
3. The citizen submits category, severity, description, and compressed evidence.
4. The API validates/rate-limits the request, saves one shared incident, saves history, and finds covering organizations with PostGIS.
5. Each covering organization independently marks its own review `VIEWED`, `VALID`, or `FALSE`.
6. The global false count is informative, not a vote or rejection threshold.
7. Incidents are highlighted for a configurable default of 48 hours and remain unaddressed/searchable for a configurable default of seven days before leaving the default map; records are preserved.
8. A willing covering organization creates a linked cleanup event, or an Org Admin creates a direct event with no incident.
9. A database transaction and partial unique index allow only one incident-claiming active event at a time. A losing concurrent request receives HTTP 409.
10. The organization adds one or more dated sessions and at least one active organization coordinator before publication.
11. Citizens join immediately without an application or approval queue.
12. Volunteers select availability per session.
13. Authorized coordinators allocate volunteers, publish participant notes, manage progress, and record attendance/evidence.
14. Volunteers may withdraw; removal affects only that event and is audited.
15. Completing a linked event updates the incident to `RESOLVED` in a coordinated transaction.
16. Verified reports and attended sessions may create non-monetary contribution records and achievements.
17. Notification records remain in PostgreSQL; Expo push is only a delivery channel.

## 14. Cleanup-event concurrency design

Only `PUBLISHED`, `SCHEDULED`, `IN_PROGRESS`, and `COMPLETION_SUBMITTED` events claim an incident. `DRAFT`, `COMPLETED`, and `CANCELLED` events do not block a valid new claim where business rules permit it.

The intended publication transaction is:

1. authenticate and resolve the active organization membership;
2. authorize event publication;
3. validate organization, event, coordinator, session, workflow, and incident visibility;
4. create/update the event and history;
5. conditionally update the global incident state;
6. rely on a PostgreSQL partial unique index as the final race guard;
7. map a unique conflict to HTTP 409;
8. commit;
9. enqueue notifications only after commit.

Redis may reduce duplicate work but never replaces PostgreSQL integrity.

## 15. UI/UX design details

### Visual language

- Environmental primary green centered around `#1b5e20`.
- White card surfaces on soft green/gray page backgrounds.
- Darker green for high-priority calls to action and protected/admin surfaces.
- Blue used as a secondary informational/action color in the mockup.
- Inter/system sans-serif typography with clear scale and strong headings.
- Rounded cards, restrained shadows, status chips, and visible grouping.
- Leaf/seedling brand mark and community-action messaging.

### Interaction principles

- Mobile-first field tasks with large touch targets.
- Desktop dashboards for information-dense organization workflows.
- Status is communicated using text/icons as well as color.
- Forms include real labels, focus states, error messages, and disabled/loading states.
- Responsive production pages collapse multi-column grids on narrow screens.
- Reduced-motion preferences are respected in the production auth UI.
- Preview mode is explicitly identified and cannot submit protected data without a real token.

### Low-bandwidth design

- Request incidents/events by visible map bounds or radius.
- Debounce map movement.
- Cluster low-zoom markers.
- Paginate lists and select only screen-specific response fields.
- Compress images and generate thumbnails.
- Display upload progress and allow safe retries.
- Do not continuously track location; manual pin placement remains available.

### Eight reference screens

| Screen | Main purpose | Important controls/information |
|---|---|---|
| Magic-link login | Passwordless access | Email, send state, success/error states |
| Citizen map | Nearby discovery | Incident/event markers, zoom, list, map attribution |
| Incident report | Structured evidence | Category, title, description, location confirmation, photo area |
| Event details | Participation decision | Public details, dates, location, instructions, participants, Join |
| Availability | Multi-session preference | Per-day toggles, time slots, selection summary |
| Organization dashboard | Tenant overview | Metrics, events, incidents, quick actions |
| Scheduling workspace | Operations | Incident/event/volunteer tabs, review and scheduling actions |
| Super Admin verification | Tenant onboarding | Application states, documents, approve/decline guidance |

### Design caveat

The mockup is not the current source of truth. It includes static data and some older copy/controls, such as a Google sign-in button and assignment-oriented wording. Production behavior must follow the passwordless magic-link and voluntary-coordination rules in `docs/IMPORTANT/`.

## 16. Quality, testing, and verification evidence

### Backend integration tests

The repository contains 25 tests covering:

- public health and consistent 404 behavior;
- missing, malformed, invalid, and valid Bearer tokens;
- safe profile responses and inactive-account rejection;
- normal-user versus Super Admin access;
- safe handling of unexpected auth errors;
- citizen, Super Admin, Org Admin, Org Member, and suspended-user abilities;
- valid tenant entry and direct-ID cross-tenant attacks;
- malformed organization IDs;
- organization-application authentication and strict input validation;
- official GN Division search and invalid-area rejection;
- pending transactional creation with no premature membership;
- requester-scoped list/detail access.

### Audit-time command results

Passed on 11 August 2026:

- backend `npm run typecheck`;
- backend `npm run build`;
- `npx prisma validate`;
- production web `npm run lint`;
- production web `npm run build`.

The production web build transformed 75 modules and emitted approximately 433.45 kB JavaScript (120.91 kB gzip) and 37.87 kB CSS (7.61 kB gzip).

Known verification issues:

- Backend test run: 24 passed, 1 failed. The GN search test expected one row but received two from the connected test database, indicating shared/persistent test data or an overly broad assertion. The functional request returned data; the test-isolation assumption needs correction.
- Static SRS mockup build currently fails strict TypeScript checks because several icon imports and one state setter are unused. The production `web/` build is unaffected.
- The organization service-area and in-progress administrative-area migrations require a follow-up reviewed migration to enable RLS and revoke direct `anon`/`authenticated` privileges consistently.

Do not write “all tests pass” on a CV until those two issues are fixed and the full checks are rerun.

## 17. Engineering decisions and trade-offs

### Supabase Auth plus Prisma

Supabase manages identity/session security while Prisma owns application-domain data. This avoids reimplementing authentication and keeps domain queries type-safe. The trade-off is maintaining a synchronized application email copy and deliberately avoiding an accidental Prisma-owned cross-schema relation to `auth.users`.

### Backend-only data access

The web/mobile clients use Supabase for Auth but do not directly query tenant-private public tables. Express + Prisma is the application data boundary. RLS and revoked client privileges provide defense in depth. This is stricter than relying only on frontend Supabase queries but centralizes business rules and authorization.

### CASL plus tenant filters

CASL expresses capabilities and record conditions, while repository queries retain mandatory tenant filters. This avoids treating an authorization library as a substitute for safe database querying.

### Official GN references instead of applicant polygons

Applicants choose known GN Division IDs. The platform stores the authoritative polygon once and links it to many organizations. This improves validation, prevents arbitrary access expansion, reduces geometry duplication, and supports controlled review. Future custom polygons can remain an exception requiring Super Admin approval.

### PostGIS geography

`geography` is appropriate for Earth-distance/coverage semantics and SRID 4326 data. Prisma’s `Unsupported` type means specialized spatial SQL must be reviewed manually, which is accepted for correct geospatial behavior.

### REST instead of WebSockets for MVP

Normal actions do not require a persistent live connection. REST, refresh/polling, and push notifications reduce complexity. WebSockets remain optional for live dashboards after the core workflow is stable.

### PostgreSQL as final concurrency authority

Frontend buttons and Redis locks can improve experience/performance but cannot guarantee uniqueness. Partial unique indexes and transactions remain the final guard against two organizations claiming the same incident.

### Soft deletion/archive

Suspension and archival preserve incident/event history, audits, memberships, and achievements. This costs storage and query complexity but protects traceability.

## 18. Development timeline

Repository history shows 43 commits across two author identities at audit time.

- **14–21 July 2026:** repository initialization and project foundation.
- **22–27 July:** libraries, environment validation, Prisma/Supabase setup, initial identity/tenancy schema, RLS, seed/check scripts, and first Super Admin foundation.
- **2 August:** source-of-truth, architecture, and Sri Lankan service-area documentation.
- **9 August:** database v2 foundation, incident categories, authentication modules/middleware, API composition, and initial web configuration.
- **9–10 August:** passwordless web authentication, CASL authorization, cross-tenant integration, organization-application backend/frontend work, and team workload plans.
- **11 August:** citizen/Super Admin dashboards and ongoing official administrative-area reference integration.

At audit time, the current branch also had uncommitted GN Division reference/application changes. Treat them as work in progress until reviewed, tested, committed, and merged.

## 19. Future roadmap

### Phase 1 — Stabilize the current onboarding milestone

- Isolate integration tests with deterministic setup/cleanup.
- Fix strict TypeScript errors in the static mockup.
- Finish/review the GN Division migration and importer.
- Add source-data import documentation and repeatable test fixtures.
- Implement Super Admin application list/detail/approve/decline APIs.
- Review verification documents and requested service areas.
- Approve organization, activate service areas, create the first `ORG_ADMIN`, and write audit/notification records in one transaction.
- Connect the production Super Admin review UI.

### Phase 2 — Organization membership and mobile foundation

- Scaffold the Expo/React Native TypeScript app.
- Implement magic-link deep linking and secure session storage.
- Add organization membership request, approval, promotion, removal, and final-admin safeguards.
- Add tenant workspace navigation and organization profile management.

### Phase 3 — Incident reporting and discovery

- Implement categories, incident records, photos, geography points, and history.
- Add map bounding-box/radius APIs and PostGIS GiST indexes.
- Use `ST_Covers` to find every covering organization.
- Add image compression, upload progress, thumbnails, and safe retry.
- Add abuse rate limits and probable-duplicate suggestions.
- Add configurable highlight/unaddressed archival jobs.

### Phase 4 — Independent review and cleanup-event claiming

- Add one organization review per incident/tenant.
- Calculate false counts from distinct current reviews.
- Implement direct events and incident-linked events.
- Add organization-specific workflow statuses/transitions.
- Enforce one incident-claiming active event with a partial unique index and HTTP 409 conflict mapping.
- Add sessions and same-tenant coordinator validation.

### Phase 5 — Volunteer participation and event operations

- Implement immediate event joining and withdrawal.
- Add multi-session availability and capacity-aware allocations.
- Add participant/internal notes with visibility rules.
- Add attendance, progress, evidence, cancellation, completion, and incident resolution.
- Add direct-ID cross-event negative tests.

### Phase 6 — Notifications and background processing

- Persist device tokens and notifications.
- Add Redis caching, rate limits, locks, idempotency keys, and BullMQ-style queues.
- Process Expo push, thumbnails, exports, analytics, and reminders in workers.
- Deactivate invalid push tokens and record delivery failures.

### Phase 7 — Rewards, analytics, reliability, and deployment

- Add idempotent contribution events, points, badges, and privacy-safe highlights.
- Build tenant analytics and platform aggregates without exposing private data.
- Add request IDs, structured logs, slow-query monitoring, audit search, and alerts.
- Add CI for typecheck, lint, tests, Prisma validation, and builds.
- Containerize/deploy web and API; keep PostgreSQL/Redis private.
- Add database backups, migration runbooks, dependency/security scanning, load tests, accessibility tests, and end-to-end tests.

## 20. CV-ready content

### Project title options

- EcoTrack — Multi-Tenant Environmental Coordination SaaS
- EcoTrack — Geospatial Incident Reporting and Cleanup Platform
- EcoTrack — Full-Stack TypeScript Community Action Platform
- EcoTrack — Secure Multi-Tenant SaaS with PostGIS

### One-line CV entry

Built a full-stack TypeScript foundation for a multi-tenant environmental coordination SaaS using React, Express, Supabase Auth, Prisma/PostgreSQL, CASL, and PostGIS.

### Compact two-line entry

Developed EcoTrack, a multi-tenant environmental reporting and cleanup-coordination platform using React, Node.js/Express, TypeScript, Supabase Auth, Prisma, PostgreSQL, CASL, and PostGIS. Implemented passwordless authentication, tenant-aware authorization, official GN Division onboarding, transactional persistence, and tested REST APIs.

### Strong team-project bullets

- Engineered a modular-monolith TypeScript platform with React/Vite and Express/Prisma, separating routes, middleware, controllers, services, repositories, and database concerns.
- Implemented passwordless Supabase magic-link authentication with backend Bearer-token verification, profile provisioning/synchronization, account-status checks, and role-aware dashboards.
- Designed tenant isolation with CASL abilities, verified organization membership context, repository-level filters, PostgreSQL RLS, revoked direct client privileges, and Organization A/B attack tests.
- Built a transactional organization-onboarding flow that validates 1–10 official Sri Lankan GN Divisions, creates pending service-area links, generates collision-resistant slugs, and records audit events.
- Integrated PostGIS `MultiPolygon` boundaries and GiST indexes, plus an idempotent paginated importer for official Sri Lanka NSDI GN Division GeoJSON data.
- Produced eight responsive mobile/desktop SRS interface prototypes and a production web application with typed API errors, loading/error/empty states, preview isolation, and accessibility-aware CSS.
- Modeled a 30-table future PostgreSQL domain covering incidents, independent organization reviews, cleanup workflows, multi-day sessions, volunteer availability, notifications, rewards, and audit history.

### Backend-focused bullets

- Built seven REST routes in Express 5 with strict TypeScript, Zod validation, centralized application errors, dependency-injected routers, graceful shutdown, and Prisma 7 PostgreSQL access.
- Implemented layered authentication and authorization middleware using Supabase Auth and CASL, including active-account enforcement and cross-tenant direct-ID protection.
- Created/reviewed Prisma migrations with custom PostgreSQL SQL for RLS, privilege revocation, partial unique indexes, PostGIS geography columns, GiST indexes, and integrity checks.
- Developed 25 integration tests across authentication, roles, tenant boundaries, application validation, transactional creation, and requester-scoped access.

### Frontend-focused bullets

- Built a responsive React 19 application for passwordless authentication, role-based citizen/Super Admin dashboards, organization onboarding, and authenticated GN Division search.
- Implemented robust session synchronization with Supabase auth-state listeners, stale-operation protection, typed API clients, and consistent error/loading/empty states.
- Created a reusable environmental design system with responsive grids, accessible form labels/focus states, status chips, mobile breakpoints, and reduced-motion support.

### Database/geospatial-focused bullets

- Designed a 30-table multi-tenant PostgreSQL ERD with audit history, soft lifecycle states, composite tenant integrity, and concurrency-safe cleanup-event claims.
- Modeled official administrative boundaries as PostGIS `geography(MultiPolygon,4326)` and planned boundary-inclusive `ST_Covers` incident routing with GiST acceleration.
- Implemented an idempotent NSDI GeoJSON import pipeline using stable official codes, source/version metadata, geometry validation, pagination, and upserts.

### Use numbers carefully

Defensible repository numbers at the audit date are:

- 7 current HTTP routes including health;
- 10 current Prisma application models;
- 30 planned public tables in the final DBML ERD;
- 25 backend tests, with 24 passing in the latest audited run;
- 8 SRS UI screens and PNG outputs;
- approximately 8,000 lines across audited hand-written backend and production-web TypeScript/TSX/CSS;
- 43 Git commits across two author identities.

Do not imply that all numbers are your personal contribution unless attribution supports it.

## 21. Interview talking points

### “Why is EcoTrack multi-tenant?”

Many independent environmental organizations share the platform. Their memberships, workflows, notes, participant contact data, and analytics must remain isolated. Incidents are intentionally shared and location-routed, while cleanup events are tenant-owned. That distinction is the central domain challenge.

### “How do you prevent cross-tenant access?”

The API verifies the Supabase token, loads an active application profile, resolves the organization membership from backend data, constructs CASL abilities, checks the action, and filters every tenant-owned query by the verified organization ID. PostgreSQL constraints/RLS are defense in depth. Integration tests change route IDs from Organization A to Organization B to prove denial.

### “Why doesn’t an incident have `organizationId`?”

A new incident can fall inside several overlapping service areas. It must remain one shared record discoverable by all covering organizations. Each organization stores a private review row; the cleanup event created later belongs to one organization.

### “How will you stop two organizations creating the same active cleanup event?”

Publication runs in a transaction and PostgreSQL enforces a partial unique index for incident-linked events in claiming lifecycle states. The first valid transaction wins and the second unique conflict becomes HTTP 409. Redis or a disabled UI button may reduce duplicate attempts but is not the final consistency mechanism.

### “Why use both Supabase and Prisma?”

Supabase Auth handles identity, magic links, access tokens, refresh tokens, and sessions. Prisma handles application tables and domain queries. This keeps authentication outsourced to a secure provider while preserving a strongly typed, backend-controlled domain layer.

### “Why PostGIS?”

The key routing rule is geometric: every approved active service area covering an incident point should discover it. PostGIS provides correct spatial types, `ST_Covers`, and GiST indexes. Simple string region names or only latitude/longitude comparisons would not handle irregular and overlapping boundaries reliably.

### “Why a modular monolith instead of microservices?”

The team and semester scope benefit from one deployable API and straightforward transactions. Domain modules preserve separation without distributed-system overhead. Heavy asynchronous execution can move to workers later without extracting ordinary domain logic.

### “What was a difficult engineering problem?”

A strong answer is the separation between shared incidents and tenant-owned operational data. The design had to allow several organizations to see and independently review the same location-routed incident while preventing access to one another’s notes, members, participants, and analytics. The solution combines PostGIS visibility, per-organization review records, backend tenant context, CASL, repository filters, constraints, and negative tests.

### “What would you improve next?”

First make tests deterministic, finish the Super Admin approval transaction, and add CI. Then scaffold the mobile app and implement incidents end to end before adding Redis or advanced analytics. This order validates the core product loop before introducing infrastructure complexity.

## 22. STAR stories to adapt

### Multi-tenant authorization

- **Situation:** Multiple organizations needed one platform without exposing private tenant data.
- **Task:** Create authorization that handled platform roles, organization roles, account status, and record ownership.
- **Action:** Combined Supabase identity, Prisma membership lookup, CASL abilities, tenant middleware, repository filters, RLS, and Organization A/B negative tests.
- **Result:** The current API rejects role escalation and direct-ID cross-tenant access while allowing authorized organization-specific operations.

### Official geographic onboarding

- **Situation:** Freehand applicant polygons could be invalid, duplicated, or abused to access unrelated incidents.
- **Task:** Provide accurate, reviewable Sri Lankan service areas.
- **Action:** Modeled official GN Divisions in PostGIS, built a paginated/idempotent NSDI GeoJSON importer, exposed authenticated search, and stored foreign-key selections transactionally.
- **Result:** Applicants select stable official areas and the platform can later route incidents with indexed spatial queries.

### Passwordless full-stack authentication

- **Situation:** The product required one low-friction citizen/volunteer account without application-managed passwords.
- **Task:** Connect Supabase sessions to backend-controlled roles and account state.
- **Action:** Implemented magic-link login, callback/session restoration, Bearer verification, profile upsert, identity-conflict handling, active-status checks, and safe profile responses.
- **Result:** The web application restores authenticated sessions and renders protected role-aware experiences without storing passwords.

## 23. ATS and job-search keywords

Use the keywords that match the internship description and your actual contribution:

`TypeScript`, `JavaScript`, `Node.js`, `Express.js`, `React`, `Vite`, `REST API`, `PostgreSQL`, `Supabase`, `Prisma ORM`, `PostGIS`, `SQL`, `GeoJSON`, `geospatial`, `multi-tenant SaaS`, `RBAC`, `ABAC`, `CASL`, `JWT`, `passwordless authentication`, `magic links`, `Row Level Security`, `database migrations`, `transactions`, `partial unique indexes`, `GiST indexes`, `Zod`, `integration testing`, `responsive design`, `accessibility`, `modular monolith`, `domain modeling`, `Git`, `team collaboration`.

Best-fit internship categories:

- Software Engineer Intern
- Full-Stack Developer Intern
- Backend/Node.js Developer Intern
- TypeScript Developer Intern
- React Developer Intern
- Database/PostgreSQL Intern
- Geospatial/GIS Software Intern
- SaaS Platform Engineering Intern

## 24. Portfolio case-study structure

Use this order on a website or application form:

1. **Hero:** EcoTrack name, one-line value proposition, stack, and best screenshot.
2. **Problem:** fragmented environmental reporting and volunteer coordination.
3. **Users:** citizen/volunteer, organization member/admin, Super Admin.
4. **Core domain insight:** shared location-routed incidents versus tenant-owned cleanup events.
5. **Architecture:** modular-monolith request flow and future worker flow.
6. **Security:** passwordless auth, CASL, tenant filters, RLS, negative tests.
7. **Geospatial:** official GN boundaries, PostGIS types, `ST_Covers`, GiST.
8. **Implementation:** current auth, onboarding, dashboards, APIs, and transaction.
9. **Design:** production UI plus clearly labeled SRS prototypes.
10. **Testing:** current evidence and known issues.
11. **Your contribution:** link to your commits/PRs and explain decisions you personally owned.
12. **Roadmap:** Super Admin review → mobile → incidents → cleanup lifecycle → notifications/rewards.

Recommended portfolio media:

- production magic-link screen;
- citizen dashboard;
- organization application and GN selector;
- production Super Admin foundation dashboard;
- one future mobile map prototype clearly labeled “SRS prototype”;
- a small architecture diagram;
- a simplified ERD or geospatial flow diagram.

Never present fictional mockup metrics (for example volunteer counts or impact hours) as real product results.

## 25. Machine-readable brief for a CV/portfolio engine

```yaml
project:
  name: EcoTrack
  type: team academic full-stack SaaS project
  domain: environmental incident reporting and cleanup coordination
  status: foundation and organization onboarding implemented; complete lifecycle planned
  one_liner: >-
    Multi-tenant environmental coordination platform using location-aware
    incident routing, verified organizations, and voluntary cleanup events.
  architecture: modular monolith with layered domain modules and planned workers
  current_apps:
    backend: Node.js, Express, TypeScript
    web: React, TypeScript, Vite
    mobile: planned React Native and Expo; currently not implemented
  technologies:
    - TypeScript
    - React
    - Node.js
    - Express
    - Supabase Auth
    - PostgreSQL
    - Prisma
    - PostGIS
    - CASL
    - Zod
    - Helmet
    - CORS
    - GeoJSON
  implemented_features:
    - passwordless magic-link authentication
    - backend Bearer-token verification
    - profile provisioning and synchronization
    - role-aware citizen and Super Admin dashboards
    - CASL abilities and tenant middleware
    - cross-tenant authorization tests
    - organization application create/list/detail
    - authenticated GN Division search
    - transactional organization, service-area, and audit creation
    - official NSDI GN Division import into PostGIS
    - RLS and revoked direct frontend table privileges on foundation tables
  designed_future_features:
    - shared location-routed incidents
    - independent per-organization incident review
    - concurrency-safe cleanup-event claims
    - direct cleanup events
    - multi-day sessions and volunteer availability
    - event coordinators, attendance, notes, and evidence
    - Expo push notifications and Redis workers
    - non-monetary contribution rewards and analytics
  differentiators:
    - shared incidents but tenant-owned operations
    - official Sri Lankan GN Division boundaries
    - PostGIS ST_Covers overlap handling
    - backend-enforced authorization and database defense in depth
    - PostgreSQL partial-index concurrency design
  audited_metrics:
    current_http_routes: 7
    current_prisma_models: 10
    planned_public_tables: 30
    backend_tests: 25
    latest_test_result: 24 passed, 1 failed due to test-data isolation/expectation
    srs_ui_screens: 8
    git_commits_all_authors: 43
  claim_rules:
    - State personal ownership only for work supported by commits or team evidence.
    - Label static mockup behavior as prototype/design.
    - Label ERD-only modules as planned.
    - Do not claim all tests pass at the audit date.
    - Do not claim complete RLS coverage until the newer geospatial tables are hardened.
```

## 26. Suggested prompts for other engines

### Tailor EcoTrack to a job description

```text
Using the EcoTrack project brief below and the attached job description, write
three ATS-friendly CV bullets. Prioritize technologies and responsibilities
that overlap with the job. Do not claim future features as implemented, do not
turn team work into personal ownership, and keep every bullet defensible in a
technical interview. Use strong action verbs and include only verified numbers.
```

### Create an interview introduction

```text
Turn this EcoTrack dossier into a 60-second spoken project explanation for a
software-engineering internship. Explain the problem, my exact contribution,
one difficult engineering decision, the stack, and what I would build next.
Use natural spoken English and avoid buzzword lists.
```

### Create a portfolio case study

```text
Create a concise portfolio case study from this EcoTrack dossier. Separate
implemented production work from SRS prototypes and roadmap features. Include
the shared-incident versus tenant-owned-event design, the security model,
PostGIS GN Division routing, testing evidence, lessons learned, and my exact
contribution. Do not invent users, performance gains, deployments, or outcomes.
```

## 27. Honest-claim checklist before applying

- Replace team-level bullets with your exact contribution.
- Link only to screenshots you can explain and label prototypes clearly.
- Do not say the mobile app exists yet.
- Do not say incident reporting or event scheduling is production-ready.
- Do not say Redis, Expo push, OpenStreetMap production maps, CI/CD, or cloud deployment are implemented.
- Do not say all tests pass until the current failures are fixed and rerun.
- Do not claim real user adoption, environmental impact, volunteer totals, performance gains, or uptime without measured evidence.
- Be ready to explain the middleware order, organization isolation, transaction boundaries, migration SQL, and PostGIS data model.
- If you use repository-wide counts, call EcoTrack a team project.

## 28. Highest-value improvements before sending applications

1. Fix test database isolation and make all 25 backend tests pass repeatedly.
2. Fix the static mockup’s unused imports or exclude it from production CI with a clearly documented reason.
3. Add a strong root README with setup, architecture, screenshots, current status, API summary, and honest roadmap.
4. Implement and demo the Super Admin approval transaction end to end.
5. Add GitHub Actions for backend typecheck/test/build/Prisma validation and web lint/build.
6. Add a small seed/demo dataset that contains no secrets or private data.
7. Record a 60–90 second demo video showing magic-link auth, citizen dashboard, GN search, submission, and application history.
8. Add an architecture diagram and simplified ERD image to the portfolio.
9. Clean commit messages and write PR descriptions that explain business decisions and verification.
10. Deploy a safe demo only after secrets, migrations, RLS, CORS, logs, and test data are reviewed.

## 29. Short final pitch

EcoTrack is a strong internship project because it goes beyond basic CRUD. It demonstrates identity integration, multi-tenant security, geospatial data, transactional workflows, custom SQL constraints, responsive UI design, and team-oriented architecture. The most credible way to present it is: **a working authentication and organization-onboarding foundation for a carefully designed environmental coordination platform, with a clear, technically rigorous roadmap to the complete incident and cleanup lifecycle.**
