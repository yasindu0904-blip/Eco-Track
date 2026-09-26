import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import type { AuthenticatedUserProfile } from "../auth/auth.types";
import { AppShell } from "../components/AppShell";
import { Button, Notice, Screen, sharedStyles } from "../components/ui";
import { MyJoinedCleanupEventsScreen, PublicCleanupEventsScreen } from "../features/cleanupEvents";
import { CitizenDashboard } from "../features/citizen/CitizenDashboard";
import { CitizenIncidentDiscoveryScreen, IncidentReportScreen, MyReportsScreen } from "../features/incidents";
import type { IncidentDetail } from "../features/incidents/incident.types";
import { MembershipSelfServiceScreen } from "../features/memberships/MembershipSelfServiceScreen";
import { listMyActiveOrganizationMemberships } from "../features/memberships/administration/membershipAdministration.api";
import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import { NotificationInboxScreen } from "../features/notifications/NotificationInboxScreen";
import type { NotificationItem } from "../features/notifications/notification.types";
import { MyOrganizationApplicationsScreen } from "../features/organizations/MyOrganizationApplicationsScreen";
import { OrganizationApplicationScreen } from "../features/organizations/OrganizationApplicationScreen";
import { OrganizationWorkspaceScreen } from "../features/organizations/OrganizationWorkspaceScreen";
import { OrganizationWorkspacesScreen } from "../features/organizations/OrganizationWorkspacesScreen";
import type { OrganizationApplication } from "../features/organizations/organizationApplication.types";
import { MyImpactScreen } from "../features/rewards";
import { mobileDashboard, parentDestination, mobileScreenTitles, type MobileDestination } from "./navigation";
import { resolveMobileNotificationDestination } from "./notificationDestination";
import { useAndroidBackNavigation } from "./useAndroidBackNavigation";

type Props = {
  accessToken: string;
  profile: AuthenticatedUserProfile;
  pushNotification: NotificationItem | null;
  onPushNotificationHandled: () => void;
  onProfileUpdated: (profile: AuthenticatedUserProfile) => void;
  onSignOut: () => Promise<void>;
};

export function AuthenticatedUserApp({ accessToken, profile, pushNotification, onPushNotificationHandled, onProfileUpdated, onSignOut }: Props) {
  const [destination, setDestination] = useState<MobileDestination>(mobileDashboard);
  const [activeMemberships, setActiveMemberships] = useState<ActiveOrganizationMembership[]>([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [membershipsError, setMembershipsError] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<OrganizationApplication | null>(null);
  const [submittedIncident, setSubmittedIncident] = useState<IncidentDetail | null>(null);
  const membershipRequestVersion = useRef(0);
  const navigate = useCallback((next: MobileDestination) => setDestination(next), []);

  useAndroidBackNavigation(destination, navigate);

  const reloadActiveMemberships = useCallback(async () => {
    const requestVersion = ++membershipRequestVersion.current;
    setMembershipsLoaded(false);
    setMembershipsError(false);
    try {
      const memberships: ActiveOrganizationMembership[] = [];
      let cursor: string | undefined;
      do {
        const page = await listMyActiveOrganizationMemberships(accessToken, cursor);
        memberships.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      if (membershipRequestVersion.current === requestVersion) setActiveMemberships(memberships);
    } catch {
      if (membershipRequestVersion.current === requestVersion) {
        setActiveMemberships([]);
        setMembershipsError(true);
      }
    } finally {
      if (membershipRequestVersion.current === requestVersion) setMembershipsLoaded(true);
    }
  }, [accessToken]);

  useEffect(() => {
    void reloadActiveMemberships();
    return () => { membershipRequestVersion.current += 1; };
  }, [reloadActiveMemberships]);

  useEffect(() => {
    if (!pushNotification || !membershipsLoaded) return;

    const next = resolveMobileNotificationDestination(
      pushNotification,
      activeMemberships,
    );
    navigate(next ?? { screen: "notifications" });
    onPushNotificationHandled();
  }, [
    activeMemberships,
    membershipsLoaded,
    navigate,
    onPushNotificationHandled,
    pushNotification,
  ]);

  const signOut = async () => {
    membershipRequestVersion.current += 1;
    setActiveMemberships([]);
    setSubmittedApplication(null);
    setSubmittedIncident(null);
    setDestination(mobileDashboard);
    await onSignOut();
  };

  const requestedMembership = destination.screen === "organizationWorkspace"
    ? activeMemberships.find((membership) => membership.organization.id === destination.organizationId)
    : undefined;

  function renderDestination() {
    if (destination.screen === "notifications") {
      return <NotificationInboxScreen accessToken={accessToken} onBack={() => navigate(mobileDashboard)} onNavigateNotification={(notification) => {
        const next = resolveMobileNotificationDestination(notification, activeMemberships);
        if (!next) return false;
        navigate(next);
        return true;
      }} />;
    }

    if (destination.screen === "createOrganization") {
      return <OrganizationApplicationScreen accessToken={accessToken} initialEmail={profile.email} onBack={() => {
        navigate(mobileDashboard);
        void reloadActiveMemberships();
      }} onSubmitted={(application) => {
        setSubmittedApplication(application);
        navigate({ screen: "organizationApplications" });
      }} />;
    }

    if (destination.screen === "organizationApplications") {
      return <MyOrganizationApplicationsScreen accessToken={accessToken} submittedApplication={submittedApplication} onBack={() => {
        setSubmittedApplication(null);
        navigate(mobileDashboard);
        void reloadActiveMemberships();
      }} onCreateAnother={() => {
        setSubmittedApplication(null);
        navigate({ screen: "createOrganization" });
      }} />;
    }

    if (destination.screen === "membership") {
      return <MembershipSelfServiceScreen accessToken={accessToken} profile={profile} onProfileUpdated={onProfileUpdated} onBack={() => {
        navigate(mobileDashboard);
        void reloadActiveMemberships();
      }} />;
    }

    if (destination.screen === "organizationWorkspaces") {
      return <OrganizationWorkspacesScreen
        memberships={activeMemberships}
        loading={!membershipsLoaded}
        error={membershipsError}
        onRetry={reloadActiveMemberships}
        onBack={() => navigate(mobileDashboard)}
        onSelect={(organizationId) => navigate({ screen: "organizationWorkspace", organizationId, tab: "overview" })}
        onManageMembership={() => navigate({ screen: "membership" })}
      />;
    }

    if (destination.screen === "organizationWorkspace") {
      if (!requestedMembership) {
        return <Screen><View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Organization workspace unavailable</Text><Notice tone="error" message="Your account does not have an active membership in this organization." /><Button label="Return to dashboard" onPress={() => navigate(mobileDashboard)} /></View></Screen>;
      }
      return <OrganizationWorkspaceScreen profile={profile} accessToken={accessToken} memberships={activeMemberships} selectedOrganizationId={requestedMembership.organization.id} initialTab={destination.tab} initialIncidentId={destination.incidentId} initialEventId={destination.eventId} onSelectOrganization={(organizationId) => navigate({ screen: "organizationWorkspace", organizationId, tab: "overview" })} onBack={() => navigate(mobileDashboard)} onViewApplications={() => navigate({ screen: "organizationApplications" })} onSignOut={() => void signOut()} />;
    }

    if (destination.screen === "findCleanupActivity") {
      return <CitizenIncidentDiscoveryScreen accessToken={accessToken} onBack={() => navigate(mobileDashboard)} onReportIncident={() => navigate({ screen: "reportIncident" })} onOpenEvent={(eventId) => navigate({ screen: "cleanupEvents", eventId, returnTo: "findCleanupActivity" })} />;
    }
    if (destination.screen === "cleanupEvents") {
      const returnDestination = destination.returnTo
        ? { screen: destination.returnTo } as MobileDestination
        : mobileDashboard;
      return <PublicCleanupEventsScreen accessToken={accessToken} initialEventId={destination.eventId} onBack={() => navigate(returnDestination)} />;
    }
    if (destination.screen === "joinedCleanupEvents") {
      return <MyJoinedCleanupEventsScreen accessToken={accessToken} onBack={() => navigate(mobileDashboard)} onOpenEvent={(eventId) => navigate({ screen: "cleanupEvents", eventId, returnTo: "joinedCleanupEvents" })} />;
    }
    if (destination.screen === "reportIncident") {
      return <IncidentReportScreen accessToken={accessToken} onBack={() => navigate(mobileDashboard)} onSubmitted={(incident) => {
        setSubmittedIncident(incident);
        navigate({ screen: "myReports", incidentId: incident.id });
      }} />;
    }
    if (destination.screen === "myReports") {
      return <MyReportsScreen accessToken={accessToken} submittedIncident={submittedIncident} initialIncidentId={destination.incidentId} onBack={() => {
        setSubmittedIncident(null);
        navigate(mobileDashboard);
      }} onNewReport={() => {
        setSubmittedIncident(null);
        navigate({ screen: "reportIncident" });
      }} />;
    }
    if (destination.screen === "impact") {
      return <MyImpactScreen accessToken={accessToken} onBack={() => navigate(mobileDashboard)} />;
    }

    return <CitizenDashboard accessToken={accessToken} profile={profile}
      onReportIncident={() => navigate({ screen: "reportIncident" })}
      onFindCleanupActivity={() => navigate({ screen: "findCleanupActivity" })} />;
  }

  const parent = parentDestination(destination);
  return <AppShell
    title={mobileScreenTitles[destination.screen]}
    accessToken={accessToken}
    onHome={() => navigate(mobileDashboard)}
    onBack={parent ? () => navigate(parent) : undefined}
    onNotifications={() => navigate({ screen: "notifications" })}
    onSignOut={() => void signOut()}
    community={[
      { label: "Report incident", onPress: () => navigate({ screen: "reportIncident" }) },
      { label: "My Reports", onPress: () => navigate({ screen: "myReports" }) },
      { label: "Find cleanup activity", onPress: () => navigate({ screen: "findCleanupActivity" }) },
      { label: "My joined events", onPress: () => navigate({ screen: "joinedCleanupEvents" }) },
      { label: "My Impact", onPress: () => navigate({ screen: "impact" }) },
    ]}
    organizations={[
      { label: "Organization workspaces", onPress: () => { navigate({ screen: "organizationWorkspaces" }); void reloadActiveMemberships(); } },
      { label: "Manage membership", onPress: () => navigate({ screen: "membership" }) },
      { label: "Organization requests", onPress: () => navigate({ screen: "organizationApplications" }) },
    ]}
  >
    {renderDestination()}
  </AppShell>;
}
