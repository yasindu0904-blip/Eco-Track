import type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
} from "../incidents/incident.types";

export type OrganizationIncidentSummary = {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  addressText: string | null;
  reportedAt: string;
  falseReviewCount: number;
  currentReviewStatus: "VIEWED" | "VALID" | "FALSE" | null;
};

export type OrganizationIncidentPage = {
  items: OrganizationIncidentSummary[];
  nextCursor: string | null;
};

export type OrganizationIncidentQuery = {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  limit?: number;
  cursor?: string;
  status?: IncidentStatus;
  categoryId?: string;
  reportedAfter?: string;
};
