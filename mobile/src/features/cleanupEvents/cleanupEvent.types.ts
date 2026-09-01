export type CleanupEventLifecycleStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "COMPLETED"
  | "CANCELLED";
export type CleanupEventDisplayStatus =
  | "DRAFT"
  | "UPCOMING"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";
export type AttendanceStatus = "UNMARKED" | "ATTENDED" | "ABSENT";
export type CleanupEventDraftInput = {
  incidentId?: string | null;
  title: string;
  description: string;
  publicInstructions?: string | null;
  eventLatitude?: number;
  eventLongitude?: number;
  eventAddress?: string | null;
  meetingLatitude?: number | null;
  meetingLongitude?: number | null;
  meetingAddress?: string | null;
  startsAt: string;
  capacity?: number | null;
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
export type CleanupEventDraft = Omit<
  CleanupEventDraftInput,
  "eventLatitude" | "eventLongitude" | "startsAt"
> & {
  id: string;
  organizationId: string;
  incidentId: string | null;
  lifecycleStatus: "DRAFT";
  displayStatus: "DRAFT";
  eventLatitude: number;
  eventLongitude: number;
  eventAddress: string | null;
  publicInstructions: string | null;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  startsAt: string | null;
  capacity: number | null;
  locationLockedToIncident: boolean;
  createdAt: string;
  updatedAt: string;
  coordinators: EventCoordinator[];
};
export type CleanupEventDraftPage = {
  items: CleanupEventDraft[];
  nextCursor: string | null;
};
export type CleanupEventPublicSummary = {
  id: string;
  organization: { id: string; name: string };
  incidentId: string | null;
  title: string;
  description: string;
  lifecycleStatus: Exclude<CleanupEventLifecycleStatus, "DRAFT">;
  displayStatus: Exclude<CleanupEventDisplayStatus, "DRAFT">;
  eventLatitude: number;
  eventLongitude: number;
  eventAddress: string | null;
  startsAt: string;
  capacity: number | null;
  publishedAt: string;
};
export type CleanupEventPublicDetail = CleanupEventPublicSummary & {
  publicInstructions: string;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  joinedVolunteerCount: number;
};
export type CleanupEventPublicPage = {
  items: CleanupEventPublicSummary[];
  nextCursor: string | null;
};
export type CleanupEventOwnedSummary = Omit<
  CleanupEventPublicSummary,
  "lifecycleStatus" | "displayStatus" | "publishedAt" | "startsAt"
> & {
  lifecycleStatus: CleanupEventLifecycleStatus;
  displayStatus: CleanupEventDisplayStatus;
  startsAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};
export type CleanupEventOwnedPage = {
  items: CleanupEventOwnedSummary[];
  nextCursor: string | null;
};
export type CleanupEventPublishReadiness = {
  eventId: string;
  ready: boolean;
  checks: Array<{ code: string; ready: boolean; message: string }>;
};
export type CleanupEventPublishResult = {
  event: CleanupEventPublicDetail;
  incidentUpdated: boolean;
};
export type EventParticipation = {
  id: string;
  status: "JOINED" | "WITHDRAWN" | "REMOVED";
  attendanceStatus: AttendanceStatus;
  attendanceMarkedAt: string | null;
  joinedAt: string;
  withdrawnAt: string | null;
  event: CleanupEventPublicDetail;
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
    id: string;
    kind: "CLEANUP_EVENT";
    title: string;
    status: string;
    occurredAt: string;
    organizationId: string;
    organizationName: string;
    incidentId: string | null;
    isJoined: boolean;
    isOwned: boolean;
  };
};
export type CleanupEventMapPage = {
  type: "FeatureCollection";
  features: CleanupEventMapFeature[];
  nextCursor: string | null;
};
export type EventParticipantOperation = {
  id: string;
  status: "JOINED" | "WITHDRAWN" | "REMOVED";
  attendanceStatus: AttendanceStatus;
  attendanceMarkedAt: string | null;
  joinedAt: string;
  removedAt: string | null;
  volunteer: {
    id: string;
    fullName: string | null;
    phoneNumber: string | null;
  };
};
export type EventParticipantOperationsPage = {
  event: {
    id: string;
    title: string;
    lifecycleStatus: CleanupEventLifecycleStatus;
    startsAt: string | null;
    capacity: number | null;
  };
  participants: EventParticipantOperation[];
  nextCursor: string | null;
};
export type EventOperationNote = {
  id: string;
  visibility: "PARTICIPANTS" | "INTERNAL";
  noteText: string;
  author: { id: string; fullName: string | null };
  createdAt: string;
};
export type EventOperationEvidence = {
  id: string;
  type: "BEFORE" | "PROGRESS" | "AFTER";
  caption: string | null;
  url: string;
  uploadedBy: { id: string; fullName: string | null };
  uploadedAt: string;
};
export type EventOperations = {
  event: {
    id: string;
    organizationId: string;
    incidentId: string | null;
    title: string;
    lifecycleStatus: CleanupEventLifecycleStatus;
    startsAt: string | null;
    updatedAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
    currentWorkflowStatus: {
      id: string;
      code: string;
      label: string;
      lifecycleStatus: CleanupEventLifecycleStatus;
    };
  };
  notes: EventOperationNote[];
  evidence: EventOperationEvidence[];
  history: Array<{
    id: string;
    fromStatus: { id: string; label: string; lifecycleStatus: string } | null;
    toStatus: { id: string; label: string; lifecycleStatus: string };
    changedBy: { id: string; fullName: string | null };
    notes: string | null;
    changedAt: string;
  }>;
};
export type ParticipantEventUpdates = {
  event: {
    id: string;
    title: string;
    lifecycleStatus: CleanupEventLifecycleStatus;
    completedAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
  };
  notes: EventOperationNote[];
};
export type EventEvidenceUploadIntent = {
  storagePath: string;
  token: string;
  signedUrl: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
};
export type EventCompletionReadiness = {
  eventId: string;
  ready: boolean;
  checks: Array<{ code: string; ready: boolean; message: string }>;
};
export type EventLifecycleMutation = {
  eventId: string;
  lifecycleStatus: CleanupEventLifecycleStatus;
  updatedAt: string;
  incidentStatus: string | null;
  rewardsAwarded: number;
  idempotentReplay: boolean;
};
