# EcoTrack ClickUp Core Feature Backlog

Purpose: copy each numbered section into one ClickUp task. This backlog starts from the current repository baseline and follows the mandatory rules in `docs/IMPORTANT/EcoTrack_Core_Feature_Parallel_Development_Guide.md`.

Every task is a vertical slice. “Done” means backend, web, mobile, authorization, error states, and verification are complete—not only a screen or only an endpoint.

## Current completed baseline

Do not recreate these items:

- web/mobile Supabase magic-link authentication and Bearer-token API flow;
- first-login name/phone profile completion and backend profile gate;
- CASL/tenant middleware foundation;
- organization application, GN Division selection, Super Admin review, organization activation, first ORG_ADMIN creation, audit record, and notification creation;
- administrative areas and organization service areas;
- incident/event/reward Prisma foundation and migrations;
- notification unread partial index;
- Docker and GitHub Actions CI.

## Delivery order

`CORE-00` is the first gate and must be merged before protected domain tasks. After that, independent tasks may run concurrently when their dependencies are merged.

| Order | Member 1 / integration owner | Member 2 / map and incidents | Member 3 / events and volunteering |
|---|---|---|---|
| Gate | CORE-00 authorization contract | Wait/review contract | Wait/review contract |
| Wave 1 | NOT-01 in-app notifications | MAP-01 map foundation | EVT-01 workflow defaults |
| Wave 2 | ACC-01 membership self-service | INC-01 incident reporting | EVT-02 drafts, sessions, coordinators |
| Wave 3 | ACC-02 membership administration | INC-02 spatial discovery | Continue EVT-02 linked-event integration and acceptance tests after its dependencies merge; this remains part of EVT-02, not a new task |
| Wave 4 | REW-01 rewards foundation | INC-03 organization review | EVT-03 publish/claim and public event details |
| Wave 5 | DASH-01 dashboards | MAP-02 role-specific map integration | EVT-04 join, availability, withdrawal |
| Wave 6 | INT-01 integration wiring and client parity | MAP-03 spatial/security regression | EVT-05 allocation, removal, attendance |
| Wave 7 | INT-02 cross-feature workflow verification | INC-04 incident regression | EVT-06 notes, evidence, lifecycle, cancellation, completion |

Dependencies are more important than the wave number. Do not begin a dependent task against an unmerged branch.

---

# Member 1 / Integration Owner Tasks

## CORE-00 — Expand authorization contracts for all core domains

**Owner:** Member 1  
**Suggested branch:** `feature/core-authorization-contracts`  
**Depends on:** current main  
**Blocks:** all protected incident, event, participation, reward, and dashboard mutations

### Goal

Extend the existing CASL foundation so future modules use one agreed vocabulary and middleware flow. Preserve current authentication, profile completion, organization application, and Super Admin behavior.

### Backend work

- Add only the actions required by the agreed flows: incident creation/review, workflow management, event draft/publish/update/transition/cancel/complete, coordinator management, join/withdraw, availability, allocation/removal/attendance, notes/evidence, notifications, rewards, and dashboards.
- Add typed subjects for Incident, IncidentReview, CleanupWorkflow, CleanupEvent, EventSession, EventCoordinator, EventParticipant, SessionAllocation, EventNote, EventEvidence, Contribution, Achievement, Notification, and Dashboard.
- Update ability construction using verified profile, active tenant membership, membership role, and event-coordinator context where required.
- Keep shared incidents separate from tenant-owned reviews/events. Do not give an organization access merely because the frontend supplied its ID.
- Ensure SUPER_ADMIN oversight does not accidentally grant ordinary organization operational actions.
- Add reusable authorization middleware/helper contracts that feature routes can consume.
- Update Express request typing only for verified backend context.

### Web work

- Add a feature-local authorization/error helper for consistent 401, 403, and profile-incomplete handling.
- Provide typed capability/context helpers used only to hide or disable UI actions. Make it clear they are not security enforcement.
- Preserve the current auth callback, onboarding gate, and role-aware dashboards.

### Mobile work

- Add the matching API error/capability UX helper using the existing auth session and API client.
- Ensure unauthorized actions show a clear message and return to a valid screen without signing out a valid user.
- Preserve deep linking and first-login profile onboarding.

### Tests and acceptance criteria

- [ ] Inactive/suspended profiles receive no protected abilities.
- [ ] Ordinary users can report/join but cannot perform organization operations.
- [ ] ORG_MEMBER does not automatically coordinate every event.
- [ ] ORG_ADMIN abilities are restricted to the active organization.
- [ ] Assigned coordinator permissions are restricted to assigned events.
- [ ] SUPER_ADMIN cannot perform ordinary tenant event/volunteer operations.
- [ ] Organization A direct-ID access to Organization B fails.
- [ ] Existing authentication/organization tests still pass.
- [ ] Backend typecheck, build, and all tests pass; web lint/build and mobile checks pass.

### Handoff

Publish the final action/subject list and protected-route middleware order in the PR so Members 2 and 3 import these contracts instead of inventing new strings.

---

## NOT-01 — In-app notification inbox and unread state

**Owner:** Member 1  
**Suggested branch:** `feature/in-app-notifications`  
**Depends on:** CORE-00  
**Database lock:** not expected; Notification table and unread index already exist

### Goal

Make existing and future notification records usable in web and mobile. PostgreSQL is the permanent inbox; push delivery remains a later task.

### Backend work

- Create a notifications module using route -> middleware -> controller -> service -> repository.
- Implement authenticated paginated list, unread-only list/filter, unread count, mark one as read, and mark all as read.
- Always derive `userId` from the authenticated profile. Never accept a target user ID from the client.
- Order by newest first using stable pagination and the existing unread partial index.
- Return only safe payload identifiers and never private review notes/contact data.
- Provide a reusable notification creation service/repository interface for later membership, incident, event, and reward use cases.

### Web work

- Add a notification inbox screen/panel with unread badge, newest-first list, empty/loading/error states, mark-one and mark-all actions.
- Route safe notification payloads to the relevant existing screen where possible; unknown payloads remain readable without crashing.
- Match the EcoTrack mockup styling.

### Mobile work

- Add the equivalent native inbox and unread badge.
- Refresh unread count on sign-in/app return and after read mutations without aggressive polling.
- Do not implement Expo push registration/delivery in this task.

### Tests and acceptance criteria

- [ ] A user sees only their notifications, including when another user’s notification ID is supplied.
- [ ] Read/unread transitions are idempotent.
- [ ] Pagination is stable and newest first.
- [ ] Unread count matches unread-list state.
- [ ] Organization/private data is not leaked through payloads.
- [ ] Existing organization approval/decline notifications appear correctly.
- [ ] Backend tests and all three application checks pass.

---

## ACC-01 — Profile editing and organization membership self-service

**Owner:** Member 1  
**Suggested branch:** `feature/membership-self-service`  
**Depends on:** CORE-00 and preferably NOT-01

### Goal

Let an authenticated user update allowed profile fields, find active organizations, request ORG_MEMBER access, view request status, and withdraw a pending request.

### Backend work

- Reuse the profiles module for updating full name and normalized phone number; email, platform role, status, and IDs are not client-editable.
- Add paginated active-organization search by safe public fields.
- Add membership-request create, list-my-requests, get status, and withdraw-pending operations.
- A citizen may request only ORG_MEMBER, never ORG_ADMIN.
- Reject requests for inactive organizations, existing active membership, and duplicate pending requests.
- Preserve historical approved/declined/withdrawn rows.
- Create an in-app notification for relevant organization admins when a request is submitted, without exposing unnecessary personal data.

### Web work

- Add Edit Profile, Find Organizations, Request Membership, and My Requests experiences.
- Show membership/request status chips and prevent duplicate clicks while a request is pending.
- Include useful validation and API error states.

### Mobile work

- Provide the same functions in native screens with keyboard-safe forms and weak-network retry behavior.
- Keep the citizen dashboard accessible regardless of organization membership.

### Tests and acceptance criteria

- [ ] Users can edit only allowed profile fields.
- [ ] Search returns only active organizations and paginates.
- [ ] Self-request cannot request ORG_ADMIN.
- [ ] Existing member and duplicate pending request are rejected.
- [ ] Only the requester can view/withdraw their request.
- [ ] Withdrawal is allowed only while pending.
- [ ] Web/mobile display real API data and all checks pass.

---

## ACC-02 — Organization membership administration

**Owner:** Member 1  
**Suggested branch:** `feature/membership-administration`  
**Depends on:** ACC-01, NOT-01, CORE-00

### Goal

Allow an active ORG_ADMIN to review membership requests and safely manage members inside only their organization.

### Backend work

- Add organization-scoped routes to list pending requests, approve, decline with notes, list members, add an existing EcoTrack user where policy permits, suspend/reactivate membership, and change ORG_MEMBER/ORG_ADMIN roles.
- Approving a request must transactionally update request state, create membership, record reviewer, create audit log, and create notification.
- Prevent self-promotion and unauthorized cross-organization operations.
- Prevent demotion/suspension/removal of the final active ORG_ADMIN.
- Use conditional updates so two admins cannot approve/decline the same pending request twice.
- Return 409 for already-reviewed/state-conflict operations.

### Web work

- Add pending-request review and member-management screens for the active organization.
- Include approve/decline confirmation, review notes, roles/statuses, and final-admin error messaging.
- Never display another organization’s member list.

### Mobile work

- Add equivalent organization-admin screens for request review and essential membership actions.
- Keep admin tools separated from the user’s citizen/volunteer area.

### Tests and acceptance criteria

- [ ] Approval is atomic and creates exactly one membership/audit/notification.
- [ ] Decline requires/records a useful reason.
- [ ] Organization A admin cannot inspect or mutate Organization B requests/members.
- [ ] Non-admin and suspended membership are rejected.
- [ ] Self-promotion and final-active-admin removal are rejected.
- [ ] Repeated/concurrent review returns stable conflict behavior.
- [ ] Full client and backend verification passes.

---

## REW-01 — Contribution rewards and achievements

**Owner:** Member 1  
**Suggested branch:** `feature/contribution-rewards`  
**Depends on:** CORE-00; coordinate contracts with INC-03 and EVT-05/EVT-06  
**Database lock:** required only if adding achievement seed data or a new constraint

### Goal

Create an idempotent reward service and user-facing contribution history. Rewards recognize verified actions but never grant permissions.

### Backend work

- Implement contribution creation for verified incident, attended session, completed event, and approved special contribution using existing models/partial uniqueness rules.
- Define reviewed point values/constants in one backend location; do not scatter numbers through controllers.
- Award qualifying active achievement definitions transactionally/idempotently.
- Provide read endpoints for authenticated user points, contribution history, and achievements.
- Expose a narrow service API that INC-03 and EVT-05/EVT-06 can call inside their business transactions.
- Never award full report points merely for submission; incident reward begins only after authorized validation.
- Never accept points, contribution type, or recipient user ID directly from an ordinary frontend request.

### Web work

- Add My Impact with total points, achievement cards, contribution history, and empty/loading/error states.
- Use privacy-safe labels; rewards must not look like payment or employment.

### Mobile work

- Add the equivalent impact/achievement screen and links from the citizen dashboard.
- Show why each contribution was awarded without exposing tenant-private notes.

### Tests and acceptance criteria

- [ ] Duplicate/retried source events award once.
- [ ] Report submission alone does not award verified-report points.
- [ ] Attendance and completion award only after authorized state changes.
- [ ] Achievement awards are unique per user/achievement.
- [ ] Points never alter CASL abilities.
- [ ] Users see only their private contribution detail; public marker data remains privacy-safe.

---

## DASH-01 — Citizen, organization, and Super Admin dashboard summaries

**Owner:** Member 1  
**Suggested branch:** `feature/dashboard-summaries`  
**Depends on:** ACC-02, NOT-01, INC-03, EVT-04, EVT-05, REW-01; complete after required provider tasks merge

### Goal

Replace presentation-only dashboards with efficient, role-correct summaries derived from real data.

### Backend work

- Add separate citizen, organization, and platform summary services/endpoints rather than one unrestricted response.
- Citizen summary: own reports by state, joined/upcoming events, unread notifications, and contribution totals.
- Organization summary: only active tenant’s covering incidents/reviews, owned events by lifecycle, upcoming sessions, joined participant counts, and membership-request count.
- Super Admin summary: platform-level aggregate counts only; no ordinary event-control actions or unnecessary private tenant data.
- Use grouped/count queries and indexes; do not load entire tables and count in JavaScript.
- Add date/range validation where summaries use time windows.

### Web work

- Connect the existing Citizen and Super Admin dashboards and add an organization dashboard in the mockup style.
- Provide navigation to feature screens only when the user has valid server-backed context.
- Show loading, empty, partial-error, and refresh states.

### Mobile work

- Add citizen and organization summary screens with compact cards and navigation to incidents, events, memberships, notifications, and impact.
- Super Admin mobile may remain summary-oriented but must use the real API if shown.

### Tests and acceptance criteria

- [x] Citizen counts contain only that user’s data.
- [x] Organization A dashboard contains no Organization B private values.
- [x] Super Admin receives aggregates without ordinary organization-operation privileges.
- [x] Queries remain paginated/aggregated and do not return large record collections.
- [x] Web/mobile dashboards navigate to real feature screens.
- [x] Full regression and CI pass.

---

# Member 2 / Map and Incident Tasks

## MAP-01 — Reusable web/mobile map and spatial request foundation

**Owner:** Member 2  
**Suggested branch:** `feature/map-foundation`  
**Depends on:** CORE-00  
**Dependency lock:** required for any map/location packages

### Goal

Create the one reusable EcoTrack map/location foundation used by incidents and cleanup events. Do not create feature-specific competing maps.

### Backend work

- Add shared Zod validation for latitude, longitude, bounding boxes, zoom/radius, page size, and maximum permitted spatial extent.
- Add a geospatial repository utility using safe parameterized SQL for PostGIS operations.
- Define a small GeoJSON-compatible feature contract for incident/event markers without private fields.
- Add a bounded administrative-area/location lookup only if required by the UI; never return every GN boundary in normal map responses.
- Document coordinate order consistently: API fields are latitude/longitude; PostGIS point construction uses longitude/latitude.

### Web work

- Install the approved OpenStreetMap-compatible map library under dependency lock.
- Build reusable map, marker, viewport, cluster, current-location, and confirmed-pin components/hooks in the map feature directory.
- Debounce viewport callbacks and ignore/cancel stale requests.
- Provide keyboard-accessible map alternatives and coordinate text fallback.
- Follow the mockup’s map/card layout and responsive behavior.

### Mobile work

- Build the matching native map/location-picker contract using an Expo-compatible library.
- Request foreground location only when the user asks; handle denied permission and manual pin selection.
- Do not continuously track the device.
- Make Android native dependency/rebuild instructions explicit.

### Tests and acceptance criteria

- [ ] Invalid/out-of-range coordinates and oversized bounds are rejected.
- [ ] Longitude/latitude order is proven by a known Sri Lankan coordinate test.
- [ ] Map components expose reusable typed props/events for Member 3.
- [ ] Viewport events are debounced and do not request national data.
- [ ] Permission denial still allows manual selection.
- [ ] Web build/lint, mobile typecheck/doctor/export, and backend tests pass.

### Handoff

Publish exact component names, marker contract, location-picker props, and package/native setup so Member 3 reuses them for cleanup-event locations.

---

## INC-01 — Incident categories, reporting, evidence, and My Reports

**Owner:** Member 2  
**Suggested branch:** `feature/incident-reporting`  
**Depends on:** MAP-01, CORE-00

### Goal

Let an authenticated profile-complete citizen report one shared environmental incident using GPS or a manually confirmed pin and then view their own reports.

### Backend work

- Add incident routes/controllers/services/repositories for active categories, create incident, list own reports, and own/public-safe detail.
- Validate title, description, category, severity, latitude, longitude, address text, and evidence metadata.
- Load PlatformSettings and store `highlightUntil`/`archiveAfter` at creation.
- Let the database trigger maintain `geo_point`; do not concatenate raw spatial SQL.
- Store the incident without organization ownership. The frontend must not provide an organization ID.
- Create initial status history in the same transaction.
- Add safe duplicate/retry protection according to the existing database capabilities; never silently merge nearby incidents.
- Implement the agreed Supabase Storage upload flow or signed-upload contract for incident photos; validate type/count/size and keep service-role credentials backend-only.

### Web work

- Add incident report form with reusable pin confirmation, category/severity controls, evidence progress/retry, validation, and success navigation.
- Add My Reports list/detail with global status and public-safe history.

### Mobile work

- Build the primary field-reporting experience with current-location/manual pin, photo capture/selection, compression/limits, upload progress, retry, and My Reports.
- Handle weak network failures without creating duplicate incidents.

### Tests and acceptance criteria

- [ ] A citizen can submit valid coordinates and receives one incident/history record.
- [ ] No organization ID is accepted or stored as incident ownership.
- [ ] Deadlines use PlatformSettings.
- [ ] Invalid category/coordinates/evidence are rejected.
- [ ] A user cannot access another reporter’s private fields.
- [ ] Retry does not create accidental duplicate records.
- [ ] Storage secrets never appear in clients or logs.

---

## INC-02 — Spatial incident discovery and covering-organization visibility

**Owner:** Member 2  
**Suggested branch:** `feature/incident-spatial-discovery`  
**Depends on:** INC-01

### Goal

Return small, indexed incident result sets for visible map bounds/nearby searches and allow organizations to discover incidents covered by approved active service areas.

### Backend work

- Add public-safe/authenticated bounding-box and radius discovery endpoints with pagination, status/category/time filters, and strict maximum limits.
- Use PostGIS spatial indexes and parameterized queries; inspect query plans for the primary paths.
- Add organization incident discovery using `ST_Covers` against approved active organization service areas.
- Return one incident even when multiple service polygons cover it; do not duplicate shared incidents.
- Preserve legitimate historical/event access where required by the source of truth.
- Calculate public false count from distinct current active-organization reviews without exposing private notes.
- Return minimal marker/list projections rather than full records/photos.

### Web work

- Connect viewport requests to the shared map, cluster incident markers, add filters/list synchronization, and show selected public incident detail.
- Add organization incident discovery view scoped to the active organization.

### Mobile work

- Add nearby/viewport incident browsing with clusters, compact list fallback, filters, selected detail, and refresh behavior.
- Do not continuously track location or refetch on every tiny movement.

### Tests and acceptance criteria

- [ ] Bounded/radius queries never return unbounded national data.
- [ ] Boundary points are included through `ST_Covers` semantics.
- [ ] Overlap returns one shared incident to each covering organization.
- [ ] Non-covering Organization B cannot use an ID to obtain Organization A’s private view/review data.
- [ ] Private notes and reporter contact details are absent from public map results.
- [ ] Spatial query/index tests and all app checks pass.

---

## INC-03 — Independent organization incident review

**Owner:** Member 2  
**Suggested branch:** `feature/organization-incident-review`  
**Depends on:** INC-02, NOT-01, REW-01 contract, ACC-02 membership context

### Goal

Allow an authorized active ORG_ADMIN or permitted organization operator to review only incidents legitimately visible to that organization.

### Backend work

- Add organization-scoped list/detail/review routes using tenant, ability, and record-level coverage checks.
- Support VIEWED, VALID, and FALSE updates on the single current review row per incident/organization.
- Require controlled reason code/private notes for FALSE according to validation rules.
- Changing FALSE to VALID updates the existing row; it does not create a second vote/reviewer count.
- Create review/audit/status-related records as appropriate and notify the reporter with public-safe wording.
- On the first authorized VALID result, invoke the idempotent verified-incident contribution service.
- Do not globally reject/remove an incident because one or several organizations mark FALSE.

### Web work

- Build the organization incident queue/detail/review screen in the active organization workspace.
- Show coverage context, evidence, public false count, this organization’s current review, private note controls, and create-event entry when allowed.

### Mobile work

- Add an organization incident review screen for authorized admins/members using the same API and status meanings.
- Keep citizen and organization modes visually distinct.

### Tests and acceptance criteria

- [ ] Only covering/historical-authorized organization context can review.
- [ ] Exactly one current review exists per incident/organization.
- [ ] Organization A cannot read/update Organization B review or private notes.
- [ ] FALSE does not change global status to rejected or block Organization B.
- [ ] VALID reward is idempotent.
- [ ] Reporter notification contains no private organization notes.
- [ ] Direct-ID and status-transition negative tests pass.

---

## MAP-02 — Role-specific map integration and spatial hardening

**Owner:** Member 2  
**Suggested branch:** `feature/role-specific-map-integration`  
**Depends on:** INC-03 and EVT-03 public-event contract

### Goal

Finish one coherent map experience for citizen/volunteer, organization, and Super Admin views, including published cleanup events supplied by Member 3.

### Backend work

- Extend the shared map response or coordinated endpoints to include public published-event markers without joining tenant-private operational data.
- Ensure citizen, organization, and Super Admin response projections follow their visibility boundaries.
- Add stable pagination/cursors, maximum bbox/radius, query timing instrumentation, and documented indexes.
- Add regression tests for overlap, boundary inclusion, dense marker sets, malformed bounds, and private-field exclusion.

### Web work

- Citizen map: active incidents, published events, own reports, joined events, marker clustering, filters, and list fallback.
- Organization map: covering incidents and owned events with links to review/operations.
- Super Admin map: platform oversight/public-safe data only, with no assignment or normal operation controls.
- Reuse the same map primitives instead of copying map state three times.

### Mobile work

- Complete citizen/volunteer map parity, including nearby events and navigation to reporting/event details.
- Provide organization map mode only when active membership context exists.
- Keep data usage bounded and errors recoverable.

### Tests and acceptance criteria

- [x] Each role sees the correct marker types/actions.
- [x] Super Admin cannot assign incidents or operate events from the map.
- [x] Organization A receives no Organization B private event information.
- [x] Event/incident markers cluster and selected list/detail stay synchronized.
- [x] Map remains usable with no location permission and empty results.
- [x] Performance/security regression checks pass.

---

## MAP-03 — Spatial performance and security regression

**Owner:** Member 2

**Suggested branch:** `test/spatial-security-regression`

**Depends on:** MAP-02, INC-03, and EVT-03 public-event marker contract

### Goal

Prove that the completed spatial implementation remains bounded, indexed, tenant-safe, and usable after the incident, map, and event branches are combined.

### Backend work

- Add spatial regression coverage for bounding-box, radius, `ST_Covers`, overlap, boundary points, invalid coordinates, excessive bounds, inactive service areas, and public/private response projections.
- Create Organization A and Organization B with separate and overlapping service areas, incidents inside/outside/on boundaries, and organization-owned events.
- Attempt direct-ID and altered-organization requests to prove reviews, private notes, contacts, and private event data cannot cross tenants.
- Verify results are deduplicated when several approved service polygons cover one incident.
- Inspect the primary query plans and document use of GiST/normal indexes. Avoid unstable CI tests that pass or fail using only execution time.
- Add reasonable bbox/radius, page-size, result-count, and response-size protections when a regression is found.
- Do not create another map API or change the marker contract without coordinating its consumers.

### Web work

- Exercise citizen, organization, and Super Admin map modes with dense, empty, overlapping, denied-location, and API-error scenarios.
- Confirm rapid pan/zoom does not leave stale markers or create an unbounded request burst.
- Confirm clusters, selected feature, result list, filters, and role-specific actions remain synchronized.
- Fix map-owned regressions inside Member 2’s feature files and send shared composition changes to INT-01.

### Mobile work

- Exercise startup with location granted, denied, and unavailable; manual pin selection must remain usable.
- Verify weak-network retry, stale-request protection, bounded data loading, marker selection, and return-from-background behavior.
- Confirm the app does not continuously track location and does not log/display private marker fields.

### Tests and acceptance criteria

- [x] Positive, boundary, overlap, invalid-input, and cross-tenant spatial tests pass in CI PostGIS.
- [x] Primary spatial queries use the intended indexes based on documented query-plan evidence.
- [x] Ordinary endpoints cannot download unbounded national map data.
- [x] Public/Super Admin results contain no private reviews, contacts, or participant data.
- [x] Web and mobile work without location permission and during empty/error states.
- [x] No competing map implementation or incompatible marker contract is introduced.

---

## INC-04 — Incident workflow regression and handoff verification

**Owner:** Member 2

**Suggested branch:** `test/incident-workflow-regression`

**Depends on:** INC-03, MAP-03, EVT-03, EVT-05, EVT-06, NOT-01, and REW-01

### Goal

Verify the entire incident lane after event claiming, notifications, and rewards are integrated, and fix incident-owned regressions without taking ownership of Member 3’s event implementation.

### Backend work

- Add regression scenarios for reporting, initial history/deadlines, own-report access, spatial discovery, organization visibility, independent review, false counts, VALID rewards, and linked-event status effects.
- Verify one shared incident remains one record across overlapping organizations and every organization keeps only its own current review.
- Verify FALSE never globally rejects an incident or prevents another covering organization from validating/acting.
- Verify linked-event publication changes the incident to CLEANUP_ORGANIZED, cancellation returns it to ACTIVE, EXPIRED, or ARCHIVED according to stored deadlines, and completion resolves it.
- Verify idempotency for incident retry, review changes, reporter notifications, and verified-report contribution awards.
- Test reporter, public, organization, and Super Admin projections for privacy and record-level authorization.

### Web work

- Run the real journey: report -> My Reports -> public map -> organization review -> linked event -> updated incident history/state.
- Confirm citizen, organization, and Super Admin screens use the same status and false-count meanings.
- Fix incident/map-owned regressions without rewriting event-owned screens.

### Mobile work

- Run the same Android journey with GPS/manual pin, evidence behavior, weak-network failure, map discovery, reporter notification, and updated report detail.
- Confirm recoverable API errors do not sign out a valid session and private organization notes never appear.

### Tests and acceptance criteria

- [x] Full incident lifecycle regression passes.
- [x] Overlap, boundary visibility, independent review, and false-count behavior remain correct.
- [x] Publish/cancel/complete produces correct incident state without duplicate history, rewards, or notifications.
- [x] Direct-ID attacks and private-field projection tests pass.
- [ ] Web and Android smoke-test results using real APIs are documented.
- [x] Changes remain in the incident/map lane unless the integration owner approves a shared-file change.

---

# Member 3 / Cleanup Event and Volunteering Tasks

## EVT-01 — Organization cleanup-workflow defaults and protected transitions

**Owner:** Member 3  
**Suggested branch:** `feature/cleanup-workflow-defaults`  
**Depends on:** CORE-00  
**Database lock:** not expected unless the existing foundation is proven insufficient

### Goal

Create safe default workflow statuses/transitions for active organizations and APIs that later event tasks use.

### Backend work

- Implement idempotent creation of required workflow defaults for organizations that lack them.
- Map custom labels/codes to protected lifecycle statuses.
- Provide organization-scoped list endpoints and carefully limited admin management if included in MVP.
- Required initial/final/cancel/completion meanings cannot be deleted or remapped to bypass platform rules.
- Enforce same-organization status and transition relationships already protected by composite database constraints.
- Add a service that validates whether a requested event transition is configured and allowed.

### Web work

- Add organization workflow view showing ordered statuses and permitted transitions.
- If editing is included, prevent destructive changes to protected statuses and explain errors clearly.

### Mobile work

- Add a read-oriented workflow/status view for organization admins/coordinators and reusable lifecycle labels for event screens.

### Tests and acceptance criteria

- [ ] Default creation is idempotent.
- [ ] Organization A cannot read/use Organization B statuses/transitions.
- [ ] Cross-organization transition IDs fail even through direct-ID manipulation.
- [ ] Required initial/final lifecycle behavior cannot be removed.
- [ ] Existing organizations without defaults can be safely initialized.
- [ ] Backend/web/mobile verification passes.

---

## EVT-02 — Cleanup-event drafts, sessions, and coordinators

**Owner:** Member 3  
**Suggested branch:** `feature/event-drafts-sessions-coordinators`  
**Depends on:** EVT-01, MAP-01, ACC-02 membership context; INC-01 for linked drafts

### Wave 2 and Wave 3 execution note

- The ClickUp task name remains `EVT-02 — Cleanup-event drafts, sessions, and coordinators`, and Member 3 keeps the existing suggested branch. Wave 3 does not create or rename a task.
- Wave 2 is the planned start for `EVT-02`, but the dependency rule still applies. Member 3 begins dependency-dependent code only after the required provider work is merged into `main`.
- The Wave 3 table entry means Member 3 continues the same `EVT-02` task by completing linked-incident integration and the `EVT-02` acceptance tests. It does not transfer or change any Member 1 or Member 2 task.
- Member 1 tests `ACC-02` membership administration in the `ACC-02` task. Member 2 tests `MAP-01`/`INC-01` map and incident behavior in those tasks. Member 3 tests only how the merged contracts are consumed safely by `EVT-02`.
- If `ACC-02` or `INC-01` is not merged when Member 3 reaches the dependent portion, Member 3 waits for that contract and reports the blocker. Member 3 must not modify Member 1 or Member 2 modules to bypass it.

### Goal

Allow an ORG_ADMIN to build a direct or incident-linked DRAFT, add valid sessions, and assign active same-organization coordinators.

### Backend work

- Add create/update/get/list-own-drafts operations for cleanup events.
- Support optional incident ID; direct event has NULL incident ID.
- A DRAFT linked event must not claim/block the incident.
- Validate event location, public details, instructions, equipment guidance, meeting location, and dates.
- Add session create/update/remove with end-after-start, positive capacity, unique date/start, and same-event checks.
- Add/remove event coordinators using active same-organization memberships; assignment does not promote their organization role.
- Preserve tenant filters in every event/session/coordinator query.

### Web work

- Build a multi-step event editor using the reusable map/location picker, session editor, and coordinator selector.
- Support direct-event creation and entry from an incident detail.
- Show draft validation without pretending the event is public.

### Mobile work

- Add equivalent essential draft/session/coordinator management for ORG_ADMIN, optimized for smaller screens.
- Reuse Member 2’s map component/contract; do not install another map system.

### Tests and acceptance criteria

- [ ] Member 3 adds backend integration tests for the real route -> middleware -> controller -> service/use-case -> repository path; CASL-only unit checks are insufficient.
- [ ] Organization A cannot use Organization B membership/status/session/event IDs.
- [ ] Organization A cannot link an incident that is not legitimately visible to Organization A, even by submitting its UUID directly.
- [ ] A legitimately visible incident can be selected for a linked draft through the merged incident contract.
- [ ] DRAFT does not claim or change the incident globally.
- [ ] Direct drafts work with no incident.
- [ ] Invalid session time/capacity and duplicate session are rejected.
- [ ] Coordinator must be active and belong to the owner organization.
- [ ] ORG_MEMBER cannot assign themselves unless authorized as admin.
- [ ] Web and mobile use Member 2's merged location-picker contract and call the same real API with loading, validation, success, and error states.
- [ ] Backend typecheck/build/tests, web lint/build, and mobile security/typecheck/doctor checks pass before handoff.

---

## EVT-03 — Publish event, atomically claim incident, and public event detail

**Owner:** Member 3  
**Suggested branch:** `feature/event-publish-incident-claim`  
**Depends on:** EVT-02, INC-03, NOT-01

### Goal

Publish a valid event, acquire the one-active-event incident claim atomically, and expose public event details for map/list consumers.

### Backend work

- Validate active organization, authorized ORG_ADMIN, complete public details, at least one valid future session, and at least one active coordinator.
- For linked events, require legitimate incident visibility and the agreed organization review state.
- In one transaction: conditionally transition event to PUBLISHED, acquire database-backed incident claim, update linked incident to CLEANUP_ORGANIZED, write status history/audit, and create notifications.
- Map the partial-unique-index race loser to HTTP 409.
- A direct event publishes without modifying any nearby incident.
- Add public paginated list/detail and spatial marker projection containing no private notes, contacts, or participant details.

### Web work

- Add publish readiness summary, confirmation, conflict handling, public event list/detail, and organization-owned event list.
- When claim conflict occurs, link to the already published public event instead of showing a raw database error.

### Mobile work

- Add public cleanup-event detail and organization publish action where authorized.
- Display sessions, official organization information, general location, instructions, and current public state.

### Tests and acceptance criteria

- [ ] Two organizations publishing for one incident produce exactly one success and one 409.
- [ ] DRAFT/CANCELLED/COMPLETED rows follow the existing partial-index claim rules.
- [ ] Linked publish updates event, incident, histories, audit, and notifications atomically.
- [ ] Direct publish does not claim an incident.
- [ ] Public responses contain no participant contacts/internal notes.
- [ ] Failed transaction leaves no partial state.

---

## EVT-04 — Volunteer join, session availability, and withdrawal

**Owner:** Member 3  
**Suggested branch:** `feature/event-participation`  
**Depends on:** EVT-03, NOT-01

### Goal

Allow any active profile-complete user to join a published/joinable event immediately, choose session availability, view their participation, and withdraw voluntarily.

### Backend work

- Add join, get-my-participation, update availability, list-my-events, and withdraw operations.
- There is no application, interview, approval, organization-membership requirement, or payment.
- Enforce one participant row per user/event and one availability row per participant/session.
- Validate that every selected session belongs to the same event and remains joinable.
- Enforce capacity at allocation/public policy stage according to the agreed rule; do not silently overbook.
- Withdrawal uses conditional state change and creates appropriate notifications/audit/history without suspending the user account.

### Web work

- Add Join Cleanup, multi-session availability selection, My Joined Events, and withdrawal confirmation.
- After joining, show participant-visible instructions but not organization-internal notes.

### Mobile work

- Implement the primary join/availability/withdraw flow based on the mockup’s MultiDayAvailability and CleanupEventDetails screens.
- Make retry idempotent and show offline/network errors clearly.

### Tests and acceptance criteria

- [ ] User joins immediately without approval or organization membership.
- [ ] Duplicate join/retry does not duplicate participants.
- [ ] Availability cannot reference another event’s session.
- [ ] User can change their own availability/withdraw but not another user’s.
- [ ] Non-published/cancelled/completed event cannot be joined.
- [ ] Participant-visible/private note boundaries are preserved.

---

## EVT-05 — Participant allocation, removal, attendance, and contact privacy

**Owner:** Member 3  
**Suggested branch:** `feature/event-participant-operations`  
**Depends on:** EVT-04, ACC-02, NOT-01, REW-01 service contract

### Goal

Allow the owning organization’s ORG_ADMIN or assigned coordinator to organize joined volunteers safely across sessions and record attendance.

### Backend work

- Add authorized participant/availability listing for the owning event.
- Add session allocation/reallocation/removal with same-event and availability checks plus capacity enforcement.
- Add participant removal with required reason and actor/time audit fields.
- Add attendance states using conditional updates and authorized actor membership.
- On first ATTENDED result, invoke the idempotent attendance contribution service.
- Return phone/contact fields only to authorized owning-organization admins/assigned coordinators when operationally necessary; never in public or participant-to-participant responses.
- Create allocation/change/removal notifications after permanent state is recorded.

### Web work

- Add volunteer operations table/cards with availability, session capacity, allocation, attendance, and removal confirmation.
- Hide private contact fields unless the backend returns them for an authorized context.

### Mobile work

- Add coordinator-friendly participant/session screens for allocation and attendance plus volunteer view of personal allocation.
- Never show a volunteer the other volunteers’ phone numbers.

### Tests and acceptance criteria

- [ ] Only owner ORG_ADMIN/assigned coordinator can operate participants.
- [ ] Organization A/event A cannot allocate participant/session IDs from Organization B/event B.
- [ ] Capacity and availability rules are enforced.
- [ ] Removal affects only this event, not account status.
- [ ] Attendance reward occurs once.
- [ ] Contact details are absent from every unauthorized response.

---

## EVT-06 — Notes, evidence, event/session lifecycle, cancellation, and completion

**Owner:** Member 3  
**Suggested branch:** `feature/event-lifecycle-completion`  
**Depends on:** EVT-05, EVT-01, NOT-01, REW-01

### Goal

Complete the operational event lifecycle, including participant/internal communication, evidence metadata/uploads, protected transitions, cancellation, and linked-incident resolution.

### Backend work

- Add participant-visible/internal notes with author membership and visibility enforcement.
- Add event/session evidence upload metadata using the approved storage contract; validate event/session relationship, type, file limits, and uploader authorization.
- Implement configured event and session transitions with optimistic/conditional state protection and status history.
- Cancellation must preserve history, notify participants, release the incident claim, and return linked incident to ACTIVE/UNADDRESSED according to stored deadlines.
- Completion must validate required sessions/attendance/evidence according to policy.
- In one transaction: complete event, write history/audit, resolve linked incident and its history, create completion contribution(s)/achievement checks, and create notification records.
- External upload processing/push delivery happens outside the transaction.

### Web work

- Add event operations timeline, notes, evidence gallery/upload, transition controls, cancellation confirmation/reason, and completion review.
- Show controls only for backend-authorized roles and preserve public/private note separation.

### Mobile work

- Add participant notes/schedule updates, coordinator evidence/status tools, cancellation state, completed-event history, and resolved-incident link.
- Provide upload progress/retry and never place sensitive notes in notification previews.

### Tests and acceptance criteria

- [ ] Invalid/unconfigured transitions and stale concurrent updates fail safely.
- [ ] Internal notes are invisible to public users and ordinary participants.
- [ ] Evidence session must belong to the same event.
- [ ] Cancellation atomically releases claim and updates linked incident correctly.
- [ ] Completion atomically completes event, resolves linked incident, records history/audit/rewards/notifications.
- [ ] Organization A cannot operate Organization B event even with direct IDs.
- [ ] Full citizen -> report -> review -> event -> join -> allocation -> attendance -> completion workflow passes.

---

# Integration Owner Completion Tasks

## INT-01 — Shared integration wiring and web/mobile parity

**Owner:** Member 1 / integration owner  
**Suggested branch:** `integration/core-feature-wiring`

**Depends on:** each provider feature being integrated; may be updated incrementally after its PR passes review

### Goal

Connect independently developed routers and screens to the real applications without moving business logic into shared composition files or breaking authentication/profile completion.

### Backend work

- Review each provider PR’s router, dependencies, middleware order, API contract, tests, packages, and migrations before wiring it.
- Mount approved routers once under `/api/v1` in `backend/src/app.ts`; preserve Helmet, CORS, body parsing, health, not-found, and error middleware order.
- Update `server.ts` dependency composition only when required. Never construct feature repositories/controllers directly in `app.ts`.
- Resolve authorization additions centrally and reject duplicate/inconsistent action or subject strings.
- Run all backend tests after each integration batch so the branch causing a regression remains identifiable.

### Web work

- Connect exported screens to the authenticated, profile-complete, role-aware flow in `web/src/App.tsx`.
- Preserve citizen access for every normal user and add organization switching without trusting a frontend organization role.
- Integrate navigation, notification links, loading/error boundaries, and shared styling without copying feature logic into `App.tsx`.
- Confirm Member 2’s single map implementation is reused by all incident and event entry points.

### Mobile work

- Connect exported screens to the existing Supabase session, onboarding gate, dashboard, and Android deep-link flow in `mobile/App.tsx`.
- Integrate organization context, notifications, map/event navigation, Android back behavior, and recoverable API errors.
- Rebuild the development application when a merged native package change requires it.

### Tests and acceptance criteria

- [ ] Every approved router is mounted once at the documented path.
- [ ] Global middleware/error order and authentication/profile gates remain intact.
- [ ] Web and mobile can reach every completed feature through real navigation.
- [ ] No hard-coded token, role, user, organization, or fake success data is added.
- [ ] Shared-file conflicts preserve both contracts rather than accepting one whole file.
- [ ] Backend, web, mobile, Docker, and CI checks pass after integration.

---

## INT-02 — Full workflow, cross-tenant, and client parity verification

**Owner:** Member 1 / integration owner

**Suggested branch:** `integration/core-workflows`

**Depends on:** all required feature tasks, including MAP-03, INC-04, and INT-01

### Goal

Prove the merged system works as one secure product across a clean database, backend, web, and Android—not merely as isolated feature branches.

### Backend work

- Deploy every migration to a clean local PostGIS database and run the entire backend suite.
- Add/finish full Organization A versus Organization B direct-ID security coverage.
- Run the end-to-end scenario: profile -> report -> spatial visibility -> VALID review -> publish/claim -> join/availability -> allocation -> attendance -> completion -> incident resolution -> notifications/rewards/dashboards.
- Run direct-event, cancellation/replacement-event, duplicate retry, and concurrent claim scenarios.
- Verify public APIs never expose phone numbers, private notes, storage secrets, or tenant-private analytics.

### Web work

- Run the complete workflow through real navigation and APIs for citizen, ORG_MEMBER/coordinator, ORG_ADMIN, and Super Admin contexts.
- Verify status terminology, empty/loading/error states, organization switching, map links, notifications, rewards, and dashboard totals.
- Remove only fake/presentation-only behavior from implemented production feature paths while preserving the mockup-derived style.

### Mobile work

- Run the complete citizen/volunteer and authorized organization workflow on Android using the real backend.
- Verify magic-link return, profile gate, denied location, weak-network recovery, evidence actions, notifications, back navigation, and session persistence.
- Confirm mobile and web use the same API/status meanings and neither relies on frontend-only authorization.

### Tests and acceptance criteria

- [ ] CI is green.
- [ ] Clean-database migration deployment succeeds.
- [ ] Full workflow and cross-tenant suites pass.
- [ ] Web and Android manual smoke tests pass.
- [ ] Docker health checks pass.
- [ ] No presentation-only/fake data remains in implemented feature paths.
- [ ] API contracts, environment setup, verification evidence, and deliberate exclusions are documented.

## Deliberate exclusions unless a separate ClickUp task is approved

- Redis/BullMQ deployment and background workers
- Expo push-token registration and actual push delivery
- WebSockets
- full offline synchronization
- heatmaps/advanced recommendations
- multi-organization ownership of one cleanup event
- payment, employment, donation, or volunteer application workflows
- machine-learning/IoT features

In-app PostgreSQL notifications are included. Actual Expo push delivery is a separate future vertical slice.
