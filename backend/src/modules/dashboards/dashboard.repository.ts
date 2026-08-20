import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { DashboardRange } from "./dashboard.validation.js";

const counts = (rows: Array<{ [key: string]: unknown; _count: number }>, key: string) =>
  Object.fromEntries(rows.map((row) => [String(row[key]), row._count]));

const rangeWhere = (field: string, range: DashboardRange) => ({
  [field]: { ...(range.from && { gte: range.from }), ...(range.to && { lt: range.to }) },
});

export async function citizenSummary(prisma: PrismaClient, userId: string, range: DashboardRange) {
  const now = new Date();
  const [reports, joinedEvents, upcomingEvents, unreadNotifications, contributions] = await Promise.all([
    prisma.incident.groupBy({ by: ["status"], where: { reporterUserId: userId, ...rangeWhere("reportedAt", range) }, _count: true }),
    prisma.eventParticipant.count({ where: { userId, status: "JOINED" } }),
    prisma.eventParticipant.count({ where: { userId, status: "JOINED", cleanupEvent: { lifecycleStatus: { in: ["PUBLISHED", "SCHEDULED", "IN_PROGRESS"] }, sessions: { some: { sessionDate: { gte: now }, status: "SCHEDULED" } } } } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.contributionEvent.aggregate({ where: { userId, ...rangeWhere("createdAt", range) }, _count: true, _sum: { points: true } }),
  ]);
  return { reportsByState: counts(reports, "status"), joinedEvents, upcomingEvents, unreadNotifications, contributions: { count: contributions._count, points: contributions._sum.points ?? 0 } };
}

type CoveringCount = { status: string; count: bigint };

export async function organizationSummary(prisma: PrismaClient, organizationId: string, range: DashboardRange) {
  const now = new Date();
  const [covering, reviews, events, upcomingSessions, joinedParticipants, pendingMembershipRequests] = await Promise.all([
    prisma.$queryRaw<CoveringCount[]>`
      SELECT incident.status::text AS status, COUNT(*)::bigint AS count
      FROM incidents incident
      WHERE (${range.from ?? null}::timestamptz IS NULL OR incident.reported_at >= ${range.from ?? null})
        AND (${range.to ?? null}::timestamptz IS NULL OR incident.reported_at < ${range.to ?? null})
        AND EXISTS (
          SELECT 1 FROM organization_service_areas service_area
          LEFT JOIN administrative_areas administrative_area ON administrative_area.id = service_area.administrative_area_id AND administrative_area.is_active = true
          WHERE service_area.organization_id = ${organizationId}::uuid AND service_area.status = 'ACTIVE'::"ServiceAreaStatus"
            AND extensions.ST_Covers(COALESCE(service_area.boundary, administrative_area.boundary), incident.geo_point)
        ) GROUP BY incident.status`,
    prisma.incidentReview.groupBy({ by: ["status"], where: { organizationId, ...rangeWhere("updatedAt", range) }, _count: true }),
    prisma.cleanupEvent.groupBy({ by: ["lifecycleStatus"], where: { organizationId, ...rangeWhere("createdAt", range) }, _count: true }),
    prisma.eventSession.count({ where: { cleanupEvent: { organizationId }, sessionDate: { gte: now }, status: "SCHEDULED" } }),
    prisma.eventParticipant.count({ where: { cleanupEvent: { organizationId }, status: "JOINED" } }),
    prisma.organizationMembershipRequest.count({ where: { organizationId, status: "PENDING" } }),
  ]);
  return { organizationId, coveringIncidentsByState: Object.fromEntries(covering.map(x => [x.status, Number(x.count)])), reviewsByState: counts(reviews, "status"), eventsByLifecycle: counts(events, "lifecycleStatus"), upcomingSessions, joinedParticipants, pendingMembershipRequests };
}

export async function platformSummary(prisma: PrismaClient, range: DashboardRange) {
  const [totalUsers, activeUsers, organizations, incidents, events, pending] = await Promise.all([
    prisma.userProfile.count(), prisma.userProfile.count({ where: { accountStatus: "ACTIVE" } }),
    prisma.organization.groupBy({ by: ["status"], where: rangeWhere("createdAt", range), _count: true }),
    prisma.incident.groupBy({ by: ["status"], where: rangeWhere("reportedAt", range), _count: true }),
    prisma.cleanupEvent.groupBy({ by: ["lifecycleStatus"], where: rangeWhere("createdAt", range), _count: true }),
    prisma.organization.count({ where: { status: "PENDING_REVIEW" } }),
  ]);
  return { users: { total: totalUsers, active: activeUsers }, organizationsByState: counts(organizations, "status"), incidentsByState: counts(incidents, "status"), eventsByLifecycle: counts(events, "lifecycleStatus"), pendingOrganizationApplications: pending };
}
