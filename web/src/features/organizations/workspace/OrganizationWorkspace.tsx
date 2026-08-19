import { useState } from "react";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import type { ActiveOrganizationMembership } from "../../memberships/administration/membershipAdministration.types";
import { CleanupEventDraftEditor } from "../../cleanup-events";

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
}: OrganizationWorkspaceProps) {
  const [activeTab, setActiveTab] =
    useState<"overview" | "incident-discovery" | "event-drafts">("overview");
  const [linkedIncidentId, setLinkedIncidentId] = useState<string>();
  const membership =
    memberships.find(
      (item) => item.organization.id === selectedOrganizationId,
    ) ?? memberships[0];

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
        </nav>

        {activeTab === "event-drafts" ? (
          <CleanupEventDraftEditor
            key={`${membership.organization.id}-${linkedIncidentId ?? "direct"}`}
            accessToken={accessToken}
            organizationId={membership.organization.id}
            incidentId={linkedIncidentId}
            onBack={() => {
              setLinkedIncidentId(undefined);
              setActiveTab("overview");
            }}
          />
        ) : activeTab === "incident-discovery" ? (
          <OrganizationIncidentDiscovery
            key={membership.organization.id}
            accessToken={accessToken}
            organizationId={membership.organization.id}
            onCreateDraftFromIncident={membership.role === "ORG_ADMIN" ? (incidentId) => {
              setLinkedIncidentId(incidentId);
              setActiveTab("event-drafts");
            } : undefined}
          />
        ) : (
          <>
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
            </section>
          </>
        )}
      </main>
    </div>
  );
}
