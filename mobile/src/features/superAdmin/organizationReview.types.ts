export type OrganizationReviewApplication = {
  id: string;
  name: string;
  registrationNumber: string | null;
  description: string | null;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  status: "PENDING_REVIEW" | "ACTIVE" | "DECLINED" | "SUSPENDED" | "ARCHIVED";
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  requester: {
    id: string;
    email: string;
    fullName: string | null;
  };
  serviceAreas: Array<{
    id: string;
    administrativeAreaId: string | null;
    name: string;
    officialCode: string | null;
    divisionalSecretariatName: string | null;
    districtName: string | null;
    status: "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "INACTIVE";
  }>;
};

export type OrganizationReviewListResponse = { data: OrganizationReviewApplication[] };
export type OrganizationReviewResponse = { data: OrganizationReviewApplication };
