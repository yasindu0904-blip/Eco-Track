# Member 2 — API, database, isolation and performance

This is a self-contained execution guide for **Member 2**. Give this file to Codex in your Eco-Track checkout; no previous chat history is required. You own shared-environment diagnosis and coordinate the short load-test window.

## 1. Start here — copy this prompt into Codex

```text
Read docs/testing/team-guides/member-2-perfoemance-and-deploy-Chirana.md and carry out my Member 2 testing assignment step by step. First read the applicable AGENTS.md, relevant database_docs, docs/testing/README.md and the materials under docs/testing/materials, and the existing hosted-smoke evidence guide and defects. Inspect source routes and validation before writing test scripts. Do not assume old screenshots or local HEAD match the deployed build.

Create a new timestamped run under docs/testing/evidence/member-2-api/ (YYYYMMDD-HHmmss in Asia/Colombo), plus cases/results/fixtures/evidence-index files described here. Reuse existing evidence by reference, never overwrite it. Record planned cases as NOT_RUN initially. Execute available tests, save sanitized evidence, and ask only for missing account access, physical-device actions or decisions that actually block a step. Continue independent checks while waiting. Never invent screenshots/results, print credentials, reset shared data, send real-world messages, or deploy application changes. Coordinate shared fixtures and load windows with the team. Keep failures and retests separate. Tell me exactly when and where a human screenshot is needed. Finish with the report-ready handover specified in this guide.
```

Codex should ask for your name and missing test-account access once, then work through the stages below. It can read code, run tools, build test scripts, collect outputs, classify failures and draft the report section. It cannot claim physical actions, inbox delivery or phone screenshots that nobody observed.

## 2. Evidence destination

From the repository root in PowerShell, Codex can create your run:

```powershell
$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceDir = Join-Path (Get-Location) "docs/testing/evidence/member-2-api/$runId"
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
```

Keep this same `$evidenceDir` for the whole run. On a new terminal, resolve the existing run path instead of creating a new run accidentally. Codex creates the subfolders and records metadata. All relative filenames in the test matrix below are under this run.

## Environment and constraints — read before running anything

Prepared for the 27 September 2026 submission, due **23:59 Asia/Colombo**. Suggested team cutoff: testing 21:45, evidence handover 22:00, report review 23:00, upload 23:30. If starting later, prioritize P0 cases below and record unfinished work honestly.

| Item | Value / instruction |
|---|---|
| Repository | Eco-Track; open its root in VS Code with Codex. Original machine: `C:\campus\projects\Eco-Track`; use your own checkout path on other machines. |
| Hosted web | `https://eco-track-ctd.pages.dev` |
| Hosted API | `https://p01--eco-track--xnjn7t9fk69n.code.run/api/v1` |
| Process health | `https://p01--eco-track--xnjn7t9fk69n.code.run/health` |
| Application test DB | Supabase `eco-track-test`, project `zkiciluuktuzkidjaiaz`; pooler host `aws-0-ap-southeast-2.pooler.supabase.com`, port 5432, user `postgres.zkiciluuktuzkidjaiaz`. Password deliberately omitted. |
| Authentication/storage | Still use original Supabase project `jnbkbbhpbdfuzyezpqvo`. Do NOT switch frontend Auth to the empty test project. Auth and photo storage are shared resources. |
| Geography | 73 official Kesbewa GN divisions imported. Other districts are not populated. Choose exact imported divisions; never draw fake official boundaries. |
| Northflank | Project EcoTrack; services Eco-Track and EcoTrack-Notification; addon EcoTrack-Redis. Only the coordinator changes shared settings. |
| Test accounts | Prior automated smoke Auth identities were deleted. Existing fixture IDs are evidence, not usable logins. Ask coordinator for member-specific accounts/roles or let authorized Codex create labeled test users. |
| Source/build | Record `git rev-parse HEAD`, dirty status, deployed commit if accessible, browser/app version and timestamp. Local HEAD does not establish the deployed version. |

The root `.env` contains pasted dashboard text and must NOT be blindly loaded as a valid environment file. Do not print it. On the original machine, `backend/.env.test.local` is ignored and targets the test database; its SSL certificate path is machine-specific. On another laptop, ask Codex to prepare a valid ignored configuration and verify the target. Never commit database passwords, service-role keys, access/refresh tokens, signed photo URLs, browser session files, or Northflank tokens. Keep private artifacts under `tmp/` only after `git check-ignore` confirms exclusion. Export evidence with secrets removed.

### Team coordination

- Member 1 owns web functional/UI and report assembly; Member 2 owns API/database/security/performance and deployment diagnosis; Member 3 owns Android/device/resource/notification evidence.
- Work in separate member evidence directories. Prefix fixtures with `M1-`, `M2-`, or `M3-`, the case ID and run ID. Record their UUIDs in `fixtures.csv`; change only your fixtures.
- Member 1 coordinates an actual organization approval with the existing superadmin. Member 2 can prepare separate SQL/API fixtures for API tests, but must label setup and cannot count it as testing registration/approval. Member 3 needs an active org admin/coordinator plus a volunteer account.
- Agree a short exclusive performance window. Pause normal team interactions during measurements. Do not merge, redeploy, scale services, restart workers, reset DBs, clear shared Redis, or rotate shared credentials during another member's run.
- `REDIS_KEY_PREFIX` currently scopes cache/heartbeat keys, **not the BullMQ notification queue** in inspected source. Do not run an extra local worker against hosted Redis. Separate production/test queues are not proven isolated.
- Do not run DB-destructive integration suites against this shared hosted test DB. Member 2 uses an isolated local/CI database for those.
- Report product defects first. Do not silently modify application behavior to make tests pass. A fix requires a separately identified change/build and new retest evidence.
- **Usability/SUS participant testing is excluded from these assignments.** Basic UI/accessibility checks are not a SUS study. Never invent respondents, observations or scores.

### Existing evidence to reuse, not overwrite

Read `docs/testing/evidence/2026-09-27-hosted-smoke/README.md`, `RESULTS.csv`, `DEFECTS-AND-BLOCKERS.md`, and `harness-notes.md`. Browser screenshots are in `browser/verified/`; API retest in `retest/`; event flow in `lifecycle/` and `lifecycle-retest/`.

- Initial incident POST returned HTTP 500 at `2026-09-27T12:35:06.530Z` (18:05:06 Sri Lanka); retest passed. Root cause is NOT confirmed. Local cold-connection Prisma P2028 is a hypothesis, not proof of the hosted error.
- Completion initially returned 409 because a SQL fixture had microsecond timestamps; corrected fixture retest passed. This is a harness issue, not a reproduced normal-user defect.
- A browser locator expected Unread text while All was selected; visual review confirmed the correct empty inbox. Keep that distinction.
- Worker heartbeat/in-app notification success does not prove a phone received a push.
- Initial `setup-status.json` may describe an earlier stage. Check timestamps; later GN-import/lifecycle evidence supersedes the initial missing-geography blocker for Kesbewa.

## How to record every test

Codex must create these files inside YOUR run directory before executing tests:

```text
environment.md             URLs, versions, commits, device/browser, tools, timezone
cases.csv                  planned cases and steps; initially NOT_RUN
results.csv                one row per execution/attempt
fixtures.csv               case ID, owner, entity type, UUID, cleanup status
defects.md                 reproducible failures and linked retests
summary.md                 report-ready findings and limitations
evidence-index.csv         evidence path, case ID, caption, source, timestamp
screenshots/               PNG evidence
logs/                      sanitized .txt output and exit status
requests/                  sanitized request/response JSON where applicable
tools/                     scripts, collections or test plans without secrets
```

Use this results header:

```csv
case_id,attempt,priority,tester,started_at_utc,environment,preconditions,steps,expected,actual,status,evidence_paths,defect_id,notes
```

Statuses: `PASS` (observed assertion met), `FAIL` (observed mismatch), `BLOCKED` (missing prerequisite), `NOT_RUN` (not attempted). A tool crash, bad selector, invalid fixture or wrong endpoint is a harness issue; repair it and retain the failed tool run separately. Never convert an unexecuted step to PASS. An HTTP 200 alone does not prove the returned data is correct.

Evidence names: `CASE-ID_attempt-01_description.png`, `.json` or `.txt`; retests use `attempt-02`. Capture final loaded states, including the relevant result/error, not just a button or spinner. Include case ID and timestamp in the evidence index, not fake overlays claiming a result. Keep raw private HAR/logcat/session traces out of the report folder; redact before publishing. Do not replace real UI screenshots with generated images.

Each defect needs ID, severity, environment/build, preconditions, exact reproduction, expected/actual, frequency, timestamp, request/fixture ID, evidence links, workaround, and retest status. No assumed causes.

## Deadline handover — paste to Codex after execution

```text
Finish my evidence package. Reconcile cases.csv and results.csv; retain initial failures and distinct retests. Check every evidence link and scan text/exports for credentials. Write summary.md with scope, environment/builds, tools, unique cases attempted/passed/failed/blocked/not run, excluded setup operations, known defects, coverage gaps and recommendations. Separate local unit checks from hosted tests and human-observed results. Create evidence-index.csv with report captions, and SHA256SUMS.txt after files are finalized. Do not count retry attempts as extra unique cases or label skipped tests as passes. Give me a concise handover with exact paths and remaining human actions. Do not submit or publish the report for me.
```

Send your complete run folder to Member 1 through the team's agreed private sharing method; screenshots alone are insufficient. Do not upload secrets. In the final report use the supplied `docs/testing/materials/6 Template for Test plan.docx`: mission, target items, approach (objectives/techniques/oracles/tools/criteria), results/evidence/coverage, risks/dependencies/assumptions, and tool references. Keep planned tests separate from actual results. Cite tools actually used and the actual access date; don't claim Selenium/Appium/JMeter was used unless it was.

## 3. Prepare access and verify the target

1. Read backend routes/controllers/validation; use those as the endpoint contract. Read `.github/workflows/ci.yml` before running database tests.
2. Obtain test-DB access through ignored local configuration. A Northflank read token, if provided, belongs in ignored `tmp/northflank-token.txt`; use it only for service/deployment/log inspection. Do not guess API routes: consult official docs/tool discovery when needed. No token is required for public HTTP tests.
3. Obtain two regular test identities in DIFFERENT organizations, one independent volunteer, and a test-admin context. Use private Postman environment values for tokens; collections use `{{baseUrl}}` and `{{accessToken}}` placeholders. Export a sanitized environment containing no actual secrets.
4. Prove hosted database selection with one labeled test profile/record created through HTTP and a matching row in project `zkiciluuktuzkidjaiaz`. Stop further hosted writes if it lands elsewhere.
5. Read-only SQL check: migration history, categories/settings, GN count, PostGIS extension and triggers, application-table RLS/privileges. Do not interpret all tables having RLS as necessary: Prisma's migration metadata is not an application table. `postgres` bypasses RLS; a successful admin SELECT cannot prove anon restrictions.
6. Preserve current deployed version and logs through Northflank → service → Deployments / Observe → Logs. Backend process health 200 and worker startup alone do not prove dependencies.

Paste to Codex:

```text
Create and execute a sanitized Postman collection or equivalent Node HTTP runner for this guide, deriving paths/payloads/assertions from the current backend source. Use separate tokens for Org A, Org B and volunteer. Keep tokens private and save per-case HTTP status, sanitized body, duration and UTC timestamp. Create fixtures only on verified test DB and label fixture setup separately. Record exact IDs for Member 1 and Member 3 without sharing passwords. First prove the hosted target DB, then run A01-A13. Do not run npm test against hosted database credentials.
```

## 4. API and database cases

For each case save `requests/Axx_attempt-01.json` and relevant sanitized SQL in `logs/Axx-db.txt`. Include expected values and assertions, not just status codes.

| ID / priority | Steps | Expected / proof |
|---|---|---|
| A01 P0 | GET `/health`; GET `/auth/me` without bearer and with invalid bearer; valid test bearer; unknown path. | 200 health only; controlled 401 invalid access; valid identity returned; controlled 404. |
| A02 P0 | Complete test profile via PUT `/profile/complete`, invalid then valid payload; GET `/auth/me`; match test DB user_profiles row. | Field validation and persisted correct identity; hosted API DB target proven. |
| A03 P0 | GET `/incident-categories`; POST `/incidents` invalid title/location/category; verify no corresponding row. | 400/422 according to source contract, no internal stack/SQL leak or mutation. |
| A04 P0 | Create upload intent, upload a small valid image, submit `/incidents`, read detail; replay same submissionId; retry missing/wrong-owner path. | One incident and expected photo rows; correct spatial point, signed read works; replay no duplicate; invalid ownership/missing file rejected. |
| A05 P0 | Prepare unresolved/resolved and inside/outside-radius fixtures; GET `/incidents/nearby` and `/events/nearby` at 1000/2000/3000 radiusMeters. | Expected IDs included/excluded. Independently calculate distances with PostGIS. Empty lists are insufficient evidence. |
| A06 P0 | With A token call B's private drafts, participants, operations and mutation routes; anonymous and volunteer try admin endpoint. | 403/404 per contract; no sensitive response; verify forbidden mutation left DB unchanged. Public published event reads are intentionally allowed. |
| A07 P0 | Two orgs with different official service areas; incidents on either side; linked and direct public events; own/private other-org drafts; resolved incident. | Review-covered map limited to permitted area and status; drafts only owner-visible. Test API IDs independently of marker colors (Member 1 checks colors). |
| A08 P0 | Create/update/delete draft; validate incident; assign coordinator; readiness then publish; attempt second active claim of same incident. | Correct transitions and single active incident claim; missing readiness/duplicate claim rejected, no partial mutation. |
| A09 P0 | Volunteer join, duplicate join, withdrawal, rejoin; record attendance on ongoing event; add participant update; BEFORE/AFTER evidence; readiness and complete. | Contract-consistent idempotency/conflicts; final attendance/evidence required; correct final state, history, participant/reward/notification changes. Verify actual rows; no unsupported claim from an empty history response. |
| A10 P0 | Cancel published incident-linked event with current version and reason; re-query incident and awaiting-cleanup list. | Cancelled event and still-unresolved incident visible as appropriate; cancellation does not silently resolve incident. |
| A11 P0 | Update event, submit stale expectedUpdatedAt, then refresh and retry; compare row counts/state. | Controlled 409 for stale version; current version succeeds once. Use API timestamps; avoid SQL microsecond fixture mismatch. |
| A12 P0 | Read worker health `/super-admin/notification-worker` with authorized role; trigger only your test event notification; inspect recipient inbox, delivery status and phone observation from Member 3. | Recent heartbeat; correct recipient/content; separate in-app, queued, provider accepted, receipt and actual phone display verdicts. No fake Expo tokens. |
| A13 P0 | Query migration/schema/foreign-key/unique constraints and PostGIS point/coverage; test invalid FK/duplicate in transaction rolled back on isolated DB. Inspect anon/authenticated grants/RLS using their roles. | Expected constraints reject invalid writes, no residue; application data not readable directly by unauthorized roles. Save queries and returned results without personal data. |
| A14 P1 | Investigate original HTTP 500 around 12:35:06 UTC using Northflank logs; repeat only the failing synthetic flow with timings. | Root cause supported by server evidence, or explicitly unconfirmed. Preserve failed and passing attempts. No restart just to reproduce cold start while others test. |

Use a separate labeled fixture for completion and cancellation. Keep ordinary USER versus SUPER_ADMIN role values consistent with the schema. If SQL fixture setup is unavoidable, log it, verify owner/target and never count it as API behavior. Do not use the smoke source snapshots blindly: they parse credentials from the original machine's pasted text and contain documented harness limitations.

## 5. Run repository tests on an isolated environment

Use existing CI run evidence on the matching commit if available, or ask Codex to reproduce the backend job locally with Docker. CI uses Node 24, `postgis/postgis:17-3.5` and `redis:8.2-alpine`. Provision unique containers/ports/database for this member, with a separate Redis. Reproduce `extensions` PostGIS schema and `anon`/`authenticated` roles from CI **only in this new empty DB**. CI's DROP EXTENSION setup must never be copied into hosted Supabase.

```text
Inspect backend test setup/teardown and .github/workflows/ci.yml. Create an isolated local disposable PostGIS + Redis test environment with unique names and ports. Assert host/database before any migration or test. Override environment for the child test process; do not modify shared .env. Mirror CI setup, apply migrations, generate Prisma Client, run typecheck, build and npm test. Save each command, exit code and full sanitized output. Do not claim mocked integration tests are live provider tests. If Docker or prerequisites are unavailable, use matching GitHub CI evidence or mark local execution BLOCKED and continue hosted API checks. Stop only member-owned containers when finished; preserve evidence.
```

Commands after Codex has safely configured the isolated child environment, from `backend/`:

```text
npm ci                         # only if locked dependencies need installation
npx prisma migrate deploy
npm run prisma:generate
npm run typecheck
npm run build
npm test
```

Save outputs as `logs/backend-migrations.txt`, `backend-typecheck.txt`, `backend-build.txt`, `backend-tests.txt`, plus exit codes. Inspect skipped tests; a zero exit code with skipped database cases is not full integration coverage.

## 6. JMeter performance exercise (bounded, coordinated)

This is a small baseline under the current deployment, not a maximum-capacity certification. First announce a quiet window to Members 1 and 3; do not test Supabase Auth login or send push notifications in a load loop. Use already authenticated, read-only application requests. Do not change replicas or resource plans during the baseline.

1. Check `java -version` and JMeter availability. If absent, Codex should obtain current installation instructions from the official Apache site and install tools outside application dependencies. Do not follow the old Java 8 workshop versions blindly.
2. Build `tools/read-only-baseline.jmx`: variables for API host and token; HTTPS sampler; five-second think time; connect timeout 10 s and response timeout 30 s; verify 200 plus JSON schema/data expectations. Include incident categories, nearby incidents and nearby events with known test data. No writes and no health-only benchmark.
3. Run 1 user, 10 s ramp, 60 s duration; inspect results. If stable, run 5 users, 30 s ramp, 120 s duration. Run 10 users, 30 s ramp, 120 s only if the coordinator agrees and previous stage is healthy.
4. Stop if sustained 5xx exceeds 5% over 30 seconds, timeouts recur, any OOM/restart occurs, or other members report disruption. Keep stopped-run results. These are operational stop rules, not an agreed product SLA.
5. Capture Northflank API + worker CPU/memory/replicas and restart counts at start, peak and end. Record any cache warm-up and data volume. No credentials on screen.
6. Report sample count, error percentage, throughput, p50/p95/p99 and maximum response time, observed CPU/memory/restarts, workload, duration, think time and environment. Agree any acceptance SLA BEFORE the run; if none exists, report observations and no SLA pass/fail.

Example command shape after Codex generates the plan; `$jmeterExe` is the resolved installed `jmeter.bat` path. Auth secret goes in a private properties file, not CLI arguments or exported collection:

```powershell
& $jmeterExe -n -t (Join-Path $evidenceDir 'tools/read-only-baseline.jmx') -q $privatePropertiesPath -Jusers=5 -JrampSeconds=30 -JdurationSeconds=120 -l (Join-Path $evidenceDir 'logs/load-05.jtl') -e -o (Join-Path $evidenceDir 'load-report-05')
```

Codex must ensure the plan consumes those variable names, disables saving request headers/tokens in JTL, creates a NEW empty report output folder for each attempt, and redacts tool logs before sharing. Capture `screenshots/P01-jmeter-summary.png`, `P01-northflank-start.png`, `P01-northflank-peak.png`, `P01-northflank-end.png`; keep JMX, JTL and generated HTML report too.

```text
Coordinate the performance window, generate the bounded read-only JMeter plan above and show its endpoints/load before execution. Run the 1-user baseline first. Monitor errors and service metrics; stop under the documented rules. Continue to 5 users only if healthy. Save raw sanitized data, generated report and the exact workload. Do not claim autoscaling/load balancing from response latency alone or invent an SLA. If JMeter cannot be installed today, record that limitation and use a labeled Node read-only baseline; never label it JMeter evidence.
```

## 7. Configuration, failover and load-balancing coverage

- Save deployment revision, instance count, resource limits and health-check configuration if accessible. The latest smoke did NOT establish the deployed commit or autoscaling configuration.
- Manual offline behavior is tested by Members 1/3. Actual API/Redis restart recovery is a different test: perform only in an agreed maintenance window on an isolated deployment, capture before/after health, retry behavior and persisted data. Otherwise mark server failover NOT_RUN.
- To demonstrate load balancing, first establish there are at least two healthy replicas and obtain per-instance request evidence. To demonstrate autoscaling, record configured min/max/thresholds and an observed replica transition. Do not claim either with one replica. Resource upgrades/restarts remain coordinator actions, not assumed authorization from this guide.
- Do not grant public Redis access just for testing from a laptop. Use the hosted network or approved local forwarding. Never start a second notification worker on shared queue credentials.

## 8. Your specific handover

Provide sanitized Postman collection/environment template or Node runner, all HTTP/SQL evidence, CI/local test outputs, JMeter plan/results/report, Northflank metrics/logs, fixture IDs, and remaining gaps. Tell Member 1 which cases used real API workflows versus SQL setup. Confirm with Member 3 whether phone delivery actually occurred. Keep D01 open unless server evidence and a verified corrective change justify closing it.
