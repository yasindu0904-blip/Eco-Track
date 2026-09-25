export type OrganizationWorkspaceTab =
  | "overview"
  | "incidentDiscovery"
  | "eventDrafts"
  | "events"
  | "members";

export type MobileDestination =
  | { screen: "dashboard" }
  | { screen: "notifications" }
  | { screen: "membership" }
  | { screen: "createOrganization" }
  | { screen: "organizationApplications" }
  | { screen: "organizationWorkspaces" }
  | {
      screen: "organizationWorkspace";
      organizationId: string;
      tab?: OrganizationWorkspaceTab;
      incidentId?: string;
      eventId?: string;
    }
  | { screen: "findCleanupActivity" }
  | {
      screen: "cleanupEvents";
      eventId?: string;
      returnTo?: "findCleanupActivity" | "joinedCleanupEvents";
    }
  | { screen: "joinedCleanupEvents"; eventId?: string }
  | { screen: "reportIncident" }
  | { screen: "myReports"; incidentId?: string }
  | { screen: "impact" };

export const mobileDashboard: MobileDestination = { screen: "dashboard" };

export const mobileScreenTitles: Record<MobileDestination["screen"], string> = {
  dashboard: "EcoTrack",
  notifications: "Notifications",
  membership: "Manage membership",
  createOrganization: "Organization request",
  organizationApplications: "Organization requests",
  organizationWorkspaces: "Organization workspaces",
  organizationWorkspace: "Organization workspace",
  findCleanupActivity: "Find cleanup activity",
  cleanupEvents: "Cleanup events",
  joinedCleanupEvents: "My joined events",
  reportIncident: "Report an incident",
  myReports: "My Reports",
  impact: "My Impact",
};

export function parentDestination(
  destination: MobileDestination,
): MobileDestination | null {
  if (destination.screen === "dashboard") return null;
  if (destination.screen === "organizationWorkspace" && destination.tab && destination.tab !== "overview") {
    return {
      screen: "organizationWorkspace",
      organizationId: destination.organizationId,
      tab: "overview",
    };
  }
  if (destination.screen === "cleanupEvents" && destination.returnTo) {
    return { screen: destination.returnTo };
  }

  return mobileDashboard;
}
