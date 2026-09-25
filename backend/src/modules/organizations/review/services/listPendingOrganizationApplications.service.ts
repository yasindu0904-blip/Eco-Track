import { z } from "zod";
import { ApplicationError } from "../../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import { listPendingOrganizationApplicationRecords } from "../repositories/organizationReview.repository.js";
import type { OrganizationReviewApplicationDto } from "../organizationReview.types.js";

export function listPendingOrganizationApplications(
  dependencies: OrganizationApplicationDependencies,
): Promise<OrganizationReviewApplicationDto[]> {
  return listPendingOrganizationApplicationRecords(dependencies.prisma);
}

export async function listPendingOrganizationApplicationPage(dependencies: OrganizationApplicationDependencies, query: { limit: number; cursor?: string }) {
  let cursor: { createdAt: Date; id: string } | null = null;
  if (query.cursor) {
    try {
      const value = z.object({ createdAt: z.iso.datetime(), id: z.uuid() }).parse(JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")));
      cursor = { createdAt: new Date(value.createdAt), id: value.id };
    } catch { throw new ApplicationError(400, "APPLICATION_CURSOR_INVALID", "The application cursor is invalid."); }
  }
  const records = await listPendingOrganizationApplicationRecords(dependencies.prisma, { limit: query.limit, cursor });
  const items = records.slice(0, query.limit);
  const last = items.at(-1);
  return { items, nextCursor: records.length > query.limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url") : null };
}
