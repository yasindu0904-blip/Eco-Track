# Remaining human evidence

- Phone delivery: Member 3 must use a real registered test device, coordinate a synthetic event notification, and capture the actual notification plus opened destination. Existing M2 identities have no registered devices; do not claim their in-app result is push delivery.
- Northflank metrics screenshots: real start/peak/end captures for API and worker during the recorded JMeter window, if taken. Missing earlier captures cannot be recreated as historical screenshots. Timestamped API metric snapshots are available as separate evidence.
- JMeter report screenshot: open load-05-attempt-02-report/index.html once generated, show the statistics and error table, and save screenshots/P01-jmeter-summary.png. This is a report screenshot, not a live UI execution screenshot.
- Exact service restart/OOM evidence is not established by the sampled running-container identities alone.
- D01 and M2-D02 remain OPEN. A09 withdrawal failed twice; no corrective deployment was made.
- Share the complete sanitized run folder privately with Member 1. No automatic report submission or publishing.

Verified Statistics screenshot: screenshots/P01-jmeter-summary.png (unaltered copy of screenshots/ss/Screenshot 2026-09-27 225427.png). Shows 82 samples, 0 failures, 0.00% errors, average 1442.73ms, median 1302.50ms, p95 2183.25ms, p99/max 3264ms, throughput 0.71 transactions/s. Use these JMeter dashboard statistics when captioning this screenshot. Earlier runner numbers use nearest-rank percentiles (p95 2162ms) and configured-duration throughput (82/120 = 0.6833/s); they are separate calculations, not additional executions. The Statistics screenshot requirement is satisfied; separate Errors-table, historical Northflank screenshots and real phone evidence are still absent. No test verdict changed.
