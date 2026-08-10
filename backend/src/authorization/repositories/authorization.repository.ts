import { prisma } from "../../database/prisma.js";

import type { ActiveTenantContext } from "../authorization.types.js";

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
