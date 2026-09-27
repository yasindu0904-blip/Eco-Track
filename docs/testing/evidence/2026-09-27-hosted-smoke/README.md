# EcoTrack hosted smoke-test evidence — 27 September 2026

Start here when preparing the test report. This is real execution evidence against the hosted web/API and disposable test database, not a proposed test plan.

## Scope and verdict

See `RESULTS.csv` for the consolidated executed checks and `DEFECTS-AND-BLOCKERS.md` for open issues. The initial incident HTTP 500 remains open even though the retest passed. Physical Android behavior and notification receipt remain unverified. Do not describe this as a complete system acceptance pass.

The first pass found missing GN geography. The subsequent setup imported **73 official Kesbewa GN divisions** (not all Sri Lanka) and enabled additional event lifecycle tests. Organization fixtures and memberships were inserted as test setup; organization registration/approval was not thereby tested. The synthetic event start time was advanced in the test database to exercise ongoing operations without waiting. These setup operations are labeled separately from product assertions.

## Where the evidence is

| Location | Contents / report use |
|---|---|
| `RESULTS.csv` | Consolidated checks, verdicts, expected/actual results and relative evidence paths. Use for the test-execution table. |
| `environment.json` | URLs, test database identity, local source revision, tools, browser setup, and limitations. Deployed commit is not verified. |
| `SM*.json`, `results.json` | Initial API run. Keep SM16 as evidence of the initial HTTP 500. |
| `retest/` | Second API run, including incident/photo creation, idempotency, retrieval, spatial persistence and worker heartbeat. |
| `browser/verified/` | Accepted hosted browser screenshots and network observations. WEB06-review explains the incorrect automated text expectation and successful visual review. |
| `browser/`, `browser/retest/` | Preliminary captures. Some capture loading states; do not use them as final page-render proof. |
| `lifecycle/` | Official geography and synthetic organization/event checks; request/response records and fixture IDs. |
| `GN-import.txt` | Output of the official NSDI Kesbewa boundary import. |
| `DIAG-*` | Local diagnostic evidence, clearly separate from deployed API results. |
| `DEFECTS-AND-BLOCKERS.md` | Failures, remaining coverage gaps, and the Redis queue isolation caveat. |
| `harness-notes.md` | Test-tool mistakes and corrections; not application defects. |
| `manual/SCREENSHOT-CHECKLIST.md` | Exact remaining screenshots to capture, actions and filenames. |
| `manual/execution-record.csv` | Fill in tester/device/build/time and actual manual results. |
| `tools/` | Runner source snapshots for traceability. They read ignored local credentials and create temporary synthetic fixtures; do not run against production. |
| `SHA256SUMS.txt` | File hashes recorded after evidence collection. |

## Screenshot captions

Use the following images from `browser/verified/`:

- `WEB01-login.png`: hosted login page. Does not prove magic-link email delivery.
- `WEB02-dashboard.png`: authenticated citizen dashboard using a real session for a temporary synthetic user.
- `WEB03.png`: incident reporting form, location confirmation and photo controls. API image upload was tested separately; no physical camera was used.
- `WEB04.png`: cleanup discovery with a simulated location and an empty upcoming-events result at capture time.
- `WEB04-awaiting.png`: two synthetic unresolved incidents loaded within the 2 km search area.
- `WEB04-incident-detail.png`: selected incident details and “No cleanup event created yet.”
- `WEB05.png`: empty My Reports state for the separate browser-test user.
- `WEB06-inbox-reviewed.png`: correct empty All-notifications inbox, with matching HTTP 200 network evidence. Does not prove phone push delivery.

## Interpretation rules

- PASS applies only to the assertion named in that record. HTTP 200 on an empty list is not proof of filtering correctness with a populated dataset.
- BLOCKED / NOT_RUN are not passes. Keep them in the report with their reason and next action.
- Preserve initial failures and later retests separately. No application fix was deployed during this smoke run.
- API durations are individual observations, not load-test or latency-SLA evidence.
- Browser checks used Playwright with installed Microsoft Edge, headless, 1440×1000. The simulated location was 6.795, 79.94.
- API login used temporary confirmed Supabase users; browser sessions were injected. Real magic-link delivery/opening is a manual check.
- Synthetic test database records and tiny PNG fixtures are retained for traceability. Temporary Supabase Auth identities were deleted, with cleanup results recorded. Existing users' credentials were not changed.
- Auth and Storage remain shared with the original Supabase project. Only application data is in the disposable test database.

## Report placement

Include this evidence under **Smoke Testing / Initial Environment Verification**. Reference check IDs, expected and actual results, defects/retests, and screenshot filenames. The broader report still needs functional, configuration, security, performance/resource and usability results required by the supplied course documents.

## Recorded execution counts

Raw records include setup/cleanup and repeated tests. Do not sum these as unique product-test coverage. The browser locator failure is superseded by the separate visual review.

| Run | Raw record statuses |
|---|---|
| Initial API | PASS: 29, FAIL: 1, BLOCKED: 2, NOT_RUN: 2 |
| API retest | PASS: 34, BLOCKED: 1, NOT_RUN: 2 |
| Browser verified | PASS: 9, FAIL: 1 |
| Lifecycle | PASS: 32, FAIL: 1 |
| Lifecycle retest | PASS: 12 |

Final lifecycle retest verified COMPLETED and CANCELLED states. Event evidence upload, attendance, in-app notifications, private-draft isolation and draft deletion passed their recorded checks. Physical camera, phone push receipt, registration/approval, linked-incident cancellation and exhaustive spatial filtering remain outside the completed checks.
