import { useState } from "react";

import type { AuthenticatedUserProfile } from "../auth/auth.types";
import "./superAdminDashboard.css";

interface SuperAdminDashboardProps {
  profile: AuthenticatedUserProfile;
  onCheckAccess: () => Promise<string>;
  onSignOut: () => void;
}

type AccessCheckState =
  | { status: "idle"; message: null }
  | { status: "checking"; message: null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type DashboardIconName =
  | "dashboard"
  | "organization"
  | "shield"
  | "area"
  | "review"
  | "check";

interface DashboardIconProps {
  name: DashboardIconName;
}

function DashboardIcon({ name }: DashboardIconProps) {
  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  if (name === "organization") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 21V7l8-4 8 4v14" />
        <path d="M8 10h2M14 10h2M8 14h2M14 14h2M10 21v-3h4v3" />
      </svg>
    );
  }

  if (name === "area") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 6 5-3 6 3 5-3v15l-5 3-6-3-5 3V6Z" />
        <path d="M9 3v15M15 6v15" />
      </svg>
    );
  }

  if (name === "review") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
        <path d="M9 3h6v4H9zM8 12h8M8 16h5" />
      </svg>
    );
  }

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

function formatAccountStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function SuperAdminDashboard({
  profile,
  onCheckAccess,
  onSignOut,
}: SuperAdminDashboardProps) {
  const [accessCheck, setAccessCheck] =
    useState<AccessCheckState>({
      status: "idle",
      message: null,
    });

  const displayName = profile.fullName ?? "EcoTrack Super Admin";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleAccessCheck(): Promise<void> {
    setAccessCheck({
      status: "checking",
      message: null,
    });

    try {
      const message = await onCheckAccess();

      setAccessCheck({
        status: "success",
        message,
      });
    } catch (error) {
      setAccessCheck({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify Super Admin access.",
      });
    }
  }

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
            <DashboardIcon name="dashboard" />
            Overview
          </button>
          <button className="super-admin-nav-item" type="button" disabled>
            <DashboardIcon name="review" />
            Organization reviews
            <span>Next</span>
          </button>
          <button className="super-admin-nav-item" type="button" disabled>
            <DashboardIcon name="area" />
            Service areas
            <span>Next</span>
          </button>
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
        <header className="super-admin-header">
          <div>
            <span className="super-admin-eyebrow">Platform overview</span>
            <h1>Good to see you, {displayName}</h1>
            <p>
              Review EcoTrack onboarding readiness and protected platform services.
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

        <section className="super-admin-status-grid" aria-label="Platform status">
          <article className="super-admin-status-card">
            <span className="super-admin-status-icon">
              <DashboardIcon name="organization" />
            </span>
            <div>
              <small>Organization intake</small>
              <strong>Live</strong>
              <p>Citizens can submit applications for review.</p>
            </div>
            <span className="super-admin-live-dot" aria-label="Available" />
          </article>

          <article className="super-admin-status-card">
            <span className="super-admin-status-icon">
              <DashboardIcon name="shield" />
            </span>
            <div>
              <small>Authorization</small>
              <strong>CASL active</strong>
              <p>Platform and organization permissions are enforced.</p>
            </div>
            <span className="super-admin-live-dot" aria-label="Available" />
          </article>

          <article className="super-admin-status-card">
            <span className="super-admin-status-icon">
              <DashboardIcon name="area" />
            </span>
            <div>
              <small>Service areas</small>
              <strong>PostGIS ready</strong>
              <p>Submitted boundaries are stored for controlled review.</p>
            </div>
            <span className="super-admin-live-dot" aria-label="Available" />
          </article>
        </section>

        <div className="super-admin-content-grid">
          <section className="super-admin-review-card">
            <div className="super-admin-section-heading">
              <div>
                <span className="super-admin-eyebrow">Review workspace</span>
                <h2>Organization applications</h2>
              </div>
              <span className="super-admin-coming-badge">Review API next</span>
            </div>

            <div className="super-admin-empty-state">
              <span className="super-admin-empty-icon" aria-hidden="true">
                <DashboardIcon name="review" />
              </span>
              <h3>The review queue is being connected</h3>
              <p>
                Applications are already saved as pending review. Member 3's
                review endpoints will supply the live queue, application details,
                approval, and decline actions here.
              </p>
              <button type="button" disabled>
                Open review queue
              </button>
            </div>

            <div className="super-admin-review-steps">
              <div>
                <span>1</span>
                <p>
                  <strong>Check organization details</strong>
                  Confirm official contact and registration information.
                </p>
              </div>
              <div>
                <span>2</span>
                <p>
                  <strong>Review service areas</strong>
                  Confirm requested areas before they become active.
                </p>
              </div>
              <div>
                <span>3</span>
                <p>
                  <strong>Record the decision</strong>
                  Approval creates the first Org Admin; decline records notes.
                </p>
              </div>
            </div>
          </section>

          <aside className="super-admin-side-column">
            <section className="super-admin-access-card">
              <span className="super-admin-access-icon" aria-hidden="true">
                <DashboardIcon name="shield" />
              </span>
              <span className="super-admin-eyebrow">Security check</span>
              <h2>Protected API access</h2>
              <p>
                Verify that the current Supabase session receives Super Admin
                permission from the EcoTrack API.
              </p>

              {accessCheck.message && (
                <div
                  className={`super-admin-access-result super-admin-access-result-${accessCheck.status}`}
                  role={accessCheck.status === "error" ? "alert" : "status"}
                >
                  <DashboardIcon name="check" />
                  {accessCheck.message}
                </div>
              )}

              <button
                type="button"
                disabled={accessCheck.status === "checking"}
                onClick={() => {
                  void handleAccessCheck();
                }}
              >
                {accessCheck.status === "checking"
                  ? "Verifying access..."
                  : "Verify protected access"}
              </button>
            </section>

            <section className="super-admin-account-card">
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
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
