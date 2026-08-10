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

export type GeoJsonPosition = [
  longitude: number,
  latitude: number,
  ...additionalCoordinates: number[],
];

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: GeoJsonPosition[][][];
}

export interface OrganizationServiceAreaInput {
  areaName: string;
  boundary: MultiPolygonGeometry;
}

export interface CreateOrganizationApplicationInput {
  name: string;
  registrationNumber?: string;
  description?: string;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  serviceAreas: OrganizationServiceAreaInput[];
}

export interface OrganizationServiceArea {
  id: string;
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
