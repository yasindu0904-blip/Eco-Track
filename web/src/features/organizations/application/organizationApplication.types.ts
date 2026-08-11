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

export interface CreateOrganizationApplicationInput {
  name: string;
  registrationNumber?: string;
  description?: string;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  administrativeAreaIds: string[];
}

export interface OrganizationServiceArea {
  id: string;
  administrativeAreaId: string | null;
  officialCode: string | null;
  areaName: string;
  status: ServiceAreaStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface OrganizationApplication {
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
}

export interface OrganizationApplicationResponse {
  data: OrganizationApplication;
}

export interface OrganizationApplicationListResponse {
  data: OrganizationApplication[];
}

export interface AdministrativeArea {
  id: string;
  officialCode: string;
  name: string;
  gnNumber: string | null;
  divisionalSecretariatName: string | null;
  districtName: string | null;
  provinceName: string | null;
}

export interface AdministrativeAreaListResponse {
  data: AdministrativeArea[];
}
