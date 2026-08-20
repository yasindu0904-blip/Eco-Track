import { apiRequest } from "../../api/apiClient";
import type {
  CleanupEventDraft,
  CleanupEventDraftInput,
  CleanupEventDraftPage,
  CleanupEventSessionInput,
  CleanupEventOwnedPage,
  CleanupEventOwnedSummary,
  CleanupEventPublicDetail,
  CleanupEventPublicPage,
  CleanupEventPublishReadiness,
  CleanupEventPublishResult,
  EventSession,
  EventParticipation,
  EventParticipationPage,
  JoinEventResult,
  CleanupEventMapPage,
  EventParticipantOperationsPage,
  ParticipantOperationAllocation,
  EventParticipantOperation,
  EventOperations,
  ParticipantEventUpdates,
  EventOperationNote,
  EventOperationEvidence,
  EventEvidenceUploadIntent,
  EventCompletionReadiness,
  EventLifecycleMutation,
} from "./cleanupEvent.types";
import { webEnv } from "../../config/env";
import { supabase } from "../../config/supabase";

const root = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/events`;

const json = (body: unknown) => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
});

export async function listDrafts(
  token: string,
  organizationId: string,
  cursor?: string,
) {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return (
    await apiRequest<{ data: CleanupEventDraftPage }>(
      `${root(organizationId)}/drafts?${query}`,
      { accessToken: token },
    )
  ).data;
}

export async function getDraft(token: string, organizationId: string, draftId: string) {
  return (
    await apiRequest<{ data: CleanupEventDraft }>(
      `${root(organizationId)}/drafts/${encodeURIComponent(draftId)}`,
      { accessToken: token },
    )
  ).data;
}

export async function createDraft(
  token: string,
  organizationId: string,
  input: CleanupEventDraftInput,
) {
  return (
    await apiRequest<{ data: CleanupEventDraft }>(
      `${root(organizationId)}/drafts`,
      { accessToken: token, method: "POST", ...json(input) },
    )
  ).data;
}

export async function updateDraft(
  token: string,
  organizationId: string,
  draftId: string,
  input: Partial<CleanupEventDraftInput>,
) {
  return (
    await apiRequest<{ data: CleanupEventDraft }>(
      `${root(organizationId)}/drafts/${encodeURIComponent(draftId)}`,
      { accessToken: token, method: "PATCH", ...json(input) },
    )
  ).data;
}

export async function discardDraft(token: string, organizationId: string, draftId: string) {
  await apiRequest(
    `${root(organizationId)}/drafts/${encodeURIComponent(draftId)}`,
    { accessToken: token, method: "DELETE" },
  );
}

export async function addSession(
  token: string,
  organizationId: string,
  eventId: string,
  input: CleanupEventSessionInput,
) {
  return (
    await apiRequest<{ data: EventSession }>(
      `${root(organizationId)}/${encodeURIComponent(eventId)}/sessions`,
      { accessToken: token, method: "POST", ...json(input) },
    )
  ).data;
}

export async function updateSession(
  token: string,
  organizationId: string,
  eventId: string,
  sessionId: string,
  input: CleanupEventSessionInput,
) {
  return (
    await apiRequest<{ data: EventSession }>(
      `${root(organizationId)}/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}`,
      { accessToken: token, method: "PATCH", ...json(input) },
    )
  ).data;
}

export async function removeSession(
  token: string,
  organizationId: string,
  eventId: string,
  sessionId: string,
) {
  await apiRequest(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}`,
    { accessToken: token, method: "DELETE" },
  );
}

export async function assignCoordinator(
  token: string,
  organizationId: string,
  eventId: string,
  membershipId: string,
) {
  await apiRequest(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/coordinators`,
    { accessToken: token, method: "POST", ...json({ membershipId }) },
  );
}

export async function removeCoordinator(
  token: string,
  organizationId: string,
  eventId: string,
  membershipId: string,
) {
  await apiRequest(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/coordinators`,
    { accessToken: token, method: "DELETE", ...json({ membershipId }) },
  );
}

export async function getPublishReadiness(token: string, organizationId: string, eventId: string) {
  return (await apiRequest<{ data: CleanupEventPublishReadiness }>(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/publish-readiness`,
    { accessToken: token },
  )).data;
}

export async function publishCleanupEvent(token: string, organizationId: string, eventId: string) {
  return (await apiRequest<{ data: CleanupEventPublishResult }>(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/publish`,
    { accessToken: token, method: "POST" },
  )).data;
}

export async function listOwnedCleanupEvents(token: string, organizationId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<{ data: CleanupEventOwnedPage }>(`${root(organizationId)}?${query}`, { accessToken: token })).data;
}

export async function getOwnedCleanupEvent(token: string, organizationId: string, eventId: string) {
  return (await apiRequest<{ data: CleanupEventOwnedSummary }>(
    `${root(organizationId)}/${encodeURIComponent(eventId)}`,
    { accessToken: token },
  )).data;
}

export async function listPublicCleanupEvents(token: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<{ data: CleanupEventPublicPage }>(`/events?${query}`, { accessToken: token })).data;
}

export async function getPublicCleanupEvent(token: string, eventId: string, signal?: AbortSignal) {
  return (await apiRequest<{ data: CleanupEventPublicDetail }>(
    `/events/${encodeURIComponent(eventId)}`,
    { accessToken: token, signal },
  )).data;
}

export async function getMyEventParticipation(token: string, eventId: string) {
  return (await apiRequest<{ data: EventParticipation | null }>(
    `/events/${encodeURIComponent(eventId)}/participation`,
    { accessToken: token },
  )).data;
}

export async function joinCleanupEvent(token: string, eventId: string, sessionIds: string[]) {
  return (await apiRequest<{ data: JoinEventResult }>(
    `/events/${encodeURIComponent(eventId)}/participation`,
    { accessToken: token, method: "POST", ...json({ sessionIds }) },
  )).data;
}

export async function updateEventAvailability(token: string, eventId: string, sessionIds: string[]) {
  return (await apiRequest<{ data: EventParticipation }>(
    `/events/${encodeURIComponent(eventId)}/participation/availability`,
    { accessToken: token, method: "PUT", ...json({ sessionIds }) },
  )).data;
}

export async function withdrawFromCleanupEvent(token: string, eventId: string) {
  return (await apiRequest<{ data: EventParticipation }>(
    `/events/${encodeURIComponent(eventId)}/participation/withdraw`,
    { accessToken: token, method: "POST" },
  )).data;
}

export async function listMyEventParticipations(
  token: string,
  scope: "active" | "history" | "all" = "active",
  cursor?: string,
) {
  const query = new URLSearchParams({ scope, limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<{ data: EventParticipationPage }>(
    `/event-participations/me?${query}`,
    { accessToken: token },
  )).data;
}

type EventMapViewport = { west: number; south: number; east: number; north: number; zoom: number; limit?: number; cursor?: string };
type EventMapRadius = { latitude: number; longitude: number; radiusMeters: number; limit?: number; cursor?: string };
function mapQuery(query: EventMapViewport | EventMapRadius) {
  const parameters = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => value !== undefined && parameters.set(key, String(value)));
  return parameters;
}
export async function listPublicCleanupEventMap(token: string, query: EventMapViewport, signal?: AbortSignal) {
  return (await apiRequest<{ data: CleanupEventMapPage }>(`/events/map?${mapQuery(query)}`, { accessToken: token, signal })).data;
}
export async function listNearbyCleanupEventMap(token: string, query: EventMapRadius, signal?: AbortSignal) {
  return (await apiRequest<{ data: CleanupEventMapPage }>(`/events/nearby?${mapQuery(query)}`, { accessToken: token, signal })).data;
}
export async function listOrganizationCleanupEventMap(token: string, organizationId: string, query: EventMapViewport, signal?: AbortSignal) {
  return (await apiRequest<{ data: CleanupEventMapPage }>(`${root(organizationId)}/map?${mapQuery(query)}`, { accessToken: token, signal })).data;
}

export async function listEventParticipants(token: string, organizationId: string, eventId: string, status = "JOINED", cursor?: string) {
  const query = new URLSearchParams({ status, limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<{ data: EventParticipantOperationsPage }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/participants?${query}`, { accessToken: token })).data;
}
export async function allocateEventParticipant(token: string, organizationId: string, eventId: string, participantId: string, sessionId: string) {
  return (await apiRequest<{ data: ParticipantOperationAllocation }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/allocations`, { accessToken: token, method: "POST", ...json({ participantId, sessionId }) })).data;
}
export async function reallocateEventParticipant(token: string, organizationId: string, eventId: string, allocationId: string, sessionId: string) {
  return (await apiRequest<{ data: ParticipantOperationAllocation }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/allocations/${encodeURIComponent(allocationId)}`, { accessToken: token, method: "PATCH", ...json({ sessionId }) })).data;
}
export async function removeEventAllocation(token: string, organizationId: string, eventId: string, allocationId: string) {
  return (await apiRequest<{ data: ParticipantOperationAllocation }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/allocations/${encodeURIComponent(allocationId)}/remove`, { accessToken: token, method: "POST" })).data;
}
export async function markEventAttendance(token: string, organizationId: string, eventId: string, allocationId: string, status: "ATTENDED" | "ABSENT") {
  return (await apiRequest<{ data: ParticipantOperationAllocation }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/allocations/${encodeURIComponent(allocationId)}/attendance`, { accessToken: token, method: "PATCH", ...json({ status }) })).data;
}
export async function removeEventParticipant(token: string, organizationId: string, eventId: string, participantId: string, reason: string) {
  return (await apiRequest<{ data: { participant: EventParticipantOperation; removedAllocationCount: number } }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(participantId)}/remove`, { accessToken: token, method: "POST", ...json({ reason }) })).data;
}

export async function getEventOperations(token: string, organizationId: string, eventId: string) {
  return (await apiRequest<{ data: EventOperations }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/operations`, { accessToken: token })).data;
}
export async function getParticipantEventUpdates(token: string, eventId: string) {
  return (await apiRequest<{ data: ParticipantEventUpdates }>(`/events/${encodeURIComponent(eventId)}/participant-updates`, { accessToken: token })).data;
}
export async function addEventNote(token: string, organizationId: string, eventId: string, visibility: "PARTICIPANTS" | "INTERNAL", noteText: string) {
  return (await apiRequest<{ data: EventOperationNote }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/notes`, { accessToken: token, method: "POST", ...json({ visibility, noteText }) })).data;
}
export async function uploadEventEvidence(
  token: string,
  organizationId: string,
  eventId: string,
  file: File,
  input: { type: "BEFORE" | "PROGRESS" | "AFTER"; sessionId?: string | null; caption?: string | null },
) {
  const intent = (await apiRequest<{ data: EventEvidenceUploadIntent[] }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/evidence/upload-intents`, {
    accessToken: token, method: "POST", ...json({ files: [{ originalFileName: file.name, contentType: file.type, sizeBytes: file.size }] }),
  })).data[0];
  if (!intent) throw new Error("The evidence upload could not be prepared.");
  const { error } = await supabase.storage.from(webEnv.eventEvidenceBucket).uploadToSignedUrl(intent.storagePath, intent.token, file, { contentType: intent.contentType });
  if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
  return (await apiRequest<{ data: EventOperationEvidence }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/evidence`, {
    accessToken: token, method: "POST", ...json({ ...input, storagePath: intent.storagePath, originalFileName: intent.originalFileName, contentType: intent.contentType, sizeBytes: intent.sizeBytes }),
  })).data;
}
export async function transitionEventStatus(token: string, organizationId: string, eventId: string, targetWorkflowStatusId: string, expectedUpdatedAt: string, notes?: string) {
  return (await apiRequest<{ data: EventLifecycleMutation }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/transitions`, { accessToken: token, method: "POST", ...json({ targetWorkflowStatusId, expectedUpdatedAt, notes: notes || undefined }) })).data;
}
export async function transitionEventSessionStatus(token: string, organizationId: string, eventId: string, sessionId: string, status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED", expectedUpdatedAt: string) {
  return (await apiRequest<{ data: EventOperations["sessions"][number] }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}/status`, { accessToken: token, method: "PATCH", ...json({ status, expectedUpdatedAt }) })).data;
}
export async function getEventCompletionReadiness(token: string, organizationId: string, eventId: string) {
  return (await apiRequest<{ data: EventCompletionReadiness }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/completion-readiness`, { accessToken: token })).data;
}
export async function cancelCleanupEvent(token: string, organizationId: string, eventId: string, expectedUpdatedAt: string, reason: string) {
  return (await apiRequest<{ data: EventLifecycleMutation }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/cancel`, { accessToken: token, method: "POST", ...json({ expectedUpdatedAt, reason }) })).data;
}
export async function completeCleanupEvent(token: string, organizationId: string, eventId: string, expectedUpdatedAt: string) {
  return (await apiRequest<{ data: EventLifecycleMutation }>(`${root(organizationId)}/${encodeURIComponent(eventId)}/complete`, { accessToken: token, method: "POST", ...json({ expectedUpdatedAt }) })).data;
}
