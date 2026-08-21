import { describe, expect, it } from "vitest";

import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import type { NotificationItem } from "../features/notifications/notification.types";
import { cleanupEventReturnDestination, isSuperAdminDestination, isUserDestination } from "./navigation";
import { resolveUserNotificationDestination } from "./notificationDestination";

const membership = {
  membershipId: "membership-a",
  role: "ORG_ADMIN",
  status: "ACTIVE",
  organization: {
    id: "organization-a",
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
    id: "notification-1",
    organizationId: data?.organizationId ?? null,
    type,
    title: "Update",
    message: "EcoTrack update",
    data,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

describe("INT-01 navigation contracts", () => {
  it("requires verified organization context for organization destinations", () => {
    expect(isUserDestination({ screen: "organization-workspace" })).toBe(false);
    expect(isUserDestination({
      screen: "organization-workspace",
      organizationId: "organization-a",
    })).toBe(true);
  });

  it("accepts only real Super Admin destinations", () => {
    expect(isSuperAdminDestination({ screen: "dashboard" })).toBe(true);
    expect(isSuperAdminDestination({ screen: "notifications" })).toBe(true);
    expect(isSuperAdminDestination({ screen: "organization-workspace" })).toBe(false);
  });

  it("routes incident and event updates to real feature destinations", () => {
    expect(resolveUserNotificationDestination(
      notification("INCIDENT_STATUS_CHANGED", { incidentId: "incident-1" }),
      [membership],
    )).toEqual({ screen: "incident-reports", incidentId: "incident-1" });
    expect(resolveUserNotificationDestination(
      notification("EVENT_UPDATED", { eventId: "event-1" }),
      [membership],
    )).toEqual({ screen: "cleanup-events", eventId: "event-1" });
  });

  it("returns cleanup-event details to the screen that opened them", () => {
    expect(isUserDestination({
      screen: "cleanup-events",
      eventId: "event-1",
      returnTo: "incident-discovery",
    })).toBe(true);
    expect(isUserDestination({
      screen: "cleanup-events",
      returnTo: "organization-workspace",
    })).toBe(false);
    expect(cleanupEventReturnDestination({
      screen: "cleanup-events",
      eventId: "event-1",
      returnTo: "incident-discovery",
    })).toEqual({ screen: "incident-discovery" });
    expect(cleanupEventReturnDestination({
      screen: "cleanup-events",
      eventId: "event-1",
      returnTo: "joined-cleanup-events",
    })).toEqual({ screen: "joined-cleanup-events" });
    expect(cleanupEventReturnDestination({
      screen: "cleanup-events",
      eventId: "event-1",
    })).toEqual({ screen: "dashboard" });
  });

  it("refuses tenant notification navigation without a matching active membership", () => {
    expect(resolveUserNotificationDestination(
      notification("NEW_INCIDENT_IN_AREA", {
        incidentId: "incident-1",
        organizationId: "organization-b",
      }),
      [membership],
    )).toBeNull();
  });

  it("opens an organization membership request in the matching admin workspace", () => {
    expect(resolveUserNotificationDestination(
      notification("MEMBERSHIP_UPDATED", { organizationId: "organization-a" }),
      [membership],
    )).toEqual({
      screen: "organization-workspace",
      organizationId: "organization-a",
      tab: "members",
    });
  });
});
