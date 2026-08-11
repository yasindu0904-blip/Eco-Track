import type {
  OrganizationStatus,
  ServiceAreaStatus,
} from "../../../generated/prisma/enums.js";

export type CreateOrganizationApplicationInput = {
  name: string;
  registrationNumber?: string;
  description?: string;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  administrativeAreaIds: string[];
};

export type OrganizationServiceAreaDto = {
  id: string;
  administrativeAreaId: string | null;
  officialCode: string | null;
  areaName: string;
  status: ServiceAreaStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type SelectedAdministrativeArea = {
  id: string;
  officialCode: string;
  nameEn: string;
};

export type OrganizationApplicationDto = {
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
  serviceAreas: OrganizationServiceAreaDto[];
};

export type CreateOrganizationApplicationCommand = {
  requesterUserId: string;
  application: CreateOrganizationApplicationInput;
};
