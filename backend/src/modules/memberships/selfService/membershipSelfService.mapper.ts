import { ApplicationError } from "../../../errors/applicationError.js";

import type {
  MembershipRequestCursor,
  MembershipRequestDto,
  OrganizationSearchCursor,
  PublicOrganizationDto,
} from "./membershipSelfService.types.js";
import {
  membershipRequestCursorSchema,
  organizationSearchCursorSchema,
} from "./membershipSelfService.validation.js";

type PublicOrganizationRecord = PublicOrganizationDto;

type MembershipRequestRecord = {
  id: string;
  message: string | null;
  status: MembershipRequestDto["status"];
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  organization: PublicOrganizationRecord;
};

function encodeCursor(payload: object): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new ApplicationError(
      400,
      "PAGINATION_CURSOR_INVALID",
      "The pagination cursor is invalid.",
    );
  }
}

export function encodeOrganizationCursor(
  organization: OrganizationSearchCursor,
): string {
  return encodeCursor(organization);
}

export function decodeOrganizationCursor(
  cursor: string,
): OrganizationSearchCursor {
  const parsed = organizationSearchCursorSchema.safeParse(decodeCursor(cursor));

  if (!parsed.success) {
    throw new ApplicationError(
      400,
      "PAGINATION_CURSOR_INVALID",
      "The organization pagination cursor is invalid.",
    );
  }

  return parsed.data;
}

export function encodeMembershipRequestCursor(
  request: MembershipRequestCursor,
): string {
  return encodeCursor({
    createdAt: request.createdAt.toISOString(),
    id: request.id,
  });
}

export function decodeMembershipRequestCursor(
  cursor: string,
): MembershipRequestCursor {
  const parsed = membershipRequestCursorSchema.safeParse(decodeCursor(cursor));

  if (!parsed.success) {
    throw new ApplicationError(
      400,
      "PAGINATION_CURSOR_INVALID",
      "The membership-request pagination cursor is invalid.",
    );
  }

  return {
    createdAt: new Date(parsed.data.createdAt),
    id: parsed.data.id,
  };
}

export function toMembershipRequestDto(
  request: MembershipRequestRecord,
): MembershipRequestDto {
  return {
    id: request.id,
    organization: request.organization,
    message: request.message,
    status: request.status,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewNotes: request.reviewNotes,
    createdAt: request.createdAt.toISOString(),
  };
}
