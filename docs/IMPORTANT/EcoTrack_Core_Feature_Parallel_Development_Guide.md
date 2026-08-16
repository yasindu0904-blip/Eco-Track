# EcoTrack Core Feature Parallel Development Guide

Status: mandatory for the core incident, map, cleanup-event, membership, notification, reward, and dashboard milestone.

This guide supersedes `docs/team-plans/VERY_IMPORTANT_TEAM_COLLABORATION_RULES.txt` only for new core-feature work. The older file remains the historical guide for the completed organization-onboarding milestone.

## 1. Required reading and precedence

Before changing code, every team member and every Codex session must read:

1. `docs/IMPORTANT/EcoTrack_CODEX_Instructions_for_docs_IMPORTANT.txt`
2. `docs/IMPORTANT/EcoTrack_Complete_System_Flow_Source_of_Truth_v1.txt`
3. This file
4. `docs/IMPORTANT/EcoTrack_Core_Authorization_Contract.md`
5. `database_docs/EcoTrack_Database_v2_Finalization_and_Codex_Instructions.txt`
6. `database_docs/EcoTrack_ERD_v2_Final.dbml`
7. The current Prisma schema, migrations, tests, and implementation being changed

When documents disagree, use the order above, except that the current database migration history is immutable evidence of what has already been applied. Stop and ask the integration owner before changing a domain rule.

## 2. Current baseline

The repository already contains:

- Supabase passwordless authentication for web and mobile
- first-login profile completion and backend profile-completion protection
- Prisma-backed EcoTrack profile provisioning
- CASL, tenant, authentication, ability, and authorization middleware foundations
- organization application, GN Division selection, Super Admin approval/decline, first-admin creation, audit records, and notifications
- administrative-area and organization-service-area PostGIS structures
- Prisma models and migrations for incident and cleanup-event domain foundations
- Docker and GitHub Actions verification

Do not recreate these systems under new names. Extend them.

## 3. Non-negotiable product rules

- One account has citizen and volunteer capabilities. There is no separate volunteer account or volunteer application.
- A normal user starts in the personal Citizen & Volunteer workspace and may switch into only backend-verified active organization memberships; roles never carry from one organization context into another.
- Authentication remains passwordless Supabase magic-link authentication.
- A citizen reports one shared incident and never selects an organization.
- Incident visibility comes from approved active service-area geometry.
- Overlapping organizations independently see and review the same incident.
- An organization FALSE review is private tenant state and is not a platform-wide rejection vote.
- Super Admin never assigns incidents, creates ordinary organization cleanup events, allocates volunteers, or controls normal event progress.
- A cleanup event belongs to exactly one organization and may optionally link to one incident.
- Direct cleanup events without incidents are allowed.
- Only one claiming event may actively claim an incident; PostgreSQL is the final concurrency authority.
- Volunteers join published events immediately and select availability. There is no approval queue.
- Coordinators are event-specific active organization members, not a new permanent role.
- Rewards are non-monetary and never grant authorization.
- Private tenant data is always filtered by verified backend organization context.

## 4. Team ownership

### Integration owner / Member 1

Owns final integration, authorization contracts, account and membership features, notifications, rewards, dashboards, and cross-feature verification.

Only the integration owner performs final production wiring in shared composition files and merges pull requests into `main`.

### Member 2

Owns the complete map and incident lane: reusable maps, location selection, incident reporting, spatial discovery, role-specific incident map views, and organization incident review.

No other member creates a competing map implementation.

### Member 3

Owns the cleanup-event and volunteering lane: workflows, event drafts, sessions, coordinators, publish/claim, public event details, joining, availability, allocation, attendance, notes, evidence, status changes, cancellation, and completion.

## 5. One task, one branch, one pull request

Each ClickUp task uses a new short-lived branch created from the latest `main`:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/<task-name>
```

Before editing, run:

```powershell
git branch --show-current
git status --short
```

Rules:

- Do not develop several ClickUp tasks in one branch.
- Do not start from an old personal branch.
- Members 2 and 3 push their branch and open a pull request; they do not merge it.
- The integration owner reviews CI, code, migration effects, authorization, and file scope before merging.
- After any required dependency is merged, dependent work starts from the new `main`.
- Do not copy commits manually between branches unless the integration owner explicitly coordinates it.
- Never use or restore an unknown Git stash.

## 6. Parallel work is allowed

All three members may work simultaneously when their tasks:

- are based on the required merged dependencies;
- use separate feature directories;
- do not both hold the database lock;
- do not both change the same shared dependency manifests; and
- do not edit shared composition files owned by the integration owner.

Only database-structure changes and final integration are serialized. The whole team does not need to stop while one member codes.

## 7. Critical shared files

The following files are integration-owned unless a ClickUp task explicitly grants temporary ownership:

- `backend/src/app.ts`
- `backend/src/server.ts`
- `web/src/App.tsx`
- `web/src/App.css`
- `mobile/App.tsx`
- `backend/src/authorization/actions.ts`
- `backend/src/authorization/subjects.ts`
- `backend/src/authorization/ability.factory.ts`
- `backend/src/types/express.d.ts`
- root and workspace `package.json` / `package-lock.json` files
- `.github/workflows/ci.yml`
- `compose.yaml` and Docker build files
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/**`
- `backend/prisma/seed.ts`
- `database_docs/EcoTrack_ERD_v2_Final.dbml`

Feature members must not replace or broadly rewrite these files.

### Backend route handoff

Feature members export a router factory and module dependencies from their feature folder. They do not call `app.listen()` and do not place business logic in `app.ts`.

Example:

```ts
export function createIncidentRouter(dependencies: IncidentDependencies) {
  const router = Router();
  // Feature routes and middleware only.
  return router;
}
```

The member tests the router with a small Express test app. The integration owner mounts it under `/api/v1` in `backend/src/app.ts` during merge.

Production middleware order remains:

```text
helmet -> cors -> body parsing -> health -> /api/v1 routers
-> notFoundMiddleware -> errorMiddleware
```

Protected organization routes normally use:

```text
authenticate -> requireCompletedProfile -> tenant context
-> ability -> authorize -> controller -> service/use case -> repository
```

### Web and mobile handoff

Feature members create and export complete feature screens/components from their own directories. They must not replace the real authentication flow or hard-code users, roles, tokens, organization IDs, or success results.

The integration owner connects exported screens to `web/src/App.tsx` and `mobile/App.tsx` during merge. A temporary preview wiring commit is allowed only if it is isolated and clearly identified in the pull request.

## 8. Database lock and migration protocol

Only one task across the whole team may modify database structure at a time. The integration owner grants that task the ClickUp label `DATABASE LOCK`.

The lock covers:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/**`
- `backend/prisma/seed.ts`
- `database_docs/EcoTrack_ERD_v2_Final.dbml`
- database-related CI or Docker initialization

Before creating a migration:

1. Pull the latest `main`.
2. Confirm no other task holds `DATABASE LOCK`.
3. Inspect existing models and migrations; reuse them instead of duplicating tables.
4. Update Prisma and DBML together when the logical schema changes.
5. Create a new meaningfully named migration.
6. Review generated SQL and add required PostGIS, partial-index, constraint, RLS, and privilege SQL intentionally.

Never:

- edit an applied migration;
- delete migration history;
- run `prisma migrate reset` against shared or Supabase data;
- use `prisma db push` as migration history;
- manually create a Supabase structure and then forget to add its migration;
- place two unrelated schema changes in one migration;
- assume Prisma schema syntax represents partial indexes, GiST indexes, RLS, or every PostGIS constraint.

Every new public application table must follow the existing backend-only RLS and privilege strategy. Every organization-owned table/query must preserve tenant constraints. Spatial fields use SRID 4326 and parameterized SQL.

If a task does not hold the database lock but discovers a missing field or constraint, it records the exact requirement in ClickUp and stops only that database-dependent part. It does not create a competing migration.

## 9. Dependency changes

Do not edit lockfiles manually.

If a task needs a new package, the task owner records:

- exact package name;
- target workspace (`backend`, `web`, or `mobile`);
- why installed code cannot solve the requirement;
- expected native rebuild or CI impact.

The integration owner grants a short `DEPENDENCY LOCK` for that workspace. Run the package manager from the correct folder and commit both `package.json` and `package-lock.json`.

For Expo dependencies, use `npx expo install` so versions match the installed SDK. Never use `npm audit fix --force` without a separate reviewed upgrade task.

## 10. Backend implementation rules

- Keep the modular monolith and domain-based module structure.
- Standard flow: route -> middleware -> controller -> service/use case -> repository -> Prisma.
- Controllers parse the HTTP boundary and return responses; they do not call Prisma.
- Services enforce business rules.
- Use-case folders own multi-write transactions and side effects.
- Repositories own database queries and mandatory tenant filters.
- Validate untrusted input with Zod.
- Use `ApplicationError` and central `errorMiddleware`; do not expose raw Prisma errors.
- Local TypeScript ESM imports include `.js`.
- Never trust a role, user ID, reviewer ID, organization authorization result, or membership supplied by a frontend.
- Perform external uploads, email, push delivery, and heavy image processing outside database transactions.
- Convert concurrency conflicts to stable HTTP errors such as 409 rather than leaking database errors.

## 11. Web and mobile implementation rules

Every feature task is a vertical slice and must include both clients unless its ClickUp description explicitly states otherwise.

- Reuse `ecotrack-srs-mockup` as the visual reference: green EcoTrack palette, cards, hierarchy, readable forms, status chips, and responsive layouts.
- The mockup is not a source for fake authentication, fake authorization, static success data, or fake repositories.
- Web and mobile call the same REST API and send the Supabase Bearer token through their existing API clients.
- Web and mobile use shared API response meanings, validation messages, empty/loading/error states, and status terminology.
- Frontend role checks improve UX only; backend authorization remains mandatory.
- Mobile must support weak-network retry/error behavior and avoid continuous location tracking.
- Never expose another participant's phone number. Only authorized owning-organization admins/coordinators may receive operational contact fields.
- Do not put secrets or Supabase service-role keys in web/mobile environment variables.

## 12. Map ownership and contract

Member 2 owns reusable map components and spatial request contracts.

- Use OpenStreetMap-compatible presentation.
- Request incidents/events by bounded viewport or validated radius, never download the whole country.
- Debounce viewport requests and cancel or ignore stale responses.
- Cluster markers when zoomed out.
- Keep latitude/longitude for UI display and PostGIS geography for spatial filtering.
- Use parameterized `ST_Covers`, `ST_DWithin`, bounding-box, and distance queries.
- Citizen location selection must allow GPS or a manually confirmed pin.
- Location permission is requested only when needed; no continuous tracking.

Member 3 reuses Member 2's exported map/location picker for event locations. Member 3 does not introduce another map library or duplicate map state model.

## 13. API and type handoff contract

Every feature pull request documents:

- endpoint method and path;
- authentication and authorization middleware;
- request body/query/path schema;
- success response shape;
- expected 400/401/403/404/409 behavior;
- exported backend router/dependencies;
- exported web screen/components;
- exported mobile screen/components;
- any new database objects, environment variables, or packages;
- exact commands and manual scenarios used for verification.

API types are feature-local. Do not create a large generic shared-types dumping file. If another task depends on a contract, merge the provider task first and consume its exported type/API afterward.

## 14. Testing requirements

Every task must add backend integration tests for its business behavior. Tenant-owned features must create Organization A and Organization B and attempt direct-ID cross-tenant access.

Required negative coverage where relevant:

- missing/expired authentication -> 401;
- incomplete/suspended profile -> rejected;
- active user without required membership/role -> 403;
- Organization A cannot read or mutate Organization B private data;
- invalid status transition -> 409 or 422 according to the established error contract;
- duplicate/retried requests do not create duplicate records;
- concurrency-sensitive incident claim produces one winner and one 409;
- invalid cross-event participant/session IDs are rejected;
- private notes/contact details never appear in public responses.

Before handoff, run relevant commands:

```powershell
# backend
npm run typecheck
npm run build
npm test
npx prisma validate

# web
npm run lint
npm run build

# mobile
npm run security:check
npm run typecheck
npm run doctor
```

If the task changes an Expo native dependency, rebuild the development application and test on Android. CI must pass before merge.

## 15. Pull-request handoff checklist

- [ ] Branch was created from the required latest `main`.
- [ ] Only one ClickUp task is included.
- [ ] Backend, web, and mobile parts are present.
- [ ] Required source-of-truth documents were followed.
- [ ] No unrelated or another member's files were removed/replaced.
- [ ] No secret or local `.env` file is committed.
- [ ] Backend authorization is enforced and tenant IDs are verified.
- [ ] Controllers do not contain database/business logic.
- [ ] Shared composition wiring is left to the integration owner or isolated clearly.
- [ ] Database/dependency locks were respected.
- [ ] DBML, Prisma, migration SQL, RLS, and indexes agree where changed.
- [ ] Backend positive and negative integration tests were added.
- [ ] Web and mobile loading, empty, success, and error states exist.
- [ ] Relevant local checks pass and exact results are listed.
- [ ] CI passes.
- [ ] API/export/integration instructions are in the PR description.

## 16. Integration-owner merge checklist

1. Confirm dependencies are already merged.
2. Review changed-file scope before code details.
3. Review migration SQL before applying it anywhere.
4. Confirm cross-tenant filters and CASL actions.
5. Mount exported backend router additively in `app.ts`.
6. Connect exported web/mobile screens without replacing authentication or profile gating.
7. Resolve shared-file changes deliberately; never accept an entire conflicting file blindly.
8. Run the full CI-equivalent checks.
9. Merge only after CI is green.
10. Tell the team that `main` changed before dependent tasks begin.

## 17. Stop conditions

Stop and contact the integration owner when:

- a requirement contradicts the source of truth;
- an applied migration appears to require editing;
- another task holds the required database or dependency lock;
- a shared API type or route is not yet merged;
- a change would expose secrets or private tenant data;
- the task requires replacing another member's implementation;
- a conflict cannot be resolved without choosing between two business behaviors.

Do not guess through these cases.
