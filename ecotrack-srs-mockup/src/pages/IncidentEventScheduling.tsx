import React, { useState } from 'react'
import '../styles/pages.css'

export const IncidentEventScheduling: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'incidents' | 'events' | 'volunteers'>('incidents')

  const incidents = [
    {
      id: 1,
      icon: '⚠️',
      title: 'Litter at Central Park',
      location: 'Central Park - East Meadow',
      date: '3 hours ago',
      status: 'Pending Review',
      priority: 'High'
    },
    {
      id: 2,
      icon: '💨',
      title: 'Air Quality Concern',
      location: 'Downtown District',
      date: 'Today at 2:30 PM',
      status: 'In Review',
      priority: 'Medium'
    },
    {
      id: 3,
      icon: '🦌',
      title: 'Wildlife in Residential Area',
      location: 'Oakville Park',
      date: 'Yesterday',
      status: 'Resolved',
      priority: 'Low'
    },
  ]

  const events = [
    {
      id: 1,
      icon: '🌊',
      title: 'Beach Cleanup Day',
      date: 'August 17, 2024 - 9:00 AM',
      volunteers: 24,
      status: 'Confirmed'
    },
    {
      id: 2,
      icon: '🌳',
      title: 'Tree Planting Initiative',
      date: 'August 24, 2024 - 10:00 AM',
      volunteers: 18,
      status: 'Confirmed'
    },
    {
      id: 3,
      icon: '🚴',
      title: 'Trail Maintenance Ride',
      date: 'September 1, 2024 - 8:00 AM',
      volunteers: 12,
      status: 'Planning'
    },
  ]

  const volunteers = [
    {
      id: 1,
      initial: 'SM',
      name: 'Sarah Martinez',
      skills: 'Event Organization, Leadership',
      events: 8,
      hours: 240,
      status: 'active'
    },
    {
      id: 2,
      initial: 'JD',
      name: 'James Davis',
      skills: 'Environmental Science, Data',
      events: 5,
      hours: 120,
      status: 'active'
    },
    {
      id: 3,
      initial: 'AK',
      name: 'Amanda Khan',
      skills: 'Community Outreach, Social',
      events: 12,
      hours: 360,
      status: 'active'
    },
    {
      id: 4,
      initial: 'RC',
      name: 'Robert Chen',
      skills: 'Project Management, Planning',
      events: 6,
      hours: 180,
      status: 'inactive'
    },
  ]

  return (
    <div className="desktop-container">
      <div className="desktop-frame">
        <header className="header">
          <div className="header-content">
            <div className="header-title">
              <h1>Incident Review & Event Scheduling</h1>
              <p className="header-subtitle">Manage community incidents and volunteer events</p>
            </div>
          </div>
        </header>

        <div className="desktop-content">
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-lg)',
            marginBottom: 'var(--spacing-lg)',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: 'var(--spacing-md)'
          }}>
            <button
              onClick={() => setActiveTab('incidents')}
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--spacing-md) 0',
                color: activeTab === 'incidents' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === 'incidents' ? 600 : 400,
                borderBottom: activeTab === 'incidents' ? '3px solid var(--color-primary)' : 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)'
              }}
            >
              Incidents
            </button>
            <button
              onClick={() => setActiveTab('events')}
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--spacing-md) 0',
                color: activeTab === 'events' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === 'events' ? 600 : 400,
                borderBottom: activeTab === 'events' ? '3px solid var(--color-primary)' : 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)'
              }}
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab('volunteers')}
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--spacing-md) 0',
                color: activeTab === 'volunteers' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === 'volunteers' ? 600 : 400,
                borderBottom: activeTab === 'volunteers' ? '3px solid var(--color-primary)' : 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)'
              }}
            >
              Volunteers
            </button>
          </div>

          {/* Incidents Tab */}
          {activeTab === 'incidents' && (
            <div>
              <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Reported Incidents</h2>
                <button className="btn btn-primary">Create Event from Incident</button>
              </div>
              <div className="incident-review-grid">
                {incidents.map((incident) => (
                  <div key={incident.id} className="incident-review-card">
                    <div className="incident-review-header">
                      <h3 className="incident-review-title">{incident.icon} {incident.title}</h3>
                      <span className={`incident-review-badge badge ${
                        incident.priority === 'High' ? 'badge-error' :
                        incident.priority === 'Medium' ? 'badge-warning' :
                        'badge-success'
                      }`} style={{ background: 'rgba(255, 255, 255, 0.3)', color: 'white' }}>
                        {incident.priority}
                      </span>
                    </div>
                    <div className="incident-review-body">
                      <div className="incident-detail">
                        <span className="incident-detail-label">📍 Location</span>
                        <span className="incident-detail-value">{incident.location}</span>
                      </div>
                      <div className="incident-detail">
                        <span className="incident-detail-label">🕐 Reported</span>
                        <span className="incident-detail-value">{incident.date}</span>
                      </div>
                      <div className="incident-detail">
                        <span className="incident-detail-label">📋 Status</span>
                        <span className={`badge ${
                          incident.status === 'Pending Review' ? 'badge-warning' :
                          incident.status === 'In Review' ? 'badge-info' :
                          'badge-success'
                        }`}>
                          {incident.status}
                        </span>
                      </div>
                      <div className="incident-actions">
                        <button className="btn btn-secondary">Review</button>
                        <button className="btn btn-outline">Assign</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h2 style={{ margin: 0, marginBottom: 'var(--spacing-lg)' }}>Scheduled Events</h2>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--spacing-lg)'
              }}>
                {events.map((event) => (
                  <div key={event.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-md)' }}>
                      <div>
                        <h3 style={{ margin: 0, marginBottom: 'var(--spacing-sm)' }}>
                          {event.icon} {event.title}
                        </h3>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          📅 {event.date}
                        </p>
                      </div>
                      <span className={`badge ${event.status === 'Confirmed' ? 'badge-success' : 'badge-info'}`}>
                        {event.status}
                      </span>
                    </div>
                    <div style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--spacing-md)',
                      textAlign: 'center'
                    }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {event.volunteers}
                      </p>
                      <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        Volunteers Confirmed
                      </p>
                    </div>
                    <div className="flex" style={{ gap: 'var(--spacing-sm)' }}>
                      <button className="btn btn-primary" style={{ flex: 1 }}>Edit</button>
                      <button className="btn btn-outline" style={{ flex: 1 }}>View Volunteers</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Volunteers Tab */}
          {activeTab === 'volunteers' && (
            <div>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h2 style={{ margin: 0, marginBottom: 'var(--spacing-lg)' }}>Volunteer Roster</h2>
              </div>
              <div className="volunteer-grid">
                {volunteers.map((volunteer) => (
                  <div key={volunteer.id} className="volunteer-card">
                    <div className="volunteer-header">
                      <div className="volunteer-avatar">{volunteer.initial}</div>
                      <div className="volunteer-info">
                        <p className="volunteer-name">{volunteer.name}</p>
                        <p className="volunteer-skills">{volunteer.skills}</p>
                      </div>
                      <span className={`badge ${volunteer.status === 'active' ? 'badge-success' : ''}`} style={{ marginLeft: 'auto' }}>
                        {volunteer.status === 'active' ? '🟢 Active' : '⚫ Inactive'}
                      </span>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--spacing-md)',
                      padding: 'var(--spacing-md) 0',
                      borderTop: '1px solid var(--color-border)',
                      marginTop: 'var(--spacing-md)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {volunteer.events}
                        </p>
                        <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          Events
                        </p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {volunteer.hours}h
                        </p>
                        <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          Hours
                        </p>
                      </div>
                    </div>
                    <div className="volunteer-action">
                      <button className="btn btn-primary" style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                        Assign to Event
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
