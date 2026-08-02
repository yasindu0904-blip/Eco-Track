# EcoTrack ERD v1 — Relationship Requirements and Normalization Notes

## Recommended tool

Use **dbdiagram.io with DBML** for the team-review stage. Paste `EcoTrack_ERD_v1.dbml` into a new diagram. It will draw the entities, primary keys, foreign keys and relationship lines automatically. After the team finalizes the design, keep the DBML for documentation and translate the accepted schema into Prisma/PostgreSQL migrations.

## Important interpretation rules

1. Every normal user is both a citizen and a potential volunteer. There is no separate Volunteer table and no volunteer activation.
2. Supabase Auth owns identity and passwordless email sessions. EcoTrack stores only the application profile linked by `auth_user_id`.
3. Incidents are shared platform records and do not contain `organization_id`.
4. Which organizations can see an incident is calculated by PostGIS using the incident point and active organization service-area polygons.
5. A cleanup task belongs to one organization and one incident.
6. One incident may have several historical tasks over time, but at most one active task at a time.
7. A citizen joins a task immediately. This is not an application and does not require approval.
8. Multi-day tasks are normalized into `task_sessions`; availability and actual session allocation are separate relationships.
9. Organization members assigned in `task_coordinators` can manage that task without becoming organization admins.
10. Super Admin reviews organization onboarding and sees platform information; Super Admin does not assign incidents, volunteers or cleanup work.

## Main min/max cardinalities

| Relationship | Left-side cardinality | Right-side cardinality | Meaning / enforcement |
|---|---:|---:|---|
| Supabase Auth User — User Profile | Auth User `0..1` profile | Profile `1..1` auth user | Profile is created after first verified login. `user_profiles.auth_user_id` is NOT NULL and UNIQUE. |
| User — Requested Organization | User `0..*` organizations | Organization `1..1` requester | One existing real organization request has exactly one submitting user. |
| Organization — Verification Document | Organization `1..*` documents before activation | Document `1..1` organization | FK enforces document-to-org; service rule enforces at least one required document. |
| Organization — Service Area | Organization `1..*` active areas | Area `1..1` organization | FK enforces each area’s organization. “At least one” is checked before activation. |
| Organization — Membership | Organization `1..*` active memberships after approval | Membership `1..1` organization | Approved organization must have at least one active ORG_ADMIN. |
| User — Organization Membership | User `0..*` memberships | Membership `1..1` user | A user can be member/admin in multiple organizations. |
| Organization — Membership Request | Organization `0..*` requests | Request `1..1` organization | Citizen requests only member access. |
| User — Membership Request | User `0..*` requests | Request `1..1` user | One user cannot have duplicate pending request for same org; enforce with service/partial unique index. |
| User — Incident | User `0..*` incidents | Incident `1..1` reporter | Every incident has one reporter. |
| Incident Category — Incident | Category `0..*` incidents | Incident `1..1` category | Category is mandatory. |
| Incident — Incident Photo | Incident `1..*` photos for submitted report | Photo `1..1` incident | Database allows `0..*` while drafting; submission validation requires at least one photo if the SRS keeps photo mandatory. |
| Organization — Visible Incident | Organization `0..*` incidents | Incident `0..*` organizations | **Derived spatial M:N relationship**, not stored as a normal join table. |
| Incident — Organization State | Incident `0..*` org states | State `1..1` incident | Created only when an organization interacts with the shared incident. |
| Organization — Incident State | Organization `0..*` states | State `1..1` organization | Unique `(incident_id, organization_id)`. |
| Incident — Cleanup Task | Incident `0..*` historical tasks; `0..1` active | Task `1..1` incident | Use a PostgreSQL partial UNIQUE index for active statuses. |
| Organization — Cleanup Task | Organization `0..*` tasks | Task `1..1` organization | Tenant ownership is mandatory. |
| Cleanup Task — Task Session | Draft task `0..*`; published task `1..*` sessions | Session `1..1` task | At least one session is required before publishing. |
| Cleanup Task — Coordinator | Task `1..*` coordinators before publishing | Coordinator row `1..1` task | Join table connects task to an organization membership. |
| Organization Membership — Coordinated Task | Membership `0..*` tasks | Coordinator row `1..1` membership | Membership must belong to the task’s organization. |
| Cleanup Task — Participant | Task `0..*` participants | Participant row `1..1` task | Row is created immediately when a citizen presses Join. |
| User — Task Participant | User `0..*` joined tasks | Participant row `1..1` user | Unique `(task_id, user_id)`. |
| Participant — Available Session | Participant `1..*` chosen sessions for multi-day task | Availability row `1..1` participant and session | Row existence means available. |
| Participant — Session Assignment | Participant `0..*` assigned sessions | Assignment `1..1` participant and session | Coordinator divides volunteers by day; unique `(participant_id, session_id)`. |
| Cleanup Task — Task Note | Task `0..*` notes | Note `1..1` task | Only authorized coordinators/admins write; joined volunteers can read. |
| User — Contribution Event | User `0..*` events | Event `1..1` user | Used to calculate points and rewards. |
| Achievement — User Achievement | Achievement `0..*` awards | Award `1..1` achievement and user | Unique per user/achievement unless repeatable achievements are added later. |
| User — Device | User `0..*` devices | Device `1..1` user | Supports Expo push tokens. |
| User — Notification | User `0..*` notifications | Notification `1..1` user | Notification history is the source of truth; push is only delivery. |

## Why some “at least one” rules are not visible as a normal FK

A foreign key can enforce the child side, for example:

- `accident.car_id NOT NULL` means every Accident has exactly one Car.
- It does **not** by itself guarantee that every Car has at least one Accident.

The same applies to EcoTrack:

- `organization_service_areas.organization_id NOT NULL` guarantees every area belongs to one organization.
- The rule “an active organization must have at least one service area” must be enforced in the approval transaction, service validation, a deferred constraint/trigger, and tests.

Use crow’s-foot labels in the report plus a written business-rule table like the one above.

## Normalization

### First Normal Form (1NF)

All columns contain atomic values. Do not store:

- several service areas in one organization column;
- several task dates in one text field;
- volunteer IDs as a comma-separated list;
- photo paths as a JSON array when photos need their own metadata;
- several roles in one string.

Separate tables such as `organization_service_areas`, `task_sessions`, `task_participants`, and `incident_photos` satisfy 1NF.

### Second Normal Form (2NF)

Many-to-many relationships use junction tables whose non-key facts depend on the full relationship:

- `task_coordinators`
- `task_participants`
- `task_participant_availability`
- `task_session_assignments`
- `workflow_transition_roles`

For example, attendance status depends on both the participant and the session, so it belongs in `task_session_assignments`, not in `user_profiles` or `task_sessions`.

### Third Normal Form (3NF)

Reusable facts are stored once:

- Organization details are in `organizations`, not copied into every task.
- User contact data is in `user_profiles`, not copied into participant rows.
- Incident category names are in `incident_categories`.
- Task dates are in `task_sessions`.
- Achievement definitions are separated from awards.
- Workflow statuses are separated from tasks and state-history rows.

Avoid storing derived values such as:

- `incident.has_active_task`
- `user.total_points`
- `organization.total_tasks`
- `task.volunteer_count`

Calculate them from related rows or cache them in Redis/materialized summaries later. The active-task rule should be enforced with a partial unique index, not a manually maintained Boolean.

## Controlled implementation exceptions

`incidents` contains latitude, longitude and a PostGIS point. This is controlled denormalization for easy mobile/API use plus spatial indexing. Keep them synchronized in one transaction or make the PostGIS value generated from coordinates.

## Database constraints to add in PostgreSQL/Prisma migrations

1. Partial unique index: one active cleanup task per incident.
2. Check `task_sessions.end_time > start_time`.
3. Check latitude is between `-90` and `90`; longitude between `-180` and `180`.
4. Check `capacity` is NULL or greater than zero.
5. Check `contribution_events.points >= 0`.
6. Check contribution event source matches its event type.
7. Prevent self-promotion or unauthorized ORG_ADMIN creation in service authorization.
8. Prevent removal of the last active ORG_ADMIN.
9. Ensure task coordinator memberships belong to the same organization as the task.
10. Ensure session availability/assignment rows use sessions from the same task as the participant.
11. Require at least one active service area and required verified documents before organization activation.
12. Require at least one task session and one coordinator before task publication.

## Team-review questions before the final ERD

1. Is an incident photo mandatory or optional?
2. Can another organization create a replacement task after cancellation only, or also after completion?
3. Can several organizations collaborate on one cleanup task, or is one organization always the sole owner for the semester MVP?
4. Are task coordinators allowed to mark attendance and remove joined volunteers, or should some actions remain admin-only?
5. Which exact incident and task workflow statuses are required in the default seed?
6. Which achievements are public on the map, and what user information is shown with them?
7. Which organization proof documents become mandatory after the legal research?
