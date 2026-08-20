import { ApplicationError } from "../../../../errors/applicationError.js";
import { awardSessionAttendanceContribution } from "../../../rewards/services/awardContribution.service.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import { findAllocationOperationRecord, findParticipantOperationsEvent } from "../participantOperations.repository.js";
import { hasSessionStarted, notifyParticipantOperation, requireOperationalLifecycle, toAllocationDto } from "../participantOperations.support.js";
import type { ParticipantOperationAllocationDto } from "../participantOperations.types.js";
import type { ValidatedRecordAttendance } from "../participantOperations.validation.js";

export async function recordAttendance(
  dependencies: CleanupEventDependencies,
  input: ValidatedRecordAttendance & {
    organizationId: string;
    eventId: string;
    allocationId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<ParticipantOperationAllocationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-attendance:${input.allocationId}`}))`;
    const event = await findParticipantOperationsEvent(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    requireOperationalLifecycle(event.lifecycleStatus);
    const allocation = await findAllocationOperationRecord(transaction, input.organizationId, input.eventId, input.allocationId);
    if (!allocation) throw new ApplicationError(404, "SESSION_ALLOCATION_NOT_FOUND", "The session allocation was not found.");
    if (allocation.status === input.status) return toAllocationDto(allocation);
    if (allocation.status === "ATTENDED") {
      throw new ApplicationError(409, "ATTENDANCE_ALREADY_CONFIRMED", "Confirmed attendance cannot be reversed.");
    }
    if (allocation.status === "REMOVED") {
      throw new ApplicationError(409, "ALLOCATION_REMOVED", "Attendance cannot be recorded for a removed allocation.");
    }
    if (allocation.session.status === "CANCELLED" || !hasSessionStarted(allocation.session.sessionDate, allocation.session.startTime, new Date())) {
      throw new ApplicationError(409, "ATTENDANCE_NOT_OPEN", "Attendance opens after a non-cancelled session starts.");
    }
    const now = new Date();
    const changed = await transaction.sessionAllocation.updateMany({
      where: { id: allocation.id, status: allocation.status },
      data: {
        status: input.status,
        attendanceMarkedByMembershipId: input.actorMembershipId,
        attendanceMarkedAt: now,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    if (changed.count !== 1) throw new ApplicationError(409, "ATTENDANCE_CONFLICT", "Attendance changed in another request. Refresh and retry.");
    const saved = await transaction.sessionAllocation.findUniqueOrThrow({ where: { id: allocation.id } });
    if (input.status === "ATTENDED") {
      await awardSessionAttendanceContribution(transaction, saved.id);
    }
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "EVENT_SESSION_ATTENDANCE_RECORDED",
      entityType: "SessionAllocation",
      entityId: saved.id,
      metadata: { eventId: event.id, participantId: allocation.participantId, sessionId: allocation.sessionId, status: input.status },
    } });
    await notifyParticipantOperation(transaction, {
      userId: allocation.participant.userId,
      organizationId: input.organizationId,
      eventId: event.id,
      sessionId: allocation.sessionId,
      title: input.status === "ATTENDED" ? "Cleanup attendance confirmed" : "Cleanup absence recorded",
      message: `Your session attendance for ${event.title} was recorded as ${input.status.toLowerCase()}.`,
      status: input.status,
    });
    return toAllocationDto(saved);
  }, { timeout: 30_000 });
}

