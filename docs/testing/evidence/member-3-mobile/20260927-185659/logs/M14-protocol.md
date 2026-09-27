# M14 resource observation

Idle capture: 2026-09-27 22:50:40 +05:30. Tester said idle ready after instructions to leave dashboard untouched for two minutes. Idle duration and foreground screen are human-reported, not independently timed.

Raw evidence: M14-idle-meminfo.txt, M14-idle-gfxinfo.txt, M14-idle-cpu.txt, M14-idle-battery.txt.

- TOTAL PSS 102487 kB (100.09 MiB); TOTAL RSS 162496 kB (158.69 MiB); swap PSS 302 kB.
- Frame counters cumulative since collection began: 425 total; 13 janky (3.06%). Not a pure two-minute idle interval. Do not treat as workload-specific frame result.
- dumpsys cpuinfo reports 0.1% app CPU for historical 22:40:43-22:45:43 window, not current idle window. Historical only; not a valid instantaneous idle CPU measurement.
- AC powered, battery 100%, temperature 37.4 C. No discharge/energy-efficiency claim permitted.

Planned human workload: five minutes total; two minutes nearby map/radius and marker interaction, two minutes three incident/event details and photos, one minute My Reports and return to dashboard. Do not submit or modify data. If map dragging fails use working radius/marker controls and report deviation. Active snapshot immediately on completion; settled snapshot after two more minutes idle. Keep connection/brightness unchanged. Start/end and deviations to be reported by tester.

Earlier initial snapshot had no process; preparation snapshot is not the controlled idle baseline. Short observations cannot establish absence of memory leaks or general performance compliance.

## Post-workload capture

Tester reported done; capture 2026-09-27 22:58:38 +05:30. Approximately 7m58s between capture calls, including instructions/response delay; do not claim exactly five measured minutes of activity.

Raw evidence: M14-active-meminfo.txt, M14-active-gfxinfo.txt, M14-active-cpu.txt, M14-active-battery.txt.

- PSS 177953 kB (173.78 MiB); RSS 232224 kB (226.78 MiB); swap PSS 8651 kB.
- Cumulative rendered frames 7630; janky 178 (2.33%). These are raw cumulative counters, not a proven workload-only interval.
- CPU history reports 26% for PID 20384 during 22:50:43-22:55:43. Idle CPU history referred to PID 15613. Process identity changed across historical samples; reason unknown. Do not infer a crash or compute a same-process frame delta without verifying continuity.
- Settled reading still pending. User instructed to leave dashboard untouched for two minutes after capture.

## Settled capture and outcome

Captured 2026-09-27 23:05:57 +05:30 after tester reported done and no crashes or freezing. Actual capture gap from active snapshot is 7m19s, not exactly two minutes; includes response delay.

| Snapshot | PSS kB | PSS MiB | RSS kB | Cumulative frames | Cumulative janky frames |
|---|---:|---:|---:|---:|---:|
| Idle | 102487 | 100.09 | 162496 | 425 | 13 |
| Post-workload | 177953 | 173.78 | 232224 | 7630 | 178 |
| Settled | 146667 | 143.23 | 198416 | 7633 | 180 |

Memory PSS decreased by 31286 kB (30.55 MiB) after settling, remaining above initial idle. This short single-device run cannot establish a memory leak or its absence.

Settled CPU historical window 23:00:43-23:05:43 reports 8.8% for PID 20384. Battery stayed 100%, AC powered; temperature 38.1 C. No battery-drain conclusion.

Correction to process interpretation above: idle gfxinfo and active/settled meminfo identify PID 20384, and all gfxinfo snapshots share Stats since 85172802814069ns. PID 15613 belongs only to an older CPU history window; no process restart during this workload is established. Frame delta idle-to-active is 7205 rendered and 165 janky (2.29%) across the observation gap, including any activity outside the timed workload. Settled adds only three frames; percentage from that tiny interval is not meaningful.

M14 measurement completed; tester-observed no crash/freeze assertion PASS. No predefined memory/CPU performance threshold was supplied, so no general performance compliance PASS is claimed. Raw settled files: M14-settled-meminfo.txt, M14-settled-gfxinfo.txt, M14-settled-cpu.txt, M14-settled-battery.txt.
