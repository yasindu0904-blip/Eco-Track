export type IncidentSeverityDto = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatusDto =
  | "ACTIVE"
  | "CLEANUP_ORGANIZED"
  | "RESOLVED"
  | "EXPIRED"
  | "ARCHIVED";

export interface IncidentCategoryDto {
  id: string;
  name: string;
  description: string | null;
}

export interface IncidentEvidenceInput {
  storagePath: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  caption?: string;
  sortOrder: number;
}

export interface CreateIncidentInput {
  submissionId: string;
  categoryId: string;
  title: string;
  description: string;
  severity: IncidentSeverityDto;
  latitude: number;
  longitude: number;
  addressText?: string;
  evidence: IncidentEvidenceInput[];
}

export interface IncidentPhotoDto {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

export interface IncidentStatusHistoryDto {
  id: string;
  fromStatus: IncidentStatusDto | null;
  toStatus: IncidentStatusDto;
  reason: string | null;
  changedAt: string;
}

export interface IncidentSummaryDto {
  id: string;
  title: string;
  category: IncidentCategoryDto;
  severity: IncidentSeverityDto;
  status: IncidentStatusDto;
  latitude: number;
  longitude: number;
  addressText: string | null;
  reportedAt: string;
  thumbnailUrl: string | null;
}

export interface IncidentDetailDto extends IncidentSummaryDto {
  description: string;
  highlightUntil: string;
  archiveAfter: string;
  resolvedAt: string | null;
  archivedAt: string | null;
  photos: IncidentPhotoDto[];
  statusHistory: IncidentStatusHistoryDto[];
}

export interface IncidentListPageDto {
  items: IncidentSummaryDto[];
  nextCursor: string | null;
}

export interface PublicIncidentSummaryDto {
  id: string;
  title: string;
  category: IncidentCategoryDto;
  severity: IncidentSeverityDto;
  status: IncidentStatusDto;
  latitude: number;
  longitude: number;
  addressText: string | null;
  reportedAt: string;
  falseReviewCount: number;
}

export interface PublicIncidentListPageDto {
  items: PublicIncidentSummaryDto[];
  nextCursor: string | null;
}

export interface OrganizationIncidentSummaryDto {
  id: string;
  title: string;
  category: IncidentCategoryDto;
  severity: IncidentSeverityDto;
  status: IncidentStatusDto;
  latitude: number;
  longitude: number;
  addressText: string | null;
  reportedAt: string;
  falseReviewCount: number;
  currentReviewStatus: "VIEWED" | "VALID" | "FALSE" | null;
}

export interface OrganizationIncidentListPageDto {
  items: OrganizationIncidentSummaryDto[];
  nextCursor: string | null;
}

export type IncidentReviewStatusDto = "VIEWED" | "VALID" | "FALSE";

export type IncidentFalseReviewReasonCodeDto =
  | "INSUFFICIENT_EVIDENCE"
  | "LOCATION_INCORRECT"
  | "DUPLICATE_REPORT"
  | "NOT_AN_ENVIRONMENTAL_INCIDENT"
  | "OUTSIDE_SERVICE_SCOPE"
  | "OTHER";

export type OrganizationIncidentAccessSourceDto =
  | "CURRENT_SERVICE_AREA"
  | "HISTORICAL_REVIEW"
  | "LINKED_EVENT";

export interface OrganizationIncidentReviewDto {
  id: string;
  status: IncidentReviewStatusDto;
  reasonCode: string | null;
  privateNotes: string | null;
  reviewerName: string;
  firstViewedAt: string;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface OrganizationIncidentDetailDto extends IncidentDetailDto {
  falseReviewCount: number;
  accessSource: OrganizationIncidentAccessSourceDto;
  currentReview: OrganizationIncidentReviewDto | null;
}

export interface UpdateOrganizationIncidentReviewInput {
  status: IncidentReviewStatusDto;
  reasonCode?: IncidentFalseReviewReasonCodeDto;
  privateNotes?: string | null;
}

export interface OrganizationIncidentReviewMutationDto {
  review: OrganizationIncidentReviewDto;
  rewardAwarded: boolean;
  idempotentReplay: boolean;
}

export interface EvidenceUploadIntentDto {
  storagePath: string;
  token: string;
  signedUrl: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface IncidentStorage {
  createUploadIntent(storagePath: string): Promise<{
    token: string;
    signedUrl: string;
  }>;
  objectExists(storagePath: string): Promise<boolean>;
  createDownloadUrl(storagePath: string): Promise<string>;
}
