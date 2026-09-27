# Harness issues

Backend attempt 1 omitted docs/team-plans/MAP-03_Query_Plans.json from the container filesystem: 162 passed, 1 failed. Copied the unchanged checked-in file to /docs/team-plans and repeated the suite: 163 passed, 0 failed, 0 skipped. Runner template now mounts the file read-only. Application code unchanged.

Initial database readiness probes failed while the fresh container initialized, then succeeded before bootstrap.

Role-denial psql scripts exited 3 with ON_ERROR_STOP; this is expected SQL-error behavior. Initial expected-exit-1 annotation was wrong and is corrected in each log.

JMeter zero-user run validated plan loading only: zero samples is not a load-test pass.

Lifecycle A08 publication attempt 1 used wrong response path data.lifecycleStatus; actual success returned data.event.lifecycleStatus. Corrected runner assertion; subsequent idempotent publication read confirmed PUBLISHED. Preserve original harness failure separately from product M2-D02 withdrawal HTTP 500.
