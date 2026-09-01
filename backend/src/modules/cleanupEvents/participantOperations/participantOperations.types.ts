export type EventParticipantOperationDto = {
  id: string;
  status: "JOINED" | "WITHDRAWN" | "REMOVED";
  attendanceStatus: "UNMARKED" | "ATTENDED" | "ABSENT";
  attendanceMarkedAt: string | null;
  joinedAt: string;
  removedAt: string | null;
  volunteer: {
    id: string;
    fullName: string | null;
    phoneNumber: string | null;
  };
};

export type EventParticipantOperationsPageDto = {
  event: {
    id: string;
    title: string;
    lifecycleStatus: string;
    startsAt: string | null;
    capacity: number | null;
  };
  participants: EventParticipantOperationDto[];
  nextCursor: string | null;
};

export type ParticipantRemovalResultDto = {
  participant: EventParticipantOperationDto;
};
