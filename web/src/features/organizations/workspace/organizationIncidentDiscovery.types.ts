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

export type OrganizationIncidentReviewStatus = "VIEWED" | "VALID" | "FALSE";

export type OrganizationIncidentFalseReasonCode =
  | "INSUFFICIENT_EVIDENCE"
  | "LOCATION_INCORRECT"
  | "DUPLICATE_REPORT"
  | "NOT_AN_ENVIRONMENTAL_INCIDENT"
  | "OUTSIDE_SERVICE_SCOPE"
  | "OTHER";

export interface OrganizationIncidentReview {
  id: string;
  status: OrganizationIncidentReviewStatus;
  reasonCode: string | null;
  privateNotes: string | null;
  reviewerName: string;
  firstViewedAt: string;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface OrganizationIncidentDetail extends OrganizationIncidentSummary {
  description: string;
  highlightUntil: string;
  archiveAfter: string;
  resolvedAt: string | null;
  archivedAt: string | null;
  thumbnailUrl: string | null;
  photos: Array<{
    id: string;
    url: string;
    caption: string | null;
    sortOrder: number;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    changedAt: string;
  }>;
  accessSource: "CURRENT_SERVICE_AREA" | "HISTORICAL_REVIEW" | "LINKED_EVENT";
  currentReview: OrganizationIncidentReview | null;
}

export interface OrganizationIncidentReviewInput {
  status: OrganizationIncidentReviewStatus;
  reasonCode?: OrganizationIncidentFalseReasonCode;
  privateNotes?: string | null;
}

export interface OrganizationIncidentReviewMutation {
  review: OrganizationIncidentReview;
  rewardAwarded: boolean;
  idempotentReplay: boolean;
}

export interface OrganizationIncidentPage {
  items: OrganizationIncidentSummary[];
  nextCursor: string | null;
}

export interface OrganizationIncidentQuery {
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
}
