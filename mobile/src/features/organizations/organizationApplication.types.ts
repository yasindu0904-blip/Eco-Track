export type OrganizationStatus =
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "DECLINED"
  | "SUSPENDED"
  | "ARCHIVED";

export type ServiceAreaStatus =
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "REJECTED"
  | "INACTIVE";

export type AdministrativeArea = {
  id: string;
  officialCode: string;
  name: string;
  gnNumber: string | null;
  divisionalSecretariatName: string | null;
  districtName: string | null;
  provinceName: string | null;
};

export type CreateOrganizationApplicationInput = {
  name: string;
  registrationNumber?: string;
  description?: string;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  administrativeAreaIds: string[];
};

export type OrganizationServiceArea = {
  id: string;
  administrativeAreaId: string | null;
  officialCode: string | null;
  areaName: string;
  status: ServiceAreaStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type OrganizationApplication = {
  id: string;
  name: string;
  slug: string;
  registrationNumber: string | null;
  description: string | null;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  status: OrganizationStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  serviceAreas: OrganizationServiceArea[];
};

export type AdministrativeAreaListResponse = { data: AdministrativeArea[] };
export type OrganizationApplicationResponse = { data: OrganizationApplication };
export type OrganizationApplicationListResponse = { data: OrganizationApplication[] };
