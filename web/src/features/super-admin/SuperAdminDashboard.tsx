import { useEffect, useState } from "react";
import { useCallback } from "react";
import { getPlatformSummary } from "../dashboards/dashboard.api";
import { SummaryPanel } from "../dashboards/SummaryPanel";
import { total } from "../dashboards/dashboard.utils";

import type { AuthenticatedUserProfile } from "../auth/auth.types";
import { NotificationButton } from "../notifications/NotificationButton";
import {
  approveOrganizationApplication,
  declineOrganizationApplication,
  listPendingOrganizationApplications,
} from "./organizationReview.api";
import type { OrganizationReviewApplication } from "./organizationReview.types";
import "./superAdminDashboard.css";
import { SuperAdminMapOverview } from "./SuperAdminMapOverview";

interface SuperAdminDashboardProps {
  profile: AuthenticatedUserProfile;
  accessToken?: string;
  onOpenNotifications?: () => void;
  onSignOut: () => void;
}

type DashboardIconName =
  | "shield"
  | "check";

interface DashboardIconProps {
  name: DashboardIconName;
}

function DashboardIcon({ name }: DashboardIconProps) {
  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4.5 6v5c0 4.8 3 8.3 7.5 10 4.5-1.7 7.5-5.2 7.5-10V6L12 3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function SidebarBullet() {
  return <span className="super-admin-nav-bullet" aria-hidden="true" />;
}

function formatAccountStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function SuperAdminDashboard({
  profile,
  accessToken,
  onOpenNotifications,
  onSignOut,
}: SuperAdminDashboardProps) {
  const [applications, setApplications] = useState<OrganizationReviewApplication[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState<
    "loading" | "ready" | "submitting" | "error"
  >(accessToken ? "loading" : "ready");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const selectedApplication = applications.find(
    (application) => application.id === selectedApplicationId,
  ) ?? applications[0] ?? null;
  const loadPlatformSummary = useCallback(() => getPlatformSummary(accessToken!), [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isActive = true;

    void listPendingOrganizationApplications(accessToken)
      .then((loadedApplications) => {
        if (isActive) {
          setApplications(loadedApplications);
          setSelectedApplicationId(loadedApplications[0]?.id ?? null);
          setReviewStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setReviewStatus("error");
          setReviewMessage(
            error instanceof Error ? error.message : "Unable to load applications.",
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  async function handleReview(decision: "APPROVE" | "DECLINE"): Promise<void> {
    if (!accessToken || !selectedApplication) {
      return;
    }

    if (decision === "DECLINE" && reviewNotes.trim().length < 3) {
      setReviewMessage("Enter a decline reason of at least 3 characters.");
      return;
    }

    setReviewStatus("submitting");
    setReviewMessage(null);

    try {
      if (decision === "APPROVE") {
        await approveOrganizationApplication(
          accessToken,
          selectedApplication.id,
          reviewNotes,
        );
      } else {
        await declineOrganizationApplication(
          accessToken,
          selectedApplication.id,
          reviewNotes.trim(),
        );
      }

      const remaining = applications.filter(
        (application) => application.id !== selectedApplication.id,
      );
      setApplications(remaining);
      setSelectedApplicationId(remaining[0]?.id ?? null);
      setReviewNotes("");
      setReviewStatus("ready");
      setReviewMessage(
        decision === "APPROVE"
          ? "Organization approved and first Organization Admin created."
          : "Organization application declined.",
      );
    } catch (error) {
      setReviewStatus("error");
      setReviewMessage(
        error instanceof Error ? error.message : "Unable to review the application.",
      );
    }
  }

  const displayName = profile.fullName ?? "EcoTrack Super Admin";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="super-admin-shell">
      <aside className="super-admin-sidebar">
        <div className="super-admin-brand">
          <span className="super-admin-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <path className="super-admin-brand-stem" d="M32 48V24" />
              <path
                className="super-admin-brand-leaf"
                d="M31 27C18 28 11 20 10 10c12-1 21 4 23 15"
              />
              <path
                className="super-admin-brand-leaf super-admin-brand-leaf-right"
                d="M33 30c12 0 20-7 21-17-11-2-20 3-23 14"
              />
              <path
                className="super-admin-brand-soil"
                d="M18 53c2-9 7-14 14-14s12 5 14 14H18Z"
              />
            </svg>
          </span>
          <span>
            <strong>EcoTrack</strong>
            <small>Platform console</small>
          </span>
        </div>

        <nav className="super-admin-navigation" aria-label="Platform navigation">
          <button
            className="super-admin-nav-item super-admin-nav-item-active"
            type="button"
            aria-current="page"
          >
            <SidebarBullet />
            Overview
          </button>
          <button
            className="super-admin-nav-item"
            type="button"
            onClick={() => {
              document.getElementById("organization-reviews")?.scrollIntoView({
                behavior: "smooth",
              });
            }}
          >
            <SidebarBullet />
            Organization reviews
            <span>{applications.length}</span>
          </button>
          <button className="super-admin-nav-item" type="button" disabled>
            <SidebarBullet />
            Service areas
            <span>Next</span>
          </button>
          {onOpenNotifications && (
            <NotificationButton
              accessToken={accessToken}
              onOpen={onOpenNotifications}
            />
          )}
        </nav>

        <div className="super-admin-security-note">
          <DashboardIcon name="shield" />
          <div>
            <strong>Protected console</strong>
            <p>Supabase authentication and CASL permissions secure this area.</p>
          </div>
        </div>

        <button
          className="super-admin-sign-out"
          type="button"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </aside>

      <main className="super-admin-main">
        {accessToken && <SummaryPanel load={loadPlatformSummary} label="Platform summary">{(summary) => (
          <section className="super-admin-metrics" aria-label="Platform aggregates">
            <article><small>Active users</small><strong>{summary.users.active}</strong><p>{summary.users.total} total</p></article>
            <article><small>Organizations</small><strong>{total(summary.organizationsByState)}</strong><p>{summary.pendingOrganizationApplications} pending</p></article>
            <article><small>Incidents</small><strong>{total(summary.incidentsByState)}</strong></article>
            <article><small>Cleanup events</small><strong>{total(summary.eventsByLifecycle)}</strong></article>
          </section>
        )}</SummaryPanel>}
        <header className="super-admin-header">
          <div>
            <span className="super-admin-eyebrow">Platform overview</span>
            <h1>Good to see you, {displayName}</h1>
            <p>
              Review organization applications and monitor platform activity.
            </p>
          </div>

          <div className="super-admin-identity">
            <span className="super-admin-avatar" aria-hidden="true">
              {initial}
            </span>
            <span>
              <strong>{displayName}</strong>
              <small>Super Admin</small>
            </span>
          </div>
        </header>

        <div className="super-admin-content-grid">
          <section className="super-admin-review-card" id="organization-reviews">
            <div className="super-admin-section-heading">
              <div>
                <span className="super-admin-eyebrow">Review workspace</span>
                <h2>Organization applications</h2>
              </div>
              <div className="super-admin-review-heading-actions">
                <span className="super-admin-coming-badge">
                  {applications.length} pending
                </span>
                <button
                  className="super-admin-refresh-button"
                  type="button"
                  disabled={reviewStatus === "loading" || reviewStatus === "submitting"}
                  onClick={() => {
                    if (!accessToken) return;
                    setReviewStatus("loading");
                    setReviewMessage(null);
                    void listPendingOrganizationApplications(accessToken)
                      .then((loadedApplications) => {
                        setApplications(loadedApplications);
                        setSelectedApplicationId(loadedApplications[0]?.id ?? null);
                        setReviewStatus("ready");
                      })
                      .catch((error: unknown) => {
                        setReviewStatus("error");
                        setReviewMessage(
                          error instanceof Error ? error.message : "Unable to load applications.",
                        );
                      });
                  }}
                  aria-label="Refresh organization applications"
                  title="Refresh organization applications"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 6v5h-5" />
                    <path d="M4 18v-5h5" />
                    <path d="M6.1 9a7 7 0 0 1 11.6-2.6L20 11" />
                    <path d="m4 13 2.3 4.6A7 7 0 0 0 17.9 15" />
                  </svg>
                </button>
              </div>
            </div>

            {reviewMessage && (
              <div
                className={`super-admin-review-message ${reviewStatus === "error" ? "error" : "success"}`}
                role={reviewStatus === "error" ? "alert" : "status"}
              >
                {reviewMessage}
              </div>
            )}

            {reviewStatus === "loading" ? (
              <div className="super-admin-empty-state">
                <h3>Loading pending applications…</h3>
              </div>
            ) : !accessToken ? (
              <div className="super-admin-empty-state">
                <h3>Preview mode</h3>
                <p>Sign in as a real Super Admin to load and review applications.</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="super-admin-empty-state">
                <span className="super-admin-empty-icon" aria-hidden="true">
                  <DashboardIcon name="check" />
                </span>
                <h3>No pending applications</h3>
                <p>New citizen organization applications will appear here.</p>
              </div>
            ) : (
              <div className="super-admin-review-workspace">
                <div className="super-admin-review-list" aria-label="Pending applications">
                  {applications.map((application) => (
                    <button
                      type="button"
                      key={application.id}
                      className={
                        application.id === selectedApplication?.id
                          ? "selected"
                          : ""
                      }
                      onClick={() => {
                        setSelectedApplicationId(application.id);
                        setReviewNotes("");
                        setReviewMessage(null);
                      }}
                    >
                      <strong>{application.name}</strong>
                      <span>{application.requester.fullName ?? application.requester.email}</span>
                      <small>
                        {application.serviceAreas.length} GN {application.serviceAreas.length === 1 ? "Division" : "Divisions"}
                      </small>
                    </button>
                  ))}
                </div>

                {selectedApplication && (
                  <article className="super-admin-review-detail">
                    <div className="super-admin-review-detail-heading">
                      <div>
                        <span>Submitted {new Date(selectedApplication.createdAt).toLocaleDateString()}</span>
                        <h3>{selectedApplication.name}</h3>
                      </div>
                      <span>Pending review</span>
                    </div>

                    <p>{selectedApplication.description ?? "No description provided."}</p>

                    <dl>
                      <div><dt>Requester</dt><dd>{selectedApplication.requester.fullName ?? selectedApplication.requester.email}</dd></div>
                      <div><dt>Registration</dt><dd>{selectedApplication.registrationNumber ?? "Not provided"}</dd></div>
                      <div><dt>Official email</dt><dd>{selectedApplication.officialEmail}</dd></div>
                      <div><dt>Official phone</dt><dd>{selectedApplication.officialPhone}</dd></div>
                      <div className="wide"><dt>Address</dt><dd>{selectedApplication.officialAddress}</dd></div>
                    </dl>

                    <div className="super-admin-review-areas">
                      <strong>Requested GN Divisions</strong>
                      <div>
                        {selectedApplication.serviceAreas.map((area) => (
                          <span key={area.id}>
                            {area.name}
                            <small>
                              {[area.divisionalSecretariatName, area.districtName]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                        ))}
                      </div>
                    </div>

                    <label className="super-admin-review-notes">
                      Review notes
                      <textarea
                        rows={4}
                        maxLength={2000}
                        value={reviewNotes}
                        onChange={(event) => setReviewNotes(event.target.value)}
                        placeholder="Required when declining; optional when approving."
                      />
                    </label>

                    <div className="super-admin-review-actions">
                      <button
                        className="decline"
                        type="button"
                        disabled={reviewStatus === "submitting"}
                        onClick={() => void handleReview("DECLINE")}
                      >
                        Decline
                      </button>
                      <button
                        className="approve"
                        type="button"
                        disabled={reviewStatus === "submitting"}
                        onClick={() => void handleReview("APPROVE")}
                      >
                        {reviewStatus === "submitting" ? "Saving decision…" : "Approve organization"}
                      </button>
                    </div>
                  </article>
                )}
              </div>
            )}
          </section>

          <aside className="super-admin-account-card">
            <div className="super-admin-section-heading">
              <div>
                <span className="super-admin-eyebrow">Signed-in account</span>
                <h2>Account details</h2>
              </div>
            </div>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>Platform role</dt>
                <dd>Super Admin</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>
                  <span className="super-admin-account-status">
                    {formatAccountStatus(profile.accountStatus)}
                  </span>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
        {accessToken && <SuperAdminMapOverview accessToken={accessToken} />}
      </main>
    </div>
  );
}
