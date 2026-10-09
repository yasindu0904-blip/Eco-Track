# Toolkit verification — 4 October 2026, Asia/Colombo

The following commands were actually executed while creating this folder.
Evidence filenames use UTC, so the corresponding directory timestamps begin
with 20261003. Node used: v24.13.1. Original dependency versions/lockfiles were
preserved and no tracked application source or deployment settings were changed.

| Check | Actual result |
| --- | --- |
| `npm run setup` | PASS: backend/web/mobile locked dependencies installed; Prisma generated |
| `npm run test:toolkit` | PASS: 7 runner checks, including DB guard, environment isolation and smoke assertions |
| `npm run test:unit` | PASS: 40 backend + 14 web + 27 mobile = **81 checks**, zero skipped |
| `npm run test:ui` | PASS: 40 web + 65 mobile = **105 checks**, zero skipped |
| `npm run build:backend` | PASS: compiled `backend/dist/` |
| `npm run build:web` | PASS: compiled `web/dist/` with placeholder public configuration; this artifact is not configured for real login |
| `npm run test:smoke` | PASS: 4 unauthenticated checks against a temporary local compiled backend on port 5025; process stopped afterwards |
| `npm run test:integration` | BLOCKED: Docker Desktop Linux engine is stopped; no database suite was executed |
| `npm run test:all` | BLOCKED overall: unit/UI passed, integration blocked; verifies the combined runner continues and reports its incomplete scope |
| `npm run test:e2e` | BLOCKED as designed: no production browser automation suite exists |
| `npm run test:performance` | BLOCKED as designed: load opt-in/test bearer/fixtures/JMeter not configured; no load generated |
| Android cloud build | NOT RUN: script supplied; requires Expo account/signing and starts an EAS build |
| Compose configuration parsing / JMeter XML / JavaScript syntax | PASS |
| Private-value scan of generated folder against sensitive variables in root `.env` | PASS: no copied private values found |

Results are under `results/<category>/<timestamp>/`. See each `summary.json`,
`summary.md` and `console.txt` for the actual scope and selected files.

The smoke checks do not require database operations. Their success does not
remove the integration blocker. No real Gmail login, Storage upload or phone
push receipt was verified by these automated checks.

Existing mobile component tests emit React renderer/act warnings; those warnings
remain in their logs and the tests passed. Installation audit output also
reported existing dependency vulnerabilities (backend 4 high, web 2 high,
mobile 18 high); no automatic dependency upgrade or audit fix was applied.

To finish integration verification, start Docker Desktop and run, from this folder:

```powershell
npm run db:up
npm run db:prepare
npm run test:integration
```

Run the optional configured performance or Android commands separately. Do not
present blocked/not-run categories as passing tests in the evaluation report.
