# Manual evidence review, 27 September 2026

15 JPEGs individually reviewed and copied unchanged from images/m4, m5, m10 and m11 into screenshots/manual; mappings recorded in evidence-index.csv. WhatsApp transfer may compress images. ZIP archives not imported. Visible device times are approximate capture times, not independently verified UTC.

## M04: normal submission/persistence passed
Tester confirms successful submission, matching details and exactly one original report after reopening. M4_manual_01 shows confirmed Bangalawatta location; 02 shows selection before confirmation; 03 saved description/location/photo/Active history; 04 ready-to-submit form; 05 My Reports entry.
Original M3-M04 TEST incident Yasindu was created at 20:18:56. Later evidence also shows separately titled M04 TEST incident Yasindu at 20:32:59. Tester described deliberately creating a nearby incident; this is not evidence of an automatic duplicate. Database UUID and retry-idempotency checks not performed.

## M05: successful radius/incident checks; gesture failure reported
M5_manual_01 shows location prompt; 02 transient loading at 3 km; 03 loaded 2 km with one incident; 04 selected Active incident at 1 km with No cleanup event created yet; 05 loaded 3 km with three incidents. Tester confirms navigation usable and no errors/stuck loading. Linked published event details/evidence still unverified. Exact location-denial feedback not captured.

### M3-DEF-002: cleanup activity map cannot be dragged
Severity Medium; status tester-reported, not fixed. Samsung SM-A236E, Android 14, EcoTrack 0.1.0 build 1; exact revision unverified. Steps: open Find cleanup activity, load nearby map, drag with finger. Expected map pans; actual tester says it does not move. Radius selection/page navigation work. M5_manual_03 and 05 show context only; static screenshots do not prove gestures. Frequency and root cause unknown. Retest pending; short recording would strengthen evidence.

## M10: visual offline error/recovery supported; full case pending
M10_manual_01 shows navigation drawer; 02 My Reports API-unreachable error while records/photo remain; 03 dashboard API-unreachable error; 04 subsequent report list without error and with both intentionally created records. Exact Wi-Fi/mobile-data toggles and post-recovery detail opening await tester confirmation. Offline save not tested. Do not mark full guide M10 complete.

## M11: instructed interaction subset passed
M11_manual_01 shows editable description with keyboard and test title. Tester confirms fields accessible, text retained and screen responsive after background/resume, portrait orientation retained without reported inaccessible controls. Process-death form persistence not tested.

## Remaining coverage
M06-M09 and M12-M14 pending. M03 unsupported/oversized files not tested. M01 tester confirmed login/session sequence; independent Metro-off verification not recorded. M02 missing denial feedback remains M3-DEF-001. No application fixes made.
