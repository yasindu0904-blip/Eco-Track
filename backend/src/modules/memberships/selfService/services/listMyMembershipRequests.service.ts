import type { MembershipSelfServiceDependencies } from "../membershipSelfService.dependencies.js";
import {
  decodeMembershipRequestCursor,
  encodeMembershipRequestCursor,
  toMembershipRequestDto,
} from "../membershipSelfService.mapper.js";
import type { MembershipRequestPageDto } from "../membershipSelfService.types.js";
import { listMembershipRequestRecordsByRequester } from "../repositories/membershipSelfService.repository.js";

export async function listMyMembershipRequests(
  dependencies: MembershipSelfServiceDependencies,
  command: {
    requesterUserId: string;
    cursor?: string;
    limit: number;
  },
): Promise<MembershipRequestPageDto> {
  const requests = await listMembershipRequestRecordsByRequester(
    dependencies.prisma,
    {
      requesterUserId: command.requesterUserId,
      cursor: command.cursor
        ? decodeMembershipRequestCursor(command.cursor)
        : null,
      limit: command.limit,
    },
  );
  const hasNextPage = requests.length > command.limit;
  const pageRecords = requests.slice(0, command.limit);
  const lastRecord = pageRecords.at(-1);

  return {
    items: pageRecords.map(toMembershipRequestDto),
    nextCursor:
      hasNextPage && lastRecord
        ? encodeMembershipRequestCursor(lastRecord)
        : null,
  };
}
