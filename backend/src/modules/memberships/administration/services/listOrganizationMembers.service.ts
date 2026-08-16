import type { MembershipRole, MembershipStatus } from "../../../../generated/prisma/enums.js";

import type { MembershipAdministrationDependencies } from "../membershipAdministration.dependencies.js";
import {
  decodeDateIdCursor,
  encodeDateIdCursor,
  toOrganizationMemberDto,
} from "../membershipAdministration.mapper.js";
import type { OrganizationMemberPageDto } from "../membershipAdministration.types.js";
import { listOrganizationMemberRecords } from "../repositories/membershipAdministration.repository.js";

export async function listOrganizationMembers(
  dependencies: MembershipAdministrationDependencies,
  command: {
    organizationId: string;
    query: string;
    role?: MembershipRole;
    status?: MembershipStatus;
    cursor?: string;
    limit: number;
  },
): Promise<OrganizationMemberPageDto> {
  const records = await listOrganizationMemberRecords(dependencies.prisma, {
    ...command,
    cursor: command.cursor ? decodeDateIdCursor(command.cursor) : null,
  });
  const hasMore = records.length > command.limit;
  const page = hasMore ? records.slice(0, command.limit) : records;
  const last = page.at(-1);
  return {
    items: page.map(toOrganizationMemberDto),
    nextCursor: hasMore && last ? encodeDateIdCursor({ date: last.joinedAt, id: last.id }) : null,
  };
}
