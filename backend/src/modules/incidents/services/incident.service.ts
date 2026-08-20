import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { ApplicationError } from "../../../errors/applicationError.js";
import { NotificationType } from "../../../generated/prisma/enums.js";
import { createNotification } from "../../notifications/services/createNotification.service.js";
import { awardVerifiedIncidentReportContribution } from "../../rewards/services/awardContribution.service.js";
import {
  INCIDENT_SUBMISSION_RATE_LIMIT,
} from "../incident.constants.js";
import type { IncidentDependencies } from "../incident.dependencies.js";
import { observeSpatialQuery } from "../../maps/map.telemetry.js";
import type {
  EvidenceUploadIntentDto,
  IncidentDetailDto,
  IncidentListPageDto,
  IncidentSummaryDto,
  OrganizationIncidentDetailDto,
  OrganizationIncidentListPageDto,
  OrganizationIncidentReviewDto,
  OrganizationIncidentReviewMutationDto,
  PublicIncidentListPageDto,
  PublicIncidentSummaryDto,
} from "../incident.types.js";
import type {
  ValidatedCreateIncident,
  ValidatedEvidenceUploadRequest,
  ValidatedOrganizationIncidentDiscovery,
  ValidatedOrganizationIncidentReview,
  ValidatedOrganizationServiceAreaBoundaryQuery,
  ValidatedPublicIncidentRadiusDiscovery,
  ValidatedPublicIncidentViewportDiscovery,
} from "../incident.validation.js";
import {
  activeIncidentCategoryExists,
  createIncidentRecord,
  findIncidentBySubmission,
  findIncidentRecordByIdAndReporter,
  findCurrentOrganizationIncidentReview,
  findOrganizationIncidentAccess,
  findOrganizationIncidentDetailRecord,
  findPublicSafeIncidentRecordById,
  listActiveIncidentCategories,
  listIncidentRecordsByReporter,
  type IncidentDetailRecord,
  type IncidentListCursor,
  listCoveredOrganizationIncidents,
  lockOrganizationIncidentReview,
  listPublicIncidentsByRadius as queryPublicIncidentsByRadius,
  listPublicIncidentsByViewport as queryPublicIncidentsByViewport,
  type OrganizationIncidentDiscoveryCursor,
  type PublicIncidentDiscoveryRow,
  type OrganizationIncidentReviewRecord,
  upsertOrganizationIncidentReview,
} from "../repositories/incident.repository.js";
import { listOrganizationServiceAreaBoundaryFeatures } from "../../maps/repositories/mapSpatial.repository.js";

const recentSubmissionsByUser = new Map<string, number[]>();

function assertRateLimit(userId: string): void {
  const now = Date.now();
  const windowStart = now - INCIDENT_SUBMISSION_RATE_LIMIT.windowMilliseconds;
  const recent = (recentSubmissionsByUser.get(userId) ?? []).filter(
    (timestamp) => timestamp >= windowStart,
  );
  if (recent.length >= INCIDENT_SUBMISSION_RATE_LIMIT.maximum) {
    throw new ApplicationError(
      429,
      "INCIDENT_SUBMISSION_RATE_LIMITED",
      "Too many incident reports were submitted recently. Please wait before trying again.",
    );
  }
  recent.push(now);
  recentSubmissionsByUser.set(userId, recent);
}

function storageExtension(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function expectedStoragePrefix(userId: string, submissionId: string): string {
  return `incidents/${userId}/${submissionId}/`;
}

async function toDetailDto(
  dependencies: IncidentDependencies,
  record: IncidentDetailRecord,
): Promise<IncidentDetailDto> {
  const photos = await Promise.all(
    record.photos.map(async (photo) => ({
      id: photo.id,
      url: await dependencies.storage.createDownloadUrl(photo.storagePath),
      caption: photo.caption,
      sortOrder: photo.sortOrder,
    })),
  );
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category,
    severity: record.severity,
    status: record.status,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    addressText: record.addressText,
    reportedAt: record.reportedAt.toISOString(),
    highlightUntil: record.highlightUntil.toISOString(),
    archiveAfter: record.archiveAfter.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    thumbnailUrl: photos[0]?.url ?? null,
    photos,
    statusHistory: record.statusHistory.map((history) => ({
      id: history.id,
      fromStatus: history.fromStatus,
      toStatus: history.toStatus,
      reason: history.reason,
      changedAt: history.changedAt.toISOString(),
    })),
  };
}

function toOrganizationIncidentReviewDto(
  review: OrganizationIncidentReviewRecord,
): OrganizationIncidentReviewDto {
  return {
    id: review.id,
    status: review.status,
    reasonCode: review.reasonCode,
    privateNotes: review.privateNotes,
    reviewerName: review.reviewedBy.user.fullName ?? "Organization reviewer",
    firstViewedAt: review.firstViewedAt.toISOString(),
    reviewedAt: review.reviewedAt?.toISOString() ?? null,
    updatedAt: review.updatedAt.toISOString(),
  };
}

async function toSummaryDto(
  dependencies: IncidentDependencies,
  record: IncidentDetailRecord,
): Promise<IncidentSummaryDto> {
  const firstPhoto = record.photos[0];
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    severity: record.severity,
    status: record.status,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    addressText: record.addressText,
    reportedAt: record.reportedAt.toISOString(),
    thumbnailUrl: firstPhoto
      ? await dependencies.storage.createDownloadUrl(firstPhoto.storagePath)
      : null,
  };
}

export async function getActiveIncidentCategories(dependencies: IncidentDependencies) {
  return listActiveIncidentCategories(dependencies.prisma);
}

export async function createEvidenceUploadIntents(
  dependencies: IncidentDependencies,
  userId: string,
  request: ValidatedEvidenceUploadRequest,
): Promise<EvidenceUploadIntentDto[]> {
  return Promise.all(request.files.map(async (file) => {
    const storagePath = `${expectedStoragePrefix(userId, request.submissionId)}${randomUUID()}.${storageExtension(file.contentType)}`;
    const signed = await dependencies.storage.createUploadIntent(storagePath);
    return { storagePath, ...signed, ...file };
  }));
}

export async function createIncident(
  dependencies: IncidentDependencies,
  userId: string,
  input: ValidatedCreateIncident,
): Promise<{ incident: IncidentDetailDto; created: boolean }> {
  const existing = await findIncidentBySubmission(
    dependencies.prisma,
    userId,
    input.submissionId,
  );
  if (existing) {
    return { incident: await toDetailDto(dependencies, existing), created: false };
  }

  assertRateLimit(userId);

  if (!(await activeIncidentCategoryExists(dependencies.prisma, input.categoryId))) {
    throw new ApplicationError(422, "INCIDENT_CATEGORY_INACTIVE", "Select an active incident category.");
  }

  const expectedPrefix = expectedStoragePrefix(userId, input.submissionId);
  for (const evidence of input.evidence) {
    if (!evidence.storagePath.startsWith(expectedPrefix)) {
      throw new ApplicationError(422, "INCIDENT_EVIDENCE_PATH_INVALID", "A photo does not belong to this report submission.");
    }
    if (!(await dependencies.storage.objectExists(evidence.storagePath))) {
      throw new ApplicationError(422, "INCIDENT_EVIDENCE_MISSING", `The upload for ${evidence.originalFileName} is incomplete.`);
    }
  }

  try {
    const record = await createIncidentRecord(dependencies.prisma, userId, input);
    return { incident: await toDetailDto(dependencies, record), created: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const replay = await findIncidentBySubmission(
        dependencies.prisma,
        userId,
        input.submissionId,
      );
      if (replay) {
        return { incident: await toDetailDto(dependencies, replay), created: false };
      }
    }
    throw error;
  }
}

function decodeCursor(encoded: string): IncidentListCursor {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      reportedAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.reportedAt !== "string" || typeof parsed.id !== "string") throw new Error();
    const reportedAt = new Date(parsed.reportedAt);
    if (Number.isNaN(reportedAt.getTime())) throw new Error();
    return { reportedAt, id: parsed.id };
  } catch {
    throw new ApplicationError(400, "INCIDENT_CURSOR_INVALID", "The reports cursor is invalid.");
  }
}

function encodeCursor(record: IncidentDetailRecord): string {
  return Buffer.from(JSON.stringify({
    reportedAt: record.reportedAt.toISOString(),
    id: record.id,
  }), "utf8").toString("base64url");
}

export async function listMyIncidents(
  dependencies: IncidentDependencies,
  input: { userId: string; limit: number; cursor?: string },
): Promise<IncidentListPageDto> {
  const records = await listIncidentRecordsByReporter(dependencies.prisma, {
    reporterUserId: input.userId,
    limit: input.limit,
    cursor: input.cursor ? decodeCursor(input.cursor) : null,
  });
  const hasMore = records.length > input.limit;
  const page = hasMore ? records.slice(0, input.limit) : records;
  return {
    items: await Promise.all(page.map((record) => toSummaryDto(dependencies, record))),
    nextCursor: hasMore && page.at(-1) ? encodeCursor(page.at(-1)!) : null,
  };
}

export async function getMyIncident(
  dependencies: IncidentDependencies,
  userId: string,
  id: string,
): Promise<IncidentDetailDto> {
  const record = await findIncidentRecordByIdAndReporter(dependencies.prisma, id, userId);
  if (!record) throw new ApplicationError(404, "INCIDENT_NOT_FOUND", "The requested report was not found.");
  return toDetailDto(dependencies, record);
}

export async function getPublicSafeIncident(
  dependencies: IncidentDependencies,
  id: string,
): Promise<IncidentDetailDto> {
  const record = await findPublicSafeIncidentRecordById(dependencies.prisma, id);
  if (!record) throw new ApplicationError(404, "INCIDENT_NOT_FOUND", "The requested incident was not found.");
  return toDetailDto(dependencies, record);
}

export async function getOrganizationIncidentDetail(
  dependencies: IncidentDependencies,
  organizationId: string,
  incidentId: string,
): Promise<OrganizationIncidentDetailDto> {
  const record = await findOrganizationIncidentDetailRecord(
    dependencies.prisma,
    organizationId,
    incidentId,
  );
  if (!record) {
    throw new ApplicationError(
      404,
      "ORGANIZATION_INCIDENT_NOT_FOUND",
      "The incident is not available in this organization workspace.",
    );
  }

  return {
    ...(await toDetailDto(dependencies, record.incident)),
    falseReviewCount: record.falseReviewCount,
    accessSource: record.access.accessSource,
    currentReview: record.currentReview
      ? toOrganizationIncidentReviewDto(record.currentReview)
      : null,
  };
}

function normalizedPrivateNotes(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function updateOrganizationIncidentReview(
  dependencies: IncidentDependencies,
  context: {
    organizationId: string;
    membershipId: string;
    reviewerUserId: string;
  },
  incidentId: string,
  input: ValidatedOrganizationIncidentReview,
): Promise<OrganizationIncidentReviewMutationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await lockOrganizationIncidentReview(
      transaction,
      context.organizationId,
      incidentId,
    );

    const access = await findOrganizationIncidentAccess(
      transaction,
      context.organizationId,
      incidentId,
    );
    if (!access) {
      throw new ApplicationError(
        404,
        "ORGANIZATION_INCIDENT_NOT_FOUND",
        "The incident is not available in this organization workspace.",
      );
    }

    const current = await findCurrentOrganizationIncidentReview(
      transaction,
      context.organizationId,
      incidentId,
    );
    if (
      input.status === "VIEWED" &&
      current &&
      current.status !== "VIEWED"
    ) {
      throw new ApplicationError(
        409,
        "INCIDENT_REVIEW_TRANSITION_INVALID",
        "A completed VALID or FALSE decision cannot be changed back to VIEWED.",
      );
    }

    const reasonCode = input.status === "FALSE"
      ? input.reasonCode ?? null
      : null;
    const privateNotes = normalizedPrivateNotes(input.privateNotes);
    const idempotentReplay =
      current?.status === input.status &&
      current.reasonCode === reasonCode &&
      current.privateNotes === privateNotes;

    if (idempotentReplay && current) {
      return {
        review: toOrganizationIncidentReviewDto(current),
        rewardAwarded: false,
        idempotentReplay: true,
      };
    }

    const reviewedAt = input.status === "VIEWED" ? null : new Date();
    const review = await upsertOrganizationIncidentReview(transaction, {
      organizationId: context.organizationId,
      incidentId,
      membershipId: context.membershipId,
      status: input.status,
      reasonCode,
      privateNotes,
      reviewedAt,
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: context.reviewerUserId,
        organizationId: context.organizationId,
        action: "INCIDENT_REVIEW_UPDATED",
        entityType: "IncidentReview",
        entityId: review.id,
        metadata: {
          incidentId,
          previousStatus: current?.status ?? null,
          status: input.status,
          reasonCode,
          hasPrivateNotes: privateNotes !== null,
        },
      },
    });

    let rewardAwarded = false;
    if (input.status === "VALID") {
      const reward = await awardVerifiedIncidentReportContribution(
        transaction,
        incidentId,
      );
      rewardAwarded = reward.created;
    }

    if (input.status !== "VIEWED") {
      await createNotification(
        { prisma: transaction },
        {
          userId: access.reporterUserId,
          organizationId: context.organizationId,
          type: NotificationType.INCIDENT_STATUS_CHANGED,
          title: "Incident report reviewed",
          message: input.status === "VALID"
            ? "An authorized cleanup organization validated your incident report."
            : "A cleanup organization marked your incident report as needing further verification.",
          data: {
            incidentId,
            organizationId: context.organizationId,
            status: input.status,
          },
        },
      );
    }

    return {
      review: toOrganizationIncidentReviewDto(review),
      rewardAwarded,
      idempotentReplay: false,
    };
  }, { timeout: 30_000 });
}

function decodeIncidentDiscoveryCursor(
  encoded: string,
): OrganizationIncidentDiscoveryCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as { reportedAt?: unknown; id?: unknown };
    if (
      typeof parsed.reportedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(
        parsed.reportedAt,
      ) ||
      Number.isNaN(new Date(parsed.reportedAt).getTime())
    ) {
      throw new Error();
    }
    return { reportedAt: parsed.reportedAt, id: parsed.id };
  } catch {
    throw new ApplicationError(
      400,
      "INCIDENT_CURSOR_INVALID",
      "The incident discovery cursor is invalid.",
    );
  }
}

function encodeIncidentDiscoveryCursor(record: {
  id: string;
  cursorReportedAt: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      reportedAt: record.cursorReportedAt,
      id: record.id,
    }),
    "utf8",
  ).toString("base64url");
}

function toPublicIncidentSummary(
  row: PublicIncidentDiscoveryRow,
): PublicIncidentSummaryDto {
  return {
    id: row.id,
    title: row.title,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      description: row.categoryDescription,
    },
    severity: row.severity,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    addressText: row.addressText,
    reportedAt: row.reportedAt.toISOString(),
    falseReviewCount: row.falseReviewCount,
    isOwnReport: row.isOwnReport,
  };
}

function toPublicIncidentPage(
  rows: PublicIncidentDiscoveryRow[],
  limit: number,
): PublicIncidentListPageDto {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map(toPublicIncidentSummary),
    nextCursor:
      hasMore && last ? encodeIncidentDiscoveryCursor(last) : null,
  };
}

export async function listPublicIncidentsByViewport(
  dependencies: IncidentDependencies,
  input: ValidatedPublicIncidentViewportDiscovery,
  currentUserId: string,
): Promise<PublicIncidentListPageDto> {
  const rows = await observeSpatialQuery(dependencies.spatialQueryObserver, {
    operation: "incidents.public", projection: "PUBLIC", mode: "VIEWPORT",
  }, () => queryPublicIncidentsByViewport(dependencies.prisma, {
    ...input,
    currentUserId,
    cursor: input.cursor ? decodeIncidentDiscoveryCursor(input.cursor) : null,
    reportedAfter: input.reportedAfter
      ? new Date(input.reportedAfter)
      : undefined,
  }));

  return toPublicIncidentPage(rows, input.limit);
}

export async function listPublicIncidentsByRadius(
  dependencies: IncidentDependencies,
  input: ValidatedPublicIncidentRadiusDiscovery,
  currentUserId: string,
): Promise<PublicIncidentListPageDto> {
  const rows = await observeSpatialQuery(dependencies.spatialQueryObserver, {
    operation: "incidents.public", projection: "PUBLIC", mode: "RADIUS",
  }, () => queryPublicIncidentsByRadius(dependencies.prisma, {
    ...input,
    currentUserId,
    cursor: input.cursor ? decodeIncidentDiscoveryCursor(input.cursor) : null,
    reportedAfter: input.reportedAfter
      ? new Date(input.reportedAfter)
      : undefined,
  }));

  return toPublicIncidentPage(rows, input.limit);
}

export async function listOrganizationIncidents(
  dependencies: IncidentDependencies,
  organizationId: string,
  input: ValidatedOrganizationIncidentDiscovery,
): Promise<OrganizationIncidentListPageDto> {
  const rows = await observeSpatialQuery(dependencies.spatialQueryObserver, {
    operation: "incidents.organization", projection: "ORGANIZATION", mode: "VIEWPORT",
  }, () => listCoveredOrganizationIncidents(dependencies.prisma, {
      organizationId,
      ...input,
      cursor: input.cursor
        ? decodeIncidentDiscoveryCursor(input.cursor)
        : null,
      reportedAfter: input.reportedAfter
        ? new Date(input.reportedAfter)
        : undefined,
  }));
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map((row) => ({
      id: row.id,
      title: row.title,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        description: row.categoryDescription,
      },
      severity: row.severity,
      status: row.status,
      latitude: row.latitude,
      longitude: row.longitude,
      addressText: row.addressText,
      reportedAt: row.reportedAt.toISOString(),
      falseReviewCount: row.falseReviewCount,
      currentReviewStatus: row.currentReviewStatus,
    })),
    nextCursor:
      hasMore && last ? encodeIncidentDiscoveryCursor(last) : null,
  };
}

export function listOrganizationServiceAreaBoundaries(
  dependencies: IncidentDependencies,
  organizationId: string,
  query: ValidatedOrganizationServiceAreaBoundaryQuery,
) {
  return observeSpatialQuery(dependencies.spatialQueryObserver, {
    operation: "service_areas.organization", projection: "ORGANIZATION", mode: "BOUNDARY",
  }, () => listOrganizationServiceAreaBoundaryFeatures(
    dependencies.prisma,
    organizationId,
    query,
  ), (collection) => collection.features.length);
}
