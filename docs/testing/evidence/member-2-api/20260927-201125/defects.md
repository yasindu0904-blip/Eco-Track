# Defects

Prior smoke D01 remains open; no corrective build verified. See ../../2026-09-27-hosted-smoke/DEFECTS-AND-BLOCKERS.md.

## D01 server evidence update

Northflank logs at 2026-09-27T12:35:06.984Z identify Prisma P2028: Unable to start a transaction in the given time, with createIncident service/controller stack. This correlates with initial smoke SM16 at 12:35:06.530Z. See requests/A14_attempt-01_server-logs.json. Immediate failure now supported by server evidence; cold-connection/pool saturation cause still unconfirmed. No request ID in retrieved lines. Frequency: one historical failure, later smoke retest passed. No corrective build verified; remains OPEN. No restart or new hosted reproduction performed.

## M2-D02 ? Volunteer withdrawal HTTP 500 (High, OPEN)

Environment: hosted API, deployed revision inspected as 4181db9c2dd455569aa872ce0c73541c8cd632ce. Preconditions: M2 published event, joined volunteer, UNMARKED attendance. Reproduction: POST /events/327878e3-9476-467a-acea-1928e69baea6/participation/withdraw as test volunteer. Expected 200 with WITHDRAWN; actual 500 INTERNAL_SERVER_ERROR at 2026-09-27T16:30:19.298Z. Frequency: one observed attempt before retest. Participant 7cbd39f7-dbb9-4a23-b5cb-18eb85b74e83 remained JOINED, withdrawn_at NULL. Server logs: Prisma P2028 at commit, transaction timeout 5000ms, elapsed 6196ms. This identifies the immediate failure, not its underlying latency cause. Evidence: requests/A09_attempt-01_withdraw.json, A09_attempt-01_post-failure-db.json, A09_attempt-01_server-logs.json. Workaround: retry only after state verification; retest pending. No corrective change deployed.

M2-D02 retest: requests/A09_attempt-02_withdraw.json returned HTTP 500 at 2026-09-27T16:31:34.743Z (8118ms). Frequency 2/2 withdrawal attempts; remains OPEN, no corrective change. Rejoin not executed. Later attendance/completion of the still-joined participant passed independently.
