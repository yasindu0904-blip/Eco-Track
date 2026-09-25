import { useCallback } from "react";

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
  onStartOrganizationApplication: () => void;
  onViewOrganizationApplications: () => void;
  onReportIncident: () => void;
  onViewIncidentReports: () => void;
  onFindCleanupActivity: () => void;
  onViewJoinedCleanupEvents: () => void;
  onOpenImpact: () => void;
}

type ActionProps = {
  title: string;
  onClick: () => void;
  emphasis?: "primary" | "warm" | "plain";
};

function DashboardAction({
  title,
  onClick,
  emphasis = "plain",
}: ActionProps) {
  return (
    <button
      className={`citizen-dashboard-action citizen-dashboard-action-${emphasis}`}
      type="button"
      onClick={onClick}
    >
      <span className="citizen-dashboard-action-copy">
        <strong>{title}</strong>
      </span>
      <span className="citizen-dashboard-action-arrow" aria-hidden="true">
        <CitizenIcon name="arrow" />
      </span>
    </button>
  );
}

export function CitizenDashboard({
  profile,
  accessToken,
  onManageMembership,
  onOpenOrganizationWorkspaces,
  activeOrganization,
  onStartOrganizationApplication,
  onViewOrganizationApplications,
  onReportIncident,
  onViewIncidentReports,
  onFindCleanupActivity,
  onViewJoinedCleanupEvents,
  onOpenImpact,
}: CitizenDashboardProps) {
  const displayName = profile.fullName?.trim() || "EcoTrack member";
  const firstName = displayName.split(/\s+/)[0];
  const loadSummary = useCallback(
    () => getCitizenSummary(accessToken!),
    [accessToken],
  );

  return (
    <main className="citizen-dashboard-main">
      <header className="citizen-dashboard-welcome">
        <div>
          <span className="citizen-dashboard-eyebrow">Personal workspace</span>
          <h1>Welcome back, {firstName}</h1>
        </div>
        <div className="citizen-dashboard-account-context">
          <span className="citizen-dashboard-context-avatar" aria-hidden="true">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span>
            <small>Signed in as</small>
            <strong>{displayName}</strong>
          </span>
        </div>
      </header>

      {accessToken ? (
        <SummaryPanel load={loadSummary} label="Your activity">
          {(summary) => (
            <section className="citizen-dashboard-metrics" aria-label="Your activity summary">
              <article>
                <small>Reports</small>
                <strong>{total(summary.reportsByState)}</strong>
              </article>
              <article>
                <small>Upcoming events</small>
                <strong>{summary.upcomingEvents}</strong>
              </article>
              <article>
                <small>Impact points</small>
                <strong>{summary.contributions.points}</strong>
              </article>
              <article>
                <small>Unread</small>
                <strong>{summary.unreadNotifications}</strong>
              </article>
            </section>
          )}
        </SummaryPanel>
      ) : null}

      <section className="citizen-dashboard-section">
        <div className="citizen-dashboard-section-heading">
          <div>
            <span className="citizen-dashboard-eyebrow">Community action</span>
            <h2>Start here</h2>
          </div>

        </div>
        <div className="citizen-dashboard-primary-actions">
          <DashboardAction
            title="Report an incident"
            emphasis="primary"
            onClick={onReportIncident}
          />
          <DashboardAction
            title="Find cleanup activity"
            emphasis="warm"
            onClick={onFindCleanupActivity}
          />
        </div>
      </section>

      <div className="citizen-dashboard-columns">
        <section className="citizen-dashboard-panel">
          <div className="citizen-dashboard-panel-heading">
            <div>
              <span className="citizen-dashboard-eyebrow">Your activity</span>
              <h2>Pick up where you left off</h2>
            </div>
          </div>
          <div className="citizen-dashboard-list-actions">
            <DashboardAction
              title="My reports"
              onClick={onViewIncidentReports}
            />
            <DashboardAction
              title="My joined events"
              onClick={onViewJoinedCleanupEvents}
            />
            <DashboardAction
              title="My impact"
              onClick={onOpenImpact}
            />
          </div>
        </section>

        <section className="citizen-dashboard-panel">
          <div className="citizen-dashboard-panel-heading">
            <div>
              <span className="citizen-dashboard-eyebrow">Organizations</span>
              <h2>Your organization access</h2>
            </div>
          </div>

          <div className="citizen-dashboard-list-actions">
            <DashboardAction
              title="Organization workspaces"
              onClick={onOpenOrganizationWorkspaces}
            />
            <DashboardAction
              title="Membership"
              onClick={onManageMembership}
            />
            <DashboardAction
              title="Organization requests"
              onClick={activeOrganization
                ? onViewOrganizationApplications
                : onStartOrganizationApplication}
            />
          </div>

          <button
            className="citizen-dashboard-text-action"
            type="button"
            onClick={onViewOrganizationApplications}
          >
            View application history
          </button>
        </section>
      </div>
    </main>
  );
}
