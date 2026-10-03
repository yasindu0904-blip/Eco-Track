# Member 1 — Web functional, UI and browser testing

This is a self-contained execution guide for **Member 1**. Give this file to Codex in your Eco-Track checkout; no previous chat history is required. You also assemble the three members' findings into the final report; do not perform a SUS study.

## 1. Start here — copy this prompt into Codex

```text
Read docs/testing/team-guides/member-1-web-testing-and-functional-Sahanya.md and carry out my Member 1 testing assignment step by step. First read the applicable AGENTS.md, relevant database_docs, docs/testing/README.md and the materials under docs/testing/materials, and the existing hosted-smoke evidence guide and defects. Inspect source routes and validation before writing test scripts. Do not assume old screenshots or local HEAD match the deployed build.

Create a new timestamped run under docs/testing/evidence/member-1-web/ (YYYYMMDD-HHmmss in Asia/Colombo), plus cases/results/fixtures/evidence-index files described here. Reuse existing evidence by reference, never overwrite it. Record planned cases as NOT_RUN initially. Execute available tests, save sanitized evidence, and ask only for missing account access, physical-device actions or decisions that actually block a step. Continue independent checks while waiting. Never invent screenshots/results, print credentials, reset shared data, send real-world messages, or deploy application changes. Coordinate shared fixtures and load windows with the team. Keep failures and retests separate. Tell me exactly when and where a human screenshot is needed. Finish with the report-ready handover specified in this guide.
```

Codex should ask for your name and missing test-account access once, then work through the stages below. It can read code, run tools, build test scripts, collect outputs, classify failures and draft the report section. It cannot claim physical actions, inbox delivery or phone screenshots that nobody observed.

## 2. Evidence destination

From the repository root in PowerShell, Codex can create your run:

```powershell
$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceDir = Join-Path (Get-Location) "docs/testing/evidence/member-1-web/$runId"
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

## 3. Accounts, tools and first checks

1. Ask the coordinator for a real volunteer account, an organization-admin account and access to a superadmin reviewer. Let the human sign in through their own inbox; never request their inbox password. Use separate browser contexts for each role.
2. Confirm the web URL above and that Member 2 has verified the API is attached to the test DB. Do not test through local web accidentally: `web/.env.local` previously pointed to `localhost:5000`.
3. Prefer Playwright and a real browser for automation, plus browser DevTools for manual verification. Existing smoke tooling resolved Playwright from `ecotrack-srs-mockup/node_modules` and launched installed Edge with `channel: 'msedge'`. Inspect availability on your machine; don't assume that dependency exists everywhere. Codex may create an isolated tool project under ignored `tmp/` instead of changing application package versions. If Playwright cannot run, use manual Chrome/Edge with screenshots and record the fallback.
4. Ask Codex to record browser/version, viewport and console/API errors. Never export authenticated storage state or unredacted HAR into evidence. Use a headed session for human magic-link sign-in. Injected test sessions are allowed for later flows but MUST be labeled; they do not test email login.
5. Use existing Kesbewa boundaries. Create YOUR fixtures through the UI where the case tests UI behavior. API setup is acceptable for prerequisites but must be declared.

Paste after the starter prompt:

```text
Set up headed browser automation for the hosted web app. First let me complete real magic-link sign-in if needed, then retain the session only in an ignored private file. Record desktop viewport 1440x1000, browser version, API host and uncaught errors. Prepare distinct volunteer/admin contexts. Read actual accessible labels and wait for a loaded heading plus the relevant response/empty state before screenshots. Use semantic selectors; do not mark a navigation click alone as a passed form submission. Start W01-W04, then execute the remaining matrix. Ask Member 2 for fixture IDs and Member 3 for the notification trigger window when needed.
```

## 4. Functional/UI matrix (execute in this order)

Every row is a separate case with full steps in cases.csv. P0 first; P1 after core flows. Use the indicated screenshot stem plus `_attempt-01.png`.

| ID / priority | Exact actions | Expected observation | Evidence stem |
|---|---|---|---|
| W01 P0 | Open hosted URL signed out; enter malformed email, then a real test email; human opens received magic link. | Invalid email blocked; legitimate link establishes session. Record delivery and callback separately; missing inbox access = BLOCKED for those parts. | screenshots/W01-login and requests/W01-auth |
| W02 P0 | Complete an incomplete test profile; try blank name/invalid phone first, then valid values; reload. | Clear validation; saved profile persists; no repeated onboarding after completion. | screenshots/W02-profile |
| W03 P0 | Report incident: inspect categories, title/description, location confirmation and file limits from source; attempt missing required fields and unconfirmed location. | Invalid submission prevented or controlled error; no record created. | screenshots/W03-validation |
| W04 P0 | Select category/severity, enter `M1-W04-<run>` title and clear synthetic description; choose an official-area point; confirm location; upload a nonprivate PNG/JPEG; submit once. | One saved report with correct text/location and visible image; raw photo UUID not displayed as user-facing caption. Member 2 verifies record if needed. | screenshots/W04-preview, W04-saved; requests/W04-submit |
| W05 P0 | Open My Reports; select new incident; reload and navigate away/back. | Own report remains, image renders, status/timeline matches saved data; another ordinary user's private reports absent. | screenshots/W05-detail |
| W06 P0 | Find cleanup activity; allow location or documented simulated location; choose 1/2/3 km; Upcoming/Ongoing/Past/Cancelled/Awaiting cleanup. | Correct controls, no unexpected radius options; data corresponds to filters and boundary distances from Member 2 fixtures. Empty data alone does not prove filtering. | screenshots/W06-filters and requests/W06-map |
| W07 P0 | In Awaiting cleanup select unlinked unresolved incident; select linked event in another filter. | Unlinked incident says no cleanup event created yet; linked event shows incident and evidence where applicable. Resolved incidents excluded from Awaiting cleanup. | screenshots/W07-unlinked, W07-linked |
| W08 P0 | Apply for test organization with official Kesbewa divisions; try missing selections; submit valid application. Human superadmin reviews/approves it. | Validation works; pending/approved statuses and granted workspace access are consistent. Do not elevate applicant in SQL and call this a pass. | screenshots/W08-application, W08-review, W08-workspace |
| W09 P0 | Org admin creates draft, leaves/reopens editor, updates text; creates second draft and deletes through cross control, cancel confirmation once then confirm. | Draft persists, update saved; cancel keeps it; confirm deletes it; UI returns to valid state. | screenshots/W09-draft, W09-delete |
| W10 P0 | Review covered incidents for Org A and B using Member 2's inside/outside, linked/unlinked/draft fixtures. Select markers. | No resolved items or outside-area entries; no side activity list; own draft/upcoming/ongoing yellow, other's public event blue, unclaimed incident red; other org's draft private; selected details accurate. | screenshots/W10-orgA, W10-orgB; record fixture IDs |
| W11 P0 | Complete publication requirements, assign coordinator, publish; volunteer joins; admin opens attendance, adds participant update and AFTER evidence, completes eligible event. | Transitions, attendance and evidence persist; readiness explains missing requirements; successful completion appears correctly. Get fresh event version after updates; do not fabricate completion dates. | screenshots/W11-published, W11-attendance, W11-completed |
| W12 P1 | Publish separate incident-linked test event, then cancel with reason. | Event cancelled; unresolved incident remains discoverable and becomes awaiting cleanup if no other qualifying event. Verify with Member 2. | screenshots/W12-cancelled, W12-incident |
| W13 P0 | Trigger update to your test volunteer; open Notifications, switch Unread/All, mark one read, follow action. | Correct recipient, meaningful target, unread count updates and persists. Coordinate phone check with Member 3; do not send unrelated messages. | screenshots/W13-inbox, W13-read |
| W14 P1 | Keyboard-only Tab/Shift+Tab/Enter/Escape on login/form/modal; check visible focus, labels, error association; resize 1440x1000 and 390x844; inspect contrast using DevTools if available. | Core tasks operable; text/buttons readable; no clipped controls or horizontal page overflow. Record actual measured contrast where used, not a blanket accessibility-compliance claim. | screenshots/W14-focus, W14-narrow; logs/W14-notes.txt |
| W15 P1 | Repeat login/session restoration, report viewing and discovery on a second available browser. | Same core behavior; record exact browser versions and unsupported combinations. Do not call Edge+Chrome different rendering engines. | screenshots/W15-browser2; logs/W15-matrix.csv |
| W16 P1 | DevTools offline on a test page, try a read/controlled save; restore network and retry once. | Clear failure/recovery, no duplicate write or lost confirmed data. Record whether a retry is user-triggered or automatic. | screenshots/W16-offline, W16-recovered |
| W17 P0 | Sign out; attempt protected navigation/back/reload. | Protected data unavailable to signed-out context; backend rejects unauthorized access. | screenshots/W17-signout |

If an event requires future start for publishing, use a start a few minutes ahead and wait until it becomes ongoing. A coordinator may alter only a synthetic fixture to accelerate API testing, but label it setup and do not claim that tests the real-time transition. Never use a production organization.

## 5. Local automated web checks (separate from hosted UI evidence)

Codex inspects package scripts, installs locked dependencies only if missing, then executes from `web/`. Record exit codes immediately after each command; PowerShell does not stop on an npm failure automatically.

```powershell
Push-Location web
npm run lint 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/web-lint.txt')
$lintExit = $LASTEXITCODE
npm test 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/web-tests.txt')
$testExit = $LASTEXITCODE
npm run build 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/web-build.txt')
$buildExit = $LASTEXITCODE
Pop-Location
@{lint=$lintExit;tests=$testExit;build=$buildExit} | ConvertTo-Json | Set-Content (Join-Path $evidenceDir 'logs/web-exit-codes.json')
```

Do not run a dependency upgrade to hide an error. Test counts come from actual output, not the previous smoke summary. Lint/build success is not web acceptance success.

## 6. When stuck — paste to Codex

```text
Inspect the failed case's screenshot, browser console and sanitized request/response. Determine whether the failure is application behavior, missing test data, or an automation selector/timing mistake. Preserve the original attempt. If the harness is wrong, correct only the harness, explain why, and rerun that case with a new attempt number. If the application failed, write a reproducible defect and continue independent cases. Do not silently switch to localhost or bypass UI actions that the case intends to test.
```

## 7. Report assembly responsibility

At 22:00 collect each member's summary, results, defects and evidence index. Reuse existing smoke evidence under its original run/build; do not relabel it as today's new member execution. Deduplicate common login/health checks and exclude setup/cleanup from product-test counts. Use the supplied DOCX template's headings, adding a clearly identified actual-results section. Record usability as separately pending unless genuine study data is supplied. Leave device tests pending until Member 3 provides observations. Export a readable report with numbered figures/captions and relative evidence references, verify every image and table, then let the user review/upload by 23:30. No invented pass percentages, tooling claims or participant results.
