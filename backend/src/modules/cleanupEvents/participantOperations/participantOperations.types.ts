export type ParticipantOperationAllocationStatus =
  | "PLANNED"
  | "ATTENDED"
  | "ABSENT"
  | "REMOVED";

export type ParticipantOperationSessionDto = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  capacity: number | null;
  allocatedCount: number;
};

export type ParticipantOperationAllocationDto = {
  id: string;
  participantId: string;
  sessionId: string;
  status: ParticipantOperationAllocationStatus;
  allocatedAt: string;
  attendanceMarkedAt: string | null;
  notes: string | null;
};

export type EventParticipantOperationDto = {
  id: string;
  status: "JOINED" | "WITHDRAWN" | "REMOVED";
  joinedAt: string;
  removedAt: string | null;
  volunteer: {
    id: string;
    fullName: string | null;
    phoneNumber: string | null;
  };
  availableSessionIds: string[];
  allocations: ParticipantOperationAllocationDto[];
};

export type EventParticipantOperationsPageDto = {
  event: {
    id: string;
    title: string;
    lifecycleStatus: string;
  };
  sessions: ParticipantOperationSessionDto[];
  participants: EventParticipantOperationDto[];
  nextCursor: string | null;
};

export type ParticipantRemovalResultDto = {
  participant: EventParticipantOperationDto;
  removedAllocationCount: number;
};

