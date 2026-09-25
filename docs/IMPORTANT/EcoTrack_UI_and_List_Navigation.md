# UI and list navigation

Implemented September 25, 2026.

## Shared presentation

- Web uses its sidebar for page navigation; redundant in-page Back/Dashboard buttons are removed. Previous/Next **page** controls remain for lists.
- Mobile uses the green EcoTrack header and drawer on authenticated member screens. Safe-area handling keeps content below the system status bar and above the bottom navigation area; standalone authentication screens also respect safe areas.
- Dashboard actions, login copy, report forms, and page introductions are simplified. Necessary input labels, validation, dates, review reasons, and action confirmations remain.
- Small status boxes are replaced by plain text where status is still useful. Notification unread counts remain on the bell.

## Growing lists

Only the selected section is displayed. Sections do not expand all records into one long page.

| List | Sections | Ordering |
| --- | --- | --- |
| Cleanup discovery and public events | Upcoming, Ongoing, Past, Cancelled | Upcoming: earliest start first. Others: latest start first. |
| Joined events | Same, plus Withdrawn / removed | Event start date, with a stable ID tie breaker. |
| My reports | Active, Resolved, All | Most recently reported first. |
| Organization requests | Pending, Approved, Declined, All | Newest application first. |
| Membership requests | Pending, Approved, Declined, Withdrawn, All | Newest request first. |
| Notifications | Unread, All | Newest first, with date headings. |
| Organization event management | All and event sections | All: latest update first; event sections use start date. |
| Admin review queues | Pending requests | Oldest first. |

Web lists show up to 20 records per page. Mobile lists start with 20 and provide Load more. Drafts, volunteer attendance, memberships, application review queues, and contribution history also expose remaining cursor pages. Map viewport panels retain their spatial filters and bounded scrolling.

The API applies section filters and ordering before its cursor limit. Tenant/user restrictions still apply. Upcoming means a published event whose start is in the future; ongoing means published and already started. Past means completed; elapsed time alone does not mark an event completed.

The primary event/report/application lists remember their section and loaded pages for the signed-in user, with a five-minute cache. Main list scroll positions are retained where returning from details. Signing out or changing accounts discards this memory. Report submissions, organization submissions, and participation changes invalidate the relevant history cache.

## Verification and manual review

Automated coverage includes shared pagination, late response handling, failed load-more retries, section/page restoration, partial-page boundaries, and real PostgreSQL/PostGIS tests for event sorting, cursor traversal, public projections, and user isolation. Application pagination rejects invalid filters/cursors. Existing membership, incident, event, web, and mobile tests remain part of verification.

Validation for this change: 40 web tests, 53 mobile tests, and 61 targeted backend tests passed. Web lint/build, backend/mobile type checks, and an Android Expo bundle export passed. Backend integration tests used the separate `ecotrack_ui_lists_test` database on the local PostGIS container. Local Docker web and backend images were rebuilt and both services returned HTTP 200 from their availability checks.

On a physical phone, check the header on report forms, maps, details, and the drawer, including rotation and a device with a display cutout. Check long names and larger system text. Native safe-area support requires a development build that includes `react-native-safe-area-context`.

For local Docker web/backend use the existing `compose.yaml` plus `compose.local-db.yaml` setup and `.env.docker`. No database migration is required for these UI and query changes. EAS builds are separate artifacts and are not replaced by a local rebuild.

## Organization incident review maps

Web and mobile Review covered incidents maps show only unresolved, non-archived incidents and upcoming/ongoing published events plus the viewing organization's own drafts within the viewing organization's active service-area boundaries. The backend applies coverage and lifecycle filters before pagination, so panning or zooming cannot expose records outside those boundaries. Expired but unarchived incidents remain available. Historical reviews or owned event links do not bypass current map coverage; authorized historical detail access remains unchanged.

The organization event map API opts into covered review discovery with `includePublic=true`; its default remains tenant-owned events for management. Review discovery includes the organization's own drafts as yellow markers labelled Draft, and excludes other organizations' drafts, completed events, and cancelled events. Published events from another active organization are visible only inside the viewing organization's active coverage, including standalone events without incidents.

The review map has no separate activity list; selecting a marker opens its details. Owned drafts and published events use yellow markers, including their linked incidents. Published events from other organizations and their linked incidents use blue markers. Incidents without a visible cleanup use red markers. Selecting it shows incident details and the active cleanup's public details, including the organizing organization. Its overlapping cleanup marker is suppressed to keep one selectable map point. Cancelling the cleanup removes the event from review discovery but leaves its unresolved, unarchived incident visible in red. Completed cleanup events resolve their incidents, removing both from this review map. Only owned events expose management navigation.

Draft lists and the selected draft editor have a top-right cross control to delete an owned draft. The action asks for confirmation, uses the existing tenant-authorized discard endpoint, preserves the draft if deletion fails, and removes it from the list on success. Published events cannot be discarded through this action.


## Volunteer cleanup discovery and incident evidence

Find cleanup activity remains the volunteer navigation entry on web and mobile. Its Awaiting cleanup section shows nearby ACTIVE or EXPIRED incidents without a PUBLISHED cleanup event; resolved and archived incidents are excluded. Private drafts never hide incidents or expose draft details to volunteers. A cancelled cleanup releases its unresolved incident back into this section. Radius options remain 1 km, 2 km, and 3 km, with spatial and lifecycle filters applied in the backend before pagination.

Selecting a cleanup event shows its linked incident and public evidence photographs below the event details, both on the map and on the event's join/details page. Standalone events omit this incident section. Selecting an awaiting incident shows its details, evidence, and "No cleanup event created yet." The existing public incident projection and signed photo URLs are reused; reporter identities, private organization reviews, and drafts are not exposed. Web uses page controls; mobile uses Load more.
