import React, { useState } from 'react'
import { Calendar, MapPin, Users, Clock, Share2, Heart } from 'lucide-react'
import { Header } from '../components/Header'
import '../styles/pages.css'

export const CleanupEventDetails: React.FC = () => {
  const [isJoined, setIsJoined] = useState(false)

  const participants = [
    { id: 1, name: 'Sarah', role: 'Organizer', initial: 'S' },
    { id: 2, name: 'Mike', role: 'Volunteer', initial: 'M' },
    { id: 3, name: 'Emma', role: 'Volunteer', initial: 'E' },
  ]

  return (
    <div className="mobile-container">
      <div className="event-details-screen">
        <Header
          title="Event Details"
          showBack={true}
        />

        {/* Event Header Image */}
        <div className="event-header-image">
          🌊
        </div>

        {/* Content */}
        <div className="event-details-content">
          <div className="event-details-header">
            <h2 className="event-title">Beach Cleanup Day</h2>
            <span className="badge badge-success">
              <span style={{ fontSize: '16px' }}>✓</span>
              Open to Join
            </span>
          </div>

          {/* Event Metadata */}
          <div className="event-meta">
            <div className="event-meta-item">
              <div className="event-meta-icon">📅</div>
              <span>Saturday, August 17, 2024</span>
            </div>
            <div className="event-meta-item">
              <div className="event-meta-icon">🕐</div>
              <span>9:00 AM - 1:00 PM (4 hours)</span>
            </div>
            <div className="event-meta-item">
              <div className="event-meta-icon">📍</div>
              <span>Santa Monica Beach, California</span>
            </div>
            <div className="event-meta-item">
              <div className="event-meta-icon">👥</div>
              <span>{participants.length} volunteers confirmed</span>
            </div>
          </div>

          {/* Description */}
          <div className="event-section">
            <h3>About This Event</h3>
            <p className="event-description">
              Join us for a community beach cleanup! We'll be collecting plastic waste, microplastics, and other debris from the shoreline. This is a great opportunity to make a direct impact on marine conservation and meet other environmental enthusiasts.
            </p>
            <p className="event-description">
              All supplies including gloves, bags, and tools will be provided. Just bring yourself and your enthusiasm!
            </p>
          </div>

          {/* What to Bring */}
          <div className="event-section">
            <h3>What to Bring</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-secondary)' }}>
              <li>Sunscreen and a hat</li>
              <li>Water bottle</li>
              <li>Comfortable shoes</li>
              <li>Optional: camera for photos</li>
            </ul>
          </div>

          {/* Participants */}
          <div className="event-section">
            <h3>Participants ({participants.length})</h3>
            <div className="participants-list">
              {participants.map((p) => (
                <div key={p.id} className="participant-item">
                  <div className="participant-avatar">{p.initial}</div>
                  <div className="participant-info">
                    <p className="participant-name">{p.name}</p>
                    <p className="participant-role">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="event-details-footer">
          <button className="btn btn-ghost">
            <Heart size={20} />
          </button>
          <button className="btn btn-ghost">
            <Share2 size={20} />
          </button>
          <button
            className={`btn btn-large`}
            style={{
              flex: 2,
              background: isJoined ? 'var(--color-success)' : 'var(--color-primary)',
              color: 'white'
            }}
            onClick={() => setIsJoined(!isJoined)}
          >
            {isJoined ? '✓ Joined' : 'Join Event'}
          </button>
        </div>
      </div>
    </div>
  )
}
