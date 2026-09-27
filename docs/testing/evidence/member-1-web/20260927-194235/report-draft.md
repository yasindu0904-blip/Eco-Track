# EcoTrack Test Report — 27 September 2026

Version 0.1, in progress. Prepared by Sahanya (Member 1). This follows the headings in the supplied `docs/test-docs/6 Template for Test plan.docx` and adds observed results. It is not an acceptance certificate.

## 1. Evaluation Mission and Test Motivation

Evaluate whether EcoTrack's hosted web app supports the principal citizen and organization workflows, communicates validation and errors clearly, respects role and private data boundaries, and recovers from common browser conditions. The team also examines API/database/security/performance and Android behavior in separately owned evidence packages. The report distinguishes planned coverage, executed observations, setup operations and unresolved work.

## 2. Target Test Items

Hosted web `https://eco-track-ctd.pages.dev`; hosted API `https://p01--eco-track--xnjn7t9fk69n.code.run/api/v1`; Supabase Auth/Storage in the original project; disposable application test database `eco-track-test` after connection confirmation; installed Edge and Chrome on Windows. Local source revision `4181db9c2dd455569aa872ce0c73541c8cd632ce`; deployed commit has not been verified. Official geography available in the prior smoke run comprises 73 Kesbewa GN divisions.

## 3. Test Approach

### 3.1 Objectives, techniques and oracles

Member 1's planned cases W01–W17 cover magic-link authentication, profile completion, incident creation and persistence, discovery filters, organization application and approval, event draft/lifecycle, notifications, keyboard and narrow-width UI, second-browser behavior, offline recovery and sign-out. Browser actions and visible results are compared with current source validation, the published workflow expectations in the team guide, and fixture IDs supplied by Member 2. Screenshots must show a fully loaded outcome or controlled error. API status alone is insufficient when content correctness is the assertion.

Member 2 owns independent API/database/security/performance and deployment evidence. Member 3 owns Android/device/resource/notification delivery evidence. Their results are pending handover and will be cited under their own run IDs; no ownership or execution is inferred here. SUS participant testing is outside this assignment.

### 3.2 Entry and exit criteria

Entry requires the hosted targets to respond, the hosted API to be confirmed against the disposable test database before writes, distinct authorized role accounts, and official Kesbewa divisions for geographic cases. A case passes only when its full expected observation is recorded. A reproducible mismatch is a failure with a defect record. A missing prerequisite is blocked; an unattempted case remains not run. Initial failure and retest are separate attempts.

### 3.3 Tools and environment

On 27 September 2026, the local web checks used npm, Vitest 4.1.11, TypeScript/Vite 8.2.1 and ESLint. Hosted signed-out checks used Playwright Core 1.55.1 controlling installed Edge 154.0.4258.37 and Chrome 153.0.8010.52. The browser baseline was 1440 × 1000; narrow login check was 390 × 844. Browser and API targets returned HTTP 200 at run start. Local source HEAD is not proof of the deployed revision.

## 4. Actual Results and Evidence

### 4.1 Prior hosted smoke baseline (separate execution)

The team's `docs/testing/evidence/2026-09-27-hosted-smoke/` package records initial API and browser checks, GN import, and lifecycle exercises. Initial incident creation failed with HTTP 500 at 12:35:06.530 UTC; later creation passed without a product fix, so D01 remains open/intermittent with cause unconfirmed. The completion HTTP 409 was caused by a synthetic SQL fixture's timestamp precision and passed after fixture correction. A notification locator expected Unread text while All was selected; visual review found the correct empty inbox. Prior browser login used an injected valid session and did not test email delivery. These outcomes are cited, not counted as new Member 1 execution.

### 4.2 Member 1 hosted browser execution

Current W-case status counts will be reconciled from `cases.csv` and `results.csv` at handover. At this draft stage, Edge loaded the signed-out login with HTTP 200; its native email control rejected `not-an-email`, and the page stayed signed out. On the login page, Tab and Shift+Tab followed the email-submit order, keyboard Enter on malformed input invoked native validation without an auth API request, focus was visible, and the 390 px document had no measured horizontal overflow. Chrome 153 loaded the signed-out login without page errors. These observations are partial W01, W14 and W15 coverage, not complete case passes. An unauthenticated `GET /api/v1/auth/me` returned HTTP 401, partially covering W17. The remaining authenticated steps await the volunteer, organization admin and reviewer session.

See `cases.csv`, `results.csv`, `evidence-index.csv` and the actual images in `screenshots/` for per-attempt evidence and timestamps.

### 4.3 Local automated web checks

Vitest: 16 test files and 48 tests passed. TypeScript and Vite production build passed; 187 modules transformed. The first `npm run lint` attempt ended in Node memory exhaustion before a lint verdict; a second ESLint run with a 1536 MB heap passed with exit 0 and no reported errors. The first Vitest startup hit `spawn EPERM` in a restricted execution environment; the rerun passed. These are local source checks, not hosted browser acceptance results.

### 4.4 Coverage and open findings

The complete W01–W17 status and unique-case counts are pending further execution. D01 from the prior smoke run remains open. Real magic-link delivery/callback, organization approval, populated spatial filtering, end-to-end event lifecycle, actual notification targeting, offline recovery and sign-out remain to be established in this Member 1 run. Member 2 and Member 3 handovers are pending.

## 5. Deliverables

Member 1 run package: `environment.md`, `cases.csv`, `results.csv`, `fixtures.csv`, `defects.md`, `summary.md`, `evidence-index.csv`, screenshots, sanitized logs/requests and tool snapshots. Earlier smoke package remains at its original path. A finalized DOCX based on the supplied template will follow when actual results and other members' handovers are available.

## 6. Risks, Dependencies, Assumptions, and Constraints

- Deployed commit is unverified; current local source is used only to derive planned assertions.
- Hosted application database attachment requires fresh confirmation before test writes. Auth and Storage share the original Supabase project.
- Tests must use synthetic records prefixed with the member/run ID; fixture setup is not a product outcome.
- An empty discovery or inbox list does not prove populated filtering or recipient correctness.
- The prior intermittent incident HTTP 500 requires server log diagnosis; its successful retest did not close it.
- Physical phone delivery and usability participants must not be inferred from browser or worker records.

## 7. References

1. EcoTrack team Member 1 web testing guide, repository, accessed 27 September 2026.
2. EcoTrack hosted smoke README, consolidated RESULTS.csv, defects and harness notes, repository, accessed 27 September 2026.
3. EcoTrack local source modules and web package manifest at commit `4181db9c2dd455569aa872ce0c73541c8cd632ce`, accessed 27 September 2026.
4. Course-supplied `6 Template for Test plan.docx`, repository, accessed 27 September 2026.
5. Playwright, *Page API and screenshots*, https://playwright.dev/docs/api/class-page (accessed 27 September 2026).
6. Vitest, *Getting Started*, https://vitest.dev/guide/ (accessed 27 September 2026).
7. Vite, *Getting Started*, https://vite.dev/guide/ (accessed 27 September 2026).
8. ESLint, *Documentation*, https://eslint.org/docs/latest/ (accessed 27 September 2026).
9. Other member evidence references will be added when their handovers arrive.
