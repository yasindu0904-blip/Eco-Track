# Member 2 handover — Chirana

Run: 20260927-201125, Asia/Colombo. This is the current evidence handover with explicitly outstanding human evidence, not an all-pass certification.

## Report-ready findings

Testing covered hosted API authentication, validation, incident uploads/idempotency, spatial filters, organization isolation, event lifecycle/concurrency, database restrictions, notification inbox/worker health, isolated backend checks and a bounded read-only performance baseline. Hosted application DB selection was verified by matching an HTTP-created profile in test project zkiciluuktuzkidjaiaz. Inspected local and deployed revision: 4181db9c2dd455569aa872ce0c73541c8cd632ce. These version observations apply to the recorded run, not future deployments.

The matrix contains 20 unique cases: 17 PASS, 1 FAIL and 2 BLOCKED/incomplete; all have at least partial execution. API A01–A14: 12 PASS, A09 FAIL, A12 incomplete. Isolated B01–B05: all PASS, with 163 tests passed, zero failed and zero skipped on the final suite attempt. P01 measurements completed but full guide coverage remains incomplete because human screenshots and exact restart/OOM evidence are absent. Retry attempts are not additional unique cases.

A09 withdrawal returned HTTP 500 twice. Server evidence shows P2028 transaction expiration at commit; the underlying latency cause remains unconfirmed. Rejoin was not executed. Attendance, evidence uploads, completion, incident resolution, history and reward checks succeeded independently. Defect M2-D02 remains OPEN.

Historical incident defect D01 remains OPEN. Logs show P2028 while starting the incident transaction. Subsequent incident creation passed, including the controlled A04 flow at 5926ms. A14 PASS means investigation completed; it does not mean a corrective change was verified.

Notification content and recipient matched the volunteer inbox and database. Worker health returned HTTP 200, online=true, waiting=0, failed=0. The user-authorized temporary role elevation affected only the M2 fixture and was restored to USER. There were no registered devices on the tested identities, so queued push, provider acceptance, receipt and actual phone display are not proven.

JMeter 5.6.3 with Java 17 measured three authenticated read-only endpoints, using known fixture assertions and five-second think time. One user/60s: 8 samples, 0 errors, p95 3397ms. Five users/120s: 82 samples, 0 errors, p95 2162ms, p99/max 3264ms. No SLA was agreed. The initial Java 25/Groovy assertion-tool failure is retained separately and is not a product error rate. These small baselines do not certify maximum capacity.

## Evidence navigation

- cases.csv: unique case status; results.csv: individual executions and attempts.
- defects.md: D01 and M2-D02, initial failures and distinct retests.
- fixtures.csv: owned fixture IDs and cleanup status; cleanup remains pending.
- member1-spatial-handover.md: official service-area/spatial fixture details.
- requests/ and logs/: sanitized API, SQL, deployment and execution evidence.
- performance-results.md: load statistics, resource observations and limitations.
- load-01-attempt-02-report/index.html and load-05-attempt-02-report/index.html: compatible JMeter reports.
- tools/: runners, JMeter plan and empty private-properties template. Filled credentials are excluded.
- evidence-index.csv and SHA256SUMS.txt: captions/paths and file-integrity manifest.

## Setup versus tested behavior

Organizations, memberships, service areas and spatial fixtures were SQL setup, not registration/approval/publication workflow proof. A08–A11 lifecycle cases used actual API workflows. Constraint-invalid writes were performed only in an isolated disposable DB, never hosted. Direct anon/authenticated role reads were checked read-only on hosted DB. Mocked backend provider tests are not live-provider evidence. Synthetic uploaded images are not physical camera evidence.

## Remaining actions

1. Member 3: coordinate a real registered-device notification test; save actual phone notification and opened destination with observed timestamp. No delivery claim until observed.
2. Chirana: open load-05-attempt-02-report/index.html and capture its statistics/error table as screenshots/P01-jmeter-summary.png. Supply any real Northflank start/peak/end screenshots taken during the recorded window. Missing historical screenshots must remain missing; API metric snapshots are distinct evidence.
3. Coordinator/developer: triage D01/M2-D02. Any correction requires a separately identified build and new retest evidence. Do not erase original failures.
4. Member 1: incorporate results and gaps in the supplied report template and reference the complete run folder. Usability/SUS, physical Android behavior, server failover, autoscaling and multi-instance load balancing are not demonstrated here.
5. After any new evidence is added, update cases/results/index as appropriate and regenerate SHA256SUMS.txt. Share privately through the agreed team method; this package has not been sent or published.

No paid Northflank operations, deployments, service restarts, scaling changes, shared resets or extra shared notification workers were performed.