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
          <button
            type="button"
            className={activeTab === "incident-review" ? "is-active" : undefined}
            onClick={() => setActiveTab("incident-review")}
          >
            Incident review
          </button>
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
          </>
        )}
      </main>
    </div>
  );
}
