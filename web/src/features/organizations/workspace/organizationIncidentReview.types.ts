import type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
} from "../../incidents/incident.types";

export interface OrganizationIncidentSummary {
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
}

export interface OrganizationIncidentPage {
  items: OrganizationIncidentSummary[];
  nextCursor: string | null;
}
