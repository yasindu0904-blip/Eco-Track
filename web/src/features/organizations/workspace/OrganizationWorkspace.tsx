import { useState } from "react";

import type {
  ActiveOrganizationMembership,
  AuthenticatedUserProfile,
} from "../../auth/auth.types";

import "./organizationWorkspace.css";
import { OrganizationIncidentReview } from "./OrganizationIncidentReview";

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
    useState<"overview" | "incident-review">("overview");
  const membership =
    memberships.find(
      (item) => item.organizationId === selectedOrganizationId,
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
            <h1>{membership.organizationName}</h1>
            <p>{profile.email}</p>
          </div>

          {memberships.length > 1 && (
            <label>
              Active organization
              <select
                value={membership.organizationId}
                onChange={(event) =>
                  onSelectOrganization(event.target.value)
                }
              >
                {memberships.map((item) => (
                  <option
                    key={item.organizationId}
                    value={item.organizationId}
                  >
                    {item.organizationName}
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
          {activeTab === "incident-review" && (
            <span aria-current="page">/ Incident review</span>
          )}
        </nav>

        {activeTab === "incident-review" ? (
          <OrganizationIncidentReview
            key={membership.organizationId}
            accessToken={accessToken}
            organizationId={membership.organizationId}
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
                <strong>{membership.organizationSlug}</strong>
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
                onClick={() => setActiveTab("incident-review")}
              >
                <span className="organization-workspace-tool-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                    <path d="M12 7v6M12 17h.01" />
                  </svg>
                </span>
                <span className="organization-workspace-tool-copy">
                  <small>Incident review</small>
                  <strong>Available now</strong>
                  <span>Search covered reports and review them by GN Division.</span>
                </span>
                <span className="organization-workspace-tool-action" aria-hidden="true">
                  Open <b>→</b>
                </span>
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
