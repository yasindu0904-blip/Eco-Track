# EcoTrack SRS Mockup - Verification Checklist

Use this checklist to verify the project is working correctly before generating screenshots.

## Pre-Setup Verification

- [ ] Node.js 16+ is installed (`node --version`)
- [ ] npm is installed (`npm --version`)
- [ ] Project directory is accessible
- [ ] Internet connection available (for Google Fonts)

## Installation Verification

```bash
npm install
```

- [ ] No errors during npm install
- [ ] `node_modules/` folder created
- [ ] All dependencies installed (check package.json)

## Development Server Startup

```bash
npm run dev
```

Expected output:
```
VITE v5.0.8  ready in 234 ms

➜  Local:   http://127.0.0.1:5173/
➜  press h to show help
```

- [ ] Server starts without errors
- [ ] Local URL shows as `http://127.0.0.1:5173/`
- [ ] Console shows "ready" status

## Browser Testing

Open `http://127.0.0.1:5173` in your browser.

### Home Page (Landing Page)

- [ ] Page loads without errors
- [ ] Shows "EcoTrack SRS Mockup" title
- [ ] Displays 8 screen cards with links
- [ ] Cards show correct viewport dimensions
- [ ] Mobile screens labeled as "📱 Mobile (390×844)"
- [ ] Desktop screens labeled as "🖥️ Desktop (1440×1000)"
- [ ] All links are clickable

### Screen 1: Magic Link Login

**Mobile View** (390×844px)
- [ ] Page loads at correct viewport size
- [ ] Logo (🌱) displays at top
- [ ] "EcoTrack" title visible
- [ ] Tagline text appears
- [ ] Email input field visible
- [ ] "Send Magic Link" button present
- [ ] All text is readable
- [ ] No content overflow
- [ ] Button is clickable
- [ ] Multiple states visible:
  - [ ] Email entry form
  - [ ] Confirmation state (with success icon)
  - [ ] Error state (with error icon)

### Screen 2: Citizen/Volunteer Map

**Mobile View** (390×844px)
- [ ] Map container visible
- [ ] SVG map displays (with green/blue colors)
- [ ] Map markers visible on SVG
- [ ] Zoom in/out buttons present (+/− buttons)
- [ ] OpenStreetMap attribution visible at bottom-left
- [ ] Attribution text readable
- [ ] Map list/panel shows below map
- [ ] List items clickable
- [ ] Selected marker highlights on map
- [ ] No content overflow

### Screen 3: Incident Reporting

**Mobile View** (390×844px)
- [ ] Header with title visible
- [ ] "What did you find?" section present
- [ ] 4 incident type options visible:
  - [ ] 🗑️ Litter
  - [ ] 💨 Pollution
  - [ ] 🦌 Wildlife Issue
  - [ ] ⚠️ Property Damage
- [ ] Type options are selectable (border changes)
- [ ] Title input field present
- [ ] Description textarea present
- [ ] Location field shows (non-editable preview)
- [ ] Photo upload area visible
- [ ] Submit button clickable
- [ ] Confirmation modal appears after submit
- [ ] Confirmation shows selected type, title, description
- [ ] "Submit Report" and "Edit Report" buttons present
- [ ] No content overflow

### Screen 4: Cleanup Event Details

**Mobile View** (390×844px)
- [ ] Header visible
- [ ] Event header image area shows emoji (🌊)
- [ ] Event title "Beach Cleanup Day" visible
- [ ] Status badge (✓ Open to Join) shows
- [ ] Event metadata displays:
  - [ ] 📅 Date and time
  - [ ] 🕐 Duration
  - [ ] 📍 Location
  - [ ] 👥 Volunteer count
- [ ] About section with description
- [ ] "What to Bring" list visible
- [ ] Participants section shows avatars
- [ ] Footer buttons present:
  - [ ] Heart icon button
  - [ ] Share icon button
  - [ ] "Join Event" button
- [ ] Join button changes state when clicked
- [ ] No content overflow

### Screen 5: Multi-Day Availability

**Mobile View** (390×844px)
- [ ] Header with title visible
- [ ] Instruction text at top
- [ ] Day cards visible for multiple days
- [ ] Each day shows:
  - [ ] Day name and date
  - [ ] Toggle switch (on/off)
  - [ ] Time slot options (when available is on)
- [ ] Time slots display:
  - [ ] Morning (9:00 AM)
  - [ ] Afternoon (1:00 PM)
  - [ ] Evening (5:00 PM)
  - [ ] Full Day
- [ ] Slots are selectable (highlight on click)
- [ ] Toggle switches work correctly
- [ ] Summary shows selected slot count
- [ ] "Save Availability" button present
- [ ] No content overflow

### Screen 6: Organization Dashboard

**Desktop View** (1440×1000px)
- [ ] Header with title visible
- [ ] Greeting section shows "Welcome back"
- [ ] New Event button visible in header
- [ ] 3 stat cards display:
  - [ ] Total Events (📊)
  - [ ] Active Volunteers (👥)
  - [ ] Impact Hours (🌍)
- [ ] Stat values readable
- [ ] "Upcoming Events" section visible
- [ ] Event cards show:
  - [ ] Event icon
  - [ ] Title
  - [ ] Date
  - [ ] Volunteer count
- [ ] "Recent Incidents" section shows:
  - [ ] Incident type and title
  - [ ] Time posted
  - [ ] Status badges (colored appropriately)
- [ ] Quick Actions section displays 4 buttons
- [ ] No content overflow
- [ ] Grid layout is clean and organized

### Screen 7: Incident Review & Event Scheduling

**Desktop View** (1440×1000px)
- [ ] Header with title visible
- [ ] Tab navigation visible:
  - [ ] Incidents tab
  - [ ] Events tab
  - [ ] Volunteers tab
- [ ] Tabs are clickable and switch content
- [ ] **Incidents view**:
  - [ ] Shows incident cards in grid
  - [ ] Each card has icon, title, location
  - [ ] Priority badges (High, Medium, Low)
  - [ ] Status badges
  - [ ] Review and Assign buttons
- [ ] **Events view**:
  - [ ] Shows event cards
  - [ ] Event info displays correctly
  - [ ] Volunteer count shows prominently
  - [ ] Status badges present
  - [ ] Edit and View Volunteers buttons
- [ ] **Volunteers view**:
  - [ ] Shows volunteer cards in grid
  - [ ] Avatar with initials visible
  - [ ] Volunteer name and skills shown
  - [ ] Active/Inactive status indicator
  - [ ] Event and hours stats visible
  - [ ] "Assign to Event" button present
- [ ] No content overflow
- [ ] Layout responsive within desktop viewport

### Screen 8: Super Admin Organization Verification

**Desktop View** (1440×1000px)
- [ ] Header with title visible
- [ ] Summary stat cards show:
  - [ ] Pending Review count (⏳)
  - [ ] Verified count (✅)
  - [ ] Rejected count (❌)
- [ ] Organization verification cards display in grid
- [ ] Each card shows:
  - [ ] Status icon (✓, ⚠️, or ❌)
  - [ ] Organization name
  - [ ] Region
  - [ ] Status badge (colored appropriately)
  - [ ] Contact name and email
- [ ] "Required Documents" section shows:
  - [ ] Document name
  - [ ] Status icon (✅, 📄, or ⚠️)
  - [ ] Status text (Verified, Review, Missing)
- [ ] Action buttons appropriate to status:
  - [ ] Pending: Approve and Reject buttons
  - [ ] Verified: View Dashboard and Revoke buttons
  - [ ] Rejected: Re-evaluate button
- [ ] "Verification Guidelines" section visible
- [ ] Guidelines list shows required docs
- [ ] No content overflow

## Responsive Design Verification

- [ ] Mobile screens (1-5):
  - [ ] Width exactly 390px
  - [ ] Height approximately 844px (may scroll)
  - [ ] Touch-friendly button sizes
  - [ ] Proper spacing on mobile
  
- [ ] Desktop screens (6-8):
  - [ ] Width exactly 1440px
  - [ ] Height approximately 1000px
  - [ ] Multi-column layouts work
  - [ ] Proper whitespace

## Accessibility Verification

- [ ] Tab navigation works (press Tab key)
- [ ] Focus states visible on interactive elements
- [ ] Form labels clearly associated with inputs
- [ ] Status indicated by TEXT + ICON (not color alone):
  - [ ] Check "Incident Review" for priority colors + text
  - [ ] Check badges for status + text
- [ ] Contrast ratios meet WCAG AA standards
- [ ] Text is readable (not too small)
- [ ] Color scheme is consistent

## Design System Verification

### Colors
- [ ] Primary Green (#1b5e20) used for:
  - [ ] Main buttons
  - [ ] Links
  - [ ] Important UI elements
  
- [ ] Secondary Blue (#1976d2) used for:
  - [ ] Some buttons
  - [ ] Status indicators
  - [ ] Links
  
- [ ] Light Grey (#f5f5f5) for:
  - [ ] Page backgrounds
  - [ ] Card backgrounds
  
- [ ] White (#ffffff) for:
  - [ ] Card surfaces
  - [ ] Form inputs
  
- [ ] Neutral greys for:
  - [ ] Text and borders

### Typography
- [ ] Inter font loading (from Google Fonts)
- [ ] Font sizes are consistent
- [ ] Headings (h1-h6) scale properly
- [ ] Body text is 16px base
- [ ] Line height appropriate for readability

### Components
- [ ] Buttons have consistent styling:
  - [ ] Primary (green, white text)
  - [ ] Secondary (blue, white text)
  - [ ] Outline (transparent, green border)
  - [ ] Ghost (white, border)
  
- [ ] Cards have:
  - [ ] White background
  - [ ] Subtle border
  - [ ] Shadow on hover
  
- [ ] Forms have:
  - [ ] Clear labels
  - [ ] Focus states (border highlight)
  - [ ] Proper input padding

## Screenshot Generation Verification

### Setup for Screenshots
```bash
npm install
npm run dev
# (Keep this terminal open)

# In another terminal:
npm run test:screenshot
```

### Verify Screenshot Output

Check `output/screenshots/` directory:

- [ ] Directory exists
- [ ] 8 PNG files created:
  - [ ] `01-magic-link-login.png`
  - [ ] `02-citizen-volunteer-map.png`
  - [ ] `03-incident-reporting.png`
  - [ ] `04-cleanup-event-details.png`
  - [ ] `05-multiday-availability.png`
  - [ ] `06-organization-dashboard.png`
  - [ ] `07-incident-event-scheduling.png`
  - [ ] `08-super-admin-verification.png`

### Screenshot Quality Verification

For each screenshot:
- [ ] File is readable (not corrupted)
- [ ] Image dimensions are correct:
  - [ ] Mobile: 390×844px
  - [ ] Desktop: 1440×1000px (or more if scrolled)
- [ ] All content visible and not cut off
- [ ] Text is sharp and readable
- [ ] Colors render correctly
- [ ] Suitable for academic SRS documentation

## Final Checks

- [ ] No console errors in browser DevTools
- [ ] No warnings about missing dependencies
- [ ] All interactive elements respond to clicks
- [ ] No layout breaking on tested screen sizes
- [ ] Project structure matches documentation
- [ ] README.md is clear and helpful
- [ ] All required files present in `src/` directory

## Sign-Off

- **Date Verified**: _______________
- **Verified By**: _______________
- **Status**: ☐ PASS / ☐ FAIL

**Notes**: 
_______________________________________________________________________________
_______________________________________________________________________________

---

If all checks pass, the project is ready for SRS documentation and screenshot delivery.
