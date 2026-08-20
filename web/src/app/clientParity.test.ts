import { describe, expect, it } from "vitest";

import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import type { NotificationItem } from "../features/notifications/notification.types";
import { isUserDestination, type UserDestination } from "./navigation";
import { resolveUserNotificationDestination } from "./notificationDestination";

const organizationId = "organization-a";
const activeAdminMembership = {
  membershipId: "membership-a",
  role: "ORG_ADMIN",
  status: "ACTIVE",
  organization: {
    id: organizationId,
    name: "Organization A",
    slug: "organization-a",
    status: "ACTIVE",
  },
} as ActiveOrganizationMembership;

function notification(
  type: NotificationItem["type"],
  data: NotificationItem["data"] = null,
): NotificationItem {
  return {
    id: `notification-${type}`,
    organizationId: data?.organizationId ?? null,
    type,
    title: "Workflow update",
    message: "A completed EcoTrack feature produced this update.",
    data,
    readAt: null,
    createdAt: "2026-08-20T00:00:00.000Z",
  };
}

describe("INT-02 web client parity", () => {
  it("recognizes every completed citizen and organization destination", () => {
    const destinations: UserDestination[] = [
      { screen: "dashboard" },
      { screen: "notifications" },
      { screen: "membership" },
      { screen: "organization-workspaces" },
      { screen: "organization-apply" },
      { screen: "organization-applications" },
      { screen: "organization-workspace", organizationId },
      { screen: "organization-workspace", organizationId, tab: "incident-discovery", incidentId: "incident-1" },
      { screen: "organization-workspace", organizationId, tab: "event-drafts", eventId: "event-1" },
      { screen: "organization-workspace", organizationId, tab: "events", eventId: "event-1" },
      { screen: "organization-workspace", organizationId, tab: "members" },
      { screen: "incident-create" },
      { screen: "incident-reports", incidentId: "incident-1" },
      { screen: "incident-discovery" },
      { screen: "cleanup-events", eventId: "event-1" },
      { screen: "joined-cleanup-events", eventId: "event-1" },
      { screen: "impact" },
    ];

    for (const destination of destinations) {
      expect(isUserDestination(destination)).toBe(true);
    }
  });

  it("routes every actionable workflow notification to its completed feature", () => {
    const cases: Array<[NotificationItem, UserDestination]> = [
      [notification("ORGANIZATION_REVIEW_UPDATED"), { screen: "organization-applications" }],
      [notification("INCIDENT_STATUS_CHANGED", { incidentId: "incident-1" }), { screen: "incident-reports", incidentId: "incident-1" }],
      [notification("NEW_INCIDENT_IN_AREA", { organizationId, incidentId: "incident-1" }), { screen: "organization-workspace", organizationId, tab: "incident-discovery", incidentId: "incident-1" }],
      [notification("EVENT_PUBLISHED", { eventId: "event-1" }), { screen: "cleanup-events", eventId: "event-1" }],
      [notification("EVENT_UPDATED", { eventId: "event-1" }), { screen: "cleanup-events", eventId: "event-1" }],
      [notification("EVENT_CANCELLED", { eventId: "event-1" }), { screen: "cleanup-events", eventId: "event-1" }],
      [notification("EVENT_COMPLETED", { eventId: "event-1" }), { screen: "cleanup-events", eventId: "event-1" }],
      [notification("EVENT_JOINED", { eventId: "event-1" }), { screen: "joined-cleanup-events", eventId: "event-1" }],
      [notification("SESSION_ALLOCATED", { eventId: "event-1" }), { screen: "joined-cleanup-events", eventId: "event-1" }],
      [notification("MEMBERSHIP_UPDATED", { organizationId }), { screen: "organization-workspace", organizationId, tab: "members" }],
      [notification("ACHIEVEMENT_AWARDED", { achievementId: "achievement-1" }), { screen: "impact" }],
    ];

    for (const [item, destination] of cases) {
      expect(resolveUserNotificationDestination(item, [activeAdminMembership])).toEqual(destination);
    }
  });

  it("does not turn incomplete or cross-tenant notification metadata into navigation", () => {
    expect(resolveUserNotificationDestination(
      notification("NEW_INCIDENT_IN_AREA", { organizationId: "organization-b", incidentId: "incident-1" }),
      [activeAdminMembership],
    )).toBeNull();
    expect(resolveUserNotificationDestination(
      notification("EVENT_COMPLETED"),
      [activeAdminMembership],
    )).toBeNull();
    expect(resolveUserNotificationDestination(
      notification("GENERAL"),
      [activeAdminMembership],
    )).toBeNull();
  });
});
