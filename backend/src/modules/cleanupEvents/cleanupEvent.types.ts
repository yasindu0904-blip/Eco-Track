export type CleanupEventSessionDto = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationAddress: string | null;
  notes: string | null;
};

export type CleanupEventCoordinatorDto = {
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

export type CleanupEventDraftDto = {
  id: string;
  organizationId: string;
  incidentId: string | null;
  lifecycleStatus: "DRAFT";
  title: string;
  description: string;
  publicInstructions: string | null;
  eventLatitude: number;
  eventLongitude: number;
  eventAddress: string | null;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  createdAt: string;
  updatedAt: string;
  sessions: CleanupEventSessionDto[];
  coordinators: CleanupEventCoordinatorDto[];
};

export type CleanupEventDraftPageDto = {
  items: CleanupEventDraftDto[];
  nextCursor: string | null;
};

export type CleanupEventPublicLifecycleStatus =
  | "PUBLISHED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETION_SUBMITTED"
  | "COMPLETED"
  | "CANCELLED";

export type CleanupEventPublicSummaryDto = {
  id: string;
  organization: { id: string; name: string };
  incidentId: string | null;
  title: string;
  description: string;
  lifecycleStatus: CleanupEventPublicLifecycleStatus;
  eventLatitude: number;
  eventLongitude: number;
  eventAddress: string | null;
  publishedAt: string;
  firstSessionAt: string | null;
};

export type CleanupEventPublicDetailDto = CleanupEventPublicSummaryDto & {
  publicInstructions: string;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  sessions: Array<Omit<CleanupEventSessionDto, "notes">>;
};

export type CleanupEventPublicPageDto = {
  items: CleanupEventPublicSummaryDto[];
  nextCursor: string | null;
};

export type CleanupEventOwnedSummaryDto = Omit<
  CleanupEventPublicSummaryDto,
  "lifecycleStatus" | "publishedAt"
> & {
  lifecycleStatus: "DRAFT" | CleanupEventPublicLifecycleStatus;
  publishedAt: string | null;
  updatedAt: string;
};

export type CleanupEventOwnedPageDto = {
  items: CleanupEventOwnedSummaryDto[];
  nextCursor: string | null;
};

export type CleanupEventPublishCheckCode =
  | "PUBLIC_DETAILS"
  | "FUTURE_SESSION"
  | "ACTIVE_COORDINATOR"
  | "WORKFLOW_TRANSITION"
  | "INCIDENT_REVIEW"
  | "INCIDENT_AVAILABLE";

export type CleanupEventPublishReadinessDto = {
  eventId: string;
  ready: boolean;
  checks: Array<{
    code: CleanupEventPublishCheckCode;
    ready: boolean;
    message: string;
  }>;
};

export type CleanupEventPublishResultDto = {
  event: CleanupEventPublicDetailDto;
  incidentUpdated: boolean;
};

export type CleanupEventMapFeatureCollectionDto = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [longitude: number, latitude: number];
    };
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
  }>;
  nextCursor: string | null;
};

export type EventParticipationStatus = "JOINED" | "WITHDRAWN" | "REMOVED";

export type EventParticipationDto = {
  id: string;
  status: EventParticipationStatus;
  joinedAt: string;
  withdrawnAt: string | null;
  availableSessionIds: string[];
  event: CleanupEventPublicDetailDto;
};

export type EventParticipationPageDto = {
  items: EventParticipationDto[];
  nextCursor: string | null;
};

export type JoinEventResultDto = {
  participation: EventParticipationDto;
  created: boolean;
  rejoined: boolean;
};
