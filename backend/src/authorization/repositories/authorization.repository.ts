import { prisma } from "../../database/prisma.js";

import type {
  ActiveTenantContext,
  EventAuthorizationContext,
} from "../authorization.types.js";

export async function findActiveTenantContext(
  userId: string,
  organizationId: string,
): Promise<ActiveTenantContext | null> {
  const membership =
    await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        organization: {
          status: "ACTIVE",
        },
      },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        role: true,
        status: true,
        organization: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

  if (!membership) {
    return null;
  }

  return {
    organization: membership.organization,
    membership: {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    },
  };
}

export async function findEventAuthorizationContext(
  organizationId: string,
  membershipId: string,
  cleanupEventId: string,
): Promise<EventAuthorizationContext | null> {
  const cleanupEvent =
    await prisma.cleanupEvent.findFirst({
      where: {
        id: cleanupEventId,
        organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        lifecycleStatus: true,
        coordinators: {
          where: {
            membershipId,
            removedAt: null,
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

  if (!cleanupEvent) {
    return null;
  }

  return {
    cleanupEvent: {
      id: cleanupEvent.id,
      organizationId:
        cleanupEvent.organizationId,
      lifecycleStatus:
        cleanupEvent.lifecycleStatus,
    },
    isCoordinator:
      cleanupEvent.coordinators.length > 0,
  };
}
