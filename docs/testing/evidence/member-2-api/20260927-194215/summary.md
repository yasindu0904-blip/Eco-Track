# Member 2 initial-stage findings

A01 attempted: BLOCKED. 4/4 unauthenticated subchecks passed; valid test identity remains blocked on account access.

Unique matrix cases: attempted 1; passed 0; failed 0; blocked 1; not run 13. No hosted database target proof, writes, fixtures, authenticated cases, database tests or load tests yet.

No browser screenshots required for these HTTP checks: JSON evidence records statuses, bodies, assertions, UTC and duration. Timings are individual requests, not performance results.

Next prerequisites: private application test-account configuration and verified test DB access. Northflank credentials do not authenticate application users. Docker daemon unavailable; CI Node 24 differs from local Node 22.

Northflank read-only inspection succeeded. API and notification services both report deployed commit 4181db9c2dd455569aa872ce0c73541c8cd632ce, matching local HEAD, and one configured instance each. Deployment status COMPLETED. No purchases or service mutations performed. This does not prove worker heartbeat, dependency health, autoscaling or multi-instance balancing.
