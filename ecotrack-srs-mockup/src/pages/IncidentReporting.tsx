import React, { useState } from 'react'
import { MapPin, Camera, AlertCircle, CheckCircle } from 'lucide-react'
import { Header } from '../components/Header'
import '../styles/pages.css'

type IncidentType = 'litter' | 'pollution' | 'wildlife' | 'damage'
type ScreenStep = 'form' | 'confirmation'

interface IncidentReport {
  type?: IncidentType
  title: string
  description: string
  location: string
  hasPhoto: boolean
}

export const IncidentReporting: React.FC = () => {
  const [step, setStep] = useState<ScreenStep>('form')
  const [report, setReport] = useState<IncidentReport>({
    title: '',
    description: '',
    location: 'Central Park - Near East Meadow',
    hasPhoto: false
  })
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedType && report.title && report.description) {
      setStep('confirmation')
    }
  }

  const handleNewReport = () => {
    setStep('form')
    setSelectedType(null)
    setReport({
      title: '',
      description: '',
      location: 'Central Park - Near East Meadow',
      hasPhoto: false
    })
  }

  return (
    <div className="mobile-container">
      <div className="incident-screen">
        <Header
          title="Report Incident"
          subtitle="Help keep our community clean"
          showBack={false}
        />

        {step === 'form' && (
          <div className="incident-form">
            {/* Incident Type Selection */}
            <div>
              <h3 style={{ marginBottom: '8px', fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                What did you find?
              </h3>
              <div className="incident-type-selector">
                <div
                  className={`incident-type-option ${selectedType === 'litter' ? 'selected' : ''}`}
                  onClick={() => setSelectedType('litter')}
                >
                  <div className="incident-type-icon">🗑️</div>
                  <div className="incident-type-label">Litter</div>
                </div>
                <div
                  className={`incident-type-option ${selectedType === 'pollution' ? 'selected' : ''}`}
                  onClick={() => setSelectedType('pollution')}
                >
                  <div className="incident-type-icon">💨</div>
                  <div className="incident-type-label">Pollution</div>
                </div>
                <div
                  className={`incident-type-option ${selectedType === 'wildlife' ? 'selected' : ''}`}
                  onClick={() => setSelectedType('wildlife')}
                >
                  <div className="incident-type-icon">🦌</div>
                  <div className="incident-type-label">Wildlife Issue</div>
                </div>
                <div
                  className={`incident-type-option ${selectedType === 'damage' ? 'selected' : ''}`}
                  onClick={() => setSelectedType('damage')}
                >
                  <div className="incident-type-icon">⚠️</div>
                  <div className="incident-type-label">Property Damage</div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Incident Title</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g., Plastic bags in trees"
                  value={report.title}
                  onChange={(e) => setReport({ ...report, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  placeholder="Please describe what you found and any hazards..."
                  value={report.description}
                  onChange={(e) => setReport({ ...report, description: e.target.value })}
                  required
                  style={{ minHeight: '100px', fontFamily: 'var(--font-family)' }}
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg)' }}>
                  <MapPin size={20} style={{ color: 'var(--color-primary)' }} />
                  <span>{report.location}</span>
                </div>
              </div>

              {/* Photo Upload */}
              <div className="photo-upload" onClick={() => setReport({ ...report, hasPhoto: !report.hasPhoto })}>
                <div className="photo-icon">📷</div>
                <p className="photo-text">
                  {report.hasPhoto ? '✓ Photo added' : 'Tap to add photo'}
                </p>
              </div>

              <button type="submit" className="btn btn-primary btn-large">
                Continue
              </button>
            </form>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="confirmation-modal" style={{ position: 'static', background: 'none' }}>
            <div className="confirmation-content" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <CheckCircle size={64} style={{ color: 'var(--color-success)', margin: '0 auto var(--spacing-md)' }} />
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Confirm Location</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Is this the correct location for the incident?
                </p>
              </div>

              {/* Map Pin Preview */}
              <div className="confirmation-pin">
                <div className="confirmation-pin-icon">📍</div>
                <div className="confirmation-pin-address">
                  Central Park - Near East Meadow
                </div>
                <div className="confirmation-pin-coords">
                  40.7829° N, 73.9654° W
                </div>
              </div>

              {/* Incident Summary */}
              <div style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)'
              }}>
                <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)' }}>
                  {selectedType === 'litter' && '🗑️ Litter Report'}
                  {selectedType === 'pollution' && '💨 Pollution Report'}
                  {selectedType === 'wildlife' && '🦌 Wildlife Issue'}
                  {selectedType === 'damage' && '⚠️ Property Damage'}
                </h4>
                <p style={{ margin: 0, marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-primary)' }}>
                  <strong>{report.title}</strong>
                </p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  {report.description.substring(0, 80)}...
                </p>
              </div>

              <div className="confirmation-actions">
                <button
                  className="btn btn-primary btn-large"
                  onClick={() => setStep('confirmation')}
                >
                  ✓ Submit Report
                </button>
                <button
                  className="btn btn-outline btn-large"
                  onClick={handleNewReport}
                >
                  ← Edit Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
