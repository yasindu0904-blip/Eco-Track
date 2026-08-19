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
