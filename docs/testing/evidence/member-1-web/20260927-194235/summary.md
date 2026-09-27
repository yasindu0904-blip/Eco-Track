# Member 1 web testing — execution summary

Execution is in progress. `cases.csv` contains 17 planned cases; at this checkpoint 4 have partial attempts classified `BLOCKED` (W01, W14, W15, W17) and 13 remain `NOT_RUN`. No complete W case is yet a PASS or FAIL. `results.csv` records each actual attempt. Prior hosted smoke evidence is referenced separately.

Fresh hosted observations: Edge 154 loaded the login and blocked malformed email; keyboard Tab/Shift+Tab followed the email-submit order, invalid Enter triggered native validation without an auth API request, and the narrow login had no horizontal overflow at 390 px. Chrome 153 loaded the signed-out login. The hosted API returned HTTP 401 for unauthenticated `/api/v1/auth/me`. All are partial case observations with evidence paths in `evidence-index.csv`.

Local checks: 48 Vitest tests passed in 16 files; build passed; ESLint passed on a larger-heap retry. Initial lint memory exhaustion and initial Vitest `spawn EPERM` were tool/environment failures, retained in `logs/`.

Outstanding prerequisites: volunteer magic-link sign-in, verified hosted test DB attachment before writes, organization admin and superadmin sessions, Member 2 fixture IDs, and Member 2/3 result packages. Deployed commit remains unverified. D01 from the earlier smoke run remains open/intermittent; no new Member 1 defect has been confirmed.

The final report must distinguish hosted browser observations, local automated checks, source review, and human observations. No test result should be inferred from a source inspection or an earlier run.
