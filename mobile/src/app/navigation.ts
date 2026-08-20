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
  | {
      screen: "organizationWorkspace";
      organizationId: string;
      tab?: OrganizationWorkspaceTab;
      incidentId?: string;
      eventId?: string;
    }
  | { screen: "findCleanupActivity" }
  | { screen: "cleanupEvents"; eventId?: string }
  | { screen: "joinedCleanupEvents"; eventId?: string }
  | { screen: "reportIncident" }
  | { screen: "myReports"; incidentId?: string }
  | { screen: "impact" };

export const mobileDashboard: MobileDestination = { screen: "dashboard" };

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

  return mobileDashboard;
}
