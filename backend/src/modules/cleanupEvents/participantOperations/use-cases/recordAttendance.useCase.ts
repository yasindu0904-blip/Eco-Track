import { ApplicationError } from "../../../../errors/applicationError.js";
import { awardEventAttendanceContribution } from "../../../rewards/services/awardContribution.service.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import {
  findParticipantOperationRecord,
  findParticipantOperationsEvent,
} from "../participantOperations.repository.js";
import {
  notifyParticipantOperation,
  requireAttendanceOpen,
  requireOperationalLifecycle,
  toParticipantOperationDto,
} from "../participantOperations.support.js";
import type { EventParticipantOperationDto } from "../participantOperations.types.js";
import type { ValidatedRecordAttendance } from "../participantOperations.validation.js";

export async function recordAttendance(
  dependencies: CleanupEventDependencies,
  input: ValidatedRecordAttendance & {
    organizationId: string;
    eventId: string;
    participantId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<EventParticipantOperationDto> {
  return dependencies.prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-attendance:${input.participantId}`}))`;
      const event = await findParticipantOperationsEvent(
        transaction,
        input.organizationId,
        input.eventId,
      );
      if (!event)
        throw new ApplicationError(
          404,
          "CLEANUP_EVENT_NOT_FOUND",
          "The organization cleanup event was not found.",
        );
      requireOperationalLifecycle(event.lifecycleStatus);
      requireAttendanceOpen(event);
      const participant = await findParticipantOperationRecord(
        transaction,
        input.organizationId,
        input.eventId,
        input.participantId,
      );
      if (!participant)
        throw new ApplicationError(
          404,
          "EVENT_PARTICIPANT_NOT_FOUND",
          "The event participant was not found.",
        );
      if (participant.status !== "JOINED")
        throw new ApplicationError(
          409,
          "PARTICIPANT_NOT_ACTIVE",
          "Attendance can only be marked for a joined volunteer.",
        );
      if (participant.attendanceStatus === input.status)
        return toParticipantOperationDto(participant);
      if (participant.attendanceStatus === "ATTENDED")
        throw new ApplicationError(
          409,
          "ATTENDANCE_ALREADY_CONFIRMED",
          "Confirmed attendance cannot be reversed.",
        );
      const now = new Date();
      const changed = await transaction.eventParticipant.updateMany({
        where: {
          id: participant.id,
          attendanceStatus: participant.attendanceStatus,
        },
        data: {
          attendanceStatus: input.status,
          attendanceMarkedAt: now,
          attendanceMarkedByMembershipId: input.actorMembershipId,
        },
      });
      if (changed.count !== 1)
        throw new ApplicationError(
          409,
          "ATTENDANCE_CONFLICT",
          "Attendance changed in another request. Refresh and retry.",
        );
      if (input.status === "ATTENDED")
        await awardEventAttendanceContribution(transaction, participant.id);
      await transaction.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          organizationId: input.organizationId,
          action: "EVENT_ATTENDANCE_RECORDED",
          entityType: "EventParticipant",
          entityId: participant.id,
          metadata: { eventId: event.id, status: input.status },
        },
      });
      await notifyParticipantOperation(transaction, {
        userId: participant.userId,
        organizationId: input.organizationId,
        eventId: event.id,
        title:
          input.status === "ATTENDED"
            ? "Cleanup attendance confirmed"
            : "Cleanup absence recorded",
        message: `Your attendance for ${event.title} was recorded as ${input.status.toLowerCase()}.`,
        status: input.status,
      });
      const saved = await findParticipantOperationRecord(
        transaction,
        input.organizationId,
        input.eventId,
        participant.id,
      );
      if (!saved)
        throw new ApplicationError(
          500,
          "PARTICIPANT_SAVE_FAILED",
          "The attendance record could not be loaded.",
        );
      return toParticipantOperationDto(saved);
    },
    { timeout: 30_000 },
  );
}
