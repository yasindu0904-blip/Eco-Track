export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus =
  | "ACTIVE"
  | "CLEANUP_ORGANIZED"
  | "RESOLVED"
  | "EXPIRED"
  | "ARCHIVED";

export interface IncidentCategory {
  id: string;
  name: string;
  description: string | null;
}

export interface IncidentPhoto {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

export interface IncidentHistoryItem {
  id: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  reason: string | null;
  changedAt: string;
}

export interface IncidentSummary {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  addressText: string | null;
  reportedAt: string;
  thumbnailUrl: string | null;
}

export interface PublicIncidentSummary
  extends Omit<IncidentSummary, "thumbnailUrl"> {
  falseReviewCount: number;
}

export interface PublicIncidentPage {
  items: PublicIncidentSummary[];
  nextCursor: string | null;
}

export interface IncidentDiscoveryFilters {
  limit?: number;
  cursor?: string;
  status?: IncidentStatus;
  categoryId?: string;
  reportedAfter?: string;
}

export interface IncidentViewportDiscoveryQuery
  extends IncidentDiscoveryFilters {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

export interface IncidentRadiusDiscoveryQuery
  extends IncidentDiscoveryFilters {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface IncidentDetail extends IncidentSummary {
  description: string;
  highlightUntil: string;
  archiveAfter: string;
  resolvedAt: string | null;
  archivedAt: string | null;
  photos: IncidentPhoto[];
  statusHistory: IncidentHistoryItem[];
}

export interface UploadedIncidentEvidence {
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
  severity: IncidentSeverity;
  latitude: number;
  longitude: number;
  addressText?: string;
  evidence: UploadedIncidentEvidence[];
}

export interface EvidenceUploadIntent {
  storagePath: string;
  token: string;
  signedUrl: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
}
