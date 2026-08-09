# EcoTrack SRS UI Mockup Project

A static high-fidelity UI mockup project for the EcoTrack Software Requirements Specification. This project contains eight interactive screens designed to demonstrate the complete user interface for the EcoTrack environmental action platform.

## Project Overview

This mockup project includes:
- **5 Mobile Screens** (390×844px) for citizen/volunteer interfaces
- **3 Desktop Screens** (1440×1000px) for organization/admin interfaces
- Shared design system with EcoTrack branding
- Static fictional data (no backend)
- SVG-based maps with OpenStreetMap attribution
- Accessible, professional typography and color scheme

## Screens Included

### Mobile Screens (390×844px)
1. **01-magic-link-login** - Passwordless authentication with email confirmation
2. **02-citizen-volunteer-map** - Real-time incident and event map view
3. **03-incident-reporting** - Report environmental incidents with photo upload
4. **04-cleanup-event-details** - Event details and volunteer join flow
5. **05-multiday-availability** - Multi-day volunteer availability selection

### Desktop Screens (1440×1000px)
6. **06-organization-dashboard** - Organization volunteer management dashboard
7. **07-incident-event-scheduling** - Incident review and event creation interface
8. **08-super-admin-verification** - Organization verification and approval workflow

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS (plain CSS with CSS variables)
- **Icons**: lucide-react
- **Routing**: React Router v6
- **Testing**: Playwright for screenshots
- **Font**: Inter (from Google Fonts)

## Setup Instructions

### Prerequisites
- Node.js 16+ and npm/yarn
- Git (optional)

### Installation

1. **Navigate to project directory**
   ```bash
   cd ecotrack-srs-mockup
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will start at `http://127.0.0.1:5173`

4. **Open in browser**
   - Navigate to `http://localhost:5173`
   - You'll see a home page with links to all 8 screens
   - Click any screen link to view the mockup

## Generating Screenshots

### Automatic Screenshot Generation with Playwright

1. **Ensure dev server is running**
   ```bash
   npm run dev
   ```
   (Keep this running in a separate terminal)

2. **Run screenshot script**
   ```bash
   npm run test:screenshot
   ```

3. **Output files**
   All PNG screenshots will be saved to: `output/screenshots/`
   - `01-magic-link-login.png`
   - `02-citizen-volunteer-map.png`
   - `03-incident-reporting.png`
   - `04-cleanup-event-details.png`
   - `05-multiday-availability.png`
   - `06-organization-dashboard.png`
   - `07-incident-event-scheduling.png`
   - `08-super-admin-verification.png`

### Manual Screenshot Approach (Alternative)

If you prefer to take screenshots manually:

1. Start the dev server: `npm run dev`
2. For each screen:
   - Mobile screens: Set browser viewport to 390×844
   - Desktop screens: Set browser viewport to 1440×1000
   - Use browser dev tools or screenshot tool to capture

## Project Structure

```
ecotrack-srs-mockup/
├── src/
│   ├── components/
│   │   └── Header.tsx           # Reusable header component
│   ├── pages/
│   │   ├── MagicLinkLogin.tsx   # Screen 1
│   │   ├── CitizenVolunteerMap.tsx
│   │   ├── IncidentReporting.tsx
│   │   ├── CleanupEventDetails.tsx
│   │   ├── MultiDayAvailability.tsx
│   │   ├── OrganizationDashboard.tsx
│   │   ├── IncidentEventScheduling.tsx
│   │   └── SuperAdminVerification.tsx
│   ├── styles/
│   │   ├── globals.css          # Global styles & CSS variables
│   │   ├── components.css       # Reusable component styles
│   │   ├── header.css
│   │   └── pages.css            # Page-specific styles
│   ├── App.tsx                  # Main app with routing
│   └── main.tsx                 # Entry point
├── index.html                   # HTML template
├── package.json
├── vite.config.ts
├── tsconfig.json
├── playwright.config.ts
├── screenshot.spec.ts           # Playwright test script
└── README.md                    # This file
```

## Design System

### Colors
- **Primary**: `#1b5e20` (Dark Environmental Green)
- **Secondary**: `#1976d2` (Blue)
- **Background**: `#f5f5f5` (Light Neutral Grey)
- **Surface**: `#ffffff` (White)
- **Border**: `#e0e0e0`
- **Text Primary**: `#212121`
- **Text Secondary**: `#666666`

### Typography
- **Font Family**: Inter (from Google Fonts)
- **Sizes**: xs (12px) → 3xl (32px)
- **Weight**: 400, 500, 600, 700

### Components
- **Buttons**: Primary, Secondary, Outline, Ghost variants
- **Cards**: White backgrounds with subtle borders and shadows
- **Badges**: Status indicators (success, warning, error, info, primary)
- **Forms**: Accessible inputs with clear labels and focus states
- **Tables**: Professional data presentation with hover states

## Key Features

✅ **Responsive Layout**
- Mobile and desktop designs properly separated
- Correct viewport dimensions for each screen type

✅ **Accessibility**
- High contrast ratios (WCAG AA compliant)
- Semantic HTML structure
- Proper form labels and ARIA attributes
- Status indicated by text AND icons (not color alone)

✅ **EcoTrack Branding**
- Consistent green primary color throughout
- Professional, community-focused design
- Clean typography and spacing
- Minimal decorative elements

✅ **Static Data**
- No backend dependencies
- Fictional, realistic sample data
- Easy to understand mockup content

✅ **SVG Maps**
- Simplified custom SVG maps (not real tiles)
- OpenStreetMap attribution included
- Zooming controls for demonstration

## Verification Checklist

Before finalizing, verify:

- [ ] All 8 screens load without errors
- [ ] Mobile screens (1-5) display at 390×844px
- [ ] Desktop screens (6-8) display at 1440×1000px
- [ ] No text overflow or overlapping elements
- [ ] All buttons are clickable and functional
- [ ] Forms accept input correctly
- [ ] Toggle switches and selections work
- [ ] Maps render properly with attribution
- [ ] OpenStreetMap credits visible on map screens
- [ ] Colors are accessible and consistent
- [ ] Typography is clear and readable
- [ ] Status indicators use text + icons

## Screenshot Verification

After running `npm run test:screenshot`, verify:

1. ✅ 8 PNG files created in `output/screenshots/`
2. ✅ Each file is named correctly
3. ✅ Mobile screenshots are 390×844px
4. ✅ Desktop screenshots are 1440×1000px
5. ✅ All content is visible and not cut off
6. ✅ Quality is suitable for SRS documentation

## Troubleshooting

### Issue: Vite dev server won't start
**Solution**: Ensure port 5173 is free or configure a different port in `vite.config.ts`

### Issue: Playwright screenshots are blank
**Solution**: 
- Ensure dev server is running before running screenshots
- Check that `http://127.0.0.1:5173` is accessible
- Verify `BASE_URL` in `screenshot.spec.ts` matches your server URL

### Issue: Missing dependencies
**Solution**: Run `npm install` again or delete `node_modules` and `package-lock.json`, then reinstall

### Issue: Map not displaying
**Solution**: Maps use inline SVG, should display automatically. Check browser console for errors.

### Issue: Fonts not loading
**Solution**: Inter font is loaded from Google Fonts CDN. Check internet connection and browser allows external fonts.

## Building for Production

To create a production build:

```bash
npm run build
```

Output will be in `dist/` directory.

To preview the production build:

```bash
npm run preview
```

## Development Notes

- **No Backend**: All data is static and defined in component state
- **No Database**: Screenshot script doesn't require any persistence
- **No APIs**: No external service dependencies
- **No Authentication**: Login screen is visual mockup only
- **SVG Maps**: Custom SVG drawings, not real map tiles

## Browser Support

- Chrome/Chromium (recommended for Playwright)
- Firefox
- Safari
- Edge

Modern browsers with ES2020+ support.

## License

This is an academic mockup project for the EcoTrack SRS documentation.

## Support

For questions about the mockup design or implementation:
1. Check this README
2. Review individual component files for inline comments
3. Examine the Playwright test script for automation details

---

**Last Updated**: August 2024
**Project Version**: 1.0.0
**Status**: Complete mockup set with screenshot automation
