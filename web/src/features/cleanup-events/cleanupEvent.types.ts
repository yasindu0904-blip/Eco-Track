export type CleanupEventDraftInput = { incidentId?: string | null; title: string; description: string; publicInstructions?: string | null; eventLatitude: number; eventLongitude: number; eventAddress?: string | null; meetingLatitude?: number | null; meetingLongitude?: number | null; meetingAddress?: string | null };
export type CleanupEventDraft = CleanupEventDraftInput & { id: string; organizationId: string; lifecycleStatus: "DRAFT"; sessions: EventSession[]; coordinators: EventCoordinator[] };
export type EventSession = { id: string; sessionDate: string; startTime: string; endTime: string; capacity: number | null };
export type EventCoordinator = { id: string; membershipId: string; membership?: { id: string; user?: { fullName: string | null } } };
