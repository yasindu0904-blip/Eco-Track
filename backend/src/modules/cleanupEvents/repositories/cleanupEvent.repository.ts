import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

export async function isIncidentVisibleToOrganization(prisma: PrismaClient, organizationId: string, incidentId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT incident."id" FROM "incidents" AS incident
    WHERE incident."id" = ${incidentId}::uuid AND (
      EXISTS (SELECT 1 FROM "organization_service_areas" AS service_area
        JOIN "organizations" AS organization ON organization."id"=service_area."organization_id" AND organization."status"='ACTIVE'::"OrganizationStatus"
        LEFT JOIN "administrative_areas" AS administrative_area ON administrative_area."id"=service_area."administrative_area_id" AND administrative_area."is_active"=true
        WHERE service_area."organization_id"=${organizationId}::uuid AND service_area."status"='ACTIVE'::"ServiceAreaStatus"
          AND extensions.ST_Covers(COALESCE(service_area."boundary", administrative_area."boundary"), incident."geo_point"))
      OR EXISTS (SELECT 1 FROM "incident_reviews" review WHERE review."incident_id"=incident."id" AND review."organization_id"=${organizationId}::uuid)
    ) LIMIT 1`);
  return rows.length === 1;
}

export async function findDraftWorkflowStatusId(prisma: PrismaClient, organizationId: string) {
  const status = await prisma.cleanupWorkflowStatus.findFirst({
    where: { organizationId, mappedLifecycleStatus: "DRAFT" },
    select: { id: true },
  });
  return status?.id ?? null;
}

export async function createDraftRecord(
  prisma: PrismaClient,
  organizationId: string,
  createdByMembershipId: string,
  data: any,
) {
  const workflowStatusId = await findDraftWorkflowStatusId(prisma, organizationId);
  return prisma.cleanupEvent.create({
    data: {
      organizationId,
      incidentId: data.incidentId ?? null,
      currentWorkflowStatusId: workflowStatusId!,
      lifecycleStatus: "DRAFT",
      createdByMembershipId,
      title: data.title,
      description: data.description,
      publicInstructions: data.publicInstructions ?? null,
      eventLatitude: data.eventLatitude,
      eventLongitude: data.eventLongitude,
      eventAddress: data.eventAddress ?? null,
      meetingLatitude: data.meetingLatitude ?? null,
      meetingLongitude: data.meetingLongitude ?? null,
      meetingAddress: data.meetingAddress ?? null,
    },
  });
}

export async function updateDraftRecord(
  prisma: PrismaClient,
  organizationId: string,
  draftId: string,
  updaterMembershipId: string,
  data: any,
) {
  // Only allow updating drafts belonging to organization and created by the membership
  const updated = await prisma.cleanupEvent.updateMany({
    where: { id: draftId, organizationId, createdByMembershipId: updaterMembershipId, lifecycleStatus: "DRAFT" },
    data: {
      ...data,
    },
  });
  if (updated.count === 0) return null;
  return prisma.cleanupEvent.findUnique({ where: { id: draftId } });
}

export async function findOwnDrafts(
  prisma: PrismaClient,
  organizationId: string,
  membershipId: string,
) {
  return prisma.cleanupEvent.findMany({
    where: { organizationId, createdByMembershipId: membershipId, lifecycleStatus: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });
}

export async function findOwnDraftById(
  prisma: PrismaClient,
  organizationId: string,
  membershipId: string,
  id: string,
) {
  return prisma.cleanupEvent.findFirst({ where: { id, organizationId, createdByMembershipId: membershipId, lifecycleStatus: "DRAFT" } });
}

export async function createEventSessionRecord(
  prisma: PrismaClient,
  cleanupEventId: string,
  data: any,
) {
  return prisma.eventSession.create({
    data: {
      cleanupEventId,
      sessionDate: new Date(data.sessionDate),
      startTime: new Date(`1970-01-01T${data.startTime}Z`),
      endTime: new Date(`1970-01-01T${data.endTime}Z`),
      capacity: data.capacity ?? null,
      locationLatitude: data.locationLatitude ?? null,
      locationLongitude: data.locationLongitude ?? null,
      locationAddress: data.locationAddress ?? null,
      notes: data.notes ?? null,
    },
  });
}

export async function removeEventSessionRecord(prisma: PrismaClient, sessionId: string) {
  await prisma.eventSession.deleteMany({ where: { id: sessionId } });
}

export async function updateEventSessionRecord(prisma: PrismaClient, organizationId: string, eventId: string, sessionId: string, data: any) {
  const session = await prisma.eventSession.findFirst({ where: { id: sessionId, cleanupEventId: eventId, cleanupEvent: { organizationId, lifecycleStatus: "DRAFT" } }, select: { id: true } });
  if (!session) return null;
  return prisma.eventSession.update({ where: { id: sessionId }, data: { ...data, sessionDate: new Date(`${data.sessionDate}T00:00:00.000Z`), startTime: new Date(`1970-01-01T${data.startTime}Z`), endTime: new Date(`1970-01-01T${data.endTime}Z`) } });
}

export async function findEventById(prisma: PrismaClient, organizationId: string, id: string) {
  return prisma.cleanupEvent.findFirst({ where: { id, organizationId } });
}

export async function assignCoordinatorRecord(
  prisma: PrismaClient,
  cleanupEventId: string,
  membershipId: string,
  assignedByMembershipId: string,
) {
  return prisma.eventCoordinator.create({
    data: {
      cleanupEventId,
      membershipId,
      assignedByMembershipId,
    },
  });
}

export async function removeCoordinatorRecord(prisma: PrismaClient, cleanupEventId: string, membershipId: string) {
  return prisma.eventCoordinator.updateMany({ where: { cleanupEventId, membershipId, removedAt: null }, data: { removedAt: new Date() } });
}
