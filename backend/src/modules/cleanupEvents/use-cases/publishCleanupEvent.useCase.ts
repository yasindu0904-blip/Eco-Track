import { NotificationType } from "../../../generated/prisma/enums.js";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { ApplicationError } from "../../../errors/applicationError.js";
import { createNotificationRecord } from "../../notifications/repositories/notification.repository.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import type {
  CleanupEventPublishCheckCode,
  CleanupEventPublishReadinessDto,
} from "../cleanupEvent.types.js";
import {
  findClaimingEventForIncident,
  findPublishCandidate,
  findPublishedWorkflowTransition,
  publishCleanupEventRecord,
  type CleanupEventPublishCandidate,
} from "../repositories/cleanupEvent.repository.js";

type EventDatabase = PrismaClient | Prisma.TransactionClient;

type ReadinessAssessment = CleanupEventPublishReadinessDto & {
  candidate: CleanupEventPublishCandidate;
  publishedWorkflowStatusId: string | null;
  incidentFromStatus: "ACTIVE" | "EXPIRED" | null;
  claimingEventId: string | null;
};

function scheduledInstant(session: CleanupEventPublishCandidate["sessions"][number]): Date {
  const date = session.sessionDate.toISOString().slice(0, 10);
  const time = session.startTime.toISOString().slice(11, 19);
  // Event session date/time fields are Sri Lankan local civil time, not UTC.
  return new Date(`${date}T${time}+05:30`);
}

function check(
  code: CleanupEventPublishCheckCode,
  ready: boolean,
  readyMessage: string,
  blockedMessage: string,
) {
  return { code, ready, message: ready ? readyMessage : blockedMessage };
}

async function assessPublishReadiness(
  prisma: EventDatabase,
  organizationId: string,
  eventId: string,
  now: Date,
): Promise<ReadinessAssessment> {
  const candidate = await findPublishCandidate(prisma, organizationId, eventId);
  if (!candidate) {
    throw new ApplicationError(
      404,
      "CLEANUP_EVENT_NOT_FOUND",
      "The cleanup event was not found in this organization.",
    );
  }

  const transition = await findPublishedWorkflowTransition(
    prisma,
    organizationId,
    candidate.currentWorkflowStatusId,
  );
  const activeCoordinators = candidate.coordinators.filter(
    ({ membership }) =>
      membership.organizationId === organizationId && membership.status === "ACTIVE",
  );
  const hasFutureSession = candidate.sessions.some(
    (session) => session.status === "SCHEDULED" && scheduledInstant(session) > now,
  );
  const publicDetailsReady = Boolean(
    candidate.title.trim().length >= 3 &&
      candidate.description.trim().length >= 10 &&
      candidate.publicInstructions?.trim() &&
      candidate.eventAddress?.trim(),
  );
  const organizationReview = candidate.incident?.reviews.find(
    (review) => review.organizationId === organizationId,
  );
  const incidentReviewReady = !candidate.incidentId || organizationReview?.status === "VALID";
  const incidentFromStatus = candidate.incident?.status === "ACTIVE" ||
      candidate.incident?.status === "EXPIRED"
    ? candidate.incident.status
    : null;
  const claimingEvent = candidate.incidentId
    ? await findClaimingEventForIncident(prisma, candidate.incidentId, candidate.id)
    : null;
  const incidentAvailable = !candidate.incidentId ||
    (incidentFromStatus !== null && claimingEvent === null);
  const workflowReady = candidate.lifecycleStatus === "DRAFT" && Boolean(transition);

  const checks = [
    check(
      "PUBLIC_DETAILS",
      publicDetailsReady,
      "Public description, instructions, and location are complete.",
      "Add public instructions and a clear event address before publishing.",
    ),
    check(
      "FUTURE_SESSION",
      hasFutureSession,
      "At least one future session is ready.",
      "Add at least one scheduled session with a future start time.",
    ),
    check(
      "ACTIVE_COORDINATOR",
      activeCoordinators.length > 0,
      "At least one active coordinator is assigned.",
      "Assign at least one active member as an event coordinator.",
    ),
    check(
      "WORKFLOW_TRANSITION",
      workflowReady,
      "The configured workflow allows publication.",
      "This event is not a publishable draft or its DRAFT to PUBLISHED transition is unavailable.",
    ),
    check(
      "INCIDENT_REVIEW",
      incidentReviewReady,
      candidate.incidentId
        ? "This organization has validated the linked incident."
        : "This direct event does not require an incident review.",
      "Mark the linked incident VALID for this organization before publishing.",
    ),
    check(
      "INCIDENT_AVAILABLE",
      incidentAvailable,
      candidate.incidentId
        ? "The linked incident is available to claim."
        : "This direct event does not claim an incident.",
      "The linked incident is unavailable or already has an active cleanup event.",
    ),
  ];

  return {
    eventId,
    ready: candidate.organization.status === "ACTIVE" && checks.every((item) => item.ready),
    checks,
    candidate,
    publishedWorkflowStatusId: transition?.toStatusId ?? null,
    incidentFromStatus,
    claimingEventId: claimingEvent?.id ?? null,
  };
}

export async function getCleanupEventPublishReadiness(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
): Promise<CleanupEventPublishReadinessDto> {
  const { candidate: _candidate, publishedWorkflowStatusId: _statusId,
    incidentFromStatus: _incidentStatus, claimingEventId: _claimingEventId, ...readiness } =
    await assessPublishReadiness(dependencies.prisma, organizationId, eventId, new Date());
  return readiness;
}

function isClaimConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && (error.code === "P2002" || error.code === "23505")) return true;
  return "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("cleanup_events_one_active_incident_claim_idx");
}

export async function publishCleanupEvent(
  dependencies: CleanupEventDependencies,
  command: {
    organizationId: string;
    eventId: string;
    actorUserId: string;
    actorMembershipId: string;
  },
): Promise<{ eventId: string; incidentUpdated: boolean }> {
  const existing = await findPublishCandidate(
    dependencies.prisma,
    command.organizationId,
    command.eventId,
  );
  if (existing?.lifecycleStatus === "PUBLISHED") {
    return { eventId: existing.id, incidentUpdated: Boolean(existing.incidentId) };
  }

  try {
    return await dependencies.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`cleanup-event:${command.eventId}`}))
      `;
      const readiness = await assessPublishReadiness(
        transaction,
        command.organizationId,
        command.eventId,
        new Date(),
      );
      if (!readiness.ready || !readiness.publishedWorkflowStatusId) {
        const failed = readiness.checks.filter((item) => !item.ready);
        if (readiness.claimingEventId) {
          throw new ApplicationError(
            409,
            "INCIDENT_ALREADY_CLAIMED",
            "Another cleanup event has already been published for this incident.",
            { eventId: readiness.claimingEventId },
          );
        }
        throw new ApplicationError(
          409,
          "CLEANUP_EVENT_NOT_READY",
          failed[0]?.message ?? "The cleanup event is not ready to publish.",
          { failedChecks: failed.map(({ code }) => code) },
        );
      }

      const publishedAt = new Date();
      const updated = await publishCleanupEventRecord(transaction, {
        ...command,
        fromWorkflowStatusId: readiness.candidate.currentWorkflowStatusId,
        toWorkflowStatusId: readiness.publishedWorkflowStatusId,
        incidentId: readiness.candidate.incidentId,
        incidentFromStatus: readiness.incidentFromStatus,
        publishedAt,
      });
      if (!updated) {
        throw new ApplicationError(
          409,
          "CLEANUP_EVENT_STATE_CHANGED",
          "The cleanup event or linked incident changed while it was being published.",
        );
      }

      const recipientUserIds = new Set(
        readiness.candidate.coordinators
          .filter(({ membership }) => membership.status === "ACTIVE")
          .map(({ membership }) => membership.userId),
      );
      if (readiness.candidate.incident) {
        recipientUserIds.add(readiness.candidate.incident.reporterUserId);
      }
      for (const userId of recipientUserIds) {
        await createNotificationRecord(transaction, {
          userId,
          organizationId: command.organizationId,
          type: NotificationType.EVENT_PUBLISHED,
          title: "Cleanup event published",
          message: `${readiness.candidate.organization.name} published ${readiness.candidate.title}.`,
          data: {
            eventId: command.eventId,
            organizationId: command.organizationId,
            ...(readiness.candidate.incidentId
              ? { incidentId: readiness.candidate.incidentId }
              : {}),
            status: "PUBLISHED",
          },
        });
      }

      return {
        eventId: command.eventId,
        incidentUpdated: Boolean(readiness.candidate.incidentId),
      };
    }, { timeout: 30_000 });
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    if (existing?.incidentId && isClaimConflict(error)) {
      const winner = await findClaimingEventForIncident(
        dependencies.prisma,
        existing.incidentId,
        command.eventId,
      );
      throw new ApplicationError(
        409,
        "INCIDENT_ALREADY_CLAIMED",
        "Another cleanup event has already been published for this incident.",
        winner ? { eventId: winner.id } : undefined,
      );
    }
    throw error;
  }
}
