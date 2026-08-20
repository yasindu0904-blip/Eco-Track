import { useEffect, useState } from "react";

import { describeApiFailure } from "../../../api/apiError";
import { MembershipAdministrationPage } from "./MembershipAdministrationPage";
import { listMyActiveOrganizationMemberships } from "./membershipAdministration.api";
import type { ActiveOrganizationMembership } from "./membershipAdministration.types";
import "./membershipAdministration.css";

type Props = {
  accessToken: string;
  onBack: () => void;
  onOpenWorkspace: (organizationId: string) => void;
};

export function OrganizationMembershipWorkspacesPage({
  accessToken,
  onBack,
  onOpenWorkspace,
}: Props) {
  const [memberships, setMemberships] = useState<ActiveOrganizationMembership[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedAdminMembership, setSelectedAdminMembership] =
    useState<ActiveOrganizationMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void listMyActiveOrganizationMemberships(accessToken)
      .then((page) => {
        if (!active) return;
        setMemberships(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setError(
          describeApiFailure(
            caughtError,
            "Unable to load your organization workspaces.",
          ).message,
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const page = await listMyActiveOrganizationMemberships(accessToken);
      setMemberships(page.items);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(
        describeApiFailure(
          caughtError,
          "Unable to load your organization workspaces.",
        ).message,
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const page = await listMyActiveOrganizationMemberships(
        accessToken,
        nextCursor,
      );
      setMemberships((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(
        describeApiFailure(
          caughtError,
          "Unable to load more organization workspaces.",
        ).message,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (selectedAdminMembership) {
    return (
      <MembershipAdministrationPage
        accessToken={accessToken}
        organizationId={selectedAdminMembership.organization.id}
        organizationName={selectedAdminMembership.organization.name}
        onBack={() => setSelectedAdminMembership(null)}
      />
    );
  }

  return (
    <main className="membership-admin-page">
      <header className="membership-admin-header">
        <div>
          <span>Verified organization access</span>
          <h1>Organization workspaces</h1>
          <p>
            Choose an active organization. Your permissions are checked again
            by the backend for the selected workspace.
          </p>
        </div>
        <button className="ma-button ma-secondary" type="button" onClick={onBack}>
          Back to citizen dashboard
        </button>
      </header>

      {error && (
        <p className="ma-notice ma-error" role="alert">
          {error}
        </p>
      )}

      <section className="ma-card" aria-labelledby="workspace-list-heading">
        <div className="ma-section-heading">
          <div>
            <h2 id="workspace-list-heading">Your active memberships</h2>
            <p>
              Organization roles stay isolated. Admin access in one organization
              never grants admin access in another.
            </p>
          </div>
          <button
            className="ma-button ma-secondary"
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="ma-list" aria-busy={loading}>
          {memberships.map((membership) => (
            <article className="ma-member" key={membership.membershipId}>
              <div className="ma-person">
                <div>
                  <h3>{membership.organization.name}</h3>
                  <p>{membership.organization.slug}</p>
                </div>
                <div className="ma-chips">
                  <span>
                    {membership.role === "ORG_ADMIN"
                      ? "Organization Admin"
                      : "Organization Member"}
                  </span>
                  <span className="ma-status-active">ACTIVE</span>
                </div>
              </div>

              <div className="ma-actions">
                <button
                  className="ma-button ma-secondary"
                  type="button"
                  onClick={() => onOpenWorkspace(membership.organization.id)}
                >
                  Open organization workspace
                </button>
                {membership.role === "ORG_ADMIN" ? (
                  <button
                    className="ma-button ma-primary"
                    type="button"
                    onClick={() => setSelectedAdminMembership(membership)}
                  >
                    Manage members and requests
                  </button>
                ) : (
                <p>
                  This membership does not grant membership-administration
                  access. You can still open the member workspace.
                </p>
                )}
              </div>
            </article>
          ))}

          {!loading && memberships.length === 0 && (
            <p className="ma-empty">
              You do not currently have an active organization membership.
            </p>
          )}
        </div>

        {nextCursor && (
          <button
            className="ma-button ma-secondary"
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading..." : "Load more workspaces"}
          </button>
        )}
      </section>
    </main>
  );
}
