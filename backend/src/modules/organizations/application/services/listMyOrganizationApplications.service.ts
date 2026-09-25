import { z } from "zod";
import { ApplicationError } from "../../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import type { OrganizationApplicationDto } from "../application.types.js";
import { listOrganizationApplicationRecordsByRequester } from "../repositories/organizationApplication.repository.js";

export async function listMyOrganizationApplications(
  dependencies: OrganizationApplicationDependencies,
  requesterUserId: string,
): Promise<OrganizationApplicationDto[]> {
  return listOrganizationApplicationRecordsByRequester(
    dependencies.prisma,
    requesterUserId,
  );
}

export async function listMyOrganizationApplicationPage(dependencies: OrganizationApplicationDependencies, requesterUserId: string,
  query: { section: "pending" | "approved" | "declined" | "all"; limit: number; cursor?: string }) {
  let cursor: { createdAt: Date; id: string } | null = null;
  if (query.cursor) {
    try {
      const value = z.object({ createdAt: z.iso.datetime(), id: z.uuid() }).parse(JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")));
      cursor = { createdAt: new Date(value.createdAt), id: value.id };
    } catch { throw new ApplicationError(400, "APPLICATION_CURSOR_INVALID", "The application cursor is invalid."); }
  }
  const records = await listOrganizationApplicationRecordsByRequester(dependencies.prisma, requesterUserId, { ...query, cursor });
  const items = records.slice(0, query.limit);
  const last = items.at(-1);
  return { items, nextCursor: records.length > query.limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url") : null };
}
