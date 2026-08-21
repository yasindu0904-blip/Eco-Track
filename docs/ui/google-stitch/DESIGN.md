# EcoTrack mobile design system

## Product

EcoTrack is a Sri Lankan, multi-tenant community platform for environmental incident reporting and voluntary cleanup coordination. Design an Android-first mobile experience for React Native/Expo at a 390 x 844 dp reference size, while remaining adaptable to smaller Android phones.

The same person always has Citizen and Volunteer capabilities. An account may additionally have an organization-scoped `ORG_MEMBER` or `ORG_ADMIN` membership in one or more organizations. `SUPER_ADMIN` is a separate platform role. Personal, organization, and platform contexts must never look interchangeable.

The interface must communicate these product truths:

- Authentication is passwordless by Supabase magic link. Never show a password field.
- Citizens report one shared incident and never choose an organization.
- Incident visibility is based on approved Sri Lankan GN Division service areas.
- Organization reviews are independent. A FALSE count is informational, not a vote or global rejection.
- Cleanup Events are voluntary and belong to one organization.
- Volunteers join directly and select session availability; there is no application or approval queue.
- Availability is different from the organization’s later session allocation.
- Rewards are non-monetary and never grant permissions.
- Super Admin reviews organizations and sees public-safe oversight; Super Admin never assigns incidents, volunteers, or normal cleanup work.

## Creative direction: “Living Atlas”

Create a calm, credible field-tool aesthetic inspired by Sri Lankan wetlands, contour maps, leaves, water ripples, recycled field notebooks, and coordinated community action. The product should feel trustworthy enough for evidence and operational records, but warm enough for volunteers.

Avoid a generic Material dashboard. Use a distinctive visual rhythm:

- softly tinted warm canvas rather than pure gray;
- dark evergreen anchors;
- lake-teal map accents;
- fresh leaf-lime highlights used sparingly;
- subtle contour-line or water-ripple artwork in hero areas at 3–6% opacity;
- strong editorial typography and generous negative space;
- cards that feel layered like field notes, with occasional clipped-corner or offset accent details;
- authentic Sri Lankan place names and environmental imagery, never US locations.

## Brand mark

Use the existing EcoTrack identity: a compact rounded evergreen square containing a white “E” with two small lime leaves emerging above it. The full lockup is “EcoTrack” with the line “Community-driven environmental action.” Do not replace it with a generic globe or recycling logo.

## Color tokens

Use these colors consistently and preserve accessible contrast:

- `forest-950 #102A20` — deepest hero and platform surfaces
- `forest-800 #174C33` — primary dark
- `forest-700 #195F38` — main brand/action color
- `forest-600 #247447` — success and active states where contrast permits
- `leaf-400 #B5DF7B` — accent, progress, selected map halo
- `lake-500 #2F8F91` — cleanup-event/map accent
- `sky-300 #93D5D8` — quiet water highlights
- `soil-500 #A96F45` — warm secondary accent
- `amber-500 #C88416` — warnings and medium/high attention
- `coral-600 #C64B40` — destructive actions and incident danger
- `canvas #F4F7F2` — app background
- `surface #FFFFFF` — primary card/input surface
- `surface-muted #F8FAF7` — secondary panels
- `ink #17251D` — main text
- `ink-muted #68766E` — secondary text
- `line #DCE4DC` — borders and separators
- `line-strong #B8C9BB` — form outlines

Severity colors must be reinforced with words/icons, never color alone:

- Low: lake teal
- Medium: amber
- High: burnt orange
- Critical: coral red

Status colors:

- success/active/approved/completed: forest green
- pending/scheduled/viewed: amber
- informational/published/organized: lake teal
- declined/false/cancelled/removed/error: coral
- archived/inactive/withdrawn: neutral gray-green

## Typography

Use `Manrope` or `Plus Jakarta Sans` for Latin text, with `Noto Sans Sinhala` and `Noto Sans Tamil` as future-safe fallbacks.

- Display: 32–36, extra bold, tight tracking
- Page title: 28–30, extra bold
- Section title: 18–20, bold
- Card title: 15–17, bold
- Body: 14–16, regular/medium, 1.45–1.55 line height
- Metadata: 11–13, medium
- Eyebrow labels: 10–11, extra bold, uppercase, 0.9–1.2 tracking
- Large metric: 28–48, extra bold with tabular numbers

Do not use tiny gray text for essential actions or status explanations.

## Spacing and shape

- 4 dp base grid; common gaps 8, 12, 16, 20, 24, 32
- Screen horizontal padding 18–20 dp
- Touch targets at least 48 x 48 dp
- Input height 52–56 dp
- Primary button height 52–56 dp
- Card radius 18–22 dp
- Input/button radius 12–14 dp
- Pill radius 999 dp only for compact chips/statuses
- Borders 1 dp; selected borders 2 dp
- Shadows very soft and low; use borders and surface contrast more than elevation

## Mobile navigation

Personal workspace uses a five-item bottom navigation:

1. Home
2. Map
3. Events
4. Activity
5. Account

Add a prominent floating or raised “Report” action that opens incident reporting without hiding the Map or Events tabs. The notification bell remains in the top app bar with an unread count.

Organization workspace uses a clearly different contextual app bar with organization monogram, organization name, membership role, and a workspace switcher. Use bottom or scrollable contextual tabs:

- Overview
- Incidents
- Events
- Members (ORG_ADMIN only)

An `ORG_MEMBER` must see member-safe tools and event operations only when they are a coordinator. Never imply global admin rights.

Super Admin uses a dark forest platform header labeled “Platform console,” with tabs for Overview, Reviews, Map, and Notifications. It must not reuse organization-admin action language.

Back navigation must always state the parent destination: Dashboard, Events, My reports, Workspace, or Drafts. Preserve Android system back behavior.

## Core components

### App bars

- Compact brand mark, context title, optional context subtitle, notification bell, and avatar/workspace switcher.
- Use sticky headers only when they materially help long operational screens.
- Page headers use an eyebrow, clear title, one-sentence subtitle, back action, and at most one compact primary action.

### Buttons

- Primary: filled forest green, white label.
- Secondary: white surface, strong green outline/label.
- Ghost: text-only or quiet tinted surface.
- Destructive: pale coral surface, coral border/label; reserve filled red for final confirmation.
- Loading buttons retain width and replace the leading icon with a spinner.
- Disabled states remain legible and explain the unmet condition nearby.
- Preserve every button label given in the screen prompts.

### Form controls

- Persistent labels above controls; required mark and optional helper text.
- Inputs have strong focus rings, inline validation, character/selection counts where relevant, and never rely on placeholder text as the only label.
- Text areas visually indicate multiline capacity.
- Use native date/time pickers for sessions, a numeric capacity field, searchable selects, radio cards for severity/category, checkboxes for session availability, switches only for true on/off settings, and filter chips for compact list filters.
- Read-only verified email fields have a lock icon and tinted background.

### Cards and lists

- Use content-first cards, not a wall of identical rectangles.
- List rows show title, useful metadata, status chip, and directional affordance.
- Organization/workspace cards include organization initial, role, ACTIVE badge, and slug.
- Selected list/map items use a forest border plus pale green background.
- Paginated screens retain “Load more” actions and visible loading states.

### Notices, empty states, and errors

All data screens need skeleton/loading, empty, success, error, offline/weak-network, disabled, and retry states. Notices use an icon, title when useful, concise message, and optional action. Dismissible notices need a close control. A 403 must look like unavailable permission, not signed-out authentication.

### Confirmation sheets

Use bottom sheets on mobile for destructive or consequential actions:

- withdraw from event;
- discard draft;
- publish event;
- cancel event/session;
- complete event;
- approve/decline application or membership;
- change role/status;
- remove participant/allocation/coordinator.

Each sheet states the consequence and has explicit Cancel plus action labels.

### Metrics and timelines

- Metrics use an asymmetric 2 x 2 grid with small labels and bold numbers.
- Personal impact may use a large circular or topographic “impact ring,” but keep exact totals readable.
- Status history is a vertical timeline with dated nodes, actor where allowed, from/to state, and optional reason.

## Map system

Use an OpenStreetMap visual style centered on Sri Lanka. Sample areas should include Bolgoda Lake, Kesbewa, Polgasowita, Piliyandala, Mampe, Colombo, or nearby GN Divisions.

Map semantics:

- incident marker: coral/orange pin with alert symbol;
- cleanup-event marker: lake-teal pin with community/leaf symbol;
- selected marker: white outer ring plus lime halo;
- clusters: dark forest circle with white count;
- organization service areas: translucent forest polygons with a strong selected outline;
- manually selected location: black center pin with a lime target halo;
- current location: blue dot with an accuracy ring.

Every map preserves:

- native zoom controls/gestures and compass;
- “My location” button when current location is allowed;
- “Next area” / “Focus area” service-area cycling when boundaries exist;
- marker selection and a mobile bottom detail sheet;
- selected coordinates display;
- “Focus reference location” when a linked incident is shown while choosing an event location;
- “Confirm this location” or context-specific confirmation button;
- a hint to move/tap the map;
- “Zoom in to load locations” warning for a viewport that is too wide;
- OpenStreetMap attribution;
- an accessible “Locations in this view” list fallback where requested;
- clear permission-denied, unavailable-location, outside-Sri-Lanka, and tile-loading messages;
- no continuous location tracking.

## Image and evidence treatment

Use authentic environmental subject matter: Bolgoda Lake waterways, canals, wetland edges, illegal dumping, plastic pollution, neighborhood drains, and community cleanups. Avoid staged corporate stock photography.

Photo upload controls must show:

- accepted evidence purpose;
- up to 5 incident photos;
- compression/upload progress;
- thumbnail grid with filename and size;
- replace/remove actions;
- photo type for event evidence: Before, Progress, After;
- optional caption and optional session association.

## Content and locale

Use concise, respectful English copy matching the implemented frontend. Keep backend enum words human-readable in the UI. Use Sri Lankan examples:

- user: Nadeesha Perera
- organization: Bolgoda Lake Conservation Society
- second organization: Green Kesbewa Collective
- incident: Plastic waste blocking the Bolgoda canal
- cleanup event: Bolgoda Wetland Cleanup Morning
- phone: +94 77 123 4567
- email: nadeesha@example.com
- service areas: Polgasowita, Kesbewa North, Mampe East

Use Asia/Colombo dates and times. Do not use US parks, US addresses, dollar amounts, jobs, wages, donations, or employment language.

## Accessibility and reliability

- Meet WCAG AA contrast, including status chips.
- Do not encode meaning by color alone.
- Support text enlargement without clipped labels.
- Keep focus order logical and add screen-reader labels to icon-only controls.
- Minimum 48 dp touch targets and visible pressed/focus states.
- Keep primary action reachable above the safe-area inset.
- Long forms preserve entered values after network failure.
- Show upload and mutation progress; prevent accidental double submits.
- Design for weak networks with cached content indicators, retry actions, skeletons, and small thumbnails.

## Prohibited UI and product drift

Do not add:

- password fields;
- separate Citizen and Volunteer account registration;
- a volunteer application/approval queue;
- payment, salary, donation, wallet, or job controls;
- a citizen organization selector during incident reporting;
- Super Admin incident assignment, volunteer allocation, attendance, event creation, or event lifecycle controls;
- public participant phone numbers or private organization notes;
- global “incident rejected by majority” language;
- continuous location tracking;
- unbounded national map loading;
- neon eco clichés, excessive gradients, glassmorphism, cartoon leaves everywhere, or emoji used as final icons.

