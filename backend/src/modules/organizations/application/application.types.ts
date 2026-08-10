import type {
  OrganizationStatus,
  ServiceAreaStatus,
} from "../../../generated/prisma/enums.js";

export type GeoJsonPosition = [
  longitude: number,
  latitude: number,
  ...additionalCoordinates: number[],
];

export type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: GeoJsonPosition[][][];
};

export type OrganizationServiceAreaInput = {
  areaName: string;
  boundary: MultiPolygonGeometry;
};

export type CreateOrganizationApplicationInput = {
  name: string;
  registrationNumber?: string;
  description?: string;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  serviceAreas: OrganizationServiceAreaInput[];
};

export type OrganizationServiceAreaDto = {
  id: string;
  areaName: string;
  status: ServiceAreaStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
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
