import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import type { NotificationItem } from "../features/notifications/notification.types";
import type { MobileDestination } from "./navigation";

export function resolveMobileNotificationDestination(
  notification: NotificationItem,
  memberships: ActiveOrganizationMembership[],
): MobileDestination | null {
  const data = notification.data;

  switch (notification.type) {
    case "ORGANIZATION_REVIEW_UPDATED":
      return { screen: "organizationApplications" };
    case "INCIDENT_STATUS_CHANGED":
      return { screen: "myReports", incidentId: data?.incidentId };
    case "NEW_INCIDENT_IN_AREA": {
      const organizationId = data?.organizationId ?? notification.organizationId;
      if (!organizationId || !memberships.some(
        (membership) => membership.organization.id === organizationId,
      )) return null;

      return {
        screen: "organizationWorkspace",
        organizationId,
        tab: "incidentDiscovery",
        incidentId: data?.incidentId,
      };
    }
    case "EVENT_PUBLISHED":
    case "EVENT_UPDATED":
    case "EVENT_CANCELLED":
    case "EVENT_COMPLETED":
      return data?.eventId
        ? { screen: "cleanupEvents", eventId: data.eventId }
        : null;
    case "EVENT_JOINED":
    case "SESSION_ALLOCATED":
      return { screen: "joinedCleanupEvents", eventId: data?.eventId };
    case "MEMBERSHIP_UPDATED": {
      const organizationId = data?.organizationId ?? notification.organizationId;
      const membership = memberships.find(
        (item) => item.organization.id === organizationId,
      );
      if (membership?.role === "ORG_ADMIN") {
        return {
          screen: "organizationWorkspace",
          organizationId: membership.organization.id,
          tab: "members",
        };
      }
      return { screen: "membership" };
    }
    case "ACHIEVEMENT_AWARDED":
      return { screen: "impact" };
    default:
      return null;
  }
}
