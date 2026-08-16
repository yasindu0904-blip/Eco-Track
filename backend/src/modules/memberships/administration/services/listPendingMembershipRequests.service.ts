import type { MembershipAdministrationDependencies } from "../membershipAdministration.dependencies.js";
import {
  decodeDateIdCursor,
  encodeDateIdCursor,
  toAdminMembershipRequestDto,
} from "../membershipAdministration.mapper.js";
import type { AdminMembershipRequestPageDto } from "../membershipAdministration.types.js";
import { listPendingMembershipRequestRecords } from "../repositories/membershipAdministration.repository.js";

export async function listPendingMembershipRequests(
  dependencies: MembershipAdministrationDependencies,
  command: { organizationId: string; cursor?: string; limit: number },
): Promise<AdminMembershipRequestPageDto> {
  const records = await listPendingMembershipRequestRecords(dependencies.prisma, {
    organizationId: command.organizationId,
    cursor: command.cursor ? decodeDateIdCursor(command.cursor) : null,
    limit: command.limit,
  });
  const hasMore = records.length > command.limit;
  const page = hasMore ? records.slice(0, command.limit) : records;
  const last = page.at(-1);
  return {
    items: page.map(toAdminMembershipRequestDto),
    nextCursor: hasMore && last ? encodeDateIdCursor({ date: last.createdAt, id: last.id }) : null,
  };
}
