import React, { useState } from 'react'
import { Mail, CheckCircle, AlertCircle } from 'lucide-react'
import '../styles/pages.css'

export const MagicLinkLogin: React.FC = () => {
  const [step, setStep] = useState<'email' | 'sent' | 'error'>('email')
  const [email, setEmail] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.includes('@')) {
      setStep('sent')
    } else {
      setStep('error')
    }
  }

  return (
    <div className="mobile-container">
      <div className="login-screen">
        {/* Logo/Branding */}
        <div className="login-header">
          <div className="logo">🌱</div>
          <h1>EcoTrack</h1>
          <p>Community-Driven Environmental Action</p>
        </div>

        {/* Email Entry State */}
        {step === 'email' && (
          <div className="login-form">
            <div className="form-section">
              <h2>Sign In</h2>
              <p className="form-description">
                Enter your email to receive a magic link. No password needed!
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail size={20} className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-with-icon"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-large">
                Send Magic Link
              </button>
            </form>

            <div className="divider">
              <span>or</span>
            </div>

            <button className="btn btn-ghost btn-large">
              Sign in with Google
            </button>

            <p className="login-footer-text">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        )}

        {/* Confirmation Sent State */}
        {step === 'sent' && (
          <div className="login-form">
            <div className="success-state">
              <CheckCircle size={64} className="success-icon" />
              <h2>Check Your Email</h2>
              <p>
                We've sent a magic link to <strong>{email}</strong>
              </p>
              <p className="form-description">
                Click the link in your email to sign in. The link expires in 24 hours.
              </p>
            </div>

            <div className="verification-steps">
              <div className="step">
                <span className="step-number">1</span>
                <p>Check your inbox</p>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <p>Click the magic link</p>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <p>You're signed in!</p>
              </div>
            </div>

            <button
              className="btn btn-outline btn-large"
              onClick={() => setStep('email')}
            >
              Try Another Email
            </button>

            <p className="login-footer-text">
              Didn't receive the email? Check your spam folder.
            </p>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div className="login-form">
            <div className="error-state">
              <AlertCircle size={64} className="error-icon" />
              <h2>Invalid Email</h2>
              <p>
                Please enter a valid email address and try again.
              </p>
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={() => {
                setStep('email')
                setEmail('')
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
