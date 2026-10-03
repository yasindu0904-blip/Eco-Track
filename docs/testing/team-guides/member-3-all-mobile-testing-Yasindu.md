# Member 3 — Android, permissions, connectivity and resources

This is a self-contained execution guide for **Member 3**. Give this file to Codex in your Eco-Track checkout; no previous chat history is required. You own physical-device evidence. Camera/gallery, real magic-link login and phone push receipt were postponed and are still pending.

## 1. Start here — copy this prompt into Codex

```text
Read docs/testing/team-guides/member-3-all-mobile-testing-Yasindu.md and carry out my Member 3 testing assignment step by step. First read the applicable AGENTS.md, relevant database_docs, docs/testing/README.md and the materials under docs/testing/materials, and the existing hosted-smoke evidence guide and defects. Inspect source routes and validation before writing test scripts. Do not assume old screenshots or local HEAD match the deployed build.

Create a new timestamped run under docs/testing/evidence/member-3-mobile/ (YYYYMMDD-HHmmss in Asia/Colombo), plus cases/results/fixtures/evidence-index files described here. Reuse existing evidence by reference, never overwrite it. Record planned cases as NOT_RUN initially. Execute available tests, save sanitized evidence, and ask only for missing account access, physical-device actions or decisions that actually block a step. Continue independent checks while waiting. Never invent screenshots/results, print credentials, reset shared data, send real-world messages, or deploy application changes. Coordinate shared fixtures and load windows with the team. Keep failures and retests separate. Tell me exactly when and where a human screenshot is needed. Finish with the report-ready handover specified in this guide.
```

Codex should ask for your name and missing test-account access once, then work through the stages below. It can read code, run tools, build test scripts, collect outputs, classify failures and draft the report section. It cannot claim physical actions, inbox delivery or phone screenshots that nobody observed.

## 2. Evidence destination

From the repository root in PowerShell, Codex can create your run:

```powershell
$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceDir = Join-Path (Get-Location) "docs/testing/evidence/member-3-mobile/$runId"
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

## 3. Connect the device and record the build

1. Use the installed EAS **preview release APK**, not Expo Go. This profile embeds JavaScript and uses the hosted API; it should open with Metro stopped. Record EAS build ID/link if known, installed version/build, APK hash if available, device model and Android version. An app version alone may not identify the exact build.
2. Do not rebuild/reinstall automatically: test the actual agreed build. If it is wrong, coordinate a replacement build; preserve prior evidence under its original build. `adb install -r` replaces an installed matching-signature APK; signature errors require a deliberate decision, not automatic uninstall/data loss.
3. Enable Developer options → USB debugging on your Android, connect USB, unlock phone, accept the computer's debugging prompt. Physical permissions/inbox actions require you; Codex can guide/capture via ADB once connected.
4. Locate SDK platform-tools. Do not assume ANDROID_HOME is set. Run from repository root:

```powershell
$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) | Where-Object { $_ }
$sdkPath = $sdkCandidates | Where-Object { Test-Path (Join-Path $_ 'platform-tools\adb.exe') } | Select-Object -First 1
if (-not $sdkPath) { throw 'ADB not found: use Android Studio SDK Manager to locate/install Android SDK Platform-Tools.' }
$adbPath = Join-Path $sdkPath 'platform-tools\adb.exe'
& $adbPath version
& $adbPath devices -l
```

If more than one device appears, set `$deviceSerial` to the intended serial and use `-s $deviceSerial` on every subsequent command. If unauthorized, accept the phone prompt; if offline, reconnect. Do not proceed against an unidentified phone.

```powershell
$deviceSerial = 'REPLACE_WITH_YOUR_DEVICE_SERIAL'
& $adbPath -s $deviceSerial shell getprop ro.product.model
& $adbPath -s $deviceSerial shell getprop ro.build.version.release
& $adbPath -s $deviceSerial shell dumpsys package com.ecotrack.mobile | Select-String 'versionName|versionCode'
```

Keep personal device identifiers private if not needed in the report. App package expected `com.ecotrack.mobile`; verify it on device.

Paste to Codex:

```text
Identify the connected Android device using ADB without modifying or reinstalling the app. Record package, version/build, model and OS in my evidence folder. Use the installed hosted preview APK with Metro stopped. Guide me one case at a time for human permission/camera/inbox actions; capture screenshots and scoped logs only after I confirm the result. Prepare resource measurements and local mobile checks while I do physical tasks. Never mark push delivery, camera access or GPS passed from API responses alone. Keep all postponed manual cases pending until observed.
```

## 4. Capture screenshots safely

For each matrix case, navigate on the phone, wait for final state, then tell Codex: “Capture Mxx now; I observed [actual result].” Prefer this command pattern; PowerShell text redirection can corrupt binary screenshots:

```powershell
& $adbPath -s $deviceSerial shell screencap -p /sdcard/ecotrack-test.png
& $adbPath -s $deviceSerial pull /sdcard/ecotrack-test.png (Join-Path $evidenceDir 'screenshots/M01_attempt-01_login.png')
& $adbPath -s $deviceSerial shell rm /sdcard/ecotrack-test.png
```

Change only the local filename per case. If ADB is unavailable, take screenshots using the phone's buttons and transfer originals into the same folder. Record that manual method. Do not use screenshots containing private notification previews, emails, passwords or tokens; recapture with test data or redact copies and describe redaction.

The old smoke checklist lives at `docs/testing/evidence/2026-09-27-hosted-smoke/manual/SCREENSHOT-CHECKLIST.md`. Keep new evidence in YOUR member folder and cross-reference it from the old checklist/execution record; do not duplicate counts or overwrite the smoke evidence.

## 5. Physical-device cases

Use separate cases for allow/deny/recovery where results differ. Save `screenshots/Mxx_attempt-01_<state>.png`, relevant `logs/Mxx.txt`, and observations in results.csv.

| ID / priority | Human + Codex steps | Expected observation |
|---|---|---|
| M01 P0 | Stop Metro; launch installed preview APK, sign out if appropriate, request magic link to own test inbox, open link on device, complete profile if needed; force-close/reopen. | Works without laptop Metro; actual email arrives and callback signs in; session persists. Record each step; existing session is not proof of magic-link delivery. |
| M02 P0 | Report incident → photo → Take photo. Test denial first on a dedicated test session, then enable permission in Android Settings and retake. | Clear denial/recovery behavior, native camera opens, captured image preview visible, no photo UUID caption, Remove works. Do not erase app data to reset permissions without discussing lost state. |
| M03 P0 | Add from gallery; choose test image; remove/reselect; test maximum count and unsupported/oversized file where feasible. | Valid image preview; appropriate picker/permission behavior for actual Android version; limit/error matches source. No unwanted access or crash. Do not expect a gallery permission dialog on every Android picker version. |
| M04 P0 | Select category, enter synthetic title/description; move map, confirm location, attach photo and submit. Check My Reports after restart. | Correct single record/photo/location persisted; no duplicate on normal retry; photograph retrieval works. Member 2 can verify DB record with UUID. |
| M05 P0 | Find cleanup activity with location denied, then allowed; use 1/2/3 km and Awaiting cleanup; select unlinked incident then linked event. | Permission recovery, appropriate nearby results, unresolved incidents, linked incident/evidence displayed or no-cleanup message. Record actual versus simulated GPS. |
| M06 P0 | Log in as test org coordinator/admin; open eligible ongoing event → Upload evidence → Take photo, then gallery; upload valid AFTER evidence. | Camera available from event management, both input methods upload, preview visible, no raw evidence ID. Screenshot BEFORE clicking upload and saved evidence after. |
| M07 P0 | As volunteer join test event; admin marks attendance/posts update; refresh/reopen volunteer view, then withdraw from another event. | Role-appropriate actions, membership/attendance consistent, updates visible, withdrawal persists. Use accounts assigned to you, not deleted smoke Auth identities. |
| M08 P0 | Ensure Android notification permission granted and test device registered. Put app in background. Ask Member 2 to trigger a legitimate test-event update to that user; note UTC trigger time; wait and record arrival; tap notification. | Actual system notification shown for correct recipient, opens appropriate in-app destination, unread state sensible. Save system tray and destination screenshots. No receipt = FAIL or BLOCKED with reason, not PASS from worker logs. |
| M09 P1 | Repeat notification with foreground app; deny notification permission and verify app remains usable; restore it and repeat. | Behavior matches app's configured foreground handler; controlled denied-permission behavior. Do not require a foreground banner unless implementation specifies one. |
| M10 P0 | Open report; disable Wi-Fi AND mobile data, attempt refresh and a test save; restore network and retry once. | Clear error/recovery, no stuck spinner or silent duplication; previously confirmed data not lost. Do not claim offline caching/sync is required unless specified. |
| M11 P1 | Navigate form, background/resume, rotate if supported, reopen; test keyboard covering fields, long labels and scrolling. | Controls reachable; no crash; report whether unsubmitted input survives rather than assuming a persistence guarantee. |
| M12 P1 | Confirm mobile org workspace lacks Plan a cleanup event and Review covered incidents access buttons; existing allowed management remains. Check incident list separators/title-only emphasis. | Matches requested mobile navigation/formatting. Hidden button is not proof of backend authorization; Member 2 owns that. |
| M13 P0 | Sign out, relaunch, use back navigation; sign in as a different test role. | Previous protected content not accessible; new account sees its own data. |
| M14 P1 | Resource protocol below: idle then fixed navigation/map/photo workload. | Measured memory/CPU/frame/battery observations; no crash/OOM. No fabricated battery efficiency claim from one snapshot. |

For event completion ensure all active participants have final attendance and at least one AFTER photo. Use a scheduled event that legitimately became ongoing; if Member 2 accelerates a fixture in SQL, record that setup. Don't mark source-camera success based on a synthetic PNG upload.

## 6. Logs and resource measurements with ADB

Capture a narrow test window, not an indiscriminate device dump. Logs may contain signed URLs and account data: save raw output under ignored `tmp/`, then Codex must redact into `logs/`. Avoid `adb logcat -c` because it clears device logs unrelated to this test.

```powershell
$appPidText = (& $adbPath -s $deviceSerial shell pidof com.ecotrack.mobile).Trim()
# If multiple PIDs are returned, Codex selects/records the intended process.
& $adbPath -s $deviceSerial logcat -d --pid=$appPidText -t 500
& $adbPath -s $deviceSerial shell dumpsys meminfo com.ecotrack.mobile
& $adbPath -s $deviceSerial shell dumpsys gfxinfo com.ecotrack.mobile
& $adbPath -s $deviceSerial shell dumpsys cpuinfo
& $adbPath -s $deviceSerial shell dumpsys battery
```

Codex must add redaction and file capture instead of printing private logs wholesale. `cpuinfo` is device-wide; extract the app process and record sampling limits. Some Android versions restrict/omit metrics; report unavailable metrics, do not substitute guessed values.

Resource protocol:

1. Record device, Android, app build, network, screen brightness, battery %, charging state and other heavy apps. Keep conditions consistent.
2. Open app, wait two minutes idle, capture `logs/M14-idle-meminfo.txt`, `M14-idle-gfxinfo.txt`, `M14-idle-cpu.txt`, `M14-idle-battery.txt`.
3. Run the same five-minute workload: open dashboard, browse nearby map for two minutes, open three incidents, view photos, return to dashboard. Repeat twice if time permits. Record exact sequence/duration.
4. Capture matching `M14-active-*` outputs and again two minutes after settling. Extract TOTAL PSS/RSS where available (units!), frame statistics and CPU observations; compare baseline/active/settled states.
5. For battery observation unplug device and use a longer fixed 10–15 minute workload if practical. Record start/end %, elapsed time, brightness/network/temperature if available. Battery percentage is coarse; a short run cannot prove low power consumption or absence of a leak. Do not use `dumpsys battery set` to simulate results.
6. Save plots/tables only from real measurements, with units and timestamps. Distinguish battery observation from controlled energy profiling. An emulator is not equivalent physical-battery evidence.

```text
Run the M14 measurement protocol using ADB. Save baseline, active and settled measurements plus the exact workload, durations and device conditions. Parse available memory/frame/CPU fields without guessing missing values. Redact unrelated personal device information. Produce a small measured-results table and optional plot. State limitations: short duration, shared device activity, sampled CPU and coarse battery percentage. Do not declare a memory leak or efficiency compliance from one snapshot.
```

## 7. Local mobile checks — separate evidence

From repository root, with `$evidenceDir` already set and `logs/` created:

```powershell
Push-Location mobile
npm run security:check 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/mobile-security.txt')
$securityExit = $LASTEXITCODE
npm run security:map 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/mobile-map-privacy.txt')
$mapExit = $LASTEXITCODE
npm test 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/mobile-tests.txt')
$testExit = $LASTEXITCODE
npm run typecheck 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/mobile-typecheck.txt')
$typeExit = $LASTEXITCODE
npm run doctor 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'logs/mobile-doctor.txt')
$doctorExit = $LASTEXITCODE
Pop-Location
@{security=$securityExit;mapPrivacy=$mapExit;tests=$testExit;typecheck=$typeExit;doctor=$doctorExit} | ConvertTo-Json | Set-Content (Join-Path $evidenceDir 'logs/mobile-exit-codes.json')
```

Codex should verify locked dependencies first and avoid upgrades. Expo Doctor may need internet; save its exact result. Local source tests do not prove the installed APK contains that source revision. Appium is optional if already configured; do not spend the evening setting it up when manual device + ADB evidence can cover the required cases. If Appium is used, save its scripts/version and real execution log; otherwise do not list it as used.

## 8. Your specific handover

Give Member 1 the device/build metadata, completed physical checklist, named PNGs, scoped sanitized logs, resource CSV/table, unit/typecheck/Doctor outputs, and notification trigger/receipt timestamps linked to Member 2's event/notification IDs. Explicitly mark any postponed camera, magic-link or push observations NOT_RUN. Do not claim multi-device compatibility from one phone. Keep screenshots in this member folder and provide cross-references to the initial smoke manual checklist for report assembly.
