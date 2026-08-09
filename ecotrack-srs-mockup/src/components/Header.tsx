import React from 'react'
import '../styles/header.css'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack,
  onBack
}) => {
  return (
    <header className="header">
      <div className="header-content">
        {showBack && (
          <button className="btn-back" onClick={onBack} aria-label="Go back">
            ←
          </button>
        )}
        <div className="header-title">
          <h1>{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}
