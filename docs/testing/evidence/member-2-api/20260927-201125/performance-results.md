# Performance observations

JMeter 5.6.3; compatible retry used Microsoft OpenJDK 17.0.20. Three read-only GET requests: incident categories, nearby incidents and nearby events at 6.795,79.94 within 2000m. Known IDs asserted, five-second think time per request, 10s connect/30s response timeouts. User confirmed quiet window in conversation. No SLA agreed. Tokens only in ignored private properties; no Auth load, writes or push loop.

## load-01-attempt-02-summary

Users 1; ramp 10s; duration 60s; samples 8; assertion errors 0 (0%); throughput 0.13333333333333333/s; p50 1553ms; p95 3397ms; p99 3397ms; max 3397ms. Observed baseline only, no SLA pass/fail. Throughput below uses configured duration.

## load-01-summary

Users 1; ramp 10s; duration 60s; samples 9; assertion errors 9 (100%); throughput 0.15/s; p50 1654ms; p95 2141ms; p99 2141ms; max 2141ms. Harness failure: Java 25/Groovy unsupported class version 69; all nine HTTP responses 200, assertions could not execute. Retained; not product error percentage.

## load-05-attempt-02-summary

Users 5; ramp 30s; duration 120s; samples 82; assertion errors 0 (0%); throughput 0.6833333333333333/s; p50 1298ms; p95 2162ms; p99 3264ms; max 3264ms. Observed baseline only, no SLA pass/fail. Throughput below uses configured duration.

## Service observations and gaps

Timestamped CPU/memory and container snapshots are in requests/P01-*.json. Running container identity was compared during measurements. This is not an exact restart counter, a continuous OOM audit, autoscaling proof or load-balancing proof. No actual dashboard/phone screenshots have been supplied. Dashboard reports and raw JTL files are retained separately for initial tool failure and retry. Ten-user stage not run.

eco-track cpu sampled range: 1.78297916666667 to 7.74316666666667 pct (provider units).

eco-track memory sampled range: 81.1824 to 81.3472 pct (provider units).

ecotrack-notification cpu sampled range: 0.467958564029291 to 1.07058928571429 pct (provider units).

ecotrack-notification memory sampled range: 73.0368 to 73.0384 pct (provider units).

Verified Statistics screenshot: screenshots/P01-jmeter-summary.png (unaltered copy of screenshots/ss/Screenshot 2026-09-27 225427.png). Shows 82 samples, 0 failures, 0.00% errors, average 1442.73ms, median 1302.50ms, p95 2183.25ms, p99/max 3264ms, throughput 0.71 transactions/s. Use these JMeter dashboard statistics when captioning this screenshot. Earlier runner numbers use nearest-rank percentiles (p95 2162ms) and configured-duration throughput (82/120 = 0.6833/s); they are separate calculations, not additional executions. The Statistics screenshot requirement is satisfied; separate Errors-table, historical Northflank screenshots and real phone evidence are still absent. No test verdict changed.
