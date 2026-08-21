import { useCallback } from "react";

import type { AuthenticatedUserProfile } from "../auth/auth.types";
import { getCitizenSummary } from "../dashboards/dashboard.api";
import { SummaryPanel } from "../dashboards/SummaryPanel";
import { total } from "../dashboards/dashboard.utils";
import type { ActiveOrganizationMembership } from "../memberships/administration/membershipAdministration.types";
import { CitizenIcon, type CitizenIconName } from "./CitizenSidebar";
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

type ActionProps = {
  title: string;
  description: string;
  icon: CitizenIconName;
  onClick: () => void;
  emphasis?: "primary" | "warm" | "plain";
};

function DashboardAction({
  title,
  description,
  icon,
  onClick,
  emphasis = "plain",
}: ActionProps) {
  return (
    <button
      className={`citizen-dashboard-action citizen-dashboard-action-${emphasis}`}
      type="button"
      onClick={onClick}
    >
      <span className="citizen-dashboard-action-icon" aria-hidden="true">
        <CitizenIcon name={icon} />
      </span>
      <span className="citizen-dashboard-action-copy">
        <strong>{title}</strong>
        <small>{description}</small>
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
          <p>
            Report a local issue, find a cleanup nearby, or continue work with
            your organization.
          </p>
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
          <p>Choose one action to continue.</p>
        </div>
        <div className="citizen-dashboard-primary-actions">
          <DashboardAction
            title="Report an incident"
            description="Pin the location and share what you found."
            icon="report"
            emphasis="primary"
            onClick={onReportIncident}
          />
          <DashboardAction
            title="Explore the community map"
            description="Find current incidents and cleanup activity nearby."
            icon="volunteer"
            emphasis="warm"
            onClick={onFindCleanupActivity}
          />
          <DashboardAction
            title="Browse cleanup events"
            description="Review published schedules and join as a volunteer."
            icon="volunteer"
            onClick={onBrowseCleanupEvents}
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
              description="Check report details and status history."
              icon="report"
              onClick={onViewIncidentReports}
            />
            <DashboardAction
              title="My joined events"
              description="View availability, assignments, and attendance."
              icon="volunteer"
              onClick={onViewJoinedCleanupEvents}
            />
            <DashboardAction
              title="My impact"
              description="See earned points and community achievements."
              icon="volunteer"
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
            {activeOrganization ? (
              <span className="citizen-dashboard-role-label">
                {activeOrganization.role === "ORG_ADMIN" ? "Admin" : "Member"}
              </span>
            ) : null}
          </div>

          {activeOrganization && onOpenOrganizationWorkspace ? (
            <button
              className="citizen-dashboard-organization"
              type="button"
              onClick={onOpenOrganizationWorkspace}
            >
              <span className="citizen-dashboard-organization-mark" aria-hidden="true">
                <CitizenIcon name="organization" />
              </span>
              <span>
                <small>Current workspace</small>
                <strong>{activeOrganization.organization.name}</strong>
              </span>
              <CitizenIcon name="arrow" />
            </button>
          ) : (
            <div className="citizen-dashboard-organization-empty">
              <span className="citizen-dashboard-organization-mark" aria-hidden="true">
                <CitizenIcon name="organization" />
              </span>
              <span>
                <strong>No active workspace yet</strong>
                <small>You can join an approved organization or submit one for review.</small>
              </span>
            </div>
          )}

          <div className="citizen-dashboard-list-actions">
            <DashboardAction
              title="Organization workspaces"
              description="Choose from all of your active memberships."
              icon="shield"
              onClick={onOpenOrganizationWorkspaces}
            />
            <DashboardAction
              title="Membership"
              description="Find an organization or manage your request."
              icon="organization"
              onClick={onManageMembership}
            />
            <DashboardAction
              title="Organization requests"
              description="Submit a new request or follow an existing review."
              icon="organization"
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
