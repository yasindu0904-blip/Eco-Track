import React, { useState } from 'react'
import { CheckCircle, AlertCircle, FileText } from 'lucide-react'
import '../styles/pages.css'

interface Organization {
  id: number
  name: string
  region: string
  verificationStatus: 'pending' | 'verified' | 'rejected'
  submittedDate: string
  documents: { name: string; status: 'uploaded' | 'verified' | 'missing' }[]
  contact: string
  email: string
}

export const SuperAdminVerification: React.FC = () => {
  const [organizations] = useState<Organization[]>([
    {
      id: 1,
      name: 'Green City Initiative',
      region: 'Northern District',
      verificationStatus: 'pending',
      submittedDate: '2024-08-10',
      documents: [
        { name: '501(c)(3) Certificate', status: 'verified' },
        { name: 'Board of Directors List', status: 'verified' },
        { name: 'Environmental Impact Report', status: 'uploaded' },
        { name: 'Insurance Certificate', status: 'missing' }
      ],
      contact: 'Sarah Chen',
      email: 'sarah@greencity.org'
    },
    {
      id: 2,
      name: 'Ocean Guardians Alliance',
      region: 'Coastal Region',
      verificationStatus: 'verified',
      submittedDate: '2024-07-15',
      documents: [
        { name: '501(c)(3) Certificate', status: 'verified' },
        { name: 'Board of Directors List', status: 'verified' },
        { name: 'Environmental Impact Report', status: 'verified' },
        { name: 'Insurance Certificate', status: 'verified' }
      ],
      contact: 'Michael Torres',
      email: 'michael@oceanguardians.org'
    },
    {
      id: 3,
      name: 'Urban Forestry Project',
      region: 'Central District',
      verificationStatus: 'rejected',
      submittedDate: '2024-08-12',
      documents: [
        { name: '501(c)(3) Certificate', status: 'verified' },
        { name: 'Board of Directors List', status: 'uploaded' },
        { name: 'Environmental Impact Report', status: 'missing' },
        { name: 'Insurance Certificate', status: 'missing' }
      ],
      contact: 'Emma Rodriguez',
      email: 'emma@urbanforestry.org'
    },
  ])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={32} style={{ color: 'var(--color-success)' }} />
      case 'pending':
        return <AlertCircle size={32} style={{ color: 'var(--color-warning)' }} />
      case 'rejected':
        return <AlertCircle size={32} style={{ color: 'var(--color-error)' }} />
      default:
        return null
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'verified':
        return 'badge-success'
      case 'pending':
        return 'badge-warning'
      case 'rejected':
        return 'badge-error'
      default:
        return 'badge-info'
    }
  }

  return (
    <div className="desktop-container">
      <div className="desktop-frame">
        <header className="header">
          <div className="header-content">
            <div className="header-title">
              <h1>Super Admin Organization Verification</h1>
              <p className="header-subtitle">Review and approve organization registrations</p>
            </div>
          </div>
        </header>

        <div className="desktop-content">
          {/* Summary Stats */}
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <p className="stat-value">{organizations.filter(o => o.verificationStatus === 'pending').length}</p>
              <p className="stat-label">Pending Review</p>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <p className="stat-value">{organizations.filter(o => o.verificationStatus === 'verified').length}</p>
              <p className="stat-label">Verified</p>
            </div>
            <div className="stat-card">
              <div className="stat-icon">❌</div>
              <p className="stat-value">{organizations.filter(o => o.verificationStatus === 'rejected').length}</p>
              <p className="stat-label">Rejected</p>
            </div>
          </div>

          {/* Organizations Grid */}
          <div className="dashboard-section">
            <h2>Organization Applications</h2>
            <div className="verification-grid">
              {organizations.map((org) => (
                <div key={org.id} className="verification-card">
                  <div className="verification-status">
                    {getStatusIcon(org.verificationStatus)}
                    <div className="verification-status-text">
                      <h3>{org.name}</h3>
                      <p>{org.region}</p>
                    </div>
                    <span className={`badge ${getStatusBadgeClass(org.verificationStatus)}`} style={{ marginLeft: 'auto' }}>
                      {org.verificationStatus === 'pending' ? 'Pending' :
                       org.verificationStatus === 'verified' ? 'Verified' :
                       'Rejected'}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-bg)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-md)',
                    fontSize: 'var(--font-size-sm)'
                  }}>
                    <p style={{ margin: 0, marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                      Contact: <strong>{org.contact}</strong>
                    </p>
                    <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                      Email: <a href={`mailto:${org.email}`} style={{ color: 'var(--color-secondary)' }}>{org.email}</a>
                    </p>
                  </div>

                  {/* Documents Checklist */}
                  <div>
                    <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                      Required Documents
                    </h4>
                    <div className="verification-docs">
                      {org.documents.map((doc, idx) => (
                        <div key={idx} className="doc-item">
                          <div className="doc-item-name">
                            <span className="doc-icon">
                              {doc.status === 'verified' ? '✅' : doc.status === 'uploaded' ? '📄' : '⚠️'}
                            </span>
                            <span>{doc.name}</span>
                          </div>
                          <span className="doc-status">
                            {doc.status === 'verified' ? 'Verified' : doc.status === 'uploaded' ? 'Review' : 'Missing'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="verification-actions">
                    {org.verificationStatus === 'pending' && (
                      <>
                        <button className="btn btn-primary">Approve</button>
                        <button className="btn btn-outline">Reject</button>
                      </>
                    )}
                    {org.verificationStatus === 'verified' && (
                      <>
                        <button className="btn btn-ghost" style={{ flex: 1 }}>View Dashboard</button>
                        <button className="btn btn-outline">Revoke</button>
                      </>
                    )}
                    {org.verificationStatus === 'rejected' && (
                      <button className="btn btn-primary" style={{ width: '100%' }}>Re-evaluate</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Guidelines */}
          <div className="dashboard-section">
            <h2>Verification Guidelines</h2>
            <div className="card">
              <h4 style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>Required Documentation</h4>
              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.8
              }}>
                <li>Valid 501(c)(3) nonprofit certificate or equivalent</li>
                <li>Complete board of directors list with contact information</li>
                <li>Environmental impact report or mission statement</li>
                <li>General liability insurance certificate (minimum $1M coverage)</li>
                <li>Last 2 years of financial statements</li>
                <li>Background check clearance for organization leaders</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
