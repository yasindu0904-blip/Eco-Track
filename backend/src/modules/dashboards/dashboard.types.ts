import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthorizationDependencies } from "../../authorization/authorization.types.js";

export type DashboardDependencies = {
  prisma: PrismaClient;
  authorization: AuthorizationDependencies;
};

export type CountByState = Record<string, number>;

export interface CitizenDashboardSummary {
  reportsByState: CountByState;
  joinedEvents: number;
  upcomingEvents: number;
  unreadNotifications: number;
  contributions: { count: number; points: number };
}

export interface OrganizationDashboardSummary {
  organizationId: string;
  coveringIncidentsByState: CountByState;
  reviewsByState: CountByState;
  eventsByLifecycle: CountByState;
  upcomingSessions: number;
  joinedParticipants: number;
  pendingMembershipRequests: number;
}

export interface PlatformDashboardSummary {
  users: { total: number; active: number };
  organizationsByState: CountByState;
  incidentsByState: CountByState;
  eventsByLifecycle: CountByState;
  pendingOrganizationApplications: number;
}
