import { describe, expect, it } from "vitest";

import type { ActiveOrganizationMembership } from "../features/memberships/administration/membershipAdministration.types";
import type { NotificationItem } from "../features/notifications/notification.types";
import { parentDestination } from "./navigation";
import { resolveMobileNotificationDestination } from "./notificationDestination";

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

const notification = (
  type: NotificationItem["type"],
  data: NotificationItem["data"],
): NotificationItem => ({
  id: "notification-1",
  organizationId: data?.organizationId ?? null,
  type,
  title: "Update",
  message: "EcoTrack update",
  data,
  readAt: null,
  createdAt: new Date().toISOString(),
});

describe("INT-01 mobile navigation", () => {
  it("returns nested organization screens to the verified workspace overview", () => {
    expect(parentDestination({
      screen: "organizationWorkspace",
      organizationId: "organization-a",
      tab: "members",
    })).toEqual({
      screen: "organizationWorkspace",
      organizationId: "organization-a",
      tab: "overview",
    });
  });

  it("returns cleanup-event details to the activity screen that opened them", () => {
    expect(parentDestination({
      screen: "cleanupEvents",
      eventId: "event-1",
      returnTo: "findCleanupActivity",
    })).toEqual({ screen: "findCleanupActivity" });
    expect(parentDestination({
      screen: "cleanupEvents",
      eventId: "event-1",
      returnTo: "joinedCleanupEvents",
    })).toEqual({ screen: "joinedCleanupEvents" });
  });

  it("opens joined-event and reward notifications in real screens", () => {
    expect(resolveMobileNotificationDestination(
      notification("SESSION_ALLOCATED", { eventId: "event-1" }),
      [membership],
    )).toEqual({ screen: "joinedCleanupEvents", eventId: "event-1" });
    expect(resolveMobileNotificationDestination(
      notification("ACHIEVEMENT_AWARDED", { achievementId: "award-1" }),
      [membership],
    )).toEqual({ screen: "impact" });
  });

  it("rejects cross-organization incident notification navigation", () => {
    expect(resolveMobileNotificationDestination(
      notification("NEW_INCIDENT_IN_AREA", {
        organizationId: "organization-b",
        incidentId: "incident-1",
      }),
      [membership],
    )).toBeNull();
  });

  it("opens an organization membership request in the matching admin workspace", () => {
    expect(resolveMobileNotificationDestination(
      notification("MEMBERSHIP_UPDATED", { organizationId: "organization-a" }),
      [membership],
    )).toEqual({
      screen: "organizationWorkspace",
      organizationId: "organization-a",
      tab: "members",
    });
  });
});
