import { ApplicationError } from "../../../../errors/applicationError.js";

import type { MembershipSelfServiceDependencies } from "../membershipSelfService.dependencies.js";
import { toMembershipRequestDto } from "../membershipSelfService.mapper.js";
import type { MembershipRequestDto } from "../membershipSelfService.types.js";
import { findMembershipRequestRecordByIdAndRequester } from "../repositories/membershipSelfService.repository.js";

export async function getMyMembershipRequest(
  dependencies: MembershipSelfServiceDependencies,
  requesterUserId: string,
  requestId: string,
): Promise<MembershipRequestDto> {
  const request = await findMembershipRequestRecordByIdAndRequester(
    dependencies.prisma,
    requestId,
    requesterUserId,
  );

  if (!request) {
    throw new ApplicationError(
      404,
      "MEMBERSHIP_REQUEST_NOT_FOUND",
      "The membership request could not be found.",
    );
  }

  return toMembershipRequestDto(request);
}
