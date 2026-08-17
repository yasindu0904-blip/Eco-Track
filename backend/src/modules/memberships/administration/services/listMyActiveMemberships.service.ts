import type { MembershipAdministrationDependencies } from "../membershipAdministration.dependencies.js";
import {
  decodeOrganizationNameCursor,
  encodeOrganizationNameCursor,
  toActiveOrganizationMembershipDto,
} from "../membershipAdministration.mapper.js";
import type { ActiveOrganizationMembershipPageDto } from "../membershipAdministration.types.js";
import { listActiveMembershipRecords } from "../repositories/membershipAdministration.repository.js";

export async function listMyActiveMemberships(
  dependencies: MembershipAdministrationDependencies,
  command: { userId: string; cursor?: string; limit: number },
): Promise<ActiveOrganizationMembershipPageDto> {
  const records = await listActiveMembershipRecords(dependencies.prisma, {
    userId: command.userId,
    cursor: command.cursor ? decodeOrganizationNameCursor(command.cursor) : null,
    limit: command.limit,
  });
  const hasMore = records.length > command.limit;
  const page = hasMore ? records.slice(0, command.limit) : records;
  const last = page.at(-1);
  return {
    items: page.map(toActiveOrganizationMembershipDto),
    nextCursor:
      hasMore && last
        ? encodeOrganizationNameCursor({ name: last.organization.name, id: last.id })
        : null,
  };
}
