import { useCallback, useState } from "react";
import { getOrganizationSummary } from "../../dashboards/dashboard.api";
import { SummaryPanel } from "../../dashboards/SummaryPanel";
import { total } from "../../dashboards/dashboard.utils";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import type { ActiveOrganizationMembership } from "../../memberships/administration/membershipAdministration.types";
import { CleanupEventDraftEditor, OrganizationCleanupEventList } from "../../cleanup-events";
import { MembershipAdministrationPage } from "../../memberships/administration/MembershipAdministrationPage";

import "./organizationWorkspace.css";
import { OrganizationIncidentDiscovery } from "./OrganizationIncidentDiscovery";

interface OrganizationWorkspaceProps {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  memberships: ActiveOrganizationMembership[];
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
  onBackToDashboard: () => void;
  onViewApplications: () => void;
  onSignOut: () => void;
  initialTab?: "overview" | "incident-discovery" | "event-drafts" | "events" | "members";
  initialIncidentId?: string;
  initialEventId?: string;
}

export function OrganizationWorkspace({
  profile,
  accessToken,
  memberships,
  selectedOrganizationId,
  onSelectOrganization,
  onBackToDashboard,
  onViewApplications,
  onSignOut,
  initialTab = "overview",
  initialIncidentId,
  initialEventId,
}: OrganizationWorkspaceProps) {
  const [activeTab, setActiveTab] =
    useState<"overview" | "incident-discovery" | "event-drafts" | "events" | "members">(initialTab);
  const [linkedIncidentId, setLinkedIncidentId] = useState<string | undefined>(initialIncidentId);
  const [selectedOwnedEventId, setSelectedOwnedEventId] = useState<string | undefined>(initialEventId);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>(
    initialTab === "event-drafts" ? initialEventId : undefined,
  );
  const membership =
    memberships.find(
      (item) => item.organization.id === selectedOrganizationId,
    );
  const organizationId = membership?.organization.id ?? "";
  const loadSummary = useCallback(() => getOrganizationSummary(accessToken, organizationId), [accessToken, organizationId]);

  if (!membership) {
    return null;
  }

  const roleLabel =
    membership.role === "ORG_ADMIN"
      ? "Organization admin"
      : "Organization member";

  return (
    <div className="organization-workspace-shell">
      <header className="organization-workspace-header">
        <button type="button" onClick={onBackToDashboard}>
          Citizen dashboard
        </button>
        <strong>EcoTrack</strong>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <main className="organization-workspace-main">
        <section className="organization-workspace-heading">
          <div>
            <span>Organization workspace</span>
            <h1>{membership.organization.name}</h1>
            <p>{profile.email}</p>
          </div>

          {memberships.length > 1 && (
            <label>
              Active organization
              <select
                value={membership.organization.id}
                onChange={(event) => {
                  setActiveTab("overview");
                  setLinkedIncidentId(undefined);
                  setSelectedOwnedEventId(undefined);
                  setSelectedDraftId(undefined);
                  onSelectOrganization(event.target.value);
                }}
              >
                {memberships.map((item) => (
                  <option
                    key={item.organization.id}
                    value={item.organization.id}
                  >
                    {item.organization.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        <nav className="organization-workspace-tabs" aria-label="Organization workspace">
          <button
            type="button"
            className={activeTab === "overview" ? "is-active" : undefined}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          {activeTab === "incident-discovery" && (
            <span aria-current="page">/ Incident discovery</span>
          )}
          {activeTab === "event-drafts" && (
            <span aria-current="page">/ Cleanup-event drafts</span>
          )}
          {activeTab === "events" && <span aria-current="page">/ Organization events</span>}
          {activeTab === "members" && <span aria-current="page">/ Membership administration</span>}
        </nav>

        {activeTab === "members" && membership.role === "ORG_ADMIN" ? (
          <MembershipAdministrationPage
            accessToken={accessToken}
            organizationId={membership.organization.id}
            organizationName={membership.organization.name}
            onBack={() => setActiveTab("overview")}
          />
        ) : activeTab === "event-drafts" ? (
          <CleanupEventDraftEditor
            key={`${membership.organization.id}-${linkedIncidentId ?? selectedDraftId ?? "direct"}`}
            accessToken={accessToken}
            organizationId={membership.organization.id}
            incidentId={linkedIncidentId}
            initialDraftId={selectedDraftId}
            onBack={() => {
              setLinkedIncidentId(undefined);
              setSelectedDraftId(undefined);
              setActiveTab("overview");
            }}
          />
        ) : activeTab === "events" ? (
          <OrganizationCleanupEventList
            key={`${membership.organization.id}-${selectedOwnedEventId ?? "list"}`}
            accessToken={accessToken}
            organizationId={membership.organization.id}
            initialEventId={selectedOwnedEventId}
            canCancel={membership.role === "ORG_ADMIN"}
          />
        ) : activeTab === "incident-discovery" ? (
          <OrganizationIncidentDiscovery
            key={membership.organization.id}
            accessToken={accessToken}
            organizationId={membership.organization.id}
            canReview={membership.role === "ORG_ADMIN"}
            onCreateDraftFromIncident={membership.role === "ORG_ADMIN" ? (incidentId) => {
              setLinkedIncidentId(incidentId);
              setActiveTab("event-drafts");
            } : undefined}
            onOpenEvent={(eventId, lifecycleStatus) => {
              setSelectedOwnedEventId(eventId);
              if (lifecycleStatus === "DRAFT" && membership.role === "ORG_ADMIN") {
                setSelectedDraftId(eventId);
                setActiveTab("event-drafts");
              } else {
                setSelectedDraftId(undefined);
                setActiveTab("events");
              }
            }}
          />
        ) : (
          <>
            <SummaryPanel load={loadSummary} label="Organization summary">{(summary) => (
              <section className="organization-workspace-access" aria-label="Organization metrics">
                <div><small>Covered incidents</small><strong>{total(summary.coveringIncidentsByState)}</strong></div>
                <div><small>Upcoming sessions</small><strong>{summary.upcomingSessions}</strong></div>
                <div><small>Joined participants</small><strong>{summary.joinedParticipants}</strong></div>
                <div><small>Membership requests</small><strong>{summary.pendingMembershipRequests}</strong></div>
              </section>
            )}</SummaryPanel>
            <section className="organization-workspace-access" aria-label="Organization access">
              <div>
                <small>Membership</small>
                <strong>{roleLabel}</strong>
              </div>
              <div>
                <small>Status</small>
                <strong className="organization-workspace-status">Active</strong>
              </div>
              <div>
                <small>Workspace</small>
                <strong>{membership.organization.slug}</strong>
              </div>
            </section>

            <section className="organization-workspace-panel">
              <div>
                <span>Access granted</span>
                <h2>Organization onboarding accepted</h2>
                <p>
                  This workspace is available through your active organization
                  membership.
                </p>
              </div>
              <button type="button" onClick={onViewApplications}>
                View organization requests
              </button>
            </section>

            <section className="organization-workspace-overview" aria-label="Workspace tools">
              <button
                type="button"
                className="organization-workspace-tool-card"
                onClick={() => setActiveTab("incident-discovery")}
              >
                <span className="organization-workspace-tool-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                    <path d="M12 7v6M12 17h.01" />
                  </svg>
                </span>
                <span className="organization-workspace-tool-copy">
                  <small>Incident discovery</small>
                  <strong>Available now</strong>
                  <span>Search covered reports and review them by GN Division.</span>
                </span>
                <span className="organization-workspace-tool-action" aria-hidden="true">
                  Open <b>→</b>
                </span>
              </button>
              {membership.role === "ORG_ADMIN" && (
                <button type="button" className="organization-workspace-tool-card" onClick={() => setActiveTab("members")}>
                  <span className="organization-workspace-tool-icon" aria-hidden="true">M</span>
                  <span className="organization-workspace-tool-copy"><small>Membership administration</small><strong>Members and requests</strong><span>Review requests and manage roles for this organization.</span></span>
                  <span className="organization-workspace-tool-action" aria-hidden="true">Open →</span>
                </button>
              )}
              {membership.role === "ORG_ADMIN" && (
                <button
                  type="button"
                  className="organization-workspace-tool-card"
                  onClick={() => {
                    setLinkedIncidentId(undefined);
                    setActiveTab("event-drafts");
                  }}
                >
                  <span className="organization-workspace-tool-icon" aria-hidden="true">+</span>
                  <span className="organization-workspace-tool-copy">
                    <small>Cleanup-event planning</small>
                    <strong>Draft workspace</strong>
                    <span>Create private plans, sessions, and coordinator assignments.</span>
                  </span>
                  <span className="organization-workspace-tool-action" aria-hidden="true">Open →</span>
                </button>
              )}
              <button type="button" className="organization-workspace-tool-card" onClick={() => setActiveTab("events")}>
                <span className="organization-workspace-tool-icon" aria-hidden="true">✓</span>
                <span className="organization-workspace-tool-copy"><small>Cleanup events</small><strong>Lifecycle overview</strong><span>See this organization’s private drafts and published events.</span></span>
                <span className="organization-workspace-tool-action" aria-hidden="true">Open →</span>
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
