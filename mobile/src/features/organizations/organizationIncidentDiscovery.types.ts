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

export type OrganizationIncidentReviewStatus = "VIEWED" | "VALID" | "FALSE";

export type OrganizationIncidentFalseReasonCode =
  | "INSUFFICIENT_EVIDENCE"
  | "LOCATION_INCORRECT"
  | "DUPLICATE_REPORT"
  | "NOT_AN_ENVIRONMENTAL_INCIDENT"
  | "OUTSIDE_SERVICE_SCOPE"
  | "OTHER";

export type OrganizationIncidentReview = {
  id: string;
  status: OrganizationIncidentReviewStatus;
  reasonCode: string | null;
  privateNotes: string | null;
  reviewerName: string;
  firstViewedAt: string;
  reviewedAt: string | null;
  updatedAt: string;
};

export type OrganizationIncidentDetail = OrganizationIncidentSummary & {
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
};

export type OrganizationIncidentReviewInput = {
  status: OrganizationIncidentReviewStatus;
  reasonCode?: OrganizationIncidentFalseReasonCode;
  privateNotes?: string | null;
};

export type OrganizationIncidentReviewMutation = {
  review: OrganizationIncidentReview;
  rewardAwarded: boolean;
  idempotentReplay: boolean;
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
