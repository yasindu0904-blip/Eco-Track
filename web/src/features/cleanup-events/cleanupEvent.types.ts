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
