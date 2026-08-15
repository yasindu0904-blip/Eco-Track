# EcoTrack Core Authorization Contract

Status: teammate handoff contract created by CORE-00. Incident, map, membership, notification, reward, dashboard, and cleanup-event tasks must import these contracts rather than inventing new permission strings.

## Responsibility boundary

- Supabase authentication proves identity.
- `requireCompletedProfile` blocks domain features until name/phone onboarding is complete.
- tenant middleware proves an active membership in the organization from the route.
- event authorization middleware proves the event belongs to that tenant and identifies an active event-specific coordinator assignment.
- CASL answers whether the verified context may attempt an action.
- services/repositories still enforce record state, spatial visibility, workflow transitions, ownership, same-event relationships, and tenant-filtered queries.
- frontend capability checks are UX only and never replace backend checks.

## Actions

Import `Actions` from `backend/src/authorization/actions.ts`.

Existing/general actions:

```text
Create, Read, ReadOwn, Update, Review, Approve, Decline,
ManageMembership
```

Core actions:

```text
ManageWorkflow, Publish, Join, Withdraw, ManageAvailability,
AssignCoordinator, Allocate, RemoveParticipant, RecordAttendance,
AddNote, UploadEvidence, Transition, Cancel, Complete, MarkRead
```

Do not pass raw action strings to `authorize`.

## Subjects

Import `Subjects` from `backend/src/authorization/subjects.ts`.

```text
Platform, UserProfile, OrganizationApplication, Organization,
OrganizationServiceArea, OrganizationMembership, Notification,
Incident, IncidentReview, CleanupWorkflow, CleanupEvent,
EventSession, EventCoordinator, EventParticipant,
ParticipantAvailability, SessionAllocation, EventNote,
EventEvidence, Contribution, Achievement, Dashboard
```

Do not create aliases such as `Task`, `VolunteerJob`, or `ReportReview` for these same core resources.

## Route middleware recipes

### Citizen or own-resource route

```ts
router.post(
  "/incidents",
  authenticate,
  requireCompletedProfile,
  abilityMiddleware,
  authorize(Actions.Create, Subjects.Incident),
  controller,
);
```

The service derives the reporter from `request.authentication.profile.id`; it never trusts a submitted reporter/user ID.

### Organization-scoped route

```ts
router.get(
  "/organizations/:organizationId/incidents",
  authenticate,
  requireCompletedProfile,
  createTenantMiddleware(authorizationDependencies),
  abilityMiddleware,
  authorize(Actions.Read, Subjects.Incident),
  controller,
);
```

The incident repository must additionally prove approved active service-area coverage or another permitted historical/event relationship because an Incident is shared, not tenant-owned.

### Event route usable by ORG_ADMIN or assigned coordinator

```ts
router.patch(
  "/organizations/:organizationId/events/:eventId/status",
  authenticate,
  requireCompletedProfile,
  createTenantMiddleware(authorizationDependencies),
  createEventAuthorizationMiddleware(authorizationDependencies),
  abilityMiddleware,
  authorize(Actions.Transition, Subjects.CleanupEvent),
  controller,
);
```

Order matters: event context is loaded before `abilityMiddleware`, so an ORG_MEMBER receives coordinator abilities only for that verified event.

### Concrete resource check

When a loader middleware has attached a trusted record, use `authorizeResource` with `createAuthorizationSubject`:

```ts
authorizeResource(Actions.Publish, (request) =>
  createAuthorizationSubject(
    Subjects.CleanupEvent,
    request.loadedCleanupEvent,
  ),
);
```

Feature code must type the loaded request property through Express augmentation. The repository query that loads it must already include the verified tenant filter.

## Role boundaries

### Active completed USER

- citizen incident create/read/own-report abilities;
- public cleanup-event read/join abilities;
- own withdrawal and availability abilities;
- own notifications, contributions, achievements, and dashboard;
- organization operations only through an active verified membership.

### ORG_ADMIN in active tenant

- manages memberships and workflow only in that organization;
- reviews the organization’s legitimately visible incidents;
- creates/publishes/transitions/cancels/completes organization events;
- manages same-organization coordinators, participants, allocations, attendance, notes, and evidence.

### ORG_MEMBER in active tenant

- does not automatically manage events;
- receives operational permissions only after `createEventAuthorizationMiddleware` proves a current coordinator assignment for the route event;
- cannot publish/cancel events or manage organization memberships;
- can perform allowed coordination, attendance, note/evidence, transition, and completion operations only for the assigned event, with service workflow checks still required.

### SUPER_ADMIN

- platform/dashboard oversight and organization-application review;
- public/oversight reads for organizations, service areas, incidents, and cleanup events;
- no ordinary incident creation, event publication, volunteer joining/allocation, attendance, cancellation, or completion ability.

### Incomplete or inactive profile

- incomplete active profile can read/update only its own profile so onboarding can finish;
- suspended or archived profile receives no protected abilities.

## Frontend handoff

Web exports:

```text
web/src/api/apiError.ts
web/src/authorization/authorizationUi.ts
```

Mobile exports:

```text
mobile/src/api/apiError.ts
mobile/src/authorization/authorizationUi.ts
```

`describeApiFailure` distinguishes authentication, incomplete profile, authorization, conflict, network, and unknown failures. A 403 must not sign out a valid user. `buildUiCapabilities` may hide actions using server-returned profile/membership/coordinator context, but every mutation still requires backend middleware and service checks.

## Required feature tests

Every tenant-owned feature creates Organization A and Organization B and attempts direct-ID access. Event features also test an ordinary ORG_MEMBER and an assigned coordinator. Shared incident features test service-area coverage and overlapping organizations. Do not rely only on `ability.can()` unit checks; test the real middleware/service/repository path as well.
