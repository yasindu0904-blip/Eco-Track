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

export type CleanupEventDraftDto = {
  id: string;
  organizationId: string;
  incidentId: string | null;
  lifecycleStatus: "DRAFT";
  displayStatus: "DRAFT";
  title: string;
  description: string;
  publicInstructions: string | null;
  eventLatitude: number;
  eventLongitude: number;
  eventAddress: string | null;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  startsAt: string | null;
  capacity: number | null;
  locationLockedToIncident: boolean;
  createdAt: string;
  updatedAt: string;
  coordinators: CleanupEventCoordinatorDto[];
};

export type CleanupEventDraftPageDto = {
  items: CleanupEventDraftDto[];
  nextCursor: string | null;
};

export type CleanupEventPublicSummaryDto = {
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

export type CleanupEventPublicDetailDto = CleanupEventPublicSummaryDto & {
  publicInstructions: string;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  meetingAddress: string | null;
  joinedVolunteerCount: number;
};

export type CleanupEventPublicPageDto = {
  items: CleanupEventPublicSummaryDto[];
  nextCursor: string | null;
};
export type CleanupEventOwnedSummaryDto = Omit<
  CleanupEventPublicSummaryDto,
  "lifecycleStatus" | "displayStatus" | "publishedAt" | "startsAt"
> & {
  lifecycleStatus: CleanupEventLifecycleStatus;
  displayStatus: CleanupEventDisplayStatus;
  startsAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};
export type CleanupEventOwnedPageDto = {
  items: CleanupEventOwnedSummaryDto[];
  nextCursor: string | null;
};

export type CleanupEventPublishCheckCode =
  | "PUBLIC_DETAILS"
  | "EVENT_TIME"
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
export type EventAttendanceStatus = "UNMARKED" | "ATTENDED" | "ABSENT";
export type EventParticipationDto = {
  id: string;
  status: EventParticipationStatus;
  attendanceStatus: EventAttendanceStatus;
  attendanceMarkedAt: string | null;
  joinedAt: string;
  withdrawnAt: string | null;
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
