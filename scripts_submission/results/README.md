# Run evidence

Every runner creates `<category>/<UTC timestamp>-<process ID>/console.txt`,
`summary.json` and `summary.md`. Test runs also include `selected-tests.json`.
Smoke runs save per-check assertions; JMeter saves JTL data and an HTML report.

Generated evidence is ignored by Git. Copy selected run folders into the final
submission after reviewing them. PASS applies only to the selected automated
scope; skipped cases and unavailable suites are not evidence of passing tests.
