# EcoTrack submission toolkit

This folder contains grouped test runners, build runners, complete configuration
templates and configuration snapshots. **It must be supplied with the EcoTrack
repository**: scripts reuse source/tests in the sibling `backend`, `web` and
`mobile` folders. It is not a second copy of the application.

## 1. Requirements and installation

- Node.js 24 and npm (matching the current CI/Docker setup).
- Docker Desktop using Linux containers for database/Redis integration tests.
- Internet for `npm ci` and Docker image downloads.
- Java and Apache JMeter for the optional performance suite.
- Expo/EAS account and Android signing setup for the optional cloud APK build.

From the repository root:

```powershell
cd submission
npm run setup
```

`setup` installs the three applications with their existing `package-lock.json`
files and generates Prisma Client. It does not change dependency versions or
connect to a hosted database. The toolkit itself has no npm dependencies.

## 2. Isolated integration-test infrastructure

Start Docker Desktop first. From `submission`:

```powershell
npm run db:up
npm run db:prepare
```

`db:up` starts **only** the `ecotrack-submission` Compose project. PostgreSQL/PostGIS
uses `127.0.0.1:55439`, database `ecotrack_submission_test`; Redis uses
`127.0.0.1:56389`. `db:prepare` applies the repository's Prisma migrations and
generates the client. Tests create their own fixtures; official GN imports and
real accounts are not needed for these automated suites.

The test database uses temporary storage. Stop it after testing:

```powershell
npm run db:down
```

Stopping/removing these submission containers discards their data. Preparing
them again requires `db:prepare`. The existing EcoTrack Compose services,
Supabase database and Northflank services are not targeted by these commands.

## 3. One command per test category

Run commands from `submission`; no evaluator needs to select individual tests.

| Command | Runs | Prerequisites |
| --- | --- | --- |
| `npm run test:unit` | Backend validation/helper/repository-with-double tests and web/mobile TypeScript logic tests | `setup` |
| `npm run test:integration` | All backend `.integration.test.ts` files, dashboard HTTP-router tests and Redis runtime tests | `setup`, `db:up`, `db:prepare` |
| `npm run test:ui` | All web/mobile `.test.tsx` component and screen scenario tests | `setup` |
| `npm run test:all` | Unit, integration and UI groups, each once | All prerequisites above |
| `npm run test:smoke` | Four GET checks: health, missing/malformed authorization and unknown route | Running API |
| `npm run test:performance` | Existing JMeter read plan: categories, nearby incidents, nearby events | JMeter/Java, running API, test bearer, known fixture IDs and load opt-in |
| `npm run test:e2e` | Reports BLOCKED: no production live-browser E2E suite is present | See manual checklist |
| `npm run test:toolkit` | Checks runner classification, DB/remote guards, redaction, JMeter CSV parsing and smoke assertions | Node only |
| `npm run inventory` | Regenerates the list of categorized source test files | Node only |

Unit and UI runners set explicit placeholder environment values. They do not
load the private repository-root `.env` into test children. Database integration
tests refuse URLs outside the dedicated loopback database/Redis ports and names.
The current suites exercise different integration scopes: some inject Auth or
Storage doubles while exercising real application database operations; others
test HTTP layers with dependency doubles. These do not prove actual Gmail,
camera, push delivery or hosted Supabase Storage.

**Classification:** backend filenames ending `.integration.test.ts` plus
`redisRuntime.test.ts` and `dashboard.routes.test.ts` are integration. Other
backend test files and web/mobile `.test.ts` files are unit. Web/mobile
`.test.tsx` files are UI. `tests/manifest.json` records the inventory; each runner
discovers the current source again and saves its actual selection. The historic
mockup project's screenshot script is excluded from production E2E claims.

## 4. Run smoke checks

For the isolated local API, open another terminal from `submission`:

```powershell
npm run start:test-api
```

The API listens on port 5025. Run `npm run test:smoke` in the first terminal.
Ctrl+C stops the API. The four unauthenticated checks need no real Auth keys.
For interactive sign-in or uploaded images, copy `.env.example` to `.env.local`
and configure the matching **test** Supabase URL, publishable key and backend-only
service-role key. Use a separate Supabase Auth/Storage project for that work.

To smoke-test an authorized hosted API instead, set in `submission/.env.local`:

```dotenv
SUBMISSION_API_ORIGIN=https://YOUR_API_HOST
SUBMISSION_ALLOW_REMOTE=true
```

Use the origin without `/api/v1`; the script adds paths. Smoke never creates
records and does not establish that database, Redis or notification workflows work.

## 5. Performance suite

The plan is adapted from the existing Member 2 JMeter evidence, with configurable
origin/protocol/port. It does not use k6 or Grafana. Complete these settings in
the ignored `submission/.env.local`:

```dotenv
SUBMISSION_JMETER_BIN=C:/tools/apache-jmeter/bin/jmeter.bat
SUBMISSION_API_ORIGIN=http://127.0.0.1:5025
SUBMISSION_ALLOW_LOAD_TEST=true
SUBMISSION_ACCESS_TOKEN=YOUR_TEST_USER_ACCESS_TOKEN
SUBMISSION_EXPECTED_INCIDENT_ID=KNOWN_VISIBLE_INCIDENT_UUID
SUBMISSION_EXPECTED_EVENT_ID=KNOWN_PUBLISHED_EVENT_UUID
SUBMISSION_LATITUDE=6.795
SUBMISSION_LONGITUDE=79.94
SUBMISSION_LOAD_USERS=1
SUBMISSION_LOAD_RAMP_SECONDS=10
SUBMISSION_LOAD_DURATION_SECONDS=60
```

Create the known incident/published event near these coordinates in an isolated
interactive test environment first; the runner does not generate them. The
bearer must belong to that environment. Remote origins additionally need
`SUBMISSION_ALLOW_REMOTE=true`. Each request has status/schema/known-data checks,
so empty results or HTTP errors cannot be presented as successful load coverage.
Allowed bounds are 1–20 users, 10–300 seconds, with a five-second think time.
Acceptance is zero failed samples and aggregate p95 below 2000 ms. These are
submission baseline criteria, not a proven maximum capacity or formal SRS SLA.

Tokens are passed through a temporary properties file outside the submission
folder, removed after execution. Logs/results do not intentionally capture
request headers or response bodies. Review evidence before sharing.

## 6. Build commands

```powershell
npm run build:backend
npm run build:web
npm run build:android
```

- Backend: generate Prisma Client and compile to `backend/dist/`. Compilation
  does not apply migrations or deploy anything.
- Web: type-check and Vite-build to `web/dist/`. Without configured public values
  this is a **compile-only** placeholder build. Configure
  `SUBMISSION_SUPABASE_URL`, `SUBMISSION_SUPABASE_PUBLISHABLE_KEY` and
  `SUBMISSION_WEB_API_BASE_URL` to create a usable web artifact.
- Android: launches EAS CLI with the real `mobile/eas.json` preview profile:
  Android APK, internal distribution, `developmentClient=false`; no Metro needed
  to use the installed APK. Run `npx eas-cli login` in `mobile` first. This command
  starts a cloud build and is never run by `test:all`. The existing profile's
  public URLs and EAS project ownership apply; inspect them before building for
  another environment. Save the final APK/EAS link. Cloud success is separate
  from actual-device testing.

## 7. Full configuration files

`config/CONFIGURATION.md` maps every included file to its real application path.
`config/snapshots/` contains copies of TypeScript, Vite, lint, Metro, Expo,
Docker, Nginx, Prisma and CI configuration; the archived EAS environment values
are replaced with placeholders. These are review copies. The runners use the
original repository files, which have the correct relative paths.

`config/backend/.env.example`, `config/web/.env.example` and
`config/mobile/.env.example` include the complete runtime variable sets. The
toolkit `.env.example` supplies all runner options with defaults/placeholders.
Copy templates to the target application's ignored `.env.local` when setting up
that application, not into published artifacts. Never give frontend builds a
database password or service-role key. Android FCM configuration/signing material
is supplied by the project owner; private keys are not bundled here.

## 8. Results and submission

Each execution creates:

```text
results/<category>/<UTC timestamp>-<process ID>/
  console.txt
  summary.json
  summary.md
  selected-tests.json       # grouped suites
  web-results.json          # Vitest groups where applicable
  mobile-results.json       # Vitest groups where applicable
  check-*.json              # smoke assertions
  samples.jtl               # JMeter only
  performance-summary.json  # JMeter only
  html-report/              # JMeter only
```

Exit codes: **0** selected checks passed, **1** a check/build failed, **2** missing
prerequisites or unavailable suite. Review counts for skipped tests. BLOCKED is
not PASS. `test:all` explicitly excludes live smoke, performance and unavailable
browser E2E; its summary lists the included groups.

Keep the source repository, this folder, chosen result folders and manual
evidence in the submission. Exclude `.env.local`, private `.env` files, tokens,
signing keys and `node_modules`. Mobile/manual and usability evidence are linked
in `tests/MANUAL-AND-E2E.md`; they are not silently counted as automated tests.
