export type CleanupEventDraftInput = {
  incidentId?: string | null;
  title: string;
  description: string;
  publicInstructions?: string | null;
  eventLatitude: number;
  eventLongitude: number;
  eventAddress?: string | null;
  meetingLatitude?: number | null;
  meetingLongitude?: number | null;
  meetingAddress?: string | null;
};

export type CleanupEventSessionInput = {
  sessionDate: string;
  startTime: string;
  endTime: string;
  capacity?: number | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationAddress?: string | null;
  notes?: string | null;
};

export type EventSession = CleanupEventSessionInput & {
  id: string;
  capacity: number | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationAddress: string | null;
  notes: string | null;
};

export type EventCoordinator = {
  id: string;
  membershipId: string;
  assignedAt: string;
  member: {
    id: string;
    fullName: string | null;
    email: string;
    role: "ORG_MEMBER" | "ORG_ADMIN";
  };
};

export type CleanupEventDraft = CleanupEventDraftInput & {
  id: string;
  organizationId: string;
  incidentId: string | null;
  lifecycleStatus: "DRAFT";
  publicInstructions: string | null;
  eventAddress: string | null;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  createdAt: string;
  updatedAt: string;
  sessions: EventSession[];
  coordinators: EventCoordinator[];
};

export type CleanupEventDraftPage = {
  items: CleanupEventDraft[];
  nextCursor: string | null;
};

export type CleanupEventPublicStatus = "PUBLISHED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETION_SUBMITTED" | "COMPLETED" | "CANCELLED";

export type CleanupEventPublicSummary = {
  id: string;
  organization: { id: string; name: string };
  incidentId: string | null;
  title: string;
  description: string;
  lifecycleStatus: CleanupEventPublicStatus;
  eventLatitude: number;
  eventLongitude: number;
  eventAddress: string | null;
  publishedAt: string;
  firstSessionAt: string | null;
};

export type CleanupEventPublicDetail = CleanupEventPublicSummary & {
  publicInstructions: string;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  sessions: Array<Omit<EventSession, "notes">>;
};

export type CleanupEventPublicPage = { items: CleanupEventPublicSummary[]; nextCursor: string | null };
export type CleanupEventOwnedSummary = Omit<CleanupEventPublicSummary, "lifecycleStatus" | "publishedAt"> & {
  lifecycleStatus: "DRAFT" | CleanupEventPublicStatus;
  publishedAt: string | null;
  updatedAt: string;
};
export type CleanupEventOwnedPage = { items: CleanupEventOwnedSummary[]; nextCursor: string | null };
export type CleanupEventPublishReadiness = {
  eventId: string;
  ready: boolean;
  checks: Array<{ code: string; ready: boolean; message: string }>;
};
export type CleanupEventPublishResult = { event: CleanupEventPublicDetail; incidentUpdated: boolean };

export type EventParticipation = {
  id: string;
  status: "JOINED" | "WITHDRAWN" | "REMOVED";
  joinedAt: string;
  withdrawnAt: string | null;
  availableSessionIds: string[];
  allocations: Array<{
    id: string;
    sessionId: string;
    status: "PLANNED" | "ATTENDED" | "ABSENT" | "REMOVED";
    allocatedAt: string;
    attendanceMarkedAt: string | null;
  }>;
  event: CleanupEventPublicDetail;
};

export type ParticipantOperationAllocation = {
  id: string; participantId: string; sessionId: string;
  status: "PLANNED" | "ATTENDED" | "ABSENT" | "REMOVED";
  allocatedAt: string; attendanceMarkedAt: string | null; notes: string | null;
};
export type EventParticipantOperation = {
  id: string; status: "JOINED" | "WITHDRAWN" | "REMOVED"; joinedAt: string; removedAt: string | null;
  volunteer: { id: string; fullName: string | null; phoneNumber: string | null };
  availableSessionIds: string[];
  allocations: ParticipantOperationAllocation[];
};
export type EventParticipantOperationsPage = {
  event: { id: string; title: string; lifecycleStatus: string };
  sessions: Array<{ id: string; sessionDate: string; startTime: string; endTime: string; status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; capacity: number | null; allocatedCount: number }>;
  participants: EventParticipantOperation[];
  nextCursor: string | null;
};

export type EventParticipationPage = {
  items: EventParticipation[];
  nextCursor: string | null;
};

export type JoinEventResult = {
  participation: EventParticipation;
  created: boolean;
  rejoined: boolean;
};

export type CleanupEventMapFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string; kind: "CLEANUP_EVENT"; title: string; status: string; occurredAt: string;
    organizationId: string; organizationName: string; incidentId: string | null;
    isJoined: boolean; isOwned: boolean;
  };
};
export type CleanupEventMapPage = { type: "FeatureCollection"; features: CleanupEventMapFeature[]; nextCursor: string | null };
