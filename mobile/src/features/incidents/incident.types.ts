export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus = "ACTIVE" | "CLEANUP_ORGANIZED" | "RESOLVED" | "EXPIRED" | "ARCHIVED";
export type IncidentCategory = { id: string; name: string; description: string | null };
export type IncidentSummary = {
  id: string; title: string; category: IncidentCategory; severity: IncidentSeverity;
  status: IncidentStatus; latitude: number; longitude: number; addressText: string | null;
  reportedAt: string; thumbnailUrl: string | null;
};
export type PublicIncidentSummary = Omit<IncidentSummary, "thumbnailUrl"> & {
  falseReviewCount: number;
};
export type PublicIncidentPage = {
  items: PublicIncidentSummary[];
  nextCursor: string | null;
};
export type IncidentDiscoveryFilters = {
  limit?: number;
  cursor?: string;
  status?: IncidentStatus;
  categoryId?: string;
  reportedAfter?: string;
};
export type IncidentViewportDiscoveryQuery = IncidentDiscoveryFilters & {
  west: number; south: number; east: number; north: number; zoom: number;
};
export type IncidentRadiusDiscoveryQuery = IncidentDiscoveryFilters & {
  latitude: number; longitude: number; radiusMeters: number;
};
export type IncidentDetail = IncidentSummary & {
  description: string; highlightUntil: string; archiveAfter: string;
  resolvedAt: string | null; archivedAt: string | null;
  photos: Array<{ id: string; url: string; caption: string | null; sortOrder: number }>;
  statusHistory: Array<{ id: string; fromStatus: IncidentStatus | null; toStatus: IncidentStatus; reason: string | null; changedAt: string }>;
};
export type MobileIncidentPhoto = {
  uri: string; originalFileName: string; contentType: "image/jpeg";
  sizeBytes: number; data: ArrayBuffer;
};
export type UploadedEvidence = {
  storagePath: string; originalFileName: string; contentType: string;
  sizeBytes: number; sortOrder: number;
};
