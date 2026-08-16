import type { AuthenticatedUserProfile } from "../auth/auth.types";
import { NotificationButton } from "../notifications/NotificationInbox";
import "./citizenDashboard.css";

interface CitizenDashboardProps {
  profile: AuthenticatedUserProfile;
  accessToken?: string;
  onOpenNotifications?: () => void;
  onManageMembership: () => void;
  onStartOrganizationApplication: () => void;
  onViewOrganizationApplications: () => void;
  onSignOut: () => void;
}

type CitizenIconName =
  | "home"
  | "organization"
  | "report"
  | "volunteer"
  | "arrow"
  | "shield";

interface CitizenIconProps {
  name: CitizenIconName;
}

function CitizenIcon({ name }: CitizenIconProps) {
  if (name === "organization") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 21V7l8-4 8 4v14" />
        <path d="M8 10h2M14 10h2M8 14h2M14 14h2M10 21v-3h4v3" />
      </svg>
    );
  }

  if (name === "report") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M12 7v6M12 17h.01" />
      </svg>
    );
  }

  if (name === "volunteer") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z" />
      </svg>
    );
  }

  if (name === "arrow") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14M14 7l5 5-5 5" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 4.5 6v5c0 4.8 3 8.3 7.5 10 4.5-1.7 7.5-5.2 7.5-10V6L12 3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v11h14V10M9 21v-7h6v7" />
    </svg>
  );
}

export function CitizenDashboard({
  profile,
  accessToken,
  onOpenNotifications,
  onManageMembership,
  onStartOrganizationApplication,
  onViewOrganizationApplications,
  onSignOut,
}: CitizenDashboardProps) {
  const displayName = profile.fullName ?? "EcoTrack member";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="citizen-dashboard-shell">
      <header className="citizen-dashboard-header">
        <div className="citizen-dashboard-brand">
          <span className="citizen-dashboard-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <path className="citizen-brand-stem" d="M32 48V24" />
              <path
                className="citizen-brand-leaf"
                d="M31 27C18 28 11 20 10 10c12-1 21 4 23 15"
              />
              <path
                className="citizen-brand-leaf citizen-brand-leaf-right"
                d="M33 30c12 0 20-7 21-17-11-2-20 3-23 14"
              />
              <path
                className="citizen-brand-soil"
                d="M18 53c2-9 7-14 14-14s12 5 14 14H18Z"
              />
            </svg>
          </span>
          <span>
            <strong>EcoTrack</strong>
            <small>Citizen &amp; volunteer</small>
          </span>
        </div>

        <nav className="citizen-dashboard-nav" aria-label="Citizen navigation">
          <button className="citizen-dashboard-nav-active" type="button">
            <CitizenIcon name="home" />
            Dashboard
          </button>
          <button type="button" onClick={onViewOrganizationApplications}>
            <CitizenIcon name="organization" />
            My organization requests
          </button>
          <button type="button" onClick={onManageMembership}>
            <CitizenIcon name="organization" />
            Join an organization
          </button>
          {onOpenNotifications && (
            <NotificationButton
              accessToken={accessToken}
              onOpen={onOpenNotifications}
            />
          )}
        </nav>

        <div className="citizen-dashboard-user">
          <span className="citizen-dashboard-avatar" aria-hidden="true">
            {initial}
          </span>
          <span>
            <strong>{displayName}</strong>
            <small>{profile.email}</small>
          </span>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="citizen-dashboard-main">
        <section className="citizen-dashboard-hero">
          <div>
            <span className="citizen-dashboard-eyebrow">Community workspace</span>
            <h1>Welcome back, {displayName}</h1>
            <p>
              Report local environmental concerns, volunteer for community
              action, and bring a real environmental organization to EcoTrack.
            </p>
          </div>

          <div className="citizen-dashboard-role-card">
            <span>
              <CitizenIcon name="shield" />
            </span>
            <div>
              <small>Your access</small>
              <strong>Citizen &amp; Volunteer</strong>
              <p>One account provides both community capabilities.</p>
            </div>
          </div>
        </section>

        <section className="citizen-dashboard-summary" aria-label="Account overview">
          <article>
            <span className="citizen-summary-icon citizen-summary-icon-green">
              <CitizenIcon name="organization" />
            </span>
            <div>
              <small>Organization onboarding</small>
              <strong>Available now</strong>
              <p>Request a workspace for an existing organization.</p>
            </div>
          </article>
          <article>
            <span className="citizen-summary-icon citizen-summary-icon-amber">
              <CitizenIcon name="report" />
            </span>
            <div>
              <small>Environmental reports</small>
              <strong>Coming next</strong>
              <p>Incident reporting will be connected in a later milestone.</p>
            </div>
          </article>
          <article>
            <span className="citizen-summary-icon citizen-summary-icon-blue">
              <CitizenIcon name="volunteer" />
            </span>
            <div>
              <small>Cleanup participation</small>
              <strong>Coming next</strong>
              <p>Public cleanup-event discovery will appear here.</p>
            </div>
          </article>
        </section>

        <section className="citizen-dashboard-section">
          <div className="citizen-dashboard-section-heading">
            <div>
              <span className="citizen-dashboard-eyebrow">Quick actions</span>
              <h2>What would you like to do?</h2>
            </div>
            <p>Available actions reflect the current EcoTrack milestone.</p>
          </div>

          <div className="citizen-dashboard-actions">
            <article className="citizen-action-card citizen-action-card-featured">
              <span className="citizen-action-icon">
                <CitizenIcon name="organization" />
              </span>
              <span className="citizen-action-badge">Available</span>
              <h3>Join an active organization</h3>
              <p>
                Find approved organizations, request member access, update your
                profile, and track or withdraw pending requests.
              </p>
              <button
                className="citizen-action-primary"
                type="button"
                onClick={onManageMembership}
              >
                Manage membership
                <CitizenIcon name="arrow" />
              </button>
            </article>

            <article className="citizen-action-card citizen-action-card-featured">
              <span className="citizen-action-icon">
                <CitizenIcon name="organization" />
              </span>
              <span className="citizen-action-badge">Available</span>
              <h3>Request an organization workspace</h3>
              <p>
                Submit official details and proposed service areas for Super
                Admin review. Approval makes the requester the first Org Admin.
              </p>
              <div className="citizen-action-buttons">
                <button
                  className="citizen-action-primary"
                  type="button"
                  onClick={onStartOrganizationApplication}
                >
                  Start request
                  <CitizenIcon name="arrow" />
                </button>
                <button
                  className="citizen-action-secondary"
                  type="button"
                  onClick={onViewOrganizationApplications}
                >
                  View my requests
                </button>
              </div>
            </article>

            <article className="citizen-action-card">
              <span className="citizen-action-icon">
                <CitizenIcon name="report" />
              </span>
              <span className="citizen-action-badge citizen-action-badge-muted">
                Upcoming
              </span>
              <h3>Report an environmental incident</h3>
              <p>
                Add the incident-reporting flow when location and evidence
                modules are implemented.
              </p>
              <button className="citizen-action-disabled" type="button" disabled>
                Incident reporting is not connected
              </button>
            </article>

            <article className="citizen-action-card">
              <span className="citizen-action-icon">
                <CitizenIcon name="volunteer" />
              </span>
              <span className="citizen-action-badge citizen-action-badge-muted">
                Upcoming
              </span>
              <h3>Find cleanup opportunities</h3>
              <p>
                Browse published cleanup events and volunteer using this same
                EcoTrack account.
              </p>
              <button className="citizen-action-disabled" type="button" disabled>
                Cleanup events are not connected
              </button>
            </article>
          </div>
        </section>

        <section className="citizen-dashboard-foundation">
          <div>
            <span className="citizen-dashboard-foundation-icon">
              <CitizenIcon name="shield" />
            </span>
            <div>
              <h2>Your EcoTrack identity is ready</h2>
              <p>
                Supabase verified your session, and the API loaded your active
                PostgreSQL profile. Backend authorization protects every action.
              </p>
            </div>
          </div>
          <span className="citizen-dashboard-active-status">Active account</span>
        </section>
      </main>
    </div>
  );
}
