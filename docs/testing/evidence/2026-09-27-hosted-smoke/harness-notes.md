# Test harness notes
- Initial API run used the invalid enum CITIZEN while restoring the temporary elevated test profile. This was a harness error, not an EcoTrack defect. The profile was subsequently restored to USER; its temporary Auth identity was deleted. The corrected retest completed cleanup.
- Initial browser captures WEB03, WEB05 and WEB06 were taken before asynchronous screens finished loading. They are preliminary captures, not accepted page-render evidence. Use browser/retest results and screenshots for the report.
- Browser authentication uses a real temporary confirmed Supabase user and injects its session into the browser. This tests authenticated rendering and backend integration; it does not test magic-link email delivery.
- API replays and read-only checks are included. Timing values are individual smoke observations, not load-test benchmarks.

- Final WEB06 automated locator expected the Unread empty-state text while All was selected. Visual review confirms the correct All empty state and API HTTP 200. See browser/verified/WEB06-review.json; the raw locator failure remains retained.

- L24 only checked HTTP 200 on an empty participation-history response; it does not establish that completed participation appears there. The consolidated table narrows this claim. L27 records the observed state, not a completion assertion. RT04 performs the actual final-state assertion.
