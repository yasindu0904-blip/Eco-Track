# Source-derived expected behavior (planning, not results)

Local source revision `4181db9c2dd455569aa872ce0c73541c8cd632ce` was inspected before hosted tests. These checks define expected behavior but do not establish what the deployed build did.

- W01: `web/src/features/auth/LoginForm.tsx` uses a required `type=email` input and a magic-link request. Successful request switches to “Check your email”; that screen alone does not prove delivery.
- W02: `web/src/features/auth/ProfileOnboarding.tsx` requires a name of 2–120 characters and phone of 7–30 characters. `backend/src/modules/profiles/profile.validation.ts` additionally accepts digits with an optional plus sign and permitted spacing/parentheses/hyphen, normalized to 7–15 digits.
- W03/W04: `web/src/features/incidents/IncidentPage.tsx` requires title 3–160 characters and description 10–5000; location must be explicitly confirmed. Photos are optional on web, up to five JPEG/PNG/WebP files of at most 8 MB each. The browser shows a controlled location error before submission. `backend/src/modules/incidents/incident.validation.ts` defines additional server validation.
- W06/W07: `web/src/features/incidents/CitizenIncidentDiscovery.tsx` offers 1, 2, and 3 km radii and an Awaiting cleanup section. It loads nearby incidents or event map features based on the selected section. A populated fixture is required to prove filtering.
- W08: `web/src/features/organizations/application/OrganizationApplicationPage.tsx` requires name, official email, official phone and address. Service areas come from searched official GN divisions. Runtime approval must be observed separately.
- W17: `backend/src/modules/auth/auth.routes.ts` protects `GET /api/v1/auth/me` with authentication middleware.
