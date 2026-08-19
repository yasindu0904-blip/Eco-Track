import { useCallback, useEffect, useRef, useState } from "react";

import "./App.css";

import { hasCompletedProfile } from "./authorization/authorizationUi";
import { LoginForm } from "./features/auth/LoginForm";
import { ProfileOnboarding } from "./features/auth/ProfileOnboarding";
import { useAuthentication } from "./features/auth/useAuthentication";
import { CitizenDashboard } from "./features/citizen/CitizenDashboard";
import { IncidentPage } from "./features/incidents";
import { NotificationInbox } from "./features/notifications/NotificationInbox";
import {
  MembershipSelfServicePage,
  OrganizationMembershipWorkspacesPage,
} from "./features/memberships";
import { listMyActiveOrganizationMemberships } from "./features/memberships/administration/membershipAdministration.api";
import type { ActiveOrganizationMembership } from "./features/memberships/administration/membershipAdministration.types";
import { MapFoundationPreview } from "./features/maps";
import { OrganizationApplicationPage } from "./features/organizations/application";
import { OrganizationWorkspace } from "./features/organizations/workspace/OrganizationWorkspace";
import { SuperAdminDashboard } from "./features/super-admin/SuperAdminDashboard";
import { MyImpactPage } from "./features/rewards";
import { MyJoinedCleanupEventsPage, PublicCleanupEventsPage } from "./features/cleanup-events";

const previewSuperAdminProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "superadmin@ecotrack.local",
  fullName: "EcoTrack Super Admin",
  phoneNumber: null,
  profileCompletedAt: null,
  platformRole: "SUPER_ADMIN",
  accountStatus: "ACTIVE",
} as const;

const previewCitizenProfile = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "citizen@ecotrack.local",
  fullName: "EcoTrack Citizen",
  phoneNumber: null,
  profileCompletedAt: null,
  platformRole: "USER",
  accountStatus: "ACTIVE",
} as const;

type CitizenView =
  | "dashboard"
  | "membership"
  | "organization-workspaces"
  | "organization-apply"
  | "organization-applications"
  | "organization-workspace"
  | "incident-create"
  | "incident-reports"
  | "incident-discovery"
  | "cleanup-events"
  | "joined-cleanup-events"
  | "impact";

function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="presentation">
          <path
            className="brand-stem"
            d="M32 48V24"
          />
          <path
            className="brand-leaf"
            d="M31 27C18 28 11 20 10 10c12-1 21 4 23 15"
          />
          <path
            className="brand-leaf brand-leaf-right"
            d="M33 30c12 0 20-7 21-17-11-2-20 3-23 14"
          />
          <path
            className="brand-soil"
            d="M18 53c2-9 7-14 14-14s12 5 14 14H18Z"
          />
        </svg>
      </div>

      <h1>EcoTrack</h1>
      <p>Community-Driven Environmental Action</p>
    </header>
  );
}

function LoadingState() {
  return (
    <section
      className="auth-state auth-state-loading"
      aria-live="polite"
    >
      <span className="loading-spinner" aria-hidden="true" />
      <h2>Securing your session</h2>
      <p>Please wait while EcoTrack verifies your sign-in.</p>
    </section>
  );
}

interface AuthenticationErrorProps {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}

function AuthenticationError({
  message,
  onRetry,
  onSignOut,
}: AuthenticationErrorProps) {
  return (
    <section className="auth-state" role="alert">
      <div className="state-icon state-icon-error" aria-hidden="true">
        !
      </div>
      <h2>We could not complete sign-in</h2>
      <p>{message}</p>

      <div className="button-stack">
        <button
          className="button button-primary"
          type="button"
          onClick={onRetry}
        >
          Try again
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onSignOut}
        >
          Return to sign in
        </button>
      </div>
    </section>
  );
}

function App() {
  const [citizenView, setCitizenView] =
    useState<CitizenView>("dashboard");
  const [showNotifications, setShowNotifications] =
    useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState("");
  const [activeMemberships, setActiveMemberships] =
    useState<ActiveOrganizationMembership[]>([]);
  const [selectedCleanupEventId, setSelectedCleanupEventId] = useState<string>();
  const membershipRequestVersion = useRef(0);

  const {
    status,
    profile,
    accessToken,
    errorMessage,
    checkSuperAdminAccess,
    replaceProfile,
    retry,
    signOut,
  } = useAuthentication();

  const reloadActiveMemberships = useCallback(async () => {
    const requestVersion = ++membershipRequestVersion.current;
    await Promise.resolve();
    if (!accessToken || profile?.platformRole !== "USER") {
      if (membershipRequestVersion.current === requestVersion) {
        setActiveMemberships([]);
      }
      return;
    }

    try {
      const items: ActiveOrganizationMembership[] = [];
      let cursor: string | undefined;
      do {
        const page = await listMyActiveOrganizationMemberships(accessToken, cursor);
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      if (membershipRequestVersion.current === requestVersion) {
        setActiveMemberships(items);
      }
    } catch {
      if (membershipRequestVersion.current === requestVersion) {
        setActiveMemberships([]);
      }
    }
  }, [accessToken, profile?.platformRole]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void reloadActiveMemberships();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [reloadActiveMemberships]);

  const searchParameters = new URLSearchParams(window.location.search);

  const isOrganizationPreview =
    import.meta.env.DEV &&
    searchParameters.get("organization-preview") === "1";

  const isSuperAdminPreview =
    import.meta.env.DEV &&
    searchParameters.get("super-admin-preview") === "1";

  const isCitizenPreview =
    import.meta.env.DEV &&
    searchParameters.get("citizen-preview") === "1";

  const isMapPreview =
    import.meta.env.DEV && searchParameters.get("map-preview") === "1";

  if (isMapPreview) {
    return <MapFoundationPreview />;
  }

  if (isSuperAdminPreview) {
    return (
      <SuperAdminDashboard
        profile={previewSuperAdminProfile}
        onCheckAccess={() =>
          Promise.resolve("Preview mode: protected access UI is ready.")
        }
        onSignOut={() => undefined}
      />
    );
  }

  if (isOrganizationPreview) {
    return <OrganizationApplicationPage />;
  }

  if (isCitizenPreview) {
    if (
      citizenView === "incident-create" ||
      citizenView === "incident-reports" ||
      citizenView === "incident-discovery"
    ) {
      return (
        <IncidentPage
          accessToken="preview-token"
          profile={previewCitizenProfile}
          initialView={
            citizenView === "incident-reports"
              ? "reports"
              : citizenView === "incident-discovery"
                ? "discover"
                : "create"
          }
          onBackToDashboard={() => setCitizenView("dashboard")}
        />
      );
    }

    if (citizenView !== "dashboard") {
      return (
        <OrganizationApplicationPage
          key={citizenView}
          profile={previewCitizenProfile}
          initialView={
            citizenView === "organization-applications"
              ? "applications"
              : "apply"
          }
          onBackToDashboard={() => {
            setCitizenView("dashboard");
          }}
        />
      );
    }

    return (
      <CitizenDashboard
        profile={previewCitizenProfile}
        onStartOrganizationApplication={() => {
          setCitizenView("organization-apply");
        }}
        onManageMembership={() => undefined}
        onOpenOrganizationWorkspaces={() => undefined}
        onViewOrganizationApplications={() => {
          setCitizenView("organization-applications");
        }}
        onReportIncident={() => setCitizenView("incident-create")}
        onViewIncidentReports={() => setCitizenView("incident-reports")}
        onFindCleanupActivity={() => setCitizenView("incident-discovery")}
        onBrowseCleanupEvents={() => undefined}
        onViewJoinedCleanupEvents={() => undefined}
        onOpenImpact={() => undefined}
        onSignOut={() => undefined}
      />
    );
  }

  if (status === "signedIn" && profile && accessToken) {
    if (!hasCompletedProfile(profile)) {
      return (
        <main className="app-shell">
          <section className="auth-card">
            <BrandHeader />

            <div className="auth-card-content">
              <ProfileOnboarding
                accessToken={accessToken}
                profile={profile}
                onCompleted={replaceProfile}
                onSignOut={signOut}
              />
            </div>
          </section>
        </main>
      );
    }

    if (showNotifications) {
      return (
        <NotificationInbox
          accessToken={accessToken}
          onBack={() => setShowNotifications(false)}
          onOpenOrganizationApplications={
            profile.platformRole === "USER"
              ? () => {
                  setShowNotifications(false);
                  setCitizenView("organization-applications");
                }
              : undefined
          }
        />
      );
    }

    if (profile.platformRole === "SUPER_ADMIN") {
      return (
        <SuperAdminDashboard
          profile={profile}
          accessToken={accessToken}
          onCheckAccess={checkSuperAdminAccess}
          onOpenNotifications={() => setShowNotifications(true)}
          onSignOut={() => {
            setCitizenView("dashboard");
            setShowNotifications(false);
            signOut();
          }}
        />
      );
    }

    const activeMembership =
      activeMemberships.find(
        (membership) =>
          membership.organization.id === selectedOrganizationId,
      ) ?? activeMemberships[0];

    if (
      citizenView === "dashboard" ||
      (citizenView === "organization-workspace" && !activeMembership)
    ) {
      return (
        <CitizenDashboard
          profile={profile}
          accessToken={accessToken}
          onOpenNotifications={() => setShowNotifications(true)}
          onManageMembership={() => setCitizenView("membership")}
          onOpenOrganizationWorkspaces={() =>
            setCitizenView("organization-workspaces")
          }
          activeOrganization={activeMembership}
          onOpenOrganizationWorkspace={
            activeMembership
              ? () => {
                  setSelectedOrganizationId(
                    activeMembership.organization.id,
                  );
                  setCitizenView("organization-workspace");
                }
              : undefined
          }
          onStartOrganizationApplication={() => {
            setCitizenView("organization-apply");
          }}
          onViewOrganizationApplications={() => {
            setCitizenView("organization-applications");
          }}
          onReportIncident={() => setCitizenView("incident-create")}
          onViewIncidentReports={() => setCitizenView("incident-reports")}
          onFindCleanupActivity={() => setCitizenView("incident-discovery")}
          onBrowseCleanupEvents={() => setCitizenView("cleanup-events")}
          onViewJoinedCleanupEvents={() => setCitizenView("joined-cleanup-events")}
          onOpenImpact={() => setCitizenView("impact")}
          onSignOut={() => {
            setCitizenView("dashboard");
            setShowNotifications(false);
            signOut();
          }}
        />
      );
    }

    if (citizenView === "membership") {
      return (
        <MembershipSelfServicePage
          accessToken={accessToken}
          profile={profile}
          onProfileUpdated={replaceProfile}
          onBack={() => {
            setCitizenView("dashboard");
            void reloadActiveMemberships();
          }}
        />
      );
    }

    if (citizenView === "organization-workspaces") {
      return (
        <OrganizationMembershipWorkspacesPage
          accessToken={accessToken}
          onBack={() => setCitizenView("dashboard")}
        />
      );
    }

    if (citizenView === "impact") {
      return (
        <MyImpactPage
          accessToken={accessToken}
          onBack={() => setCitizenView("dashboard")}
        />
      );
    }

    if (citizenView === "cleanup-events") {
      return <PublicCleanupEventsPage accessToken={accessToken} initialEventId={selectedCleanupEventId} onBack={() => { setSelectedCleanupEventId(undefined); setCitizenView("dashboard"); }} />;
    }

    if (citizenView === "joined-cleanup-events") {
      return <MyJoinedCleanupEventsPage accessToken={accessToken} onBack={() => setCitizenView("dashboard")} onOpenEvent={(eventId) => { setSelectedCleanupEventId(eventId); setCitizenView("cleanup-events"); }} />;
    }

    if (citizenView === "organization-workspace" && activeMembership) {
      return (
        <OrganizationWorkspace
          profile={profile}
          accessToken={accessToken}
          memberships={activeMemberships}
          selectedOrganizationId={activeMembership.organization.id}
          onSelectOrganization={setSelectedOrganizationId}
          onBackToDashboard={() => setCitizenView("dashboard")}
          onViewApplications={() =>
            setCitizenView("organization-applications")
          }
          onSignOut={() => {
            setCitizenView("dashboard");
            setSelectedOrganizationId("");
            signOut();
          }}
        />
      );
    }

    if (
      citizenView === "incident-create" ||
      citizenView === "incident-reports" ||
      citizenView === "incident-discovery"
    ) {
      return (
        <IncidentPage
          accessToken={accessToken}
          profile={profile}
          initialView={
            citizenView === "incident-reports"
              ? "reports"
              : citizenView === "incident-discovery"
                ? "discover"
                : "create"
          }
          onBackToDashboard={() => setCitizenView("dashboard")}
          onSignOut={() => {
            setCitizenView("dashboard");
            signOut();
          }}
        />
      );
    }

    return (
      <OrganizationApplicationPage
        key={citizenView}
        accessToken={accessToken}
        profile={profile}
        initialView={
          citizenView === "organization-applications"
            ? "applications"
            : "apply"
        }
        onBackToDashboard={() => {
          setCitizenView("dashboard");
          void reloadActiveMemberships();
        }}
        onSignOut={() => {
          setCitizenView("dashboard");
          signOut();
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="background-orb background-orb-one" />
      <div className="background-orb background-orb-two" />

      <section className="auth-card">
        <BrandHeader />

        <div className="auth-card-content">
          {status === "loading" && <LoadingState />}

          {status === "signedOut" && <LoginForm />}

          {status === "error" && errorMessage && (
            <AuthenticationError
              message={errorMessage}
              onRetry={retry}
              onSignOut={signOut}
            />
          )}
        </div>
      </section>

      <p className="app-footer">
        Small actions. Shared responsibility. Cleaner communities.
      </p>
    </main>
  );
}

export default App;
