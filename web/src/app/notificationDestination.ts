import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import type { NotificationItem } from "../features/notifications/notification.types";
import type { UserDestination } from "./navigation";

export function resolveUserNotificationDestination(
  notification: NotificationItem,
  memberships: ActiveOrganizationMembership[],
): UserDestination | null {
  const data = notification.data;

  switch (notification.type) {
    case "ORGANIZATION_REVIEW_UPDATED":
      return { screen: "organization-applications" };
    case "INCIDENT_STATUS_CHANGED":
      return { screen: "incident-reports", incidentId: data?.incidentId };
    case "NEW_INCIDENT_IN_AREA": {
      const organizationId = data?.organizationId ?? notification.organizationId;
      if (!organizationId || !memberships.some(
        (membership) => membership.organization.id === organizationId,
      )) return null;

      return {
        screen: "organization-workspace",
        organizationId,
        tab: "incident-discovery",
        incidentId: data?.incidentId,
      };
    }
    case "EVENT_PUBLISHED":
    case "EVENT_UPDATED":
    case "EVENT_CANCELLED":
    case "EVENT_COMPLETED":
      return data?.eventId
        ? { screen: "cleanup-events", eventId: data.eventId }
        : null;
    case "EVENT_JOINED":
    case "SESSION_ALLOCATED":
      return {
        screen: "joined-cleanup-events",
        eventId: data?.eventId,
      };
    case "MEMBERSHIP_UPDATED": {
      const organizationId = data?.organizationId ?? notification.organizationId;
      const membership = memberships.find(
        (item) => item.organization.id === organizationId,
      );
      if (membership?.role === "ORG_ADMIN") {
        return {
          screen: "organization-workspace",
          organizationId: membership.organization.id,
          tab: "members",
        };
      }
      return { screen: "organization-workspaces" };
    }
    case "ACHIEVEMENT_AWARDED":
      return { screen: "impact" };
    default:
      return null;
  }
}
