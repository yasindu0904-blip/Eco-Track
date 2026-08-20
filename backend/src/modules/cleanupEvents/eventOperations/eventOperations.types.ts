import type {
  CleanupLifecycleStatus,
  EvidenceType,
  NoteVisibility,
  SessionStatus,
} from "../../../generated/prisma/enums.js";

export type EventEvidenceStorage = {
  createUploadIntent(storagePath: string): Promise<{ token: string; signedUrl: string }>;
  objectExists(storagePath: string): Promise<boolean>;
  createDownloadUrl(storagePath: string): Promise<string>;
};

export type EventOperationNoteDto = {
  id: string;
  visibility: NoteVisibility;
  noteText: string;
  author: { id: string; fullName: string | null };
  createdAt: string;
};

export type EventOperationEvidenceDto = {
  id: string;
  sessionId: string | null;
  type: EvidenceType;
  caption: string | null;
  url: string;
  uploadedBy: { id: string; fullName: string | null };
  uploadedAt: string;
};

export type EventOperationSessionDto = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  updatedAt: string;
};

export type EventOperationHistoryDto = {
  id: string;
  fromStatus: { id: string; label: string; lifecycleStatus: CleanupLifecycleStatus } | null;
  toStatus: { id: string; label: string; lifecycleStatus: CleanupLifecycleStatus };
  changedBy: { id: string; fullName: string | null };
  notes: string | null;
  changedAt: string;
};

export type EventOperationsDto = {
  event: {
    id: string;
    organizationId: string;
    incidentId: string | null;
    title: string;
    lifecycleStatus: CleanupLifecycleStatus;
    updatedAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
    currentWorkflowStatus: {
      id: string;
      code: string;
      label: string;
      lifecycleStatus: CleanupLifecycleStatus;
    };
  };
  sessions: EventOperationSessionDto[];
  notes: EventOperationNoteDto[];
  evidence: EventOperationEvidenceDto[];
  history: EventOperationHistoryDto[];
  availableTransitions: Array<{
    id: string;
    code: string;
    label: string;
    lifecycleStatus: CleanupLifecycleStatus;
  }>;
};

export type ParticipantEventUpdatesDto = {
  event: {
    id: string;
    title: string;
    lifecycleStatus: CleanupLifecycleStatus;
    completedAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
  };
  notes: EventOperationNoteDto[];
};

export type EventEvidenceUploadIntentDto = {
  storagePath: string;
  token: string;
  signedUrl: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
};

export type EventCompletionReadinessDto = {
  eventId: string;
  ready: boolean;
  checks: Array<{ code: string; ready: boolean; message: string }>;
};

export type EventLifecycleMutationDto = {
  eventId: string;
  lifecycleStatus: CleanupLifecycleStatus;
  updatedAt: string;
  incidentStatus: "ACTIVE" | "CLEANUP_ORGANIZED" | "RESOLVED" | "EXPIRED" | "ARCHIVED" | null;
  rewardsAwarded: number;
  idempotentReplay: boolean;
};
