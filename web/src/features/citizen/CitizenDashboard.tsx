import { useCallback } from "react";
import { BorderGlow } from "../../components/BorderGlow";
import { WebThreads } from "../../components/WebThreads";
import type { AuthenticatedUserProfile } from "../auth/auth.types";
import { getCitizenSummary } from "../dashboards/dashboard.api";
import { SummaryPanel } from "../dashboards/SummaryPanel";
import { total } from "../dashboards/dashboard.utils";
import type { ActiveOrganizationMembership } from "../memberships/administration/membershipAdministration.types";
import { CitizenIcon } from "./CitizenSidebar";
import "./citizenDashboard.css";

interface CitizenDashboardProps {
  profile: AuthenticatedUserProfile;
  accessToken?: string;
  onManageMembership: () => void;
  onOpenOrganizationWorkspaces: () => void;
  activeOrganization?: ActiveOrganizationMembership;
  onOpenOrganizationWorkspace?: () => void;
  onStartOrganizationApplication: () => void;
  onViewOrganizationApplications: () => void;
  onReportIncident: () => void;
  onViewIncidentReports: () => void;
  onFindCleanupActivity: () => void;
  onBrowseCleanupEvents: () => void;
  onViewJoinedCleanupEvents: () => void;
  onOpenImpact: () => void;
}

export function CitizenDashboard({
  profile,
  accessToken,
  onManageMembership,
  onOpenOrganizationWorkspaces,
  activeOrganization,
  onOpenOrganizationWorkspace,
  onStartOrganizationApplication,
  onViewOrganizationApplications,
  onReportIncident,
  onViewIncidentReports,
  onFindCleanupActivity,
  onBrowseCleanupEvents,
  onViewJoinedCleanupEvents,
  onOpenImpact,
}: CitizenDashboardProps) {
  const displayName = profile.fullName ?? "EcoTrack member";
  const loadSummary = useCallback(() => getCitizenSummary(accessToken!), [accessToken]);

  return (
    <main className="citizen-dashboard-main">
      <BorderGlow
        className="citizen-dashboard-hero-glow"
        edgeSensitivity={38}
        glowColor="103 42 45"
        backgroundColor="#edf7e6"
        borderRadius={25}
        glowRadius={34}
        glowIntensity={0.46}
        coneSpread={20}
        fillOpacity={0.2}
        animated
        colors={["#4f8c4f", "#d1a53d", "#77a95d"]}
      >
        <section className="citizen-dashboard-hero">
          <span className="citizen-dashboard-hero-orb" aria-hidden="true" />
          <WebThreads
            className="citizen-dashboard-web-threads"
            color1="#2f783d"
            color2="#8a9f3f"
            color3="#e2b94d"
            speed={0.13}
            threadCount={5}
            frequency={3.4}
            spread={0.1}
            taper={0.55}
            position={0.5}
            slope={0.66}
            fanMode="left"
            glow={0.017}
            falloff={0.72}
            thickness={0.9}
            brightness={0.68}
            opacity={0.34}
            mirror={false}
            shimmer
            grain={false}
            mouseInteraction={false}
          />
          <div className="citizen-dashboard-hero-copy">
            <div className="citizen-dashboard-hero-kicker">
              <span className="citizen-dashboard-eyebrow">Community workspace</span>
              <span className="citizen-dashboard-live-status">EcoTrack live</span>
            </div>
            <h1>Welcome back, {displayName}</h1>
            <p>
              Report local environmental concerns, volunteer for community
              action, and bring a real environmental organization to EcoTrack.
            </p>
            <div className="citizen-dashboard-trust-row" aria-label="Account capabilities">
              <span>Verified profile</span>
              <span>Community reporting</span>
              <span>Volunteer access</span>
            </div>
          </div>

          <div className="citizen-dashboard-role-card">
            <span className="citizen-dashboard-role-icon">
              <CitizenIcon name="shield" />
            </span>
            <div>
              <small>Your access</small>
              <strong>Citizen &amp; Volunteer</strong>
              <p>One account provides both community capabilities.</p>
            </div>
            <div className="citizen-dashboard-role-details">
              <span>
                <small>Account</small>
                <strong>Active</strong>
              </span>
              <span>
                <small>Workspace</small>
                <strong>{activeOrganization ? "Connected" : "Personal"}</strong>
              </span>
            </div>
          </div>
        </section>
      </BorderGlow>

        {accessToken && <SummaryPanel load={loadSummary} label="Citizen summary">{(summary) => (
        <section className="citizen-dashboard-summary" aria-label="Account overview">
          <article className="citizen-summary-card citizen-summary-card-organization">
            <span className="citizen-summary-icon citizen-summary-icon-green">
              <CitizenIcon name="organization" />
            </span>
            <div>
              <small>
                {activeOrganization
                  ? "Organization workspace"
                  : "Organization onboarding"}
              </small>
              <strong>
                {activeOrganization?.organization.name ?? "Available now"}
              </strong>
              <p>
                {activeOrganization
                  ? `${activeOrganization.role === "ORG_ADMIN" ? "Admin" : "Member"} access is active.`
                  : "Request a workspace for an existing organization."}
              </p>
            </div>
          </article>
          <article className="citizen-summary-card citizen-summary-card-reports">
            <span className="citizen-summary-icon citizen-summary-icon-amber">
              <CitizenIcon name="report" />
            </span>
            <div>
              <small>Environmental reports</small>
              <strong>{total(summary.reportsByState)}</strong>
              <p>{Object.entries(summary.reportsByState).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No reports yet"}</p>
            </div>
          </article>
          <article className="citizen-summary-card citizen-summary-card-impact">
            <span className="citizen-summary-icon citizen-summary-icon-blue">
              <CitizenIcon name="volunteer" />
            </span>
            <div>
              <small>Cleanup participation</small>
              <strong>{summary.upcomingEvents} upcoming</strong>
              <p>{summary.joinedEvents} joined · {summary.contributions.points} impact points · {summary.unreadNotifications} unread</p>
            </div>
          </article>
        </section>)}</SummaryPanel>}

        <section className="citizen-dashboard-section">
          <div className="citizen-dashboard-section-heading">
            <div>
              <span className="citizen-dashboard-eyebrow">Quick actions</span>
              <h2>What would you like to do?</h2>
            </div>
            <p>Available actions reflect the current EcoTrack milestone.</p>
          </div>

          <div className="citizen-dashboard-actions">
            <article className="citizen-action-card citizen-action-card-featured citizen-action-card-workspace">
              <span className="citizen-action-icon">
                <CitizenIcon name="shield" />
              </span>
              <span className="citizen-action-badge">Available</span>
              <h3>Open an organization workspace</h3>
              <p>
                View your active organization memberships. Organization Admins
                can review requests and manage members inside only that
                organization.
              </p>
              <button
                className="citizen-action-primary"
                type="button"
                onClick={onOpenOrganizationWorkspaces}
              >
                View workspaces
                <CitizenIcon name="arrow" />
              </button>
            </article>

            <article className="citizen-action-card citizen-action-card-organization">
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

            <article className="citizen-action-card citizen-action-card-request">
              <span className="citizen-action-icon">
                <CitizenIcon name="organization" />
              </span>
              <span className="citizen-action-badge">Available</span>
              <h3>
                {activeOrganization
                  ? activeOrganization.organization.name
                  : "Request an organization workspace"}
              </h3>
              <p>
                {activeOrganization
                  ? "Your accepted organization membership is active."
                  : "Submit official details and proposed service areas for Super Admin review. Approval makes the requester the first Org Admin."}
              </p>
              <div className="citizen-action-buttons">
                <button
                  className="citizen-action-primary"
                  type="button"
                  onClick={
                    activeOrganization && onOpenOrganizationWorkspace
                      ? onOpenOrganizationWorkspace
                      : onStartOrganizationApplication
                  }
                >
                  {activeOrganization ? "Open workspace" : "Start request"}
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

            <article className="citizen-action-card citizen-action-card-incident">
              <span className="citizen-action-icon">
                <CitizenIcon name="report" />
              </span>
              <span className="citizen-action-badge">Available</span>
              <h3>Report an environmental incident</h3>
              <p>
                Confirm a map location, describe the concern, and attach photo
                evidence for nearby organizations to review.
              </p>
              <div className="citizen-action-buttons">
                <button className="citizen-action-primary" type="button" onClick={onReportIncident}>
                  Report incident
                  <CitizenIcon name="arrow" />
                </button>
                <button className="citizen-action-secondary" type="button" onClick={onViewIncidentReports}>
                  View my reports
                </button>
              </div>
            </article>

            <article className="citizen-action-card citizen-action-card-impact">
              <span className="citizen-action-icon">
                <CitizenIcon name="volunteer" />
              </span>
              <span className="citizen-action-badge">Available</span>
              <h3>View My Impact</h3>
              <p>
                See non-monetary points, earned achievements, and the private
                history explaining every verified contribution.
              </p>
              <button
                className="citizen-action-primary"
                type="button"
                onClick={onOpenImpact}
              >
                Open My Impact
                <CitizenIcon name="arrow" />
              </button>
            </article>

            <article className="citizen-action-card citizen-action-card-discovery">
              <span className="citizen-action-icon">
                <CitizenIcon name="volunteer" />
              </span>
              <span className="citizen-action-badge">Available</span>
              <h3>Find cleanup activity</h3>
              <p>
                Explore mapped environmental incidents that may become local
                cleanup opportunities.
              </p>
              <button
                className="citizen-action-primary"
                type="button"
                onClick={onFindCleanupActivity}
              >
                Open discovery map
                <CitizenIcon name="arrow" />
              </button>
            </article>

            <article className="citizen-action-card citizen-action-card-events">
              <span className="citizen-action-icon"><CitizenIcon name="volunteer" /></span>
              <span className="citizen-action-badge">Available</span>
              <h3>Browse cleanup events</h3>
              <p>See published event schedules, locations, and public volunteer instructions.</p>
              <button className="citizen-action-primary" type="button" onClick={onBrowseCleanupEvents}>
                View published events <CitizenIcon name="arrow" />
              </button>
              <button className="citizen-action-secondary" type="button" onClick={onViewJoinedCleanupEvents}>
                My joined events
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
  );
}
