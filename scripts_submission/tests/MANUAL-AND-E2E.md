# Manual mobile, browser end-to-end and usability testing

The production app currently has automated API/database integration and
component tests. No actual production live-browser E2E suite is present.
`npm run test:e2e` therefore exits 2/BLOCKED. Component tests with mocked fetch
or APIs are not relabeled as end-to-end tests. The separate old mockup's
Playwright screenshot specification is not part of production coverage.

For a manual whole-system walkthrough, record the interface/build, test user
role, environment, expected and actual outcome, timestamp and screenshots:

1. Sign in through the real magic link; reopen the app and confirm session.
2. Create an incident with location/photo; reopen it and compare details.
3. Organization admin reviews the covered incident; citizen sees the result.
4. Organization admin creates and publishes an event through the web.
5. Citizen finds/opens/joins the future event; admin sees the participant.
6. Coordinator records attendance, notes and evidence; reopen to verify.
7. Trigger a notification; confirm inbox, read count and real phone push.
8. Sign out; Back and reopening must not restore protected access.

Run only operations available to the authorized role; record not available or
blocked explicitly. Mobile camera/gallery, permissions and physical push need a
real phone. Existing team guides contain the detailed cases:

- `../../docs/testing/team-guides/member-1-web-testing-and-functional-Sahanya.md`
- `../../docs/testing/team-guides/member-3-all-mobile-testing-Yasindu.md`
- `../../docs/testing/team-guides/member-2-perfoemance-and-deploy-Chirana.md`

Existing evidence remains in `docs/testing/evidence/`. The usability report is
`docs/usability test/EcoTrack_Usability_Test_Report_2026-10-03.pdf`. Usability uses
participant tasks and SUS responses; there is no automated pass/fail script
that can replace participants. Preserve the actual exported response count.
