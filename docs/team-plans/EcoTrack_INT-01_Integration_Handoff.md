# INT-01 Integration Wiring and Client Parity — Completion Handoff

## Result

INT-01 connects the completed EcoTrack feature slices through the production backend, authenticated web application, and authenticated Android application. Feature business rules remain in their own modules; the shared application files now only compose authentication gates, role gates, navigation, and dependencies.

## Backend composition

- `backend/src/app.ts` remains the single Express composition root.
- Approved routers are mounted once under `/api/v1` through their dependency objects.
- The order remains Helmet, CORS, JSON parsing, health, feature routers, not-found middleware, and central error middleware.
- `backend/src/tests/appComposition.integration.test.ts` starts the real composed application and verifies representative routes reach authentication instead of falling through to the final 404 handler. It also protects the health, security-header, CORS, and unknown-route contracts.
- No route, repository, controller, token, user, role, or organization was hard-coded into production composition.

## Web integration

- `web/src/App.tsx` is now limited to session loading, authentication failure, profile completion, platform-role selection, and sign-out.
- `web/src/app/AuthenticatedUserApp.tsx` owns the normal-user feature composition.
- `web/src/app/SuperAdminApp.tsx` owns the Super Admin composition.
- `web/src/app/navigation.ts` provides typed destinations and browser history/back handling.
- `web/src/app/notificationDestination.ts` converts trusted notification metadata into safe destinations. An organization notification opens only when the authenticated user has that exact active membership.
- Feature screens use route-level `lazy()` imports behind `RouteBoundary`, reducing the initial production JavaScript bundle and giving lazy routes a consistent loading state.
- Citizens can reach organization applications, membership self-service, organization workspaces, incident reporting/history/discovery, public and joined cleanup events, notifications, and rewards.
- Organization members can switch exact active organization contexts. Organization Admins additionally reach incident review, event drafting/operations, and member administration without frontend role assumptions granting backend access.
- Super Admins reach their dashboard, review tools, platform map/statistics, and notification inbox.

## Mobile integration

- `mobile/App.tsx` is now limited to Supabase/session state, onboarding, platform-role selection, and sign-out.
- `mobile/src/app/AuthenticatedUserApp.tsx` composes all normal-user and organization feature screens.
- `mobile/src/app/navigation.ts` defines typed Android destinations and parent destinations.
- `mobile/src/app/useAndroidBackNavigation.ts` returns nested organization destinations to the organization overview and other feature destinations to the citizen dashboard.
- `mobile/src/app/notificationDestination.ts` applies the same safe notification-to-screen rules as web.
- Notification links can open organization incident discovery, personal incident details, public/joined events, membership, applications, and rewards.
- Direct incident navigation is supported by `MyReportsScreen` without exposing another user's report; the backend remains the final authorization boundary.

## Verification evidence

- Clean temporary PostGIS database: all 18 migrations deployed successfully.
- Backend build: passed.
- Backend clean-database suite: 147 existing tests passed; the corrected composition test then passed 2/2. Together the current suite is 148/148.
- Web tests: 25/25 passed.
- Web lint: passed.
- Web production build: passed; feature chunks are lazy-loaded and the main JavaScript bundle is below the previous warning threshold.
- Mobile TypeScript: passed.
- Mobile tests: 30/30 passed.
- Expo Doctor: 21/21 passed.
- Mobile Metro image security and map privacy checks: passed.
- Existing Docker database, backend, and web services were healthy during verification.
- GitHub CI is pending because the implementation has not been committed or pushed. Its equivalent local commands passed.

## Scope boundary

INT-01 proves that completed feature modules are reachable and consistently wired. The complete multi-role manual workflow, cross-tenant end-to-end scenario, clean-database CI proof, Android device smoke test, and final removal of any remaining deliberate placeholders belong to INT-02.
