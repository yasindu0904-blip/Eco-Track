import React from 'react'
import { BarChart3, Users, Calendar, TrendingUp, MessageSquare, Settings } from 'lucide-react'
import '../styles/pages.css'

export const OrganizationDashboard: React.FC = () => {
  const stats = [
    { icon: '📊', label: 'Total Events', value: '24' },
    { icon: '👥', label: 'Active Volunteers', value: '156' },
    { icon: '🌍', label: 'Impact Hours', value: '1,240' },
  ]

  const events = [
    { id: 1, icon: '🌊', title: 'Beach Cleanup', date: 'Aug 17', volunteers: 12 },
    { id: 2, icon: '🌳', title: 'Tree Planting', date: 'Aug 24', volunteers: 8 },
    { id: 3, icon: '🚴', title: 'Park Trail Maintenance', date: 'Sep 1', volunteers: 15 },
    { id: 4, icon: '🗑️', title: 'Community Litter Pickup', date: 'Sep 7', volunteers: 20 },
  ]

  const incidents = [
    { id: 1, type: '⚠️', title: 'Litter at Central Park', status: 'New', date: '2 hours ago' },
    { id: 2, type: '💨', title: 'Air quality concern', status: 'In Review', date: '5 hours ago' },
    { id: 3, type: '🦌', title: 'Wildlife disturbance', status: 'Resolved', date: '1 day ago' },
  ]

  return (
    <div className="desktop-container">
      <div className="desktop-frame">
        <header className="header">
          <div className="header-content">
            <div className="header-title">
              <h1>Organization Dashboard</h1>
              <p className="header-subtitle">Manage events, volunteers, and community impact</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <button className="btn btn-ghost">
                <MessageSquare size={20} />
              </button>
              <button className="btn btn-ghost">
                <Settings size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="desktop-content">
          {/* Greeting */}
          <div className="dashboard-header">
            <div className="dashboard-greeting">
              <h2 style={{ margin: 0, marginBottom: 'var(--spacing-sm)' }}>Welcome back, Organizations Team!</h2>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                Here's your community's impact overview
              </p>
            </div>
            <button className="btn btn-primary">+ New Event</button>
          </div>

          {/* Stats */}
          <div className="dashboard-grid">
            {stats.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">{stat.icon}</div>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Upcoming Events */}
          <div className="dashboard-section">
            <h2>Upcoming Events</h2>
            <div className="event-grid">
              {events.map((event) => (
                <div key={event.id} className="small-card">
                  <div className="small-card-icon">{event.icon}</div>
                  <h3>{event.title}</h3>
                  <p>{event.date}</p>
                  <p style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    👥 {event.volunteers} volunteers
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Incidents */}
          <div className="dashboard-section">
            <h2>Recent Incidents</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {incidents.map((incident) => (
                <div key={incident.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h4 style={{ margin: 0, marginBottom: 'var(--spacing-xs)' }}>
                        {incident.type} {incident.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {incident.date}
                      </p>
                    </div>
                    <span className={`badge ${
                      incident.status === 'New' ? 'badge-warning' :
                      incident.status === 'In Review' ? 'badge-info' :
                      'badge-success'
                    }`}>
                      {incident.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-section">
            <h2>Quick Actions</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--spacing-md)'
            }}>
              <button className="small-card" style={{ border: 'none', cursor: 'pointer', padding: 'var(--spacing-lg)', textAlign: 'center' }}>
                <div className="small-card-icon">📝</div>
                <h3>Create Event</h3>
                <p style={{ fontSize: 'var(--font-size-xs)' }}>New campaign</p>
              </button>
              <button className="small-card" style={{ border: 'none', cursor: 'pointer', padding: 'var(--spacing-lg)', textAlign: 'center' }}>
                <div className="small-card-icon">📧</div>
                <h3>Send Message</h3>
                <p style={{ fontSize: 'var(--font-size-xs)' }}>To volunteers</p>
              </button>
              <button className="small-card" style={{ border: 'none', cursor: 'pointer', padding: 'var(--spacing-lg)', textAlign: 'center' }}>
                <div className="small-card-icon">📊</div>
                <h3>View Reports</h3>
                <p style={{ fontSize: 'var(--font-size-xs)' }}>Impact data</p>
              </button>
              <button className="small-card" style={{ border: 'none', cursor: 'pointer', padding: 'var(--spacing-lg)', textAlign: 'center' }}>
                <div className="small-card-icon">⚙️</div>
                <h3>Settings</h3>
                <p style={{ fontSize: 'var(--font-size-xs)' }}>Organization</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
