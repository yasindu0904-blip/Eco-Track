import { ApplicationError } from "../../../errors/applicationError.js";

import type {
  ActiveOrganizationMembershipDto,
  AdminMembershipRequestDto,
  DateIdCursor,
  OrganizationMemberDto,
  OrganizationNameCursor,
} from "./membershipAdministration.types.js";
import {
  dateIdCursorSchema,
  organizationNameCursorSchema,
} from "./membershipAdministration.validation.js";

type AdminMembershipRequestRecord = {
  id: string;
  message: string | null;
  status: AdminMembershipRequestDto["status"];
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  requester: {
    id: string;
    fullName: string | null;
    email: string;
    phoneNumber: string | null;
  };
};

type OrganizationMemberRecord = {
  id: string;
  role: OrganizationMemberDto["role"];
  status: OrganizationMemberDto["status"];
  source: string;
  joinedAt: Date;
  endedAt: Date | null;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    phoneNumber: string | null;
  };
};

type ActiveOrganizationMembershipRecord = {
  id: string;
  role: ActiveOrganizationMembershipDto["role"];
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

function encodeCursor(payload: object): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new ApplicationError(400, "PAGINATION_CURSOR_INVALID", "The pagination cursor is invalid.");
  }
}

export function encodeDateIdCursor(cursor: DateIdCursor): string {
  return encodeCursor({ date: cursor.date.toISOString(), id: cursor.id });
}

export function decodeDateIdCursor(cursor: string): DateIdCursor {
  const parsed = dateIdCursorSchema.safeParse(decodeCursor(cursor));
  if (!parsed.success) {
    throw new ApplicationError(400, "PAGINATION_CURSOR_INVALID", "The membership pagination cursor is invalid.");
  }
  return { date: new Date(parsed.data.date), id: parsed.data.id };
}

export function encodeOrganizationNameCursor(cursor: OrganizationNameCursor): string {
  return encodeCursor(cursor);
}

export function decodeOrganizationNameCursor(cursor: string): OrganizationNameCursor {
  const parsed = organizationNameCursorSchema.safeParse(decodeCursor(cursor));
  if (!parsed.success) {
    throw new ApplicationError(400, "PAGINATION_CURSOR_INVALID", "The organization-workspace cursor is invalid.");
  }
  return parsed.data;
}

export function toAdminMembershipRequestDto(record: AdminMembershipRequestRecord): AdminMembershipRequestDto {
  return {
    id: record.id,
    requester: record.requester,
    message: record.message,
    status: record.status,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewNotes: record.reviewNotes,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toOrganizationMemberDto(record: OrganizationMemberRecord): OrganizationMemberDto {
  return {
    id: record.id,
    user: record.user,
    role: record.role,
    status: record.status,
    source: record.source,
    joinedAt: record.joinedAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
  };
}

export function toActiveOrganizationMembershipDto(
  record: ActiveOrganizationMembershipRecord,
): ActiveOrganizationMembershipDto {
  return {
    membershipId: record.id,
    organization: record.organization,
    role: record.role,
  };
}
