# P01 planned workload — NOT RUN

Read-only GET incident-categories, incidents/nearby and events/nearby. HTTPS; 5-second timer before each request; 10s connect / 30s response timeout. Requires known incident/event IDs in returned data; empty results fail assertions. No auth logins, uploads, writes or notification triggers in the loop.

Stages: 1 user/10s ramp/60s, then 5 users/30s ramp/120s only if healthy. 10 users/30s/120s requires coordinator agreement. Gate execution on quiet-window agreement, valid completed-profile token, verified test data and monitoring. Stop for sustained >5% 5xx over 30s, recurring timeouts, OOM/restart or disruption. Operator must actively monitor JTL and service metrics; stop rules are not an SLA. Each attempt needs new JTL and empty HTML report folder. Use -q private.properties and -q tools/jmeter-safe.properties; no token on CLI. Capture API/worker start/peak/end CPU/memory/replicas/restarts.

Official download and requirements checked 2026-09-27: https://downloads.apache.org/jmeter/binaries/ and https://jmeter.apache.org/usermanual/get-started . Installation preparation is not load-test execution.
