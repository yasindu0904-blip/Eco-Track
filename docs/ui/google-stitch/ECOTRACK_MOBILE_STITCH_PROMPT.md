# EcoTrack complete Google Stitch mobile prompt

This specification converts the complete implemented EcoTrack web and mobile control surface into one cohesive mobile UI. It is intentionally more precise than a mood-board prompt: control labels, permissions, states, maps, forms, list actions, and destructive confirmations are part of the contract.

## Recommended Stitch workflow

1. Create a new mobile app project in Google Stitch.
2. Import the adjacent `DESIGN.md` as the project design system/context. If DESIGN.md import is unavailable, paste its contents before the master prompt.
3. Paste the master prompt below.
4. Ask Stitch to generate the frames in batches A–G if it does not create every frame in one pass.
5. Connect the named interactions in prototype mode.
6. Run the final consistency prompt at the end of this file.

## Master prompt — paste into Stitch

> Design a complete high-fidelity Android-first mobile application named **EcoTrack**, using the imported EcoTrack DESIGN.md without changing its product rules or visual tokens. EcoTrack is a Sri Lankan multi-tenant community platform for shared environmental incident reporting and voluntary cleanup-event coordination.
>
> Treat the screen and control list below as a behavioral contract derived from the already implemented React Native and React frontends. Create every named frame. Do not summarize several pages into a generic dashboard and do not omit “secondary” controls. Every listed button, field, text area, select, filter, chip, tab, status badge, map control, upload area, pagination action, notice, confirmation sheet, empty state, loading state, and error/retry state must be visible in the relevant frame or state variant.
>
> Use the 390 x 844 dp Android reference canvas, safe-area insets, minimum 48 dp targets, a five-item personal bottom navigation (Home, Map, Events, Activity, Account), a prominent Report action, and contextual navigation for Organization and Super Admin workspaces. Make long operational screens vertically scrollable with sticky page headers or sticky action bars only where useful.
>
> Build a clickable prototype for these journeys: passwordless sign-in; first profile completion; report an incident; browse map activity; open a public cleanup event; join and select multi-session availability; review joined-event updates; inspect personal impact; search and request organization membership; submit and track an organization application; switch verified organization workspaces; review a covered incident; create an incident-linked or direct event draft; add sessions and coordinators; publish; allocate participants; record attendance; post notes/evidence; transition/cancel/complete an event; administer members; and Super Admin organization review plus read-only map oversight.
>
> Use realistic Sri Lankan example data around Bolgoda Lake, Kesbewa, Polgasowita, Mampe, and Piliyandala. Use Nadeesha Perera as the signed-in citizen, Bolgoda Lake Conservation Society as the main tenant, and Green Kesbewa Collective as a second membership. Use human-readable status labels but preserve all status meanings. Never add a password, payment, employment, volunteer approval, incident assignment, or public private-data control.

## Global prototype and control rules

- Personal app bar: EcoTrack mark and workspace label on the left; notification bell with unread badge and avatar on the right.
- Personal bottom bar: Home, Map, Events, Activity, Account. “Report” is a visually raised center/FAB action.
- Organization app bar: Back to personal dashboard, organization monogram/name, role badge, workspace switcher. Context tabs are Overview, Incidents, Events, and Members only for ORG_ADMIN.
- Super Admin app bar: dark “Platform console” identity, notification bell, account menu. Tabs are Overview, Reviews, Map, Notifications.
- All long lists use cursor-style **Load more** controls, not infinite scrolling without feedback.
- All mutation pages have normal, loading, success, validation, network error, permission error, and disabled variants.
- Preserve the implemented compact loading labels where applicable, including **“Finding your location…”**, **“Loading more...”** / **“Loading…”**, **“Saving review...”**, and **“Saving…”**. Do not replace labeled busy states with an unlabeled spinner.
- A protected 403 screen never signs out the user. It explains that the action/workspace is unavailable and provides safe back navigation.
- Every map includes OpenStreetMap attribution and the controls/states defined in DESIGN.md.
- Destructive actions open a mobile bottom confirmation sheet; show at least one representative confirmation frame for each unique consequence.

---

# Batch A — authentication, session, and application shell

## A01 — Secure session splash

Create a quiet full-screen loading frame with the EcoTrack sprout-E mark, an animated circular/leaf progress indicator, title **“Securing your session”**, and copy **“Please wait while EcoTrack verifies your sign-in.”** Also create the alternate copy **“Securing your EcoTrack session…”** used on mobile. Keep the status bar and safe area visible.

## A02 — Passwordless sign in

Create the signed-out login screen:

- eyebrow **“Passwordless access”**;
- EcoTrack brand lockup and community-action tagline;
- title **“Sign in”** / welcome treatment **“Welcome to EcoTrack”**;
- explanatory text: enter an email to receive a secure passwordless link;
- persistent-label **Email address** field, mail icon, web/mobile placeholder variants `your@email.com` and `you@example.com`;
- primary button **“Send magic link”**;
- loading label **“Sending secure link…”** with spinner;
- inline email/error message area;
- security note with lock icon: the link is single-use and EcoTrack never asks for a password;
- mobile privacy note: the Supabase session is encrypted in Android secure storage.

Do not include password, Google sign-in, Facebook sign-in, or sign-up-role choices.

## A03 — Check your email

Create the post-send success state:

- success icon inside a lime-tinted circle;
- title **“Check your email”**;
- copy showing `nadeesha@example.com`;
- three numbered steps: **Check your inbox**, **Open the link on this phone/in this browser**, **Return to EcoTrack signed in**;
- secondary button **“Use another email”**;
- footnote to check the spam folder;
- subtle deep-link hint that tapping the email link returns to the EcoTrack app.

## A04 — Authentication error

Create an error frame titled **“We could not complete sign-in”** with a concise error notice and exactly these actions:

- primary **“Try again”**;
- secondary **“Return to sign in”**.

Keep the session/authentication error visually different from a permission error.

## A05 — Complete your profile

Create the first-login profile form:

- eyebrow **“One last step”**;
- title **“Complete your profile”**;
- description that contact details are needed for cleanup-event coordination;
- locked/read-only **Verified email** field with `nadeesha@example.com`;
- required **Full name** field with mobile placeholder **“Your full name”**;
- required **Phone number** field with placeholder `+94 77 123 4567`;
- privacy notice: phone is private and visible only to an authorized organization admin or event coordinator after joining their event;
- primary **“Continue to dashboard”**;
- secondary **“Sign out”**;
- saving and inline validation variants.

## A06 — Feature opening and render error states

Create two reusable full-screen state frames:

1. Loading: title **“Opening EcoTrack”**, copy **“Loading this feature securely…”**, spinner.
2. Render error: title **“This EcoTrack screen could not open”**, copy **“Your session is safe. Reload the application and try again.”**, primary **“Reload EcoTrack”**.

## A07 — Organization workspace unavailable

Create a protected-context error frame:

- title **“Organization access is unavailable”**;
- copy that active memberships changed or the workspace is no longer available;
- primary **“Return to personal dashboard”**.

Also create the mobile wording variant **“Organization workspace unavailable”** and **“Return to dashboard.”** Never show a sign-in failure treatment for this 403-style state.

---

# Batch B — personal Citizen & Volunteer workspace

## B01 — Personal dashboard

Create the full personal home screen with:

- top app bar: EcoTrack, **“Personal workspace”**, notification bell and unread badge;
- welcome block **“Welcome back, Nadeesha”** and copy about taking community action or continuing an organization workspace;
- refreshable 2 x 2 **“Your activity”** / accessibility label **“Citizen summary”** metrics: Reports, Upcoming, Impact points, Unread;
- **“Start here”** section, subtitle **“Choose one community action to continue.”**, with action rows:
  - **Report an incident** — “Pin the location and share what you found.”
  - **Explore the community map** — “Find incidents and cleanup activity around you.”
  - **Browse cleanup events** — “Review schedules and join as a volunteer.”
- **“Your activity”** section:
  - **My reports**;
  - **My joined events**;
  - **My impact**;
- **“Organizations”** section, subtitle **“Access stays separate for each organization.”**, with active organization card for Bolgoda Lake Conservation Society, role **Organization admin**, ACTIVE state and directional arrow;
- actions **Manage membership**, **Organization requests**, **View application history**;
- alternative empty card **“No active workspace yet”** with the existing explanatory copy;
- account footer/avatar, name, email, and **Sign out**;
- bottom navigation and raised Report action.

## B02 — Organization workspaces

Create the verified workspace chooser that exists on web and must be represented on mobile:

- eyebrow **“Verified organization access”**;
- title **“Organization workspaces”**;
- explanation that backend permissions are checked again for the selected tenant;
- **Back to citizen dashboard**;
- **Your active memberships** section with **Refresh**;
- two example cards, each showing organization name, slug, isolated role, and ACTIVE badge;
- per card **Open organization workspace**;
- ORG_ADMIN card also has **Manage members and requests**;
- ORG_MEMBER card shows the explanatory text that it does not grant membership administration;
- **Load more workspaces**;
- empty, loading, and error/retry versions.

## B03 — Profile and membership

Create one scrollable account/membership page preserving all existing sections and controls. Use title **“Profile and membership”** and subtitle **“Update your details or request access to an approved organization.”**

### Edit profile card

- locked **Verified email**;
- required **Full name**;
- required **Phone number**;
- **Save profile** with saving/success/error states.

### Find active organizations card

- heading **“Find active organizations”**;
- explanatory text that requests are for ORG_MEMBER access;
- search field **Organization name** / placeholder **“Search organizations”**;
- **Search**;
- organization result cards with name, description, slug;
- **Request membership** / disabled **Request pending**;
- **Retry organization search**;
- **Load more organizations**;
- no-results state.

### My membership requests card

- **Refresh requests**;
- request cards with organization, submitted date, review note, and status PENDING/APPROVED/DECLINED/WITHDRAWN;
- pending-only **Withdraw pending request**;
- **Load older requests**;
- empty and error states.

Page header action is **Dashboard** / **Back to dashboard**.

## B04 — Notification inbox

Create the complete personal inbox:

- eyebrow **“Personal inbox”**;
- title **“Notifications”**;
- exact subtitle **“Updates from your reports, memberships, events, and rewards.”**;
- back to Dashboard;
- count such as **3 unread**;
- **Unread only** switch;
- **Mark all as read**;
- stacked notification cards with title, safe message, date/time, unread accent and **NEW** badge;
- tap target for safe deep-link destination;
- fallback notice for a notification without a safe destination;
- **Load more**;
- **Try again** / **Refresh**;
- empty variants **“No unread notifications”** and **“Your inbox is clear”**;
- success notice **“All notifications are marked as read.”**

## B05 — My Impact

Create the complete non-monetary impact screen:

- eyebrow **“Citizen and volunteer”**;
- title **“My Impact”**;
- subtitle **“Verified community action and non-monetary achievements.”**;
- hero **Verified contribution points** with a large value and a living-atlas impact ring;
- exact note that points are recognition, not money, employment, or access permissions;
- breakdown cards for Verified incident reports, Sessions attended, Events completed, Special contributions; each shows points and verified action count;
- **Achievements** header and earned count;
- achievement cards with icon, name, description, earned date;
- empty achievement state **“Your first achievement is ahead”**;
- **Contribution history** with record count, `+points`, label, reason, timestamp;
- empty state **“No verified contributions yet”** and copy explaining submission/joining alone does not award points;
- **Load more history**;
- error notice and **Try again**.

## B06 — Account footer and sign-out confirmation

Create the Account tab variant that exposes the current name/email/avatar, personal-workspace identity, **Profile and membership**, **Organization workspaces**, **Organization requests**, **Notifications**, and **Sign out**. The sign-out confirmation sheet has **Cancel** and **Sign out**. This frame adapts controls that are currently distributed across the dashboard footer and web sidebar without removing any destination.

---

# Batch C — incidents and shared activity map

## C01 — Report incident: complete form shell

Create a four-step scrollable incident-reporting flow with a visible progress rail `1 What / 2 Details / 3 Location / 4 Evidence`. It may use separate linked frames for usability, but every control below must exist and entered values must persist between steps.

Header:

- eyebrow **“Community report”**;
- title **“Report an environmental incident”**;
- mobile title variant **“Report an incident”** and subtitle **“Confirm the location and share evidence that helps nearby organizations understand the concern.”**;
- back to Dashboard;
- safety note **“One shared report”** explaining EcoTrack finds covering organizations and the citizen does not choose one.

Step 1 controls:

- category cards loaded from the project, each with name and description;
- severity radio cards:
  - Low — Limited impact
  - Medium — Needs attention
  - High — Serious local hazard
  - Critical — Immediate danger.

Step 2 controls:

- required **Incident title**, project example **“Plastic waste blocking the Bolgoda canal”** and implemented mobile placeholder **“Plastic waste blocking a canal”**;
- required multiline **Description**, placeholder **“Describe the affected area and immediate hazards…”**;
- optional **Address or landmark**, placeholder **“Optional nearby landmark”**, example near Bolgoda Lake / Polgasowita;
- character/validation feedback.

Step navigation uses **Back**, **Continue**, and a quiet **Save form state locally** visual only if represented as a non-functional draft indicator; do not invent an offline submission action.

## C02 — Report incident: confirm location

Create the location step using the full map component contract:

- OpenStreetMap centered near Bolgoda/Kesbewa;
- fixed black center pin or tap-to-place pin;
- **My location** control with accessibility label **“Use my current location”**, requesting foreground permission only on tap;
- map zoom/compass controls and attribution;
- selected coordinates with six decimals and helper **“API order: latitude, longitude”**;
- hint **“Move the map to position the black pin.”**;
- the complete location card has accessibility label **“Choose and confirm an EcoTrack location”**;
- primary **“Confirm incident location”**; for reusable event-location variants preserve **“Confirm event location”**; after confirmation show **“✓ Location confirmed”**;
- warning/error states: denied permission, unavailable location, outside Sri Lanka, map tiles unavailable, and **“Zoom in to load locations. Wide national requests are disabled.”**

## C03 — Report incident: photo evidence and submission

Create the final evidence/review step:

- heading **“Add photo evidence”** / **“Photo evidence”**;
- upload zone **“Choose photos”**, then **“Replace photos”**;
- limit up to 5 photos;
- JPEG/PNG/WebP reference from web and compressed JPEG behavior from mobile;
- maximum 8 MB each after preparation;
- thumbnails, filename, size, remove/replace affordances;
- compression message, per-file upload progress, and safe retry notice;
- summary of selected category, severity, title, address, confirmed coordinates;
- sticky state text **Location confirmed** or **Location confirmation required**;
- primary **“Submit incident report”** with **“Submitting…”** and **“Saving your report safely…”** states;
- error copy that the form is preserved for retry;
- idempotent replay notice that the existing report is shown.

## C04 — Incident submitted / report opened

Create a success state that opens the submitted report rather than a dead-end illustration:

- success notice **“Incident report submitted successfully.”**;
- report title, ACTIVE badge, category/severity, address, time;
- actions **View report details**, **Report another incident**, **Return to dashboard**.

## C05 — My reports list

Create the list screen:

- eyebrow **“Your activity”**;
- title **“My reports”**;
- subtitle **“Follow the shared status of incidents you submitted.”**;
- back to Dashboard;
- compact action **New report**;
- cards with thumbnail or environmental placeholder, category, status, title, location/coordinates, reported date/time, severity, and **View report →**;
- loading state;
- empty state **“No reports yet”** / **“No incident reports yet”**, explanatory copy, and **Report an incident**;
- error notice.

## C06 — My report detail

Create the complete detail page:

- back to My reports;
- category eyebrow, title, reported time, lifecycle status chip;
- Description card;
- Location card with address and six-decimal coordinates;
- Photo evidence gallery;
- Status history vertical timeline with state, time, optional reason;
- Lifecycle/report-details card with Severity, Highlighted until, Archive after;
- primary **Report another incident**;
- resolved/expired/archived variants.

## C07 — Discover cleanup activity map

Create the full personal map discovery page and do not simplify its controls:

- eyebrow **“Community map”**;
- title **“Discover cleanup activity”**;
- exact subtitle **“Browse the visible map or request your location once for a five-kilometre search.”**;
- **Find activity near me** with locating state;
- **Refresh results**;
- **Report an environmental incident**;
- filter card with:
  - ACTIVITY: All activity, Incidents, Events;
  - STATUS: All current plus Active, Organized, Resolved as applicable;
  - CATEGORY: All categories plus loaded categories;
  - REPORTED: Any time, 24 hours, 7 days, 30 days;
  - **Apply filters**;
- result context **WITHIN 5 KM** or **VISIBLE MAP AREA** and count;
- map with accessibility label **“Citizen cleanup activity discovery map”**, incident/event markers, clusters, selection, My location, zoom, compass, attribution, wide-viewport warning;
- incident result cards with category, “Your report” when applicable, title, severity, status;
- event cards with **CLEANUP EVENT**, **JOINED** when applicable, organization, status;
- **Load more**;
- empty state **“No incidents found”** with move-map/widen-filters guidance;
- network and permission errors.

## C08 — Map activity detail sheet

Create two bottom-sheet variants attached to C07:

1. Incident: category, title, address/coordinates, description, Status, Severity, **Public false count**. Explain the false count neutrally; never call it a vote.
2. Cleanup Event: organization name, title, published/joined status, description, Status, Sessions count, **Open full event details**.

The sheet can be dragged/expanded and has a close handle without losing the current map viewport.

---

# Batch D — public cleanup events and volunteering

## D01 — Published cleanup events

Create the public event list:

- eyebrow **“Community cleanups”**;
- title **“Published events”** / **“Published cleanup events”**;
- subtitle **“Verified schedules, instructions, and volunteer availability.”**;
- back to Citizen dashboard;
- **Upcoming and active events** list;
- each row/card shows title, organization, first session time or **Schedule to be confirmed**, lifecycle status, and open arrow;
- selected-row state;
- **Load more**;
- loading text **“Loading events…”**;
- empty **“No published events yet”** with note that organization drafts appear only after publishing;
- error notice and retry.

## D02 — Public cleanup event detail

Create the event detail frame:

- back to Events;
- organization eyebrow, title, human-readable lifecycle chip;
- description;
- **Volunteer instructions** using the saved public instructions;
- **Location** using meeting address first, then event address/coordinates;
- **Sessions** cards containing date, start/end time, location, capacity/open capacity, and session status;
- privacy-safe content only: do not list public participant names, phones, internal notes, or private coordinator data;
- joined and not-joined variants;
- include the availability panel and participant-update destination below.

## D03 — Join cleanup / multi-session availability

Create the complete availability panel as an expandable card or full-screen sheet:

- eyebrow **“Volunteer availability”**;
- title **“Join this cleanup”**, changing to **“Your selected sessions”** after joining;
- copy: **“Select every session you can attend. Availability does not guarantee allocation.”**;
- participation status chip JOINED/WITHDRAWN/REMOVED;
- checkbox cards for every future session with date, time and location;
- primary state-dependent action:
  - **Join cleanup**;
  - **Update availability**;
  - **Rejoin cleanup**;
- destructive **Withdraw**;
- validation **“Select at least one future session.”**;
- closed-event notice **“This event is no longer open for joining.”**;
- removed notice explaining the event team removed the participation and it cannot be rejoined;
- success/error and loading variants.

Create the **Withdraw from event?** confirmation sheet with consequence text, **Keep participation**, and destructive **Withdraw**.

## D04 — My joined events

Create the personal volunteering list:

- eyebrow **“My volunteering”**;
- title **“My joined events”**;
- exact subtitle **“Active commitments, assignments, attendance, and history.”**;
- back to Dashboard;
- segmented tabs **Active** and **History**;
- cards show event title, organization, participation status, count of available sessions, and each active allocation as `Assigned [date] [time] · PLANNED/ATTENDED/ABSENT`;
- tap opens event;
- **Load more**;
- active empty notice **“Join a published cleanup to see it here.”**;
- history empty notice **“Withdrawn or removed events appear here.”**;
- loading and error states.

## D05 — Joined event schedule and participant updates

Create the joined-volunteer version of event detail:

- banner **“You joined this event”** and participation status;
- selected availability list;
- **Your allocations** with date/time/location and PLANNED/ATTENDED/ABSENT badge;
- **Participant updates** section with participant-visible note, event-team author, timestamp;
- **Refresh updates**;
- no-updates state;
- cancelled notice with reason;
- completed notice **“This cleanup event is complete.”**;
- controls to **Update availability** and **Withdraw** only when still allowed.

---

# Batch E — organization applications and personal requests

## E01 — Organization requests hub

Create a mobile hub with two tabs matching the web implementation:

- **New application**;
- **My applications** with count badge.

Header title is **“Organization requests”**, subtitle **“Follow each application from submission through review.”**, with back to Dashboard and account/sign-out access. This hub links to E02 and E03 without deleting the separate mobile back behavior.

## E02 — Request an organization workspace

Create the full, control-accurate onboarding form for an existing real environmental organization:

- eyebrow **“Organization onboarding”**;
- title **“Request a workspace”**;
- exact subtitle **“Submit an existing environmental organization for platform review.”**;
- notice that a Super Admin must review the organization and service areas before activation;
- **Organization details** card:
  - required Organization name;
  - Registration number, optional;
  - Description, multiline;
  - required Official email;
  - required Official phone;
  - required Official address, multiline;
- **GN service areas** card:
  - selected count such as `3/500`;
  - explanation that search supports GN Division, GN number, Divisional Secretariat, district, province or official code;
  - field **Search official areas**, placeholder **“Example: Polgasowita or Kesbewa”**;
  - **Search GN Divisions**;
  - selected-area chips/cards with area name, official code, DS and **Remove**;
  - search-result rows with GN number, DS, district, plus/add and check/selected control;
  - at least one selected official area is required;
- inline error notices;
- primary **“Submit for Super Admin review”** / web wording **“Submit application”** with submitting state;
- back to Dashboard.

Do not add a citizen-selectable organization role. Approval creates the first ORG_ADMIN according to backend rules. Do not invent verification-document upload controls in this frontend-mirroring pass because the current web/mobile UI does not expose them.

## E03 — My organization applications

Create the complete history/status page:

- eyebrow **“My requests”**;
- title **“Organization requests”**;
- successful-submit notice using the organization name;
- cards with organization name, PENDING REVIEW/ACTIVE/DECLINED/SUSPENDED/ARCHIVED badge, submitted date, official email, service-area count, each area name/status, and review notes;
- status color plus text/icon;
- **Refresh statuses**;
- **Create another request**;
- empty state **“No organization requests yet”** and **Start an application**;
- loading and error states.

---

# Batch F — verified organization workspace

## F01 — Organization workspace overview

Create the contextual overview for **Bolgoda Lake Conservation Society**:

- organization app bar with back to Dashboard, organization name, signed-in email, role badge and organization switcher when multiple memberships exist;
- Overview selected tab and contextual tabs;
- refreshable 2 x 2 **Organization summary** metrics: Covered incidents, Upcoming sessions, Joined participants, Pending requests;
- protected-access card showing MEMBERSHIP value (Organization admin/member), ACTIVE status, and WORKSPACE slug;
- section **“Manage local action”**, subtitle **“Workspace tools”**, compact **Requests** action;
- tools:
  - **Review covered incidents** — search reports in this organization’s GN Divisions;
  - ORG_ADMIN only **Members and requests**;
  - ORG_ADMIN only **Plan a cleanup event**;
  - **Manage cleanup events**;
- bottom contextual navigation and **Sign out** in account menu.

Create an ORG_MEMBER variant without membership administration or draft creation. Explain permissions calmly rather than rendering broken buttons.

## F02 — Covered incidents and owned events map

Create the complete organization map/discovery screen:

- heading **COVERED INCIDENTS**;
- live result sentence for loaded incidents and owned events;
- sentence/count for all loaded organization service areas;
- status filters: All current, Active, Organized, Resolved;
- CATEGORY filters with All categories;
- REPORTED filters: Any time, 24 hours, 7 days, 30 days;
- map with accessibility label **“Organization incident discovery map”**, translucent approved GN service-area polygons, selected area, **Next area/Focus area**, incident markers and organization-owned event markers;
- loading notice that visible results may change;
- boundary load error and a warning when more than 500 service areas makes the overlay incomplete;
- incident cards with category, title, severity, status;
- owned-event cards with title and status;
- **Load more activity**;
- empty state **“No covered incidents in this view”** and map-focus guidance;
- selected incident and event detail destinations.

## F03 — Organization incident review

Create the protected selected-incident review sheet/page:

- incident title, address/coordinates, description and **Incident evidence** gallery;
- access source label: Current service area, Historical review, or Linked event;
- **Your review** and **Public false count**;
- review status selector **Viewed**, **Valid**, **False**;
- when False, required **False reason** choices:
  - Insufficient evidence
  - Location is incorrect
  - Duplicate report
  - Not an environmental incident
  - Outside service scope
  - Other;
- conditional multiline **Private notes**, placeholder **“Visible only to authorized organization users.”**;
- Other requires an explanation;
- **Save review** with saving/success/idempotent/error states;
- contribution-recorded success variant;
- map/list action **Focus incident** and owned-event action **Open selected event** where those selected-result controls are rendered;
- ORG_ADMIN action **Create cleanup-event draft**;
- ORG_MEMBER read-only notice that review actions require Organization Admin access;
- never show private notes publicly and never interpret false count as rejection.

## F04 — Cleanup-event drafts list

Create the private draft list:

- eyebrow **“Private planning”**;
- title **“Cleanup-event drafts”**;
- subtitle **“Drafts do not claim incidents or appear publicly.”**;
- back to Overview;
- **New direct draft**;
- draft rows show title, Incident-linked/Direct, session count and coordinator count;
- selected state;
- **Load more drafts** from web parity;
- empty **“No private drafts yet”** with guidance to create a direct event or start from a covered incident;
- loading, success and error notices.

## F05 — Draft details and location

Create the create/edit draft screen:

- eyebrow **New private draft** or **Edit private draft**;
- title **“Plan cleanup activity”** or selected event title;
- exact subtitle **“Set the event location, sessions, and coordinators before publishing.”**;
- incident-linked notice when applicable;
- if linked-incident loading fails, show **Retry linked incident** without discarding draft form values;
- fields:
  - required Title;
  - required Description;
  - multiline Public instructions;
  - Event address;
  - Meeting address;
- full LocationPicker with event location, selected coordinates, My location, confirmation;
- when linked from an incident, show the incident as a reference marker and **Focus reference location** control;
- checkbox **“Use event location as meeting point”**;
- **Save private draft** / **Save changes** with saving and validation states;
- **All drafts** / **Cancel**;
- destructive **Discard private draft** / **Discard draft**.

Create the discard sheet with consequence that all sessions and coordinator assignments are removed, **Keep draft**, and **Discard**.

## F06 — Draft session manager

Create the Sessions step/card:

- Date using native date control; preserve the fallback placeholder **“YYYY-MM-DD”**;
- Starts and Ends native time controls; preserve fallback examples **“09:00”** and **“11:00”**;
- numeric Capacity, optional, positive only;
- Session address;
- multiline Notes with mobile placeholder **“Session notes”**;
- checkbox **“Use event coordinates for this session”**;
- **Add session** / **Update session**;
- **Cancel session edit** / **Cancel edit**;
- session rows with date, time range and capacity/Open;
- row actions **Edit** and **Remove**;
- no-sessions state;
- invalid time/capacity validation;
- remove-session confirmation sheet with Cancel/Remove.

## F07 — Draft coordinator manager

Create the Coordinators step/card:

- title **“Coordinators”**;
- copy **“Assignment does not change an organization role.”**;
- searchable/select control **“Select an active member”** with member name and Admin/Member role;
- **Assign coordinator**;
- existing coordinator rows with name/email, organization role and **Remove**;
- no-coordinators state;
- loading/error/success states;
- remove-coordinator confirmation.

## F08 — Publish readiness and incident-claim conflict

Create the final publish panel:

- eyebrow **“04 · Publish event”**;
- title **“Final readiness”**;
- copy that the server checks saved requirements again inside one transaction;
- readiness rows using check or warning icon and the exact server message;
- **Refresh checks**;
- primary **Publish cleanup event**, disabled until ready;
- publishing state;
- publish confirmation explaining public visibility and that a linked incident will be claimed, with **Keep private** and **Publish**;
- success variants for a linked incident and direct event;
- conflict notice for **INCIDENT_ALREADY_CLAIMED**;
- conflict action **View already published event** and a compact public winning-event card.

## F09 — Organization cleanup events

Create the owned-event lifecycle list/detail:

- eyebrow **“Organization events”**;
- title **“Cleanup-event lifecycle”**;
- subtitle **“Private drafts and published records for this organization.”**;
- list cards with title, lifecycle status, Incident-linked/Direct event;
- selected state;
- **Load more**;
- empty **“No cleanup events yet.”**;
- selected summary with status, title, description and address/coordinates;
- draft records open the draft editor; published records expose tabs **Overview**, **Volunteers**, **Operations**, **History**.

## F10 — Volunteer allocation and attendance

Create the complete protected participant-operations page:

- eyebrow **“Volunteer operations”**;
- title **“Allocation and attendance”**;
- privacy note that contact details are available only in this protected workspace;
- volunteer cards with name, private phone, available-session count;
- current allocation rows with session date/time and PLANNED/ATTENDED/ABSENT/REMOVED;
- **Move to another available session** options;
- **Mark attended**;
- **Mark absent**;
- **Remove allocation**;
- for each unallocated available session: **Allocate [date] [time]**, disabled when capacity is full;
- multiline removal reason, placeholder **“Removal reason (minimum 10 characters)”**;
- destructive **Remove volunteer from event**;
- no-volunteers state;
- loading/error states.

Create confirmation sheets for Remove allocation and Remove volunteer. Explain that allocation removal keeps the volunteer joined, while participant removal affects only this event.

## F11 — Live event operations: notes and evidence

Create an operations page with a hero:

- eyebrow **“Live operations”**;
- current workflow label;
- copy **“Protected notes, evidence, session progress, and lifecycle history.”**;
- **Refresh operations** / **Refresh**;
- success/error notices.

Post an update card:

- visibility choices **Participants** and **Internal only** / select **Participants**, **Internal team only**;
- required multiline Note;
- **Add event note** / **Add note**.

Photo evidence card:

- Evidence type: Before, Progress, After;
- Session: Whole event or a specific session;
- optional **Caption (optional)**;
- choose photo/file area with JPEG/PNG/WebP reference and mobile compression;
- **Choose and upload photo** / **Upload evidence**;
- upload progress, thumbnail and error state.

Operational notes list must label INTERNAL versus PARTICIPANTS, show note, author and time. Evidence gallery shows image, type, optional caption, session and uploader where allowed.

## F12 — Session progress and event lifecycle

Create the lifecycle portion of operations:

- Sessions list with date/time and status;
- scheduled session actions **Start**, **Cancel**;
- in-progress session actions **Complete**, **Cancel**;
- **Event lifecycle** section with one button per permitted server transition: **Move to [workflow label]**;
- **Completion readiness** checklist;
- primary **Complete cleanup event**, disabled until ready;
- required multiline **Cancellation reason**;
- destructive **Cancel cleanup event**, disabled until reason has at least 10 characters;
- Operational notes, Evidence, and **Status timeline** showing Created/from status → to status, actor, time, optional notes;
- terminal COMPLETED/CANCELLED variant hides mutation forms.

Create consequence sheets:

- **Complete event?** — explains linked-incident resolution and eligible rewards; actions **Keep open**, **Complete**.
- **Cancel event?** — explains participant notification and incident-claim release; actions **Keep event**, **Cancel event**.
- **Cancel session?** — actions **Keep session**, **Cancel session**.

## F13 — Membership administration: pending requests

Create the ORG_ADMIN request-review page:

- title **“Membership administration”**, organization subtitle, back to Workspace;
- success notice with **Dismiss**;
- **Pending requests** section and **Refresh requests** / **Refresh**;
- request cards with requester name, verified email, private phone, submitted time and request message;
- **Approve as member** / **Approve**;
- **Decline**;
- conditional required multiline **Decline reason**;
- **Confirm decline** and **Cancel**;
- **Load more requests**;
- no-pending-requests, loading and error states;
- approve/decline confirmation sheets.

## F14 — Membership administration: member directory

Create the full member-management controls from both frontends:

- **Add an existing user** with required **Verified email** / **Existing EcoTrack user’s verified email** and **Add as member**;
- member filter bar:
  - Search, placeholder **“Name or email”**;
  - Role select: All roles, Organization Member, Organization Admin;
  - Status select: All statuses, Active, Suspended, Removed, Left;
  - **Apply filters**;
- **Organization members** list and **Refresh members**;
- member card: name, email, private phone, joined date, role chip and status chip;
- role action **Promote to admin** / **Demote to member**;
- status actions **Suspend**, **Remove**, or **Reactivate**;
- invariant notice that the final active Organization Admin cannot be demoted, suspended, or removed;
- **Load more members**;
- empty **“No organization members match these filters.”**;
- role/status confirmation sheets with clear consequence and Cancel/Confirm.

## F15 — Cleanup workflow viewer

Create the organization-settings workflow page:

- eyebrow **“Organization settings”**;
- title **“Cleanup workflow”**;
- subtitle **“Protected event stages and permitted next steps.”**;
- back to Workspace;
- ordered status cards with organization label, mapped lifecycle label, Initial status/Final status/Organization workflow status, active/inactive treatment;
- visual transition connectors between permitted next states;
- **Try again** on error and loading state.

This is read-only in the current mobile frontend; do not invent workflow editing controls.

---

# Batch G — Super Admin platform console

## G01 — Super Admin overview

Create the protected platform-console home screen, visually distinct from personal and organization workspaces:

- dark forest app bar with EcoTrack mark, **“Platform console”**, Super Admin identity, notification bell and sign out;
- contextual tabs/navigation:
  - **Overview** selected;
  - **Organization reviews** with pending count;
  - **Service areas** with disabled **Next** badge, matching the current web control;
  - **Notifications**;
- refreshable **Platform summary** metrics:
  - Active users with active/total;
  - Organizations with total and pending count;
  - Incidents;
  - Cleanup events;
- welcome title **“Good to see you, EcoTrack Super Admin”**;
- account avatar, name and Super Admin label;
- platform status cards:
  - Organization intake — Live;
  - Authorization — CASL active;
  - Service areas — PostGIS ready;
- each status card has a semantic icon, Available indicator and explanatory copy;
- protected-console security note;
- no controls for incident assignment, event creation, volunteer allocation, attendance, cancellation, or completion.

## G02 — Super Admin protected access and account

Create the security/account section that exists in both frontends:

- eyebrow **“Security check”** / **“Backend authorization”**;
- title **“Protected API access”**;
- copy explaining Supabase session and backend platform-role/CASL authorization;
- button **“Verify protected access”**, loading **“Verifying access…”**;
- success/error result panel;
- **Signed-in account / Account details** card with Email, Platform role Super Admin, Account status ACTIVE;
- **Sign out**.

## G03 — Organization review queue

Create the Super Admin review list:

- eyebrow **“Review workspace”**;
- title **“Organization applications”** / mobile **“Pending organizations”**;
- pending count;
- **Refresh**;
- application rows with organization name, requester name/email, number of GN Divisions, submitted date, and **Open**;
- selected state;
- loading state **“Loading pending applications…”**;
- empty success state **“No pending applications”** / **“There are no pending organization applications.”**;
- error notice.

## G04 — Organization application review detail

Create the full selected-application review screen:

- label **“Application details”**, Pending review chip, submitted date and organization name;
- organization description;
- details: Requester, Registration, Official email, Official phone, Address;
- **Proposed/Requested GN service areas** with each name, official code, Divisional Secretariat and district;
- multiline **Review notes**, web placeholder **“Required when declining; optional when approving.”** and mobile variant **“Optional for approval; required for decline”**;
- primary **Approve organization**;
- destructive **Decline application** / **Decline**;
- mobile secondary **Close details**;
- decision loading state **“Saving decision…”**;
- success copy that approval activates the organization/service areas and creates the requester’s first ORG_ADMIN membership, or that decline records the reason and notification;
- decline validation of at least 3 characters;
- approve and decline confirmation sheets with **Cancel** and the exact decision label.

Do not show membership-request review here; that belongs to the owning organization admin.

## G05 — Super Admin public map oversight

Create the read-only public map screen:

- eyebrow **“Public map oversight”**;
- title **“Incidents and cleanup events”**;
- explanatory copy **“Read-only, public-safe operational awareness. Assignment and organization actions are intentionally unavailable.”**;
- OpenStreetMap with public incident/event markers, clusters, selection, zoom, compass and attribution;
- status line `42 incidents · 8 cleanup events` / loading **“Loading map…”**;
- **Load more public markers** with loading state;
- error notice;
- selected public-safe detail sheet;
- absolutely no assign, claim, organization-pick, create-event, attendance or operational actions.

## G06 — Super Admin notifications

Reuse the Notification inbox component and its Unread only, unread count, Mark all as read, item-open, Load more, refresh/retry and empty states, but label the context **“Platform notifications.”** Use an expected empty example because current producers may not yet send normal Super Admin updates. Do not show ordinary organization incident, membership, volunteer, allocation or event-operation notifications to Super Admin.

---

# Reusable overlays and state frames

Generate these shared mobile UI states once and apply them consistently:

1. Notification/toast: success, info, warning, error; optional Dismiss/close.
2. Full-card skeletons for dashboard metrics, list rows, map results, and detail panels.
3. Weak-network banner with **Retry** while preserving entered form data.
4. Permission-denied notice that does not sign out the user.
5. Empty list with contextual primary action.
6. Cursor pagination row: **Load more**, **Loading…**, end-of-list treatment.
7. Confirmation bottom sheets for publish, discard, withdraw, remove, cancel, complete, approve, decline, role change and status change.
8. Disabled readiness action with visible checklist of missing requirements.
9. Photo compression/upload progress with completed/total count and filename.
10. Pull-to-refresh affordance plus explicit Refresh controls where the implemented screen already has them.

---

# Clickable prototype connections

Connect at least these paths:

1. Sign in → Check your email → Secure session → Complete profile → Personal dashboard.
2. Dashboard → Report → category/details → location confirmation → evidence/review → submitted report detail → My reports.
3. Dashboard/Map → activity marker → event detail → Join cleanup → choose sessions → joined event detail.
4. Dashboard → My joined events → participant updates / update availability / withdraw.
5. Dashboard → My Impact and Notifications.
6. Dashboard → Profile and membership → organization search → request membership → request history.
7. Dashboard → Organization requests → New application → GN search/select → submit → My applications.
8. Dashboard → Organization workspaces → open Bolgoda Lake Conservation Society → overview.
9. Organization overview → Incidents → selected incident → save review → create linked draft.
10. Organization overview → Plan cleanup event → details/location → sessions → coordinators → readiness → publish.
11. Organization Events → selected published event → Volunteers → allocate/reallocate → attendance/remove.
12. Organization Events → Operations → note/evidence → session progress → complete/cancel → timeline.
13. Organization overview → Members → request approval/decline → member search/filter → promote/suspend/remove/reactivate.
14. Super Admin Overview → Organization reviews → application detail → approve/decline.
15. Super Admin Overview → Map → selected public-safe marker.

---

# Existing-frontend coverage ledger

Use this ledger as a non-omission check. Each implementation surface must map to the listed Stitch frame(s).

| Existing frontend surface | Stitch frames |
|---|---|
| Authentication loading, login, magic-link sent, error | A01–A04 |
| First-profile onboarding and editable profile | A05, B03 |
| Route lazy-loading/render error and unavailable organization | A06–A07 |
| CitizenDashboard + CitizenSidebar + mobile dashboard | B01, B06 |
| OrganizationMembershipWorkspacesPage | B02 |
| MembershipSelfService web/mobile | B03 |
| NotificationInbox and notification button web/mobile | B04, G06 |
| MyImpact web/mobile | B05 |
| IncidentPage create/reports/detail and mobile IncidentReport/MyReports | C01–C06 |
| CitizenIncidentDiscovery web/mobile | C07–C08 |
| EcoMap and LocationPicker web/mobile | C02, C07, F02, F05, G05 |
| PublicCleanupEvents and EventParticipation web/mobile | D01–D03 |
| MyJoinedCleanupEvents + ParticipantEventUpdates | D04–D05 |
| OrganizationApplication web/mobile | E01–E03 |
| OrganizationWorkspace web/mobile | F01 |
| OrganizationIncidentDiscovery web/mobile | F02–F03 |
| CleanupEventDraftEditor/Screen and PublishPanel | F04–F08 |
| OrganizationCleanupEventList | F09 |
| EventParticipantOperations web/mobile | F10 |
| EventOperations web/mobile | F11–F12 |
| MembershipAdministration web/mobile | F13–F14 |
| CleanupWorkflow mobile | F15 |
| SuperAdminDashboard web/mobile and SuperAdminMapOverview | G01–G05 |

## Web-only controls intentionally carried into mobile

The mobile design must include these even where the current React Native screen is simpler:

- passwordless **Check your email** state and **Use another email**;
- dismissible notices;
- personal **Organization workspaces** chooser with refresh/load more;
- member directory Search, Role, Status, **Apply filters**;
- **Load more drafts**;
- coordinator searchable select and **Assign coordinator**;
- publish-conflict **View already published event**;
- public/owned/joined list pagination;
- event evidence file type/session/caption controls;
- map **Next area / Focus area**, list fallback and wide-viewport warning;
- Super Admin platform-status cards and read-only public map;
- route-level **Reload EcoTrack** error state.

## Mobile-only controls intentionally preserved

- foreground-location request only after pressing **My location** / **Find activity near me**;
- selected coordinates and location confirmation wording;
- compressed-photo progress and **Replace photos**;
- Android back labels and bottom confirmation sheets;
- notification Unread only switch;
- event update **Refresh updates**;
- private-phone explanation;
- **Cancel session edit**, **All drafts**, and context-specific back labels.

---

# Final consistency prompt — paste after all frames exist

> Audit every EcoTrack frame against the imported DESIGN.md and the complete screen contract. Do not redesign the product. Fix only omissions and inconsistencies.
>
> First, verify that every named frame A01–G06 exists and that every listed control label is represented. Verify all loading, empty, validation, network-error, permission-error, success, disabled, pagination, upload-progress, and confirmation states. Add any missing state as a component variant or adjacent frame.
>
> Second, normalize the visual system: 390 x 844 Android canvas, safe areas, minimum 48 dp targets, Manrope/Plus Jakarta Sans typography, EcoTrack sprout-E mark, forest/lake/leaf palette, 18–22 dp card radius, strong accessible contrast, consistent form labels, and the Living Atlas contour/water motif. Remove generic emoji icons and replace them with a consistent outlined icon family.
>
> Third, verify navigation and permission boundaries. Personal, Organization, and Super Admin contexts must be unmistakable. Hide ORG_ADMIN-only controls from ORG_MEMBER. Show coordinator operations only for assigned events. Never show a password, citizen organization selector when reporting, volunteer application queue, payment/job controls, public participant phones, private notes in public views, or Super Admin incident/event/volunteer operational actions.
>
> Fourth, verify maps use Sri Lankan content, OpenStreetMap attribution, coral incident markers, lake-teal cleanup-event markers, forest service-area polygons, clusters, My location, selected coordinates, location confirmation, reference-location focus when relevant, Next/Focus area, wide-viewport warning, and accessible list/detail alternatives.
>
> Finally, connect and play through the 15 prototype journeys in this document. Keep all entered form values after simulated network errors and keep important primary actions above the Android safe-area inset.
