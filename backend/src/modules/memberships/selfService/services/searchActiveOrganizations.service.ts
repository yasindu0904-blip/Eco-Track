import type { MembershipSelfServiceDependencies } from "../membershipSelfService.dependencies.js";
import {
  decodeOrganizationCursor,
  encodeOrganizationCursor,
} from "../membershipSelfService.mapper.js";
import type { OrganizationSearchPageDto } from "../membershipSelfService.types.js";
import { searchActiveOrganizationRecords } from "../repositories/membershipSelfService.repository.js";

export async function searchActiveOrganizations(
  dependencies: MembershipSelfServiceDependencies,
  command: {
    query: string;
    cursor?: string;
    limit: number;
  },
): Promise<OrganizationSearchPageDto> {
  const organizations = await searchActiveOrganizationRecords(
    dependencies.prisma,
    {
      query: command.query,
      cursor: command.cursor
        ? decodeOrganizationCursor(command.cursor)
        : null,
      limit: command.limit,
    },
  );
  const hasNextPage = organizations.length > command.limit;
  const items = organizations.slice(0, command.limit);
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      hasNextPage && lastItem
        ? encodeOrganizationCursor({
            name: lastItem.name,
            id: lastItem.id,
          })
        : null,
  };
}
