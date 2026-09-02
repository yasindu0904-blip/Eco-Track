import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";

import { prisma } from "../database/prisma.js";
import {
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  OrganizationStatus,
  ServiceAreaStatus,
} from "../generated/prisma/enums.js";

const profileAId = randomUUID();
const profileBId = randomUUID();
const volunteerProfileId = randomUUID();
const organizationAId = randomUUID();
const organizationBId = randomUUID();
const membershipAId = randomUUID();
const membershipBId = randomUUID();
const categoryId = randomUUID();
const administrativeAreaId = randomUUID();
const incidentId = randomUUID();
const eventAId = randomUUID();
const eventBId = randomUUID();
const participantId = randomUUID();
const pushNotificationAId = randomUUID();
const pushNotificationBId = randomUUID();
const pushDeviceAId = randomUUID();
const pushDeviceBId = randomUUID();
const pushDeliveryId = randomUUID();

type WorkflowStatusIds = {
  draft: string;
  published: string;
};

let workflowA: WorkflowStatusIds;
let workflowB: WorkflowStatusIds;

async function loadWorkflowStatusIds(
  organizationId: string,
): Promise<WorkflowStatusIds> {
  const statuses = await prisma.cleanupWorkflowStatus.findMany({
    where: {
      organizationId,
      code: { in: ["DRAFT", "PUBLISHED"] },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const draft = statuses.find((status) => status.code === "DRAFT");
  const published = statuses.find((status) => status.code === "PUBLISHED");

  assert.ok(draft);
  assert.ok(published);

  return {
    draft: draft.id,
    published: published.id,
  };
}

async function insertDraftEvent(
  id: string,
  organizationId: string,
  incidentIdValue: string,
  workflowStatusId: string,
  creatorMembershipId: string,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "cleanup_events" (
      "id",
      "organization_id",
      "incident_id",
      "current_workflow_status_id",
      "lifecycle_status",
      "created_by_membership_id",
      "title",
      "description",
      "event_latitude",
      "event_longitude",
      "created_at",
      "updated_at"
    ) VALUES (
      ${id}::uuid,
      ${organizationId}::uuid,
      ${incidentIdValue}::uuid,
      ${workflowStatusId}::uuid,
      'DRAFT'::"CleanupLifecycleStatus",
      ${creatorMembershipId}::uuid,
      'Database foundation test event',
      'Created to verify EcoTrack database integrity.',
      6.930000,
      79.860000,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
}

before(async () => {
  await prisma.userProfile.createMany({
    data: [
      {
        id: profileAId,
        authUserId: randomUUID(),
        email: `domain-schema-a-${profileAId}@example.com`,
        fullName: "Domain Schema Admin A",
      },
      {
        id: profileBId,
        authUserId: randomUUID(),
        email: `domain-schema-b-${profileBId}@example.com`,
        fullName: "Domain Schema Admin B",
      },
      {
        id: volunteerProfileId,
        authUserId: randomUUID(),
        email: `domain-schema-volunteer-${volunteerProfileId}@example.com`,
        fullName: "Domain Schema Volunteer",
      },
    ],
  });

  await prisma.incidentCategory.create({
    data: {
      id: categoryId,
      name: `Domain schema category ${categoryId}`,
      description: "Used only by the database foundation integration test.",
    },
  });

  await prisma.organization.createMany({
    data: [
      {
        id: organizationAId,
        requestedByUserId: profileAId,
        name: "Domain Schema Organization A",
        slug: `domain-schema-a-${organizationAId}`,
        officialEmail: `organization-a-${organizationAId}@example.com`,
        officialPhone: "+94 70 000 0001",
        officialAddress: "Test address A",
        status: OrganizationStatus.ACTIVE,
        activatedAt: new Date(),
      },
      {
        id: organizationBId,
        requestedByUserId: profileBId,
        name: "Domain Schema Organization B",
        slug: `domain-schema-b-${organizationBId}`,
        officialEmail: `organization-b-${organizationBId}@example.com`,
        officialPhone: "+94 70 000 0002",
        officialAddress: "Test address B",
        status: OrganizationStatus.ACTIVE,
        activatedAt: new Date(),
      },
    ],
  });

  await prisma.organizationMembership.createMany({
    data: [
      {
        id: membershipAId,
        organizationId: organizationAId,
        userId: profileAId,
        role: MembershipRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
        source: MembershipSource.FIRST_ADMIN,
      },
      {
        id: membershipBId,
        organizationId: organizationBId,
        userId: profileBId,
        role: MembershipRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
        source: MembershipSource.FIRST_ADMIN,
      },
    ],
  });

  workflowA = await loadWorkflowStatusIds(organizationAId);
  workflowB = await loadWorkflowStatusIds(organizationBId);

  await prisma.$executeRaw`
    INSERT INTO "administrative_areas" (
      "id",
      "level",
      "official_code",
      "name_en",
      "boundary",
      "source_name",
      "source_version",
      "updated_at"
    ) VALUES (
      ${administrativeAreaId}::uuid,
      'GN_DIVISION'::"AdministrativeAreaLevel",
      ${`DOMAIN-${administrativeAreaId}`},
      'Domain Schema Test GN Division',
      extensions.ST_GeogFromText(
        'SRID=4326;MULTIPOLYGON(((79.85 6.92,79.87 6.92,79.87 6.94,79.85 6.94,79.85 6.92)))'
      ),
      'EcoTrack database foundation test',
      'test-v1',
      CURRENT_TIMESTAMP
    )
  `;

  await prisma.organizationServiceArea.createMany({
    data: [
      {
        id: randomUUID(),
        organizationId: organizationAId,
        administrativeAreaId,
        status: ServiceAreaStatus.ACTIVE,
      },
      {
        id: randomUUID(),
        organizationId: organizationBId,
        administrativeAreaId,
        status: ServiceAreaStatus.ACTIVE,
      },
    ],
  });

  const reportedAt = new Date();

  await prisma.incident.create({
    data: {
      id: incidentId,
      reporterUserId: volunteerProfileId,
      submissionId: randomUUID(),
      categoryId,
      title: "Domain schema test incident",
      description: "Verifies geographic routing and event claim integrity.",
      severity: "MEDIUM",
      latitude: 6.93,
      longitude: 79.86,
      highlightUntil: new Date(reportedAt.getTime() + 48 * 60 * 60 * 1000),
      archiveAfter: new Date(reportedAt.getTime() + 9 * 24 * 60 * 60 * 1000),
      reportedAt,
    },
  });
});

after(async () => {
  await prisma.notificationDelivery.deleteMany({
    where: { id: pushDeliveryId },
  });
  await prisma.userDevice.deleteMany({
    where: { id: { in: [pushDeviceAId, pushDeviceBId] } },
  });
  await prisma.notification.deleteMany({
    where: { id: { in: [pushNotificationAId, pushNotificationBId] } },
  });
  await prisma.eventParticipant.deleteMany({
    where: { id: participantId },
  });
  await prisma.cleanupEvent.deleteMany({
    where: { id: { in: [eventAId, eventBId] } },
  });
  await prisma.incident.deleteMany({
    where: { id: incidentId },
  });
  await prisma.organizationServiceArea.deleteMany({
    where: {
      organizationId: {
        in: [organizationAId, organizationBId],
      },
    },
  });
  await prisma.organizationMembership.deleteMany({
    where: { id: { in: [membershipAId, membershipBId] } },
  });
  await prisma.organization.deleteMany({
    where: {
      id: { in: [organizationAId, organizationBId] },
    },
  });
  await prisma.administrativeArea.deleteMany({
    where: { id: administrativeAreaId },
  });
  await prisma.incidentCategory.deleteMany({
    where: { id: categoryId },
  });
  await prisma.userProfile.deleteMany({
    where: {
      id: {
        in: [profileAId, profileBId, volunteerProfileId],
      },
    },
  });
});

test("new organizations receive the required default cleanup workflow", async () => {
  const [statusCount, transitionCount] = await Promise.all([
    prisma.cleanupWorkflowStatus.count({
      where: { organizationId: organizationAId },
    }),
    prisma.cleanupWorkflowTransition.count({
      where: { organizationId: organizationAId },
    }),
  ]);

  assert.equal(statusCount, 4);
  assert.equal(transitionCount, 3);
});

test("incident coordinates create a PostGIS point and find every covering organization", async () => {
  const point = await prisma.$queryRaw<
    Array<{ longitude: number; latitude: number }>
  >`
    SELECT
      extensions.ST_X("geo_point"::extensions.geometry) AS longitude,
      extensions.ST_Y("geo_point"::extensions.geometry) AS latitude
    FROM "incidents"
    WHERE "id" = ${incidentId}::uuid
  `;

  assert.equal(point[0]?.longitude, 79.86);
  assert.equal(point[0]?.latitude, 6.93);

  const coveringOrganizations = await prisma.$queryRaw<
    Array<{ organizationId: string; organizationName: string }>
  >`
    SELECT DISTINCT
      organization."id" AS "organizationId",
      organization."name" AS "organizationName"
    FROM "incidents" AS incident
    JOIN "administrative_areas" AS administrative_area
      ON administrative_area."is_active" = true
     AND extensions.ST_Covers(
       administrative_area."boundary",
       incident."geo_point"
     )
    JOIN "organization_service_areas" AS service_area
      ON service_area."administrative_area_id" = administrative_area."id"
     AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
    JOIN "organizations" AS organization
      ON organization."id" = service_area."organization_id"
     AND organization."status" = 'ACTIVE'::"OrganizationStatus"
    WHERE incident."id" = ${incidentId}::uuid
    ORDER BY organization."id"
  `;

  const coveringOrganizationIds = new Set(
    coveringOrganizations.map((organization) => organization.organizationId),
  );

  assert.equal(coveringOrganizationIds.has(organizationAId), true);
  assert.equal(coveringOrganizationIds.has(organizationBId), true);
});

test("cleanup events reject cross-organization creators and mismatched lifecycle statuses", async () => {
  await assert.rejects(
    insertDraftEvent(
      randomUUID(),
      organizationAId,
      incidentId,
      workflowA.draft,
      membershipBId,
    ),
  );

  await assert.rejects(
    prisma.$executeRaw`
      INSERT INTO "cleanup_events" (
        "id",
        "organization_id",
        "incident_id",
        "current_workflow_status_id",
        "lifecycle_status",
        "created_by_membership_id",
        "title",
        "description",
        "event_latitude",
        "event_longitude",
        "published_at",
        "created_at",
        "updated_at"
      ) VALUES (
        ${randomUUID()}::uuid,
        ${organizationAId}::uuid,
        ${incidentId}::uuid,
        ${workflowA.draft}::uuid,
        'PUBLISHED'::"CleanupLifecycleStatus",
        ${membershipAId}::uuid,
        'Invalid lifecycle event',
        'The DRAFT workflow status cannot represent PUBLISHED.',
        6.930000,
        79.860000,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
  );
});

test("only one claiming cleanup event can be active for an incident", async () => {
  await insertDraftEvent(
    eventAId,
    organizationAId,
    incidentId,
    workflowA.draft,
    membershipAId,
  );
  await insertDraftEvent(
    eventBId,
    organizationBId,
    incidentId,
    workflowB.draft,
    membershipBId,
  );

  await prisma.$executeRaw`
    UPDATE "cleanup_events"
    SET
      "current_workflow_status_id" = ${workflowA.published}::uuid,
      "lifecycle_status" = 'PUBLISHED'::"CleanupLifecycleStatus",
      "published_at" = CURRENT_TIMESTAMP,
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${eventAId}::uuid
  `;

  await assert.rejects(
    prisma.$executeRaw`
      UPDATE "cleanup_events"
      SET
        "current_workflow_status_id" = ${workflowB.published}::uuid,
        "lifecycle_status" = 'PUBLISHED'::"CleanupLifecycleStatus",
        "published_at" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${eventBId}::uuid
    `,
  );

  const claimingEventCount = await prisma.cleanupEvent.count({
    where: {
      incidentId,
      lifecycleStatus: {
        in: ["PUBLISHED"],
      },
    },
  });

  assert.equal(claimingEventCount, 1);
});

test("event-level attendance requires a complete, internally consistent marker", async () => {
  await prisma.eventParticipant.create({
    data: {
      id: participantId,
      cleanupEventId: eventAId,
      userId: volunteerProfileId,
    },
  });

  await assert.rejects(prisma.$executeRaw`
    UPDATE "event_participants"
    SET "attendance_status" = 'ATTENDED'::"AttendanceStatus"
    WHERE "id" = ${participantId}::uuid
  `);

  await prisma.eventParticipant.update({
    where: { id: participantId },
    data: {
      attendanceStatus: "ATTENDED",
      attendanceMarkedAt: new Date(),
      attendanceMarkedByMembershipId: membershipAId,
    },
  });
  assert.equal(
    (
      await prisma.eventParticipant.findUniqueOrThrow({
        where: { id: participantId },
      })
    ).attendanceStatus,
    "ATTENDED",
  );
});

test("every new domain table has RLS and no frontend-role table privileges", async () => {
  const tableNames = [
    "cleanup_workflow_statuses",
    "cleanup_workflow_transitions",
    "incidents",
    "incident_photos",
    "incident_reviews",
    "incident_status_history",
    "cleanup_events",
    "event_coordinators",
    "event_participants",
    "event_notes",
    "event_evidence",
    "event_status_history",
    "contribution_events",
    "achievement_definitions",
    "user_achievements",
    "user_devices",
    "notification_deliveries",
  ] as const;

  const security = await prisma.$queryRaw<
    Array<{
      tableName: string;
      rlsEnabled: boolean;
      anonSelect: boolean;
      authenticatedSelect: boolean;
    }>
  >`
    SELECT
      class.relname AS "tableName",
      class.relrowsecurity AS "rlsEnabled",
      has_table_privilege('anon', class.oid, 'SELECT') AS "anonSelect",
      has_table_privilege('authenticated', class.oid, 'SELECT') AS "authenticatedSelect"
    FROM pg_class AS class
    JOIN pg_namespace AS namespace
      ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relname IN (
        'cleanup_workflow_statuses',
        'cleanup_workflow_transitions',
        'incidents',
        'incident_photos',
        'incident_reviews',
        'incident_status_history',
        'cleanup_events',
        'event_coordinators',
        'event_participants',
        'event_notes',
        'event_evidence',
        'event_status_history',
        'contribution_events',
        'achievement_definitions',
        'user_achievements',
        'user_devices',
        'notification_deliveries'
      )
    ORDER BY class.relname
  `;

  assert.equal(security.length, tableNames.length);

  for (const table of security) {
    assert.equal(table.rlsEnabled, true, table.tableName);
    assert.equal(table.anonSelect, false, table.tableName);
    assert.equal(table.authenticatedSelect, false, table.tableName);
  }
});

test("notification unread lookups use a dedicated partial index", async () => {
  const indexes = await prisma.$queryRaw<Array<{ definition: string }>>`
    SELECT indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND indexname = 'notifications_unread_user_created_at_idx'
  `;

  assert.equal(indexes.length, 1);
  assert.match(indexes[0]?.definition ?? "", /\(user_id, created_at DESC\)/);
  assert.match(indexes[0]?.definition ?? "", /WHERE \(read_at IS NULL\)/);
});

test("push devices and deliveries enforce durable ownership and idempotency", async () => {
  await prisma.notification.createMany({
    data: [
      {
        id: pushNotificationAId,
        userId: profileAId,
        type: "GENERAL",
        title: "Push foundation A",
        message: "Belongs to profile A.",
      },
      {
        id: pushNotificationBId,
        userId: profileBId,
        type: "GENERAL",
        title: "Push foundation B",
        message: "Belongs to profile B.",
      },
    ],
  });

  await prisma.userDevice.createMany({
    data: [
      {
        id: pushDeviceAId,
        userId: profileAId,
        installationId: `installation-${pushDeviceAId}`,
        expoPushToken: `ExponentPushToken[${pushDeviceAId}]`,
        platform: "ANDROID",
      },
      {
        id: pushDeviceBId,
        userId: profileBId,
        installationId: `installation-${pushDeviceBId}`,
        expoPushToken: `ExponentPushToken[${pushDeviceBId}]`,
        platform: "ANDROID",
      },
    ],
  });

  const delivery = await prisma.notificationDelivery.create({
    data: {
      id: pushDeliveryId,
      userId: profileAId,
      notificationId: pushNotificationAId,
      deviceId: pushDeviceAId,
    },
  });

  assert.equal(delivery.status, "PENDING");
  assert.equal(delivery.attemptCount, 0);

  await assert.rejects(
    prisma.notificationDelivery.create({
      data: {
        userId: profileAId,
        notificationId: pushNotificationAId,
        deviceId: pushDeviceAId,
      },
    }),
  );

  await assert.rejects(
    prisma.notificationDelivery.create({
      data: {
        userId: profileAId,
        notificationId: pushNotificationAId,
        deviceId: pushDeviceBId,
      },
    }),
  );

  await assert.rejects(
    prisma.userDevice.create({
      data: {
        userId: profileBId,
        installationId: `installation-${pushDeviceAId}`,
        expoPushToken: `ExponentPushToken[duplicate-installation-${pushDeviceAId}]`,
        platform: "ANDROID",
      },
    }),
  );

  await assert.rejects(
    prisma.userDevice.create({
      data: {
        userId: profileBId,
        installationId: `different-installation-${pushDeviceAId}`,
        expoPushToken: `ExponentPushToken[${pushDeviceAId}]`,
        platform: "ANDROID",
      },
    }),
  );

  await assert.rejects(prisma.$executeRaw`
    INSERT INTO "user_devices" (
      "user_id", "installation_id", "platform", "is_active", "registered_at", "last_seen_at", "updated_at"
    ) VALUES (
      ${profileAId}::uuid,
      ${`missing-token-${pushDeviceAId}`},
      'ANDROID'::"PushDevicePlatform",
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  await assert.rejects(prisma.$executeRaw`
    UPDATE "notification_deliveries"
    SET "attempt_count" = -1
    WHERE "id" = ${pushDeliveryId}::uuid
  `);

  await assert.rejects(prisma.$executeRaw`
    UPDATE "notification_deliveries"
    SET "status" = 'RETRY_PENDING'::"NotificationDeliveryStatus",
        "next_retry_at" = NULL
    WHERE "id" = ${pushDeliveryId}::uuid
  `);
});

test("push-delivery retry work uses a dedicated partial index", async () => {
  const indexes = await prisma.$queryRaw<Array<{ definition: string }>>`
    SELECT indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'notification_deliveries'
      AND indexname = 'notification_deliveries_retryable_idx'
  `;

  assert.equal(indexes.length, 1);
  assert.match(
    indexes[0]?.definition ?? "",
    /\(status, next_retry_at, created_at\)/,
  );
  assert.match(indexes[0]?.definition ?? "", /PENDING/);
  assert.match(indexes[0]?.definition ?? "", /RETRY_PENDING/);
});
