import { describe, expect, it } from "vitest";

import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import type { NotificationItem } from "../features/notifications/notification.types";
import { parentDestination, type MobileDestination } from "./navigation";
import { resolveMobileNotificationDestination } from "./notificationDestination";

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

describe("INT-02 Android client parity", () => {
  it("gives every completed feature a safe Android back destination", () => {
    const destinations: MobileDestination[] = [
      { screen: "notifications" },
      { screen: "membership" },
      { screen: "createOrganization" },
      { screen: "organizationApplications" },
      { screen: "organizationWorkspace", organizationId },
      { screen: "organizationWorkspace", organizationId, tab: "incidentDiscovery", incidentId: "incident-1" },
      { screen: "organizationWorkspace", organizationId, tab: "eventDrafts", eventId: "event-1" },
      { screen: "organizationWorkspace", organizationId, tab: "events", eventId: "event-1" },
      { screen: "organizationWorkspace", organizationId, tab: "members" },
      { screen: "findCleanupActivity" },
      { screen: "cleanupEvents", eventId: "event-1" },
      { screen: "joinedCleanupEvents", eventId: "event-1" },
      { screen: "reportIncident" },
      { screen: "myReports", incidentId: "incident-1" },
      { screen: "impact" },
    ];

    for (const destination of destinations) {
      const parent = parentDestination(destination);
      expect(parent).not.toBeNull();
      if (destination.screen === "organizationWorkspace" && destination.tab && destination.tab !== "overview") {
        expect(parent).toEqual({ screen: "organizationWorkspace", organizationId, tab: "overview" });
      } else {
        expect(parent).toEqual({ screen: "dashboard" });
      }
    }
  });

  it("routes every actionable workflow notification to the Android equivalent", () => {
    const cases: Array<[NotificationItem, MobileDestination]> = [
      [notification("ORGANIZATION_REVIEW_UPDATED"), { screen: "organizationApplications" }],
      [notification("INCIDENT_STATUS_CHANGED", { incidentId: "incident-1" }), { screen: "myReports", incidentId: "incident-1" }],
      [notification("NEW_INCIDENT_IN_AREA", { organizationId, incidentId: "incident-1" }), { screen: "organizationWorkspace", organizationId, tab: "incidentDiscovery", incidentId: "incident-1" }],
      [notification("EVENT_PUBLISHED", { eventId: "event-1" }), { screen: "cleanupEvents", eventId: "event-1" }],
      [notification("EVENT_UPDATED", { eventId: "event-1" }), { screen: "cleanupEvents", eventId: "event-1" }],
      [notification("EVENT_CANCELLED", { eventId: "event-1" }), { screen: "cleanupEvents", eventId: "event-1" }],
      [notification("EVENT_COMPLETED", { eventId: "event-1" }), { screen: "cleanupEvents", eventId: "event-1" }],
      [notification("EVENT_JOINED", { eventId: "event-1" }), { screen: "joinedCleanupEvents", eventId: "event-1" }],
      [notification("SESSION_ALLOCATED", { eventId: "event-1" }), { screen: "joinedCleanupEvents", eventId: "event-1" }],
      [notification("MEMBERSHIP_UPDATED", { organizationId }), { screen: "organizationWorkspace", organizationId, tab: "members" }],
      [notification("ACHIEVEMENT_AWARDED", { achievementId: "achievement-1" }), { screen: "impact" }],
    ];

    for (const [item, destination] of cases) {
      expect(resolveMobileNotificationDestination(item, [activeAdminMembership])).toEqual(destination);
    }
  });

  it("does not turn incomplete or cross-tenant notification metadata into navigation", () => {
    expect(resolveMobileNotificationDestination(
      notification("NEW_INCIDENT_IN_AREA", { organizationId: "organization-b", incidentId: "incident-1" }),
      [activeAdminMembership],
    )).toBeNull();
    expect(resolveMobileNotificationDestination(
      notification("EVENT_COMPLETED"),
      [activeAdminMembership],
    )).toBeNull();
    expect(resolveMobileNotificationDestination(
      notification("GENERAL"),
      [activeAdminMembership],
    )).toBeNull();
  });
});
