import type { PrismaClient } from "../../../generated/prisma/client.js";

import type {
  CitizenDashboardSummary,
  CountByState,
  OrganizationDashboardSummary,
  PlatformDashboardSummary,
} from "../dashboard.types.js";
import type { DashboardRange } from "../dashboard.validation.js";

type CountRow = Record<string, unknown> & {
  _count: number;
};

type CoveringIncidentCount = {
  status: string;
  count: bigint;
};

function countByState(
  rows: CountRow[],
  stateField: string,
): CountByState {
  return Object.fromEntries(
    rows.map((row) => [String(row[stateField]), row._count]),
  );
}

function dateRangeFilter(range: DashboardRange): {
  gte: Date;
  lt: Date;
} | undefined {
  if (!range.from || !range.to) {
    return undefined;
  }

  return {
    gte: range.from,
    lt: range.to,
  };
}

export async function getCitizenDashboardSummaryRecords(
  prisma: PrismaClient,
  userId: string,
  range: DashboardRange,
): Promise<CitizenDashboardSummary> {
  const now = new Date();
  const historicalRange = dateRangeFilter(range);

  const [
    reports,
    joinedEvents,
    upcomingEvents,
    unreadNotifications,
    contributions,
  ] = await Promise.all([
    prisma.incident.groupBy({
      by: ["status"],
      where: {
        reporterUserId: userId,
        ...(historicalRange ? { reportedAt: historicalRange } : {}),
      },
      _count: true,
    }),
    prisma.eventParticipant.count({
      where: {
        userId,
        status: "JOINED",
      },
    }),
    prisma.eventParticipant.count({
      where: {
        userId,
        status: "JOINED",
        cleanupEvent: {
          lifecycleStatus: {
            in: ["PUBLISHED", "SCHEDULED", "IN_PROGRESS"],
          },
          sessions: {
            some: {
              sessionDate: { gte: now },
              status: "SCHEDULED",
            },
          },
        },
      },
    }),
    prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    }),
    prisma.contributionEvent.aggregate({
      where: {
        userId,
        ...(historicalRange ? { createdAt: historicalRange } : {}),
      },
      _count: true,
      _sum: { points: true },
    }),
  ]);

  return {
    reportsByState: countByState(reports, "status"),
    joinedEvents,
    upcomingEvents,
    unreadNotifications,
    contributions: {
      count: contributions._count,
      points: contributions._sum.points ?? 0,
    },
  };
}

export async function getOrganizationDashboardSummaryRecords(
  prisma: PrismaClient,
  organizationId: string,
  range: DashboardRange,
): Promise<OrganizationDashboardSummary> {
  const now = new Date();
  const historicalRange = dateRangeFilter(range);

  const [
    coveringIncidents,
    reviews,
    events,
    upcomingSessions,
    joinedParticipants,
    pendingMembershipRequests,
  ] = await Promise.all([
    prisma.$queryRaw<CoveringIncidentCount[]>`
      SELECT
        incident."status"::text AS "status",
        COUNT(*)::bigint AS "count"
      FROM "incidents" AS incident
      WHERE (
          ${historicalRange?.gte ?? null}::timestamptz IS NULL
          OR incident."reported_at" >= ${historicalRange?.gte ?? null}
        )
        AND (
          ${historicalRange?.lt ?? null}::timestamptz IS NULL
          OR incident."reported_at" < ${historicalRange?.lt ?? null}
        )
        AND EXISTS (
          SELECT 1
          FROM "organization_service_areas" AS service_area
          JOIN "organizations" AS organization
            ON organization."id" = service_area."organization_id"
           AND organization."status" = 'ACTIVE'::"OrganizationStatus"
          LEFT JOIN "administrative_areas" AS administrative_area
            ON administrative_area."id" = service_area."administrative_area_id"
           AND administrative_area."is_active" = true
          WHERE service_area."organization_id" = ${organizationId}::uuid
            AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
            AND extensions.ST_Covers(
              COALESCE(service_area."boundary", administrative_area."boundary"),
              incident."geo_point"
            )
        )
      GROUP BY incident."status"
    `,
    prisma.incidentReview.groupBy({
      by: ["status"],
      where: {
        organizationId,
        ...(historicalRange ? { updatedAt: historicalRange } : {}),
      },
      _count: true,
    }),
    prisma.cleanupEvent.groupBy({
      by: ["lifecycleStatus"],
      where: {
        organizationId,
        ...(historicalRange ? { createdAt: historicalRange } : {}),
      },
      _count: true,
    }),
    prisma.eventSession.count({
      where: {
        cleanupEvent: { organizationId },
        sessionDate: { gte: now },
        status: "SCHEDULED",
      },
    }),
    prisma.eventParticipant.count({
      where: {
        cleanupEvent: { organizationId },
        status: "JOINED",
      },
    }),
    prisma.organizationMembershipRequest.count({
      where: {
        organizationId,
        status: "PENDING",
      },
    }),
  ]);

  return {
    organizationId,
    coveringIncidentsByState: Object.fromEntries(
      coveringIncidents.map(({ status, count }) => [status, Number(count)]),
    ),
    reviewsByState: countByState(reviews, "status"),
    eventsByLifecycle: countByState(events, "lifecycleStatus"),
    upcomingSessions,
    joinedParticipants,
    pendingMembershipRequests,
  };
}

export async function getPlatformDashboardSummaryRecords(
  prisma: PrismaClient,
  range: DashboardRange,
): Promise<PlatformDashboardSummary> {
  const historicalRange = dateRangeFilter(range);

  const [
    totalUsers,
    activeUsers,
    organizations,
    incidents,
    events,
    pendingOrganizationApplications,
  ] = await Promise.all([
    prisma.userProfile.count(),
    prisma.userProfile.count({
      where: { accountStatus: "ACTIVE" },
    }),
    prisma.organization.groupBy({
      by: ["status"],
      where: historicalRange ? { createdAt: historicalRange } : {},
      _count: true,
    }),
    prisma.incident.groupBy({
      by: ["status"],
      where: historicalRange ? { reportedAt: historicalRange } : {},
      _count: true,
    }),
    prisma.cleanupEvent.groupBy({
      by: ["lifecycleStatus"],
      where: historicalRange ? { createdAt: historicalRange } : {},
      _count: true,
    }),
    prisma.organization.count({
      where: { status: "PENDING_REVIEW" },
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
    },
    organizationsByState: countByState(organizations, "status"),
    incidentsByState: countByState(incidents, "status"),
    eventsByLifecycle: countByState(events, "lifecycleStatus"),
    pendingOrganizationApplications,
  };
}
