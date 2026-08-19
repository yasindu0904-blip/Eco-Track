export type CleanupEventDraftInput = { incidentId?: string | null; title: string; description: string; eventLatitude: number; eventLongitude: number; eventAddress?: string | null };
export type CleanupEventDraft = CleanupEventDraftInput & { id: string; lifecycleStatus: "DRAFT"; sessions: unknown[]; coordinators: unknown[] };
