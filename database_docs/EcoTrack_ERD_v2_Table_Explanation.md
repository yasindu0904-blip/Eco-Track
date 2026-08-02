# EcoTrack ERD v2 — Simplified Redesign and Table-by-Table Explanation

## 1. Purpose of the redesign

This redesign follows the latest EcoTrack source-of-truth flow rather than the older proposal wording. The important rules are:

- One account per person; every normal account can act as both Citizen and Volunteer.
- Supabase Auth provides passwordless magic-link identity.
- A citizen reports one shared incident and does not select an organization.
- Every active organization whose approved service-area boundary covers the incident can see the same incident.
- Each organization reviews the incident independently as `VIEWED`, `VALID`, or `FALSE`.
- The number of `FALSE` reviews is a calculated count, not a stored vote or global rejection.
- An interested organization may create the first active cleanup event linked to the incident.
- An organization may also create a direct cleanup event with no incident.
- Citizens join a published event immediately; there is no application or approval table.
- Multi-day availability and actual organization allocation are different facts and therefore use different tables.
- Super Admin reviews organization onboarding, documents, and service areas but does not assign incidents or volunteers.

The old ERD had 34 application tables plus the external `auth.users` representation. The redesigned ERD has **29 application tables plus `auth.users`**. It removes tables that duplicated audit information or made the workflow more complex than the semester MVP needs.

---

## 2. Main changes from ERD v1

### 2.1 Removed `organization_status_history`

The current status remains in `organizations.status`. Important changes such as approval, decline, suspension, and archival are recorded in the generic `audit_logs` table. A separate organization-status-history table would repeat much of the audit data without providing a separate user-facing timeline.

### 2.2 Replaced `incident_global_status_history`

The old name and statuses did not match the final flow. It is replaced by `incident_status_history`, which stores only the shared incident lifecycle:

`ACTIVE -> CLEANUP_ORGANIZED -> RESOLVED / EXPIRED -> ARCHIVED`

Organization-specific `VALID` and `FALSE` decisions do not belong in this global timeline. They belong in `incident_reviews`.

### 2.3 Replaced `incident_organization_states`

The old table was too general because it mixed review workflow concepts with incident visibility. It is replaced by `incident_reviews`, which directly represents the final business meaning:

- one incident;
- one reviewing organization;
- one current status: `VIEWED`, `VALID`, or `FALSE`;
- private reason/notes;
- the organization member who performed the review.

Incident visibility is not stored here. Visibility is calculated from `organization_service_areas.boundary` and `incidents.geo_point`.

### 2.4 Removed `incident_organization_state_history`

The current review is stored in `incident_reviews`. Changes such as `FALSE -> VALID` are recorded as audit events in `audit_logs`. A second dedicated review-history table is unnecessary for the MVP unless the team later needs a detailed organization-review timeline in the UI.

### 2.5 Simplified four workflow tables to two

The older design had:

- `workflow_definitions`
- `workflow_statuses`
- `workflow_transitions`
- `workflow_transition_roles`

The new design uses:

- `cleanup_workflow_statuses`
- `cleanup_workflow_transitions`

For the MVP, every organization has one cleanup-event workflow. Therefore, a separate `workflow_definitions` parent table is unnecessary. Role permissions are enforced by CASL and backend authorization, so `workflow_transition_roles` is also unnecessary.

The design still preserves configurable workflow labels and transitions, which are part of the original project requirement.

### 2.6 Renamed task tables to event tables

The user-facing term is Cleanup Event. Therefore:

- `cleanup_tasks` becomes `cleanup_events`
- `task_sessions` becomes `event_sessions`
- `task_coordinators` becomes `event_coordinators`
- `task_participants` becomes `event_participants`
- `task_session_assignments` becomes `session_allocations`
- `task_notes` becomes `event_notes`
- `task_evidence` becomes `event_evidence`
- `task_status_history` becomes `event_status_history`

### 2.7 Changed the incident relationship on cleanup events

The old `cleanup_tasks.incident_id` was required. That prevented a direct cleanup event.

The new relationship is:

- linked event: `cleanup_events.incident_id` contains an incident ID;
- direct event: `cleanup_events.incident_id` is `NULL`.

### 2.8 Removed `issue_report_attachments`

The MVP issue-report flow needs one optional screenshot. Therefore, `issue_reports.screenshot_path` is sufficient. If the final product later allows several attachments, a normalized attachments table can be added then.

### 2.9 Kept two status-history tables deliberately

`incident_status_history` and `event_status_history` remain because they support user-visible status timelines. They are not present only for normalization. They are present because the application must show how an incident or event progressed over time.

Generic security and administrative changes remain in `audit_logs`.

---

# 3. Table-by-table explanation

## A. Authentication and users

### 1. `auth.users` — external Supabase table

**Purpose:** Stores the Supabase authentication identity, confirmed email, and authentication timestamps.

**Created when:** A user completes the magic-link authentication flow for the first time.

**Used by:** Supabase Auth and backend authentication middleware.

**Important rule:** EcoTrack does not store a password. This table belongs to Supabase’s `auth` schema and is shown in the ERD only to explain the one-to-one identity link.

### 2. `user_profiles`

**Purpose:** Stores EcoTrack application information that does not belong in Supabase Auth, including name, phone number, platform role, and account status.

**Created when:** The backend provisions the user after the first verified magic-link login.

**Used by:** All modules.

**Important rule:** There is no separate Citizen table and no separate Volunteer table. Every active normal profile automatically has both capability sets. `platform_role` is normally `USER`; `SUPER_ADMIN` is the platform-level exception.

---

## B. Organization onboarding and membership

### 3. `organizations`

**Purpose:** Stores an existing real-world organization’s EcoTrack onboarding record and tenant/workspace.

**Created when:** A citizen submits an organization onboarding request.

**Updated by:** Super Admin when approving, declining, suspending, or archiving the organization.

**Used by:** Organization web dashboard, service-area matching, cleanup events, memberships, notifications, and analytics.

**Important rule:** A database row may exist while its status is `PENDING_REVIEW`, but EcoTrack is not legally creating the real-world organization.

### 4. `organization_verification_documents`

**Purpose:** Stores metadata for several government or official proof documents uploaded for one organization.

**Why separate:** One organization can submit many documents. Storing several file paths in one organization column would violate First Normal Form and would make document-level review impossible.

**Used by:** Super Admin organization review.

**Stored in database:** File metadata and review information.

**Stored in object storage:** Actual PDF/image file bytes.

### 5. `organization_service_areas`

**Purpose:** Stores one or more approved PostGIS polygons or multipolygons describing where the organization works.

**Why separate:** One organization may have several disconnected operating areas.

**Used by:** The spatial incident-discovery query.

**Flow:**

1. Citizen submits an incident point.
2. Backend finds all `ACTIVE` service-area boundaries for which `ST_Covers(boundary, incident.geo_point)` is true.
3. The same incident becomes visible to all matching organizations.

**Important rule:** The table does not own or duplicate incidents. The relationship is derived spatially.

### 6. `organization_memberships`

**Purpose:** Connects users and organizations and stores the user’s organization-specific role and membership status.

**Why separate:** Users and organizations have a many-to-many relationship. A user can be an admin in Organization A, a member in Organization B, and still be a normal citizen/volunteer everywhere.

**Important constraints:**

- unique `(organization_id, user_id)`;
- only active memberships provide access;
- at least one active `ORG_ADMIN` must remain in an active organization;
- a user cannot promote themselves;
- coordinator assignment does not change this role.

### 7. `organization_membership_requests`

**Purpose:** Stores a citizen’s request to be recognized as an `ORG_MEMBER` of an existing organization.

**Why separate from membership:** A request may remain pending, be declined, or be withdrawn and therefore may never produce a membership.

**Important rule:** Users cannot request `ORG_ADMIN` through this table.

---

## C. Configurable cleanup workflow

### 8. `cleanup_workflow_statuses`

**Purpose:** Stores the cleanup-event status labels configured for one organization.

**Example rows:**

- `DRAFT` / “Draft”
- `PUBLISHED` / “Open for Volunteers”
- `SCHEDULED` / “Volunteer Team Prepared”
- `IN_PROGRESS` / “Cleanup Underway”
- `COMPLETED` / “Cleanup Finished”
- `CANCELLED` / “Cancelled”

**Why `mapped_lifecycle_status` exists:** Organization labels may differ, but platform rules require stable meanings for publication, active-event uniqueness, cancellation, completion, and incident resolution.

**Why no `workflow_definitions`:** The MVP gives each organization one cleanup-event workflow. A separate definition table would only add another level with little value.

### 9. `cleanup_workflow_transitions`

**Purpose:** Stores the allowed paths between organization cleanup statuses.

**Example:** “Open for Volunteers” may move to “Volunteer Team Prepared,” but not directly to “Completed.”

**Why separate:** A status can have several next statuses, and a next status can be reached from several previous statuses. This is a many-to-many self-relationship.

**Why no role column:** CASL and backend services decide whether an Org Admin or assigned coordinator can perform the transition.

---

## D. Shared incidents and independent organization review

### 10. `incident_categories`

**Purpose:** Stores reusable incident types such as illegal dumping, water pollution, blocked drainage, or other approved categories.

**Why separate:** The category name and active state should be stored once rather than repeated as free text in every incident.

### 11. `incidents`

**Purpose:** Stores the one shared environmental report created by the citizen.

**Important fields:**

- reporter;
- category and severity;
- title and description;
- latitude/longitude and PostGIS point;
- shared lifecycle status;
- `highlight_until` and `archive_after` deadlines.

**Important rule:** There is no `organization_id`. The citizen does not choose an organization, and Super Admin does not assign one.

**Status flow:**

- `ACTIVE` — visible and available for organization review;
- `CLEANUP_ORGANIZED` — an active linked cleanup event exists;
- `RESOLVED` — linked cleanup has resolved the report;
- `EXPIRED` — no event was created during the configured active/unaddressed period;
- `ARCHIVED` — removed from default map views but retained in history.

### 12. `incident_photos`

**Purpose:** Stores metadata for one or more incident photos.

**Why separate:** An incident may contain several photos with order, captions, original paths, and thumbnails.

### 13. `incident_reviews`

**Purpose:** Stores one organization’s current independent review of one shared incident.

**Statuses:**

- `VIEWED`
- `VALID`
- `FALSE`

**Important constraints:** Unique `(incident_id, organization_id)`.

**How the false count works:**

```sql
SELECT COUNT(*)
FROM incident_reviews
WHERE incident_id = :incidentId
  AND status = 'FALSE';
```

The count is not stored on `incidents`. This avoids synchronization problems when an organization changes its review from `FALSE` to `VALID`.

**History:** Review changes are written into `audit_logs`, so a separate review-history table is not required for the MVP.

### 14. `incident_status_history`

**Purpose:** Stores the shared incident lifecycle shown to the reporter and users.

**Examples:**

- `ACTIVE -> CLEANUP_ORGANIZED`
- `CLEANUP_ORGANIZED -> RESOLVED`
- `ACTIVE -> EXPIRED`
- `EXPIRED -> ARCHIVED`

**Why this table remains:** The current status alone cannot show a timeline. This table is required by the “view status history” feature, not merely by normalization.

**System changes:** `changed_by_user_id` may be `NULL` for scheduled expiry/archive jobs. `related_cleanup_event_id` identifies the event that organized or resolved the incident.

---

## E. Cleanup events and volunteer coordination

### 15. `cleanup_events`

**Purpose:** Stores the public cleanup event owned by one organization.

**Two creation paths:**

- linked event — `incident_id` is populated;
- direct event — `incident_id` is `NULL`.

**Why both `lifecycle_status` and `current_workflow_status_id`:**

- `lifecycle_status` is the stable platform meaning used for database constraints and incident rules;
- `current_workflow_status_id` is the organization’s configurable label/stage.

This is controlled denormalization. The service updates both in one transaction.

**Critical constraint:** One incident may have several historical events after cancellation or follow-up, but only one active event at a time.

Recommended PostgreSQL index:

```sql
CREATE UNIQUE INDEX one_active_cleanup_event_per_incident
ON cleanup_events (incident_id)
WHERE incident_id IS NOT NULL
  AND lifecycle_status NOT IN ('COMPLETED', 'CANCELLED');
```

### 16. `event_sessions`

**Purpose:** Stores each actual cleanup date and time.

**Why separate:** A cleanup may run for one day, several days, or several periods on the same day. Storing dates as comma-separated text or an array inside `cleanup_events` would be difficult to validate, query, allocate, and record attendance against.

**Publication rule:** A published event must have at least one session.

### 17. `event_coordinators`

**Purpose:** Assigns one or more active organization memberships to coordinate one event.

**Why separate:** One event can have several coordinators, and one organization member can coordinate several events.

**Important rule:** This is task-specific authority and does not promote the person to `ORG_ADMIN`.

### 18. `event_participants`

**Purpose:** Records that a citizen voluntarily joined a cleanup event.

**Created when:** The user presses **Join Cleanup**.

**Important rule:** There is no application or approval table.

**Statuses:** `JOINED`, `WITHDRAWN`, and `REMOVED`.

**Unique rule:** A user can join the same event only once.

### 19. `participant_session_availability`

**Purpose:** Stores which event sessions the volunteer selected as available.

**Why separate:** Availability is a many-to-many relationship between one event participant and several event sessions.

**Meaning:** A row means “this volunteer says they are available for this session.”

### 20. `session_allocations`

**Purpose:** Stores the actual scheduling decision made by the Org Admin or assigned coordinator and later stores attendance.

**Why this cannot be merged with availability:**

- availability is the volunteer’s choice;
- allocation is the organization’s coordination decision;
- attendance is the observed result after the session.

Combining them would mix three different facts and would produce incorrect states.

**Statuses:** `PLANNED`, `ATTENDED`, `ABSENT`, and `REMOVED`.

### 21. `event_notes`

**Purpose:** Stores operational notes written by coordinators/admins.

**Visibility:**

- `PARTICIPANTS` — joined volunteers may read it;
- `INTERNAL` — only authorized organization users may read it.

**Why public instructions are not stored here:** General public instructions already belong in `cleanup_events.public_instructions`.

### 22. `event_evidence`

**Purpose:** Stores metadata for before, progress, and after evidence.

**Optional session link:** Evidence may describe the complete event or one specific session.

**Why separate:** One event can contain many files, captions, evidence types, and thumbnails.

### 23. `event_status_history`

**Purpose:** Stores the cleanup-event workflow timeline displayed to joined volunteers and organization users.

**Why it remains:** Current status does not provide a historical timeline. Event history is a user-visible business feature.

---

## F. Rewards, notifications, support, and audit

### 24. `contribution_events`

**Purpose:** Stores an immutable reason why a user received contribution points.

**Examples:**

- a reported incident became verified;
- a volunteer attended a cleanup session;
- an event was completed;
- an authorized special contribution was recorded.

**Why not store only `total_points` in `user_profiles`:** A total alone cannot explain where points came from, cannot prevent duplicate awards safely, and is harder to audit. The total is calculated using `SUM(points)` or cached as a derived value.

### 25. `achievement_definitions`

**Purpose:** Stores reusable badge/achievement rules and presentation information.

**Examples:** “First Cleanup,” “Five Cleanups,” or “Verified Community Contributor.”

**`highlight_on_map`:** Indicates whether the award can produce a privacy-safe contributor marker.

### 26. `user_achievements`

**Purpose:** Connects users to awarded achievement definitions.

**Why separate:** This is a many-to-many relationship: one user can earn several achievements, and one achievement can be earned by many users.

### 27. `user_devices`

**Purpose:** Stores Expo push tokens for each user/device.

**Why separate:** A user can sign in on several devices, and device tokens can be independently activated or invalidated.

### 28. `notifications`

**Purpose:** Stores the permanent in-app notification record.

**Important rule:** Expo Push Notification is only the delivery mechanism. If push fails, this row still allows the user to see the notification in the application.

**`data` JSON:** Contains safe navigation identifiers such as `incidentId`, `cleanupEventId`, or `sessionId`.

### 29. `issue_reports`

**Purpose:** Stores an application-support report submitted by any user.

**MVP simplification:** One optional screenshot is stored in `screenshot_path`, so a separate attachments table is not needed.

### 30. `audit_logs`

**Purpose:** Stores security- and administration-significant actions across modules.

**Examples:**

- organization approved, declined, suspended, or archived;
- service area approved or changed;
- membership approved, removed, promoted, or demoted;
- incident review changed from `FALSE` to `VALID`;
- coordinator assigned or removed;
- participant removed;
- account suspended;
- exceptional Super Admin access.

**Why generic:** Audit records have the same basic structure across many entity types. A generic audit table avoids creating a separate history table for every administration action.

**Why it does not replace all history:** Incident and event status histories remain separate because they are user-facing domain timelines. Audit logs are primarily for security, administration, and investigation.

---

# 4. Tables required mainly because of normalization

The following tables should not be removed merely to reduce the table count:

| Table | Normalization reason |
|---|---|
| `organization_verification_documents` | One organization has many documents. |
| `organization_service_areas` | One organization has many independent boundaries. |
| `organization_memberships` | Many users belong to many organizations. |
| `organization_membership_requests` | A request exists before and independently of an approved membership. |
| `cleanup_workflow_transitions` | Many statuses may connect to many statuses. |
| `incident_photos` | One incident has many files. |
| `incident_reviews` | Many organizations independently review many incidents. |
| `event_sessions` | One event has several real dates/times. |
| `event_coordinators` | Many memberships coordinate many events. |
| `event_participants` | Many users join many events. |
| `participant_session_availability` | Many participants are available for many sessions. |
| `session_allocations` | Many participants are allocated to many sessions and the relationship has attendance data. |
| `event_evidence` | One event has several evidence files. |
| `user_achievements` | Many users earn many achievement definitions. |
| `user_devices` | One user may have several devices/tokens. |

Removing these tables would usually create arrays, repeated columns, comma-separated values, duplicated records, or fields that contain several unrelated facts.

---

# 5. Values that must be derived rather than stored

The new ERD deliberately does not store these as editable columns:

- **Organizations visible to an incident** — derived using PostGIS service-area coverage.
- **False review count** — count current `incident_reviews` where status is `FALSE`.
- **Has active cleanup event** — query `cleanup_events` and protect it with a partial unique index.
- **Volunteer status/role** — every normal account already has volunteer capability.
- **User total points** — sum `contribution_events.points` or use a rebuildable cache.
- **Organization task count / participant count** — database aggregation or cached analytics.
- **Whether an organization can act** — backend authorization based on active membership, role, service area, record state, and CASL rules.

This prevents duplicated values from becoming inconsistent.

---

# 6. Important database constraints not completely visible in an ER diagram

The backend and PostgreSQL migration should enforce:

1. One active cleanup event per non-null incident.
2. One pending membership request per user/organization.
3. `event_sessions.end_time > start_time`.
4. Latitude between `-90` and `90`; longitude between `-180` and `180`.
5. Session capacity is null or greater than zero.
6. An event coordinator membership belongs to the event’s organization.
7. An incident reviewer membership belongs to the reviewing organization.
8. Participant availability and allocation sessions belong to the same cleanup event as the participant.
9. An active organization has at least one active approved service area and one active Org Admin.
10. A published cleanup event has at least one session and one coordinator.
11. The final active Org Admin cannot be removed or demoted.
12. Cleanup workflow statuses used by an event belong to that event’s organization.
13. The `contribution_events` source column matches its contribution type.
14. Points cannot be negative unless the team explicitly introduces penalties later.
15. PostGIS GiST indexes exist on `organization_service_areas.boundary`, `incidents.geo_point`, and `cleanup_events.event_geo_point`.

Some rules require service validation or deferred database triggers because a normal foreign key cannot enforce “the parent must have at least one child.”

---

# 7. Prisma/PostGIS implementation note

Prisma should manage normal models, relations, CRUD, transactions, and most indexes. PostGIS fields may be represented as unsupported spatial fields in Prisma, and parameterized SQL/TypedSQL should be isolated in geospatial repositories for:

- `ST_Covers` — find organizations covering an incident;
- `ST_DWithin` — nearby incidents/events;
- viewport/bounding-box map queries;
- spatial distance sorting.

Custom SQL migrations are also required for the PostGIS extension, GiST indexes, partial unique indexes, and some check constraints.

---

# 8. Recommended review order for the team

Review the ERD in this order:

1. **Incident flow:** `incidents`, `organization_service_areas`, `incident_reviews`, and `cleanup_events`.
2. **Cleanup scheduling:** `event_sessions`, `event_participants`, availability, and allocations.
3. **Organization access:** organizations, memberships, requests, documents, and areas.
4. **Workflow:** decide whether one configurable workflow per organization is enough for the MVP.
5. **Rewards:** confirm contribution types and achievement thresholds.
6. **Support:** confirm whether one issue screenshot is enough.
7. **Fields:** add only fields required by confirmed screens/APIs; avoid adding speculative fields.

The recommended version is normalized enough for implementation but intentionally avoids history, configuration, and attachment tables that do not currently provide clear MVP value.
