import { lazy, useCallback, useEffect, useRef, useState } from "react";

import type { AuthenticatedUserProfile } from "../features/auth/auth.types";
import { CitizenDashboard } from "../features/citizen/CitizenDashboard";
import { CitizenSidebar } from "../features/citizen/CitizenSidebar";
import { listMyActiveOrganizationMemberships } from "../features/memberships/administration/membershipAdministration.api";
import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import { isUserDestination, useBrowserNavigation, type UserDestination } from "./navigation";
import { resolveUserNotificationDestination } from "./notificationDestination";
import { RouteBoundary } from "./RouteBoundary";

const NotificationInbox = lazy(() => import("../features/notifications/NotificationInbox").then(
  (module) => ({ default: module.NotificationInbox }),
));
const MembershipSelfServicePage = lazy(() => import("../features/memberships/MembershipSelfServicePage").then(
  (module) => ({ default: module.MembershipSelfServicePage }),
));
const OrganizationMembershipWorkspacesPage = lazy(() => import("../features/memberships/administration/OrganizationMembershipWorkspacesPage").then(
  (module) => ({ default: module.OrganizationMembershipWorkspacesPage }),
));
const OrganizationApplicationPage = lazy(() => import("../features/organizations/application/OrganizationApplicationPage").then(
  (module) => ({ default: module.OrganizationApplicationPage }),
));
const OrganizationWorkspace = lazy(() => import("../features/organizations/workspace/OrganizationWorkspace").then(
  (module) => ({ default: module.OrganizationWorkspace }),
));
const IncidentPage = lazy(() => import("../features/incidents/IncidentPage").then(
  (module) => ({ default: module.IncidentPage }),
));
const PublicCleanupEventsPage = lazy(() => import("../features/cleanup-events/PublicCleanupEventsPage").then(
  (module) => ({ default: module.PublicCleanupEventsPage }),
));
const MyJoinedCleanupEventsPage = lazy(() => import("../features/cleanup-events/MyJoinedCleanupEventsPage").then(
  (module) => ({ default: module.MyJoinedCleanupEventsPage }),
));
const MyImpactPage = lazy(() => import("../features/rewards/MyImpactPage").then(
  (module) => ({ default: module.MyImpactPage }),
));

const personalDashboard: UserDestination = { screen: "dashboard" };

type Props = {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  onProfileUpdated: (profile: AuthenticatedUserProfile) => void;
  onSignOut: () => Promise<void> | void;
};

export function AuthenticatedUserApp({
  profile,
  accessToken,
  onProfileUpdated,
  onSignOut,
}: Props) {
  const { destination, navigate, back } = useBrowserNavigation(
    personalDashboard,
    isUserDestination,
  );
  const [memberships, setMemberships] =
    useState<ActiveOrganizationMembership[]>([]);
  const membershipRequestVersion = useRef(0);

  const reloadMemberships = useCallback(async () => {
    const requestVersion = ++membershipRequestVersion.current;

    try {
      const items: ActiveOrganizationMembership[] = [];
      let cursor: string | undefined;

      do {
        const page = await listMyActiveOrganizationMemberships(
          accessToken,
          cursor,
        );
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);

      if (membershipRequestVersion.current === requestVersion) {
        setMemberships(items);
      }
    } catch {
      if (membershipRequestVersion.current === requestVersion) {
        setMemberships([]);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void reloadMemberships();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      membershipRequestVersion.current += 1;
    };
  }, [reloadMemberships]);

  const signOut = async () => {
    membershipRequestVersion.current += 1;
    setMemberships([]);
    navigate(personalDashboard, true);
    await onSignOut();
  };

  const activeMembership = destination.screen === "organization-workspace"
    ? memberships.find(
      (membership) =>
        membership.organization.id === destination.organizationId,
    )
    : undefined;
  const firstMembership = memberships[0];

  let content;

  if (destination.screen === "notifications") {
    content = (
      <NotificationInbox
        accessToken={accessToken}
        onBack={() => back(personalDashboard)}
        onNavigateNotification={(notification) => {
          const next = resolveUserNotificationDestination(
            notification,
            memberships,
          );
          if (!next) return false;
          navigate(next);
          return true;
        }}
      />
    );
  } else if (destination.screen === "membership") {
    content = (
      <MembershipSelfServicePage
        accessToken={accessToken}
        profile={profile}
        onProfileUpdated={onProfileUpdated}
        onBack={() => {
          navigate(personalDashboard);
          void reloadMemberships();
        }}
      />
    );
  } else if (destination.screen === "organization-workspaces") {
    content = (
      <OrganizationMembershipWorkspacesPage
        accessToken={accessToken}
        onBack={() => navigate(personalDashboard)}
        onOpenWorkspace={(organizationId) => navigate({
          screen: "organization-workspace",
          organizationId,
        })}
      />
    );
  } else if (
    destination.screen === "organization-apply" ||
    destination.screen === "organization-applications"
  ) {
    content = (
      <OrganizationApplicationPage
        key={destination.screen}
        accessToken={accessToken}
        profile={profile}
        initialView={destination.screen === "organization-applications"
          ? "applications"
          : "apply"}
        onBackToDashboard={() => {
          navigate(personalDashboard);
          void reloadMemberships();
        }}
        onSignOut={() => void signOut()}
      />
    );
  } else if (destination.screen === "organization-workspace") {
    content = activeMembership ? (
      <OrganizationWorkspace
        key={`${destination.organizationId}-${destination.tab ?? "overview"}-${destination.incidentId ?? ""}-${destination.eventId ?? ""}`}
        profile={profile}
        accessToken={accessToken}
        memberships={memberships}
        selectedOrganizationId={destination.organizationId}
        initialTab={destination.tab}
        initialIncidentId={destination.incidentId}
        initialEventId={destination.eventId}
        onSelectOrganization={(organizationId) => navigate({
          screen: "organization-workspace",
          organizationId,
        }, true)}
        onBackToDashboard={() => navigate(personalDashboard)}
        onViewApplications={() => navigate({
          screen: "organization-applications",
        })}
        onSignOut={() => void signOut()}
      />
    ) : (
      <main className="app-shell">
        <section className="auth-card">
          <div className="auth-card-content auth-state" role="alert">
            <h2>Organization access is unavailable</h2>
            <p>Your active memberships changed or this workspace is no longer available.</p>
            <button className="button button-primary" type="button" onClick={() => navigate(personalDashboard, true)}>
              Return to personal dashboard
            </button>
          </div>
        </section>
      </main>
    );
  } else if (
    destination.screen === "incident-create" ||
    destination.screen === "incident-reports" ||
    destination.screen === "incident-discovery"
  ) {
    content = (
      <IncidentPage
        accessToken={accessToken}
        profile={profile}
        initialView={destination.screen === "incident-reports"
          ? "reports"
          : destination.screen === "incident-discovery"
            ? "discover"
            : "create"}
        initialIncidentId={destination.screen === "incident-reports"
          ? destination.incidentId
          : undefined}
        onBackToDashboard={() => navigate(personalDashboard)}
        onOpenCleanupEvent={(eventId) => navigate({
          screen: "cleanup-events",
          eventId,
        })}
        onSignOut={() => void signOut()}
      />
    );
  } else if (destination.screen === "cleanup-events") {
    content = (
      <PublicCleanupEventsPage
        accessToken={accessToken}
        initialEventId={destination.eventId}
        onBack={() => navigate(personalDashboard)}
      />
    );
  } else if (destination.screen === "joined-cleanup-events") {
    content = (
      <MyJoinedCleanupEventsPage
        accessToken={accessToken}
        onBack={() => navigate(personalDashboard)}
        onOpenEvent={(eventId) => navigate({
          screen: "cleanup-events",
          eventId,
        })}
      />
    );
  } else if (destination.screen === "impact") {
    content = (
      <MyImpactPage
        accessToken={accessToken}
        onBack={() => navigate(personalDashboard)}
      />
    );
  } else {
    content = (
      <CitizenDashboard
        profile={profile}
        accessToken={accessToken}
        onManageMembership={() => navigate({ screen: "membership" })}
        onOpenOrganizationWorkspaces={() => navigate({
          screen: "organization-workspaces",
        })}
        activeOrganization={firstMembership}
        onOpenOrganizationWorkspace={firstMembership
          ? () => navigate({
            screen: "organization-workspace",
            organizationId: firstMembership.organization.id,
          })
          : undefined}
        onStartOrganizationApplication={() => navigate({
          screen: "organization-apply",
        })}
        onViewOrganizationApplications={() => navigate({
          screen: "organization-applications",
        })}
        onReportIncident={() => navigate({ screen: "incident-create" })}
        onViewIncidentReports={() => navigate({ screen: "incident-reports" })}
        onFindCleanupActivity={() => navigate({ screen: "incident-discovery" })}
        onBrowseCleanupEvents={() => navigate({ screen: "cleanup-events" })}
        onViewJoinedCleanupEvents={() => navigate({
          screen: "joined-cleanup-events",
        })}
        onOpenImpact={() => navigate({ screen: "impact" })}
      />
    );
  }

  return (
    <div className="citizen-dashboard-shell">
      <CitizenSidebar
        profile={profile}
        accessToken={accessToken}
        activeScreen={destination.screen}
        activeOrganization={firstMembership}
        onDashboard={() => navigate(personalDashboard)}
        onOpenNotifications={() => navigate({ screen: "notifications" })}
        onManageMembership={() => navigate({ screen: "membership" })}
        onOpenOrganizationWorkspaces={() => navigate({
          screen: "organization-workspaces",
        })}
        onOpenOrganizationWorkspace={firstMembership
          ? () => navigate({
            screen: "organization-workspace",
            organizationId: firstMembership.organization.id,
          })
          : undefined}
        onViewOrganizationApplications={() => navigate({
          screen: "organization-applications",
        })}
        onReportIncident={() => navigate({ screen: "incident-create" })}
        onViewIncidentReports={() => navigate({ screen: "incident-reports" })}
        onFindCleanupActivity={() => navigate({ screen: "incident-discovery" })}
        onBrowseCleanupEvents={() => navigate({ screen: "cleanup-events" })}
        onViewJoinedCleanupEvents={() => navigate({
          screen: "joined-cleanup-events",
        })}
        onOpenImpact={() => navigate({ screen: "impact" })}
        onSignOut={() => void signOut()}
      />
      <RouteBoundary resetKey={JSON.stringify(destination)}>
        {content}
      </RouteBoundary>
    </div>
  );
}
