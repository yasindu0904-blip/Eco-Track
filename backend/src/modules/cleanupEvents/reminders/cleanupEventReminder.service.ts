import { MembershipRole, MembershipStatus, NotificationType, ParticipantStatus } from "../../../generated/prisma/enums.js";
import { createNotification } from "../../notifications/services/createNotification.service.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";

const REMINDER_BATCH_SIZE = 25;

export async function processDueCleanupEventReminders(
  dependencies: Pick<CleanupEventDependencies, "prisma">,
  now = new Date(),
): Promise<number> {
  const due = await dependencies.prisma.cleanupEventReminder.findMany({
    where: {
      scheduledFor: { lte: now },
      processedAt: null,
      cancelledAt: null,
      cleanupEvent: { lifecycleStatus: "PUBLISHED" },
    },
    orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
    take: REMINDER_BATCH_SIZE,
    select: { id: true },
  });

  let processed = 0;

  for (const { id } of due) {
    const completed = await dependencies.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cleanup-event-reminder:${id}`}))`;
      const reminder = await transaction.cleanupEventReminder.findFirst({
        where: { id, processedAt: null, cancelledAt: null },
        select: {
          id: true,
          cleanupEvent: {
            select: {
              id: true,
              organizationId: true,
              title: true,
              startsAt: true,
              lifecycleStatus: true,
              participants: {
                where: { status: ParticipantStatus.JOINED },
                select: { userId: true },
              },
              coordinators: {
                where: { removedAt: null },
                select: { membership: { select: { userId: true, status: true } } },
              },
              organization: {
                select: {
                  memberships: {
                    where: { role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE },
                    select: { userId: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!reminder || reminder.cleanupEvent.lifecycleStatus !== "PUBLISHED" || !reminder.cleanupEvent.startsAt) {
        return false;
      }

      const event = reminder.cleanupEvent;
      const startsAt = event.startsAt;
      if (!startsAt) return false;
      if (startsAt <= now) {
        await transaction.cleanupEventReminder.update({
          where: { id: reminder.id },
          data: { processedAt: now },
        });
        return true;
      }
      const recipientIds = new Set<string>([
        ...event.participants.map(({ userId }) => userId),
        ...event.coordinators
          .filter(({ membership }) => membership.status === MembershipStatus.ACTIVE)
          .map(({ membership }) => membership.userId),
        ...event.organization.memberships.map(({ userId }) => userId),
      ]);

      for (const userId of recipientIds) {
        await createNotification(
          { prisma: transaction },
          {
            userId,
            organizationId: event.organizationId,
            type: NotificationType.EVENT_REMINDER,
            title: "Cleanup event starts in 30 minutes",
            message: `${event.title} is starting soon. Open EcoTrack for the event location and latest updates.`,
            data: {
              eventId: event.id,
              organizationId: event.organizationId,
              startsAt: startsAt.toISOString(),
              status: "UPCOMING",
            },
            deduplicationKey: `event-reminder:${event.id}:${userId}`,
          },
        );
      }

      await transaction.cleanupEventReminder.update({
        where: { id: reminder.id },
        data: { processedAt: now },
      });
      return true;
    }, { timeout: 30_000 });

    if (completed) processed += 1;
  }

  return processed;
}
