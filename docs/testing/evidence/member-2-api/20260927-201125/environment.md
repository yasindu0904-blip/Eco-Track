# Environment

Tester: Chirana
Run: 20260927-201125 (Asia/Colombo)
Started UTC: 2026-09-27T14:41:25.627Z
API: https://p01--eco-track--xnjn7t9fk69n.code.run/api/v1
Health: same origin /health
Branch: test-chirana
Local HEAD: 4181db9c2dd455569aa872ce0c73541c8cd632ce
Deployed commit: unverified
Node: v22.20.0
Browser: not used
Tracked working tree changes: none. Untracked files excluded from this status check.
Docker CLI present, daemon unavailable. Local Node differs from CI Node 24.
JMeter and Java availability not rechecked in this run.
No purchases, deployments, scaling, restarts or hosted writes authorized for this initial stage. Northflank inspection is read-only.
Missing docs/test-docs/info.txt; starter guide contains stale filename.

New branch: test-chirana. Same local commit as previous run. Previous evidence preserved at ../20260927-194215/.

Current Northflank observations:
- eco-track: HTTP 200; deployed 4181db9c2dd455569aa872ce0c73541c8cd632ce; instances 1.
- ecotrack-notification: HTTP 200; deployed 4181db9c2dd455569aa872ce0c73541c8cd632ce; instances 1.
Configuration only; worker heartbeat, database health and phone delivery not tested.

Stage update: Docker Desktop started successfully. Isolated Node 24 container used for CI parity. Local containers named with m2-20260927201125 prefix on dedicated network; no published DB/Redis ports. Shared environment files were not loaded in the runner. JMeter 5.6.3 installed and zero-user validated. Test-project DB access pending.

2026-09-27T16:05:40.536Z: Test-project connection successful with verify-full and Supabase Root 2021 CA. HTTP profile persisted in expected project; see logs/A02-db.json. Credentials/certificate local path excluded from exports.

Final-stage clarification (2026-09-27T17:10:40.6180804Z): Earlier entries are chronological snapshots. Docker isolated checks completed with Node 24; final 163 tests passed. Hosted target verified; deployed revision inspected as 4181db9c2dd455569aa872ce0c73541c8cd632ce. JMeter 5.6.3 ran with Microsoft OpenJDK 17.0.20 after a retained Java 25 compatibility failure. Worker health passed; fixture role restored. See HANDOVER.md for current status and remaining human evidence.
