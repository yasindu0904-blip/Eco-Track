import type {
  OrganizationStatus,
  ServiceAreaStatus,
} from "../../../generated/prisma/enums.js";

export type OrganizationReviewServiceAreaDto = {
  id: string;
  administrativeAreaId: string | null;
  name: string;
  officialCode: string | null;
  divisionalSecretariatName: string | null;
  districtName: string | null;
  status: ServiceAreaStatus;
};

export type OrganizationReviewApplicationDto = {
  id: string;
  name: string;
  registrationNumber: string | null;
  description: string | null;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  status: OrganizationStatus;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  requester: {
    id: string;
    email: string;
    fullName: string | null;
  };
  serviceAreas: OrganizationReviewServiceAreaDto[];
};

export type OrganizationReviewDecision = "APPROVE" | "DECLINE";

export type ReviewOrganizationApplicationCommand = {
  applicationId: string;
  reviewerUserId: string;
  decision: OrganizationReviewDecision;
  reviewNotes: string | null;
};

export type ReviewTransactionResult =
  | { outcome: "reviewed" }
  | { outcome: "notFound" }
  | { outcome: "notPending" };
