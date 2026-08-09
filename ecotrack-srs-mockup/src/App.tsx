import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { MagicLinkLogin } from './pages/MagicLinkLogin'
import { CitizenVolunteerMap } from './pages/CitizenVolunteerMap'
import { IncidentReporting } from './pages/IncidentReporting'
import { CleanupEventDetails } from './pages/CleanupEventDetails'
import { MultiDayAvailability } from './pages/MultiDayAvailability'
import { OrganizationDashboard } from './pages/OrganizationDashboard'
import { IncidentEventScheduling } from './pages/IncidentEventScheduling'
import { SuperAdminVerification } from './pages/SuperAdminVerification'
import './styles/components.css'

function Home() {
  const screens = [
    { path: '/01-magic-link-login', label: '1. Passwordless Magic-Link Login', mobile: true },
    { path: '/02-citizen-volunteer-map', label: '2. Citizen / Volunteer Map', mobile: true },
    { path: '/03-incident-reporting', label: '3. Incident Reporting', mobile: true },
    { path: '/04-cleanup-event-details', label: '4. Cleanup Event Details', mobile: true },
    { path: '/05-multiday-availability', label: '5. Multi-Day Availability Selection', mobile: true },
    { path: '/06-organization-dashboard', label: '6. Organization Dashboard', mobile: false },
    { path: '/07-incident-event-scheduling', label: '7. Incident Review & Event Scheduling', mobile: false },
    { path: '/08-super-admin-verification', label: '8. Super Admin Organization Verification', mobile: false },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)',
      padding: 'var(--spacing-lg)',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-3xl)',
            color: 'var(--color-primary)',
            margin: 0,
            marginBottom: 'var(--spacing-md)'
          }}>
            🌱 EcoTrack SRS Mockup
          </h1>
          <p style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            margin: 0
          }}>
            High-Fidelity UI Designs for Software Requirements Specification
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--spacing-lg)',
        }}>
          {screens.map((screen) => (
            <Link
              key={screen.path}
              to={screen.path}
              style={{
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div className="card" style={{
                padding: 'var(--spacing-lg)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
              }} onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--color-primary)', marginBottom: 'var(--spacing-xs)' }}>
                    {screen.label}
                  </h3>
                  <span className="badge" style={{
                    display: 'inline-block',
                    backgroundColor: screen.mobile ? 'rgba(25, 118, 210, 0.1)' : 'rgba(27, 94, 32, 0.1)',
                    color: screen.mobile ? 'var(--color-secondary)' : 'var(--color-primary)'
                  }}>
                    {screen.mobile ? '📱 Mobile (390×844)' : '🖥️ Desktop (1440×1000)'}
                  </span>
                </div>
                <div style={{
                  fontSize: 'var(--font-size-2xl)',
                  marginTop: 'auto'
                }}>
                  →
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{
          marginTop: 'var(--spacing-2xl)',
          padding: 'var(--spacing-lg)',
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)'
        }}>
          <h4 style={{ margin: '0 0 var(--spacing-md) 0', color: 'var(--color-text-primary)' }}>
            📝 Mockup Information
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.8 }}>
            <li>All designs are static mockups with no backend integration</li>
            <li>Mobile screens (1-5) use 390×844px viewport</li>
            <li>Desktop screens (6-8) use 1440×1000px viewport</li>
            <li>Uses EcoTrack design system with green primary color (#1b5e20)</li>
            <li>SVG maps included with OpenStreetMap attribution</li>
            <li>Accessible contrast ratios and clear typography</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/01-magic-link-login" element={<MagicLinkLogin />} />
        <Route path="/02-citizen-volunteer-map" element={<CitizenVolunteerMap />} />
        <Route path="/03-incident-reporting" element={<IncidentReporting />} />
        <Route path="/04-cleanup-event-details" element={<CleanupEventDetails />} />
        <Route path="/05-multiday-availability" element={<MultiDayAvailability />} />
        <Route path="/06-organization-dashboard" element={<OrganizationDashboard />} />
        <Route path="/07-incident-event-scheduling" element={<IncidentEventScheduling />} />
        <Route path="/08-super-admin-verification" element={<SuperAdminVerification />} />
      </Routes>
    </Router>
  )
}

export default App
